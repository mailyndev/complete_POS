import { API } from "./api.js";
import { App } from "./app.js";

let itemsPurchaseList = [];
let providersList = [];
let inventoryProducts = [];
let editingProviderId = null;
let activeCxpId = null;

export async function renderPurchases(container) {
  // Inyectar estilos para el spinner y el mapeo OCR si no existen
  if (!document.getElementById("pur-ocr-styles")) {
    const style = document.createElement("style");
    style.id = "pur-ocr-styles";
    style.textContent = `
      @keyframes pur-spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      .pur-spinner {
        border: 4px solid var(--border-color);
        border-top: 4px solid var(--brand-color);
        border-radius: 50%;
        width: 36px;
        height: 36px;
        animation: pur-spin 0.8s linear infinite;
      }
    `;
    document.head.appendChild(style);
  }

  container.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 24px;">
      
      <!-- Cabecera y Tabs -->
      <div class="flex-between">
        <div style="display: flex; gap: 16px; border-bottom: 1px solid var(--border-color); padding-bottom: 8px;">
          <button class="category-tab active" id="tab-purchase-new">Registrar Recepción (Compra)</button>
          <button class="category-tab" id="tab-purchase-cxp">Cuentas por Pagar</button>
          <button class="category-tab" id="tab-purchase-providers">Directorio de Proveedores</button>
        </div>
        <button id="btn-create-provider" class="btn btn-primary" style="display:none;">➕ Nuevo Proveedor</button>
      </div>

      <!-- Barra de Filtros y Búsqueda para Proveedores y Cuentas por Pagar -->
      <div id="purchases-controls-bar" class="dashboard-panel" style="padding: 16px; display: none; flex-wrap: wrap; gap: 16px; align-items: center;">
        <div class="form-group" style="margin-bottom:0; flex-direction: row; gap: 12px; align-items: center; flex: 1;">
          <input type="text" id="purchases-search-input" class="input-field" placeholder="Buscar..." style="max-width: 320px;">
          <button id="purchases-search-btn" class="btn btn-secondary">🔍 Buscar</button>
        </div>
        
        <!-- Filtros específicos para Cuentas por Pagar -->
        <div id="cxp-filters" style="display: none; gap: 12px; align-items: center;">
          <select id="cxp-filter-estado" class="input-field" style="width: 150px;">
            <option value="">Todos los estados</option>
            <option value="pendiente">Pendiente</option>
            <option value="pagada">Pagada</option>
            <option value="anulado">Anulado</option>
          </select>
        </div>

        <!-- Filtros específicos para Proveedores -->
        <div id="providers-filters" style="display: none; align-items: center; gap: 8px;">
          <label style="display: flex; align-items: center; gap: 8px; font-size: 0.9rem; cursor: pointer; user-select: none;">
            <input type="checkbox" id="prov-show-inactive"> 🗑️ Ver Papelera (Inactivos)
          </label>
        </div>
      </div>

      <!-- CUERPO DE CONTENEDOR SEGÚN PESTAÑA -->
      <div id="purchases-tab-body">
        <!-- Rellenado dinámicamente -->
      </div>

    </div>

    <!-- MODAL: CREAR / EDITAR PROVEEDOR -->
    <div id="provider-form-modal" class="modal-wrapper">
      <div class="modal-card">
        <div class="modal-header">
          <h3 id="provider-modal-title">Registrar Nuevo Proveedor</h3>
          <button class="close-btn" onclick="document.getElementById('provider-form-modal').classList.remove('active')">&times;</button>
        </div>
        <div class="modal-body" style="display: flex; flex-direction: column; gap: 16px;">
          <div class="grid-cols-2">
            <div class="form-group">
              <label>Identificación (RUC / Cédula)</label>
              <input type="text" id="prov-identificacion" class="input-field" placeholder="ej. 3-101-987654" required>
            </div>
            <div class="form-group">
              <label>Razón Social (Nombre)</label>
              <input type="text" id="prov-nombre" class="input-field" placeholder="ej. Distribuidora Fenix S.A." required>
            </div>
          </div>
          <div class="grid-cols-2">
            <div class="form-group">
              <label>Nombre de Contacto</label>
              <input type="text" id="prov-contacto" class="input-field" placeholder="ej. Carlos Mendoza">
            </div>
            <div class="form-group">
              <label>Teléfono</label>
              <input type="text" id="prov-telefono" class="input-field" placeholder="ej. 2222-3333">
            </div>
          </div>
          <div class="grid-cols-2">
            <div class="form-group">
              <label>Correo Electrónico</label>
              <input type="email" id="prov-correo" class="input-field" placeholder="ej. contacto@distfenix.com">
            </div>
            <div class="form-group" id="prov-active-container" style="display:none;">
              <label>Estado del Proveedor</label>
              <select id="prov-activo" class="input-field">
                <option value="true">Activo</option>
                <option value="false">Inactivo</option>
              </select>
            </div>
          </div>
          <div class="form-group">
            <label>Dirección Oficina</label>
            <input type="text" id="prov-direccion" class="input-field" placeholder="ej. San José, Costa Rica">
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="document.getElementById('provider-form-modal').classList.remove('active')">Cancelar</button>
          <button id="save-provider-btn" class="btn btn-primary">Guardar Proveedor</button>
        </div>
      </div>
    </div>

    <!-- MODAL: REGISTRAR PAGO A CUENTA POR PAGAR -->
    <div id="cxp-pay-modal" class="modal-wrapper">
      <div class="modal-card">
        <div class="modal-header">
          <h3>Registrar Pago a Proveedor</h3>
          <button class="close-btn" onclick="document.getElementById('cxp-pay-modal').classList.remove('active')">&times;</button>
        </div>
        <div class="modal-body" style="display: flex; flex-direction: column; gap: 16px;">
          <div class="form-group">
            <label>Proveedor</label>
            <input type="text" id="cxp-pay-provider" class="input-field" readonly style="background-color: var(--bg-tertiary);">
          </div>
          <div class="grid-cols-2">
            <div class="form-group">
              <label>Saldo Pendiente (₡)</label>
              <input type="text" id="cxp-pay-debt" class="input-field" readonly style="background-color: var(--bg-tertiary);">
            </div>
            <div class="form-group">
              <label>Monto a Pagar (₡)</label>
              <input type="number" id="cxp-pay-amount" class="input-field" placeholder="₡0.00" step="0.01">
            </div>
          </div>
          <div class="grid-cols-2">
            <div class="form-group">
              <label>Método de Pago</label>
              <select id="cxp-pay-metodo" class="input-field">
                <option value="efectivo">Efectivo</option>
                <option value="tarjeta">Tarjeta</option>
                <option value="transferencia">Transferencia</option>
                <option value="sinpe">SINPE Móvil</option>
              </select>
            </div>
            <div class="form-group" style="justify-content: center; display: flex; align-items: center; margin-top: 24px;">
              <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; user-select: none;">
                <input type="checkbox" id="cxp-pay-send-email" checked> Enviar Notificación Email
              </label>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="document.getElementById('cxp-pay-modal').classList.remove('active')">Cancelar</button>
          <button id="save-cxp-pay-btn" class="btn btn-primary">Registrar Pago</button>
        </div>
      </div>
    </div>

    <!-- MODAL: MAPEO DE PRODUCTOS OCR -->
    <div id="pur-ocr-mapping-modal" class="modal-wrapper">
      <div class="modal-card" style="width: 750px; max-width: 90%;">
        <div class="modal-header">
          <h3>Asociación de Productos Encontrados</h3>
          <button class="close-btn" onclick="document.getElementById('pur-ocr-mapping-modal').classList.remove('active')">&times;</button>
        </div>
        <div class="modal-body" style="display: flex; flex-direction: column; gap: 16px;">
          <p style="font-size: 0.9rem; color: var(--text-secondary);">
            Se leyeron los siguientes productos en el documento. Por favor, confirme a qué producto del catálogo corresponde cada uno o elija crearlo como nuevo:
          </p>
          <div class="table-container" style="max-height: 350px; overflow-y: auto; margin-top: 0;">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Fila Factura</th>
                  <th>Cant.</th>
                  <th>Costo</th>
                  <th>Asociar a Producto Local</th>
                </tr>
              </thead>
              <tbody id="ocr-mapping-table-body">
                <!-- Se rellena dinámicamente -->
              </tbody>
            </table>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="document.getElementById('pur-ocr-mapping-modal').classList.remove('active')">Cancelar</button>
          <button id="ocr-mapping-confirm-btn" class="btn btn-primary">Cargar en Factura</button>
        </div>
      </div>
    </div>
  `;

  // Controladores de Pestañas
  const tabNew = document.getElementById("tab-purchase-new");
  const tabCxp = document.getElementById("tab-purchase-cxp");
  const tabProviders = document.getElementById("tab-purchase-providers");
  const btnCreateProv = document.getElementById("btn-create-provider");
  const controlsBar = document.getElementById("purchases-controls-bar");
  const cxpFilters = document.getElementById("cxp-filters");
  const providersFilters = document.getElementById("providers-filters");
  const searchInput = document.getElementById("purchases-search-input");

  tabNew.addEventListener("click", () => {
    tabCxp.classList.remove("active");
    tabProviders.classList.remove("active");
    tabNew.classList.add("active");
    btnCreateProv.style.display = "none";
    controlsBar.style.display = "none";
    renderNewPurchaseForm();
  });

  tabCxp.addEventListener("click", () => {
    tabNew.classList.remove("active");
    tabProviders.classList.remove("active");
    tabCxp.classList.add("active");
    btnCreateProv.style.display = "none";
    controlsBar.style.display = "flex";
    cxpFilters.style.display = "flex";
    providersFilters.style.display = "none";
    searchInput.placeholder = "Buscar factura o proveedor...";
    searchInput.value = "";
    renderCxpList();
  });

  tabProviders.addEventListener("click", () => {
    tabNew.classList.remove("active");
    tabCxp.classList.remove("active");
    tabProviders.classList.add("active");
    btnCreateProv.style.display = "block";
    controlsBar.style.display = "flex";
    cxpFilters.style.display = "none";
    providersFilters.style.display = "flex";
    searchInput.placeholder = "Buscar proveedor...";
    searchInput.value = "";
    renderProvidersList();
  });

  // Buscador click y enter
  document.getElementById("purchases-search-btn").onclick = () => {
    if (tabProviders.classList.contains("active")) {
      renderProvidersList();
    } else if (tabCxp.classList.contains("active")) {
      renderCxpList();
    }
  };

  searchInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      if (tabProviders.classList.contains("active")) {
        renderProvidersList();
      } else if (tabCxp.classList.contains("active")) {
        renderCxpList();
      }
    }
  });

  document.getElementById("cxp-filter-estado").onchange = () => {
    renderCxpList();
  };

  document.getElementById("prov-show-inactive").onchange = () => {
    renderProvidersList();
  };

  // Crear Proveedor
  btnCreateProv.onclick = () => {
    editingProviderId = null;
    document.getElementById("provider-modal-title").textContent = "Registrar Nuevo Proveedor";
    document.getElementById("prov-identificacion").value = "";
    document.getElementById("prov-nombre").value = "";
    document.getElementById("prov-contacto").value = "";
    document.getElementById("prov-telefono").value = "";
    document.getElementById("prov-correo").value = "";
    document.getElementById("prov-direccion").value = "";
    document.getElementById("prov-active-container").style.display = "none";
    App.openModal("provider-form-modal");
  };

  document.getElementById("save-provider-btn").onclick = saveProvider;
  document.getElementById("save-cxp-pay-btn").onclick = saveCxpPayment;
  document.getElementById("ocr-mapping-confirm-btn").onclick = processOcrMapping;

  // Cargar Formulario de compra por defecto
  renderNewPurchaseForm();
}

async function renderNewPurchaseForm() {
  const container = document.getElementById("purchases-tab-body");
  if (!container) return;

  itemsPurchaseList = [];

  container.innerHTML = `
    <div style="display: grid; grid-template-columns: 1fr 340px; gap: 24px;">
      
      <!-- Lado Izquierdo: Formulario de Orden de Compra y Tabla de Items -->
      <div class="dashboard-panel" style="display:flex; flex-direction:column; gap:20px;">
        <div class="panel-header" style="margin-bottom:0;">
          <h3>Ingreso de Factura de Compra</h3>
        </div>

        <!-- Carga y Procesamiento Inteligente de Facturas (OCR/IA) -->
        <div class="dashboard-panel" style="background-color: var(--bg-secondary); border: 2px dashed var(--border-color); padding: 16px; border-radius: var(--radius-md); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; cursor: pointer; text-align: center; position: relative;" id="pur-ocr-dropzone">
          <span style="font-size: 2.2rem; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1));">📄</span>
          <div>
            <h4 style="font-size: 0.95rem; font-weight: 700; margin-bottom: 4px; color: var(--text-primary);">Autocompletar Factura con IA / OCR</h4>
            <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0;">Arrastre o seleccione la foto de la factura (PNG, JPG), PDF o XML de Hacienda</p>
          </div>
          <input type="file" id="pur-ocr-file-input" accept=".xml, .pdf, .docx, .png, .jpg, .jpeg" style="display: none;">
          <button type="button" class="btn btn-secondary" style="font-size: 0.8rem; padding: 6px 12px; border-color: var(--border-color);" onclick="document.getElementById('pur-ocr-file-input').click()">📁 Cargar Documento</button>
        </div>
        
        <!-- Cabecera de Compra -->
        <div class="grid-cols-3">
          <div class="form-group">
            <label>Proveedor</label>
            <select id="pur-provider-select" class="input-field">
              <option value="">Seleccione un proveedor...</option>
            </select>
          </div>
          <div class="form-group">
            <label>Número de Factura de Compra</label>
            <input type="text" id="pur-invoice-number" class="input-field" placeholder="ej. FAC-PROV-10294">
          </div>
          <div class="form-group">
            <label>Condición de Pago</label>
            <select id="pur-condicion-pago" class="input-field">
              <option value="pendiente">Crédito (Abonar luego)</option>
              <option value="pagada">Contado (Pagado ya)</option>
            </select>
          </div>
        </div>

        <!-- Adición rápida de productos a la compra -->
        <div style="border-top:1px dashed var(--border-color); padding-top:16px;">
          <h4 style="font-size:0.85rem; font-weight:600; margin-bottom:8px; color:var(--text-secondary);">Añadir Fila de Producto</h4>
          <div style="display:grid; grid-template-columns: 1fr 100px 140px auto; gap:12px; align-items:flex-end;">
            <div class="form-group">
              <label>Seleccionar Producto</label>
              <select id="pur-add-product" class="input-field">
                <option value="">Buscar producto...</option>
              </select>
            </div>
            <div class="form-group">
              <label>Cantidad</label>
              <input type="number" id="pur-add-qty" class="input-field" value="10" placeholder="0">
            </div>
            <div class="form-group">
              <label>Costo Unitario (₡)</label>
              <input type="number" id="pur-add-cost" class="input-field" placeholder="₡0.00" step="0.01">
            </div>
            <button id="pur-add-row-btn" class="btn btn-secondary" style="height:45px;">Agregar Fila</button>
          </div>
        </div>

        <!-- Tabla de items cargados -->
        <div>
          <h4 style="font-size:0.9rem; font-weight:600; margin-bottom:10px;">Detalle de Mercancía Recibida</h4>
          <div class="table-container" style="margin-top:0;">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Producto / SKU</th>
                  <th>Cantidad</th>
                  <th>Costo Unitario</th>
                  <th>Total Fila</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody id="pur-items-table-body">
                <tr><td colspan="5" style="text-align: center; color:var(--text-muted);">Sin productos en el detalle de la compra.</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Lado Derecho: Resumen y Registro final -->
      <div class="dashboard-panel" style="display:flex; flex-direction:column; justify-content:space-between; height:fit-content; gap:24px;">
        <div>
          <div class="panel-header" style="margin-bottom:16px;">
            <h3>Resumen Financiero</h3>
          </div>
          <div style="display:flex; flex-direction:column; gap:12px;">
            <div class="flex-between" style="font-size:0.9rem; color:var(--text-secondary);">
              <span>Total de Items:</span>
              <span id="pur-summary-qty-count">0</span>
            </div>
            <div class="flex-between" style="font-size:0.9rem; color:var(--text-secondary);">
              <span>Subtotal Compra:</span>
              <span id="pur-summary-subtotal">₡0.00</span>
            </div>
            <div class="flex-between" style="font-size:1.4rem; font-weight:700; border-top:1px dashed var(--border-color); padding-top:12px; margin-top:12px;">
              <span>TOTAL COSTO:</span>
              <span id="pur-summary-total">₡0.00</span>
            </div>
          </div>
        </div>

        <button id="pur-submit-purchase-btn" class="btn btn-primary" style="width:100%; height:48px; font-size:1rem;">💾 Guardar Factura e Ingresar Inventario</button>
      </div>

    </div>
  `;

  try {
    providersList = await API.get("/purchases/providers");
    inventoryProducts = await API.get("/inventory/products");

    const selectProv = document.getElementById("pur-provider-select");
    const selectProd = document.getElementById("pur-add-product");

    if (selectProv) {
      selectProv.innerHTML = `<option value="">Seleccione un proveedor...</option>` +
        providersList.map(p => `<option value="${p.id}">${p.nombre}</option>`).join("");
    }

    if (selectProd) {
      selectProd.innerHTML = `<option value="">Buscar producto...</option>` +
        inventoryProducts.map(p => `<option value="${p.id}" data-cost="${p.precio_costo}">${p.nombre} [₡${p.precio_costo.toFixed(2)}]</option>`).join("");
      
      selectProd.addEventListener("change", () => {
        const selOpt = selectProd.options[selectProd.selectedIndex];
        const cost = parseFloat(selOpt.getAttribute("data-cost") || 0.0);
        const inputCost = document.getElementById("pur-add-cost");
        if (inputCost) inputCost.value = cost;
      });
    }

    document.getElementById("pur-add-row-btn").onclick = addRowToPurchase;
    document.getElementById("pur-submit-purchase-btn").onclick = submitPurchaseOrder;

    // Enlazar eventos de Drag & Drop y OCR file input
    const dropzone = document.getElementById("pur-ocr-dropzone");
    const fileInput = document.getElementById("pur-ocr-file-input");

    if (dropzone && fileInput) {
      ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropzone.addEventListener(eventName, (e) => {
          e.preventDefault();
          e.stopPropagation();
        }, false);
      });

      ['dragenter', 'dragover'].forEach(eventName => {
        dropzone.addEventListener(eventName, () => dropzone.style.borderColor = "var(--brand-color)", false);
      });

      ['dragleave', 'drop'].forEach(eventName => {
        dropzone.addEventListener(eventName, () => dropzone.style.borderColor = "var(--border-color)", false);
      });

      dropzone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files.length > 0) {
          handleOcrUpload(files[0]);
        }
      }, false);

      fileInput.addEventListener('change', () => {
        if (fileInput.files.length > 0) {
          handleOcrUpload(fileInput.files[0]);
        }
      });
    }

    renderPurchaseItemsTable();

  } catch (error) {
    App.showToast("Compras", "Error al inicializar formulario: " + error.message, "error");
  }
}

function addRowToPurchase() {
  const selectProd = document.getElementById("pur-add-product");
  const qtyInput = document.getElementById("pur-add-qty");
  const costInput = document.getElementById("pur-add-cost");

  if (!selectProd.value) {
    App.showToast("Error", "Seleccione un producto para agregar.", "warning");
    return;
  }

  const prodId = parseInt(selectProd.value);
  const qty = parseFloat(qtyInput.value) || 0;
  const cost = parseFloat(costInput.value) || 0;

  if (qty <= 0 || cost <= 0) {
    App.showToast("Error", "Cantidad y costo unitario deben ser mayores a cero.", "warning");
    return;
  }

  const product = inventoryProducts.find(p => p.id === prodId);
  if (!product) return;

  const existing = itemsPurchaseList.find(i => i.producto_id === prodId);
  if (existing) {
    existing.cantidad += qty;
    existing.costo_unitario = cost;
  } else {
    itemsPurchaseList.push({
      producto_id: prodId,
      nombre: product.nombre,
      sku: product.sku,
      cantidad: qty,
      costo_unitario: cost
    });
  }

  selectProd.value = "";
  qtyInput.value = "10";
  costInput.value = "";

  renderPurchaseItemsTable();
}

function renderPurchaseItemsTable() {
  const tbody = document.getElementById("pur-items-table-body");
  if (!tbody) return;

  if (itemsPurchaseList.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color:var(--text-muted);">Sin productos en el detalle de la compra.</td></tr>`;
    calculatePurchaseTotals();
    return;
  }

  tbody.innerHTML = "";
  itemsPurchaseList.forEach((item, index) => {
    const totalRow = item.cantidad * item.costo_unitario;
    tbody.innerHTML += `
      <tr data-index="${index}">
        <td><strong>${item.nombre}</strong><br><span style="font-size:0.75rem; color:var(--text-muted);">${item.sku}</span></td>
        <td>${item.cantidad}</td>
        <td>₡${item.costo_unitario.toLocaleString("es-CR", { minimumFractionDigits: 2 })}</td>
        <td><strong>₡${totalRow.toLocaleString("es-CR", { minimumFractionDigits: 2 })}</strong></td>
        <td><button class="btn-remove-pur-row" style="background:none; border:none; cursor:pointer; color:var(--error);">🗑️</button></td>
      </tr>
    `;
  });

  tbody.querySelectorAll(".btn-remove-pur-row").forEach(btn => {
    btn.onclick = () => {
      const idx = parseInt(btn.closest("tr").getAttribute("data-index"));
      itemsPurchaseList.splice(idx, 1);
      renderPurchaseItemsTable();
    };
  });

  calculatePurchaseTotals();
}

