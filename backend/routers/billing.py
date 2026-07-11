from fastapi import APIRouter, Depends, HTTPException, Request
from sqlmodel import Session, select
from typing import List, Dict, Any, Optional
from datetime import datetime, date
import random

from ..database.connection import get_session
from ..database.schema import Venta, FacturaElectronica, Usuario, Auditoria, Empresa, Inventario, MovimientoInventario, get_cr_time
from ..utils.security import get_current_user, PermissionChecker

router = APIRouter(prefix="/billing", tags=["Facturación Electrónica"])

def generar_clave_consecutivo(venta_id: int, tipo_doc_code: str, cedula_emisor: str) -> tuple:
    # Formato Costa Rica
    # Pais (3) + Dia (2) + Mes (2) + Año (2) + Cedula (12) + Consecutivo (20) + Situacion (1) + CodigoSeguridad (8)
    hoy = get_cr_time()
    dd = f"{hoy.day:02d}"
    mm = f"{hoy.month:02d}"
    yy = f"{hoy.year % 100:02d}"
    
    # Limpiar cedula emisor a 12 caracteres (eliminar guiones y rellenar)
    ced_clean = "".join(c for c in cedula_emisor if c.isdigit())
    if len(ced_clean) > 12:
        ced_clean = ced_clean[:12]
    else:
        ced_clean = ced_clean.zfill(12)
        
    # Consecutivo (20 dígitos): Casa Matriz (3) + Terminal (5) + Tipo Doc (2) + Consecutivo Correlativo (10)
    matriz = "001"
    terminal = "00001"
    correlativo = f"{venta_id:010d}"
    consecutivo = f"{matriz}{terminal}{tipo_doc_code}{correlativo}"
    
    # Clave (50 dígitos)
    pais = "506"
    situacion = "1" # 1 = Normal
    seguridad = f"{random.randint(10000000, 99999999):08d}"
    
    clave = f"{pais}{dd}{mm}{yy}{ced_clean}{consecutivo}{situacion}{seguridad}"
    return clave, consecutivo

