import { API } from "./api.js";
import { App } from "./app.js";

let activeCatalog = [];
let currentTransferCart = [];
let importPreviewItems = [];

export async function renderInventory(container) {
  container.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 24px;">
      
      <!-- Cabecera de Módulo -->
      <div class="flex-between">
        <div class="form-group" style="flex-direction: row; gap: 12px; align-items: center; margin-bottom: 0;">
          <input type="text" id="inv-search-input" class="input-field" placeholder="Buscar por SKU, código o nombre..." style="width: 280px;">
          <button id="inv-search-btn" class="btn btn-secondary">🔍</button>
          <label style="display: flex; align-items: center; gap: 8px; font-size: 0.9rem; cursor: pointer; user-select: none; white-space: nowrap;">
            <input type="checkbox" id="inv-show-inactive"> 🗑️ Ver Papelera (Inactivos)
          </label>
        </div>
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          <button id="open-import-btn" class="btn btn-secondary">📤 Importar</button>
          <button id="open-adjust-btn" class="btn btn-secondary">🔧 Ajustar Existencias</button>
          <button id="open-lot-btn" class="btn btn-secondary">📦 Lote</button>
          <button id="open-create-prod-btn" class="btn btn-primary">➕ Nuevo</button>
        </div>
      </div>

      <!-- Barra de Exportación -->
      <div class="dashboard-panel" style="padding: 12px 16px; display: flex; justify-content: flex-end; align-items: center; gap: 12px;">
        <span style="font-size: 0.85rem; font-weight: 600; color: var(--text-secondary);">Exportar Inventario:</span>
        <button id="export-csv-btn" class="btn btn-secondary" style="padding: 6px 12px; font-size: 0.8rem;">📄 CSV</button>
        <button id="export-excel-btn" class="btn btn-secondary" style="padding: 6px 12px; font-size: 0.8rem;">📊 Excel</button>
        <button id="export-pdf-btn" class="btn btn-secondary" style="padding: 6px 12px; font-size: 0.8rem;">📕 PDF</button>
      </div>

      <!-- Pestañas de Submódulos -->
      <div style="display: flex; gap: 16px; border-bottom: 1px solid var(--border-color); padding-bottom: 8px;">
        <button class="category-tab active" id="tab-products">Catálogo de Productos</button>
        <button class="category-tab" id="tab-lots">Lotes y Vencimientos</button>
        <button class="category-tab" id="tab-transfers">Transferencia Sucursales</button>
      </div>

      <!-- CUERPO DE CONTENEDOR REGULADO POR PESTAÑAS -->
      <div id="inventory-tab-body">
        <!-- Relleno del catálogo de productos -->
        <div class="table-container" style="margin-top: 0;">
          <table class="data-table">
            <thead>
              <tr>
                <th>Código / SKU</th>
                <th>Nombre</th>
                <th>Marca</th>
                <th>Categoría</th>
                <th>Precio Costo</th>
                <th>Precio Venta</th>
                <th>M. Bruto</th>
                <th>Existencia</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody id="inventory-products-list">
              <tr><td colspan="9" style="text-align: center;">Cargando catálogo...</td></tr>
            </tbody>
          </table>
        </div>
      </div>

    </div>

    <!-- MODAL: CREAR / EDITAR PRODUCTO -->
    <div id="product-form-modal" class="modal-wrapper">
      <div class="modal-card" style="width: 550px;">
        <div class="modal-header">
          <h3 id="modal-product-title">Nuevo Producto</h3>
          <button class="close-btn" onclick="document.getElementById('product-form-modal').classList.remove('active')">&times;</button>
        </div>
        <div class="modal-body">
          <form id="product-form" style="display: flex; flex-direction: column; gap: 16px;">
            <input type="hidden" id="form-product-id">
            
            <div class="grid-cols-3">
              <div class="form-group">
                <label>SKU (Único)</label>
                <input type="text" id="form-sku" class="input-field" placeholder="ej. L-LECHE-01" required>
              </div>
              <div class="form-group">
                <label>Código de Barras</label>
                <input type="text" id="form-barcode" class="input-field" placeholder="ej. 744100..." required>
              </div>
              <div class="form-group">
                <label>Código CABYS</label>
                <div style="display: flex; gap: 6px;">
                  <input type="text" id="form-cabys" class="input-field" placeholder="13 dígitos" style="flex: 1;">
                  <button type="button" id="btn-search-cabys" class="btn btn-secondary" style="padding: 0 10px; height: 38px; display: flex; align-items: center; justify-content: center;" title="Buscar código CABYS">🔍</button>
                </div>
                <span style="font-size: 0.65rem; color: var(--text-muted); display: block; margin-top: 3px; line-height: 1.2;">⚠️ Opcional para guardar, requerido para facturación.</span>
              </div>
            </div>

            <div class="form-group">
              <label>Nombre del Producto</label>
              <input type="text" id="form-name" class="input-field" placeholder="ej. Leche Semidescremada 1L" required>
            </div>

            <div class="grid-cols-3">
              <div class="form-group">
                <label>Marca</label>
                <select id="form-marca" class="input-field" required></select>
              </div>
              <div class="form-group">
                <label>Subcategoría</label>
                <select id="form-subcat" class="input-field" required></select>
              </div>
              <div class="form-group">
                <label>Unidad de Medida</label>
                <select id="form-unidad" class="input-field">
                  <option value="Unidad">Unidad</option>
                  <option value="Litro">Litro</option>
                  <option value="Kilogramo">Kilogramo</option>
                  <option value="Caja">Caja</option>
                </select>
              </div>
            </div>

            <div class="grid-cols-3">
              <div class="form-group">
                <label>Precio Costo (₡)</label>
                <input type="number" id="form-cost" class="input-field" placeholder="0.00" step="0.01" required>
              </div>
              <div class="form-group">
                <label>Precio Venta (₡)</label>
                <input type="number" id="form-price" class="input-field" placeholder="0.00" step="0.01" required>
              </div>
              <div class="form-group">
                <label>Margen Estimado</label>
                <input type="text" id="form-margin-display" class="input-field" style="background-color: var(--bg-tertiary);" readonly>
              </div>
            </div>

            <div class="grid-cols-2">
              <div class="form-group">
                <label>Proveedor Principal</label>
                <select id="form-proveedor" class="input-field"></select>
              </div>
              <div class="form-group" id="form-stock-inicial-container">
                <label>Existencia Inicial</label>
                <input type="number" id="form-stock-inicial" class="input-field" placeholder="0.000" step="0.001" value="0">
              </div>
            </div>

            <div class="grid-cols-3">
              <div class="form-group">
                <label>Precio Mayorista</label>
                <input type="number" id="form-wholesale" class="input-field" placeholder="0.00" step="0.01">
              </div>
              <div class="form-group">
                <label>Impuesto Asociado</label>
                <select id="form-tax" class="input-field" required></select>
              </div>
              <div class="form-group" id="form-active-container" style="display:none;">
                <label>Estado Producto</label>
                <select id="form-activo" class="input-field">
                  <option value="true">Activo</option>
                  <option value="false">Inactivo</option>
                </select>
              </div>
              <div class="form-group" id="form-image-container">
                <label>Imagen Local (Path)</label>
                <input type="text" id="form-image-path" class="input-field" placeholder="/static/uploads/productos/prod.png">
              </div>
            </div>

            <div class="grid-cols-2">
              <div class="form-group">
                <label>Stock Mínimo (Alerta)</label>
                <input type="number" id="form-stock-min" class="input-field" value="5">
              </div>
              <div class="form-group">
                <label>Stock Máximo</label>
                <input type="number" id="form-stock-max" class="input-field" value="100">
              </div>
            </div>

            <div class="form-group">
              <label>Descripción</label>
              <textarea id="form-desc" class="input-field" placeholder="Descripción opcional del producto..." style="height: 60px; font-family: inherit; resize: none;"></textarea>
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="document.getElementById('product-form-modal').classList.remove('active')">Cancelar</button>
          <button id="save-product-btn" class="btn btn-primary">Guardar Producto</button>
        </div>
      </div>
    </div>

    <!-- MODAL: REGISTRAR LOTE -->
    <div id="lot-form-modal" class="modal-wrapper">
      <div class="modal-card">
        <div class="modal-header">
          <h3>Registrar Lote de Producto</h3>
          <button class="close-btn" onclick="document.getElementById('lot-form-modal').classList.remove('active')">&times;</button>
        </div>
        <div class="modal-body" style="display: flex; flex-direction: column; gap: 16px;">
          <div class="form-group">
            <label>Producto</label>
            <select id="lot-product-id" class="input-field"></select>
          </div>
          <div class="grid-cols-2">
            <div class="form-group">
              <label>Número de Lote</label>
              <input type="text" id="lot-number" class="input-field" placeholder="ej. LOT-2026-001">
            </div>
            <div class="form-group">
              <label>Cantidad de Ingreso</label>
              <input type="number" id="lot-qty" class="input-field" placeholder="0">
            </div>
          </div>
          <div class="form-group">
            <label>Fecha de Vencimiento</label>
            <input type="date" id="lot-expiry-date" class="input-field">
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="document.getElementById('lot-form-modal').classList.remove('active')">Cancelar</button>
          <button id="save-lot-btn" class="btn btn-primary">Ingresar Lote</button>
        </div>
      </div>
    </div>

    <!-- MODAL: AJUSTE DE EXISTENCIA -->
    <div id="adjust-form-modal" class="modal-wrapper">
      <div class="modal-card">
        <div class="modal-header">
          <h3>Ajuste Manual de Inventario</h3>
          <button class="close-btn" onclick="document.getElementById('adjust-form-modal').classList.remove('active')">&times;</button>
        </div>
        <div class="modal-body" style="display: flex; flex-direction: column; gap: 16px;">
          <div class="form-group">
            <label>Producto</label>
            <select id="adjust-product-id" class="input-field"></select>
          </div>
          
          <div class="grid-cols-2">
            <div class="form-group">
              <label>Tipo de Ajuste</label>
              <select id="adjust-type" class="input-field">
                <option value="aumentar">Aumentar Stock (+)</option>
                <option value="disminuir">Disminuir Stock (-)</option>
                <option value="fijar">Fijar Stock (=)</option>
              </select>
            </div>
            <div class="form-group">
              <label>Cantidad de Variación</label>
              <input type="number" id="adjust-qty" class="input-field" placeholder="0.000" step="0.001" min="0.001" required>
            </div>
          </div>

          <div class="grid-cols-2">
            <div class="form-group">
              <label>Motivo Predeterminado</label>
              <select id="adjust-reason-select" class="input-field">
                <option value="Corrección de Conteo">Corrección de Conteo</option>
                <option value="Producto Dañado">Producto Dañado</option>
                <option value="Merma">Merma</option>
                <option value="Pérdida">Pérdida</option>
                <option value="Otro">Otro / Detalle Libre</option>
              </select>
            </div>
            <div class="form-group">
              <label>Detalles Adicionales</label>
              <input type="text" id="adjust-reason-custom" class="input-field" placeholder="Detalles o especificaciones libres...">
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="document.getElementById('adjust-form-modal').classList.remove('active')">Cancelar</button>
          <button id="save-adjust-btn" class="btn btn-primary">Ajustar Existencias</button>
        </div>
      </div>
    </div>

    <!-- MODAL: KÁRDEX / HISTORIAL DE MOVIMIENTOS -->
    <div id="kardex-modal" class="modal-wrapper">
      <div class="modal-card" style="width: 600px;">
        <div class="modal-header">
          <h3>Kárdex - Movimientos de Producto</h3>
          <button class="close-btn" onclick="document.getElementById('kardex-modal').classList.remove('active')">&times;</button>
        </div>
        <div class="modal-body">
          <div class="table-container" style="margin-top: 0; max-height: 350px; overflow-y: auto;">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Tipo</th>
                  <th>Cant. Variación</th>
                  <th>Detalle / Motivo</th>
                  <th>Usuario</th>
                </tr>
              </thead>
              <tbody id="kardex-list"></tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <!-- MODAL: SOLICITAR TRANSFERENCIA -->
    <div id="transfer-form-modal" class="modal-wrapper">
      <div class="modal-card" style="width: 600px;">
        <div class="modal-header">
          <h3>Solicitar Transferencia de Inventario</h3>
          <button class="close-btn" onclick="document.getElementById('transfer-form-modal').classList.remove('active')">&times;</button>
        </div>
        <div class="modal-body" style="display: flex; flex-direction: column; gap: 16px;">
          <div class="grid-cols-2">
            <div class="form-group">
              <label>Sucursal de Origen</label>
              <select id="transfer-origin-id" class="input-field"></select>
            </div>
            <div class="form-group">
              <label>Sucursal de Destino</label>
              <select id="transfer-destination-id" class="input-field"></select>
            </div>
          </div>
          
          <div style="border: 1px solid var(--border-color); padding: 12px; border-radius: var(--radius-md);">
            <h4>Agregar Producto a Transferir</h4>
            <div style="display: flex; gap: 12px; margin-top: 8px;">
              <select id="transfer-prod-select" class="input-field" style="flex: 2;"></select>
              <input type="number" id="transfer-qty-input" class="input-field" placeholder="Cant" style="width: 90px;" min="1" value="1">
              <button id="add-transfer-item-btn" class="btn btn-secondary">Agregar</button>
            </div>
          </div>

          <div>
            <h4>Detalle de Productos a Transferir</h4>
            <div class="table-container" style="max-height: 180px; overflow-y: auto; margin-top: 8px;">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Cantidad</th>
                    <th>Acción</th>
                  </tr>
                </thead>
                <tbody id="transfer-items-list-body">
                  <tr><td colspan="3" style="text-align: center; color: var(--text-muted);">No hay productos agregados.</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="document.getElementById('transfer-form-modal').classList.remove('active')">Cancelar</button>
          <button id="save-transfer-btn" class="btn btn-primary">Crear Solicitud</button>
        </div>
      </div>
    </div>

    <!-- MODAL: DETALLES DE TRANSFERENCIA -->
    <div id="transfer-detail-modal" class="modal-wrapper">
      <div class="modal-card">
        <div class="modal-header">
          <h3>Detalle de Transferencia</h3>
          <button class="close-btn" onclick="document.getElementById('transfer-detail-modal').classList.remove('active')">&times;</button>
        </div>
        <div class="modal-body">
          <div style="margin-bottom: 12px;">
            <p><strong>Origen:</strong> <span id="lbl-transfer-origin"></span></p>
            <p><strong>Destino:</strong> <span id="lbl-transfer-dest"></span></p>
            <p><strong>Usuario:</strong> <span id="lbl-transfer-user"></span></p>
            <p><strong>Estado:</strong> <span id="lbl-transfer-status"></span></p>
          </div>
          <div class="table-container" style="max-height: 250px; overflow-y: auto;">
            <table class="data-table">
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Producto</th>
                  <th>Cantidad</th>
                </tr>
              </thead>
              <tbody id="transfer-detail-items-body"></tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <!-- MODAL: IMPORTAR PRODUCTOS -->
    <div id="import-products-modal" class="modal-wrapper">
      <div class="modal-card" style="width: 750px; max-width: 90%;">
        <div class="modal-header">
          <h3>Importar Productos desde Archivo</h3>
          <button class="close-btn" onclick="document.getElementById('import-products-modal').classList.remove('active')">&times;</button>
        </div>
        <div class="modal-body" style="display: flex; flex-direction: column; gap: 16px;">
          <p style="font-size: 0.9rem; color: var(--text-secondary);">
            Suba un archivo CSV o Excel (.xlsx) con el formato correspondiente. Descargue la plantilla a continuación:
          </p>
          <div style="display: flex; justify-content: space-between; align-items: center; background-color: var(--bg-secondary); padding: 12px; border-radius: var(--radius-md);">
            <span style="font-size: 0.85rem; font-weight: 600;">Plantilla Oficial de Importación:</span>
            <button id="download-template-btn" class="btn btn-secondary" style="font-size: 0.8rem; padding: 6px 12px;">📥 Descargar Plantilla</button>
          </div>
          
          <div class="form-group">
            <label>Seleccionar Archivo (CSV o XLSX)</label>
            <input type="file" id="import-file-input" class="input-field" accept=".csv, .xlsx">
          </div>

          <button id="preview-import-btn" class="btn btn-secondary" style="width: 100%;">🔍 Previsualizar Datos</button>

          <!-- Zona de Vista Previa -->
          <div id="import-preview-zone" style="display:none; flex-direction: column; gap: 12px;">
            <h4 style="font-size: 0.95rem; font-weight: 600; margin-top: 12px;">Previsualización de Datos</h4>
            <div id="import-summary-banner" style="padding: 10px; border-radius: var(--radius-sm); font-size: 0.85rem; font-weight: bold;"></div>
            <div class="table-container" style="max-height: 200px; overflow-y: auto; margin-top: 0;">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Nombre</th>
                    <th>Costo</th>
                    <th>Venta</th>
                    <th>Estado / Errores</th>
                  </tr>
                </thead>
                <tbody id="import-preview-table-body"></tbody>
              </table>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="document.getElementById('import-products-modal').classList.remove('active')">Cancelar</button>
          <button id="confirm-import-btn" class="btn btn-primary" disabled>Confirmar Carga de Productos</button>
        </div>
      </div>
    </div>

    <!-- MODAL: EDITAR VENCIMIENTO DE LOTE -->
    <div id="lot-expiry-modal" class="modal-wrapper">
      <div class="modal-card">
        <div class="modal-header">
          <h3>Editar Vencimiento de Lote</h3>
          <button class="close-btn" onclick="document.getElementById('lot-expiry-modal').classList.remove('active')">&times;</button>
        </div>
        <div class="modal-body" style="display: flex; flex-direction: column; gap: 16px;">
          <input type="hidden" id="edit-expiry-lot-id">
          <div class="form-group">
            <label>Número de Lote</label>
            <input type="text" id="edit-expiry-lot-number" class="input-field" readonly style="background-color: var(--bg-tertiary);">
          </div>
          <div class="form-group">
            <label>Nueva Fecha de Vencimiento</label>
            <input type="date" id="edit-expiry-date" class="input-field" required>
          </div>
          <div class="form-group">
            <label>Motivo del Cambio</label>
            <input type="text" id="edit-expiry-reason" class="input-field" placeholder="ej. Corrección por error de digitación / Verificación física" required>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="document.getElementById('lot-expiry-modal').classList.remove('active')">Cancelar</button>
          <button id="save-lot-expiry-btn" class="btn btn-primary">Actualizar Vencimiento</button>
        </div>
      </div>
    </div>

    <!-- MODAL: BUSCADOR CABYS -->
    <div id="cabys-search-modal" class="modal-wrapper">
      <div class="modal-card" style="width: 600px; max-height: 90vh; display: flex; flex-direction: column;">
        <div class="modal-header">
          <h3>Buscar en Catálogo CABYS</h3>
          <button class="close-btn" onclick="document.getElementById('cabys-search-modal').classList.remove('active')">&times;</button>
        </div>
        <div class="modal-body" style="flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 16px;">
          <!-- Metadatos y Sincronización Manual -->
          <div style="display: flex; justify-content: space-between; align-items: center; background-color: var(--bg-tertiary); padding: 10px 14px; border-radius: var(--radius-md); font-size: 0.8rem; border: 1px solid var(--border-color);">
            <div>
              <strong>Estado del Catálogo:</strong> <span id="cabys-meta-status">Cargando...</span><br>
              <span style="color: var(--text-secondary);">
                <strong>Registros:</strong> <span id="cabys-meta-records">0</span> | 
                <strong>Actualizado:</strong> <span id="cabys-meta-date">N/A</span>
              </span>
            </div>
            <button id="cabys-manual-sync-btn" class="btn btn-secondary" style="padding: 6px 12px; font-size: 0.75rem; border-color: var(--brand-color); color: var(--brand-color);">🔄 Sincronizar BCCR</button>
          </div>

          <div class="form-group">
            <label>Escriba una descripción o código para buscar (ej. arroz, leche, refresco)</label>
            <div style="display: flex; gap: 8px;">
              <input type="text" id="cabys-search-input" class="input-field" placeholder="Buscar...">
              <button id="cabys-do-search-btn" class="btn btn-primary">Buscar</button>
            </div>
          </div>
          <div id="cabys-loading-indicator" style="display: none; text-align: center; color: var(--brand-color); padding: 20px 0;">
            ⏳ Buscando en catálogo oficial BCCR/Hacienda...
          </div>
          <div id="cabys-results-container" class="table-container" style="margin-top: 0; max-height: 250px; overflow-y: auto; display: none;">
            <table class="data-table">
              <thead>
                <tr>
                  <th style="width: 140px;">Código</th>
                  <th>Descripción</th>
                  <th style="width: 100px; text-align: center;">Acción</th>
                </tr>
              </thead>
              <tbody id="cabys-results-body">
                <!-- Se llena dinámicamente -->
              </tbody>
            </table>
          </div>
          <div id="cabys-no-results" style="display: none; text-align: center; color: var(--text-muted); padding: 20px 0;">
            No se encontraron resultados en el catálogo.
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="document.getElementById('cabys-search-modal').classList.remove('active')">Cerrar</button>
        </div>
      </div>
    </div>
  `;

  // Cargar pestañas
  const tabProducts = document.getElementById("tab-products");
  const tabLots = document.getElementById("tab-lots");
  const tabTransfers = document.getElementById("tab-transfers");
  
  tabProducts.addEventListener("click", () => {
    tabLots.classList.remove("active");
    if (tabTransfers) tabTransfers.classList.remove("active");
    tabProducts.classList.add("active");
    loadProductsList();
  });

  tabLots.addEventListener("click", () => {
    tabProducts.classList.remove("active");
    if (tabTransfers) tabTransfers.classList.remove("active");
    tabLots.classList.add("active");
    loadLotsList();
  });

  if (tabTransfers) {
    tabTransfers.addEventListener("click", () => {
      tabProducts.classList.remove("active");
      tabLots.classList.remove("active");
      tabTransfers.classList.add("active");
      loadTransfersList();
    });
  }

  // Buscador y filtros
  document.getElementById("inv-search-btn").addEventListener("click", () => {
    loadProductsList();
  });

  document.getElementById("inv-search-input").addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      loadProductsList();
    }
  });

  document.getElementById("inv-show-inactive").addEventListener("change", () => {
    loadProductsList();
  });

  // Exportaciones
  document.getElementById("export-csv-btn").onclick = () => downloadExport("csv");
  document.getElementById("export-excel-btn").onclick = () => downloadExport("excel");
  document.getElementById("export-pdf-btn").onclick = () => downloadExport("pdf");

  // Importar
  document.getElementById("open-import-btn").onclick = () => {
    document.getElementById("import-file-input").value = "";
    document.getElementById("import-preview-zone").style.display = "none";
    document.getElementById("confirm-import-btn").disabled = true;
    App.openModal("import-products-modal");
  };

  document.getElementById("download-template-btn").onclick = downloadTemplate;
  document.getElementById("preview-import-btn").onclick = previewImport;
  document.getElementById("confirm-import-btn").onclick = confirmImport;

  // Abrir Formularios de Lotes, Ajustes y Producto
  document.getElementById("open-create-prod-btn").addEventListener("click", () => openProductForm());
  document.getElementById("open-lot-btn").addEventListener("click", () => openLotForm());
  document.getElementById("open-adjust-btn").addEventListener("click", () => openAdjustForm());

  // Salvar
  document.getElementById("save-product-btn").addEventListener("click", saveProduct);
  document.getElementById("save-lot-btn").addEventListener("click", saveLot);
  document.getElementById("save-adjust-btn").addEventListener("click", saveAdjust);
  document.getElementById("save-lot-expiry-btn").onclick = saveLotExpiry;

  // Auto cálculo de margen
  const costInp = document.getElementById("form-cost");
  const priceInp = document.getElementById("form-price");
  const marginDisp = document.getElementById("form-margin-display");

  const calcMargin = () => {
    const c = parseFloat(costInp.value) || 0;
    const p = parseFloat(priceInp.value) || 0;
    if (p > 0) {
      const margin = ((p - c) / p) * 100;
      marginDisp.value = `${margin.toFixed(1)}%`;
    } else {
      marginDisp.value = "0.0%";
    }
  };

  costInp.addEventListener("input", calcMargin);
  priceInp.addEventListener("input", calcMargin);

  // Transferencia cart item events
  const addTransferItemBtn = document.getElementById("add-transfer-item-btn");
  if (addTransferItemBtn) {
    addTransferItemBtn.addEventListener("click", () => {
      const prodSelect = document.getElementById("transfer-prod-select");
      const qtyInp = document.getElementById("transfer-qty-input");
      
      const prodId = parseInt(prodSelect.value);
      const qty = parseFloat(qtyInp.value) || 0;
      
      if (qty <= 0) {
        App.showToast("Cantidad inválida", "La cantidad debe ser mayor a 0.", "warning");
        return;
      }

      const optionText = prodSelect.options[prodSelect.selectedIndex].text;
      
      const existing = currentTransferCart.find(item => item.producto_id === prodId);
      if (existing) {
        existing.cantidad += qty;
      } else {
        currentTransferCart.push({
          producto_id: prodId,
          nombre: optionText.split(" [")[0],
          cantidad: qty
        });
      }
      
      qtyInp.value = 1;
      renderTransferCart();
    });
  }

  // Guardar transferencia
  const saveTransferBtn = document.getElementById("save-transfer-btn");
  if (saveTransferBtn) {
    saveTransferBtn.addEventListener("click", async () => {
      const originId = parseInt(document.getElementById("transfer-origin-id").value);
      const destId = parseInt(document.getElementById("transfer-destination-id").value);
      
      if (originId === destId) {
        App.showToast("Sucursal Inválida", "La sucursal de origen y destino no pueden ser iguales.", "warning");
        return;
      }

      if (currentTransferCart.length === 0) {
        App.showToast("Carro Vacío", "Debe agregar al menos un producto a transferir.", "warning");
        return;
      }

      try {
        const payload = {
          sucursal_origen_id: originId,
          sucursal_destino_id: destId,
          items: currentTransferCart.map(item => ({
            producto_id: item.producto_id,
            cantidad: item.cantidad
          }))
        };

        await API.post("/inventory/transfers", payload);
        App.showToast("Transferencia Creada", "Solicitud de transferencia registrada con éxito.", "success");
        document.getElementById("transfer-form-modal").classList.remove("active");
        loadTransfersList();
      } catch (error) {
        App.showToast("Error", error.message || "Fallo al crear transferencia.", "error");
      }
    });
  }

  // Buscador CABYS
  document.getElementById("btn-search-cabys").onclick = openCabysSearchModal;
  document.getElementById("cabys-do-search-btn").onclick = doCabysSearch;
  document.getElementById("cabys-search-input").addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      doCabysSearch();
    }
  });
  document.getElementById("cabys-manual-sync-btn").onclick = triggerCabysManualSync;

  // Cargar Catálogo inicial
  loadProductsList();
}

async function loadProductsList() {
  const tbody = document.getElementById("inventory-products-list");
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="9" style="text-align: center;">Cargando catálogo...</td></tr>`;

  try {
    const search = document.getElementById("inv-search-input").value.trim();
    const showInactive = document.getElementById("inv-show-inactive").checked;
    
    const data = await API.get(`/inventory/products?search=${encodeURIComponent(search)}&include_inactive=${showInactive}`);
    activeCatalog = data;

    if (data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align: center;">No se encontraron productos en el inventario.</td></tr>`;
      return;
    }

    tbody.innerHTML = "";
    data.forEach(p => {
      let stockColor = "";
      if (p.existencia <= 0) {
        stockColor = `<span class="badge badge-danger">Agotado (0)</span>`;
      } else if (p.existencia <= p.stock_minimo) {
        stockColor = `<span class="badge badge-warning">Bajo (${p.existencia})</span>`;
      } else {
        stockColor = `<span>${p.existencia}</span>`;
      }

      const deleteBtn = p.activo 
        ? `<button class="btn btn-secondary btn-delete-prod" data-id="${p.id}" style="padding: 4px 8px; font-size: 0.75rem; background-color: var(--error); border-color: var(--error); color: white;">🗑️ Eliminar</button>`
        : `<button class="btn btn-secondary btn-activate-prod" data-id="${p.id}" style="padding: 4px 8px; font-size: 0.75rem; background-color: var(--success); border-color: var(--success); color: white;">🔄 Restaurar</button>`;

      tbody.innerHTML += `
        <tr>
          <td>
            <strong>${p.sku}</strong><br>
            <span style="font-size:0.75rem; color:var(--text-muted);">EAN: ${p.codigo_barras}</span>
            ${p.codigo_cabys ? `<br><span style="font-size:0.75rem; color:var(--brand-color); font-weight:600;">CABYS: ${p.codigo_cabys}</span>` : ""}
          </td>
          <td>${p.nombre} ${p.activo ? "" : '<span class="badge badge-danger">Inactivo</span>'}</td>
          <td>${p.marca}</td>
          <td>${p.categoria}</td>
          <td>₡${p.precio_costo.toLocaleString("es-CR", { minimumFractionDigits: 2 })}</td>
          <td>₡${p.precio_venta.toLocaleString("es-CR", { minimumFractionDigits: 2 })}</td>
          <td>${p.margen_bruto}%</td>
          <td>${stockColor}</td>
          <td>
            <div style="display: flex; gap: 6px;">
              <button class="btn btn-secondary btn-kardex" data-id="${p.id}" style="padding: 4px 8px; font-size: 0.75rem;">Kárdex</button>
              <button class="btn btn-primary btn-edit-prod" data-id="${p.id}" style="padding: 4px 8px; font-size: 0.75rem;">Editar</button>
              ${deleteBtn}
            </div>
          </td>
        </tr>
      `;
    });

    tbody.querySelectorAll(".btn-edit-prod").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = parseInt(btn.getAttribute("data-id"));
        const prod = activeCatalog.find(p => p.id === id);
        openProductForm(prod);
      });
    });

    tbody.querySelectorAll(".btn-kardex").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = parseInt(btn.getAttribute("data-id"));
        openKardex(id);
      });
    });

    tbody.querySelectorAll(".btn-delete-prod").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = parseInt(btn.getAttribute("data-id"));
        if (confirm("¿Está seguro de eliminar este producto? Se enviará a la Papelera de Reciclaje.")) {
          try {
            await API.delete(`/inventory/products/${id}`);
            App.showToast("Producto Eliminado", "El producto fue enviado a la papelera.", "success");
            loadProductsList();
          } catch (error) {
            App.showToast("Error", error.message, "error");
          }
        }
      });
    });

    tbody.querySelectorAll(".btn-activate-prod").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = parseInt(btn.getAttribute("data-id"));
        const prod = activeCatalog.find(p => p.id === id);
        if (confirm("¿Desea restaurar este producto?")) {
          try {
            await API.put(`/inventory/products/${id}`, { ...prod, activo: true });
            App.showToast("Producto Restaurado", "El producto fue restaurado con éxito.", "success");
            loadProductsList();
          } catch (error) {
            App.showToast("Error", error.message, "error");
          }
        }
      });
    });

  } catch (error) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: var(--error);">Error al cargar inventario: ${error.message}</td></tr>`;
  }
}

