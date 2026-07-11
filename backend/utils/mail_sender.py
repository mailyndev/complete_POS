import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders
import os
from sqlmodel import Session, select
from ..database.schema import Configuracion

def send_email_with_pdf(
    to_email: str,
    subject: str,
    body_text: str,
    pdf_path: str = None,
    session: Session = None
) -> bool:
    """
    Envia un correo electrónico real usando la configuración SMTP de la base de datos.
    Si no está configurada, o falla, retorna False permitiendo auditoría o simulación.
    """
    if not session:
        return False
        
    try:
        # Recuperar parámetros SMTP
        configs = session.exec(select(Configuracion).where(Configuracion.clave.like("smtp_%"))).all()
        cfg_dict = {c.clave: c.valor for c in configs}
        
        smtp_host = cfg_dict.get("smtp_host")
        if smtp_host:
            smtp_host = smtp_host.strip()
            for prefix in ["smtp://", "smtps://", "http://", "https://"]:
                if smtp_host.lower().startswith(prefix):
                    smtp_host = smtp_host[len(prefix):]
            smtp_host = smtp_host.strip("/")
            
        smtp_port = cfg_dict.get("smtp_port", "587")
        smtp_user = cfg_dict.get("smtp_user")
        smtp_password = cfg_dict.get("smtp_password")
        smtp_from_name = cfg_dict.get("smtp_from_name")
        smtp_from_email = cfg_dict.get("smtp_from_email")
        
        if smtp_from_name and smtp_from_email:
            smtp_from = f"{smtp_from_name} <{smtp_from_email}>"
        else:
            smtp_from = smtp_from_email or cfg_dict.get("smtp_from") or smtp_user
            
        if not smtp_host:
            print("[EMAIL-SENDER] SMTP no configurado en ajustes (falta smtp_host). Modo simulado activo.")
            return False
            
        # Construir el mensaje
        msg = MIMEMultipart()
        msg["From"] = smtp_from or "Minisúper M Y M <notificaciones@minisupermym.com>"
        msg["To"] = to_email
        msg["Subject"] = subject
        
        msg.attach(MIMEText(body_text, "plain"))
        
        if pdf_path and os.path.exists(pdf_path):
            filename = os.path.basename(pdf_path)
            with open(pdf_path, "rb") as attachment:
                part = MIMEBase("application", "octet-stream")
                part.set_payload(attachment.read())
                encoders.encode_base64(part)
                part.add_header(
                    "Content-Disposition",
                    f"attachment; filename= {filename}",
                )
                msg.attach(part)
                
        # Conectar al servidor SMTP
        port = int(str(smtp_port).strip())
        smtp_use_ssl = cfg_dict.get("smtp_use_ssl", "false").lower() == "true"
        
        if port == 465:
            server = smtplib.SMTP_SSL(smtp_host, port, timeout=15)
        else:
            server = smtplib.SMTP(smtp_host, port, timeout=15)
            server.ehlo_or_helo_if_needed()
            if smtp_use_ssl:
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
        print(f"[EMAIL-SENDER] Correo enviado exitosamente a {to_email}")
        return True
        
    except Exception as e:
        import traceback
        print(f"[EMAIL-SENDER] Fallo al enviar correo SMTP ({type(e).__name__}): {str(e)}")
        traceback.print_exc()
        return False