@router.post("/emit/{venta_id}", status_code=201)
def emit_invoice(
    venta_id: int,
    request: Request,
    current_user: Usuario = Depends(PermissionChecker("pos:access")),
    session: Session = Depends(get_session)
):
    venta = session.get(Venta, venta_id)
    if not venta:
        raise HTTPException(status_code=404, detail="Venta no encontrada")
        
    # Verificar si ya tiene factura
    existente = session.exec(select(FacturaElectronica).where(FacturaElectronica.venta_id == venta_id)).first()
    if existente:
        return {
            "message": "La factura electrónica ya fue emitida para esta venta.",
            "factura": {
                "id": existente.id,
                "clave": existente.clave,
                "consecutivo": existente.consecutivo,
                "estado_hacienda": existente.estado_hacienda,
                "fecha_envio": existente.fecha_envio
            }
        }
        
    # Obtener datos de la empresa para la cédula
    empresa = session.exec(select(Empresa)).first()
    cedula_juridica = empresa.cedula_juridica if empresa else "3-101-123456"
    
    # Código comprobante: 01 = Factura Electrónica, 04 = Tiquete Electrónico
    tipo_doc_code = "04" if venta.tipo_documento == "ticket" else "01"
    
    clave, consecutivo = generar_clave_consecutivo(venta_id, tipo_doc_code, cedula_juridica)
    
    # XML de envío simulado
    xml_envio = f"""<?xml version="1.0" encoding="utf-8"?>
<FacturaElectronica xmlns="https://cdn.tributacion.go.cr/xml-schemas/v4.3/facturaElectronica" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
    <Clave>{clave}</Clave>
    <CodigoActividad>521101</CodigoActividad>
    <NumeroConsecutivo>{consecutivo}</NumeroConsecutivo>
    <FechaEmision>{get_cr_time().isoformat()}</FechaEmision>
    <Emisor>
        <Nombre>{empresa.razon_social if empresa else 'Abastecedor Demo'}</Nombre>
        <Identificacion>
            <Tipo>02</Tipo>
            <Numero>{cedula_juridica.replace("-", "")}</Numero>
        </Identificacion>
    </Emisor>
    <Receptor>
        <Nombre>{venta.cliente.nombre if venta.cliente else 'Cliente General'}</Nombre>
        <Identificacion>
            <Tipo>01</Tipo>
            <Numero>{venta.cliente.identificacion.replace("-", "") if venta.cliente else '0000000000'}</Numero>
        </Identificacion>
    </Receptor>
    <DetalleServicio>
        <!-- Productos listados en venta -->
        <MontoTotalLinea>{venta.total}</MontoTotalLinea>
    </DetalleServicio>
    <ResumenFactura>
        <CodigoTipoMoneda>
            <CodigoMoneda>CRC</CodigoMoneda>
            <TipoCambio>1.0</TipoCambio>
        </CodigoTipoMoneda>
        <TotalServGravados>{venta.subtotal}</TotalServGravados>
        <TotalImpuesto>{venta.impuesto}</TotalImpuesto>
        <TotalComprobante>{venta.total}</TotalComprobante>
    </ResumenFactura>
</FacturaElectronica>
"""
    # Simular estado de aceptación por Hacienda (Aceptado 90% de las veces, Rechazado 10%)
    status_options = ["Aceptado", "Aceptado", "Aceptado", "Aceptado", "Aceptado", "Aceptado", "Aceptado", "Aceptado", "Aceptado", "Rechazado"]
    estado_simulado = random.choice(status_options)
    
    xml_respuesta = f"""<?xml version="1.0" encoding="utf-8"?>
<MensajeHacienda xmlns="https://cdn.tributacion.go.cr/xml-schemas/v4.3/mensajeHacienda">
    <Clave>{clave}</Clave>
    <NumeroConsecutivoReceptor>{consecutivo}</NumeroConsecutivoReceptor>
    <FechaEmisionDoc>{get_cr_time().isoformat()}</FechaEmisionDoc>
    <Mensaje>{1 if estado_simulado == 'Aceptado' else 3}</Mensaje>
    <DetalleMensaje>{"Autorizado por la Dirección General de Tributación Directa" if estado_simulado == 'Aceptado' else "Error de validación en esquema XML o Datos de Impuesto"}</DetalleMensaje>
</MensajeHacienda>
"""
    error_msg = None if estado_simulado == "Aceptado" else "Error de validación en esquema XML o Datos de Impuesto"

    fe = FacturaElectronica(
        venta_id=venta_id,
        clave=clave,
        consecutivo=consecutivo,
        estado_hacienda=estado_simulado,
        fecha_envio=get_cr_time(),
        xml_enviado=xml_envio,
        xml_respuesta=xml_respuesta,
        mensaje_error=error_msg
    )
    session.add(fe)
    
    # Registrar auditoria
    audit = Auditoria(
        usuario_id=current_user.id,
        accion="EMITIR_FACTURA_ELECTRONICA",
        modulo="Facturación",
        detalles=f"Documento electrónico emitido para Venta #{venta_id}. Clave: {clave}. Estado Hacienda: {estado_simulado}",
        ip_address=request.client.host
    )
    session.add(audit)
    session.commit()
    session.refresh(fe)
    
    return {
        "message": "Facturación electrónica completada",
        "factura": {
            "id": fe.id,
            "clave": fe.clave,
            "consecutivo": fe.consecutivo,
            "estado_hacienda": fe.estado_hacienda,
            "fecha_envio": fe.fecha_envio,
            "mensaje_error": fe.mensaje_error
        }
    }

@router.get("/invoice/{venta_id}")
def get_invoice_by_venta(
    venta_id: int,
    session: Session = Depends(get_session)
):
    fe = session.exec(select(FacturaElectronica).where(FacturaElectronica.venta_id == venta_id)).first()
    if not fe:
        return {"emitida": False}
        
    return {
        "emitida": True,
        "id": fe.id,
        "clave": fe.clave,
        "consecutivo": fe.consecutivo,
        "estado_hacienda": fe.estado_hacienda,
        "fecha_envio": fe.fecha_envio,
        "xml_enviado": fe.xml_enviado,
        "xml_respuesta": fe.xml_respuesta,
        "mensaje_error": fe.mensaje_error
    }