// --- IMPERIOS Y EXPORTACIONES ---

async function downloadExport(format) {
  try {
    const q = document.getElementById("inv-search-input").value.trim();
    const showInactive = document.getElementById("inv-show-inactive").checked;
    const filterType = showInactive ? "inactivos" : "all";
    
    const url = `/api/inventory/export?format=${format}&filter_type=${filterType}`;
    
    App.showToast("Exportando", `Generando archivo ${format.toUpperCase()}...`, "info");
    
    const token = API.getToken();
    const headers = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    
    const resp = await fetch(url, { headers });
    if (!resp.ok) {
      throw new Error(`Error de exportación: ${resp.statusText}`);
    }
    
    const blob = await resp.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = downloadUrl;
    
    let ext = format;
    if (format === "excel") ext = "xlsx";
    
    a.download = `reporte_inventario_mym.${ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    
    App.showToast("Exportación", "Archivo descargado con éxito.", "success");
  } catch (error) {
    App.showToast("Error", error.message, "error");
  }
}

async function downloadTemplate() {
  try {
    const url = "/api/inventory/import/template";
    const token = API.getToken();
    const headers = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    
    const resp = await fetch(url, { headers });
    const blob = await resp.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = downloadUrl;
    a.download = "plantilla_productos.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    
    App.showToast("Plantilla", "Plantilla CSV descargada con éxito.", "success");
  } catch (error) {
    App.showToast("Error", error.message, "error");
  }
}

async function previewImport() {
  const fileInput = document.getElementById("import-file-input");
  const file = fileInput.files[0];
  if (!file) {
    App.showToast("Sin Archivo", "Seleccione un archivo CSV o XLSX.", "warning");
    return;
  }

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
      
      const res = await API.post("/inventory/import/preview", payload);
      
      importPreviewItems = res.items;
      
      // Render
      const tbody = document.getElementById("import-preview-table-body");
      tbody.innerHTML = "";
      
      res.items.forEach(item => {
        let statusText = "";
        if (item.errors.length > 0) {
          statusText = `<span style="color:var(--error); font-weight:700;">❌ ${item.errors.join(", ")}</span>`;
        } else if (item.warnings.length > 0) {
          statusText = `<span style="color:var(--warning); font-weight:600;">⚠️ ${item.warnings.join(", ")}</span>`;
        } else {
          statusText = `<span style="color:var(--success);">✅ OK</span>`;
        }
        
        tbody.innerHTML += `
          <tr>
            <td><code>${item.data.sku}</code></td>
            <td>${item.data.nombre}</td>
            <td>₡${item.data.precio_costo}</td>
            <td>₡${item.data.precio_venta}</td>
            <td>${statusText}</td>
          </tr>
        `;
      });
      
      const banner = document.getElementById("import-summary-banner");
      if (res.has_errors) {
        banner.style.backgroundColor = "rgba(220, 53, 69, 0.2)";
        banner.style.color = "var(--error)";
        banner.textContent = `Se detectaron errores en el archivo. Resuelva las inconsistencias antes de continuar. Filas totales: ${res.total_rows}`;
        document.getElementById("confirm-import-btn").disabled = true;
      } else {
        banner.style.backgroundColor = "rgba(40, 167, 69, 0.2)";
        banner.style.color = "var(--success)";
        banner.textContent = `Archivo listo para importar sin errores críticos. Filas totales: ${res.total_rows}`;
        document.getElementById("confirm-import-btn").disabled = false;
      }
      
      document.getElementById("import-preview-zone").style.display = "flex";
      
    } catch (err) {
      App.showToast("Error", "Error al previsualizar el archivo: " + err.message, "error");
    }
  };
  
  reader.readAsDataURL(file);
}

async function confirmImport() {
  if (importPreviewItems.length === 0) return;
  try {
    const res = await API.post("/inventory/import/confirm", { items: importPreviewItems });
    App.showToast("Importación Completa", res.message || "Productos importados con éxito.", "success");
    document.getElementById("import-products-modal").classList.remove("active");
    loadProductsList();
  } catch (error) {
    App.showToast("Error", "Error al confirmar la carga: " + error.message, "error");
  }
}

// --- LOTES Y VENCIMIENTOS LIST ---

async function loadLotsList() {
  const container = document.getElementById("inventory-tab-body");
  if (!container) return;

  container.innerHTML = `
    <div class="table-container" style="margin-top: 0;">
      <table class="data-table">
        <thead>
          <tr>
            <th>Producto</th>
            <th>Lote</th>
            <th>Ingreso</th>
            <th>Vencimiento</th>
            <th>Días Restantes</th>
            <th>Stock Actual</th>
            <th>Alerta</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody id="lots-list-body">
          <tr><td colspan="8" style="text-align: center;">Cargando lotes...</td></tr>
        </tbody>
      </table>
    </div>
  `;

  try {
    const list = await API.get("/inventory/lots");
    const tbody = document.getElementById("lots-list-body");

    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align: center;">No hay lotes registrados actualmente.</td></tr>`;
      return;
    }

    tbody.innerHTML = "";
    list.forEach(l => {
      let badge = "";
      if (l.alerta === "Crítica") {
        badge = `<span class="badge badge-danger">Crítica (Vencido / Pronto)</span>`;
      } else if (l.alerta === "Advertencia") {
        badge = `<span class="badge badge-warning">Advertencia</span>`;
      } else if (l.alerta === "Informativa") {
        badge = `<span class="badge badge-info">Informativa</span>`;
      } else {
        badge = `<span class="badge badge-success">Saludable</span>`;
      }

      tbody.innerHTML += `
        <tr>
          <td><strong>${l.producto_nombre}</strong></td>
          <td><code>${l.numero_lote}</code></td>
          <td>${l.fecha_ingreso}</td>
          <td>${l.fecha_vencimiento}</td>
          <td>${l.dias_restantes} días</td>
          <td>${l.stock_actual}</td>
          <td>${badge}</td>
          <td>
            <button class="btn btn-primary btn-edit-expiry" data-id="${l.id}" data-lote="${l.numero_lote}" data-fecha="${l.fecha_vencimiento}" style="padding: 4px 8px; font-size: 0.75rem;">Editar Venc.</button>
          </td>
        </tr>
      `;
    });

    tbody.querySelectorAll(".btn-edit-expiry").forEach(btn => {
      btn.onclick = () => {
        const id = btn.getAttribute("data-id");
        document.getElementById("edit-expiry-lot-id").value = id;
        document.getElementById("edit-expiry-lot-number").value = btn.getAttribute("data-lote");
        document.getElementById("edit-expiry-date").value = btn.getAttribute("data-fecha");
        document.getElementById("edit-expiry-reason").value = "";
        App.openModal("lot-expiry-modal");
      };
    });

  } catch (error) {
    App.showToast("Lotes", "Error cargando lotes del inventario: " + error.message, "error");
  }
}

