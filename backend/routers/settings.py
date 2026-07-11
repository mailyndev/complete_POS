from fastapi import APIRouter, Depends, HTTPException, Request
from sqlmodel import Session, select
import base64
import os
from typing import Dict, Any, List

from ..database.connection import get_session
from ..database.schema import Empresa, Usuario, Auditoria, WhatsAppLog, Configuracion
from ..utils.security import get_current_user, PermissionChecker

router = APIRouter(prefix="/settings", tags=["Configuración"])

@router.get("/company")
def get_company_settings(
    session: Session = Depends(get_session)
):
    empresa = session.exec(select(Empresa)).first()
    if not empresa:
        # Retornar una plantilla por defecto si por alguna razón no está sembrada
        empresa = Empresa(
            nombre_comercial="Minisúper M Y M",
            razon_social="Minisúper M Y M S.A.",
            cedula_juridica="3-101-000000",
            direccion="Costa Rica",
            telefonos="0000-0000",
            correo="contacto@minisupermym.com",
            logo_path="/static/uploads/empresa/logo.jpg",
            moneda="CRC",
            zona_horaria="America/Costa_Rica"
        )
        session.add(empresa)
        session.commit()
        session.refresh(empresa)
    return empresa

@router.put("/company")
def update_company_settings(
    payload: Dict[str, Any],
    request: Request,
    current_user: Usuario = Depends(PermissionChecker("settings:edit")),
    session: Session = Depends(get_session)
):
    empresa = session.exec(select(Empresa)).first()
    if not empresa:
        empresa = Empresa(
            nombre_comercial="",
            razon_social="",
            cedula_juridica="",
            direccion="",
            telefonos="",
            correo="",
            logo_path=""
        )
        session.add(empresa)
        session.commit()
        session.refresh(empresa)
        
    empresa.nombre_comercial = payload.get("nombre_comercial", empresa.nombre_comercial)
    empresa.razon_social = payload.get("razon_social", empresa.razon_social)
    empresa.cedula_juridica = payload.get("cedula_juridica", empresa.cedula_juridica)
    empresa.direccion = payload.get("direccion", empresa.direccion)
    empresa.telefonos = payload.get("telefonos", empresa.telefonos)
    empresa.correo = payload.get("correo", empresa.correo)
    empresa.sitio_web = payload.get("sitio_web", empresa.sitio_web)
    
    session.add(empresa)
    
    # Registrar auditoría
    audit = Auditoria(
        usuario_id=current_user.id,
        accion="ACTUALIZAR_CONFIGURACION_EMPRESA",
        modulo="Configuración",
        detalles=f"Información comercial actualizada. Nombre: {empresa.nombre_comercial}",
        ip_address=request.client.host
    )
    session.add(audit)
    session.commit()
    session.refresh(empresa)
    
    return empresa

@router.post("/logo")
def upload_company_logo(
    payload: Dict[str, Any],
    request: Request,
    current_user: Usuario = Depends(PermissionChecker("settings:edit")),
    session: Session = Depends(get_session)
):
    logo_base64 = payload.get("logo_base64")
    if not logo_base64:
        raise HTTPException(status_code=400, detail="No base64 image data provided")
        
    # Dividir url de datos si está presente (ej. data:image/jpeg;base64,...)
    if "," in logo_base64:
        logo_base64 = logo_base64.split(",")[1]
        
    try:
        image_data = base64.b64decode(logo_base64)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid base64 data: {str(e)}")

    # Asegurar directorio de destino
    os.makedirs("uploads/empresa", exist_ok=True)
    
    # Guardar archivo con nombre fijo para sobrescribir y mantener ruta limpia
    file_location = "uploads/empresa/logo.jpg"
    with open(file_location, "wb") as file_object:
        file_object.write(image_data)
        
    # Actualizar ruta en la base de datos
    empresa = session.exec(select(Empresa)).first()
    if not empresa:
        empresa = Empresa(
            nombre_comercial="Minisúper M Y M",
            razon_social="Minisúper M Y M S.A.",
            cedula_juridica="3-101-000000",
            direccion="Costa Rica",
            telefonos="0000-0000",
            correo="contacto@minisupermym.com",
            logo_path="/static/uploads/empresa/logo.jpg"
        )
        session.add(empresa)
    else:
        empresa.logo_path = "/static/uploads/empresa/logo.jpg"
        session.add(empresa)
        
    # Registrar auditoría
    audit = Auditoria(
        usuario_id=current_user.id,
        accion="SUBIR_LOGO_EMPRESA",
        modulo="Configuración",
        detalles="Logo de la empresa actualizado vía Base64.",
        ip_address=request.client.host
    )
    session.add(audit)
    session.commit()
    session.refresh(empresa)
    
    return {"logo_path": empresa.logo_path}

