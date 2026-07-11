from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlmodel import Session, select
from typing import List, Dict, Any, Optional
from datetime import datetime

from ..database.connection import get_session
from ..database.schema import Cliente, ClientePuntos, Usuario, Auditoria, CuentaPorCobrar
from ..utils.security import get_current_user, PermissionChecker
from ..utils.mail_sender import send_email_with_pdf

router = APIRouter(prefix="/clients", tags=["Clientes"])

@router.get("", response_model=List[Dict[str, Any]])
def get_clients(
    search: Optional[str] = Query(None, description="Buscar por identificación, nombre, dirección, teléfono o correo"),
    include_inactive: Optional[bool] = Query(False, description="Incluir clientes inactivos en el resultado"),
    current_user: Usuario = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    query = select(Cliente)
    if not include_inactive:
        query = query.where(Cliente.activo == True)
        
    if search:
        search_filter = f"%{search}%"
        query = query.where(
            Cliente.nombre.like(search_filter) | 
            Cliente.identificacion.like(search_filter) |
            Cliente.telefono.like(search_filter) |
            Cliente.correo.like(search_filter) |
            Cliente.direccion.like(search_filter)
        )
    clients = session.exec(query).all()
    results = []
    for c in clients:
        puntos = c.puntos.puntos_acumulados if c.puntos else 0
        results.append({
            "id": c.id,
            "identificacion": c.identificacion,
            "nombre": c.nombre,
            "direccion": c.direccion,
            "telefono": c.telefono,
            "correo": c.correo,
            "limite_credito": c.limite_credito,
            "saldo_actual": c.saldo_actual,
            "puntos_acumulados": puntos,
            "activo": c.activo
        })
    return results

@router.post("", status_code=201)
def create_client(
    payload: Dict[str, Any],
    request: Request,
    current_user: Usuario = Depends(PermissionChecker("clients:access")),
    session: Session = Depends(get_session)
):
    identificacion = payload.get("identificacion")
    nombre = payload.get("nombre")
    if not identificacion or not nombre:
        raise HTTPException(status_code=400, detail="Identificación y nombre son requeridos.")
        
    # Verificar duplicado
    dup = session.exec(select(Cliente).where(Cliente.identificacion == identificacion)).first()
    if dup:
        raise HTTPException(status_code=400, detail="Ya existe un cliente con esta identificación.")
        
    cliente = Cliente(
        identificacion=identificacion,
        nombre=nombre,
        direccion=payload.get("direccion"),
        telefono=payload.get("telefono"),
        correo=payload.get("correo"),
        limite_credito=float(payload.get("limite_credito", 0.0)),
        saldo_actual=0.0
    )
    session.add(cliente)
    session.commit()
    session.refresh(cliente)
    
    # Crear cuenta de puntos
    puntos = ClientePuntos(
        cliente_id=cliente.id,
        puntos_acumulados=0,
        puntos_canjeados=0
    )
    session.add(puntos)
    
    # Auditoría
    audit = Auditoria(
        usuario_id=current_user.id,
        accion="CREAR_CLIENTE",
        modulo="Clientes",
        detalles=f"Cliente creado: {cliente.nombre} ({cliente.identificacion})",
        ip_address=request.client.host
    )
    session.add(audit)
    session.commit()
    
    return {"message": "Cliente creado exitosamente", "id": cliente.id}

@router.get("/credits", response_model=List[Dict[str, Any]])
def get_all_credits(
    cliente_id: Optional[int] = Query(None),
    estado: Optional[str] = Query(None),
    search: Optional[str] = Query(None, description="Buscar por consecutivo de venta o nombre de cliente"),
    current_user: Usuario = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    query = select(CuentaPorCobrar)
    if cliente_id:
        query = query.where(CuentaPorCobrar.cliente_id == cliente_id)
    if estado:
        query = query.where(CuentaPorCobrar.estado == estado)
    
    cxc_list = session.exec(query).all()
    results = []
    for c in cxc_list:
        cli = c.cliente
        v = c.venta
        if search:
            search_lower = search.lower()
            if (search_lower not in cli.nombre.lower() and 
                search_lower not in cli.identificacion.lower() and 
                search_lower not in v.consecutivo.lower()):
                continue
        results.append({
            "id": c.id,
            "cliente_id": c.cliente_id,
            "cliente_nombre": cli.nombre,
            "venta_id": c.venta_id,
            "venta_consecutivo": v.consecutivo,
            "monto_total": c.monto_total,
            "saldo_pendiente": c.saldo_pendiente,
            "fecha_vencimiento": c.fecha_vencimiento,
            "estado": c.estado
        })
    return results

@router.get("/{id}/credit")
def get_client_credit_status(
    id: int,
    session: Session = Depends(get_session)
):
    cliente = session.get(Cliente, id)
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
        
    cxc = session.exec(select(CuentaPorCobrar).where(CuentaPorCobrar.cliente_id == id)).all()
    cxc_list = []
    for c in cxc:
        cxc_list.append({
            "id": c.id,
            "venta_consecutivo": c.venta.consecutivo,
            "monto_total": c.monto_total,
            "saldo_pendiente": c.saldo_pendiente,
            "fecha_vencimiento": c.fecha_vencimiento,
            "estado": c.estado
        })
        
    return {
        "cliente": cliente.nombre,
        "limite_credito": cliente.limite_credito,
        "saldo_actual": cliente.saldo_actual,
        "disponible": cliente.limite_credito - cliente.saldo_actual,
        "cuentas": cxc_list
    }

@router.post("/{id}/pay-credit")
def pay_client_credit(
    id: int,
    payload: Dict[str, Any],
    request: Request,
    current_user: Usuario = Depends(PermissionChecker("credit:access")),
    session: Session = Depends(get_session)
):
    cliente = session.get(Cliente, id)
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
        
    monto_pago = float(payload.get("monto", 0))
    metodo_pago = payload.get("metodo_pago", "efectivo")
    
    if monto_pago <= 0:
        raise HTTPException(status_code=400, detail="Monto del pago debe ser mayor a cero")
        
    if cliente.saldo_actual < monto_pago:
        raise HTTPException(status_code=400, detail=f"Monto del pago (₡{monto_pago:.2f}) excede el saldo pendiente (₡{cliente.saldo_actual:.2f})")

    # Registrar el abono en las cuentas por cobrar (FIFO)
    cxc_list = session.exec(
        select(CuentaPorCobrar)
        .where(CuentaPorCobrar.cliente_id == id, CuentaPorCobrar.saldo_pendiente > 0)
        .order_by(CuentaPorCobrar.fecha_vencimiento.asc())
    ).all()
    
    monto_restante = monto_pago
    for cxc in cxc_list:
        if monto_restante <= 0:
            break
        if cxc.saldo_pendiente <= monto_restante:
            monto_restante -= cxc.saldo_pendiente
            cxc.saldo_pendiente = 0.0
            cxc.estado = "pagado"
        else:
            cxc.saldo_pendiente -= monto_restante
            monto_restante = 0.0
        session.add(cxc)
        
    cliente.saldo_actual -= monto_pago
    session.add(cliente)
    
    # Registrar el abono en el arqueo de caja si hay uno abierto
    from ..database.schema import Arqueo, DetalleArqueo
    arqueo = session.exec(select(Arqueo).where(
        Arqueo.usuario_id == current_user.id,
        Arqueo.estado == "abierta"
    )).first()
    if arqueo:
        detalle_caja = DetalleArqueo(
            arqueo_id=arqueo.id,
            tipo_movimiento=f"abono_cliente_{metodo_pago}",
            descripcion=f"Abono de crédito cliente: {cliente.nombre}. Pago via {metodo_pago}",
            monto=monto_pago,
            usuario_id=current_user.id
        )
        session.add(detalle_caja)
        
    # Registrar auditoria
    audit = Auditoria(
        usuario_id=current_user.id,
        accion="ABONO_CREDITO",
        modulo="Clientes",
        detalles=f"Abono de crédito para cliente: {cliente.nombre} por ₡{monto_pago:.2f} via {metodo_pago}. Nuevo saldo deudor: ₡{cliente.saldo_actual:.2f}",
        ip_address=request.client.host
    )
    session.add(audit)
    
    # Enviar correo electrónico real para el abono de crédito
    cliente_valido = cliente and cliente.identificacion != "0000000000"
    correo_destino = payload.get("correo_destino") or (cliente.correo if (cliente_valido and cliente.correo) else None)
    
    enviar_correo = payload.get("enviar_correo")
    if enviar_correo is None:
        enviar_correo = bool(correo_destino)
    elif isinstance(enviar_correo, str):
        enviar_correo = enviar_correo.lower() == "true"
    else:
        enviar_correo = bool(enviar_correo)
        
    if enviar_correo and correo_destino:
        subject = f"Comprobante de abono - Minisúper M Y M"
        body_text = f"Estimado(a) {cliente.nombre},\n\nLe confirmamos que hemos recibido un abono de ₡{monto_pago:.2f} a su cuenta de crédito.\n\nSu nuevo saldo deudor es: ₡{cliente.saldo_actual:.2f}.\n\n¡Gracias por su pago!"
        
        sent = send_email_with_pdf(correo_destino, subject, body_text, None, session)
        
        from ..database.schema import Configuracion
        smtp_host = session.exec(select(Configuracion).where(Configuracion.clave == "smtp_host")).first()
        accion_email = "ENVIO_ABONO_EMAIL_EXITOSO" if sent else "ENVIO_ABONO_EMAIL_SIMULADO"
        detalles_email = f"Envío real de comprobante de abono (₡{monto_pago:.2f}) a {correo_destino} usando SMTP {smtp_host.valor if smtp_host else 'default'}" if sent else f"Envío simulado/fallido de comprobante de abono (₡{monto_pago:.2f}) a {correo_destino} usando SMTP {smtp_host.valor if smtp_host else 'default'}"
        
        audit_email = Auditoria(
            usuario_id=current_user.id,
            accion=accion_email,
            modulo="Clientes",
            detalles=detalles_email,
            ip_address=request.client.host
        )
        session.add(audit_email)
        
    session.commit()
    
    return {"message": "Abono de crédito registrado con éxito", "saldo_actual": cliente.saldo_actual}

@router.put("/{id}", status_code=200)
def update_client(
    id: int,
    payload: Dict[str, Any],
    request: Request,
    current_user: Usuario = Depends(PermissionChecker("clients:access")),
    session: Session = Depends(get_session)
):
    cliente = session.get(Cliente, id)
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
        
    cliente.nombre = payload.get("nombre", cliente.nombre)
    cliente.identificacion = payload.get("identificacion", cliente.identificacion)
    cliente.direccion = payload.get("direccion", cliente.direccion)
    cliente.telefono = payload.get("telefono", cliente.telefono)
    cliente.correo = payload.get("correo", cliente.correo)
    cliente.limite_credito = float(payload.get("limite_credito", cliente.limite_credito))
    cliente.activo = payload.get("activo", cliente.activo)
    
    session.add(cliente)
    
    # Registrar auditoría
    audit = Auditoria(
        usuario_id=current_user.id,
        accion="MODIFICAR_CLIENTE",
        modulo="Clientes",
        detalles=f"Cliente modificado: {cliente.nombre} ({cliente.identificacion}).",
        ip_address=request.client.host
    )
    session.add(audit)
    session.commit()
    
    return {"message": "Cliente actualizado con éxito"}

@router.delete("/{id}", status_code=200)
def delete_client(
    id: int,
    request: Request,
    current_user: Usuario = Depends(PermissionChecker("clients:access")),
    session: Session = Depends(get_session)
):
    cliente = session.get(Cliente, id)
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
        
    # Aplicar borrado lógico
    cliente.activo = False
    session.add(cliente)
    
    # Registrar auditoría
    audit = Auditoria(
        usuario_id=current_user.id,
        accion="ELIMINAR_CLIENTE",
        modulo="Clientes",
        detalles=f"Cliente desactivado (borrado lógico): {cliente.nombre} ({cliente.identificacion})",
        ip_address=request.client.host
    )
    session.add(audit)
    session.commit()
    
    return {"message": "Cliente eliminado con éxito (desactivado)"}