async function saveLotExpiry() {
  const id = document.getElementById("edit-expiry-lot-id").value;
  const newDate = document.getElementById("edit-expiry-date").value;
  const reason = document.getElementById("edit-expiry-reason").value.trim();

  if (!newDate || !reason) {
    App.showToast("Error", "Ingrese la fecha de vencimiento y el motivo del cambio.", "warning");
    return;
  }

  try {
    await API.put(`/inventory/lots/${id}/expiry`, {
      fecha_vencimiento: newDate,
      motivo: reason
    });
    
    App.showToast("Lote Actualizado", "Fecha de vencimiento actualizada correctamente.", "success");
    document.getElementById("lot-expiry-modal").classList.remove("active");
    loadLotsList();
  } catch (error) {
    App.showToast("Error", error.message || "Fallo al modificar vencimiento.", "error");
  }
}

// --- FORMULARIOS ---

async function openProductForm(product = null) {
  const modal = document.getElementById("product-form-modal");
  const form = document.getElementById("product-form");
  form.reset();

  const title = document.getElementById("modal-product-title");
  const idInp = document.getElementById("form-product-id");
  const activeContainer = document.getElementById("form-active-container");
  const stockInicialContainer = document.getElementById("form-stock-inicial-container");

  const selectMarca = document.getElementById("form-marca");
  const selectSub = document.getElementById("form-subcat");
  const selectTax = document.getElementById("form-tax");
  const selectProveedor = document.getElementById("form-proveedor");

  const costInp = document.getElementById("form-cost");
  const priceInp = document.getElementById("form-price");

  try {
    const marcas = await API.get("/inventory/marcas");
    const cats = await API.get("/inventory/categories");
    const taxes = await API.get("/inventory/taxes");
    const proveedores = await API.get("/purchases/providers");

    selectMarca.innerHTML = marcas.map(m => `<option value="${m.id}">${m.nombre}</option>`).join("");
    selectTax.innerHTML = taxes.map(t => `<option value="${t.id}">${t.nombre} (${t.porcentaje}%)</option>`).join("");
    selectProveedor.innerHTML = `<option value="">Sin proveedor</option>` + 
      proveedores.map(p => `<option value="${p.id}">${p.nombre}</option>`).join("");
    
    let subOptions = [];
    cats.forEach(c => {
      c.subcategorias.forEach(s => {
        subOptions.push(`<option value="${s.id}">${c.nombre} > ${s.nombre}</option>`);
      });
    });
    selectSub.innerHTML = subOptions.join("");

    if (product) {
      title.textContent = `Editar Producto: ${product.nombre}`;
      idInp.value = product.id;
      
      document.getElementById("form-sku").value = product.sku;
      document.getElementById("form-barcode").value = product.codigo_barras;
      document.getElementById("form-name").value = product.nombre;
      document.getElementById("form-marca").value = product.marca_id;
      document.getElementById("form-subcat").value = product.subcategoria_id;
      document.getElementById("form-unidad").value = product.unidad_medida;
      document.getElementById("form-cost").value = product.precio_costo;
      document.getElementById("form-price").value = product.precio_venta;
      document.getElementById("form-wholesale").value = product.precio_mayorista;
      document.getElementById("form-tax").value = product.impuesto_id;
      document.getElementById("form-image-path").value = product.imagen_path || "";
      document.getElementById("form-stock-min").value = product.stock_minimo;
      document.getElementById("form-stock-max").value = product.stock_maximo;
      document.getElementById("form-desc").value = product.descripcion || "";
      selectProveedor.value = product.proveedor_id || "";
      document.getElementById("form-cabys").value = product.codigo_cabys || "";
      
      activeContainer.style.display = "block";
      document.getElementById("form-activo").value = product.activo ? "true" : "false";
      stockInicialContainer.style.display = "none";
      
      costInp.dispatchEvent(new Event("input"));
    } else {
      title.textContent = "Nuevo Producto";
      idInp.value = "";
      activeContainer.style.display = "none";
      stockInicialContainer.style.display = "block";
      document.getElementById("form-stock-inicial").value = "0";
      selectProveedor.value = "";
      document.getElementById("form-margin-display").value = "0.0%";
      document.getElementById("form-cabys").value = "";
    }

    modal.classList.add("active");
  } catch (error) {
    App.showToast("Catálogo", "Error inicializando formulario: " + error.message, "error");
  }
}

