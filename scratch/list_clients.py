import sqlite3

conn = sqlite3.connect('pos.db')
cursor = conn.cursor()
cursor.execute("SELECT id, nombre, identificacion, correo, saldo_actual FROM clientes")
for r in cursor.fetchall():
    print(f"ID: {r[0]} | Nombre: {r[1]} | Ident: {r[2]} | Correo: {r[3]} | Saldo: {r[4]}")
conn.close()
