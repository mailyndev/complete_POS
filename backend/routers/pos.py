from fastapi import APIRouter, Depends, HTTPException, Request
from sqlmodel import Session, select, or_
from typing import List, Dict, Any, Optional
from datetime import datetime

from ..database.connection import get_session
from ..database.schema import (
    Venta, DetalleVenta, Pago, Inventario, MovimientoInventario,
    Lote, Cliente, ClientePuntos, Usuario, Auditoria, Configuracion, Producto,
    WhatsAppLog, Empresa, Marca, get_cr_time
)
from ..utils.security import get_current_user, PermissionChecker
from ..utils.pdf_generator import generate_ticket_pdf
from ..utils.mail_sender import send_email_with_pdf

router = APIRouter(prefix="/pos", tags=["Punto de Venta"])

@router.get("/products")
def search_pos_products(
    q: str,
    current_user: Usuario = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    # Optimizado para búsquedas rápidas en POS
    # Busca coincidencia exacta en código de barras/SKU o parcial en nombre o marca
    stmt = select(Inventario).join(Producto).outerjoin(Marca).where(
        Inventario.sucursal_id == current_user.sucursal_id,
        Producto.activo == True,
        or_(
            Producto.codigo_barras == q,
            Producto.sku == q,
            Producto.nombre.like(f"%{q}%"),
            Marca.nombre.like(f"%{q}%")
        )
    ).limit(30)
    
    items = session.exec(stmt).all()
    results = []
    for it in items:
        p = it.producto
        results.append({
            "id": p.id,
            "sku": p.sku,
            "codigo_barras": p.codigo_barras,
            "nombre": p.nombre,
            "precio_venta": p.precio_venta,
            "precio_costo": p.precio_costo,
            "impuesto_porcentaje": p.impuesto.porcentaje,
            "impuesto_id": p.impuesto_id,
            "unidad_medida": p.unidad_medida,
            "existencia": it.existencia_actual,
            "codigo_cabys": p.codigo_cabys
        })
    return results

def process_single_sale(sale_data: Dict[str, Any], current_user: Usuario, session: Session) -> Venta:
    # 1. Generar o verificar Consecutivo
    consecutivo = sale_data.get("consecutivo")
    if not consecutivo:
        # Generar consecutivo dinámico si no viene (ventas online normales)
        ultimo_registro = session.exec(select(Venta).order_by(Venta.id.desc())).first()
        ultimo_id = ultimo_registro.id if ultimo_registro else 0
        consecutivo = f"T-{current_user.sucursal_id:02d}-{current_user.id:02d}-{ultimo_id + 1:06d}"
    else:
        # Si ya viene (offline sync), validar que no exista para evitar duplicados
        existente = session.exec(select(Venta).where(Venta.consecutivo == consecutivo)).first()
        if existente:
            return existente # Ya procesada anteriormente, retornar sin duplicar

    cliente_id = sale_data.get("cliente_id")
    # Si no se define cliente_id, buscar el cliente general (ID=1)
    if not cliente_id:
        db_cli = session.exec(select(Cliente).where(Cliente.identificacion == "0000000000")).first()
        cliente_id = db_cli.id if db_cli else 1

    subtotal = float(sale_data.get("subtotal", 0))
    descuento = float(sale_data.get("descuento", 0))
    impuesto = float(sale_data.get("impuesto", 0))
    total = float(sale_data.get("total", 0))
    tipo_doc = sale_data.get("tipo_documento", "ticket")
    pagos = sale_data.get("pagos", [])
    items = sale_data.get("items", [])

    # Validaciones de ítems
    if not items:
        raise HTTPException(status_code=400, detail="La venta debe contener al menos un producto.")
    for item in items:
        qty = float(item.get("cantidad", 0))
        precio = float(item.get("precio_unitario", 0))
        desc_unit = float(item.get("descuento_unitario", 0))
        if qty <= 0:
            raise HTTPException(status_code=400, detail="La cantidad vendida debe ser mayor a cero.")
        if precio < 0:
            raise HTTPException(status_code=400, detail="El precio unitario no puede ser negativo.")
        if desc_unit < 0:
            raise HTTPException(status_code=400, detail="El descuento unitario no puede ser negativo.")
        if desc_unit > precio:
            raise HTTPException(status_code=400, detail="El descuento unitario no puede ser mayor al precio unitario.")

    # Si los montos no vienen calculados o vienen en 0 (p. ej., clientes API o pruebas), se calculan dinámicamente
    if total <= 0 and items:
        calc_total = 0.0
        calc_descuento = 0.0
        calc_subtotal = 0.0
        calc_impuesto = 0.0
        
        header_discount = float(sale_data.get("descuento", 0))
        
        for item in items:
            prod_id = item["producto_id"]
            qty = float(item["cantidad"])
            precio = float(item["precio_unitario"])
            desc_unit = float(item.get("descuento_unitario", 0))
            
            prod = session.get(Producto, prod_id)
            tax_rate = prod.impuesto.porcentaje if (prod and prod.impuesto) else 0.0
            
            item_total = qty * (precio - desc_unit)
            item_subtotal = item_total / (1 + tax_rate / 100)
            item_tax = item_total - item_subtotal
            
            calc_total += item_total
            calc_subtotal += item_subtotal
            calc_impuesto += item_tax
            calc_descuento += qty * desc_unit
            
        if header_discount > 0:
            discount_ratio = header_discount / calc_total if calc_total > 0 else 0.0
            adjusted_total = calc_total - header_discount
            adjusted_impuesto = calc_impuesto * (1 - discount_ratio)
            adjusted_subtotal = adjusted_total - adjusted_impuesto
            
            total = adjusted_total
            subtotal = adjusted_subtotal
            impuesto = adjusted_impuesto
            descuento = header_discount + calc_descuento
        else:
            total = calc_total
            subtotal = calc_subtotal
            impuesto = calc_impuesto
            descuento = calc_descuento

    # Validar que la suma de los pagos coincida con el total neto de la venta
    total_pagos = sum(float(p.get("monto", 0)) for p in pagos)
    if abs(total_pagos - total) > 0.01:
        raise HTTPException(status_code=400, detail=f"El total pagado (₡{total_pagos:.2f}) no coincide con el total de la venta (₡{total:.2f}).")

    # Verificar si el programa de fidelización de puntos está activo
    config_puntos = session.exec(select(Configuracion).where(Configuracion.clave == "fidelizacion_activa")).first()
    fidelizacion_activa = config_puntos and config_puntos.valor.lower() == "true"
    
    # Verificar si está permitido vender con stock negativo
    config_neg = session.exec(select(Configuracion).where(Configuracion.clave == "permitir_stock_negativo")).first()
    permitir_negativo = config_neg and config_neg.valor.lower() == "true"

    # Validar stock antes de crear la venta
    for item in items:
        prod_id = item["producto_id"]
        qty = float(item["cantidad"])
        
        # Buscar inventario en la sucursal del cajero
        inv = session.exec(select(Inventario).where(
            Inventario.producto_id == prod_id,
            Inventario.sucursal_id == current_user.sucursal_id
        )).first()
        
        stock_actual = inv.existencia_actual if inv else 0.0
        if stock_actual < qty and not permitir_negativo:
            raise HTTPException(
                status_code=400,
                detail=f"Stock insuficiente para el producto {item.get('nombre', 'ID ' + str(prod_id))}. Disponible: {stock_actual}, Solicitado: {qty}"
            )

    # Crear Cabecera de Venta
    venta = Venta(
        sucursal_id=current_user.sucursal_id,
        caja_id=sale_data.get("caja_id", 1), # default Caja 1 si no se envía
        usuario_id=current_user.id,
        cliente_id=cliente_id,
        consecutivo=consecutivo,
        fecha_venta=get_cr_time(),
        subtotal=subtotal,
        descuento=descuento,
        impuesto=impuesto,
        total=total,
        estado="activa",
        tipo_documento=tipo_doc
    )
    session.add(venta)
    session.commit()
    session.refresh(venta)

    # Crear Detalle y procesar deducción de stock
    for item in items:
        prod_id = item["producto_id"]
        qty = float(item["cantidad"])
        precio = float(item["precio_unitario"])
        desc_unit = float(item.get("descuento_unitario", 0))
        
        prod = session.get(Producto, prod_id)
        prod_cost = prod.precio_costo if prod else 0.0

        # Restar stock de Lotes utilizando FIFO (First In First Out)
        lotes_stmt = select(Lote).where(Lote.producto_id == prod_id, Lote.stock_actual > 0).order_by(Lote.fecha_vencimiento.asc())
        lotes = session.exec(lotes_stmt).all()
        
        qty_to_deduct = qty
        total_cost_deducted = 0.0
        for lote in lotes:
            if qty_to_deduct <= 0:
                break
            lote_cost = lote.costo_unitario if (lote.costo_unitario and lote.costo_unitario > 0) else prod_cost
            if lote.stock_actual >= qty_to_deduct:
                lote.stock_actual -= qty_to_deduct
                total_cost_deducted += qty_to_deduct * lote_cost
                qty_to_deduct = 0
            else:
                total_cost_deducted += lote.stock_actual * lote_cost
                qty_to_deduct -= lote.stock_actual
                lote.stock_actual = 0
            session.add(lote)
            
        # Fallback si no hay suficiente stock en lotes
        if qty_to_deduct > 0:
            total_cost_deducted += qty_to_deduct * prod_cost
            
        avg_cost_unit = total_cost_deducted / qty if qty > 0 else prod_cost

        detalle = DetalleVenta(
            venta_id=venta.id,
            producto_id=prod_id,
            cantidad=qty,
            precio_unitario=precio,
            descuento_unitario=desc_unit,
            costo_unitario=avg_cost_unit
        )
        session.add(detalle)

        # Restar del inventario general
        inv = session.exec(select(Inventario).where(
            Inventario.producto_id == prod_id,
            Inventario.sucursal_id == current_user.sucursal_id
        )).first()
        if inv:
            inv.existencia_actual -= qty
            session.add(inv)
            
            # Registrar Kárdex (Salida)
            mov = MovimientoInventario(
                inventario_id=inv.id,
                tipo_movimiento="salida",
                cantidad=qty,
                motivo=f"Venta en POS. Factura Consecutivo: {consecutivo}",
                usuario_id=current_user.id
            )
            session.add(mov)

    # Registrar Pagos
    puntos_canjeados = 0
    puntos_a_sumar = 0
    
    for p in pagos:
        metodo = p["metodo_pago"]
        monto_pago = float(p["monto"])
        
        # Guardar en la tabla de pagos
        pago_obj = Pago(
            venta_id=venta.id,
            metodo_pago=metodo,
            monto=monto_pago
        )
        session.add(pago_obj)

        # Si el pago es a crédito
        if metodo == "credito":
            db_client = session.get(Cliente, cliente_id)
            if not db_client:
                raise HTTPException(status_code=400, detail="El cliente especificado no existe.")
            
            # El cliente general (ID=1) no debe tener crédito
            if db_client.identificacion == "0000000000":
                raise HTTPException(status_code=400, detail="No se permite vender a crédito al Cliente General.")

            if db_client.saldo_actual + monto_pago > db_client.limite_credito:
                raise HTTPException(
                    status_code=400,
                    detail=f"Límite de crédito excedido. Disponible: ₡{db_client.limite_credito - db_client.saldo_actual:.2f}, Solicitado: ₡{monto_pago:.2f}"
                )
            
            db_client.saldo_actual += monto_pago
            session.add(db_client)

            # Registrar Cuenta por Cobrar (vence en 30 días)
            from backend.database.schema import CuentaPorCobrar
            from datetime import date, timedelta
            cxc = CuentaPorCobrar(
                cliente_id=cliente_id,
                venta_id=venta.id,
                monto_total=monto_pago,
                saldo_pendiente=monto_pago,
                fecha_vencimiento=date.today() + timedelta(days=30),
                estado="al_dia"
            )
            session.add(cxc)

        # Si el pago es mediante puntos
        if metodo == "puntos" and fidelizacion_activa:
            # Puntos a descontar: Cada 10 colones equivale a 1 punto
            puntos_canjeados += int(monto_pago / 10)
            
    # Fidelización de Puntos: acumular puntos
    # Regla: 1 punto por cada 1000 colones en compras (calculado sobre el total neto)
    if fidelizacion_activa:
        puntos_a_sumar = int(total / 1000)
        
        if puntos_a_sumar > 0 or puntos_canjeados > 0:
            db_puntos = session.exec(select(ClientePuntos).where(ClientePuntos.cliente_id == cliente_id)).first()
            if not db_puntos:
                db_puntos = ClientePuntos(cliente_id=cliente_id, puntos_acumulados=0, puntos_canjeados=0)
                
            if puntos_canjeados > db_puntos.puntos_acumulados:
                raise HTTPException(status_code=400, detail="El cliente no posee suficientes puntos para realizar el pago.")
                
            db_puntos.puntos_acumulados += puntos_a_sumar - puntos_canjeados
            db_puntos.puntos_canjeados += puntos_canjeados
            db_puntos.fecha_actualizacion = get_cr_time()
            session.add(db_puntos)

    session.commit()
    return venta

def deliver_sale_digital(venta: Venta, payload: Dict[str, Any], request: Request, current_user: Usuario, session: Session):
    empresa = session.exec(select(Empresa)).first()
    if not empresa:
        empresa = Empresa(
            nombre_comercial="Minisúper M Y M",
            razon_social="Minisúper M Y M S.A.",
            cedula_juridica="3-101-000000",
            direccion="Costa Rica",
            telefonos="0000-0000",
            correo="contacto@minisupermym.com"
        )
    
    # Generar ticket
    pdf_filename = f"uploads/tickets/ticket_{venta.id}.pdf"
    generate_ticket_pdf(empresa, venta, pdf_filename)
    
    cliente_valido = venta.cliente and venta.cliente.identificacion != "0000000000"
    correo_destino = payload.get("correo_destino") or (venta.cliente.correo if (cliente_valido and venta.cliente.correo) else None)
    
    enviar_correo = payload.get("enviar_correo")
    if enviar_correo is None:
        enviar_correo = bool(correo_destino)
    elif isinstance(enviar_correo, str):
        enviar_correo = enviar_correo.lower() == "true"
    else:
        enviar_correo = bool(enviar_correo)
    
    enviar_whatsapp = payload.get("enviar_whatsapp", False) or bool(payload.get("telefono_destino"))
    telefono_destino = payload.get("telefono_destino") or (venta.cliente.telefono if (venta.cliente and venta.cliente.telefono) else None)
    
    if enviar_correo and correo_destino:
        subject = f"Comprobante de compra {venta.consecutivo} - Minisuper M Y M"
        body_text = f"Estimado(a) cliente,\n\nAdjuntamos su comprobante de compra con consecutivo {venta.consecutivo} por un total de ₡{venta.total:.2f}.\n\n¡Gracias por preferir Minisúper M Y M!"
        
        sent = send_email_with_pdf(correo_destino, subject, body_text, pdf_filename, session)
        
        smtp_host = session.exec(select(Configuracion).where(Configuracion.clave == "smtp_host")).first()
        accion_email = "ENVIO_TICKET_EMAIL_EXITOSO" if sent else "ENVIO_TICKET_EMAIL_SIMULADO"
        detalles_email = f"Envío real de ticket {venta.consecutivo} a {correo_destino} usando SMTP {smtp_host.valor if smtp_host else 'default'}" if sent else f"Envío simulado/fallido de ticket {venta.consecutivo} a {correo_destino} usando SMTP {smtp_host.valor if smtp_host else 'default'}"
        
        audit_email = Auditoria(
            usuario_id=current_user.id,
            accion=accion_email,
            modulo="Ventas",
            detalles=detalles_email,
            ip_address=request.client.host
        )
        session.add(audit_email)
        
    if enviar_whatsapp and telefono_destino:
        w_log = WhatsAppLog(
            telefono=telefono_destino,
            mensaje=f"Estimado cliente, adjuntamos su comprobante de compra {venta.consecutivo} por un total de CRC {venta.total:.2f}. Gracias por comprar en Minisúper M Y M.",
            estado="simulado"
        )
        session.add(w_log)
        audit_ws = Auditoria(
            usuario_id=current_user.id,
            accion="ENVIO_TICKET_WHATSAPP_SIMULADO",
            modulo="Ventas",
            detalles=f"Envío de ticket {venta.consecutivo} a WhatsApp {telefono_destino}",
            ip_address=request.client.host
        )
        session.add(audit_ws)
        
    session.commit()
    return f"/static/uploads/tickets/ticket_{venta.id}.pdf"

@router.post("/sales", status_code=201)
def create_sale(
    payload: Dict[str, Any],
    request: Request,
    current_user: Usuario = Depends(PermissionChecker("pos:access")),
    session: Session = Depends(get_session)
):
    # Procesa una venta normal en tiempo real
    venta = process_single_sale(payload, current_user, session)
    
    # Auditoría
    audit = Auditoria(
        usuario_id=current_user.id,
        accion="REGISTRO_VENTA",
        modulo="Ventas",
        detalles=f"Venta creada. Consecutivo: {venta.consecutivo}. Total: ₡{venta.total}",
        ip_address=request.client.host
    )
    session.add(audit)
    session.commit()

    # Generación de PDF y entrega digital hook
    pdf_url = deliver_sale_digital(venta, payload, request, current_user, session)

    return {
        "message": "Venta guardada con éxito",
        "consecutivo": venta.consecutivo,
        "id": venta.id,
        "pdf_url": pdf_url
    }

@router.post("/sales/{id}/deliver")
def deliver_sale_manually(
    id: int,
    payload: Dict[str, Any],
    request: Request,
    current_user: Usuario = Depends(PermissionChecker("pos:access")),
    session: Session = Depends(get_session)
):
    venta = session.get(Venta, id)
    if not venta:
        raise HTTPException(status_code=404, detail="Venta no encontrada")
        
    pdf_url = deliver_sale_digital(venta, payload, request, current_user, session)
    return {"message": "Comprobantes digitales enviados", "pdf_url": pdf_url}

@router.post("/sync", status_code=200)
def sync_offline_sales(
    payload: List[Dict[str, Any]],
    request: Request,
    current_user: Usuario = Depends(PermissionChecker("pos:access")),
    session: Session = Depends(get_session)
):
    # Sincroniza ventas realizadas offline en IndexedDB
    completadas = []
    conflictos = []
    
    for venta_data in payload:
        consecutivo = venta_data.get("consecutivo")
        try:
            venta = process_single_sale(venta_data, current_user, session)
            completadas.append(consecutivo)
        except Exception as e:
            conflictos.append({
                "consecutivo": consecutivo,
                "error": str(e)
            })
            
            # Registrar auditoría de conflicto
            audit_err = Auditoria(
                usuario_id=current_user.id,
                accion="CONFLICTO_SINC_VENTA",
                modulo="Ventas",
                detalles=f"Error al sincronizar venta offline {consecutivo}: {str(e)}",
                ip_address=request.client.host
            )
            session.add(audit_err)
            session.commit()

    # Log de sincronización global exitosa
    if completadas:
        audit = Auditoria(
            usuario_id=current_user.id,
            accion="SINCRONIZACION_POS",
            modulo="Ventas",
            detalles=f"Sincronizadas {len(completadas)} ventas offline de manera exitosa. Fallidas: {len(conflictos)}",
            ip_address=request.client.host
        )
        session.add(audit)
        session.commit()

    return {
        "status": "completed",
        "sincronizadas": completadas,
        "conflictos": conflictos
    }

# --- SUSPENDER VENTAS ---

@router.post("/suspend")
def suspend_sale(
    payload: Dict[str, Any],
    current_user: Usuario = Depends(PermissionChecker("pos:access")),
    session: Session = Depends(get_session)
):
    # Crea una venta con estado 'suspendida'
    # Así el stock no se resta (sólo cambia a estado suspendida)
    # Al recuperarla, se procesa la venta normal y se actualiza a 'activa' y descuenta stock
    consecutivo = payload.get("consecutivo")
    if not consecutivo:
        ultimo_id = session.exec(select(Venta).order_by(Venta.id.desc())).first()
        ultimo_id = ultimo_id.id if ultimo_id else 0
        consecutivo = f"SUSP-{current_user.sucursal_id:02d}-{ultimo_id + 1:06d}"
        
    cliente_id = payload.get("cliente_id", 1)
    
    venta = Venta(
        sucursal_id=current_user.sucursal_id,
        caja_id=payload.get("caja_id", 1),
        usuario_id=current_user.id,
        cliente_id=cliente_id,
        consecutivo=consecutivo,
        fecha_venta=get_cr_time(),
        subtotal=float(payload.get("subtotal", 0)),
        descuento=float(payload.get("descuento", 0)),
        impuesto=float(payload.get("impuesto", 0)),
        total=float(payload.get("total", 0)),
        estado="suspendida"
    )
    session.add(venta)
    session.commit()
    session.refresh(venta)

    # Detalle temporal de la venta
    for item in payload.get("items", []):
        detalle = DetalleVenta(
            venta_id=venta.id,
            producto_id=item["producto_id"],
            cantidad=float(item["cantidad"]),
            precio_unitario=float(item["precio_unitario"]),
            descuento_unitario=float(item.get("descuento_unitario", 0))
        )
        session.add(detalle)
        
    session.commit()
    return {"message": "Venta suspendida con éxito", "consecutivo": consecutivo}

@router.get("/suspended")
def get_suspended_sales(
    current_user: Usuario = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    # Retorna ventas suspendidas del usuario actual en la sucursal
    stmt = select(Venta).where(
        Venta.usuario_id == current_user.id,
        Venta.estado == "suspendida"
    ).order_by(Venta.fecha_venta.desc())
    
    ventas = session.exec(stmt).all()
    results = []
    
    for v in ventas:
        items = []
        for det in v.detalles:
            items.append({
                "producto_id": det.producto_id,
                "nombre": det.producto.nombre,
                "sku": det.producto.sku,
                "codigo_barras": det.producto.codigo_barras,
                "cantidad": det.cantidad,
                "precio_unitario": det.precio_unitario,
                "descuento_unitario": det.descuento_unitario,
                "impuesto_porcentaje": det.producto.impuesto.porcentaje
            })
            
        results.append({
            "id": v.id,
            "consecutivo": v.consecutivo,
            "fecha": v.fecha_venta,
            "subtotal": v.subtotal,
            "descuento": v.descuento,
            "impuesto": v.impuesto,
            "total": v.total,
            "cliente_id": v.cliente_id,
            "cliente_nombre": v.cliente.nombre if v.cliente else "General",
            "items": items
        })
    return results

@router.delete("/suspended/{id}")
def delete_suspended_sale(
    id: int,
    current_user: Usuario = Depends(PermissionChecker("pos:access")),
    session: Session = Depends(get_session)
):
    venta = session.get(Venta, id)
    if not venta or venta.estado != "suspendida":
        raise HTTPException(status_code=404, detail="Venta suspendida no encontrada")
        
    # Borrar los detalles de la venta suspendida y luego la cabecera
    for det in venta.detalles:
        session.delete(det)
    session.delete(venta)
    session.commit()
    return {"message": "Venta suspendida eliminada correctamente"}
