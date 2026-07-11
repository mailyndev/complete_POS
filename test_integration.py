import urllib.request
import json
import time
import random

BASE_URL = "http://127.0.0.1:8000/api"

def make_request(url, method="GET", data=None, token=None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
        
    req_data = json.dumps(data).encode("utf-8") if data is not None else None
    req = urllib.request.Request(url, data=req_data, headers=headers, method=method)
    
    try:
        resp = urllib.request.urlopen(req)
        return resp.status, json.loads(resp.read().decode("utf-8"))
    except urllib.request.HTTPError as e:
        try:
            err_body = json.loads(e.read().decode("utf-8"))
        except:
            err_body = e.reason
        return e.code, err_body
    except Exception as e:
        return 0, str(e)

def run_tests():
    print("=== STARTING INTEGRATION TESTS ===")
    
    # Generate random unique values for repeat runs
    rand_suffix = str(random.randint(100000, 999999))
    test_sku = f"T-INT-{rand_suffix}"
    test_barcode = f"999{rand_suffix}"
    test_client_id = f"1{rand_suffix}"
    test_invoice = f"COMP-INT-{rand_suffix}"
    
    # 1. TEST LOGIN
    # 1.1 Correct Login
    code, res = make_request(f"{BASE_URL}/auth/login", "POST", {"username": "admin", "password": "admin123"})
    if code != 200:
        print(f"FAIL: Login correcto falló con código {code}. Error: {res}")
        return
    token = res["access_token"]
    print("PASS: Login correcto exitoso!")
    
    # 1.2 Incorrect Login
    code, res = make_request(f"{BASE_URL}/auth/login", "POST", {"username": "admin", "password": "wrongpassword"})
    if code == 401 or code == 400:
        print("PASS: Login incorrecto rechazado exitosamente!")
    else:
        print(f"FAIL: Login incorrecto retornó código inesperado {code}. Res: {res}")
        return

    # 2. CAJA OPENING
    # Check if open
    code, res = make_request(f"{BASE_URL}/cash/status", "GET", token=token)
    if code != 200:
        print(f"FAIL: Obtener estado de caja falló: {res}")
        return
        
    if not res["open"]:
        print("Caja cerrada. Abriendo caja con CRC 50,000...")
        code_open, res_open = make_request(f"{BASE_URL}/cash/open", "POST", {"monto_inicial": 50000, "caja_id": 1}, token=token)
        if code_open != 200:
            print(f"FAIL: Apertura de caja falló: {res_open}")
            return
        print("PASS: Caja abierta exitosamente!")
    else:
        print("Caja ya estaba abierta.")

    # 3. INVENTORY CRUD
    # 3.1 Create Product
    prod_payload = {
        "sku": test_sku,
        "codigo_barras": test_barcode,
        "nombre": "Queso Turrialba Premium",
        "marca_id": 1,
        "subcategoria_id": 1,
        "impuesto_id": 1,
        "precio_costo": 1800.0,
        "precio_venta": 2500.0,
        "precio_mayorista": 2300.0,
        "stock_minimo": 5.0,
        "stock_maximo": 50.0,
        "unidad_medida": "Unidad",
        "descripcion": "Queso fresco tipo Turrialba de alta calidad"
    }
    code, res = make_request(f"{BASE_URL}/inventory/products", "POST", prod_payload, token=token)
    if code != 201:
        print(f"FAIL: Creación de producto falló: {res}")
        return
    prod_id = res["id"]
    print(f"PASS: Producto creado exitosamente! ID: {prod_id}")
    
    # 3.2 Edit Product
    edit_payload = {
        "precio_venta": 2600.0,
        "nombre": "Queso Turrialba Premium Editado",
        "motivo_cambio_precio": "Ajuste de margen comercial"
    }
    code, res = make_request(f"{BASE_URL}/inventory/products/{prod_id}", "PUT", edit_payload, token=token)
    if code != 200:
        print(f"FAIL: Edición de producto falló: {res}")
        return
    print("PASS: Producto editado exitosamente!")
    
    # Verify edit
    code, res = make_request(f"{BASE_URL}/inventory/products", "GET", token=token)
    matched_prod = next((p for p in res if p["id"] == prod_id), None)
    if not matched_prod or matched_prod["precio_venta"] != 2600.0 or matched_prod["nombre"] != "Queso Turrialba Premium Editado":
        print(f"FAIL: Verificación de edición falló. Producto: {matched_prod}")
        return
    print("PASS: Cambios del producto confirmados en base de datos!")

    # 4. CLIENTS CRUD
    # 4.1 Create Client
    client_payload = {
        "identificacion": test_client_id,
        "nombre": "Esteban Alvarado",
        "telefono": "8888-1111",
        "correo": "esteban@correo.com",
        "limite_credito": 20000.0,
        "direccion": "San José, Costa Rica"
    }
    code, res = make_request(f"{BASE_URL}/clients", "POST", client_payload, token=token)
    if code != 201:
        print(f"FAIL: Creación de cliente falló: {res}")
        return
    client_id = res["id"]
    print(f"PASS: Cliente creado exitosamente! ID: {client_id}")
    
    # 4.2 Edit Client
    client_edit = {
        "nombre": "Esteban Alvarado Editado",
        "limite_credito": 25000.0
    }
    code, res = make_request(f"{BASE_URL}/clients/{client_id}", "PUT", client_edit, token=token)
    if code != 200:
        print(f"FAIL: Edición de cliente falló: {res}")
        return
    print("PASS: Cliente editado exitosamente!")

    # 5. PURCHASES (STOCK INCREMENT)
    # Register purchase of 20 units of TEST-INT-01
    purchase_payload = {
        "proveedor_id": 1,
        "numero_factura": test_invoice,
        "items": [
            {
                "producto_id": prod_id,
                "cantidad": 20,
                "costo_unitario": 1800.0
            }
        ]
    }
    code, res = make_request(f"{BASE_URL}/purchases", "POST", purchase_payload, token=token)
    if code != 201:
        print(f"FAIL: Registro de compra falló: {res}")
        return
    print("PASS: Compra registrada exitosamente!")
    
    # Verify stock increased to 20
    code, res = make_request(f"{BASE_URL}/inventory/products", "GET", token=token)
    matched_prod = next((p for p in res if p["id"] == prod_id), None)
    if not matched_prod or matched_prod["existencia"] != 20.0:
        print(f"FAIL: Verificación de stock post-compra falló: {matched_prod}")
        return
    print("PASS: Stock incrementado a 20 unidades en inventario!")

    # 6. POS SALE (STOCK DECREMENT & TICKET)
    # Register sale of 2 units of TEST-INT-01
    sale_payload = {
        "cliente_id": client_id,
        "descuento": 0.0,
        "items": [
            {
                "producto_id": prod_id,
                "cantidad": 2.0,
                "precio_unitario": 2600.0
            }
        ],
        "pagos": [
            {
                "metodo_pago": "efectivo",
                "monto": 5200.0
            }
        ]
    }
    code, res = make_request(f"{BASE_URL}/pos/sales", "POST", sale_payload, token=token)
    if code != 201:
        print(f"FAIL: Registro de venta falló: {res}")
        return
    print("PASS: Venta registrada exitosamente! Consecutivo: " + res["consecutivo"])
    
    # Verify stock decremented to 18
    code, res = make_request(f"{BASE_URL}/inventory/products", "GET", token=token)
    matched_prod = next((p for p in res if p["id"] == prod_id), None)
    if not matched_prod or matched_prod["existencia"] != 18.0:
        print(f"FAIL: Verificación de stock post-venta falló: {matched_prod}")
        return
    print("PASS: Stock decrementado correctamente a 18 unidades!")

    # 7. CAJA MOVE & ADJUSTMENTS
    # Register cash outflow of 5,000
    adjust_payload = {
        "tipo_movimiento": "pago_menor",
        "monto": 5000.0,
        "descripcion": "Pago de flete local"
    }
    code, res = make_request(f"{BASE_URL}/cash/transaction", "POST", adjust_payload, token=token)
    if code != 200:
        print(f"FAIL: Registro de movimiento de caja falló: {res}")
        return
    print("PASS: Ajuste de caja (egreso) registrado exitosamente!")

    # 8. CAJA CLOSE
    # Close caja
    # Initial: 50,000 + Sale: 5,200 - Outflow: 5,000 = 50,200 expected
    close_payload = {
        "monto_final_efectivo": 50200.0,
        "monto_final_tarjeta": 0.0,
        "monto_final_transferencia": 0.0,
        "observaciones": "Cierre de turno correcto en pruebas integradas"
    }
    code, res = make_request(f"{BASE_URL}/cash/close", "POST", close_payload, token=token)
    if code != 200:
        print(f"FAIL: Cierre de caja falló: {res}")
        return
    print("PASS: Caja cerrada exitosamente! Diferencia arqueo: " + str(res.get("diferencia", 0.0)))

    # 9. INVENTORY DELETE PRODUCT
    # Delete test product
    code, res = make_request(f"{BASE_URL}/inventory/products/{prod_id}", "DELETE", token=token)
    # Note: Product has transactions (the purchase and the sale), so it should be soft-deleted (deactivated) successfully
    if code == 200:
        print("PASS: Eliminación lógica (desactivación) de producto con transacciones exitosa!")
    else:
        print(f"FAIL: Se esperaba código 200 para eliminación lógica, se obtuvo {code}: {res}")
        return

    # Delete related sale and purchase to clean up so we can test clean deletion (or just test delete of a fresh product)
    # Let's create a fresh product and delete it!
    rand_id = str(random.randint(100000, 999999))
    fresh_prod_payload = {
        "sku": f"TEST-INT-FRESH-{rand_id}",
        "codigo_barras": f"999111999-{rand_id}",
        "nombre": f"Producto para Borrar {rand_id}",
        "marca_id": 1,
        "subcategoria_id": 1,
        "impuesto_id": 1,
        "precio_costo": 100.0,
        "precio_venta": 200.0,
        "precio_mayorista": 180.0,
        "stock_minimo": 1.0,
        "stock_maximo": 10.0,
        "unidad_medida": "Unidad",
        "descripcion": "Temporal"
    }
    code, res = make_request(f"{BASE_URL}/inventory/products", "POST", fresh_prod_payload, token=token)
    if code != 201:
        print(f"FAIL: Creación de producto temporal falló: {res}")
        return
    fresh_id = res["id"]
    
    code, res = make_request(f"{BASE_URL}/inventory/products/{fresh_id}", "DELETE", token=token)
    if code != 200:
        print(f"FAIL: Eliminación de producto temporal falló: {res}")
        return
    print("PASS: Producto temporal sin transacciones eliminado exitosamente!")

    print("\n=== ALL INTEGRATION TESTS PASSED SUCCESSFULLY! ===")

if __name__ == "__main__":
    # Wait a moment for server to run if starting first time
    time.sleep(1.0)
    run_tests()