function calculatePurchaseTotals() {
  let count = 0;
  let total = 0;

  itemsPurchaseList.forEach(item => {
    count += item.cantidad;
    total += item.cantidad * item.costo_unitario;
  });

  const qtyEl = document.getElementById("pur-summary-qty-count");
  const subEl = document.getElementById("pur-summary-subtotal");
  const totEl = document.getElementById("pur-summary-total");

  if (qtyEl) qtyEl.textContent = count;
  if (subEl) subEl.textContent = `₡${total.toLocaleString("es-CR", { minimumFractionDigits: 2 })}`;
  if (totEl) totEl.textContent = `₡${total.toLocaleString("es-CR", { minimumFractionDigits: 2 })}`;
}

async function submitPurchaseOrder() {
  const providerSelect = document.getElementById("pur-provider-select");
  const invoiceInput = document.getElementById("pur-invoice-number");
  const condicionPago = document.getElementById("pur-condicion-pago").value;

  if (!providerSelect.value) {
    App.showToast("Error", "Seleccione un proveedor para la orden.", "warning");
    return;
  }

  const invoice = invoiceInput.value.trim();
  if (!invoice) {
    App.showToast("Error", "Ingrese el número de factura de compra.", "warning");
    return;
  }

  if (itemsPurchaseList.length === 0) {
    App.showToast("Error", "Debe agregar al menos un producto a la orden de compra.", "warning");
    return;
  }

  const payload = {
    proveedor_id: parseInt(providerSelect.value),
    numero_factura: invoice,
    estado: condicionPago,
    items: itemsPurchaseList.map(i => ({
      producto_id: i.producto_id,
      cantidad: i.cantidad,
      costo_unitario: i.costo_unitario
    }))
  };

  try {
    const btn = document.getElementById("pur-submit-purchase-btn");
    btn.disabled = true;
    btn.textContent = "Ingresando stock...";

    await API.post("/purchases", payload);
    App.showToast("Compra registrada", "La compra fue registrada, se ingresó el stock y se actualizó el historial.", "success");
    
    renderNewPurchaseForm();
    invoiceInput.value = "";
  } catch (error) {
    App.showToast("Error", error.message || "Fallo en registro de compra.", "error");
  } finally {
    const btn = document.getElementById("pur-submit-purchase-btn");
    if (btn) {
      btn.disabled = false;
      btn.textContent = "💾 Guardar Factura e Ingresar Inventario";
    }
  }
}

