import { API } from "./api.js";
import { App } from "./app.js";

let openArqueo = null;

export async function renderCash(container) {
  container.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 24px;">
      
      <!-- CONTENEDOR DE ESTADO ACTUAL -->
      <div id="cash-status-panel" class="dashboard-panel" style="background-color: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 24px;">
        <!-- Se rellena con js -->
        <h3>Verificando estado del turno de caja...</h3>
      </div>

      <!-- BOTONES DE MOVIMIENTOS RÁPIDOS DE CAJA CHICA (Solo si la caja está abierta) -->
      <div id="cash-actions-row" style="display: none; gap: 12px;">
        <button id="btn-cash-withdraw" class="btn btn-secondary">💵 Retirar Efectivo (Gasto / Pago Menor)</button>
        <button id="btn-cash-deposit" class="btn btn-secondary">📥 Ingresar Efectivo Extraordinario</button>
      </div>

      <!-- HISTORIAL DE TURNOS DE CAJA -->
      <div class="dashboard-panel">
        <div class="panel-header">
          <h3>Historial de Arqueos y Turnos de Caja</h3>
        </div>
        <div class="table-container" style="margin-top: 0; max-height: 400px; overflow-y: auto;">
          <table class="data-table">
            <thead>
              <tr>
                <th>Turno</th>
                <th>Usuario responsable</th>
                <th>Fecha Apertura</th>
                <th>Fecha Cierre</th>
                <th>Monto Inicial</th>
                <th>Monto Final (Ef.)</th>
                <th>Estado</th>
                <th>Detalles</th>
              </tr>
            </thead>
            <tbody id="cash-history-body">
              <tr><td colspan="8" style="text-align: center;">Cargando arqueos históricos...</td></tr>
            </tbody>
          </table>
        </div>
      </div>

    </div>

    <!-- MODAL: APERTURA DE CAJA -->
    <div id="cash-open-modal" class="modal-wrapper">
      <div class="modal-card">
        <div class="modal-header">
          <h3>Apertura de Turno de Caja</h3>
          <button class="close-btn" onclick="document.getElementById('cash-open-modal').classList.remove('active')">&times;</button>
        </div>
        <div class="modal-body" style="display: flex; flex-direction: column; gap: 16px;">
          <div class="form-group">
            <label>Caja Registradora</label>
            <select id="open-caja-id" class="input-field">
              <option value="1">Caja Principal</option>
            </select>
          </div>
          <div class="form-group">
            <label>Monto Inicial de Efectivo (Fondo de Caja) (₡)</label>
            <input type="number" id="open-monto-inicial" class="input-field" value="50000" placeholder="₡50,000">
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="document.getElementById('cash-open-modal').classList.remove('active')">Cancelar</button>
          <button id="save-cash-open-btn" class="btn btn-primary">Abrir Caja</button>
        </div>
      </div>
    </div>

    <!-- MODAL: CIERRE DE CAJA (ARQUEO) -->
    <div id="cash-close-modal" class="modal-wrapper">
      <div class="modal-card" style="width: 500px;">
        <div class="modal-header">
          <h3>Arqueo y Cierre de Caja</h3>
          <button class="close-btn" onclick="document.getElementById('cash-close-modal').classList.remove('active')">&times;</button>
        </div>
        <div class="modal-body" style="display: flex; flex-direction: column; gap: 16px;">
          <p style="font-size:0.85rem; color:var(--text-secondary); line-height: 1.5;">
            Conteo físico del efectivo y verificación de transacciones del turno. Ingrese el monto real reportado en su gaveta.
          </p>

          <div class="form-group">
            <label>Monto Efectivo Contado (₡)</label>
            <input type="number" id="close-efectivo" class="input-field" placeholder="0.00" step="0.01" required>
          </div>
          
          <div class="form-group">
            <label>Monto Tarjeta Contado (₡)</label>
            <input type="number" id="close-tarjeta" class="input-field" placeholder="0.00" step="0.01" required>
          </div>

          <div class="form-group">
            <label>Monto SINPE Móvil Contado (₡)</label>
            <input type="number" id="close-transferencia" class="input-field" placeholder="0.00" step="0.01" required>
          </div>

          <div class="form-group">
            <label>Observaciones de Arqueo</label>
            <textarea id="close-obs" class="input-field" placeholder="ej. Faltante o sobrante de efectivo detectado por..." style="height: 60px; font-family:inherit; resize:none;"></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="document.getElementById('cash-close-modal').classList.remove('active')">Cancelar</button>
          <button id="save-cash-close-btn" class="btn btn-primary">Registrar Cierre de Caja</button>
        </div>
      </div>
    </div>

    <!-- MODAL: MOVIMIENTO DE DINERO -->
    <div id="cash-txn-modal" class="modal-wrapper">
      <div class="modal-card">
        <div class="modal-header">
          <h3 id="cash-txn-title">Movimiento de Caja Chica</h3>
          <button class="close-btn" onclick="document.getElementById('cash-txn-modal').classList.remove('active')">&times;</button>
        </div>
        <div class="modal-body" style="display: flex; flex-direction: column; gap: 16px;">
          <input type="hidden" id="cash-txn-type">
          <div class="form-group">
            <label>Monto del Movimiento (₡)</label>
            <input type="number" id="cash-txn-amount" class="input-field" placeholder="0.00" step="0.01" required>
          </div>
          <div class="form-group">
            <label>Descripción / Justificación</label>
            <input type="text" id="cash-txn-desc" class="input-field" placeholder="ej. Pago a proveedor de verduras / Retiro para depósito..." required>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="document.getElementById('cash-txn-modal').classList.remove('active')">Cancelar</button>
          <button id="save-cash-txn-btn" class="btn btn-primary">Registrar</button>
        </div>
      </div>
    </div>
  `;

  // Cargar escuchadores
  document.getElementById("save-cash-open-btn").onclick = saveOpenCash;
  document.getElementById("save-cash-close-btn").onclick = saveCloseCash;
  document.getElementById("save-cash-txn-btn").onclick = saveCashTransaction;

  // Botón retiros
  document.getElementById("btn-cash-withdraw").onclick = () => {
    document.getElementById("cash-txn-title").textContent = "Registrar Retiro de Efectivo (Gasto)";
    document.getElementById("cash-txn-type").value = "pago_menor";
    document.getElementById("cash-txn-amount").value = "";
    document.getElementById("cash-txn-desc").value = "";
    App.openModal("cash-txn-modal");
  };

  // Botón ingresos extraordinarios
  document.getElementById("btn-cash-deposit").onclick = () => {
    document.getElementById("cash-txn-title").textContent = "Registrar Ingreso de Efectivo Extraordinario";
    document.getElementById("cash-txn-type").value = "ingreso_extraordinario";
    document.getElementById("cash-txn-amount").value = "";
    document.getElementById("cash-txn-desc").value = "";
    App.openModal("cash-txn-modal");
  };

  // Inicializar estado
  updateCashStatus();
  loadCashHistory();
}

async function updateCashStatus() {
  const panel = document.getElementById("cash-status-panel");
  const actionsRow = document.getElementById("cash-actions-row");

  if (!panel || !actionsRow) return;

  try {
    const data = await API.get("/cash/status");
    
    if (data.open) {
      openArqueo = data.arqueo;
      actionsRow.style.display = "flex";
      
      const fecha = new Date(openArqueo.fecha_apertura).toLocaleString("es-CR");
      
      panel.innerHTML = `
        <div class="flex-between">
          <div>
            <h3 style="color: var(--success); font-weight: 700; display:flex; align-items:center; gap:8px;">
              🟢 Turno Activo: ${openArqueo.caja_nombre}
            </h3>
            <p style="font-size:0.85rem; color:var(--text-secondary); margin-top: 8px;">
              Abierta el <strong>${fecha}</strong> por el cajero actual.
            </p>
            <p style="font-size:0.85rem; color:var(--text-secondary); margin-top: 4px;">
              Fondo inicial de efectivo: <strong>₡${openArqueo.monto_inicial.toLocaleString("es-CR", { minimumFractionDigits: 2 })}</strong>
            </p>
          </div>
          <button id="btn-open-close-cash-modal" class="btn btn-danger">🔒 Arquear y Cerrar Turno</button>
        </div>
      `;

      document.getElementById("btn-open-close-cash-modal").onclick = () => {
        document.getElementById("close-efectivo").value = "";
        document.getElementById("close-tarjeta").value = "";
        document.getElementById("close-transferencia").value = "";
        document.getElementById("close-obs").value = "";
        App.openModal("cash-close-modal");
      };

    } else {
      openArqueo = null;
      actionsRow.style.display = "none";
      
      panel.innerHTML = `
        <div class="flex-between">
          <div>
            <h3 style="color: var(--text-muted); font-weight: 700;">
              🔴 Turno de Caja Cerrado
            </h3>
            <p style="font-size:0.85rem; color:var(--text-secondary); margin-top: 8px;">
              Debe abrir un turno con un monto inicial para operar.
            </p>
          </div>
          <button id="btn-open-open-cash-modal" class="btn btn-primary">🔑 Abrir Turno de Caja</button>
        </div>
      `;

      document.getElementById("btn-open-open-cash-modal").onclick = () => {
        document.getElementById("open-monto-inicial").value = 50000;
        App.openModal("cash-open-modal");
      };
    }
  } catch (error) {
    panel.innerHTML = `<h3>Error consultando estado de caja: ${error.message}</h3>`;
  }
}

async function loadCashHistory() {
  const tbody = document.getElementById("cash-history-body");
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="8" style="text-align: center;">Cargando arqueos...</td></tr>`;

  try {
    const list = await API.get("/cash/history");
    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align: center;">No hay turnos registrados en el sistema.</td></tr>`;
      return;
    }

    tbody.innerHTML = "";
    list.forEach(a => {
      const isCerrada = a.estado === "cerrada";
      const badge = isCerrada 
        ? `<span class="badge badge-success">Cerrada</span>`
        : `<span class="badge badge-warning">Abierta</span>`;
      
      const fechaCierre = a.fecha_cierre 
        ? new Date(a.fecha_cierre).toLocaleString("es-CR") 
        : "N/A";
        
      tbody.innerHTML += `
        <tr>
          <td><strong>Turno #${a.id}</strong></td>
          <td>${a.usuario}</td>
          <td>${new Date(a.fecha_apertura).toLocaleString("es-CR")}</td>
          <td>${fechaCierre}</td>
          <td>₡${a.monto_inicial.toFixed(2)}</td>
          <td>₡${a.monto_final_efectivo.toFixed(2)}</td>
          <td>${badge}</td>
          <td><button class="btn btn-secondary btn-ver-obs" data-obs="${a.observaciones || 'Sin detalles'}" style="padding: 4px 8px; font-size: 0.75rem;">Ver Obs</button></td>
        </tr>
      `;
    });

    tbody.querySelectorAll(".btn-ver-obs").forEach(btn => {
      btn.addEventListener("click", () => {
        alert(btn.getAttribute("data-obs"));
      });
    });

  } catch (error) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--error);">Error al cargar historial: ${error.message}</td></tr>`;
  }
}