async function saveProduct() {
  const id = document.getElementById("form-product-id").value;
  const payload = {
    sku: document.getElementById("form-sku").value.trim(),
    codigo_barras: document.getElementById("form-barcode").value.trim(),
    nombre: document.getElementById("form-name").value.trim(),
    marca_id: parseInt(document.getElementById("form-marca").value),
    subcategoria_id: parseInt(document.getElementById("form-subcat").value),
    unidad_medida: document.getElementById("form-unidad").value,
    precio_costo: parseFloat(document.getElementById("form-cost").value),
    precio_venta: parseFloat(document.getElementById("form-price").value),
    precio_mayorista: parseFloat(document.getElementById("form-wholesale").value) || 0.0,
    impuesto_id: parseInt(document.getElementById("form-tax").value),
    imagen_path: document.getElementById("form-image-path").value.trim() || null,
    stock_minimo: parseFloat(document.getElementById("form-stock-min").value) || 0,
    stock_maximo: parseFloat(document.getElementById("form-stock-max").value) || 100,
    descripcion: document.getElementById("form-desc").value.trim(),
    codigo_cabys: document.getElementById("form-cabys").value.trim() || null
  };

  const proveedorVal = document.getElementById("form-proveedor").value;
  payload.proveedor_id = proveedorVal ? parseInt(proveedorVal) : null;

  if (!id) {
    payload.existencia_inicial = parseFloat(document.getElementById("form-stock-inicial").value) || 0.0;
  }

  // Validaciones
  if (!payload.sku || !payload.codigo_barras || !payload.nombre || isNaN(payload.marca_id) || isNaN(payload.subcategoria_id) || isNaN(payload.impuesto_id)) {
    App.showToast("Campos obligatorios", "Por favor complete todos los campos requeridos.", "warning");
    return;
  }
  if (payload.precio_costo < 0 || payload.precio_venta < 0 || payload.precio_mayorista < 0) {
    App.showToast("Precios incorrectos", "Los precios y costos no pueden ser negativos.", "warning");
    return;
  }
  if (payload.stock_minimo < 0 || payload.stock_maximo < 0) {
    App.showToast("Límites incorrectos", "El stock mínimo y máximo no pueden ser negativos.", "warning");
    return;
  }
  if (payload.stock_maximo < payload.stock_minimo) {
    App.showToast("Límites incorrectos", "El stock máximo no puede ser menor al stock mínimo.", "warning");
    return;
  }

  // Alerta opcional para facturación electrónica (CABYS es opcional para guardar, pero advertimos)
  if (!payload.codigo_cabys) {
    App.showToast("CABYS Opcional", "Advertencia: El código CABYS será requerido en el futuro para facturación electrónica.", "warning");
  }
  if (!id && payload.existencia_inicial < 0) {
    App.showToast("Stock inicial incorrecto", "La existencia inicial no puede ser negativa.", "warning");
    return;
  }

  try {
    if (id) {
      payload.activo = document.getElementById("form-activo").value === "true";
      await API.put(`/inventory/products/${id}`, payload);
      App.showToast("Producto Actualizado", "El producto fue editado correctamente.", "success");
    } else {
      await API.post("/inventory/products", payload);
      App.showToast("Producto Creado", "El producto se registró en el catálogo.", "success");
    }
    document.getElementById("product-form-modal").classList.remove("active");
    loadProductsList();
  } catch (error) {
    App.showToast("Error", error.message || "No se pudo guardar el producto.", "error");
  }
}

