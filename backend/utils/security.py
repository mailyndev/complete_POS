import jwt
import hashlib
from datetime import datetime, timedelta
from typing import Optional, Dict
from fastapi import HTTPException, Security, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlmodel import Session, select
from ..database.connection import get_session
from ..database.schema import Usuario, Rol, Permiso, RolePermisoLink

import os

SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "abastecedor_maestro_super_secure_secret_key_2026")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 8 # 8 Horas (jornada de trabajo)

security_scheme = HTTPBearer()

def hash_password(password: str) -> str:
    salt = os.environ.get("PASSWORD_SALT", "abastecedor_salt_seguro_2026")
    return hashlib.sha256((password + salt).encode('utf-8')).hexdigest()

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return hash_password(plain_password) == hashed_password

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def decode_access_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except (jwt.PyJWTError, Exception):
        return None

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security_scheme),
    session: Session = Depends(get_session)
) -> Usuario:
    token = credentials.credentials
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Token de sesión inválido o expirado")
    
    username: str = payload.get("sub")
    if not username:
        raise HTTPException(status_code=401, detail="Token no contiene sujeto válido")
    
    db_user = session.exec(select(Usuario).where(Usuario.username == username)).first()
    if not db_user:
        raise HTTPException(status_code=401, detail="El usuario de la sesión no existe")
    
    if not db_user.activo:
        raise HTTPException(status_code=403, detail="El usuario se encuentra inactivo")
        
    return db_user

class PermissionChecker:
    def __init__(self, required_permission: str):
        self.required_permission = required_permission

    def __call__(self, current_user: Usuario = Depends(get_current_user), session: Session = Depends(get_session)) -> Usuario:
        # Verificar permisos del rol del usuario
        statement = select(Permiso).join(RolePermisoLink).where(
            RolePermisoLink.role_id == current_user.role_id,
            Permiso.clave == self.required_permission
        )
        perm = session.exec(statement).first()
        if not perm:
            raise HTTPException(
                status_code=403,
                detail=f"Acceso denegado: Se requiere el permiso '{self.required_permission}'"
            )
        return current_user