// --- DIRECCIONARIO DE PROVEEDORES ---

async function renderProvidersList() {
  const container = document.getElementById("purchases-tab-body");
  if (!container) return;

  container.innerHTML = `
    <div class="table-container" style="margin-top:0;">
      <table class="data-table">
        <thead>
          <tr>
            <th>Identificación</th>
            <th>Proveedor (Razón Social)</th>
            <th>Contacto</th>
            <th>Teléfono</th>
            <th>Correo Electrónico</th>
            <th>Dirección</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody id="providers-list-body">
          <tr><td colspan="7" style="text-align:center;">Cargando proveedores...</td></tr>
        </tbody>
      </table>
    </div>
  `;

  try {
    const searchVal = document.getElementById("purchases-search-input").value.trim();
    const showInactive = document.getElementById("prov-show-inactive").checked;
    
    const data = await API.get(`/purchases/providers?search=${encodeURIComponent(searchVal)}&include_inactive=${showInactive}`);
    const tbody = document.getElementById("providers-list-body");

    if (data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;">No hay proveedores registrados actualmente.</td></tr>`;
      return;
    }

    tbody.innerHTML = "";
    data.forEach(p => {
      const deleteBtn = p.activo 
        ? `<button class="btn btn-secondary btn-delete-provider" data-id="${p.id}" style="padding: 4px 8px; font-size: 0.75rem; background-color: var(--error); border-color: var(--error); color: white;">🗑️ Eliminar</button>`
        : `<button class="btn btn-secondary btn-activate-provider" data-id="${p.id}" style="padding: 4px 8px; font-size: 0.75rem; background-color: var(--success); border-color: var(--success); color: white;">🔄 Restaurar</button>`;

      tbody.innerHTML += `
        <tr>
          <td><strong>${p.identificacion}</strong></td>
          <td>${p.nombre} ${p.activo ? "" : '<span class="badge badge-danger">Inactivo</span>'}</td>
          <td>${p.contacto || "N/A"}</td>
          <td>${p.telefono || "N/A"}</td>
          <td>${p.correo || "N/A"}</td>
          <td>${p.direccion || "N/A"}</td>
          <td>
            <div style="display: flex; gap: 8px;">
              <button class="btn btn-primary btn-edit-provider" data-id="${p.id}" style="padding: 4px 8px; font-size: 0.75rem;">Editar</button>
              ${deleteBtn}
            </div>
          </td>
        </tr>
      `;
    });

    tbody.querySelectorAll(".btn-edit-provider").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = parseInt(btn.getAttribute("data-id"));
        const provider = data.find(x => x.id === id);
        openProviderEditForm(provider);
      });
    });

    tbody.querySelectorAll(".btn-delete-provider").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = parseInt(btn.getAttribute("data-id"));
        if (confirm("¿Está seguro de eliminar este proveedor? Se enviará a la Papelera de Reciclaje.")) {
          try {
            await API.delete(`/purchases/providers/${id}`);
            App.showToast("Proveedor Eliminado", "El proveedor fue enviado a la papelera.", "success");
            renderProvidersList();
          } catch (e) {
            App.showToast("Error", e.message, "error");
          }
        }
      });
    });

    tbody.querySelectorAll(".btn-activate-provider").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = parseInt(btn.getAttribute("data-id"));
        const provider = data.find(x => x.id === id);
        if (confirm("¿Desea restaurar a este proveedor?")) {
          try {
            await API.put(`/purchases/providers/${id}`, { ...provider, activo: true });
            App.showToast("Proveedor Restaurado", "El proveedor fue restaurado con éxito.", "success");
            renderProvidersList();
          } catch (e) {
            App.showToast("Error", e.message, "error");
          }
        }
      });
    });

  } catch (error) {
    App.showToast("Proveedores", "No se cargó la lista de proveedores: " + error.message, "error");
  }
}