// --- LOTES ---

async function openLotForm() {
  const modal = document.getElementById("lot-form-modal");
  const select = document.getElementById("lot-product-id");

  try {
    const products = await API.get("/inventory/products");
    select.innerHTML = products.map(p => `<option value="${p.id}">${p.nombre} [${p.sku}]</option>`).join("");
    modal.classList.add("active");
  } catch (error) {
    App.showToast("Lotes", "No se cargaron los productos: " + error.message, "error");
  }
}

async function saveLot() {
  const payload = {
    producto_id: parseInt(document.getElementById("lot-product-id").value),
    numero_lote: document.getElementById("lot-number").value.trim(),
    stock_inicial: parseFloat(document.getElementById("lot-qty").value),
    fecha_vencimiento: document.getElementById("lot-expiry-date").value
  };

  if (!payload.numero_lote || !payload.stock_inicial || !payload.fecha_vencimiento) {
    App.showToast("Campos Vacíos", "Ingrese lote, cantidad y fecha de vencimiento.", "warning");
    return;
  }

  try {
    await API.post("/inventory/lots", payload);
    App.showToast("Lote Creado", "Lote ingresado y existencias sumadas con éxito.", "success");
    document.getElementById("lot-form-modal").classList.remove("active");
    
    if (document.getElementById("tab-lots").classList.contains("active")) {
      loadLotsList();
    } else {
      loadProductsList();
    }
  } catch (error) {
    App.showToast("Error", error.message || "Fallo en creación del lote", "error");
  }
}

