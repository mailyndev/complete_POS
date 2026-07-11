from fastapi import APIRouter, Depends, Query
from sqlmodel import Session, select
from typing import List, Dict, Any

from ..database.connection import get_session
from ..database.schema import Auditoria, Usuario
from ..utils.security import get_current_user, PermissionChecker

router = APIRouter(prefix="/audit", tags=["Auditoría"])

@router.get("/logs")
def get_audit_logs(
    limit: int = Query(50, ge=1, le=200),
    current_user: Usuario = Depends(PermissionChecker("audit:view")),
    session: Session = Depends(get_session)
):
    stmt = select(Auditoria).order_by(Auditoria.fecha_registro.desc()).limit(limit)
    logs = session.exec(stmt).all()
    
    results = []
    for l in logs:
        results.append({
            "id": l.id,
            "usuario": l.usuario.nombre if l.usuario else "Sistema / Anónimo",
            "username": l.usuario.username if l.usuario else "N/A",
            "accion": l.accion,
            "modulo": l.modulo,
            "detalles": l.detalles,
            "ip_address": l.ip_address,
            "fecha": l.fecha_registro
        })
    return results
