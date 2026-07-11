import os
from datetime import datetime
from fpdf import FPDF

class CustomPDF(FPDF):
    def header(self):
        # We can implement a clean layout, but let FPDF do most layout inside functions
        pass

    def footer(self):
        # Page number
        self.set_y(-15)
        self.set_font("Helvetica", "I", 8)
        self.cell(0, 10, f"Pagina {self.page_no()}/{{nb}}", align="C")

def generate_ticket_pdf(empresa, venta, filename):
    pdf = FPDF(format="letter", unit="mm")
    pdf.alias_nb_pages()
    pdf.add_page()
    pdf.set_font("Helvetica", "B", 16)
    
    # Title
    pdf.cell(0, 8, empresa.nombre_comercial, align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 10)
    pdf.cell(0, 5, empresa.razon_social, align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.cell(0, 5, f"Cedula Juridica: {empresa.cedula_juridica}", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.cell(0, 5, f"Direccion: {empresa.direccion}", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.cell(0, 5, f"Tel: {empresa.telefonos} | Email: {empresa.correo}", align="C", new_x="LMARGIN", new_y="NEXT")
    if hasattr(empresa, "sitio_web") and empresa.sitio_web:
        pdf.cell(0, 5, f"Web: {empresa.sitio_web}", align="C", new_x="LMARGIN", new_y="NEXT")
        
    pdf.ln(5)
    pdf.line(10, pdf.get_y(), 200, pdf.get_y())
    pdf.ln(5)
    
    # Venta details
    pdf.set_font("Helvetica", "B", 10)
    pdf.cell(40, 5, f"CONSECUTIVO:")
    pdf.set_font("Helvetica", "", 10)
    pdf.cell(60, 5, venta.consecutivo)
    pdf.set_font("Helvetica", "B", 10)
    pdf.cell(30, 5, f"FECHA:")
    pdf.set_font("Helvetica", "", 10)
    pdf.cell(0, 5, venta.fecha_venta.strftime("%Y-%m-%d %H:%M:%S"), new_x="LMARGIN", new_y="NEXT")
    
    pdf.set_font("Helvetica", "B", 10)
    pdf.cell(40, 5, f"CAJERO:")
    pdf.set_font("Helvetica", "", 10)
    pdf.cell(60, 5, venta.usuario.nombre if venta.usuario else "Sistema")
    pdf.set_font("Helvetica", "B", 10)
    pdf.cell(30, 5, f"DOCUMENTO:")
    pdf.set_font("Helvetica", "", 10)
    pdf.cell(0, 5, venta.tipo_documento.upper(), new_x="LMARGIN", new_y="NEXT")
    
    pdf.set_font("Helvetica", "B", 10)
    pdf.cell(40, 5, f"CLIENTE:")
    pdf.set_font("Helvetica", "", 10)
    pdf.cell(0, 5, venta.cliente.nombre if venta.cliente else "Cliente General", new_x="LMARGIN", new_y="NEXT")
    
    pdf.ln(5)
    pdf.line(10, pdf.get_y(), 200, pdf.get_y())
    pdf.ln(5)
    
    # Products Table Header
    pdf.set_font("Helvetica", "B", 10)
    pdf.cell(80, 6, "Descripcion", border=1)
    pdf.cell(25, 6, "Cant.", border=1, align="C")
    pdf.cell(30, 6, "Precio Unit.", border=1, align="R")
    pdf.cell(25, 6, "Desc.", border=1, align="R")
    pdf.cell(30, 6, "Total", border=1, align="R", new_x="LMARGIN", new_y="NEXT")
    
    pdf.set_font("Helvetica", "", 10)
    for d in venta.detalles:
        desc_total = d.cantidad * d.descuento_unitario
        item_total = d.cantidad * (d.precio_unitario - d.descuento_unitario)
        pdf.cell(80, 6, d.producto.nombre[:38], border=1)
        
        is_weight = d.producto.unidad_medida and d.producto.unidad_medida.lower() in ["kilogramo", "kg", "libra", "lb", "gramo", "g"]
        qty_str = f"{d.cantidad:.3f}" if is_weight else (f"{d.cantidad:.0f}" if d.cantidad.is_integer() else f"{d.cantidad:.2f}")
        
        pdf.cell(25, 6, qty_str, border=1, align="C")
        pdf.cell(30, 6, f"CRC {d.precio_unitario:.2f}", border=1, align="R")
        pdf.cell(25, 6, f"CRC {desc_total:.2f}", border=1, align="R")
        pdf.cell(30, 6, f"CRC {item_total:.2f}", border=1, align="R", new_x="LMARGIN", new_y="NEXT")
        
    pdf.ln(5)
    
    # Summary
    pdf.set_font("Helvetica", "B", 10)
    pdf.cell(135, 6, "")
    pdf.cell(25, 6, "Subtotal:")
    pdf.set_font("Helvetica", "", 10)
    pdf.cell(30, 6, f"CRC {venta.subtotal:.2f}", align="R", new_x="LMARGIN", new_y="NEXT")
    
    pdf.set_font("Helvetica", "B", 10)
    pdf.cell(135, 6, "")
    pdf.cell(25, 6, "Descuento:")
    pdf.set_font("Helvetica", "", 10)
    pdf.cell(30, 6, f"CRC {venta.descuento:.2f}", align="R", new_x="LMARGIN", new_y="NEXT")
    
    pdf.set_font("Helvetica", "B", 10)
    pdf.cell(135, 6, "")
    pdf.cell(25, 6, "Impuestos:")
    pdf.set_font("Helvetica", "", 10)
    pdf.cell(30, 6, f"CRC {venta.impuesto:.2f}", align="R", new_x="LMARGIN", new_y="NEXT")
    
    pdf.set_font("Helvetica", "B", 12)
    pdf.cell(135, 6, "")
    pdf.cell(25, 6, "TOTAL:")
    pdf.set_font("Helvetica", "B", 12)
    pdf.cell(30, 6, f"CRC {venta.total:.2f}", align="R", new_x="LMARGIN", new_y="NEXT")
    
    pdf.ln(5)
    pdf.line(10, pdf.get_y(), 200, pdf.get_y())
    pdf.ln(5)
    
    # Payments
    pdf.set_font("Helvetica", "B", 10)
    pdf.cell(0, 5, "Detalle de Pagos:", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 10)
    for p in venta.pagos:
        pdf.cell(60, 5, f"- Metodo: {p.metodo_pago.upper()}")
        pdf.cell(0, 5, f"Monto: CRC {p.monto:.2f}", new_x="LMARGIN", new_y="NEXT")
        
    pdf.ln(10)
    pdf.set_font("Helvetica", "I", 10)
    pdf.cell(0, 5, "Gracias por su compra en Minisuper M Y M!", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.cell(0, 5, "Autorizado mediante resolucion DGT-R-033-2019", align="C", new_x="LMARGIN", new_y="NEXT")
    
    # Ensure dir exists
    os.makedirs(os.path.dirname(filename), exist_ok=True)
    pdf.output(filename)

def generate_inventory_pdf(empresa, items, filter_type, filename):
    pdf = CustomPDF(format="letter", unit="mm")
    pdf.alias_nb_pages()
    pdf.add_page()
    
    # Title & Header
    pdf.set_font("Helvetica", "B", 16)
    pdf.cell(0, 10, empresa.nombre_comercial, align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "B", 12)
    pdf.cell(0, 6, f"REPORTE DE INVENTARIO - Filtro: {filter_type.upper()}", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 8)
    pdf.cell(0, 4, f"Generado: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", align="C", new_x="LMARGIN", new_y="NEXT")
    
    pdf.ln(5)
    pdf.line(10, pdf.get_y(), 200, pdf.get_y())
    pdf.ln(5)
    
    # Table Header
    pdf.set_font("Helvetica", "B", 8)
    pdf.cell(30, 6, "SKU", border=1)
    pdf.cell(30, 6, "Codigo Barras", border=1)
    pdf.cell(50, 6, "Nombre Producto", border=1)
    pdf.cell(20, 6, "Marca", border=1)
    pdf.cell(18, 6, "Exist.", border=1, align="C")
    pdf.cell(22, 6, "Costo Unit.", border=1, align="R")
    pdf.cell(22, 6, "Precio Venta", border=1, align="R")
    pdf.cell(0, 6, "Estado", border=1, align="C", new_x="LMARGIN", new_y="NEXT")
    
    # Table Content
    pdf.set_font("Helvetica", "", 7.5)
    for it in items:
        status_str = "Activo" if it["activo"] else "Inactivo"
        pdf.cell(30, 5, it["sku"][:16], border=1)
        pdf.cell(30, 5, it["codigo_barras"][:16], border=1)
        pdf.cell(50, 5, it["nombre"][:24], border=1)
        pdf.cell(20, 5, it["marca"][:10], border=1)
        pdf.cell(18, 5, f"{it['existencia']:.2f}", border=1, align="C")
        pdf.cell(22, 5, f"CRC {it['precio_costo']:.2f}", border=1, align="R")
        pdf.cell(22, 5, f"CRC {it['precio_venta']:.2f}", border=1, align="R")
        pdf.cell(0, 5, status_str, border=1, align="C", new_x="LMARGIN", new_y="NEXT")
        
    os.makedirs(os.path.dirname(filename), exist_ok=True)
    pdf.output(filename)