// --- AJUSTES ---

async function openAdjustForm() {
  const modal = document.getElementById("adjust-form-modal");
  const select = document.getElementById("adjust-product-id");

  document.getElementById("adjust-qty").value = "";
  document.getElementById("adjust-type").value = "aumentar";
  document.getElementById("adjust-reason-select").value = "Corrección de Conteo";
  document.getElementById("adjust-reason-custom").value = "";

  try {
    const products = await API.get("/inventory/products");
    select.innerHTML = products.map(p => `<option value="${p.id}">${p.nombre} [Stock: ${p.existencia}]</option>`).join("");
    modal.classList.add("active");
  } catch (error) {
    App.showToast("Ajustes", "No se cargaron los productos.", "error");
  }
}

async function saveAdjust() {
  const prodId = parseInt(document.getElementById("adjust-product-id").value);
  const tipoAjuste = document.getElementById("adjust-type").value;
  const qty = parseFloat(document.getElementById("adjust-qty").value);

  const reasonSelect = document.getElementById("adjust-reason-select").value;
  const reasonCustom = document.getElementById("adjust-reason-custom").value.trim();

  let motivo = reasonSelect;
  if (reasonCustom) {
    motivo = `${reasonSelect} - ${reasonCustom}`;
  }

  if (isNaN(qty) || qty < 0.0 || (qty === 0.0 && tipoAjuste !== "fijar")) {
    App.showToast("Cantidad inválida", "La cantidad debe ser mayor a 0 (excepto al fijar stock).", "warning");
    return;
  }

  const payload = {
    producto_id: prodId,
    tipo_ajuste: tipoAjuste,
    cantidad: qty,
    motivo: motivo
  };

  try {
    await API.post("/inventory/adjust", payload);
    App.showToast("Inventario Ajustado", "Se registró el movimiento de ajuste con éxito.", "success");
    document.getElementById("adjust-form-modal").classList.remove("active");
    loadProductsList();
  } catch (error) {
    App.showToast("Error", error.message || "Error al ajustar stock.", "error");
  }
}