function openProviderEditForm(prov) {
  editingProviderId = prov.id;
  document.getElementById("provider-modal-title").textContent = "Modificar Proveedor: " + prov.nombre;
  
  document.getElementById("prov-identificacion").value = prov.identificacion;
  document.getElementById("prov-nombre").value = prov.nombre;
  document.getElementById("prov-contacto").value = prov.contacto || "";
  document.getElementById("prov-telefono").value = prov.telefono || "";
  document.getElementById("prov-correo").value = prov.correo || "";
  document.getElementById("prov-direccion").value = prov.direccion || "";
  
  const activeContainer = document.getElementById("prov-active-container");
  activeContainer.style.display = "block";
  document.getElementById("prov-activo").value = prov.activo ? "true" : "false";
  
  App.openModal("provider-form-modal");
}

async function saveProvider() {
  const payload = {
    identificacion: document.getElementById("prov-identificacion").value.trim(),
    nombre: document.getElementById("prov-nombre").value.trim(),
    contacto: document.getElementById("prov-contacto").value.trim(),
    telefono: document.getElementById("prov-telefono").value.trim(),
    correo: document.getElementById("prov-correo").value.trim(),
    direccion: document.getElementById("prov-direccion").value.trim()
  };

  if (!payload.identificacion || !payload.nombre) {
    App.showToast("Campos Vacíos", "Identificación y nombre son campos obligatorios.", "warning");
    return;
  }

  try {
    if (editingProviderId) {
      payload.activo = document.getElementById("prov-activo").value === "true";
      await API.put(`/purchases/providers/${editingProviderId}`, payload);
      App.showToast("Proveedor Modificado", "El proveedor se actualizó correctamente.", "success");
    } else {
      await API.post("/purchases/providers", payload);
      App.showToast("Proveedor Creado", "Proveedor registrado con éxito.", "success");
    }
    
    document.getElementById("provider-form-modal").classList.remove("active");
    renderProvidersList();
  } catch (error) {
    App.showToast("Error", error.message || "Fallo en operación del proveedor.", "error");
  }
}

