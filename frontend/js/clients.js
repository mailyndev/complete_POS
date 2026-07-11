import { API } from "./api.js";
import { App } from "./app.js";

let clientsDirectory = [];
let editingClientId = null;

export async function renderClients(container) {
  container.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 24px;">
      
      <!-- Cabecera de Módulo -->
      <div class="flex-between">
        <div style="display: flex; gap: 16px; border-bottom: 1px solid var(--border-color); padding-bottom: 8px;">
          <button class="category-tab active" id="tab-clients-list">Directorio de Clientes</button>
          <button class="category-tab" id="tab-clients-credit">Control de Créditos y Cobros</button>
        </div>
        <button id="btn-create-client" class="btn btn-primary">➕ Nuevo Cliente</button>
      </div>

      <!-- Controles de Filtros y Búsqueda (Se muestran/ocultan según pestaña) -->
      <div id="clients-controls-bar" class="dashboard-panel" style="padding: 16px; display: flex; flex-wrap: wrap; gap: 16px; align-items: center;">
        <div class="form-group" style="margin-bottom:0; flex-direction: row; gap: 12px; align-items: center; flex: 1;">
          <input type="text" id="clients-search-input" class="input-field" placeholder="Buscar por identificación, nombre, teléfono o correo..." style="max-width: 380px;">
          <button id="clients-search-btn" class="btn btn-secondary">🔍 Buscar</button>
        </div>
        <div id="clients-inactive-toggle-container" style="display: flex; align-items: center; gap: 8px;">
          <label style="display: flex; align-items: center; gap: 8px; font-size: 0.9rem; cursor: pointer; user-select: none;">
            <input type="checkbox" id="cli-show-inactive"> 🗑️ Ver Papelera (Inactivos)
          </label>
        </div>
      </div>

      <!-- CUERPO DE CONTENEDOR SEGÚN PESTAÑA -->
      <div id="clients-tab-body">
        <!-- Directorio de Clientes (Default) -->
        <div class="table-container" style="margin-top: 0;">
          <table class="data-table">
            <thead>
              <tr>
                <th>Identificación</th>
                <th>Nombre</th>
                <th>Teléfono</th>
                <th>Correo</th>
                <th>Límite Crédito</th>
                <th>Saldo Deudor</th>
                <th>Puntos Acumulados</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody id="clients-list-body">
              <tr><td colspan="8" style="text-align: center;">Cargando directorio...</td></tr>
            </tbody>
          </table>
        </div>
      </div>

    </div>

    <!-- MODAL: CREAR / EDITAR CLIENTE -->
    <div id="client-form-modal" class="modal-wrapper">
      <div class="modal-card">
        <div class="modal-header">
          <h3 id="client-modal-title">Registrar Nuevo Cliente</h3>
          <button class="close-btn" onclick="document.getElementById('client-form-modal').classList.remove('active')">&times;</button>
        </div>
        <div class="modal-body" style="display: flex; flex-direction: column; gap: 16px;">
          <div class="grid-cols-2">
            <div class="form-group">
              <label>Identificación (Cédula / RUC)</label>
              <input type="text" id="cli-identificacion" class="input-field" placeholder="ej. 101230456" required>
            </div>
            <div class="form-group">
              <label>Nombre Completo</label>
              <input type="text" id="cli-nombre" class="input-field" placeholder="ej. Juan Pérez Castro" required>
            </div>
          </div>
          <div class="grid-cols-2">
            <div class="form-group">
              <label>Teléfono de Contacto</label>
              <input type="text" id="cli-telefono" class="input-field" placeholder="ej. 8888-9999">
            </div>
            <div class="form-group">
              <label>Correo Electrónico</label>
              <input type="email" id="cli-correo" class="input-field" placeholder="ej. juan.perez@correo.com">
            </div>
          </div>
          <div class="grid-cols-2">
            <div class="form-group">
              <label>Límite de Crédito Permitido (₡)</label>
              <input type="number" id="cli-limite-credito" class="input-field" value="0" placeholder="₡0.00">
            </div>
            <div class="form-group" id="cli-active-container" style="display:none;">
              <label>Estado del Cliente</label>
              <select id="cli-activo" class="input-field">
                <option value="true">Activo</option>
                <option value="false">Inactivo</option>
              </select>
            </div>
          </div>
          <div class="form-group">
            <label>Dirección Residencia</label>
            <input type="text" id="cli-direccion" class="input-field" placeholder="ej. Barrio El Muelle, Puntarenas">
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="document.getElementById('client-form-modal').classList.remove('active')">Cancelar</button>
          <button id="save-client-btn" class="btn btn-primary">Guardar Cliente</button>
        </div>
      </div>
    </div>

    <!-- MODAL: REGISTRAR ABONO (PAGO DE CRÉDITO) -->
    <div id="credit-pay-modal" class="modal-wrapper">
      <div class="modal-card">
        <div class="modal-header">
          <h3>Abono a Cuenta de Crédito</h3>
          <button class="close-btn" onclick="document.getElementById('credit-pay-modal').classList.remove('active')">&times;</button>
        </div>
        <div class="modal-body" style="display: flex; flex-direction: column; gap: 16px;">
          <input type="hidden" id="pay-client-id">
          <div class="form-group">
            <label>Cliente</label>
            <input type="text" id="pay-client-name" class="input-field" readonly style="background-color: var(--bg-tertiary);">
          </div>
          <div class="grid-cols-2">
            <div class="form-group">
              <label>Saldo Deudor Actual (₡)</label>
              <input type="text" id="pay-current-debt" class="input-field" readonly style="background-color: var(--bg-tertiary);">
            </div>
            <div class="form-group">
              <label>Monto a Abonar (₡)</label>
              <input type="number" id="pay-amount" class="input-field" placeholder="₡0.00" step="0.01">
            </div>
          </div>
          <div class="grid-cols-2">
            <div class="form-group">
              <label>Método de Pago</label>
              <select id="pay-metodo-pago" class="input-field">
                <option value="efectivo">Efectivo</option>
                <option value="tarjeta">Tarjeta</option>
                <option value="transferencia">Transferencia</option>
                <option value="sinpe">SINPE Móvil</option>
              </select>
            </div>
            <div class="form-group" style="justify-content: center; display: flex; align-items: center; margin-top: 24px;">
              <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; user-select: none;">
                <input type="checkbox" id="pay-send-email" checked> Enviar Comprobante Email
              </label>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="document.getElementById('credit-pay-modal').classList.remove('active')">Cancelar</button>
          <button id="save-credit-pay-btn" class="btn btn-primary">Registrar Abono</button>
        </div>
      </div>
    </div>
  `;

  // Controladores de Pestañas
  const tabList = document.getElementById("tab-clients-list");
  const tabCredit = document.getElementById("tab-clients-credit");
  const toggleContainer = document.getElementById("clients-inactive-toggle-container");
  const searchInput = document.getElementById("clients-search-input");

  tabList.addEventListener("click", () => {
    tabCredit.classList.remove("active");
    tabList.classList.add("active");
    toggleContainer.style.display = "flex";
    searchInput.placeholder = "Buscar por identificación, nombre, teléfono o correo...";
    searchInput.value = "";
    renderClientsDirectorio();
  });

  tabCredit.addEventListener("click", () => {
    tabList.classList.remove("active");
    tabCredit.classList.add("active");
    toggleContainer.style.display = "none";
    searchInput.placeholder = "Buscar créditos por cliente o consecutivo...";
    searchInput.value = "";
    renderClientsCreditos();
  });

  // Buscador click
  document.getElementById("clients-search-btn").onclick = () => {
    if (tabList.classList.contains("active")) {
      renderClientsDirectorio();
    } else {
      renderClientsCreditos();
    }
  };

  // Buscador Enter key
  searchInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      if (tabList.classList.contains("active")) {
        renderClientsDirectorio();
      } else {
        renderClientsCreditos();
      }
    }
  });

  // Mostrar inactivos toggle
  document.getElementById("cli-show-inactive").onchange = () => {
    renderClientsDirectorio();
  };

  // Crear Cliente
  document.getElementById("btn-create-client").onclick = () => {
    editingClientId = null;
    document.getElementById("client-modal-title").textContent = "Registrar Nuevo Cliente";
    document.getElementById("cli-identificacion").value = "";
    document.getElementById("cli-nombre").value = "";
    document.getElementById("cli-telefono").value = "";
    document.getElementById("cli-correo").value = "";
    document.getElementById("cli-limite-credito").value = "0";
    document.getElementById("cli-direccion").value = "";
    document.getElementById("cli-active-container").style.display = "none";
    App.openModal("client-form-modal");
  };

  document.getElementById("save-client-btn").onclick = saveClient;
  document.getElementById("save-credit-pay-btn").onclick = saveCreditPay;

  // Cargar Directorio Inicial
  renderClientsDirectorio();
}

async function renderClientsDirectorio() {
  const tbody = document.getElementById("clients-list-body");
  if (!tbody) {
    const container = document.getElementById("clients-tab-body");
    if (container) {
      container.innerHTML = `
        <div class="table-container" style="margin-top: 0;">
          <table class="data-table">
            <thead>
              <tr>
                <th>Identificación</th>
                <th>Nombre</th>
                <th>Teléfono</th>
                <th>Correo</th>
                <th>Límite Crédito</th>
                <th>Saldo Deudor</th>
                <th>Puntos Acumulados</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody id="clients-list-body">
              <tr><td colspan="8" style="text-align: center;">Cargando directorio...</td></tr>
            </tbody>
          </table>
        </div>
      `;
      return renderClientsDirectorio();
    }
    return;
  }
  
  tbody.innerHTML = `<tr><td colspan="8" style="text-align: center;">Cargando directorio de clientes...</td></tr>`;

  try {
    const searchVal = document.getElementById("clients-search-input").value.trim();
    const showInactive = document.getElementById("cli-show-inactive").checked;
    
    clientsDirectory = await API.get(`/clients?search=${encodeURIComponent(searchVal)}&include_inactive=${showInactive}`);
    
    if (clientsDirectory.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align: center;">No hay clientes registrados que coincidan con la búsqueda.</td></tr>`;
      return;
    }

    tbody.innerHTML = "";
    clientsDirectory.forEach(c => {
      const deleteBtn = c.activo 
        ? `<button class="btn btn-secondary btn-delete-client" data-id="${c.id}" style="padding: 4px 8px; font-size: 0.75rem; background-color: var(--error); border-color: var(--error); color: white;">🗑️ Eliminar</button>`
        : `<button class="btn btn-secondary btn-activate-client" data-id="${c.id}" style="padding: 4px 8px; font-size: 0.75rem; background-color: var(--success); border-color: var(--success); color: white;">🔄 Restaurar</button>`;

      tbody.innerHTML += `
        <tr>
          <td><strong>${c.identificacion}</strong></td>
          <td>${c.nombre} ${c.activo ? "" : '<span class="badge badge-danger">Inactivo</span>'}</td>
          <td>${c.telefono || "N/A"}</td>
          <td>${c.correo || "N/A"}</td>
          <td>₡${c.limite_credito.toLocaleString("es-CR", { minimumFractionDigits: 2 })}</td>
          <td style="color:${c.saldo_actual > 0 ? 'var(--error)' : 'inherit'}; font-weight:${c.saldo_actual > 0 ? '700' : 'normal'};">
            ₡${c.saldo_actual.toLocaleString("es-CR", { minimumFractionDigits: 2 })}
          </td>
          <td><span class="badge badge-info">${c.puntos_acumulados} pts</span></td>
          <td>
            <div style="display: flex; gap: 8px;">
              <button class="btn btn-secondary btn-ver-credito" data-id="${c.id}" style="padding: 4px 8px; font-size: 0.75rem;">Historial</button>
              <button class="btn btn-primary btn-edit-client" data-id="${c.id}" style="padding: 4px 8px; font-size: 0.75rem;">Editar</button>
              ${deleteBtn}
            </div>
          </td>
        </tr>
      `;
    });

    tbody.querySelectorAll(".btn-ver-credito").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = parseInt(btn.getAttribute("data-id"));
        openClientCreditHistory(id);
      });
    });

    tbody.querySelectorAll(".btn-edit-client").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = parseInt(btn.getAttribute("data-id"));
        const client = clientsDirectory.find(x => x.id === id);
        openClientEditForm(client);
      });
    });

    tbody.querySelectorAll(".btn-delete-client").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = parseInt(btn.getAttribute("data-id"));
        if (confirm("¿Está seguro de eliminar este cliente? Se enviará a la Papelera de Reciclaje.")) {
          try {
            await API.delete(`/clients/${id}`);
            App.showToast("Cliente Eliminado", "El cliente fue enviado a la papelera.", "success");
            renderClientsDirectorio();
          } catch (error) {
            App.showToast("Error", error.message, "error");
          }
        }
      });
    });

    tbody.querySelectorAll(".btn-activate-client").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = parseInt(btn.getAttribute("data-id"));
        const client = clientsDirectory.find(x => x.id === id);
        if (confirm("¿Desea restaurar a este cliente?")) {
          try {
            await API.put(`/clients/${id}`, { ...client, activo: true });
            App.showToast("Cliente Restaurado", "El cliente fue restaurado con éxito.", "success");
            renderClientsDirectorio();
          } catch (error) {
            App.showToast("Error", error.message, "error");
          }
        }
      });
    });

  } catch (error) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--error);">Error al cargar directorio: ${error.message}</td></tr>`;
  }
}