// --- VER KÁRDEX ---

async function openKardex(productId) {
  const modal = document.getElementById("kardex-modal");
  const tbody = document.getElementById("kardex-list");
  
  tbody.innerHTML = `<tr><td colspan="5" style="text-align: center;">Cargando movimientos...</td></tr>`;
  modal.classList.add("active");

  try {
    const list = await API.get(`/inventory/kardex/${productId}`);
    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align: center;">Sin movimientos en Kárdex aún.</td></tr>`;
      return;
    }

    tbody.innerHTML = "";
    list.forEach(m => {
      const isEntrada = m.tipo === "entrada";
      const badge = isEntrada 
        ? `<span class="badge badge-success">Entrada</span>`
        : `<span class="badge badge-danger">Salida</span>`;
      
      tbody.innerHTML += `
        <tr>
          <td>${new Date(m.fecha).toLocaleString("es-CR")}</td>
          <td>${badge}</td>
          <td><strong>${isEntrada ? "+" : "-"}${m.cantidad}</strong></td>
          <td>${m.motivo}</td>
          <td>${m.usuario}</td>
        </tr>
      `;
    });
  } catch (error) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--error);">Error al cargar Kárdex: ${error.message}</td></tr>`;
  }
}

// --- GESTIÓN DE TRANSFERENCIAS SUCURSALES ---

async function loadTransfersList() {
  const container = document.getElementById("inventory-tab-body");
  if (!container) return;

  container.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 16px;">
      <div class="flex-between">
        <h4>Historial de Transferencias</h4>
        <button id="open-transfer-modal-btn" class="btn btn-primary">➕ Solicitar Transferencia</button>
      </div>
      <div class="table-container" style="margin-top: 0;">
        <table class="data-table">
          <thead>
            <tr>
              <th>ID / Fecha</th>
              <th>Origen</th>
              <th>Destino</th>
              <th>Usuario</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody id="transfers-list-body">
            <tr><td colspan="6" style="text-align: center;">Cargando transferencias...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  document.getElementById("open-transfer-modal-btn").addEventListener("click", openTransferForm);

  try {
    const list = await API.get("/inventory/transfers");
    const tbody = document.getElementById("transfers-list-body");

    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">No hay transferencias registradas.</td></tr>`;
      return;
    }

    tbody.innerHTML = "";
    list.forEach(t => {
      let stateBadge = "";
      if (t.estado === "solicitada") {
        stateBadge = `<span class="badge badge-info">Solicitada</span>`;
      } else if (t.estado === "despachada") {
        stateBadge = `<span class="badge badge-warning">Despachada</span>`;
      } else if (t.estado === "recibida") {
        stateBadge = `<span class="badge badge-success">Recibida</span>`;
      } else {
        stateBadge = `<span class="badge badge-secondary">${t.estado}</span>`;
      }

      let actionButtons = `<button class="btn btn-secondary btn-view-transfer" data-id="${t.id}" style="padding: 4px 8px; font-size: 0.75rem;">Ver</button>`;
      
      if (t.estado === "solicitada") {
        actionButtons += ` <button class="btn btn-primary btn-dispatch-transfer" data-id="${t.id}" style="padding: 4px 8px; font-size: 0.75rem; background-color: var(--warning); border-color: var(--warning);">Despachar</button>`;
      } else if (t.estado === "despachada") {
        actionButtons += ` <button class="btn btn-primary btn-receive-transfer" data-id="${t.id}" style="padding: 4px 8px; font-size: 0.75rem; background-color: var(--success); border-color: var(--success);">Recibir</button>`;
      }

      tbody.innerHTML += `
        <tr>
          <td><strong>#${t.id}</strong><br><span style="font-size: 0.75rem; color: var(--text-muted);">${new Date(t.fecha).toLocaleString("es-CR")}</span></td>
          <td>${t.sucursal_origen_nombre}</td>
          <td>${t.sucursal_destino_nombre}</td>
          <td>${t.usuario_nombre}</td>
          <td>${stateBadge}</td>
          <td>${actionButtons}</td>
        </tr>
      `;
    });

    tbody.querySelectorAll(".btn-view-transfer").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = parseInt(btn.getAttribute("data-id"));
        const transfer = list.find(x => x.id === id);
        showTransferDetails(transfer);
      });
    });

    tbody.querySelectorAll(".btn-dispatch-transfer").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = parseInt(btn.getAttribute("data-id"));
        if (confirm("¿Está seguro de despachar esta transferencia? Se restará el stock de la sucursal origen.")) {
          try {
            await API.post(`/inventory/transfers/${id}/dispatch`);
            App.showToast("Despacho", "Transferencia despachada y stock de origen actualizado.", "success");
            loadTransfersList();
          } catch (error) {
            App.showToast("Error", error.message || "Fallo al despachar transferencia.", "error");
          }
        }
      });
    });

    tbody.querySelectorAll(".btn-receive-transfer").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = parseInt(btn.getAttribute("data-id"));
        if (confirm("¿Desea dar por recibida esta transferencia? Se ingresará el stock en la sucursal de destino.")) {
          try {
            await API.post(`/inventory/transfers/${id}/receive`);
            App.showToast("Recibido", "Transferencia recibida e inventario sumado en destino.", "success");
            loadTransfersList();
          } catch (error) {
            App.showToast("Error", error.message || "Fallo al recibir transferencia.", "error");
          }
        }
      });
    });

  } catch (error) {
    App.showToast("Transferencias", "Error al cargar transferencias: " + error.message, "error");
  }
}

