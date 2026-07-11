import os
import shutil
import glob
from datetime import datetime

# Directorios y parámetros
DB_FILE = "pos.db"
BACKUP_DIR = "backups"
MAX_BACKUPS = 10

def run_backup():
    print("=== Iniciador de Respaldo Automatizado ===")
    
    # 1. Validar origen
    if not os.path.exists(DB_FILE):
        print(f"Error: La base de datos origen '{DB_FILE}' no existe.")
        return False
        
    # 2. Asegurar directorio de destino
    if not os.path.exists(BACKUP_DIR):
        os.makedirs(BACKUP_DIR)
        print(f"Creado directorio de copias de seguridad: '{BACKUP_DIR}'")

    # 3. Generar nombre con marca de tiempo
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_filename = f"pos_backup_auto_{timestamp}.db.bak"
    backup_path = os.path.join(BACKUP_DIR, backup_filename)

    # 4. Copiar archivo
    try:
        shutil.copy2(DB_FILE, backup_path)
        print(f"Respaldo creado con éxito en: '{backup_path}'")
        
        # 5. Rotación de respaldos antiguos (mantener un máximo de 10)
        clean_old_backups()
        return True
    except Exception as e:
        print(f"Error al realizar copia física: {e}")
        return False

def clean_old_backups():
    # Obtener todos los respaldos automáticos
    pattern = os.path.join(BACKUP_DIR, "pos_backup_auto_*.db.bak")
    backup_files = glob.glob(pattern)
    
    # Ordenar por tiempo de modificación (el más antiguo primero)
    backup_files.sort(key=os.path.getmtime)
    
    # Si excede el máximo, eliminar los más antiguos
    if len(backup_files) > MAX_BACKUPS:
        excess = len(backup_files) - MAX_BACKUPS
        print(f"Se detectaron {len(backup_files)} copias de seguridad. Rotando las {excess} más antiguas...")
        for i in range(excess):
            try:
                os.remove(backup_files[i])
                print(f"Eliminado respaldo antiguo: '{backup_files[i]}'")
            except Exception as e:
                print(f"Error al eliminar {backup_files[i]}: {e}")
    else:
        print(f"Conteo de respaldos ({len(backup_files)}/{MAX_BACKUPS}). No se requiere rotación.")

if __name__ == "__main__":
    success = run_backup()
    if success:
        print("Operación finalizada de forma exitosa.")
    else:
        print("La operación finalizó con errores.")
