from sqlmodel import SQLModel, Field, Relationship
from typing import Optional, List
from datetime import datetime, date
from decimal import Decimal
from sqlalchemy import Column, Numeric
from zoneinfo import ZoneInfo

def get_cr_time() -> datetime:
    return datetime.now(ZoneInfo("America/Costa_Rica")).replace(tzinfo=None)

# --- CONFIGURACIÓN GLOBAL ---
class Empresa(SQLModel, table=True):
    __tablename__ = "empresa"
    id: Optional[int] = Field(default=None, primary_key=True)
    nombre_comercial: str
    razon_social: str
    cedula_juridica: str
    direccion: str
    telefonos: str
    correo: str
    logo_path: Optional[str] = None
    moneda: str = Field(default="CRC")
    zona_horaria: str = Field(default="America/Costa_Rica")
    sitio_web: Optional[str] = Field(default=None)

class Configuracion(SQLModel, table=True):
    __tablename__ = "configuracion"
    id: Optional[int] = Field(default=None, primary_key=True)
    clave: str = Field(unique=True, index=True)
    valor: str
    descripcion: Optional[str] = None

# --- SUCURSALES Y CAJAS ---
class Sucursal(SQLModel, table=True):
    __tablename__ = "sucursales"
    id: Optional[int] = Field(default=None, primary_key=True)
    nombre: str
    direccion: str
    telefono: str
    activa: bool = Field(default=True)

    # Relaciones
    cajas: List["Caja"] = Relationship(back_populates="sucursal")
    usuarios: List["Usuario"] = Relationship(back_populates="sucursal")
    inventarios: List["Inventario"] = Relationship(back_populates="sucursal")

class Caja(SQLModel, table=True):
    __tablename__ = "cajas"
    id: Optional[int] = Field(default=None, primary_key=True)
    nombre: str
    sucursal_id: int = Field(foreign_key="sucursales.id")
    activa: bool = Field(default=True)

    # Relaciones
    sucursal: Sucursal = Relationship(back_populates="cajas")
    arqueos: List["Arqueo"] = Relationship(back_populates="caja")
    ventas: List["Venta"] = Relationship(back_populates="caja")

# --- ROLES Y PERMISOS (RBAC) ---
class RolePermisoLink(SQLModel, table=True):
    __tablename__ = "roles_permisos"
    role_id: int = Field(foreign_key="roles.id", primary_key=True)
    permiso_id: int = Field(foreign_key="permisos.id", primary_key=True)

class Rol(SQLModel, table=True):
    __tablename__ = "roles"
    id: Optional[int] = Field(default=None, primary_key=True)
    nombre: str = Field(unique=True, index=True)
    descripcion: Optional[str] = None

    # Relaciones
    usuarios: List["Usuario"] = Relationship(back_populates="rol")
    permisos: List["Permiso"] = Relationship(back_populates="roles", link_model=RolePermisoLink)

class Permiso(SQLModel, table=True):
    __tablename__ = "permisos"
    id: Optional[int] = Field(default=None, primary_key=True)
    clave: str = Field(unique=True, index=True) # e.g. "pos:view", "inventory:edit"
    modulo: str
    descripcion: str

    # Relaciones
    roles: List[Rol] = Relationship(back_populates="permisos", link_model=RolePermisoLink)

# --- USUARIOS Y AUDITORÍA ---
class Usuario(SQLModel, table=True):
    __tablename__ = "usuarios"
    id: Optional[int] = Field(default=None, primary_key=True)
    username: str = Field(unique=True, index=True)
    password_hash: str
    nombre: str
    email: str
    role_id: int = Field(foreign_key="roles.id")
    sucursal_id: int = Field(foreign_key="sucursales.id")
    activo: bool = Field(default=True)
    intentos_fallidos: int = Field(default=0)
    bloqueado_hasta: Optional[datetime] = None

    # Relaciones
    rol: Rol = Relationship(back_populates="usuarios")
    sucursal: Sucursal = Relationship(back_populates="usuarios")
    arqueos: List["Arqueo"] = Relationship(back_populates="usuario")
    ventas: List["Venta"] = Relationship(back_populates="usuario")
    auditorias: List["Auditoria"] = Relationship(back_populates="usuario")