// --- GESTIÓN DE CUENTAS POR PAGAR (CXP) ---

async function renderCxpList() {
  const container = document.getElementById("purchases-tab-body");
  if (!container) return;

  container.innerHTML = `
    <div class="table-container" style="margin-top:0;">
      <table class="data-table">
        <thead>
          <tr>
            <th>Proveedor</th>
            <th>Factura</th>
            <th>Monto Total</th>
            <th>Saldo Pendiente</th>
            <th>Vencimiento</th>
            <th>Estado</th>
            <th>Acción</th>
          </tr>
        </thead>
        <tbody id="cxp-list-body">
          <tr><td colspan="7" style="text-align:center;">Cargando cuentas por pagar...</td></tr>
        </tbody>
      </table>
    </div>
  `;

  try {
    const searchVal = document.getElementById("purchases-search-input").value.trim();
    const estadoFilter = document.getElementById("cxp-filter-estado").value;
    
    const url = `/purchases/accounts-payable?search=${encodeURIComponent(searchVal)}` + (estadoFilter ? `&estado=${estadoFilter}` : "");
    const data = await API.get(url);
    const tbody = document.getElementById("cxp-list-body");

    if (data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;">No se encontraron cuentas por pagar.</td></tr>`;
      return;
    }

    tbody.innerHTML = "";
    data.forEach(c => {
      let stateBadge = "";
      if (c.estado === "pagada") {
        stateBadge = `<span class="badge badge-success">Pagada</span>`;
      } else if (c.estado === "pendiente") {
        stateBadge = `<span class="badge badge-warning">Pendiente</span>`;
      } else {
        stateBadge = `<span class="badge badge-danger">${c.estado.toUpperCase()}</span>`;
      }

      const payBtn = c.estado === "pendiente" 
        ? `<button class="btn btn-primary btn-pay-cxp" data-id="${c.id}" data-provider="${c.proveedor_nombre}" data-saldo="${c.saldo_pendiente}" style="padding: 4px 8px; font-size: 0.75rem;">💸 Pagar</button>`
        : "N/A";

      tbody.innerHTML += `
        <tr>
          <td><strong>${c.proveedor_nombre}</strong></td>
          <td><code>${c.compra_factura}</code></td>
          <td>₡${c.monto_total.toLocaleString("es-CR", { minimumFractionDigits: 2 })}</td>
          <td style="font-weight: 700; color: ${c.saldo_pendiente > 0 ? 'var(--error)' : 'inherit'};">
            ₡${c.saldo_pendiente.toLocaleString("es-CR", { minimumFractionDigits: 2 })}
          </td>
          <td>${c.fecha_vencimiento}</td>
          <td>${stateBadge}</td>
          <td>${payBtn}</td>
        </tr>
      `;
    });

    tbody.querySelectorAll(".btn-pay-cxp").forEach(btn => {
      btn.addEventListener("click", () => {
        activeCxpId = parseInt(btn.getAttribute("data-id"));
        document.getElementById("cxp-pay-provider").value = btn.getAttribute("data-provider");
        document.getElementById("cxp-pay-debt").value = parseFloat(btn.getAttribute("data-saldo")).toFixed(2);
        document.getElementById("cxp-pay-amount").value = "";
        App.openModal("cxp-pay-modal");
      });
    });

  } catch (error) {
    App.showToast("Cuentas por Pagar", "Error al cargar cxp: " + error.message, "error");
  }
}

