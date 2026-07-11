from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlmodel import Session, select
from typing import List, Dict, Any
from datetime import datetime

from ..database.connection import get_session
from ..database.schema import Arqueo, DetalleArqueo, Usuario, Auditoria, Caja, get_cr_time
from ..utils.security import get_current_user, PermissionChecker

router = APIRouter(prefix="/cash", tags=["Caja"])

@router.get("/status")
def check_cash_status(current_user: Usuario = Depends(get_current_user), session: Session = Depends(get_session)):
    # Buscar arqueo abierto para este usuario en su sucursal
    # (Un usuario cajero solo maneja una caja)
    stmt = select(Arqueo).where(
        Arqueo.usuario_id == current_user.id,
        Arqueo.estado == "abierta"
    )
    open_arqueo = session.exec(stmt).first()
    
    if not open_arqueo:
        return {"open": False, "arqueo": None}
        
    return {
        "open": True,
        "arqueo": {
            "id": open_arqueo.id,
            "caja_id": open_arqueo.caja_id,
            "caja_nombre": open_arqueo.caja.nombre,
            "fecha_apertura": open_arqueo.fecha_apertura,
            "monto_inicial": open_arqueo.monto_inicial
        }
    }

@router.post("/open")
def open_cash_register(
    payload: Dict[str, Any],
    request: Request,
    current_user: Usuario = Depends(PermissionChecker("cash:access")),
    session: Session = Depends(get_session)
):
    monto_inicial = float(payload.get("monto_inicial", 0))
    caja_id = payload.get("caja_id")
    
    # Validar si ya hay un arqueo abierto
    stmt_open = select(Arqueo).where(
        Arqueo.usuario_id == current_user.id,
        Arqueo.estado == "abierta"
    )
    if session.exec(stmt_open).first():
        raise HTTPException(status_code=400, detail="Ya posee un turno de caja abierto.")

    # Si no se especifica caja_id, buscar la primera disponible en la sucursal del usuario
    if not caja_id:
        caja_stmt = select(Caja).where(Caja.sucursal_id == current_user.sucursal_id, Caja.activa == True)
        caja_obj = session.exec(caja_stmt).first()
        if not caja_obj:
            raise HTTPException(status_code=404, detail="No se encontraron cajas activas para esta sucursal.")
        caja_id = caja_obj.id
    
    arqueo = Arqueo(
        caja_id=caja_id,
        usuario_id=current_user.id,
        fecha_apertura=get_cr_time(),
        monto_inicial=monto_inicial,
        estado="abierta"
    )
    session.add(arqueo)
    session.commit()
    session.refresh(arqueo)
    
    # Crear detalle inicial (Fondo de caja)
    detalle = DetalleArqueo(
        arqueo_id=arqueo.id,
        tipo_movimiento="fondo_caja",
        descripcion="Apertura de turno de caja - Fondo Inicial",
        monto=monto_inicial,
        usuario_id=current_user.id
    )
    session.add(detalle)
    
    # Auditoría
    audit = Auditoria(
        usuario_id=current_user.id,
        accion="APERTURA_CAJA",
        modulo="Caja",
        detalles=f"Apertura de caja {arqueo.caja.nombre} con fondo de ₡{monto_inicial}",
        ip_address=request.client.host
    )
    session.add(audit)
    session.commit()
    
    return {"message": "Caja abierta exitosamente", "arqueo_id": arqueo.id}

@router.post("/transaction")
def create_cash_transaction(
    payload: Dict[str, Any],
    request: Request,
    current_user: Usuario = Depends(PermissionChecker("cash:access")),
    session: Session = Depends(get_session)
):
    tipo_movimiento = payload.get("tipo_movimiento") # retiro_efectivo, pago_menor, gasto_operativo, ingreso_extraordinario, ajuste
    monto = float(payload.get("monto", 0))
    descripcion = payload.get("descripcion", "")
    
    if not tipo_movimiento or monto <= 0 or not descripcion:
        raise HTTPException(status_code=400, detail="Monto, descripción y tipo de movimiento válidos son requeridos.")
        
    # Obtener arqueo abierto
    arqueo = session.exec(select(Arqueo).where(Arqueo.usuario_id == current_user.id, Arqueo.estado == "abierta")).first()
    if not arqueo:
        raise HTTPException(status_code=400, detail="Debe abrir la caja antes de registrar movimientos.")
        
    detalle = DetalleArqueo(
        arqueo_id=arqueo.id,
        tipo_movimiento=tipo_movimiento,
        descripcion=descripcion,
        monto=monto,
        usuario_id=current_user.id
    )
    session.add(detalle)
    
    # Auditoría
    audit = Auditoria(
        usuario_id=current_user.id,
        accion=f"CAJA_{tipo_movimiento.upper()}",
        modulo="Caja",
        detalles=f"Transacción en caja: {tipo_movimiento}. Monto: ₡{monto}. Detalle: {descripcion}",
        ip_address=request.client.host
    )
    session.add(audit)
    session.commit()
    
    return {"message": "Movimiento registrado con éxito"}

