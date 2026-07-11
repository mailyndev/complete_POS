import sqlite3

conn = sqlite3.connect('pos.db')
cursor = conn.cursor()
cursor.execute("SELECT id, accion, modulo, detalles, fecha_registro FROM auditoria WHERE accion LIKE '%EMAIL%' OR accion LIKE '%SMTP%' ORDER BY id DESC LIMIT 20")
rows = cursor.fetchall()
for r in rows:
    safe_details = r[3].replace("₡", "CRC").replace("\u20a1", "CRC")
    print(f"ID: {r[0]} | Accion: {r[1]} | Modulo: {r[2]} | Fecha: {r[4]}")
    print(f"Detalles: {safe_details}")
    print("-" * 50)
conn.close()