async function saveCxpPayment() {
  const amount = parseFloat(document.getElementById("cxp-pay-amount").value) || 0.0;
  const metodo_pago = document.getElementById("cxp-pay-metodo").value;
  const enviar_correo = document.getElementById("cxp-pay-send-email").checked;

  if (amount <= 0) {
    App.showToast("Error", "Ingrese un monto mayor a cero para pagar.", "warning");
    return;
  }

  try {
    await API.post(`/purchases/accounts-payable/${activeCxpId}/pay`, {
      monto: amount,
      metodo_pago: metodo_pago,
      enviar_correo: enviar_correo
    });
    
    App.showToast("Pago registrado", "El pago al proveedor fue guardado exitosamente.", "success");
    document.getElementById("cxp-pay-modal").classList.remove("active");
    renderCxpList();
  } catch (error) {
    App.showToast("Error", error.message || "Fallo al registrar pago.", "error");
  }
}

async function handleOcrUpload(file) {
  const dropzone = document.getElementById("pur-ocr-dropzone");
  if (!dropzone) return;
  
  const originalHtml = dropzone.innerHTML;
  
  dropzone.innerHTML = `
    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 10px; width: 100%;">
      <div class="pur-spinner"></div>
      <p style="font-size: 0.9rem; font-weight: 600; color: var(--text-secondary); margin-bottom: 0;">Digitalizando y procesando documento con IA / OCR...</p>
      <span style="font-size: 0.75rem; color: var(--text-muted);">${file.name}</span>
    </div>
  `;
  dropzone.style.cursor = "wait";
  
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      let base64 = e.target.result;
      if (base64.includes(",")) {
        base64 = base64.split(",")[1];
      }
      
      const payload = {
        file_base64: base64,
        file_name: file.name
      };
      
      const res = await API.post("/purchases/parse-invoice", payload);
      
      if (!res.parsed_successfully || res.items.length === 0) {
        throw new Error("No se lograron extraer filas de productos del documento.");
      }
      
      const selectProv = document.getElementById("pur-provider-select");
      if (selectProv && res.proveedor_nombre) {
        const provNameLower = res.proveedor_nombre.toLowerCase();
        const matchedProv = providersList.find(p => 
          p.nombre.toLowerCase().includes(provNameLower) || 
          provNameLower.includes(p.nombre.toLowerCase()) ||
          (res.proveedor_identificacion && p.identificacion.replace(/[-]/g, "") === res.proveedor_identificacion.replace(/[-]/g, ""))
        );
        
        if (matchedProv) {
          selectProv.value = matchedProv.id;
          App.showToast("Proveedor Detectado", `Se asoció automáticamente al proveedor '${matchedProv.nombre}'.`, "info");
        } else {
          App.showToast("Proveedor Nuevo", `Factura emitida por '${res.proveedor_nombre}'. Puede crearlo en el directorio.`, "warning");
        }
      }
      
      const invoiceInput = document.getElementById("pur-invoice-number");
      if (invoiceInput && res.numero_factura) {
        invoiceInput.value = res.numero_factura;
      }
      
      const tbody = document.getElementById("ocr-mapping-table-body");
      tbody.innerHTML = "";
      
      res.items.forEach((item, index) => {
        const itemLower = item.producto_nombre.toLowerCase();
        let bestMatchId = "new";
        
        for (let p of inventoryProducts) {
          const pLower = p.nombre.toLowerCase();
          if (pLower === itemLower || pLower.includes(itemLower) || itemLower.includes(pLower)) {
            bestMatchId = p.id;
            break;
          }
        }
        
        const optionsHtml = [
          `<option value="new" ${bestMatchId === 'new' ? 'selected' : ''}>➕ Crear como nuevo producto</option>`,
          `<option value="ignore">🚫 Ignorar este producto</option>`
        ];
        
        inventoryProducts.forEach(p => {
          optionsHtml.push(
            `<option value="${p.id}" ${bestMatchId === p.id ? 'selected' : ''}>🔗 Asociar a: ${p.nombre} [SKU: ${p.sku}]</option>`
          );
        });
        
        tbody.innerHTML += `
          <tr data-parsed-name="${item.producto_nombre}" data-cantidad="${item.cantidad}" data-costo-unitario="${item.costo_unitario}">
            <td>
              <div style="font-weight: 600; font-size: 0.85rem;">${item.producto_nombre}</div>
            </td>
            <td><strong>${item.cantidad}</strong></td>
            <td>₡${item.costo_unitario.toLocaleString("es-CR", { minimumFractionDigits: 2 })}</td>
            <td class="ocr-mapping-row">
              <select class="input-field ocr-map-select" style="padding: 6px; font-size: 0.8rem; height: 35px; width: 100%;">
                ${optionsHtml.join("")}
              </select>
            </td>
          </tr>
        `;
      });
      
      App.openModal("pur-ocr-mapping-modal");
      App.showToast("Factura Parseada", `Digitalización exitosa vía ${res.method_used}. Confirme las asociaciones de productos.`, "success");
      
    } catch (err) {
      App.showToast("Error de Digitalización", err.message || "Fallo al procesar el archivo.", "error");
    } finally {
      dropzone.innerHTML = originalHtml;
      dropzone.style.cursor = "pointer";
      
      const fileInputBtn = dropzone.querySelector("button");
      if (fileInputBtn) {
        fileInputBtn.onclick = () => document.getElementById('pur-ocr-file-input').click();
      }
    }
  };
  
  reader.readAsDataURL(file);
}

