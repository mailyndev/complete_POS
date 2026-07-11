from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlmodel import Session, select
from datetime import datetime, timedelta
from typing import List, Dict, Any

from ..database.connection import get_session
from ..database.schema import Usuario, Rol, Permiso, RolePermisoLink, Auditoria
from ..utils.security import hash_password, verify_password, create_access_token, get_current_user

router = APIRouter(prefix="/auth", tags=["Autenticación"])

@router.post("/login")
def login(payload: Dict[str, str], request: Request, session: Session = Depends(get_session)):
    username = payload.get("username")
    password = payload.get("password")
    
    if not username or not password:
        raise HTTPException(status_code=400, detail="Usuario y contraseña son requeridos")
        
    db_user = session.exec(select(Usuario).where(Usuario.username == username)).first()
    if not db_user:
        # Registrar intento fallido para auditoría
        audit = Auditoria(
            usuario_id=None,
            accion="LOGIN_FALLIDO",
            modulo="Autenticación",
            detalles=f"Intento de login con usuario inexistente: {username}",
            ip_address=request.client.host
        )
        session.add(audit)
        session.commit()
        raise HTTPException(status_code=401, detail="Credenciales incorrectas")

    # Verificar si está bloqueado por intentos fallidos
    if db_user.bloqueado_hasta and db_user.bloqueado_hasta > datetime.utcnow():
        tiempo_restante = db_user.bloqueado_hasta - datetime.utcnow()
        minutos = int(tiempo_restante.total_seconds() / 60) + 1
        raise HTTPException(
            status_code=403, 
            detail=f"Usuario bloqueado temporalmente por múltiples intentos fallidos. Intente de nuevo en {minutos} minutos."
        )

    # Verificar contraseña
    if not verify_password(password, db_user.password_hash):
        db_user.intentos_fallidos += 1
        # Bloquear usuario por 15 minutos si llega a 5 intentos fallidos
        if db_user.intentos_fallidos >= 5:
            db_user.bloqueado_hasta = datetime.utcnow() + timedelta(minutes=15)
            db_user.intentos_fallidos = 0
            detalles = f"Usuario {username} bloqueado por superar intentos fallidos"
        else:
            detalles = f"Intento fallido #{db_user.intentos_fallidos} para usuario {username}"
            
        audit = Auditoria(
            usuario_id=db_user.id,
            accion="LOGIN_FALLIDO",
            modulo="Autenticación",
            detalles=detalles,
            ip_address=request.client.host
        )
        session.add(db_user)
        session.add(audit)
        session.commit()
        raise HTTPException(status_code=401, detail="Credenciales incorrectas")

    # Login Exitoso
    db_user.intentos_fallidos = 0
    db_user.bloqueado_hasta = None
    session.add(db_user)

    # Obtener permisos del Rol del usuario
    statement = select(Permiso).join(RolePermisoLink).where(RolePermisoLink.role_id == db_user.role_id)
    db_permisos = session.exec(statement).all()
    permisos_claves = [p.clave for p in db_permisos]

    # Generar Token JWT
    token_data = {
        "sub": db_user.username,
        "role": db_user.rol.nombre,
        "sucursal_id": db_user.sucursal_id
    }
    access_token = create_access_token(data=token_data)

    # Guardar en Auditoría
    audit = Auditoria(
        usuario_id=db_user.id,
        accion="LOGIN_EXITOSO",
        modulo="Autenticación",
        detalles=f"Inicio de sesión exitoso. Rol: {db_user.rol.nombre}, Sucursal ID: {db_user.sucursal_id}",
        ip_address=request.client.host
    )
    session.add(audit)
    session.commit()

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": db_user.id,
            "username": db_user.username,
            "nombre": db_user.nombre,
            "email": db_user.email,
            "rol": db_user.rol.nombre,
            "sucursal_id": db_user.sucursal_id,
            "permisos": permisos_claves
        }
    }

@router.get("/me")
def get_me(current_user: Usuario = Depends(get_current_user), session: Session = Depends(get_session)):
    # Obtener permisos del Rol
    statement = select(Permiso).join(RolePermisoLink).where(RolePermisoLink.role_id == current_user.role_id)
    db_permisos = session.exec(statement).all()
    permisos_claves = [p.clave for p in db_permisos]

    return {
        "id": current_user.id,
        "username": current_user.username,
        "nombre": current_user.nombre,
        "email": current_user.email,
        "rol": current_user.rol.nombre,
        "sucursal_id": current_user.sucursal_id,
        "permisos": permisos_claves
    }

@router.post("/logout")
def logout(request: Request, current_user: Usuario = Depends(get_current_user), session: Session = Depends(get_session)):
    # Auditoría
    audit = Auditoria(
        usuario_id=current_user.id,
        accion="LOGOUT",
        modulo="Autenticación",
        detalles="Cierre de sesión manual",
        ip_address=request.client.host
    )
    session.add(audit)
    session.commit()
    return {"message": "Sesión cerrada correctamente"}
