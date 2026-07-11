from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select, func
from typing import List, Dict, Any
from datetime import datetime, date, timedelta

from ..database.connection import get_session
from ..database.schema import (
    Venta, DetalleVenta, Inventario, Lote, Producto, Categoria,
    Cliente, CuentaPorCobrar, Usuario, Arqueo, Pago, get_cr_time
)
from ..utils.security import get_current_user

router = APIRouter(prefix="/reports", tags=["Reportes y Analítica"])

@router.get("/dashboard")
def get_dashboard_data(
    current_user: Usuario = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    hoy = get_cr_time().date()
    inicio_mes = date(hoy.year, hoy.month, 1)
    
    # 1. Ventas de Hoy
    stmt_hoy = select(Venta).where(
        Venta.sucursal_id == current_user.sucursal_id,
        func.date(Venta.fecha_venta) == hoy,
        Venta.estado == "activa"
    )
    ventas_hoy = session.exec(stmt_hoy).all()
    total_hoy = sum(v.total for v in ventas_hoy)
    
    # 2. Ventas del Mes
    stmt_mes = select(Venta).where(
        Venta.sucursal_id == current_user.sucursal_id,
        func.date(Venta.fecha_venta) >= inicio_mes,
        Venta.estado == "activa"
    )
    ventas_mes = session.exec(stmt_mes).all()
    total_mes = sum(v.total for v in ventas_mes)
    
    # 3. Utilidad Real (Venta - Costo) de Hoy y del Mes
    utilidad_hoy = 0.0
    for v in ventas_hoy:
        cogs = 0.0
        for det in v.detalles:
            det_cost = det.costo_unitario if (det.costo_unitario is not None and det.costo_unitario > 0) else det.producto.precio_costo
            cogs += det.cantidad * det_cost
        utilidad_hoy += v.subtotal - cogs

    utilidad_mes = 0.0
    for v in ventas_mes:
        cogs = 0.0
        for det in v.detalles:
            det_cost = det.costo_unitario if (det.costo_unitario is not None and det.costo_unitario > 0) else det.producto.precio_costo
            cogs += det.cantidad * det_cost
        utilidad_mes += v.subtotal - cogs
        
    # 4. Conteo de Productos Agotados y Stock Bajo
    stmt_inv = select(Inventario).where(Inventario.sucursal_id == current_user.sucursal_id)
    inventarios = session.exec(stmt_inv).all()
    
    agotados_count = 0
    stock_bajo_count = 0
    
    for inv in inventarios:
        if inv.existencia_actual <= 0:
            agotados_count += 1
        elif inv.existencia_actual <= inv.producto.stock_minimo:
            stock_bajo_count += 1
            
    # 5. Productos Próximos a Vencer (en los próximos 30 días o ya vencidos)
    stmt_lots = select(Lote).where(Lote.stock_actual > 0)
    lotes = session.exec(stmt_lots).all()
    lotes_vencer_count = 0
    date_limit = date.today() + timedelta(days=30)
    
    for l in lotes:
        if l.fecha_vencimiento <= date_limit:
            lotes_vencer_count += 1
            
    # 6. Clientes Morosos (Cuentas por cobrar vencidas)
    stmt_cxc = select(CuentaPorCobrar).where(
        CuentaPorCobrar.estado == "moroso",
        CuentaPorCobrar.saldo_pendiente > 0
    )
    cxc_vencidas = session.exec(stmt_cxc).all()
    clientes_morosos_monto = sum(c.saldo_pendiente for c in cxc_vencidas)
    clientes_morosos_count = len(list(set(c.cliente_id for c in cxc_vencidas)))
    
    # 7. Información de Caja Actual del Turno
    stmt_arqueo = select(Arqueo).where(
        Arqueo.usuario_id == current_user.id,
        Arqueo.estado == "abierta"
    )
    open_arqueo = session.exec(stmt_arqueo).first()
    
    caja_data = {"caja_abierta": False, "monto_inicial": 0.0, "fecha_apertura": None, "ventas_turno": 0.0, "pagos_tipo": {}}
    if open_arqueo:
        caja_data["caja_abierta"] = True
        caja_data["caja_nombre"] = open_arqueo.caja.nombre
        caja_data["monto_inicial"] = open_arqueo.monto_inicial
        caja_data["fecha_apertura"] = open_arqueo.fecha_apertura
        
        # Calcular ventas del turno
        ventas_turno_stmt = select(Venta).where(
            Venta.caja_id == open_arqueo.caja_id,
            Venta.usuario_id == current_user.id,
            Venta.fecha_venta >= open_arqueo.fecha_apertura,
            Venta.estado == "activa"
        )
        ventas_t = session.exec(ventas_turno_stmt).all()
        caja_data["ventas_turno"] = sum(v.total for v in ventas_t)
        
        pagos_tipo = {"efectivo": 0.0, "tarjeta": 0.0, "transferencia": 0.0, "sinpe": 0.0, "credito": 0.0, "puntos": 0.0}
        for v in ventas_t:
            for p in v.pagos:
                pagos_tipo[p.metodo_pago] = pagos_tipo.get(p.metodo_pago, 0.0) + p.monto
        caja_data["pagos_tipo"] = pagos_tipo

    # 8. Últimas 5 ventas generales (Dashboard Admin/Gerente)
    stmt_recent = select(Venta).where(
        Venta.sucursal_id == current_user.sucursal_id,
        Venta.estado == "activa"
    ).order_by(Venta.fecha_venta.desc()).limit(5)
    recent_sales = session.exec(stmt_recent).all()
    recent_sales_list = []
    
    for v in recent_sales:
        recent_sales_list.append({
            "consecutivo": v.consecutivo,
            "cajero": v.usuario.nombre,
            "total": v.total,
            "fecha": v.fecha_venta,
            "tipo_documento": v.tipo_documento
        })

    return {
        "ventas_hoy": round(total_hoy, 2),
        "ventas_mes": round(total_mes, 2),
        "utilidad_hoy": round(utilidad_hoy, 2),
        "utilidad_mes": round(utilidad_mes, 2),
        "productos_agotados": agotados_count,
        "productos_stock_bajo": stock_bajo_count,
        "productos_por_vencer": lotes_vencer_count,
        "clientes_morosos_monto": round(clientes_morosos_monto, 2),
        "clientes_morosos_cantidad": clientes_morosos_count,
        "caja_turno": caja_data,
        "ultimas_ventas": recent_sales_list
    }

@router.get("/sales")
def get_detailed_sales_report(
    start: str = Query(...),
    end: str = Query(...),
    current_user: Usuario = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    try:
        # Convertir strings de fechas a objetos date
        start_date = datetime.strptime(start, "%Y-%m-%d").date()
        end_date = datetime.strptime(end, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Formato de fechas inválido. Debe ser YYYY-MM-DD.")

    # Convertir a datetime para rangos completos del día
    start_dt = datetime(start_date.year, start_date.month, start_date.day, 0, 0, 0)
    end_dt = datetime(end_date.year, end_date.month, end_date.day, 23, 59, 59)

    stmt = select(Venta).where(
        Venta.sucursal_id == current_user.sucursal_id,
        Venta.fecha_venta >= start_dt,
        Venta.fecha_venta <= end_dt,
        Venta.estado == "activa"
    ).order_by(Venta.fecha_venta.desc())
    
    sales = session.exec(stmt).all()
    results = []
    
    for v in sales:
        cogs = 0.0
        for det in v.detalles:
            det_cost = det.costo_unitario if (det.costo_unitario is not None and det.costo_unitario > 0) else det.producto.precio_costo
            cogs += det.cantidad * det_cost
            
        utilidad = v.subtotal - cogs
        
        results.append({
            "id": v.id,
            "consecutivo": v.consecutivo,
            "fecha": v.fecha_venta,
            "subtotal": v.subtotal,
            "descuento": v.descuento,
            "impuesto": v.impuesto,
            "total": v.total,
            "utilidad": round(utilidad, 2)
        })
        
    return results