class Auditoria(SQLModel, table=True):
    __tablename__ = "auditoria"
    id: Optional[int] = Field(default=None, primary_key=True)
    usuario_id: Optional[int] = Field(default=None, foreign_key="usuarios.id", nullable=True)
    accion: str
    modulo: str
    detalles: str
    ip_address: Optional[str] = None
    fecha_registro: datetime = Field(default_factory=get_cr_time)

    # Relaciones
    usuario: Optional[Usuario] = Relationship(back_populates="auditorias")

# --- CAJA CHICA Y ARQUEOS ---
class Arqueo(SQLModel, table=True):
    __tablename__ = "arqueos"
    id: Optional[int] = Field(default=None, primary_key=True)
    caja_id: int = Field(foreign_key="cajas.id")
    usuario_id: int = Field(foreign_key="usuarios.id")
    fecha_apertura: datetime = Field(default_factory=get_cr_time)
    fecha_cierre: Optional[datetime] = None
    monto_inicial: float = Field(default=0.0)
    monto_final_efectivo: float = Field(default=0.0)
    monto_final_tarjeta: float = Field(default=0.0)
    monto_final_transferencia: float = Field(default=0.0)
    observaciones: Optional[str] = None
    estado: str = Field(default="abierta") # abierta, cerrada

    # Relaciones
    caja: Caja = Relationship(back_populates="arqueos")
    usuario: Usuario = Relationship(back_populates="arqueos")
    detalles: List["DetalleArqueo"] = Relationship(back_populates="arqueo")

class DetalleArqueo(SQLModel, table=True):
    __tablename__ = "detalle_arqueos"
    id: Optional[int] = Field(default=None, primary_key=True)
    arqueo_id: int = Field(foreign_key="arqueos.id")
    tipo_movimiento: str # retiro_efectivo, pago_menor, gasto_operativo, fondo_caja, ingreso_extraordinario, ajuste
    descripcion: str
    monto: float = Field(default=0.0)
    usuario_id: int = Field(foreign_key="usuarios.id")
    fecha_registro: datetime = Field(default_factory=get_cr_time)

    # Relaciones
    arqueo: Arqueo = Relationship(back_populates="detalles")

# --- CATEGORÍAS, MARCAS E IMPUESTOS ---
class Categoria(SQLModel, table=True):
    __tablename__ = "categorias"
    id: Optional[int] = Field(default=None, primary_key=True)
    nombre: str = Field(unique=True)
    dias_alerta_vencimiento: int = Field(default=30) # Configurable por categoría

    # Relaciones
    subcategorias: List["Subcategoria"] = Relationship(back_populates="categoria")

class Subcategoria(SQLModel, table=True):
    __tablename__ = "subcategorias"
    id: Optional[int] = Field(default=None, primary_key=True)
    categoria_id: int = Field(foreign_key="categorias.id")
    nombre: str

    # Relaciones
    categoria: Categoria = Relationship(back_populates="subcategorias")
    productos: List["Producto"] = Relationship(back_populates="subcategoria")

class Marca(SQLModel, table=True):
    __tablename__ = "marcas"
    id: Optional[int] = Field(default=None, primary_key=True)
    nombre: str = Field(unique=True)

    # Relaciones
    productos: List["Producto"] = Relationship(back_populates="marca")

class Impuesto(SQLModel, table=True):
    __tablename__ = "impuestos"
    id: Optional[int] = Field(default=None, primary_key=True)
    nombre: str
    porcentaje: float = Field(default=0.0)
    descripcion: Optional[str] = None
    activo: bool = Field(default=True)

    # Relaciones
    productos: List["Producto"] = Relationship(back_populates="impuesto")

# --- PRODUCTOS E INVENTARIO ---
class Producto(SQLModel, table=True):
    __tablename__ = "productos"
    id: Optional[int] = Field(default=None, primary_key=True)
    sku: str = Field(unique=True, index=True)
    codigo_barras: str = Field(unique=True, index=True)
    nombre: str = Field(index=True)
    descripcion: Optional[str] = None
    marca_id: int = Field(foreign_key="marcas.id")
    subcategoria_id: int = Field(foreign_key="subcategorias.id")
    unidad_medida: str = Field(default="Unidad") # Unidad, Gramo, Litro, etc.
    precio_costo: float = Field(default=0.0)
    precio_venta: float = Field(default=0.0)
    precio_mayorista: float = Field(default=0.0)
    impuesto_id: int = Field(foreign_key="impuestos.id")
    stock_minimo: float = Field(default=0.0)
    stock_maximo: float = Field(default=0.0)
    imagen_path: Optional[str] = None
    activo: bool = Field(default=True)
    proveedor_id: Optional[int] = Field(default=None, foreign_key="proveedores.id", nullable=True)
    codigo_cabys: Optional[str] = Field(default=None, nullable=True)

    # Relaciones
    marca: Marca = Relationship(back_populates="productos")
    subcategoria: Subcategoria = Relationship(back_populates="productos")
    impuesto: Impuesto = Relationship(back_populates="productos")
    lotes: List["Lote"] = Relationship(back_populates="producto")
    inventarios: List["Inventario"] = Relationship(back_populates="producto")
    historial_precios: List["HistorialPrecios"] = Relationship(back_populates="producto")
    historial_costos: List["HistorialCostos"] = Relationship(back_populates="producto")
    proveedor: Optional["Proveedor"] = Relationship(back_populates="productos")