@router.get("/smtp")
def get_smtp_settings(
    current_user: Usuario = Depends(PermissionChecker("settings:edit")),
    session: Session = Depends(get_session)
):
    configs = session.exec(select(Configuracion).where(Configuracion.clave.like("smtp_%"))).all()
    result = {}
    for c in configs:
        result[c.clave] = c.valor
        
    smtp_from = result.get("smtp_from", "")
    smtp_from_name = result.get("smtp_from_name", "")
    smtp_from_email = result.get("smtp_from_email", "")
    
    if smtp_from and not smtp_from_email:
        import email.utils
        name, email_addr = email.utils.parseaddr(smtp_from)
        smtp_from_name = name or smtp_from_name
        smtp_from_email = email_addr or smtp_from_email
        
    return {
        "smtp_host": result.get("smtp_host", ""),
        "smtp_port": result.get("smtp_port", "587"),
        "smtp_user": result.get("smtp_user", ""),
        "smtp_from_name": smtp_from_name,
        "smtp_from_email": smtp_from_email,
        "smtp_use_ssl": result.get("smtp_use_ssl", "false")
    }

@router.put("/smtp")
def update_smtp_settings(
    payload: Dict[str, Any],
    request: Request,
    current_user: Usuario = Depends(PermissionChecker("settings:edit")),
    session: Session = Depends(get_session)
):
    keys = ["smtp_host", "smtp_port", "smtp_user", "smtp_password", "smtp_from_name", "smtp_from_email", "smtp_use_ssl"]
    for k in keys:
        if k in payload:
            val = str(payload[k]).strip()
            if k == "smtp_host" and val:
                for prefix in ["smtp://", "smtps://", "http://", "https://"]:
                    if val.lower().startswith(prefix):
                        val = val[len(prefix):]
                val = val.strip("/")
            cfg = session.exec(select(Configuracion).where(Configuracion.clave == k)).first()
            if not cfg:
                cfg = Configuracion(clave=k, valor=val, descripcion=f"Parámetro SMTP: {k}")
            else:
                cfg.valor = val
            session.add(cfg)
            
    # Además actualizar el campo smtp_from compuesto para mantener compatibilidad hacia atrás
    smtp_from_name = payload.get("smtp_from_name")
    smtp_from_email = payload.get("smtp_from_email")
    if smtp_from_name is not None or smtp_from_email is not None:
        # Obtener valores actuales o los del payload
        configs = session.exec(select(Configuracion).where(Configuracion.clave.like("smtp_%"))).all()
        cfg_dict = {c.clave: c.valor for c in configs}
        
        name = smtp_from_name if smtp_from_name is not None else cfg_dict.get("smtp_from_name", "")
        email_addr = smtp_from_email if smtp_from_email is not None else cfg_dict.get("smtp_from_email", "")
        
        if name:
            smtp_from_val = f"{name} <{email_addr}>"
        else:
            smtp_from_val = email_addr
            
        cfg_from = session.exec(select(Configuracion).where(Configuracion.clave == "smtp_from")).first()
        if not cfg_from:
            cfg_from = Configuracion(clave="smtp_from", valor=smtp_from_val, descripcion="Parámetro SMTP: smtp_from")
        else:
            cfg_from.valor = smtp_from_val
        session.add(cfg_from)
            
    # Registrar auditoría
    audit = Auditoria(
        usuario_id=current_user.id,
        accion="ACTUALIZAR_SMTP",
        modulo="Configuración",
        detalles="Configuración del servidor SMTP actualizada.",
        ip_address=request.client.host
    )
    session.add(audit)
    session.commit()
    
    return {"message": "Configuración SMTP actualizada con éxito"}

