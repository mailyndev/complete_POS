import { API } from "./api.js";
import { App } from "./app.js";

export async function renderBilling(container) {
  container.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 24px;">
      
      <!-- Resumen de Facturación (Widgets) -->
      <div class="dashboard-grid" id="billing-widgets-grid">
        <div style="grid-column: 1/-1; text-align: center; padding: 20px;">Cargando resumen de facturas...</div>
      </div>

      <!-- Tabla de Comprobantes Recientes -->
      <div class="dashboard-panel">
        <div class="panel-header flex-between">
          <h3>Comprobantes Electrónicos Enviados (Hacienda Costa Rica)</h3>
          <button id="refresh-billing-btn" class="btn btn-secondary">🔄 Actualizar</button>
        </div>
        <div class="table-container" style="margin-top: 0;">
          <table class="data-table">
            <thead>
              <tr>
                <th>Venta Ref</th>
                <th>Clave Numérica (50 Dígitos)</th>
                <th>Consecutivo Hacienda</th>
                <th>Fecha Envió</th>
                <th>Total Neto</th>
                <th>Estado Hacienda</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody id="billing-documents-list">
              <tr><td colspan="7" style="text-align: center;">Buscando registros electrónicos...</td></tr>
            </tbody>
          </table>
        </div>
      </div>

    </div>

    <!-- MODAL: VER XML / DETALLE -->
    <div id="xml-detail-modal" class="modal-wrapper">
      <div class="modal-card" style="width: 700px; max-width: 90%;">
        <div class="modal-header">
          <h3>Documento XML - Detalle de Hacienda</h3>
          <button class="close-btn" onclick="document.getElementById('xml-detail-modal').classList.remove('active')">&times;</button>
        </div>
        <div class="modal-body" style="display: flex; flex-direction: column; gap: 16px;">
          <div>
            <p><strong>Clave de Documento:</strong> <code id="xml-lbl-clave" style="font-size: 0.9rem; word-break: break-all;"></code></p>
          </div>
          
          <div style="display: flex; gap: 16px; border-bottom: 1px solid var(--border-color); padding-bottom: 8px;">
            <button class="category-tab active" id="tab-xml-envio">XML Enviado a Hacienda</button>
            <button class="category-tab" id="tab-xml-respuesta">XML Respuesta de Hacienda</button>
          </div>
          
          <div style="background-color: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 12px; max-height: 300px; overflow: auto;">
            <pre id="xml-code-display" style="margin: 0; font-family: monospace; font-size: 0.75rem; white-space: pre-wrap; word-break: break-all; color: var(--text-primary);"></pre>
          </div>
        </div>
      </div>
    </div>
  `;

  document.getElementById("refresh-billing-btn").addEventListener("click", () => loadBillingDashboard());

  // Cargar datos
  loadBillingDashboard();
}

let activeInvoices = [];

async function loadBillingDashboard() {
  const widgetsGrid = document.getElementById("billing-widgets-grid");
  const tbody = document.getElementById("billing-documents-list");

  if (!widgetsGrid || !tbody) return;

  try {
    const data = await API.get("/billing/dashboard");
    activeInvoices = data.recientes;

    // Render Widgets
    widgetsGrid.innerHTML = `
      <div class="stat-card">
        <div class="stat-header">
          <span class="stat-title">Total Comprobantes</span>
          <div class="stat-icon">📑</div>
        </div>
        <div class="stat-value">${data.total}</div>
        <div class="stat-footer">Generados por ventas</div>
      </div>

      <div class="stat-card" style="border-left: 4px solid var(--success);">
        <div class="stat-header">
          <span class="stat-title">Aceptados Hacienda</span>
          <div class="stat-icon" style="color:var(--success);">✅</div>
        </div>
        <div class="stat-value" style="color:var(--success);">${data.aceptadas}</div>
        <div class="stat-footer">Autorizados satisfactoriamente</div>
      </div>

      <div class="stat-card" style="border-left: 4px solid var(--error);">
        <div class="stat-header">
          <span class="stat-title">Rechazados Hacienda</span>
          <div class="stat-icon" style="color:var(--error);">❌</div>
        </div>
        <div class="stat-value" style="color:var(--error);">${data.rechazadas}</div>
        <div class="stat-footer">Errores de validación XML</div>
      </div>

      <div class="stat-card" style="border-left: 4px solid var(--warning);">
        <div class="stat-header">
          <span class="stat-title">Anuladas (N. Crédito)</span>
          <div class="stat-icon" style="color:var(--warning);">🔄</div>
        </div>
        <div class="stat-value" style="color:var(--warning);">${data.anuladas}</div>
        <div class="stat-footer">Ventas devueltas/canceladas</div>
      </div>
    `;

    // Render Table
    if (activeInvoices.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted);">No hay comprobantes electrónicos emitidos.</td></tr>`;
      return;
    }

    tbody.innerHTML = "";
    activeInvoices.forEach(f => {
      let badge = "";
      if (f.estado_hacienda === "Aceptado") {
        badge = `<span class="badge badge-success">Aceptado</span>`;
      } else if (f.estado_hacienda === "Rechazado") {
        badge = `<span class="badge badge-danger">Rechazado</span>`;
      } else if (f.estado_hacienda === "Anulada") {
        badge = `<span class="badge badge-warning">Anulado (NC)</span>`;
      } else {
        badge = `<span class="badge badge-secondary">${f.estado_hacienda}</span>`;
      }

      // Truncar la clave de 50 caracteres para mejorar la visualización
      const claveTrunc = f.clave.substring(0, 10) + "..." + f.clave.substring(40);

      // Botón de anular solo si no está ya anulada
      let actionButtons = `
        <button class="btn btn-secondary btn-view-xml" data-id="${f.id}" style="padding: 4px 8px; font-size: 0.75rem;">XML</button>
      `;
      if (f.estado_hacienda === "Aceptado") {
        actionButtons += `
          <button class="btn btn-primary btn-cancel-inv" data-id="${f.id}" style="padding: 4px 8px; font-size: 0.75rem; background-color: var(--error); border-color: var(--error);">Anular</button>
        `;
      } else if (f.estado_hacienda === "Rechazado") {
        actionButtons += `
          <button class="btn btn-primary btn-retry-inv" data-venta-id="${f.venta_id}" style="padding: 4px 8px; font-size: 0.75rem; background-color: var(--info); border-color: var(--info);">Re-emitir</button>
        `;
      }

      tbody.innerHTML += `
        <tr>
          <td><strong>${f.venta_consecutivo}</strong></td>
          <td><code title="${f.clave}">${claveTrunc}</code> <button class="btn btn-secondary" onclick="navigator.clipboard.writeText('${f.clave}'); alert('Clave copiada');" style="padding: 2px 4px; font-size: 0.65rem;">📋</button></td>
          <td><code>${f.consecutivo}</code></td>
          <td>${new Date(f.fecha_envio).toLocaleString("es-CR")}</td>
          <td><strong>₡${f.total.toLocaleString("es-CR", { minimumFractionDigits: 2 })}</strong></td>
          <td>${badge}</td>
          <td>${actionButtons}</td>
        </tr>
      `;
    });

    // Event listeners
    tbody.querySelectorAll(".btn-view-xml").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = parseInt(btn.getAttribute("data-id"));
        openXmlViewer(id);
      });
    });

    tbody.querySelectorAll(".btn-cancel-inv").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = parseInt(btn.getAttribute("data-id"));
        if (confirm("¿Está seguro de anular esta factura electrónica? Esto emitirá una Nota de Crédito autorizada por Hacienda y devolverá la mercadería al inventario.")) {
          try {
            await API.post(`/billing/invoice/${id}/cancel`);
            App.showToast("Factura Anulada", "La Nota de Crédito fue aprobada por Hacienda. Stock retornado.", "success");
            loadBillingDashboard();
          } catch (error) {
            App.showToast("Error", error.message || "Fallo al anular factura.", "error");
          }
        }
      });
    });

    tbody.querySelectorAll(".btn-retry-inv").forEach(btn => {
      btn.addEventListener("click", async () => {
        const ventaId = parseInt(btn.getAttribute("data-venta-id"));
        try {
          await API.post(`/billing/emit/${ventaId}`);
          App.showToast("Re-emisión exitosa", "El comprobante fue re-enviado y validado.", "success");
          loadBillingDashboard();
        } catch (error) {
          App.showToast("Error", error.message || "Fallo al re-emitir comprobante.", "error");
        }
      });
    });

  } catch (error) {
    App.showToast("Facturación", "Error al cargar dashboard de facturas: " + error.message, "error");
  }
}

