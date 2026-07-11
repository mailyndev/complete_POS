from ..utils.security import hash_password
from datetime import datetime, date
from sqlmodel import Session, select
from .connection import engine
from .schema import (
    Empresa, Rol, Permiso, RolePermisoLink, Usuario, Sucursal, Caja,
    Impuesto, Categoria, Subcategoria, Marca, Producto, Inventario,
    Cliente, ClientePuntos, Proveedor, Configuracion
)

def seed_db():
    with Session(engine) as session:
        # 1. Verificar si ya hay datos semilla (ej. si ya existe la empresa)
        db_empresa = session.exec(select(Empresa)).first()
        if db_empresa:
            print("La base de datos ya contiene datos semilla. Omitiendo...")
            return

        print("Iniciando poblamiento de base de datos...")

        # 2. Configuración de la Empresa
        empresa = Empresa(
            nombre_comercial="Minisúper M Y M",
            razon_social="Minisúper M Y M S.A.",
            cedula_juridica="3-101-000000",
            direccion="Costa Rica",
            telefonos="0000-0000",
            correo="contacto@minisupermym.com",
            logo_path="/static/uploads/empresa/logo.jpg",
            moneda="CRC",
            zona_horaria="America/Costa_Rica"
        )
        session.add(empresa)

        # 3. Sucursal por defecto
        sucursal = Sucursal(
            nombre="Sucursal Central",
            direccion="Frente al Muelle Principal, Puntarenas",
            telefono="2661-0000",
            activa=True
        )
        session.add(sucursal)
        session.commit()
        session.refresh(sucursal)

        # 4. Caja por defecto
        caja = Caja(
            nombre="Caja Principal",
            sucursal_id=sucursal.id,
            activa=True
        )
        session.add(caja)

        # 5. Permisos
        permisos_lista = [
            # POS
            Permiso(clave="pos:access", modulo="Ventas", descripcion="Acceso completo al punto de venta (POS)"),
            # Inventario
            Permiso(clave="inventory:view", modulo="Inventario", descripcion="Ver catálogo de productos e inventario"),
            Permiso(clave="inventory:edit", modulo="Inventario", descripcion="Crear, editar y ajustar existencias y lotes"),
            # Compras
            Permiso(clave="purchases:access", modulo="Compras", descripcion="Gestionar proveedores, órdenes y facturas de compra"),
            # Clientes
            Permiso(clave="clients:access", modulo="Clientes", descripcion="Administrar clientes y programas de fidelización"),
            # Crédito
            Permiso(clave="credit:access", modulo="Créditos", descripcion="Administrar cuentas por cobrar e historial de pagos de crédito"),
            # Caja
            Permiso(clave="cash:access", modulo="Caja", descripcion="Aperturas, egresos y cierres de caja"),
            # Reportes
            Permiso(clave="reports:view", modulo="Reportes", descripcion="Acceso a reportes financieros, auditorías y rentabilidades"),
            # Configuraciones
            Permiso(clave="settings:edit", modulo="Configuración", descripcion="Modificar parámetros globales del negocio y respaldos"),
            # Auditoría
            Permiso(clave="audit:view", modulo="Auditoría", descripcion="Ver registros de acciones y logs del sistema")
        ]
        
        for p in permisos_lista:
            session.add(p)
        session.commit()

        # Cargar permisos creados
        db_permisos = {p.clave: p for p in session.exec(select(Permiso)).all()}

        # 6. Roles
        rol_admin = Rol(nombre="Administrador General", descripcion="Acceso total a todas las herramientas del sistema")
        rol_gerente = Rol(nombre="Gerente", descripcion="Supervisa ventas, inventarios, compras y reportes financieros")
        rol_cajero = Rol(nombre="Cajero", descripcion="Acceso exclusivo al POS, consultas autorizadas y control de caja")
        rol_bodeguero = Rol(nombre="Encargado de Bodega", descripcion="Recepción de mercadería, inventarios físicos y ajustes")
        rol_contador = Rol(nombre="Contabilidad", descripcion="Facturación, cuentas por cobrar/pagar e informes contables")

        session.add(rol_admin)
        session.add(rol_gerente)
        session.add(rol_cajero)
        session.add(rol_bodeguero)
        session.add(rol_contador)
        session.commit()

        # Asociar permisos a Roles
        # Admin: Todos
        for perm in db_permisos.values():
            session.add(RolePermisoLink(role_id=rol_admin.id, permiso_id=perm.id))
        
        # Gerente: POS, Inventario, Compras, Clientes, Reportes
        for pk in ["pos:access", "inventory:view", "inventory:edit", "purchases:access", "clients:access", "reports:view", "cash:access"]:
            session.add(RolePermisoLink(role_id=rol_gerente.id, permiso_id=db_permisos[pk].id))

        # Cajero: POS, Caja
        for pk in ["pos:access", "cash:access"]:
            session.add(RolePermisoLink(role_id=rol_cajero.id, permiso_id=db_permisos[pk].id))

        # Bodeguero: Inventario, Compras
        for pk in ["inventory:view", "inventory:edit", "purchases:access"]:
            session.add(RolePermisoLink(role_id=rol_bodeguero.id, permiso_id=db_permisos[pk].id))

        # Contador: Facturas (en POS), Clientes (créditos), Reportes
        for pk in ["pos:access", "clients:access", "credit:access", "reports:view"]:
            session.add(RolePermisoLink(role_id=rol_contador.id, permiso_id=db_permisos[pk].id))
        
        session.commit()

        # 7. Usuarios Iniciales
        admin_user = Usuario(
            username="admin",
            password_hash=hash_password("admin123"),
            nombre="Administrador Principal",
            email="admin@minisupermym.com",
            role_id=rol_admin.id,
            sucursal_id=sucursal.id,
            activo=True
        )
        cajero_user = Usuario(
            username="cajero",
            password_hash=hash_password("cajero123"),
            nombre="Cajero Principal",
            email="cajero@minisupermym.com",
            role_id=rol_cajero.id,
            sucursal_id=sucursal.id,
            activo=True
        )
        bodeguero_user = Usuario(
            username="bodega",
            password_hash=hash_password("bodega123"),
            nombre="Bodeguero Central",
            email="bodega@minisupermym.com",
            role_id=rol_bodeguero.id,
            sucursal_id=sucursal.id,
            activo=True
        )
        session.add(admin_user)
        session.add(cajero_user)
        session.add(bodeguero_user)
        # 8. Impuestos (IVA Costa Rica)
        imp_iva13 = Impuesto(nombre="IVA 13%", porcentaje=13.0, descripcion="Tarifa General del IVA", activo=True)
        imp_iva4 = Impuesto(nombre="IVA 4%", porcentaje=4.0, descripcion="Tarifa reducida (Servicios de salud y otros)", activo=True)
        imp_iva1 = Impuesto(nombre="IVA 1%", porcentaje=1.0, descripcion="Canasta Básica Tributaria", activo=True)
        imp_exento = Impuesto(nombre="Exento", porcentaje=0.0, descripcion="Bienes y servicios exentos de IVA", activo=True)
        
        session.add(imp_iva13)
        session.add(imp_iva4)
        session.add(imp_iva1)
        session.add(imp_exento)
        session.commit()

        # 9. Categorías y Días de Alerta de Vencimiento
        cat_lacteos = Categoria(nombre="Lácteos", dias_alerta_vencimiento=7)
        cat_embutidos = Categoria(nombre="Embutidos", dias_alerta_vencimiento=15)
        cat_bebidas = Categoria(nombre="Bebidas", dias_alerta_vencimiento=30)
        cat_conservas = Categoria(nombre="Conservas", dias_alerta_vencimiento=60)
        cat_medicina = Categoria(nombre="Medicamentos", dias_alerta_vencimiento=90)
        cat_abarrotes = Categoria(nombre="Abarrotes", dias_alerta_vencimiento=30)
        cat_frutas = Categoria(nombre="Frutas", dias_alerta_vencimiento=3)
        cat_verduras = Categoria(nombre="Verduras", dias_alerta_vencimiento=3)
        cat_legumbres = Categoria(nombre="Legumbres", dias_alerta_vencimiento=15)
        cat_quesos = Categoria(nombre="Quesos", dias_alerta_vencimiento=7)
        cat_concentrados = Categoria(nombre="Concentrados", dias_alerta_vencimiento=60)

        session.add(cat_lacteos)
        session.add(cat_embutidos)
        session.add(cat_bebidas)
        session.add(cat_conservas)
        session.add(cat_medicina)
        session.add(cat_abarrotes)
        session.add(cat_frutas)
        session.add(cat_verduras)
        session.add(cat_legumbres)
        session.add(cat_quesos)
        session.add(cat_concentrados)
        session.commit()

        # Subcategorías
        sub_leche = Subcategoria(nombre="Leche y Yogurt", categoria_id=cat_lacteos.id)
        sub_queso = Subcategoria(nombre="Quesos", categoria_id=cat_lacteos.id)
        sub_jamon = Subcategoria(nombre="Jamones y Salchichas", categoria_id=cat_embutidos.id)
        sub_refresco = Subcategoria(nombre="Gaseosas y Jugos", categoria_id=cat_bebidas.id)
        sub_atun = Subcategoria(nombre="Atún en Conserva", categoria_id=cat_conservas.id)
        sub_analgesicos = Subcategoria(nombre="Analgésicos", categoria_id=cat_medicina.id)
        sub_granos = Subcategoria(nombre="Granos Básicos", categoria_id=cat_abarrotes.id)
        sub_frutas_frescas = Subcategoria(nombre="Frutas Frescas", categoria_id=cat_frutas.id)
        sub_vegetales = Subcategoria(nombre="Vegetales Frescos", categoria_id=cat_verduras.id)
        sub_legumbres_secas = Subcategoria(nombre="Legumbres y Frijoles", categoria_id=cat_legumbres.id)
        sub_queso_derivados = Subcategoria(nombre="Queso y Derivados", categoria_id=cat_quesos.id)
        sub_mascotas = Subcategoria(nombre="Alimento Concentrado", categoria_id=cat_concentrados.id)

        session.add(sub_leche)
        session.add(sub_queso)
        session.add(sub_jamon)
        session.add(sub_refresco)
        session.add(sub_atun)
        session.add(sub_analgesicos)
        session.add(sub_granos)
        session.add(sub_frutas_frescas)
        session.add(sub_vegetales)
        session.add(sub_legumbres_secas)
        session.add(sub_queso_derivados)
        session.add(sub_mascotas)
        session.commit()

        # Marcas
        marca_2pinos = Marca(nombre="Dos Pinos")
        marca_coca = Marca(nombre="Coca-Cola")
        marca_sardimar = Marca(nombre="Sardimar")
        marca_bayer = Marca(nombre="Bayer")
        marca_pozuelo = Marca(nombre="Pozuelo")
        marca_puerto = Marca(nombre="Sabores del Puerto")

        session.add(marca_2pinos)
        session.add(marca_coca)
        session.add(marca_sardimar)
        session.add(marca_bayer)
        session.add(marca_pozuelo)
        session.add(marca_puerto)
        session.commit()

        # 10. Productos Iniciales (Seed)
        p1 = Producto(
            sku="L-LECHE-DES-01",
            codigo_barras="7441001123456",
            nombre="Leche Descremada 1L",
            descripcion="Leche descremada ultrapasteurizada adicionada con vitaminas A y D",
            marca_id=marca_2pinos.id,
            subcategoria_id=sub_leche.id,
            unidad_medida="Litro",
            precio_costo=750.00,
            precio_venta=950.00,
            precio_mayorista=900.00,
            impuesto_id=imp_iva1.id, # 1% Canasta Básica
            stock_minimo=10.0,
            stock_maximo=100.0,
            imagen_path="/static/uploads/productos/leche.png"
        )

        p2 = Producto(
            sku="B-COCA-600-01",
            codigo_barras="7501055303774",
            nombre="Refresco Coca-Cola 600ml",
            descripcion="Bebida gaseosa refrescante original de 600ml botella de plástico",
            marca_id=marca_coca.id,
            subcategoria_id=sub_refresco.id,
            unidad_medida="Unidad",
            precio_costo=920.00,
            precio_venta=1250.00,
            precio_mayorista=1200.00,
            impuesto_id=imp_iva13.id, # 13% General
            stock_minimo=20.0,
            stock_maximo=150.0,
            imagen_path="/static/uploads/productos/coca_600.png"
        )

        p3 = Producto(
            sku="C-ATUN-ACE-01",
            codigo_barras="7441017005432",
            nombre="Atún Sardimar en Aceite 140g",
            descripcion="Lomo de atún desmenuzado en aceite vegetal",
            marca_id=marca_sardimar.id,
            subcategoria_id=sub_atun.id,
            unidad_medida="Unidad",
            precio_costo=1050.00,
            precio_venta=1400.00,
            precio_mayorista=1350.00,
            impuesto_id=imp_iva13.id,
            stock_minimo=15.0,
            stock_maximo=80.0,
            imagen_path="/static/uploads/productos/atun.png"
        )

        p4 = Producto(
            sku="M-ALKA-TAB-01",
            codigo_barras="7501008493637",
            nombre="Alka-Seltzer 10 Tabletas",
            descripcion="Analgésico antiácido efervescente",
            marca_id=marca_bayer.id,
            subcategoria_id=sub_analgesicos.id,
            unidad_medida="Caja",
            precio_costo=1200.00,
            precio_venta=1800.00,
            precio_mayorista=1700.00,
            impuesto_id=imp_iva4.id, # 4% Salud
            stock_minimo=5.0,
            stock_maximo=50.0,
            imagen_path="/static/uploads/productos/alkaseltzer.png"
        )

        session.add(p1)
        session.add(p2)
        session.add(p3)
        session.add(p4)
        session.commit()

        # 11. Existencia en Inventario para Sucursal 1
        inv1 = Inventario(sucursal_id=sucursal.id, producto_id=p1.id, existencia_actual=25.0)
        inv2 = Inventario(sucursal_id=sucursal.id, producto_id=p2.id, existencia_actual=50.0)
        inv3 = Inventario(sucursal_id=sucursal.id, producto_id=p3.id, existencia_actual=18.0)
        inv4 = Inventario(sucursal_id=sucursal.id, producto_id=p4.id, existencia_actual=8.0)
        
        session.add(inv1)
        session.add(inv2)
        session.add(inv3)
        session.add(inv4)

        # 12. Cliente General (Ventas rápidas)
        cliente_gral = Cliente(
            identificacion="0000000000",
            nombre="Cliente General",
            direccion="N/A",
            telefono="0000-0000",
            correo="general@minisupermym.com",
            limite_credito=0.0,
            saldo_actual=0.0
        )
        session.add(cliente_gral)
        session.commit()
        session.refresh(cliente_gral)

        # Crear cuenta de puntos para cliente general
        cliente_puntos = ClientePuntos(
            cliente_id=cliente_gral.id,
            puntos_acumulados=0,
            puntos_canjeados=0
        )
        session.add(cliente_puntos)

        # 13. Proveedor Inicial
        prov_dist = Proveedor(
            identificacion="3-101-998877",
            nombre="Distribuidora El Sol S.A.",
            contacto="María Delgado",
            telefono="2233-4455",
            correo="ventas@distelsol.com",
            direccion="La Uruca, San José"
        )
        session.add(prov_dist)

        # 14. Configuraciones Globales
        config_fidelizacion = Configuracion(
            clave="fidelizacion_activa",
            valor="true",
            descripcion="Define si el programa de acumulación y canje de puntos está activo"
        )
        config_bypass_stock = Configuracion(
            clave="permitir_stock_negativo",
            valor="false",
            descripcion="Permitir vender productos sin existencias en inventario"
        )
        session.add(config_fidelizacion)
        session.add(config_bypass_stock)

        session.commit()
        print("Poblamiento de base de datos completado exitosamente.")