@router.get("/whatsapp/logs")
def get_whatsapp_logs(
    current_user: Usuario = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    logs = session.exec(select(WhatsAppLog).order_by(WhatsAppLog.fecha_envio.desc()).limit(100)).all()
    return logs

@router.post("/smtp/test")
def test_smtp_settings(
    payload: Dict[str, Any],
    request: Request,
    current_user: Usuario = Depends(PermissionChecker("settings:edit")),
    session: Session = Depends(get_session)
):
    to_email = payload.get("email")
    if not to_email:
        raise HTTPException(status_code=400, detail="El correo electrónico de destino es requerido.")
        
    import smtplib
    from email.mime.text import MIMEText
    
    # Obtener configuración actual de la DB
    configs = session.exec(select(Configuracion).where(Configuracion.clave.like("smtp_%"))).all()
    cfg_dict = {c.clave: c.valor for c in configs}
    
    smtp_host = payload.get("smtp_host") or cfg_dict.get("smtp_host")
    if smtp_host:
        smtp_host = smtp_host.strip()
        for prefix in ["smtp://", "smtps://", "http://", "https://"]:
            if smtp_host.lower().startswith(prefix):
                smtp_host = smtp_host[len(prefix):]
        smtp_host = smtp_host.strip("/")
        
    smtp_port = payload.get("smtp_port") or cfg_dict.get("smtp_port", "587")
    smtp_user = payload.get("smtp_user") or cfg_dict.get("smtp_user")
    smtp_password = payload.get("smtp_password") or cfg_dict.get("smtp_password")
    
    smtp_from_name = payload.get("smtp_from_name") or cfg_dict.get("smtp_from_name")
    smtp_from_email = payload.get("smtp_from_email") or cfg_dict.get("smtp_from_email")
    smtp_use_ssl = payload.get("smtp_use_ssl") or cfg_dict.get("smtp_use_ssl", "false")
    
    if smtp_from_name and smtp_from_email:
        smtp_from = f"{smtp_from_name} <{smtp_from_email}>"
    else:
        smtp_from = smtp_from_email or payload.get("smtp_from") or cfg_dict.get("smtp_from") or smtp_user

    if not smtp_host:
        raise HTTPException(status_code=400, detail="El Host de configuración SMTP es requerido.")

    try:
        msg = MIMEText("Esta es una prueba exitosa del servidor SMTP configurado en Minisúper M Y M.")
        msg["Subject"] = "Prueba de Configuración SMTP - Minisúper M Y M"
        msg["From"] = smtp_from or "Minisúper M Y M <notificaciones@minisupermym.com>"
        msg["To"] = to_email

        port = int(str(smtp_port).strip())
        is_ssl = str(smtp_use_ssl).lower() == "true"
        
        if port == 465:
            server = smtplib.SMTP_SSL(smtp_host, port, timeout=15)
        else:
            server = smtplib.SMTP(smtp_host, port, timeout=15)
            server.ehlo_or_helo_if_needed()
            if is_ssl:
                server.starttls()
                server.ehlo()
            elif server.has_extn("starttls"):
                try:
                    server.starttls()
                    server.ehlo()
                except:
                    pass
            
        import email.utils
        _, clean_from_email = email.utils.parseaddr(smtp_from or smtp_user or "notificaciones@minisupermym.com")
        if not clean_from_email:
            clean_from_email = smtp_user or smtp_from or "notificaciones@minisupermym.com"

        if smtp_user and smtp_password:
            server.login(smtp_user, smtp_password)
            
        server.sendmail(clean_from_email, to_email, msg.as_string())
        server.quit()
        
        # Guardar en auditoría
        audit = Auditoria(
            usuario_id=current_user.id,
            accion="TEST_SMTP_EXITOSO",
            modulo="Configuración",
            detalles=f"Prueba de SMTP exitosa enviada a {to_email}",
            ip_address=request.client.host
        )
        session.add(audit)
        session.commit()
        
        return {"success": True, "message": f"Correo de prueba enviado correctamente a {to_email}"}
    except Exception as e:
        # Guardar en auditoría
        audit = Auditoria(
            usuario_id=current_user.id,
            accion="TEST_SMTP_FALLIDO",
            modulo="Configuración",
            detalles=f"Prueba de SMTP fallida a {to_email}. Error: {str(e)}",
            ip_address=request.client.host
        )
        session.add(audit)
        session.commit()
        raise HTTPException(status_code=500, detail=f"Fallo al conectar/enviar: {str(e)}")

@router.post("/test-email")
def test_email_detailed(
    payload: Dict[str, Any],
    current_user: Usuario = Depends(PermissionChecker("settings:edit")),
    session: Session = Depends(get_session)
):
    to_email = payload.get("email")
    if not to_email:
        raise HTTPException(status_code=400, detail="El correo de destino es requerido.")
        
    configs = session.exec(select(Configuracion).where(Configuracion.clave.like("smtp_%"))).all()
    cfg_dict = {c.clave: c.valor for c in configs}
    
    smtp_host = payload.get("smtp_host") or cfg_dict.get("smtp_host")
    if smtp_host:
        smtp_host = smtp_host.strip()
        for prefix in ["smtp://", "smtps://", "http://", "https://"]:
            if smtp_host.lower().startswith(prefix):
                smtp_host = smtp_host[len(prefix):]
        smtp_host = smtp_host.strip("/")
        
    smtp_port = payload.get("smtp_port") or cfg_dict.get("smtp_port", "587")
    smtp_user = payload.get("smtp_user") or cfg_dict.get("smtp_user")
    smtp_password = payload.get("smtp_password") or cfg_dict.get("smtp_password")
    
    smtp_from_name = payload.get("smtp_from_name") or cfg_dict.get("smtp_from_name")
    smtp_from_email = payload.get("smtp_from_email") or cfg_dict.get("smtp_from_email")
    smtp_use_ssl = payload.get("smtp_use_ssl") or cfg_dict.get("smtp_use_ssl", "false")
    
    if smtp_from_name and smtp_from_email:
        smtp_from = f"{smtp_from_name} <{smtp_from_email}>"
    else:
        smtp_from = smtp_from_email or payload.get("smtp_from") or cfg_dict.get("smtp_from") or smtp_user
        
    if not smtp_host:
        raise HTTPException(status_code=400, detail="No se ha configurado el Host SMTP.")
        
    status = {
        "conexion": False,
        "autenticacion": False,
        "envio": False,
        "error_conexion": None,
        "error_autenticacion": None,
        "error_envio": None
    }
    
    import smtplib
    from email.mime.text import MIMEText
    
    port = int(str(smtp_port).strip())
    is_ssl = str(smtp_use_ssl).lower() == "true"
    server = None
    
    # 1. Probar Conexión
    try:
        if port == 465:
            server = smtplib.SMTP_SSL(smtp_host, port, timeout=10)
        else:
            server = smtplib.SMTP(smtp_host, port, timeout=10)
            server.ehlo_or_helo_if_needed()
            if is_ssl:
                server.starttls()
                server.ehlo()
            elif server.has_extn("starttls"):
                try:
                    server.starttls()
                    server.ehlo()
                except:
                    pass
        status["conexion"] = True
    except Exception as e:
        status["error_conexion"] = f"{type(e).__name__}: {str(e)}"
        print(f"[SMTP-TEST-DIAGNOSTIC] Error de conexion: {status['error_conexion']}")
        return status
        
    # 2. Probar Autenticación
    try:
        if smtp_user and smtp_password:
            server.login(smtp_user, smtp_password)
        status["autenticacion"] = True
    except Exception as e:
        status["error_autenticacion"] = f"{type(e).__name__}: {str(e)}"
        print(f"[SMTP-TEST-DIAGNOSTIC] Error de autenticacion: {status['error_autenticacion']}")
        try:
            server.quit()
        except:
            pass
        return status
        
    # 3. Probar Envío
    try:
        msg = MIMEText("Esta es una prueba de diagnostico detallado del servidor SMTP configurado en Minisúper M Y M.")
        msg["Subject"] = "Prueba de Diagnóstico SMTP - Minisúper M Y M"
        msg["From"] = smtp_from or "Minisúper M Y M <notificaciones@minisupermym.com>"
        msg["To"] = to_email
        
        import email.utils
        _, clean_from_email = email.utils.parseaddr(smtp_from or smtp_user or "notificaciones@minisupermym.com")
        if not clean_from_email:
            clean_from_email = smtp_user or smtp_from or "notificaciones@minisupermym.com"
            
        server.sendmail(clean_from_email, to_email, msg.as_string())
        server.quit()
        status["envio"] = True
        print(f"[SMTP-TEST-DIAGNOSTIC] Correo de prueba enviado exitosamente a {to_email}")
    except Exception as e:
        status["error_envio"] = f"{type(e).__name__}: {str(e)}"
        print(f"[SMTP-TEST-DIAGNOSTIC] Error de envio: {status['error_envio']}")
        try:
            server.close()
        except:
            pass
            
    return status

# --- ADMINISTRACIÓN DE USUARIOS (ACCESO SÓLO ADMINISTRADOR GENERAL) ---

@router.get("/users", response_model=List[Dict[str, Any]])
def get_users(
    current_user: Usuario = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    if current_user.rol.nombre != "Administrador General":
        raise HTTPException(status_code=403, detail="No autorizado. Se requieren privilegios de Administrador General.")
    
    users = session.exec(select(Usuario)).all()
    return [
        {
            "id": u.id,
            "username": u.username,
            "nombre": u.nombre,
            "email": u.email,
            "rol": u.rol.nombre,
            "role_id": u.role_id,
            "activo": u.activo
        }
        for u in users
    ]

@router.put("/users/{user_id}")
def update_user_credentials(
    user_id: int,
    payload: Dict[str, Any],
    request: Request,
    current_user: Usuario = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    if current_user.rol.nombre != "Administrador General":
        raise HTTPException(status_code=403, detail="No autorizado. Se requieren privilegios de Administrador General.")
    
    db_user = session.exec(select(Usuario).where(Usuario.id == user_id)).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
        
    username_val = payload.get("username", "").strip()
    password_val = payload.get("password", "").strip()
    nombre_val = payload.get("nombre", "").strip()
    email_val = payload.get("email", "").strip()
    
    if username_val:
        # Validar duplicados
        dup = session.exec(select(Usuario).where(Usuario.username == username_val, Usuario.id != user_id)).first()
        if dup:
            raise HTTPException(status_code=400, detail="El nombre de usuario ya está en uso por otra cuenta.")
        db_user.username = username_val
        
    if password_val:
        from ..utils.security import hash_password
        db_user.password_hash = hash_password(password_val)
        
    if nombre_val:
        db_user.nombre = nombre_val
        
    if email_val:
        db_user.email = email_val
        
    session.add(db_user)
    
    # Auditoría
    audit = Auditoria(
        usuario_id=current_user.id,
        accion="EDITAR_USUARIO",
        modulo="Configuración",
        detalles=f"Modificó credenciales/detalles del usuario ID {user_id} ({db_user.username}).",
        ip_address=request.client.host
    )
    session.add(audit)
    session.commit()
    
    return {"message": "Usuario actualizado con éxito."}


