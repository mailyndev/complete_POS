import socket

try:
    s = socket.create_connection(('127.0.0.1', 1025), timeout=2)
    s.close()
    print("PORT-1025-ACTIVE: True")
except Exception as e:
    print(f"PORT-1025-ACTIVE: False (Error: {e})")