async function openTransferForm() {
  const modal = document.getElementById("transfer-form-modal");
  const originSelect = document.getElementById("transfer-origin-id");
  const destSelect = document.getElementById("transfer-destination-id");
  const prodSelect = document.getElementById("transfer-prod-select");
  
  currentTransferCart = [];
  renderTransferCart();

  try {
    const branches = await API.get("/inventory/branches");
    const products = await API.get("/inventory/products");

    originSelect.innerHTML = branches.map(b => `<option value="${b.id}">${b.nombre}</option>`).join("");
    destSelect.innerHTML = branches.map(b => `<option value="${b.id}">${b.nombre}</option>`).join("");
    
    const user = API.getUserInfo();
    if (user && user.sucursal_id) {
      originSelect.value = user.sucursal_id;
      const other = branches.find(b => b.id !== user.sucursal_id);
      if (other) destSelect.value = other.id;
    }

    prodSelect.innerHTML = products.map(p => `<option value="${p.id}">${p.nombre} [${p.sku}] - Stock: ${p.existencia}</option>`).join("");

    modal.classList.add("active");
  } catch (error) {
    App.showToast("Error", "Error al cargar datos del formulario: " + error.message, "error");
  }
}

function renderTransferCart() {
  const tbody = document.getElementById("transfer-items-list-body");
  if (!tbody) return;

  if (currentTransferCart.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" style="text-align: center; color: var(--text-muted);">No hay productos agregados.</td></tr>`;
    return;
  }

  tbody.innerHTML = "";
  currentTransferCart.forEach((item, index) => {
    tbody.innerHTML += `
      <tr>
        <td>${item.nombre}</td>
        <td><strong>${item.cantidad}</strong></td>
        <td>
          <button class="btn btn-secondary" onclick="window.removeTransferItem(${index})" style="padding: 2px 6px; font-size: 0.7rem;">Eliminar</button>
        </td>
      </tr>
    `;
  });
}

window.removeTransferItem = (index) => {
  currentTransferCart.splice(index, 1);
  renderTransferCart();
};

function showTransferDetails(transfer) {
  const modal = document.getElementById("transfer-detail-modal");
  
  document.getElementById("lbl-transfer-origin").textContent = transfer.sucursal_origen_nombre;
  document.getElementById("lbl-transfer-dest").textContent = transfer.sucursal_destino_nombre;
  document.getElementById("lbl-transfer-user").textContent = transfer.usuario_nombre;
  document.getElementById("lbl-transfer-status").textContent = transfer.estado.toUpperCase();

  const tbody = document.getElementById("transfer-detail-items-body");
  tbody.innerHTML = "";
  
  transfer.detalles.forEach(d => {
    tbody.innerHTML += `
      <tr>
        <td><code>${d.sku || "N/A"}</code></td>
        <td>${d.producto_nombre}</td>
        <td><strong>${d.cantidad}</strong></td>
      </tr>
    `;
  });

  modal.classList.add("active");
}

// --- FUNCIONES DEL BUSCADOR CABYS ---

async function loadCabysMetadata() {
  const statusEl = document.getElementById("cabys-meta-status");
  const recordsEl = document.getElementById("cabys-meta-records");
  const dateEl = document.getElementById("cabys-meta-date");
  if (!statusEl) return;

  try {
    const data = await API.get("/inventory/cabys/status");
    let statusText = data.status;
    if (data.status === "syncing") {
      statusText = '<span style="color: var(--warning); font-weight: bold;">⏳ Sincronizando...</span>';
      setTimeout(loadCabysMetadata, 4000);
    } else if (data.status === "success") {
      statusText = '<span style="color: var(--success); font-weight: bold;">🟢 Listo</span>';
    } else if (data.status === "failed") {
      statusText = `<span style="color: var(--error); font-weight: bold;" title="${data.error || ''}">🔴 Fallido</span>`;
    } else {
      statusText = '<span style="color: var(--text-muted);">⚪ Vacío</span>';
    }

    statusEl.innerHTML = statusText;
    recordsEl.textContent = data.total_records.toLocaleString("es-CR");
    
    if (data.last_update) {
      dateEl.textContent = new Date(data.last_update).toLocaleString("es-CR");
    } else {
      dateEl.textContent = "N/A";
    }
  } catch (error) {
    statusEl.textContent = "Error";
  }
}

async function triggerCabysManualSync() {
  const syncBtn = document.getElementById("cabys-manual-sync-btn");
  if (!syncBtn) return;
  syncBtn.disabled = true;
  const originalText = syncBtn.textContent;
  syncBtn.textContent = "⏳ Iniciando...";

  try {
    await API.post("/inventory/cabys/sync");
    App.showToast("Sincronización Iniciada", "La sincronización con el BCCR se ha iniciado en segundo plano.", "success");
    setTimeout(loadCabysMetadata, 2000);
  } catch (error) {
    App.showToast("Error de Sincronización", error.message || "No se pudo iniciar la sincronización.", "error");
  } finally {
    syncBtn.disabled = false;
    syncBtn.textContent = originalText;
  }
}

function openCabysSearchModal() {
  document.getElementById("cabys-search-input").value = "";
  document.getElementById("cabys-loading-indicator").style.display = "none";
  document.getElementById("cabys-results-container").style.display = "none";
  document.getElementById("cabys-no-results").style.display = "none";
  document.getElementById("cabys-results-body").innerHTML = "";
  
  loadCabysMetadata();
  App.openModal("cabys-search-modal");
  setTimeout(() => {
    document.getElementById("cabys-search-input").focus();
  }, 150);
}

async function doCabysSearch() {
  const query = document.getElementById("cabys-search-input").value.trim();
  if (!query) {
    App.showToast("Búsqueda vacía", "Por favor ingrese un término para buscar.", "warning");
    return;
  }

  const loading = document.getElementById("cabys-loading-indicator");
  const container = document.getElementById("cabys-results-container");
  const noResults = document.getElementById("cabys-no-results");
  const tbody = document.getElementById("cabys-results-body");

  loading.style.display = "block";
  container.style.display = "none";
  noResults.style.display = "none";
  tbody.innerHTML = "";

  try {
    const data = await API.get(`/inventory/cabys?q=${encodeURIComponent(query)}`);
    loading.style.display = "none";

    if (data && data.length > 0) {
      container.style.display = "block";
      data.forEach(item => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td><strong>${item.codigo}</strong></td>
          <td style="font-size: 0.85rem;" title="${item.descripcion}">${item.descripcion}</td>
          <td style="text-align: center;">
            <button class="btn btn-primary btn-select-cabys" data-code="${item.codigo}" style="padding: 4px 8px; font-size: 0.75rem;">Seleccionar</button>
          </td>
        `;
        tbody.appendChild(tr);
      });

      tbody.querySelectorAll(".btn-select-cabys").forEach(btn => {
        btn.onclick = () => {
          const code = btn.getAttribute("data-code");
          document.getElementById("form-cabys").value = code;
          document.getElementById("cabys-search-modal").classList.remove("active");
        };
      });
    } else {
      noResults.style.display = "block";
    }
  } catch (error) {
    loading.style.display = "none";
    App.showToast("Buscador CABYS", "Error consultando catálogo: " + error.message, "error");
  }
}

