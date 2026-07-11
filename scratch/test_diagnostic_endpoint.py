import socket
import threading
import time
import sqlite3
import urllib.request
import json

BASE_URL = "http://127.0.0.1:8000/api"
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
                    conn.sendall(b"354 Start mail input\r\n")
                    mail_data = ""
                    while True:
                        chunk = conn.recv(4096).decode('utf-8', errors='ignore')
                        mail_data += chunk
                        if "\r\n.\r\n" in mail_data or mail_data.endswith("."):
                            break
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

def run_diagnostics():
    global server_running
    print("==================================================")
    print("    INICIANDO DIAGNÓSTICO DE ENDPOINT SMTP        ")
    print("==================================================")
    
    # Login para obtener token
    code, res = make_request(f"{BASE_URL}/auth/login", "POST", {"username": "admin", "password": "admin123"})
    if code != 200:
        print(f"FAIL: Login fallido: {res}")
        return
    token = res["access_token"]
    print("[PASS] Login de administrador exitoso.")

    # 1. PRUEBA CON SERVIDOR SMTP APAGADO (offline)
    # Temporalmente configuramos SMTP en la base de datos a localhost:1025
    conn = sqlite3.connect('pos.db')
    cursor = conn.cursor()
    cursor.execute("UPDATE configuracion SET valor = '127.0.0.1' WHERE clave = 'smtp_host'")
    cursor.execute("UPDATE configuracion SET valor = '1025' WHERE clave = 'smtp_port'")
    conn.commit()
    conn.close()

    print("\n--- PRUEBA 1: SERVIDOR SMTP LOCAL APAGADO ---")
    payload = {"email": "test-diagnostic@correo.com"}
    code_test1, res_test1 = make_request(f"{BASE_URL}/settings/test-email", "POST", payload, token=token)
    print(f"Response Code: {code_test1}")
    print(f"Response Payload: {json.dumps(res_test1, indent=2)}")
    
    if not res_test1.get("conexion") and res_test1.get("error_conexion") is not None:
        print("[PASS] Detectado correctamente el error de conexión offline.")
    else:
        print("FAIL: No reportó error de conexión.")

    # 2. PRUEBA CON SERVIDOR SMTP ENCENDIDO (online)
    t = threading.Thread(target=mock_smtp_thread, daemon=True)
    t.start()
    time.sleep(0.5)
    print("\n[MOCK-SMTP] Servidor SMTP iniciado en localhost:1025.")

    print("\n--- PRUEBA 2: SERVIDOR SMTP LOCAL ENCENDIDO ---")
    code_test2, res_test2 = make_request(f"{BASE_URL}/settings/test-email", "POST", payload, token=token)
    print(f"Response Code: {code_test2}")
    print(f"Response Payload: {json.dumps(res_test2, indent=2)}")
    
    if res_test2.get("conexion") and res_test2.get("autenticacion") and res_test2.get("envio"):
        print("[PASS] Conexión, autenticación y envío correctos.")
    else:
        print("FAIL: Falló alguna etapa del envío en el servidor encendido.")

    # Restaurar servidor mock y apagarlo
    server_running = False
    time.sleep(0.5)
    print("\n==================================================")
    print("         PRUEBA DE DIAGNÓSTICO FINALIZADA         ")
    print("==================================================")

if __name__ == "__main__":
    run_diagnostics()