class Lote(SQLModel, table=True):
    __tablename__ = "lotes"
    id: Optional[int] = Field(default=None, primary_key=True)
    producto_id: int = Field(foreign_key="productos.id")
    numero_lote: str = Field(index=True)
    fecha_ingreso: date = Field(default_factory=date.today)
    fecha_vencimiento: date
    stock_inicial: float = Field(default=0.0)
    stock_actual: float = Field(default=0.0)
    costo_unitario: float = Field(default=0.0)

    # Relaciones
    producto: Producto = Relationship(back_populates="lotes")

class Inventario(SQLModel, table=True):
    __tablename__ = "inventario"
    id: Optional[int] = Field(default=None, primary_key=True)
    sucursal_id: int = Field(foreign_key="sucursales.id")
    producto_id: int = Field(foreign_key="productos.id")
    existencia_actual: float = Field(default=0.0)

    # Relaciones
    sucursal: Sucursal = Relationship(back_populates="inventarios")
    producto: Producto = Relationship(back_populates="inventarios")
    movimientos: List["MovimientoInventario"] = Relationship(back_populates="inventario")

class MovimientoInventario(SQLModel, table=True):
    __tablename__ = "movimientos_inventario"
    id: Optional[int] = Field(default=None, primary_key=True)
    inventario_id: int = Field(foreign_key="inventario.id")
    tipo_movimiento: str # entrada, salida, ajuste, transferencia
    cantidad: float
    motivo: str
    usuario_id: int = Field(foreign_key="usuarios.id")
    fecha_registro: datetime = Field(default_factory=get_cr_time)

    # Relaciones
    inventario: Inventario = Relationship(back_populates="movimientos")

# --- CLIENTES Y FIDELIZACIÓN ---
class Cliente(SQLModel, table=True):
    __tablename__ = "clientes"
    id: Optional[int] = Field(default=None, primary_key=True)
    identificacion: str = Field(unique=True, index=True)
    nombre: str = Field(index=True)
    direccion: Optional[str] = None
    telefono: Optional[str] = None
    correo: Optional[str] = None
    limite_credito: float = Field(default=0.0)
    saldo_actual: float = Field(default=0.0)
    activo: bool = Field(default=True)

    # Relaciones
    puntos: Optional["ClientePuntos"] = Relationship(back_populates="cliente")
    ventas: List["Venta"] = Relationship(back_populates="cliente")
    cuentas_cobrar: List["CuentaPorCobrar"] = Relationship(back_populates="cliente")

class ClientePuntos(SQLModel, table=True):
    __tablename__ = "clientes_puntos"
    id: Optional[int] = Field(default=None, primary_key=True)
    cliente_id: int = Field(foreign_key="clientes.id", unique=True)
    puntos_acumulados: int = Field(default=0)
    puntos_canjeados: int = Field(default=0)
    fecha_actualizacion: datetime = Field(default_factory=get_cr_time)

    # Relaciones
    cliente: Cliente = Relationship(back_populates="puntos")

# --- PROVEEDORES Y COMPRAS ---
class Proveedor(SQLModel, table=True):
    __tablename__ = "proveedores"
    id: Optional[int] = Field(default=None, primary_key=True)
    identificacion: str = Field(unique=True, index=True)
    nombre: str = Field(index=True)
    contacto: str
    telefono: str
    correo: str
    direccion: str
    activo: bool = Field(default=True)

    # Relaciones
    compras: List["Compra"] = Relationship(back_populates="proveedor")
    cuentas_pagar: List["CuentaPorPagar"] = Relationship(back_populates="proveedor")
    historial_costos: List["HistorialCostos"] = Relationship(back_populates="proveedor")
    productos: List["Producto"] = Relationship(back_populates="proveedor")

