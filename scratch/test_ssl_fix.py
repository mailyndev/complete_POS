import socket
import threading
import time
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

def run_tests():
    global server_running
    print("==================================================")
    print("      INICIANDO PRUEBA DE CORRECCIÓN SSL/TLS       ")
    print("==================================================")
    
    # Login para obtener token
    code, res = make_request(f"{BASE_URL}/auth/login", "POST", {"username": "admin", "password": "admin123"})
    if code != 200:
        print(f"FAIL: Login fallido: {res}")
        return
    token = res["access_token"]
    print("[PASS] Login de administrador exitoso.")

    # Iniciar servidor SMTP mock en puerto 1025 (sin soporte SSL en la primera capa)
    t = threading.Thread(target=mock_smtp_thread, daemon=True)
    t.start()
    time.sleep(0.5)
    print("[MOCK-SMTP] Servidor SMTP iniciado en localhost:1025.")

    # Hacemos la prueba con smtp_use_ssl="true" en un puerto que NO es 465 (1025)
    payload = {
        "email": "test-ssl@correo.com",
        "smtp_host": "127.0.0.1",
        "smtp_port": "1025",
        "smtp_use_ssl": "true" # Forzamos uso de seguridad
    }
    
    code_test, res_test = make_request(f"{BASE_URL}/settings/test-email", "POST", payload, token=token)
    print(f"Response Code: {code_test}")
    print(f"Response Payload: {json.dumps(res_test)}")
    
    # Ya no debe dar SSLError: WRONG_VERSION_NUMBER. Debe dar error de STARTTLS o conectar
    # en texto plano si no se soporta o fallar de forma controlada sin error de Handshake SSL SSLv3
    err_conn = res_test.get("error_conexion")
    if err_conn is None and res_test.get("conexion") == True:
        print("[PASS] ¡Conexión SMTP lograda correctamente! El error WRONG_VERSION_NUMBER fue solucionado.")
    elif err_conn and "WRONG_VERSION_NUMBER" not in err_conn:
        print(f"[PASS] Conexión controlada. Se intentó conectar sin error de versión SSL. Error obtenido: {err_conn}")
    else:
        print(f"FAIL: Aún se produce el error de versión de SSL o error inesperado: {err_conn}")

    # Apagar servidor mock
    server_running = False
    time.sleep(0.5)
    print("\n==================================================")
    print("         PRUEBA DE CORRECCIÓN FINALIZADA          ")
    print("==================================================")

if __name__ == "__main__":
    run_tests()