function openClientEditForm(client) {
  editingClientId = client.id;
  document.getElementById("client-modal-title").textContent = "Modificar Cliente: " + client.nombre;
  
  document.getElementById("cli-identificacion").value = client.identificacion;
  document.getElementById("cli-nombre").value = client.nombre;
  document.getElementById("cli-telefono").value = client.telefono || "";
  document.getElementById("cli-correo").value = client.correo || "";
  document.getElementById("cli-limite-credito").value = client.limite_credito;
  document.getElementById("cli-direccion").value = client.direccion || "";
  
  const activeContainer = document.getElementById("cli-active-container");
  activeContainer.style.display = "block";
  document.getElementById("cli-activo").value = client.activo ? "true" : "false";
  
  App.openModal("client-form-modal");
}

async function renderClientsCreditos() {
  const container = document.getElementById("clients-tab-body");
  if (!container) return;

  container.innerHTML = `
    <div style="display: grid; grid-template-columns: 350px 1fr; gap: 24px;">
      
      <!-- Listado de clientes de crédito -->
      <div class="dashboard-panel" style="padding: 16px;">
        <h3 style="font-size: 1rem; margin-bottom: 16px;">Cuentas de Créditos</h3>
        <div style="max-height: 480px; overflow-y: auto; display: flex; flex-direction: column; gap: 10px;" id="credit-clients-list">
          <div style="text-align: center; padding: 20px; color: var(--text-muted);">Buscando cuentas de crédito...</div>
        </div>
      </div>

      <!-- Visualización de Estado de Cuenta del Cliente Seleccionado -->
      <div class="dashboard-panel" id="credit-client-profile" style="display: flex; flex-direction: column; gap: 20px;">
        <div style="text-align: center; color: var(--text-muted); padding: 80px 20px;">
          Seleccione un cliente o crédito de la lista para ver su estado detallado y registrar abonos.
        </div>
      </div>

    </div>
  `;

  await loadCreditsList();
}