async function processOcrMapping() {
  const rows = document.querySelectorAll("#ocr-mapping-table-body tr");
  const itemsToAdd = [];
  
  const submitBtn = document.getElementById("ocr-mapping-confirm-btn");
  submitBtn.disabled = true;
  submitBtn.textContent = "Procesando...";
  
  try {
    for (let row of rows) {
      const parsedName = row.getAttribute("data-parsed-name");
      const cantidad = parseFloat(row.getAttribute("data-cantidad"));
      const costoUnitario = parseFloat(row.getAttribute("data-costo-unitario"));
      const select = row.querySelector(".ocr-map-select");
      const optionVal = select.value;
      
      if (optionVal === "ignore") {
        continue;
      }
      
      let product = null;
      
      if (optionVal === "new") {
        const randomSuffix = Math.floor(1000 + Math.random() * 9000);
        const nameSlug = parsedName.toUpperCase()
          .replace(/[^A-Z0-9\s]/g, "")
          .trim()
          .split(/\s+/)
          .slice(0, 3)
          .join("-");
        const sku = `NEW-${nameSlug || "PROD"}-${randomSuffix}`;
        const barcode = `999${Date.now().toString().slice(-7)}${randomSuffix}`;
        
        const brands = await API.get("/inventory/marcas");
        const subcats = await API.get("/inventory/categories");
        const taxes = await API.get("/inventory/taxes");
        
        const defaultBrandId = brands[0] ? brands[0].id : 1;
        
        let defaultSubcatId = 1;
        if (subcats[0] && subcats[0].subcategorias && subcats[0].subcategorias[0]) {
          defaultSubcatId = subcats[0].subcategorias[0].id;
        }
        const defaultTaxId = taxes[0] ? taxes[0].id : 1;
        
        const payload = {
          sku: sku,
          codigo_barras: barcode,
          nombre: parsedName,
          marca_id: defaultBrandId,
          subcategoria_id: defaultSubcatId,
          unidad_medida: "Unidad",
          precio_costo: costoUnitario,
          precio_venta: Math.round(costoUnitario * 1.3),
          precio_mayorista: Math.round(costoUnitario * 1.2),
          impuesto_id: defaultTaxId,
          stock_minimo: 5,
          stock_maximo: 100,
          existencia_inicial: 0.0,
          descripcion: "Creado automáticamente desde carga de factura de proveedor."
        };
        
        const res = await API.post("/inventory/products", payload);
        App.showToast("Producto Creado", `Se creó el producto '${parsedName}' en el catálogo.`, "success");
        
        product = {
          id: res.id,
          nombre: parsedName,
          sku: sku,
          precio_costo: costoUnitario
        };
        
        inventoryProducts = await API.get("/inventory/products");
      } else {
        const prodId = parseInt(optionVal);
        product = inventoryProducts.find(p => p.id === prodId);
      }
      
      if (product) {
        itemsToAdd.push({
          producto_id: product.id,
          nombre: product.nombre,
          sku: product.sku,
          cantidad: cantidad,
          costo_unitario: costoUnitario
        });
      }
    }
    
    itemsToAdd.forEach(item => {
      const existing = itemsPurchaseList.find(i => i.producto_id === item.producto_id);
      if (existing) {
        existing.cantidad += item.cantidad;
        existing.costo_unitario = item.costo_unitario;
      } else {
        itemsPurchaseList.push(item);
      }
    });
    
    App.showToast("Carga Completa", `Se cargaron ${itemsToAdd.length} productos al detalle de compra.`, "success");
    document.getElementById("pur-ocr-mapping-modal").classList.remove("active");
    renderPurchaseItemsTable();
    
  } catch (error) {
    App.showToast("Error de Mapeo", error.message || "No se pudo procesar el mapeo.", "error");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Cargar en Factura";
  }
}