class Compra(SQLModel, table=True):
    __tablename__ = "compras"
    id: Optional[int] = Field(default=None, primary_key=True)
    proveedor_id: int = Field(foreign_key="proveedores.id")
    sucursal_id: int = Field(foreign_key="sucursales.id")
    usuario_id: int = Field(foreign_key="usuarios.id")
    numero_factura: str
    fecha_compra: datetime = Field(default_factory=get_cr_time)
    total: float = Field(default=0.0)
    estado: str = Field(default="pendiente") # pendiente, pagada

    # Relaciones
    proveedor: Proveedor = Relationship(back_populates="compras")
    detalles: List["DetalleCompra"] = Relationship(back_populates="compra")
    cuentas_pagar: List["CuentaPorPagar"] = Relationship(back_populates="compra")

class DetalleCompra(SQLModel, table=True):
    __tablename__ = "detalle_compras"
    id: Optional[int] = Field(default=None, primary_key=True)
    compra_id: int = Field(foreign_key="compras.id")
    producto_id: int = Field(foreign_key="productos.id")
    cantidad: float
    costo_unitario: float

    # Relaciones
    compra: Compra = Relationship(back_populates="detalles")
    producto: "Producto" = Relationship()

# --- VENTAS Y PAGOS ---
class Venta(SQLModel, table=True):
    __tablename__ = "ventas"
    id: Optional[int] = Field(default=None, primary_key=True)
    sucursal_id: int = Field(foreign_key="sucursales.id")
    caja_id: int = Field(foreign_key="cajas.id")
    usuario_id: int = Field(foreign_key="usuarios.id")
    cliente_id: Optional[int] = Field(default=None, foreign_key="clientes.id", nullable=True)
    consecutivo: str = Field(unique=True, index=True)
    fecha_venta: datetime = Field(default_factory=get_cr_time)
    subtotal: float = Field(default=0.0)
    descuento: float = Field(default=0.0)
    impuesto: float = Field(default=0.0)
    total: float = Field(default=0.0)
    estado: str = Field(default="activa") # activa, suspendida, anulada
    tipo_documento: str = Field(default="ticket") # ticket, factura

    # Relaciones
    caja: Caja = Relationship(back_populates="ventas")
    usuario: Usuario = Relationship(back_populates="ventas")
    cliente: Optional[Cliente] = Relationship(back_populates="ventas")
    detalles: List["DetalleVenta"] = Relationship(back_populates="venta")
    pagos: List["Pago"] = Relationship(back_populates="venta")
    cuentas_cobrar: List["CuentaPorCobrar"] = Relationship(back_populates="venta")

class DetalleVenta(SQLModel, table=True):
    __tablename__ = "detalle_ventas"
    id: Optional[int] = Field(default=None, primary_key=True)
    venta_id: int = Field(foreign_key="ventas.id")
    producto_id: int = Field(foreign_key="productos.id")
    cantidad: float
    precio_unitario: float
    descuento_unitario: float = Field(default=0.0)
    costo_unitario: float = Field(default=0.0)

    # Relaciones
    venta: Venta = Relationship(back_populates="detalles")
    producto: "Producto" = Relationship()

class Pago(SQLModel, table=True):
    __tablename__ = "pagos"
    id: Optional[int] = Field(default=None, primary_key=True)
    venta_id: int = Field(foreign_key="ventas.id")
    metodo_pago: str # efectivo, tarjeta, transferencia, sinpe, credito, puntos
    monto: float = Field(default=0.0)

    # Relaciones
    venta: Venta = Relationship(back_populates="pagos")

# --- CUENTAS POR COBRAR Y PAGAR ---
class CuentaPorCobrar(SQLModel, table=True):
    __tablename__ = "cuentas_por_cobrar"
    id: Optional[int] = Field(default=None, primary_key=True)
    cliente_id: int = Field(foreign_key="clientes.id")
    venta_id: int = Field(foreign_key="ventas.id")
    monto_total: float
    saldo_pendiente: float
    fecha_vencimiento: date
    estado: str = Field(default="al_dia") # al_dia, moroso, pagado

    # Relaciones
    cliente: Cliente = Relationship(back_populates="cuentas_cobrar")
    venta: Venta = Relationship(back_populates="cuentas_cobrar")