async function loadCreditsList() {
  const divList = document.getElementById("credit-clients-list");
  if (!divList) return;

  divList.innerHTML = `<div style="text-align: center; padding: 20px; color: var(--text-muted);">Buscando...</div>`;

  try {
    const searchVal = document.getElementById("clients-search-input").value.trim();
    const credits = await API.get(`/clients/credits?search=${encodeURIComponent(searchVal)}`);
    
    if (credits.length === 0) {
      divList.innerHTML = `<div style="text-align: center; padding: 20px; color: var(--text-muted); font-size: 0.85rem;">No se encontraron cuentas por cobrar pendientes.</div>`;
      return;
    }

    const clientMap = {};
    credits.forEach(c => {
      if (!clientMap[c.cliente_id]) {
        clientMap[c.cliente_id] = {
          id: c.cliente_id,
          nombre: c.cliente_nombre,
          saldo_actual: 0.0,
          cuentas: []
        };
      }
      clientMap[c.cliente_id].saldo_actual += c.saldo_pendiente;
      clientMap[c.cliente_id].cuentas.push(c);
    });

    const list = Object.values(clientMap);

    divList.innerHTML = "";
    list.forEach(c => {
      divList.innerHTML += `
        <div class="stat-card btn-select-credit-client" data-id="${c.id}" style="padding: 12px; cursor: pointer; border-left: 3px solid ${c.saldo_actual > 0 ? 'var(--error)' : 'var(--success)'}; margin-bottom: 8px;">
          <div style="font-weight: 600; font-size: 0.85rem;">${c.nombre}</div>
          <div class="flex-between mt-4">
            <span style="font-size:0.75rem; color:var(--text-muted);">Deuda Total: ₡${c.saldo_actual.toLocaleString("es-CR", { minimumFractionDigits: 2 })}</span>
            <span style="font-size:0.75rem; color:var(--text-muted);">${c.cuentas.length} factura(s)</span>
          </div>
        </div>
      `;
    });

    divList.querySelectorAll(".btn-select-credit-client").forEach(card => {
      card.addEventListener("click", () => {
        divList.querySelectorAll(".btn-select-credit-client").forEach(c => c.style.backgroundColor = "var(--bg-secondary)");
        card.style.backgroundColor = "var(--bg-tertiary)";
        const id = parseInt(card.getAttribute("data-id"));
        loadCreditClientProfile(id);
      });
    });

  } catch (error) {
    divList.innerHTML = `<div style="text-align: center; padding: 20px; color: var(--error);">Error: ${error.message}</div>`;
  }
}

