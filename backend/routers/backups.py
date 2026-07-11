import os
import shutil
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlmodel import Session
from typing import List, Dict, Any

from ..database.connection import get_session
from ..database.schema import Usuario, Auditoria
from ..utils.security import get_current_user, PermissionChecker

router = APIRouter(prefix="/backups", tags=["Copias de Seguridad"])

BACKUP_DIR = "backups"

def get_backups_list() -> List[Dict[str, Any]]:
    if not os.path.exists(BACKUP_DIR):
        os.makedirs(BACKUP_DIR)
        
    files = os.listdir(BACKUP_DIR)
    backups = []
    
    for f in files:
        if f.endswith(".bak"):
            path = os.path.join(BACKUP_DIR, f)
            stat = os.stat(path)
            backups.append({
                "filename": f,
                "size": stat.st_size,
                "created_at": datetime.fromtimestamp(stat.st_mtime)
            })
            
    # Ordenar por fecha de creación desc
    backups.sort(key=lambda x: x["created_at"], reverse=True)
    return backups

@router.get("/list")
def list_backups(
    current_user: Usuario = Depends(PermissionChecker("settings:edit")),
    session: Session = Depends(get_session)
):
    return get_backups_list()

@router.post("/create")
def create_backup(
    request: Request,
    current_user: Usuario = Depends(PermissionChecker("settings:edit")),
    session: Session = Depends(get_session)
):
    if not os.path.exists(BACKUP_DIR):
        os.makedirs(BACKUP_DIR)
        
    db_file = "pos.db"
    if not os.path.exists(db_file):
        raise HTTPException(status_code=404, detail="El archivo de base de datos pos.db no existe en el origen.")
        
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_filename = f"pos_backup_{timestamp}.db.bak"
    backup_path = os.path.join(BACKUP_DIR, backup_filename)
    
    try:
        shutil.copy2(db_file, backup_path)
        
        # Registrar auditoría
        audit = Auditoria(
            usuario_id=current_user.id,
            accion="CREAR_RESPALDO",
            modulo="Configuración",
            detalles=f"Copia de seguridad creada manualmente: {backup_filename}",
            ip_address=request.client.host
        )
        session.add(audit)
        session.commit()
        
        return {"message": "Copia de seguridad creada con éxito", "filename": backup_filename}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al crear respaldo: {str(e)}")

@router.post("/restore")
def restore_backup(
    payload: Dict[str, str],
    request: Request,
    current_user: Usuario = Depends(PermissionChecker("settings:edit")),
    session: Session = Depends(get_session)
):
    filename = payload.get("filename")
    if not filename:
        raise HTTPException(status_code=400, detail="Nombre del archivo de respaldo es requerido.")
        
    backup_path = os.path.join(BACKUP_DIR, filename)
    if not os.path.exists(backup_path):
        raise HTTPException(status_code=404, detail="El archivo de respaldo especificado no existe.")
        
    db_file = "pos.db"
    
    try:
        # Cerrar todas las conexiones antes de restaurar (SQLite lo agradecerá)
        # Nota: FastAPI mantendrá sesiones activas, pero al sobreescribir el archivo en caliente,
        # SQLite reconectará. Para mayor seguridad, hacemos copy directa.
        shutil.copy2(backup_path, db_file)
        
        # Registrar auditoría
        audit = Auditoria(
            usuario_id=current_user.id,
            accion="RESTAURAR_RESPALDO",
            modulo="Configuración",
            detalles=f"Base de datos restaurada al respaldo: {filename}",
            ip_address=request.client.host
        )
        session.add(audit)
        session.commit()
        
        return {"message": "Base de datos restaurada con éxito. Por favor reinicie su sesión."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al restaurar base de datos: {str(e)}")

async def schedule_auto_backups():
    import asyncio
    # Esperar 10 segundos después del inicio
    await asyncio.sleep(10)
    while True:
        try:
            db_file = "pos.db"
            if os.path.exists(db_file):
                if not os.path.exists(BACKUP_DIR):
                    os.makedirs(BACKUP_DIR)
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                backup_filename = f"pos_backup_auto_{timestamp}.db.bak"
                backup_path = os.path.join(BACKUP_DIR, backup_filename)
                
                shutil.copy2(db_file, backup_path)
                print(f"[AUTO-BACKUP] Copia de seguridad automatizada creada: {backup_filename}")
                
                # Mantener solo los últimos 10 respaldos
                files = [os.path.join(BACKUP_DIR, f) for f in os.listdir(BACKUP_DIR) if f.endswith(".bak")]
                if len(files) > 10:
                    files.sort(key=os.path.getmtime)
                    for old_file in files[:-10]:
                        try:
                            os.remove(old_file)
                            print(f"[AUTO-BACKUP] Respaldo antiguo eliminado por rotación: {old_file}")
                        except Exception as delete_err:
                            print(f"[AUTO-BACKUP] Error al eliminar respaldo antiguo {old_file}: {delete_err}")
        except Exception as e:
            print(f"[AUTO-BACKUP] Error en tarea de respaldo automático: {e}")
            
        # Ejecutar cada 6 horas (21600 segundos)
        await asyncio.sleep(6 * 3600)