class CuentaPorPagar(SQLModel, table=True):
    __tablename__ = "cuentas_por_pagar"
    id: Optional[int] = Field(default=None, primary_key=True)
    proveedor_id: int = Field(foreign_key="proveedores.id")
    compra_id: int = Field(foreign_key="compras.id")
    monto_total: float
    saldo_pendiente: float
    fecha_vencimiento: date
    estado: str = Field(default="pendiente") # pendiente, pagada

    # Relaciones
    proveedor: Proveedor = Relationship(back_populates="cuentas_pagar")
    compra: Compra = Relationship(back_populates="cuentas_pagar")

# --- HISTORIAL DE CAMBIOS DE PRECIOS Y COSTOS ---
class HistorialPrecios(SQLModel, table=True):
    __tablename__ = "historial_precios"
    id: Optional[int] = Field(default=None, primary_key=True)
    producto_id: int = Field(foreign_key="productos.id")
    precio_anterior: float
    precio_nuevo: float
    motivo: str
    usuario_id: int = Field(foreign_key="usuarios.id")
    fecha_registro: datetime = Field(default_factory=get_cr_time)

    # Relaciones
    producto: Producto = Relationship(back_populates="historial_precios")

class HistorialCostos(SQLModel, table=True):
    __tablename__ = "historial_costos"
    id: Optional[int] = Field(default=None, primary_key=True)
    producto_id: int = Field(foreign_key="productos.id")
    proveedor_id: Optional[int] = Field(default=None, foreign_key="proveedores.id", nullable=True)
    costo_anterior: float
    costo_nuevo: float
    usuario_id: int = Field(foreign_key="usuarios.id")
    fecha_registro: datetime = Field(default_factory=get_cr_time)
    motivo: str

    # Relaciones
    producto: Producto = Relationship(back_populates="historial_costos")
    proveedor: Optional[Proveedor] = Relationship(back_populates="historial_costos")

# --- TRANSFERENCIAS ENTRE SUCURSALES ---
class Transferencia(SQLModel, table=True):
    __tablename__ = "transferencias"
    id: Optional[int] = Field(default=None, primary_key=True)
    sucursal_origen_id: int = Field(foreign_key="sucursales.id")
    sucursal_destino_id: int = Field(foreign_key="sucursales.id")
    usuario_id: int = Field(foreign_key="usuarios.id")
    fecha: datetime = Field(default_factory=get_cr_time)
    estado: str = Field(default="solicitada") # solicitada, aprobada, despachada, recibida

    # Relaciones
    detalles: List["DetalleTransferencia"] = Relationship(back_populates="transferencia")

class DetalleTransferencia(SQLModel, table=True):
    __tablename__ = "detalle_transferencias"
    id: Optional[int] = Field(default=None, primary_key=True)
    transferencia_id: int = Field(foreign_key="transferencias.id")
    producto_id: int = Field(foreign_key="productos.id")
    cantidad: float

    # Relaciones
    transferencia: Transferencia = Relationship(back_populates="detalles")

# --- FACTURACIÓN ELECTRÓNICA DE COSTA RICA ---
class FacturaElectronica(SQLModel, table=True):
    __tablename__ = "facturas_electronicas"
    id: Optional[int] = Field(default=None, primary_key=True)
    venta_id: int = Field(foreign_key="ventas.id")
    clave: str = Field(unique=True, index=True) # 50 dígitos
    consecutivo: str = Field(unique=True, index=True) # 20 dígitos
    estado_hacienda: str = Field(default="Pendiente") # Pendiente, Enviado, Aceptado, Rechazado
    fecha_envio: Optional[datetime] = None
    xml_enviado: Optional[str] = None
    xml_respuesta: Optional[str] = None
    mensaje_error: Optional[str] = None

    # Relación
    venta: Venta = Relationship()

# --- LOGS DE WHATSAPP SIMULADO ---
class WhatsAppLog(SQLModel, table=True):
    __tablename__ = "whatsapp_logs"
    id: Optional[int] = Field(default=None, primary_key=True)
    telefono: str
    mensaje: str
    fecha_envio: datetime = Field(default_factory=get_cr_time)
    estado: str = Field(default="simulado")

# --- CATÁLOGO CABYS COSTA RICA ---
class Cabys(SQLModel, table=True):
    __tablename__ = "cabys"
    id: Optional[int] = Field(default=None, primary_key=True)
    codigo: str = Field(index=True, unique=True)
    descripcion: str = Field(index=True)
    impuesto: str = Field(default="13%")