async function openXmlViewer(id) {
  const modal = document.getElementById("xml-detail-modal");
  const display = document.getElementById("xml-code-display");
  const labelClave = document.getElementById("xml-lbl-clave");

  try {
    // Buscar la factura en nuestra lista local
    const invoice = activeInvoices.find(f => f.id === id);
    if (!invoice) return;

    // Obtener detalles completos incluyendo XMLs desde el API
    const details = await API.get(`/billing/invoice/${invoice.venta_id}`);
    
    labelClave.textContent = details.clave;

    // Pestañas
    const tabEnvio = document.getElementById("tab-xml-envio");
    const tabRespuesta = document.getElementById("tab-xml-respuesta");

    const renderXml = (xmlString) => {
      // Escapar caracteres XML para mostrar en HTML
      display.textContent = xmlString || "No disponible.";
    };

    tabEnvio.onclick = () => {
      tabRespuesta.classList.remove("active");
      tabEnvio.classList.add("active");
      renderXml(details.xml_enviado);
    };

    tabRespuesta.onclick = () => {
      tabEnvio.classList.remove("active");
      tabRespuesta.classList.add("active");
      renderXml(details.xml_respuesta);
    };

    // Renderizar primero XML Enviado
    tabEnvio.click();
    modal.classList.add("active");

  } catch (error) {
    App.showToast("Error", "No se pudieron obtener los detalles del XML: " + error.message, "error");
  }
}