@router.post("/invoice/{id}/cancel")
def cancel_invoice(
    id: int,
    request: Request,
    current_user: Usuario = Depends(PermissionChecker("pos:access")),
    session: Session = Depends(get_session)
):
    fe_orig = session.get(FacturaElectronica, id)
    if not fe_orig:
        raise HTTPException(status_code=404, detail="Factura electrónica no encontrada")
        
    if fe_orig.estado_hacienda == "Anulada":
        raise HTTPException(status_code=400, detail="Esta factura ya se encuentra anulada")
        
    empresa = session.exec(select(Empresa)).first()
    cedula_juridica = empresa.cedula_juridica if empresa else "3-101-123456"
    
    # Generar clave de Nota de Crédito (Tipo 03)
    nc_clave, nc_consecutivo = generar_clave_consecutivo(fe_orig.venta_id, "03", cedula_juridica)
    
    fe_orig.estado_hacienda = "Anulada"
    fe_orig.mensaje_error = f"Anulada con Nota de Crédito Clave: {nc_clave}"
    session.add(fe_orig)
    
    venta = session.get(Venta, fe_orig.venta_id)
    if venta:
        venta.estado = "anulada"
        session.add(venta)
        
        # Devolver stock a inventario
        for det in venta.detalles:
            inv = session.exec(select(Inventario).where(
                Inventario.producto_id == det.producto_id,
                Inventario.sucursal_id == venta.sucursal_id
            )).first()
            if inv:
                inv.existencia_actual += det.cantidad
                session.add(inv)
                
                # Registrar movimiento kárdex
                mov = MovimientoInventario(
                    inventario_id=inv.id,
                    tipo_movimiento="entrada",
                    cantidad=det.cantidad,
                    motivo=f"Entrada por anulación de Venta (Nota de Crédito: {nc_consecutivo})",
                    usuario_id=current_user.id
                )
                session.add(mov)
                
    # Auditoría
    audit = Auditoria(
        usuario_id=current_user.id,
        accion="ANULAR_FACTURA_ELECTRONICA",
        modulo="Facturación",
        detalles=f"Factura original {fe_orig.consecutivo} anulada. Nota de crédito emitida: {nc_consecutivo}",
        ip_address=request.client.host
    )
    session.add(audit)
    session.commit()
    
    return {
        "message": "Factura anulada exitosamente",
        "nota_credito": {
            "clave": nc_clave,
            "consecutivo": nc_consecutivo,
            "estado_hacienda": "Aceptado"
        }
    }

@router.get("/dashboard")
def get_billing_dashboard(
    session: Session = Depends(get_session)
):
    todas = session.exec(select(FacturaElectronica)).all()
    
    resumen = {
        "total": len(todas),
        "aceptadas": len([f for f in todas if f.estado_hacienda == "Aceptado"]),
        "rechazadas": len([f for f in todas if f.estado_hacienda == "Rechazado"]),
        "pendientes": len([f for f in todas if f.estado_hacienda == "Pendiente"]),
        "anuladas": len([f for f in todas if f.estado_hacienda == "Anulada"]),
        "recientes": []
    }
    
    stmt = select(FacturaElectronica).order_by(FacturaElectronica.fecha_envio.desc()).limit(15)
    recientes = session.exec(stmt).all()
    
    for f in recientes:
        resumen["recientes"].append({
            "id": f.id,
            "venta_id": f.venta_id,
            "venta_consecutivo": f.venta.consecutivo,
            "total": f.venta.total,
            "clave": f.clave,
            "consecutivo": f.consecutivo,
            "estado_hacienda": f.estado_hacienda,
            "fecha_envio": f.fecha_envio
        })
        
    return resumen