// --- ACCIONES ---

async function saveOpenCash() {
  const monto = parseFloat(document.getElementById("open-monto-inicial").value) || 0;
  const caja_id = parseInt(document.getElementById("open-caja-id").value);

  if (monto < 0) {
    App.showToast("Monto Incorrecto", "El fondo inicial no puede ser negativo.", "warning");
    return;
  }

  try {
    await API.post("/cash/open", { monto_inicial: monto, caja_id });
    App.showToast("Turno Iniciado", "La caja registradora ha sido abierta con éxito.", "success");
    document.getElementById("cash-open-modal").classList.remove("active");
    updateCashStatus();
    loadCashHistory();
  } catch (error) {
    App.showToast("Apertura Fallida", error.message || "No se pudo abrir el turno.", "error");
  }
}

async function saveCloseCash() {
  const payload = {
    monto_final_efectivo: parseFloat(document.getElementById("close-efectivo").value) || 0,
    monto_final_tarjeta: parseFloat(document.getElementById("close-tarjeta").value) || 0,
    monto_final_transferencia: parseFloat(document.getElementById("close-transferencia").value) || 0,
    observaciones: document.getElementById("close-obs").value
  };

  try {
    const res = await API.post("/cash/close", payload);
    
    // Alerta de desglose de arqueo
    let msg = `Cierre Registrado con Éxito.\n\n`;
    msg += `Diferencia Efectivo: ₡${res.diferencias.efectivo.toFixed(2)}\n`;
    msg += `Diferencia Tarjeta: ₡${res.diferencias.tarjeta.toFixed(2)}\n`;
    msg += `Diferencia SINPE/Trans: ₡${res.diferencias.transferencia.toFixed(2)}\n`;
    
    alert(msg);
    
    App.showToast("Caja Cerrada", "Turno cerrado e inventariado correctamente.", "success");
    document.getElementById("cash-close-modal").classList.remove("active");
    updateCashStatus();
    loadCashHistory();
  } catch (error) {
    App.showToast("Cierre Fallido", error.message || "Fallo en cierre de arqueo.", "error");
  }
}

async function saveCashTransaction() {
  const tipo = document.getElementById("cash-txn-type").value;
  const monto = parseFloat(document.getElementById("cash-txn-amount").value) || 0;
  const desc = document.getElementById("cash-txn-desc").value.trim();

  if (monto <= 0 || !desc) {
    App.showToast("Campos Vacíos", "Rellene el monto y la justificación.", "warning");
    return;
  }

  try {
    await API.post("/cash/transaction", {
      tipo_movimiento: tipo,
      monto,
      descripcion: desc
    });
    App.showToast("Movimiento Exitoso", "Transacción en caja chica guardada correctamente.", "success");
    document.getElementById("cash-txn-modal").classList.remove("active");
    updateCashStatus();
  } catch (error) {
    App.showToast("Error", error.message || "Error registrando transacción.", "error");
  }
}