async function loadCreditClientProfile(clientId) {
  const profilePanel = document.getElementById("credit-client-profile");
  if (!profilePanel) return;

  profilePanel.innerHTML = `<h3>Cargando estado de cuenta...</h3>`;

  try {
    const data = await API.get(`/clients/${clientId}/credit`);
    const dispo = data.disponible;
    const dispoColor = dispo < 0 ? "var(--error)" : "var(--success)";

    profilePanel.innerHTML = `
      <div class="flex-between" style="border-bottom: 1px solid var(--border-color); padding-bottom: 16px;">
        <div>
          <h2 style="font-size:1.3rem; font-weight: 700;">${data.cliente}</h2>
          <span style="font-size:0.8rem; color:var(--text-muted);">Estado de Cuenta y Límites de Crédito</span>
        </div>
        <button id="btn-pay-credit-trigger" class="btn btn-primary" ${data.saldo_actual <= 0 ? 'disabled' : ''}>💸 Registrar Abono</button>
      </div>

      <!-- Resumen Financiero del Cliente -->
      <div class="grid-cols-3">
        <div style="background-color: var(--bg-tertiary); padding: 16px; border-radius: var(--radius-md); text-align: center;">
          <div style="font-size: 0.8rem; color: var(--text-secondary); text-transform: uppercase;">Límite Crédito</div>
          <div style="font-size: 1.3rem; font-weight: 700; margin-top: 8px;">₡${data.limite_credito.toLocaleString("es-CR", { minimumFractionDigits: 2 })}</div>
        </div>
        <div style="background-color: var(--bg-tertiary); padding: 16px; border-radius: var(--radius-md); text-align: center;">
          <div style="font-size: 0.8rem; color: var(--text-secondary); text-transform: uppercase; color:var(--error);">Deuda Pendiente</div>
          <div style="font-size: 1.3rem; font-weight: 700; margin-top: 8px; color:var(--error);">₡${data.saldo_actual.toLocaleString("es-CR", { minimumFractionDigits: 2 })}</div>
        </div>
        <div style="background-color: var(--bg-tertiary); padding: 16px; border-radius: var(--radius-md); text-align: center;">
          <div style="font-size: 0.8rem; color: var(--text-secondary); text-transform: uppercase; color:${dispoColor};">Cupo Disponible</div>
          <div style="font-size: 1.3rem; font-weight: 700; margin-top: 8px; color:${dispoColor};">₡${dispo.toLocaleString("es-CR", { minimumFractionDigits: 2 })}</div>
        </div>
      </div>

      <!-- Tabla de facturas a crédito (cuentas por cobrar) -->
      <div>
        <h4 style="font-size: 0.95rem; font-weight: 600; margin-bottom: 12px;">Cuentas por Cobrar Pendientes</h4>
        <div class="table-container" style="margin-top:0;">
          <table class="data-table">
            <thead>
              <tr>
                <th>Ticket / Factura</th>
                <th>Total Facturado</th>
                <th>Saldo Pendiente</th>
                <th>Fecha Vencimiento</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              ${data.cuentas.map(c => {
                let badge = "";
                if (c.estado === "pagado") badge = `<span class="badge badge-success">Pagado</span>`;
                else if (c.estado === "moroso") badge = `<span class="badge badge-danger">Moroso (Vencido)</span>`;
                else badge = `<span class="badge badge-warning">Vigente (Al día)</span>`;
                
                return `
                  <tr>
                    <td><strong>${c.venta_consecutivo}</strong></td>
                    <td>₡${c.monto_total.toLocaleString("es-CR", { minimumFractionDigits: 2 })}</td>
                    <td style="font-weight:600; color:${c.saldo_pendiente > 0 ? 'var(--error)' : 'inherit'};">
                      ₡${c.saldo_pendiente.toLocaleString("es-CR", { minimumFractionDigits: 2 })}
                    </td>
                    <td>${c.fecha_vencimiento}</td>
                    <td>${badge}</td>
                  </tr>
                `;
              }).join("")}
              ${data.cuentas.length === 0 ? '<tr><td colspan="5" style="text-align:center;">No tiene cuentas pendientes.</td></tr>' : ''}
            </tbody>
          </table>
        </div>
      </div>
    `;

    const payBtn = document.getElementById("btn-pay-credit-trigger");
    if (payBtn) {
      payBtn.onclick = () => {
        document.getElementById("pay-client-id").value = clientId;
        document.getElementById("pay-client-name").value = data.cliente;
        document.getElementById("pay-current-debt").value = data.saldo_actual.toFixed(2);
        document.getElementById("pay-amount").value = "";
        App.openModal("credit-pay-modal");
      };
    }

  } catch (error) {
    profilePanel.innerHTML = `<h3 style="color:var(--error);">Error al cargar cuenta del cliente: ${error.message}</h3>`;
  }
}

