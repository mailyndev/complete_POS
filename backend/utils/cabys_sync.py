import os
import csv
import io
import threading
import requests
import sqlite3
from datetime import datetime
from sqlmodel import Session, select
from ..database.schema import Cabys, Configuracion
from ..database.connection import engine

# Configuración de URLs y rutas
CABYS_CSV_URL = "https://raw.githubusercontent.com/CRLibre/CABYS_changelog/master/cabys.csv"
LOCAL_CSV_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "database", "cabys.csv")

def get_config_val(session: Session, key: str, default: str = "") -> str:
    cfg = session.exec(select(Configuracion).where(Configuracion.clave == key)).first()
    return cfg.valor if cfg else default

def set_config_val(session: Session, key: str, value: str, desc: str = None):
    cfg = session.exec(select(Configuracion).where(Configuracion.clave == key)).first()
    if cfg:
        cfg.valor = value
        if desc:
            cfg.descripcion = desc
    else:
        cfg = Configuracion(clave=key, valor=value, descripcion=desc)
    session.add(cfg)
    session.commit()

def sync_cabys_data():
    """
    Función síncrona que ejecuta el proceso de descarga y actualización del catálogo CABYS.
    """
    print("[CABYS-SYNC] Iniciando proceso de sincronización...")
    
    # Crear sesión de base de datos
    with Session(engine) as session:
        # 1. Fijar estado en 'syncing'
        set_config_val(session, "cabys_sync_status", "syncing", "Estado de la sincronización del catálogo CABYS")
        set_config_val(session, "cabys_sync_error", "", "Último error en la sincronización de CABYS")
        session.commit()

    csv_content = ""
    error_msg = ""

    try:
        # Asegurar que el directorio database existe
        os.makedirs(os.path.dirname(LOCAL_CSV_PATH), exist_ok=True)

        # 2. Descargar de internet
        try:
            print(f"[CABYS-SYNC] Descargando catálogo desde {CABYS_CSV_URL}...")
            r = requests.get(CABYS_CSV_URL, timeout=30)
            if r.status_code == 200:
                csv_content = r.text
                # Guardar en caché local
                with open(LOCAL_CSV_PATH, "w", encoding="utf-8") as f:
                    f.write(csv_content)
                print("[CABYS-SYNC] Catálogo descargado y guardado en caché local.")
            else:
                error_msg = f"HTTP Error {r.status_code} al descargar"
                print(f"[CABYS-SYNC] {error_msg}")
        except Exception as download_error:
            error_msg = f"Error de red/descarga: {download_error}"
            print(f"[CABYS-SYNC] {error_msg}")

        # 3. Si la descarga falló, intentar leer la caché local
        if not csv_content:
            if os.path.exists(LOCAL_CSV_PATH):
                print("[CABYS-SYNC] Cargando desde caché local existente...")
                with open(LOCAL_CSV_PATH, "r", encoding="utf-8") as f:
                    csv_content = f.read()
                print("[CABYS-SYNC] Caché local cargada exitosamente.")
            else:
                raise Exception(error_msg or "No se pudo descargar el archivo y tampoco existe una caché local.")

        # 4. Parsear el CSV
        print("[CABYS-SYNC] Procesando CSV...")
        reader = csv.reader(io.StringIO(csv_content))
        rows_to_insert = []
        for i, row in enumerate(reader):
            if i < 2:  # Omitir metadata y headers
                continue
            if len(row) >= 19:
                codigo = row[-3].strip()
                descripcion = row[-2].strip()
                impuesto = row[-1].strip()
                if codigo and descripcion:
                    rows_to_insert.append((codigo, descripcion, impuesto))

        # 5. Insertar en base de datos usando executemany para velocidad atómica
        if rows_to_insert:
            print(f"[CABYS-SYNC] Limpiando tabla cabys e insertando {len(rows_to_insert)} registros...")
            conn = engine.raw_connection()
            cursor = conn.cursor()
            try:
                # Deshabilitar claves foráneas
                cursor.execute("PRAGMA foreign_keys = OFF")
                # Limpiar tabla
                cursor.execute("DELETE FROM cabys")
                # Insertar
                cursor.executemany(
                    "INSERT INTO cabys (codigo, descripcion, impuesto) VALUES (?, ?, ?)",
                    rows_to_insert
                )
                conn.commit()
                print(f"[CABYS-SYNC] ¡Base de datos poblada exitosamente! Registros: {len(rows_to_insert)}")
            except Exception as db_err:
                conn.rollback()
                raise db_err
            finally:
                conn.close()

            # 6. Actualizar metadatos como completados exitosamente
            with Session(engine) as session:
                set_config_val(session, "cabys_sync_status", "success")
                set_config_val(session, "cabys_last_update", datetime.now().isoformat())
                set_config_val(session, "cabys_total_records", str(len(rows_to_insert)))
                session.commit()
        else:
            raise Exception("El archivo CSV procesado no contiene registros válidos.")

    except Exception as e:
        print(f"[CABYS-SYNC] Proceso fallido: {e}")
        with Session(engine) as session:
            set_config_val(session, "cabys_sync_status", "failed")
            set_config_val(session, "cabys_sync_error", str(e))
            session.commit()

def run_sync_in_background():
    """
    Ejecuta la sincronización en un hilo secundario de manera no bloqueante.
    """
    thread = threading.Thread(target=sync_cabys_data)
    thread.daemon = True
    thread.start()
    return thread

def check_and_trigger_auto_sync():
    """
    Verifica si la tabla está vacía y lanza la sincronización automática si es necesario.
    """
    with Session(engine) as session:
        # Verificar cantidad de registros
        try:
            conn = engine.raw_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT count(*) FROM cabys")
            count = cursor.fetchone()[0]
            conn.close()
        except Exception:
            count = 0

        # Si no hay registros y no está en proceso de sincronización, arrancar sync
        status = get_config_val(session, "cabys_sync_status", "idle")
        if count == 0 and status != "syncing":
            print("[CABYS-SYNC] Base de datos vacía detectada al iniciar. Lanzando auto-sincronización en segundo plano...")
            run_sync_in_background()
