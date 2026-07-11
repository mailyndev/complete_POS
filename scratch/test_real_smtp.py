import socket
import threading
import time
import sqlite3
import urllib.request
import json

BASE_URL = "http://127.0.0.1:8000/api"
received_emails = []
server_running = True

def mock_smtp_thread():
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    s.bind(('127.0.0.1', 1025))
    s.listen(5)
    s.settimeout(1.0)
    
    while server_running:
        try:
            conn, addr = s.accept()
        except socket.timeout:
            continue
            
        try:
            conn.sendall(b"220 localhost Mock SMTP Server Ready\r\n")
            while True:
                data = conn.recv(1024)
                if not data:
                    break
                msg = data.decode('utf-8', errors='ignore')
                msg_upper = msg.upper().strip()
                if msg_upper.startswith("EHLO") or msg_upper.startswith("HELO"):
                    conn.sendall(b"250-localhost\r\n250 OK\r\n")
                elif msg_upper.startswith("MAIL FROM"):
                    conn.sendall(b"250 OK\r\n")
                elif msg_upper.startswith("RCPT TO"):
                    conn.sendall(b"250 OK\r\n")
                elif msg_upper.startswith("DATA"):
                    conn.sendall(b"354 Start mail input; end with <CRLF>.<CRLF>\r\n")
                    mail_data = ""
                    while True:
                        chunk = conn.recv(4096).decode('utf-8', errors='ignore')
                        mail_data += chunk
                        if "\r\n.\r\n" in mail_data or mail_data.endswith("."):
                            break
                    received_emails.append(mail_data)
                    conn.sendall(b"250 OK Message accepted\r\n")
                elif msg_upper.startswith("QUIT"):
                    conn.sendall(b"221 Bye\r\n")
                    break
                else:
                    conn.sendall(b"250 OK\r\n")
        except Exception as e:
            pass
        finally:
            conn.close()
    s.close()