async function openClientCreditHistory(clientId) {
  const tabCredit = document.getElementById("tab-clients-credit");
  const tabList = document.getElementById("tab-clients-list");
  
  tabList.classList.remove("active");
  tabCredit.classList.add("active");
  document.getElementById("clients-inactive-toggle-container").style.display = "none";
  
  await renderClientsCreditos();
  
  const card = document.querySelector(`.btn-select-credit-client[data-id="${clientId}"]`);
  if (card) {
    card.click();
  } else {
    App.showToast("Sin Crédito", "Este cliente no tiene saldo deudor o límite de crédito activo.", "warning");
    tabCredit.classList.remove("active");
    tabList.classList.add("active");
    document.getElementById("clients-inactive-toggle-container").style.display = "flex";
    renderClientsDirectorio();
  }
}

async function saveClient() {
  const payload = {
    identificacion: document.getElementById("cli-identificacion").value.trim(),
    nombre: document.getElementById("cli-nombre").value.trim(),
    telefono: document.getElementById("cli-telefono").value.trim(),
    correo: document.getElementById("cli-correo").value.trim(),
    limite_credito: parseFloat(document.getElementById("cli-limite-credito").value) || 0.0,
    direccion: document.getElementById("cli-direccion").value.trim()
  };

  if (!payload.identificacion || !payload.nombre) {
    App.showToast("Campos Vacíos", "La identificación y el nombre son obligatorios.", "warning");
    return;
  }

  try {
    if (editingClientId) {
      payload.activo = document.getElementById("cli-activo").value === "true";
      await API.put(`/clients/${editingClientId}`, payload);
      App.showToast("Cliente Actualizado", `Cliente ${payload.nombre} modificado correctamente.`, "success");
    } else {
      await API.post("/clients", payload);
      App.showToast("Cliente Creado", `Cliente ${payload.nombre} registrado con éxito.`, "success");
    }
    
    document.getElementById("client-form-modal").classList.remove("active");
    
    // Recargar
    const tabList = document.getElementById("tab-clients-list");
    if (tabList.classList.contains("active")) {
      renderClientsDirectorio();
    } else {
      renderClientsCreditos();
    }
  } catch (error) {
    App.showToast("Error", error.message || "Fallo en operación de cliente.", "error");
  }
}

async function saveCreditPay() {
  const clientId = parseInt(document.getElementById("pay-client-id").value);
  const monto = parseFloat(document.getElementById("pay-amount").value) || 0.0;
  const metodo_pago = document.getElementById("pay-metodo-pago").value;
  const enviar_correo = document.getElementById("pay-send-email").checked;

  if (monto <= 0) {
    App.showToast("Monto Inválido", "Ingrese un monto de abono mayor a cero.", "warning");
    return;
  }

  try {
    const res = await API.post(`/clients/${clientId}/pay-credit`, { 
      monto,
      metodo_pago,
      enviar_correo
    });
    
    App.showToast("Abono Registrado", `Abono de ₡${monto.toLocaleString("es-CR")} procesado con éxito.`, "success");
    document.getElementById("credit-pay-modal").classList.remove("active");
    
    // Recargar vista
    loadCreditClientProfile(clientId);
    loadCreditsList();
  } catch (error) {
    App.showToast("Error", error.message || "No se pudo registrar el abono.", "error");
  }
}
