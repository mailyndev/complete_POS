import sqlite3
conn = sqlite3.connect('pos.db')
cursor = conn.cursor()
cursor.execute("SELECT * FROM configuracion")
for row in cursor.fetchall():
    print(row)
print("---")
cursor.execute("SELECT * FROM empresa")
for row in cursor.fetchall():
    print(row)
conn.close()