def make_request(url, method="GET", data=None, token=None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req_data = json.dumps(data).encode("utf-8") if data is not None else None
    req = urllib.request.Request(url, data=req_data, headers=headers, method=method)
    try:
        resp = urllib.request.urlopen(req)
        return resp.status, json.loads(resp.read().decode("utf-8"))
    except urllib.request.HTTPError as e:
        return e.code, e.read().decode("utf-8")
    except Exception as e:
        return 0, str(e)

def run_test():
    global server_running
    print("==================================================")
    print("      INICIANDO PRUEBA REAL DE SMTP PARA ABONOS   ")
    print("==================================================")
    
    # 1. Iniciar servidor SMTP mock en segundo plano
    t = threading.Thread(target=mock_smtp_thread, daemon=True)
    t.start()
    time.sleep(0.5)
    print("[MOCK-SMTP] Servidor SMTP iniciado en localhost:1025.")

    # 2. Respaldar configuración SMTP actual
    conn = sqlite3.connect('pos.db')
    cursor = conn.cursor()
    cursor.execute("SELECT clave, valor FROM configuracion WHERE clave LIKE 'smtp_%'")
    original_config = cursor.fetchall()
    print(f"[DB] Respaldando {len(original_config)} parámetros SMTP.")
    
    # 3. Configurar DB con localhost:1025 y credenciales vacías (prueba sin auth)
    cursor.execute("UPDATE configuracion SET valor = '127.0.0.1' WHERE clave = 'smtp_host'")
    cursor.execute("UPDATE configuracion SET valor = '1025' WHERE clave = 'smtp_port'")
    cursor.execute("UPDATE configuracion SET valor = '' WHERE clave = 'smtp_user'")
    cursor.execute("UPDATE configuracion SET valor = '' WHERE clave = 'smtp_password'")
    cursor.execute("UPDATE configuracion SET valor = 'Minisuper M Y M <notificaciones@mym.com>' WHERE clave = 'smtp_from'")
    conn.commit()
    print("[DB] Configuración SMTP temporal a localhost:1025 (sin contraseña/autenticación).")
    conn.close()

    # 4. Login
    code, res = make_request(f"{BASE_URL}/auth/login", "POST", {"username": "admin", "password": "admin123"})
    if code != 200:
        print(f"FAIL: Login fallido: {res}")
        return
    token = res["access_token"]
    print("[PASS] Login de administrador exitoso.")

    # 5. Crear cliente de prueba con correo
    import random
    rand_id = str(random.randint(100000, 999999))
    client_payload = {
        "identificacion": f"CLI-REAL-SMTP-{rand_id}",
        "nombre": "Esteban Ramirez",
        "telefono": "8888-9999",
        "correo": "esteban.ramirez@correo.com",
        "limite_credito": 80000.0,
        "direccion": "Alajuela"
    }
    code, cli_res = make_request(f"{BASE_URL}/clients", "POST", client_payload, token=token)
    if code not in [200, 201]:
        print(f"FAIL: No se pudo crear cliente de prueba: {cli_res}")
        return
    cli_id = cli_res["id"]
    print(f"[PASS] Cliente de prueba creado. ID: {cli_id}")

    # Asegurar caja abierta
    make_request(f"{BASE_URL}/cash/open", "POST", {"monto_inicial": 30000.0, "caja_id": 1}, token=token)

    # Registrar venta a crédito
    sale_payload = {
        "cliente_id": cli_id,
        "descuento": 0.0,
        "items": [
            {
                "producto_id": 1,
                "cantidad": 1.0,
                "precio_unitario": 1000.0
            }
        ],
        "pagos": [
            {
                "metodo_pago": "credito",
                "monto": 1000.0
            }
        ]
    }
    code_sale, res_sale = make_request(f"{BASE_URL}/pos/sales", "POST", sale_payload, token=token)
    if code_sale != 201:
        print(f"FAIL: Venta a crédito falló: {res_sale}")
        return
    print("[PASS] Venta a crédito registrada exitosamente.")

    # 6. Registrar Abono con enviar_correo=True
    pay_payload = {
        "monto": 600.0,
        "metodo_pago": "sinpe",
        "enviar_correo": True
    }
    print("[TEST] Registrando abono de crédito...")
    code_pay, res_pay = make_request(f"{BASE_URL}/clients/{cli_id}/pay-credit", "POST", pay_payload, token=token)
    if code_pay != 200:
        print(f"FAIL: Registro de abono falló ({code_pay}): {res_pay}")
        return
    print(f"[PASS] Abono registrado con éxito. Nuevo saldo deudor: {res_pay['saldo_actual']}")

    # 7. Verificar si el servidor SMTP mock recibió el correo electrónico
    time.sleep(1.0)
    if len(received_emails) > 0:
        print("[PASS] ¡CORREO RECIBIDO POR EL SERVIDOR SMTP LOCAL MOCK!")
        print("---------- CONTENIDO DEL EMAIL ENVIADO ----------")
        print(received_emails[0].strip().replace("₡", "CRC"))
        print("-------------------------------------------------")
    else:
        print("FAIL: El servidor SMTP mock no recibió ningún correo.")

    # 8. Verificar log de auditoría
    code_audit, audits = make_request(f"{BASE_URL}/audit/logs", "GET", token=token)
    email_audit = next((a for a in audits if a["accion"] == "ENVIO_ABONO_EMAIL_EXITOSO" and "Clientes" in a["modulo"]), None)
    if email_audit:
        details_safe = email_audit['detalles'].replace("₡", "CRC")
        print(f"[PASS] Log SMTP real de éxito encontrado en la auditoría: {details_safe}")
    else:
        print("FAIL: No se encontró la acción ENVIO_ABONO_EMAIL_EXITOSO en la auditoría.")

    # 9. Restaurar configuración original
    conn = sqlite3.connect('pos.db')
    cursor = conn.cursor()
    for key, val in original_config:
        cursor.execute("UPDATE configuracion SET valor = ? WHERE clave = ?", (val, key))
    conn.commit()
    conn.close()
    print("[DB] Configuración SMTP original restaurada con éxito.")

    # Detener servidor
    server_running = False
    print("==================================================")
    print("         PRUEBA COMPLETADA CON EXITO              ")
    print("==================================================")

if __name__ == "__main__":
    run_test()
