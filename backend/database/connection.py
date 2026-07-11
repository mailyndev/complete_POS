import os
from sqlmodel import create_engine, SQLModel, Session
from sqlalchemy.orm import sessionmaker

# La ruta base de la base de datos local SQLite se creará en el mismo directorio.
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///pos.db")

# SQLite requiere connect_args={"check_same_thread": False} para múltiples hilos
connect_args = {}
if DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(
    DATABASE_URL,
    echo=False,
    connect_args=connect_args
)

def init_db():
    # Crea todas las tablas definidas en schema.py
    # Importamos schema para asegurar que los modelos se registren en SQLModel.metadata
    from . import schema
    SQLModel.metadata.create_all(engine)
    
    # Migración en caliente para SQLite (soporte de costos ponderados/FIFO e históricos de utilidad)
    from sqlalchemy import text
    with Session(engine) as session:
        # Añadir costo_unitario a detalle_ventas
        try:
            session.execute(text("ALTER TABLE detalle_ventas ADD COLUMN costo_unitario REAL DEFAULT 0.0"))
            session.commit()
            print("Migración: Columna costo_unitario agregada a detalle_ventas.")
        except Exception as e:
            session.rollback()
            print(f"Migración detalle_ventas omitida o fallida: {e}")
            
        # Añadir costo_unitario a lotes
        try:
            session.execute(text("ALTER TABLE lotes ADD COLUMN costo_unitario REAL DEFAULT 0.0"))
            session.commit()
            print("Migración: Columna costo_unitario agregada a lotes.")
        except Exception as e:
            session.rollback()
            print(f"Migración lotes omitida o fallida: {e}")

        # Añadir activo a productos
        try:
            session.execute(text("ALTER TABLE productos ADD COLUMN activo BOOLEAN DEFAULT 1"))
            session.commit()
            print("Migración: Columna activo agregada a productos.")
        except Exception as e:
            session.rollback()

        # Añadir proveedor_id a productos
        try:
            session.execute(text("ALTER TABLE productos ADD COLUMN proveedor_id INTEGER DEFAULT NULL"))
            session.commit()
            print("Migración: Columna proveedor_id agregada a productos.")
        except Exception as e:
            session.rollback()

        # Añadir activo a clientes
        try:
            session.execute(text("ALTER TABLE clientes ADD COLUMN activo BOOLEAN DEFAULT 1"))
            session.commit()
            print("Migración: Columna activo agregada a clientes.")
        except Exception as e:
            session.rollback()

        # Añadir activo a proveedores
        try:
            session.execute(text("ALTER TABLE proveedores ADD COLUMN activo BOOLEAN DEFAULT 1"))
            session.commit()
            print("Migración: Columna activo agregada a proveedores.")
        except Exception as e:
            session.rollback()

        # Añadir sitio_web a empresa
        try:
            session.execute(text("ALTER TABLE empresa ADD COLUMN sitio_web TEXT DEFAULT NULL"))
            session.commit()
            print("Migración: Columna sitio_web agregada a empresa.")
        except Exception as e:
            session.rollback()

        # Añadir codigo_cabys a productos
        try:
            session.execute(text("ALTER TABLE productos ADD COLUMN codigo_cabys VARCHAR(20) DEFAULT NULL"))
            session.commit()
            print("Migración: Columna codigo_cabys agregada a productos.")
        except Exception as e:
            session.rollback()

def get_session():
    with Session(engine) as session:
        yield session