@router.post("/close")
def close_cash_register(
    payload: Dict[str, Any],
    request: Request,
    current_user: Usuario = Depends(PermissionChecker("cash:access")),
    session: Session = Depends(get_session)
):
    efectivo_contado = float(payload.get("monto_final_efectivo", 0))
    tarjeta_contado = float(payload.get("monto_final_tarjeta", 0))
    transferencia_contado = float(payload.get("monto_final_transferencia", 0))
    observaciones = payload.get("observaciones", "")
    
    # Obtener arqueo abierto
    arqueo = session.exec(select(Arqueo).where(Arqueo.usuario_id == current_user.id, Arqueo.estado == "abierta")).first()
    if not arqueo:
        raise HTTPException(status_code=400, detail="No se encontró un turno de caja abierto para este usuario.")
        
    # Calcular totales esperados según transacciones de venta y movimientos
    # 1. Ventas realizadas durante este arqueo
    # En Fase 1 buscaremos ventas registradas desde la fecha de apertura
    from ..database.schema import Venta, Pago
    ventas_stmt = select(Venta).where(
        Venta.caja_id == arqueo.caja_id,
        Venta.usuario_id == current_user.id,
        Venta.fecha_venta >= arqueo.fecha_apertura,
        Venta.estado == "activa"
    )
    ventas_turno = session.exec(ventas_stmt).all()
    
    ventas_efectivo = 0.0
    ventas_tarjeta = 0.0
    ventas_transferencia = 0.0
    
    for v in ventas_turno:
        for p in v.pagos:
            if p.metodo_pago == "efectivo":
                ventas_efectivo += p.monto
            elif p.metodo_pago == "tarjeta":
                ventas_tarjeta += p.monto
            elif p.metodo_pago in ["transferencia", "sinpe"]:
                ventas_transferencia += p.monto

    # 2. Movimientos manuales de caja chica (DetalleArqueo)
    detalles_stmt = select(DetalleArqueo).where(DetalleArqueo.arqueo_id == arqueo.id)
    detalles_turno = session.exec(detalles_stmt).all()
    
    efectivo_movimientos = 0.0
    tarjeta_movimientos = 0.0
    transferencia_movimientos = 0.0
    
    for d in detalles_turno:
        # fondo_caja e ingreso_extraordinario y abono_cliente_efectivo suman al efectivo
        if d.tipo_movimiento in ["fondo_caja", "ingreso_extraordinario", "abono_cliente_efectivo"]:
            efectivo_movimientos += d.monto
        elif d.tipo_movimiento == "abono_cliente_tarjeta":
            tarjeta_movimientos += d.monto
        elif d.tipo_movimiento == "abono_cliente_transferencia":
            transferencia_movimientos += d.monto
        # retiros, pagos menores, gastos operativos y pagos de proveedor en efectivo restan
        elif d.tipo_movimiento in ["retiro_efectivo", "pago_menor", "gasto_operativo", "pago_proveedor_efectivo"]:
            efectivo_movimientos -= d.monto
        elif d.tipo_movimiento == "pago_proveedor_tarjeta":
            tarjeta_movimientos -= d.monto
        elif d.tipo_movimiento == "pago_proveedor_transferencia":
            transferencia_movimientos -= d.monto
            
    efectivo_esperado = efectivo_movimientos + ventas_efectivo
    tarjeta_esperada = tarjeta_movimientos + ventas_tarjeta
    transferencia_esperada = transferencia_movimientos + ventas_transferencia
    
    # Calcular diferencias
    diferencia_efectivo = efectivo_contado - efectivo_esperado
    diferencia_tarjeta = tarjeta_contado - tarjeta_esperada
    diferencia_transferencia = transferencia_contado - transferencia_esperada
    
    arqueo.fecha_cierre = get_cr_time()
    arqueo.monto_final_efectivo = efectivo_contado
    arqueo.monto_final_tarjeta = tarjeta_contado
    arqueo.monto_final_transferencia = transferencia_contado
    arqueo.observaciones = f"Esperado: Ef={efectivo_esperado:.2f}, Tar={tarjeta_esperada:.2f}, Trans={transferencia_esperada:.2f}. " \
                          f"Contado: Ef={efectivo_contado:.2f}, Tar={tarjeta_contado:.2f}, Trans={transferencia_contado:.2f}. " \
                          f"Obs: {observaciones}"
    arqueo.estado = "cerrada"
    
    session.add(arqueo)
    
    # Auditoría
    audit = Auditoria(
        usuario_id=current_user.id,
        accion="CIERRE_CAJA",
        modulo="Caja",
        detalles=f"Cierre de caja {arqueo.caja.nombre}. Diferencia total: Ef={diferencia_efectivo:.2f}, Tar={diferencia_tarjeta:.2f}",
        ip_address=request.client.host
    )
    session.add(audit)
    session.commit()
    
    return {
        "message": "Caja cerrada exitosamente.",
        "totales_esperados": {
            "efectivo": efectivo_esperado,
            "tarjeta": tarjeta_esperada,
            "transferencia": transferencia_esperada
        },
        "totales_contados": {
            "efectivo": efectivo_contado,
            "tarjeta": tarjeta_contado,
            "transferencia": transferencia_contado
        },
        "diferencias": {
            "efectivo": diferencia_efectivo,
            "tarjeta": diferencia_tarjeta,
            "transferencia": diferencia_transferencia
        }
    }

@router.get("/history")
def get_cash_history(current_user: Usuario = Depends(get_current_user), session: Session = Depends(get_session)):
    stmt = select(Arqueo).where(Arqueo.caja.has(sucursal_id=current_user.sucursal_id)).order_by(Arqueo.fecha_apertura.desc())
    arqueos = session.exec(stmt).all()
    
    results = []
    for a in arqueos:
        results.append({
            "id": a.id,
            "caja": a.caja.nombre,
            "usuario": a.usuario.nombre,
            "fecha_apertura": a.fecha_apertura,
            "fecha_cierre": a.fecha_cierre,
            "monto_inicial": a.monto_inicial,
            "monto_final_efectivo": a.monto_final_efectivo,
            "monto_final_tarjeta": a.monto_final_tarjeta,
            "monto_final_transferencia": a.monto_final_transferencia,
            "observaciones": a.observaciones,
            "estado": a.estado
        })
    return results
