import sqlite3

def rename():
    conn = sqlite3.connect('pos.db')
    cursor = conn.cursor()
    cursor.execute("UPDATE cajas SET nombre = 'Caja Principal' WHERE nombre = 'Caja Principal 01'")
    conn.commit()
    print("Filas de 'cajas' actualizadas:", cursor.rowcount)
    conn.close()

if __name__ == '__main__':
    rename()
