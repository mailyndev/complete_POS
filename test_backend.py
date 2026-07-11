import sys
import unittest
from datetime import datetime, date
from sqlmodel import Session, select, create_engine, SQLModel

# Asegurar que el directorio raíz está en el path para importaciones relativas
sys.path.append(".")

from backend.database.connection import init_db
from backend.database.seed import seed_db, hash_password
from backend.database.schema import (
    Usuario, Rol, Permiso, Producto, Inventario, Venta, DetalleVenta,
    Pago, Lote, Arqueo, Empresa, Impuesto
)
from backend.utils.security import verify_password, create_access_token, decode_access_token

class TestAbastecedorPOS(unittest.TestCase):
    
    def setUp(self):
        # Usamos una base de datos en memoria sqlite separada para pruebas limpias
        self.engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
        SQLModel.metadata.create_all(self.engine)
        
        # Poblar con datos de prueba
        self.session = Session(self.engine)
        self.seed_test_data(self.session)
        
    def tearDown(self):
        self.session.close()

    @classmethod
    def seed_test_data(cls, session: Session):
        # Crear Empresa
        empresa = Empresa(
            nombre_comercial="Mini Super Test",
            razon_social="Test S.A.",
            cedula_juridica="3-101-999999",
            direccion="Dirección Test",
            telefonos="2222-2222",
            correo="test@test.com"
        )
        session.add(empresa)
        
        # Crear Sucursal y Caja
        sucursal = Sucursal = Rol # mock schema imports
        from backend.database.schema import Sucursal, Caja
        suc = Sucursal(nombre="Sucursal Test", direccion="Calle Test", telefono="2222-2222")
        session.add(suc)
        session.commit()
        session.refresh(suc)
        
        caja = Caja(nombre="Caja Test", sucursal_id=suc.id)
        session.add(caja)
        
        # Crear Roles y Permisos
        rol = Rol(nombre="Administrador General", descripcion="Administrador")
        session.add(rol)
        session.commit()
        session.refresh(rol)
        
        perm = Permiso(clave="pos:access", modulo="Ventas", descripcion="Acceso POS")
        session.add(perm)
        session.commit()
        
        # Crear Impuesto
        imp = Impuesto(nombre="IVA 13%", porcentaje=13.0, descripcion="IVA", activo=True)
        session.add(imp)
        session.commit()
        session.refresh(imp)
        
        # Crear Usuario Admin
        user = Usuario(
            username="admin_test",
            password_hash=hash_password("admin_test_123"),
            nombre="Admin Test",
            email="admin@test.com",
            role_id=rol.id,
            sucursal_id=suc.id
        )
        session.add(user)
        
        # Crear Marca y Categoría
        from backend.database.schema import Marca, Categoria, Subcategoria
        marca = Marca(nombre="Marca Test")
        cat = Categoria(nombre="Categoría Test", dias_alerta_vencimiento=30)
        session.add(marca)
        session.add(cat)
        session.commit()
        session.refresh(marca)
        session.refresh(cat)
        
        subcat = Subcategoria(nombre="Subcat Test", categoria_id=cat.id)
        session.add(subcat)
        session.commit()
        session.refresh(subcat)
        
        # Crear Producto
        p = Producto(
            sku="T-PROD-01",
            codigo_barras="123456789",
            nombre="Producto Test",
            precio_costo=1000.0,
            precio_venta=1500.0,
            marca_id=marca.id,
            subcategoria_id=subcat.id,
            impuesto_id=imp.id
        )
        session.add(p)
        session.commit()
        session.refresh(p)
        
        # Inventario
        inv = Inventario(sucursal_id=suc.id, producto_id=p.id, existencia_actual=10.0)
        session.add(inv)
        session.commit()
        
    def test_database_seeding(self):
        # Verificar que la empresa de prueba se creó correctamente
        emp = self.session.exec(select(Empresa)).first()
        self.assertEqual(emp.nombre_comercial, "Mini Super Test")
        
        # Verificar usuario
        usr = self.session.exec(select(Usuario).where(Usuario.username == "admin_test")).first()
        self.assertIsNotNone(usr)
        self.assertEqual(usr.nombre, "Admin Test")
        
    def test_password_security(self):
        # Validar encriptación y verificación correcta
        pwd_plain = "admin_test_123"
        hashed = hash_password(pwd_plain)
        
        # El hash debe coincidir
        self.assertTrue(verify_password(pwd_plain, hashed))
        # Contraseña errónea debe fallar
        self.assertFalse(verify_password("wrongpassword", hashed))

    def test_token_auth(self):
        # Generación y desencriptación de tokens JWT
        token_data = {"sub": "admin_test", "role": "Administrador General"}
        token = create_access_token(data=token_data)
        
        payload = decode_access_token(token)
        self.assertIsNotNone(payload)
        self.assertEqual(payload["sub"], "admin_test")
        self.assertEqual(payload["role"], "Administrador General")
        
    def test_product_margin(self):
        # Verificar cálculo de márgenes y utilidades
        p = self.session.exec(select(Producto).where(Producto.sku == "T-PROD-01")).first()
        utilidad = p.precio_venta - p.precio_costo
        margen = (utilidad / p.precio_venta * 100)
        
        self.assertEqual(utilidad, 500.0)
        self.assertEqual(margen, 33.33333333333333)

    def test_sale_inventory_deduction(self):
        # Simular una venta y validar que se descuenten las existencias
        usr = self.session.exec(select(Usuario).where(Usuario.username == "admin_test")).first()
        p = self.session.exec(select(Producto).where(Producto.sku == "T-PROD-01")).first()
        
        # Validar stock inicial
        inv = self.session.exec(select(Inventario).where(
            Inventario.producto_id == p.id,
            Inventario.sucursal_id == usr.sucursal_id
        )).first()
        self.assertEqual(inv.existencia_actual, 10.0)
        
        # Crear venta (cantidad = 3)
        venta = Venta(
            sucursal_id=usr.sucursal_id,
            caja_id=1,
            usuario_id=usr.id,
            consecutivo="FAC-TEST-001",
            subtotal=4500.0,
            descuento=0.0,
            impuesto=0.0,
            total=4500.0
        )
        self.session.add(venta)
        self.session.commit()
        
        det = DetalleVenta(
            venta_id=venta.id,
            producto_id=p.id,
            cantidad=3.0,
            precio_unitario=1500.0
        )
        self.session.add(det)
        
        # Restar stock del inventario
        inv.existencia_actual -= 3.0
        self.session.add(inv)
        self.session.commit()
        
        # Validar stock final
        inv_updated = self.session.exec(select(Inventario).where(
            Inventario.producto_id == p.id,
            Inventario.sucursal_id == usr.sucursal_id
        )).first()
        self.assertEqual(inv_updated.existencia_actual, 7.0)

    def test_provider_purchase(self):
        # Crear Proveedor y Registrar Compra
        from backend.database.schema import Proveedor, Compra, DetalleCompra, HistorialCostos
        
        prov = Proveedor(
            identificacion="3-101-777777",
            nombre="Proveedor Test S.A.",
            contacto="María",
            telefono="2222-2222",
            correo="m@test.com",
            direccion="Dirección Test"
        )
        self.session.add(prov)
        self.session.commit()
        self.session.refresh(prov)
        
        p = self.session.exec(select(Producto).where(Producto.sku == "T-PROD-01")).first()
        usr = self.session.exec(select(Usuario).where(Usuario.username == "admin_test")).first()
        
        # Registrar compra de 5 unidades a costo 1100.0 (anterior era 1000.0)
        compra = Compra(
            proveedor_id=prov.id,
            sucursal_id=usr.sucursal_id,
            usuario_id=usr.id,
            numero_factura="FAC-COMP-999",
            total=5500.0
        )
        self.session.add(compra)
        self.session.commit()
        
        det = DetalleCompra(
            compra_id=compra.id,
            producto_id=p.id,
            cantidad=5.0,
            costo_unitario=1100.0
        )
        self.session.add(det)
        
        # Actualizar stock en inventario y precio de costo en producto
        inv = self.session.exec(select(Inventario).where(
            Inventario.producto_id == p.id,
            Inventario.sucursal_id == usr.sucursal_id
        )).first()
        inv.existencia_actual += 5.0
        self.session.add(inv)
        
        if p.precio_costo != 1100.0:
            hc = HistorialCostos(
                producto_id=p.id,
                proveedor_id=prov.id,
                costo_anterior=p.precio_costo,
                costo_nuevo=1100.0,
                usuario_id=usr.id,
                motivo="Aumento de costo de proveedor"
            )
            self.session.add(hc)
            p.precio_costo = 1100.0
            self.session.add(p)
            
        self.session.commit()
        
        # Verificar que stock aumentó de 10.0 a 15.0
        self.assertEqual(inv.existencia_actual, 15.0)
        
        # Verificar registro en historial de costos
        hc_stmt = select(HistorialCostos).where(HistorialCostos.producto_id == p.id)
        hc_entry = self.session.exec(hc_stmt).first()
        self.assertIsNotNone(hc_entry)
        self.assertEqual(hc_entry.costo_anterior, 1000.0)
        self.assertEqual(hc_entry.costo_nuevo, 1100.0)

    def test_credit_payment_flow(self):
        # Crear Cliente con Crédito, realizar venta a crédito y abonar
        from backend.database.schema import Cliente, CuentaPorCobrar
        
        cli = Cliente(
            identificacion="101110222",
            nombre="Cliente Credito Test",
            limite_credito=10000.0,
            saldo_actual=0.0
        )
        self.session.add(cli)
        self.session.commit()
        self.session.refresh(cli)
        
        usr = self.session.exec(select(Usuario).where(Usuario.username == "admin_test")).first()
        p = self.session.exec(select(Producto).where(Producto.sku == "T-PROD-01")).first()
        
        # Simular Venta a Crédito por ₡3,000
        venta = Venta(
            sucursal_id=usr.sucursal_id,
            caja_id=1,
            usuario_id=usr.id,
            cliente_id=cli.id,
            consecutivo="FAC-CRED-888",
            total=3000.0
        )
        self.session.add(venta)
        self.session.commit()
        self.session.refresh(venta)
        
        # Incrementar saldo deudor del cliente
        cli.saldo_actual += 3000.0
        self.session.add(cli)
        
        # Generar Cuenta por Cobrar
        cxc = CuentaPorCobrar(
            cliente_id=cli.id,
            venta_id=venta.id,
            monto_total=3000.0,
            saldo_pendiente=3000.0,
            fecha_vencimiento=date.today(),
            estado="al_dia"
        )
        self.session.add(cxc)
        self.session.commit()
        
        self.assertEqual(cli.saldo_actual, 3000.0)
        self.assertEqual(cxc.saldo_pendiente, 3000.0)
        
        # Simular Abono de ₡1,200
        abono = 1200.0
        cli.saldo_actual -= abono
        self.session.add(cli)
        
        # Aplicar a cuentas por cobrar (FIFO)
        cxc_pend = self.session.exec(
            select(CuentaPorCobrar).where(CuentaPorCobrar.cliente_id == cli.id, CuentaPorCobrar.saldo_pendiente > 0)
        ).first()
        cxc_pend.saldo_pendiente -= abono
        self.session.add(cxc_pend)
        self.session.commit()
        
        # Verificar saldos actualizados
        self.assertEqual(cli.saldo_actual, 1800.0)
        self.assertEqual(cxc_pend.saldo_pendiente, 1800.0)

    def test_branch_transfer(self):
        # Crear una segunda sucursal
        from backend.database.schema import Sucursal, Transferencia, DetalleTransferencia, MovimientoInventario
        suc_destino = Sucursal(nombre="Sucursal Destino", direccion="Calle Destino", telefono="3333-3333")
        self.session.add(suc_destino)
        self.session.commit()
        self.session.refresh(suc_destino)
        
        # Sucursal de origen y producto de prueba
        usr = self.session.exec(select(Usuario).where(Usuario.username == "admin_test")).first()
        p = self.session.exec(select(Producto).where(Producto.sku == "T-PROD-01")).first()
        
        # Validar stock inicial en origen (10.0)
        inv_origen = self.session.exec(select(Inventario).where(
            Inventario.producto_id == p.id,
            Inventario.sucursal_id == usr.sucursal_id
        )).first()
        self.assertEqual(inv_origen.existencia_actual, 10.0)
        
        # Crear transferencia en estado 'solicitada'
        transfer = Transferencia(
            sucursal_origen_id=usr.sucursal_id,
            sucursal_destino_id=suc_destino.id,
            usuario_id=usr.id,
            estado="solicitada"
        )
        self.session.add(transfer)
        self.session.commit()
        self.session.refresh(transfer)
        
        det = DetalleTransferencia(
            transferencia_id=transfer.id,
            producto_id=p.id,
            cantidad=4.0
        )
        self.session.add(det)
        self.session.commit()
        
        # 1. Simular Despacho (Salida de sucursal de origen)
        inv_origen.existencia_actual -= det.cantidad
        self.session.add(inv_origen)
        
        mov_salida = MovimientoInventario(
            inventario_id=inv_origen.id,
            tipo_movimiento="transferencia",
            cantidad=det.cantidad,
            motivo=f"Despacho transferencia #{transfer.id}",
            usuario_id=usr.id
        )
        self.session.add(mov_salida)
        transfer.estado = "despachada"
        self.session.add(transfer)
        self.session.commit()
        
        # Verificar stock en origen (10.0 - 4.0 = 6.0)
        self.session.refresh(inv_origen)
        self.assertEqual(inv_origen.existencia_actual, 6.0)
        self.assertEqual(transfer.estado, "despachada")
        
        # 2. Simular Recepción (Entrada en sucursal destino)
        inv_destino = self.session.exec(select(Inventario).where(
            Inventario.producto_id == p.id,
            Inventario.sucursal_id == suc_destino.id
        )).first()
        if not inv_destino:
            inv_destino = Inventario(sucursal_id=suc_destino.id, producto_id=p.id, existencia_actual=0.0)
            self.session.add(inv_destino)
            self.session.commit()
            self.session.refresh(inv_destino)
            
        inv_destino.existencia_actual += det.cantidad
        self.session.add(inv_destino)
        
        mov_entrada = MovimientoInventario(
            inventario_id=inv_destino.id,
            tipo_movimiento="transferencia",
            cantidad=det.cantidad,
            motivo=f"Recepcion transferencia #{transfer.id}",
            usuario_id=usr.id
        )
        self.session.add(mov_entrada)
        transfer.estado = "recibida"
        self.session.add(transfer)
        self.session.commit()
        
        # Verificar stock en destino (4.0)
        self.session.refresh(inv_destino)
        self.assertEqual(inv_destino.existencia_actual, 4.0)
        self.assertEqual(transfer.estado, "recibida")

    def test_billing_simulation(self):
        # Crear factura electrónica para una venta
        from backend.database.schema import FacturaElectronica, MovimientoInventario
        
        usr = self.session.exec(select(Usuario).where(Usuario.username == "admin_test")).first()
        p = self.session.exec(select(Producto).where(Producto.sku == "T-PROD-01")).first()
        
        # Registrar Venta
        venta = Venta(
            sucursal_id=usr.sucursal_id,
            caja_id=1,
            usuario_id=usr.id,
            consecutivo="FAC-BILL-001",
            total=1500.0,
            tipo_documento="factura"
        )
        self.session.add(venta)
        self.session.commit()
        self.session.refresh(venta)
        
        det = DetalleVenta(
            venta_id=venta.id,
            producto_id=p.id,
            cantidad=1.0,
            precio_unitario=1500.0
        )
        self.session.add(det)
        self.session.commit()
        
        # Crear Factura Electrónica
        fe = FacturaElectronica(
            venta_id=venta.id,
            clave="506060626000310199999900100001010000000001112345678",
            consecutivo="00100001010000000001",
            estado_hacienda="Aceptado",
            fecha_envio=datetime.utcnow(),
            xml_enviado="<xml_envio></xml_envio>",
            xml_respuesta="<xml_respuesta></xml_respuesta>"
        )
        self.session.add(fe)
        self.session.commit()
        self.session.refresh(fe)
        
        self.assertEqual(fe.estado_hacienda, "Aceptado")
        
        # Anulación con Nota de Crédito (Tipo 03)
        fe.estado_hacienda = "Anulada"
        self.session.add(fe)
        
        venta.estado = "anulada"
        self.session.add(venta)
        
        # Devolver stock
        inv = self.session.exec(select(Inventario).where(
            Inventario.producto_id == p.id,
            Inventario.sucursal_id == usr.sucursal_id
        )).first()
        inv.existencia_actual += det.cantidad
        self.session.add(inv)
        self.session.commit()
        
        self.session.refresh(fe)
        self.session.refresh(venta)
        self.session.refresh(inv)
        
        self.assertEqual(fe.estado_hacienda, "Anulada")
        self.assertEqual(venta.estado, "anulada")
        self.assertEqual(inv.existencia_actual, 11.0)

if __name__ == "__main__":
    unittest.main()
