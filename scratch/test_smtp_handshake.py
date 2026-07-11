import smtplib
import socket
import threading
import time

def mock_smtp_thread():
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    s.bind(('127.0.0.1', 1026))
    s.listen(5)
    s.settimeout(1.0)
    
    try:
        conn, addr = s.accept()
        conn.sendall(b"220 localhost Mock SMTP Server Ready\r\n")
        while True:
            data = conn.recv(1024)
            if not data:
                break
            msg = data.decode('utf-8', errors='ignore')
            print(f"[MOCK] Client sent: {repr(msg)}")
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
                print(f"[MOCK] Mail data received: {repr(mail_data)}")
                conn.sendall(b"250 OK Message accepted\r\n")
            elif msg.startswith("QUIT"):
                conn.sendall(b"221 Bye\r\n")
                break
            else:
                conn.sendall(b"250 OK\r\n")
        conn.close()
    except Exception as e:
        print(f"[MOCK] Exception: {e}")
    finally:
        s.close()

# Start mock server
t = threading.Thread(target=mock_smtp_thread, daemon=True)
t.start()
time.sleep(0.5)

try:
    print("[CLIENT] Connecting...")
    server = smtplib.SMTP('127.0.0.1', 1026, timeout=5)
    server.set_debuglevel(1)
    print("[CLIENT] ehlo_or_helo...")
    server.ehlo_or_helo_if_needed()
    
    print("[CLIENT] has_extn...")
    if server.has_extn("starttls"):
        print("[CLIENT] starting tls...")
        server.starttls()
        
    print("[CLIENT] sendmail...")
    server.sendmail("test@mym.com", "dest@mym.com", "Subject: Test\n\nBody")
    print("[CLIENT] quit...")
    server.quit()
    print("[CLIENT] SUCCESS")
except Exception as e:
    print(f"[CLIENT] ERROR: {type(e).__name__}: {e}")
