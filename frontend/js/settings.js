import { API } from "./api.js";
import { App } from "./app.js";

export async function renderSettings(container) {
  const user = API.getUserInfo();
  const isAdmin = user && user.rol === "Administrador General";
  let biz = {
    nombre_comercial: "Minisúper M Y M",
    cedula_juridica: "3-101-000000",
    razon_social: "Minisúper M Y M S.A.",
    telefonos: "0000-0000",
    correo: "contacto@minisupermym.com",
    direccion: "Costa Rica",
    sitio_web: "",
    logo_path: ""
  };
  
  let smtp = {
    smtp_host: "",
    smtp_port: "587",
    smtp_user: "",
    smtp_from: ""
  };

  let waLogs = [];

  try {
    biz = await API.get("/settings/company");
  } catch (e) {
    console.error("Error loading company settings for form:", e);
  }

  try {
    smtp = await API.get("/settings/smtp");
  } catch (e) {
    console.error("Error loading SMTP settings for form:", e);
  }

  try {
    waLogs = await API.get("/settings/whatsapp/logs");
  } catch (e) {
    console.error("Error loading WhatsApp logs:", e);
  }

  container.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 24px; max-width: 800px;">
      
      <!-- CONFIGURACIÓN DEL NEGOCIO -->
      <div class="dashboard-panel">
        <div class="panel-header">
          <h3>Información de la Empresa</h3>
        </div>
        <form id="business-config-form" style="display:flex; flex-direction:column; gap:16px;">
          <div style="display: flex; gap: 20px; align-items: center; background: var(--bg-secondary); padding: 16px; border-radius: 8px;">
            <div id="biz-logo-preview-container" style="width: 80px; height: 80px; border: 1px dashed var(--border-color); border-radius: 8px; display: flex; align-items: center; justify-content: center; overflow: hidden; background: var(--bg-primary);">
              ${biz.logo_path ? `<img id="biz-logo-preview" src="${biz.logo_path}?t=${new Date().getTime()}" style="width:100%; height:100%; object-fit:contain;">` : `<span style="font-size:2rem;">🏪</span>`}
            </div>
            <div class="form-group" style="flex: 1; margin: 0;">
              <label>Subir Nuevo Logo Oficial</label>
              <input type="file" id="biz-logo-input" accept="image/*" class="input-field" style="padding: 6px;">
            </div>
          </div>
          <div class="grid-cols-2">
            <div class="form-group">
              <label>Nombre Comercial</label>
              <input type="text" id="biz-nombre" class="input-field" value="${biz.nombre_comercial || ""}">
            </div>
            <div class="form-group">
              <label>Cédula Jurídica (ID Fiscal)</label>
              <input type="text" id="biz-cedula" class="input-field" value="${biz.cedula_juridica || ""}">
            </div>
          </div>
          <div class="form-group">
            <label>Razón Social Legal</label>
            <input type="text" id="biz-social" class="input-field" value="${biz.razon_social || ""}">
          </div>
          <div class="grid-cols-2">
            <div class="form-group">
              <label>Teléfonos</label>
              <input type="text" id="biz-tel" class="input-field" value="${biz.telefonos || ""}">
            </div>
            <div class="form-group">
              <label>Correo Electrónico</label>
              <input type="email" id="biz-mail" class="input-field" value="${biz.correo || ""}">
            </div>
          </div>
          <div class="grid-cols-2">
            <div class="form-group">
              <label>Dirección Física</label>
              <input type="text" id="biz-dir" class="input-field" value="${biz.direccion || ""}">
            </div>
            <div class="form-group">
              <label>Sitio Web</label>
              <input type="text" id="biz-sitio-web" class="input-field" value="${biz.sitio_web || ""}" placeholder="ej. www.minisupermym.com">
            </div>
          </div>
          <div style="display:flex; justify-content:flex-end; margin-top:8px;">
            <button type="submit" id="btn-save-biz" class="btn btn-primary">💾 Guardar Cambios Empresariales</button>
          </div>
        </form>
      </div>

      <!-- CONFIGURACIÓN SMTP -->
      <div class="dashboard-panel">
        <div class="panel-header">
          <h3>Configuración SMTP (Envío de Comprobantes)</h3>
        </div>
        <form id="smtp-config-form" style="display:flex; flex-direction:column; gap:16px;">
          <div class="grid-cols-2">
            <div class="form-group">
              <label>Servidor SMTP (Host)</label>
              <input type="text" id="smtp-host" class="input-field" value="${smtp.smtp_host || ""}" placeholder="ej. smtp.gmail.com">
            </div>
            <div class="form-group">
              <label>Puerto SMTP</label>
              <input type="text" id="smtp-port" class="input-field" value="${smtp.smtp_port || "587"}" placeholder="ej. 587">
            </div>
          </div>
          <div class="grid-cols-2">
            <div class="form-group">
              <label>Usuario / Correo SMTP</label>
              <input type="text" id="smtp-user" class="input-field" value="${smtp.smtp_user || ""}" placeholder="ej. usuario@dominio.com">
            </div>
            <div class="form-group">
              <label>Contraseña SMTP</label>
              <input type="password" id="smtp-password" class="input-field" placeholder="••••••••">
            </div>
          </div>
          <div class="grid-cols-2">
            <div class="form-group">
              <label>Nombre Remitente</label>
              <input type="text" id="smtp-from-name" class="input-field" value="${smtp.smtp_from_name || ""}" placeholder="ej. Minisúper M Y M">
            </div>
            <div class="form-group">
              <label>Correo Remitente</label>
              <input type="email" id="smtp-from-email" class="input-field" value="${smtp.smtp_from_email || ""}" placeholder="ej. no-responder@dominio.com">
            </div>
          </div>
          <div style="display: flex; gap: 8px; align-items: center; margin-bottom: 8px;">
            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; user-select: none; font-size: 0.9rem;">
              <input type="checkbox" id="smtp-use-ssl" ${smtp.smtp_use_ssl === "true" ? "checked" : ""}> Usar Conexión Segura (TLS/SSL)
            </label>
          </div>
          
          <div id="smtp-diagnostic-results" style="display: none; padding: 16px; border-radius: 8px; background-color: var(--bg-secondary); border: 1px solid var(--border-color); flex-direction: column; gap: 8px; margin-top: 8px;">
            <h4 style="font-size: 0.9rem; font-weight: 600; margin-bottom: 4px; border-bottom: 1px solid var(--border-color); padding-bottom: 4px;">Resultados del Diagnóstico:</h4>
            <div id="diag-step-connection" style="display: flex; align-items: center; gap: 8px; font-size: 0.85rem;"></div>
            <div id="diag-step-auth" style="display: flex; align-items: center; gap: 8px; font-size: 0.85rem;"></div>
            <div id="diag-step-send" style="display: flex; align-items: center; gap: 8px; font-size: 0.85rem;"></div>
          </div>

          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-top:8px;">
            <div style="display: flex; gap: 8px; align-items: center;">
              <input type="email" id="smtp-test-email" class="input-field" placeholder="destinatario@correo.com" style="width: 220px; margin: 0;">
              <button type="button" id="btn-test-smtp" class="btn btn-secondary" style="padding: 10px 14px;">⚡ Probar Correo</button>
            </div>
            <button type="submit" id="btn-save-smtp" class="btn btn-primary">💾 Guardar Configuración SMTP</button>
          </div>
        </form>
      </div>

      <!-- SIMULACIÓN DE ENTREGAS WHATSAPP (LOGS) -->
      <div class="dashboard-panel">
        <div class="panel-header">
          <h3>Simulación de Entregas WhatsApp (Logs)</h3>
          <button id="btn-refresh-wa" class="btn btn-secondary" style="padding: 4px 10px; font-size: 0.8rem;">🔄 Actualizar</button>
        </div>
        <p style="font-size:0.85rem; color:var(--text-secondary); line-height: 1.5; margin-bottom: 16px;">
          Historial en tiempo real de los mensajes de WhatsApp que habrían sido despachados físicamente a los clientes.
        </p>
        <div class="table-container" style="margin-top: 0; max-height: 250px; overflow-y: auto;">
          <table class="data-table">
            <thead>
              <tr>
                <th>Teléfono</th>
                <th>Mensaje</th>
                <th>Fecha de Envío</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody id="wa-logs-list-body">
              ${waLogs.length === 0 
                ? `<tr><td colspan="4" style="text-align: center; color: var(--text-muted);">No hay logs de WhatsApp registrados.</td></tr>`
                : waLogs.map(log => `
                  <tr>
                    <td><code>${log.telefono}</code></td>
                    <td style="font-size: 0.8rem; max-width: 300px; white-space: normal; word-break: break-all;">${log.mensaje}</td>
                    <td>${new Date(log.fecha_envio).toLocaleString("es-CR")}</td>
                    <td><span class="badge badge-success">${log.estado.toUpperCase()}</span></td>
                  </tr>
                `).join("")
              }
            </tbody>
          </table>
        </div>
      </div>

      <!-- COPIAS DE SEGURIDAD (RESPALDOS) -->
      <div class="dashboard-panel">
        <div class="panel-header">
          <h3>Copias de Seguridad (Base de Datos)</h3>
          <button id="btn-create-backup" class="btn btn-primary">💾 Crear Respaldo Ahora</button>
        </div>
        <p style="font-size:0.85rem; color:var(--text-secondary); line-height: 1.5; margin-bottom: 16px;">
          El sistema almacena copias locales físicas del archivo <code>pos.db</code>. Puede descargar, restaurar o borrar los respaldos creados.
        </p>

        <div class="table-container" style="margin-top: 0;">
          <table class="data-table">
            <thead>
              <tr>
                <th>Archivo</th>
                <th>Tamaño</th>
                <th>Fecha de Creación</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody id="backups-list-body">
              <tr><td colspan="4" style="text-align: center;">Cargando lista de respaldos...</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- ADMINISTRACIÓN DE USUARIOS (SÓLO ADMINISTRADORES) -->
      ${isAdmin ? `
      <div class="dashboard-panel">
        <div class="panel-header">
          <h3>Administración de Usuarios</h3>
        </div>
        <p style="font-size:0.85rem; color:var(--text-secondary); line-height: 1.5; margin-bottom: 16px;">
          Administre de forma manual los nombres de usuario y contraseñas de las cuentas del sistema (Administrador, Cajero, Bodeguero).
        </p>

        <div class="table-container" style="margin-top: 0;">
          <table class="data-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Usuario</th>
                <th>Rol / Puesto</th>
                <th style="text-align: center;">Acción</th>
              </tr>
            </thead>
            <tbody id="users-list-body">
              <tr><td colspan="4" style="text-align: center;">Cargando lista de usuarios...</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- MODAL DE EDICIÓN DE USUARIO -->
      <div id="user-edit-modal" class="modal-wrapper">
        <div class="modal-card" style="width: 450px;">
          <div class="modal-header">
            <h3>Editar Credenciales de Usuario</h3>
            <button class="close-btn" onclick="document.getElementById('user-edit-modal').classList.remove('active')">&times;</button>
          </div>
          <div class="modal-body" style="display: flex; flex-direction: column; gap: 16px;">
            <input type="hidden" id="edit-user-id">
            <div class="form-group">
              <label>Nombre del Empleado</label>
              <input type="text" id="edit-user-nombre" class="input-field" required>
            </div>
            <div class="form-group">
              <label>Nombre de Usuario</label>
              <input type="text" id="edit-user-username" class="input-field" required>
            </div>
            <div class="form-group">
              <label>Correo Electrónico</label>
              <input type="email" id="edit-user-email" class="input-field">
            </div>
            <div class="form-group">
              <label>Nueva Contraseña (Dejar vacío para no cambiar)</label>
              <input type="password" id="edit-user-password" class="input-field" placeholder="Escriba nueva contraseña si desea cambiarla">
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="document.getElementById('user-edit-modal').classList.remove('active')">Cancelar</button>
            <button id="btn-save-user" class="btn btn-primary">💾 Guardar Cambios</button>
          </div>
        </div>
      </div>
      ` : ""}

    </div>
  `;

  // Escuchadores
  document.getElementById("btn-create-backup").onclick = triggerNewBackup;

  const form = document.getElementById("business-config-form");
  form.onsubmit = async (e) => {
    e.preventDefault();
    const btn = document.getElementById("btn-save-biz");
    btn.disabled = true;
    btn.textContent = "Guardando...";
    
    try {
      const logoInput = document.getElementById("biz-logo-input");
      if (logoInput && logoInput.files.length > 0) {
        const logoFile = logoInput.files[0];
        const base64Data = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (event) => resolve(event.target.result);
          reader.onerror = (err) => reject(err);
          reader.readAsDataURL(logoFile);
        });
        
        await API.post("/settings/logo", {
          logo_base64: base64Data
        });
      }
      
      const payload = {
        nombre_comercial: document.getElementById("biz-nombre").value,
        cedula_juridica: document.getElementById("biz-cedula").value,
        razon_social: document.getElementById("biz-social").value,
        telefonos: document.getElementById("biz-tel").value,
        correo: document.getElementById("biz-mail").value,
        direccion: document.getElementById("biz-dir").value,
        sitio_web: document.getElementById("biz-sitio-web").value
      };
      
      await API.put("/settings/company", payload);
      await App.loadCompanySettings();
      
      App.showToast("Configuración Guardada", "La información de la empresa se ha actualizado con éxito.", "success");
      
      const updatedBiz = App.companySettings;
      const previewContainer = document.getElementById("biz-logo-preview-container");
      if (previewContainer && updatedBiz.logo_path) {
        previewContainer.innerHTML = `<img id="biz-logo-preview" src="${updatedBiz.logo_path}?t=${new Date().getTime()}" style="width:100%; height:100%; object-fit:contain;">`;
      }
      logoInput.value = ""; 
    } catch (err) {
      App.showToast("Error", "No se pudo guardar la configuración: " + err.message, "error");
    } finally {
      btn.disabled = false;
      btn.textContent = "💾 Guardar Cambios Empresariales";
    }
  };

  const smtpForm = document.getElementById("smtp-config-form");
  smtpForm.onsubmit = async (e) => {
    e.preventDefault();
    const btn = document.getElementById("btn-save-smtp");
    btn.disabled = true;
    btn.textContent = "Guardando...";
    try {
      const payload = {
        smtp_host: document.getElementById("smtp-host").value,
        smtp_port: document.getElementById("smtp-port").value,
        smtp_user: document.getElementById("smtp-user").value,
        smtp_from_name: document.getElementById("smtp-from-name").value,
        smtp_from_email: document.getElementById("smtp-from-email").value,
        smtp_use_ssl: document.getElementById("smtp-use-ssl").checked ? "true" : "false"
      };
      const pass = document.getElementById("smtp-password").value;
      if (pass) {
        payload.smtp_password = pass;
      }
      await API.put("/settings/smtp", payload);
      App.showToast("SMTP Configurado", "Los parámetros del servidor SMTP se guardaron correctamente.", "success");
    } catch (err) {
      App.showToast("Error", "No se pudo guardar la configuración SMTP: " + err.message, "error");
    } finally {
      btn.disabled = false;
      btn.textContent = "💾 Guardar Configuración SMTP";
    }
  };

  const btnTestSmtp = document.getElementById("btn-test-smtp");
  btnTestSmtp.onclick = async () => {
    const testEmail = document.getElementById("smtp-test-email").value.trim();
    if (!testEmail) {
      App.showToast("Correo Requerido", "Ingrese un correo destinatario para realizar la prueba.", "warning");
      return;
    }
    
    btnTestSmtp.disabled = true;
    btnTestSmtp.textContent = "Probando...";
    
    const diagDiv = document.getElementById("smtp-diagnostic-results");
    const connectionStep = document.getElementById("diag-step-connection");
    const authStep = document.getElementById("diag-step-auth");
    const sendStep = document.getElementById("diag-step-send");
    
    diagDiv.style.display = "flex";
    connectionStep.innerHTML = `⏳ Probando conexión al servidor...`;
    authStep.innerHTML = `⏳ Esperando conexión...`;
    sendStep.innerHTML = `⏳ Esperando autenticación...`;
    
    try {
      const payload = {
        email: testEmail,
        smtp_host: document.getElementById("smtp-host").value,
        smtp_port: document.getElementById("smtp-port").value,
        smtp_user: document.getElementById("smtp-user").value,
        smtp_from_name: document.getElementById("smtp-from-name").value,
        smtp_from_email: document.getElementById("smtp-from-email").value,
        smtp_use_ssl: document.getElementById("smtp-use-ssl").checked ? "true" : "false"
      };
      const pass = document.getElementById("smtp-password").value;
      if (pass) {
        payload.smtp_password = pass;
      }
      
      const res = await API.post("/settings/test-email", payload);
      
      // Mostrar conexión
      if (res.conexion) {
        connectionStep.innerHTML = `<span style="color: var(--success); font-weight: bold;">✓ Conexión correcta</span>`;
      } else {
        connectionStep.innerHTML = `<span style="color: var(--error); font-weight: bold;">✗ Error de Conexión:</span> <span style="font-size: 0.8rem; color: var(--text-muted);">${res.error_conexion || "Desconocido"}</span>`;
        authStep.innerHTML = `<span style="color: var(--text-muted);">✗ Autenticación no ejecutada</span>`;
        sendStep.innerHTML = `<span style="color: var(--text-muted);">✗ Envío no ejecutado</span>`;
        App.showToast("Prueba Fallida", "No se pudo conectar al servidor SMTP.", "error");
        return;
      }
      
      // Mostrar autenticación
      if (res.autenticacion) {
        authStep.innerHTML = `<span style="color: var(--success); font-weight: bold;">✓ Autenticación correcta</span>`;
      } else {
        authStep.innerHTML = `<span style="color: var(--error); font-weight: bold;">✗ Error de Autenticación:</span> <span style="font-size: 0.8rem; color: var(--text-muted);">${res.error_autenticacion || "Desconocido"}</span>`;
        sendStep.innerHTML = `<span style="color: var(--text-muted);">✗ Envío no ejecutado</span>`;
        App.showToast("Prueba Fallida", "Autenticación SMTP rechazada.", "error");
        return;
      }
      
      // Mostrar envío
      if (res.envio) {
        sendStep.innerHTML = `<span style="color: var(--success); font-weight: bold;">✓ Correo enviado</span>`;
        App.showToast("Prueba Exitosa", "¡El correo de prueba fue enviado con éxito!", "success");
      } else {
        sendStep.innerHTML = `<span style="color: var(--error); font-weight: bold;">✗ Error de Envío:</span> <span style="font-size: 0.8rem; color: var(--text-muted);">${res.error_envio || "Desconocido"}</span>`;
        App.showToast("Prueba Fallida", "Fallo al enviar el correo.", "error");
      }
      
    } catch (err) {
      connectionStep.innerHTML = `<span style="color: var(--error); font-weight: bold;">✗ Error general del API</span>`;
      authStep.innerHTML = `<span style="color: var(--text-muted);">✗ Fallido</span>`;
      sendStep.innerHTML = `<span style="color: var(--text-muted);">✗ Fallido</span>`;
      App.showToast("Error", err.message || "Fallo crítico al llamar al endpoint de prueba.", "error");
    } finally {
      btnTestSmtp.disabled = false;
      btnTestSmtp.textContent = "⚡ Probar Correo";
    }
  };

  const refreshWaBtn = document.getElementById("btn-refresh-wa");
  refreshWaBtn.onclick = async () => {
    const tbody = document.getElementById("wa-logs-list-body");
    tbody.innerHTML = `<tr><td colspan="4" style="text-align: center;">Cargando logs...</td></tr>`;
    try {
      const logs = await API.get("/settings/whatsapp/logs");
      if (logs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted);">No hay logs de WhatsApp registrados.</td></tr>`;
      } else {
        tbody.innerHTML = logs.map(log => `
          <tr>
            <td><code>${log.telefono}</code></td>
            <td style="font-size: 0.8rem; max-width: 300px; white-space: normal; word-break: break-all;">${log.mensaje}</td>
            <td>${new Date(log.fecha_envio).toLocaleString("es-CR")}</td>
            <td><span class="badge badge-success">${log.estado.toUpperCase()}</span></td>
          </tr>
        `).join("");
      }
    } catch (e) {
      tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--error);">Error al cargar logs: ${e.message}</td></tr>`;
    }
  };

  loadBackupsList();
  if (isAdmin) {
    loadUsersList();
    document.getElementById("btn-save-user").onclick = saveUserCredentials;
  }
}

async function loadBackupsList() {
  const tbody = document.getElementById("backups-list-body");
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="4" style="text-align: center;">Cargando lista de respaldos...</td></tr>`;

  try {
    const list = await API.get("/backups/list");
    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" style="text-align: center;">No hay respaldos creados en el servidor.</td></tr>`;
      return;
    }

    tbody.innerHTML = "";
    list.forEach(b => {
      const sizeKB = (b.size / 1024).toFixed(1);
      const fecha = new Date(b.created_at).toLocaleString("es-CR");
      
      tbody.innerHTML += `
        <tr>
          <td><code>${b.filename}</code></td>
          <td>${sizeKB} KB</td>
          <td>${fecha}</td>
          <td>
            <button class="btn btn-secondary btn-restore-db" data-file="${b.filename}" style="padding: 4px 8px; font-size: 0.75rem;">Restaurar</button>
          </td>
        </tr>
      `;
    });

    tbody.querySelectorAll(".btn-restore-db").forEach(btn => {
      btn.addEventListener("click", () => {
        const file = btn.getAttribute("data-file");
        triggerRestoreBackup(file);
      });
    });

  } catch (error) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--error);">Error al cargar respaldos: ${error.message}</td></tr>`;
  }
}

async function triggerNewBackup() {
  const btn = document.getElementById("btn-create-backup");
  btn.disabled = true;
  btn.textContent = "Guardando respaldo...";

  try {
    const res = await API.post("/backups/create");
    App.showToast("Respaldo Creado", `Archivo generado: ${res.filename}`, "success");
    loadBackupsList();
  } catch (error) {
    App.showToast("Error", "No se pudo crear la copia de seguridad: " + error.message, "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "💾 Crear Respaldo Ahora";
  }
}

async function triggerRestoreBackup(filename) {
  if (confirm(`⚠️ ALERTA: ¿Está seguro de restaurar la base de datos al archivo "${filename}"? Todos los cambios desde esa fecha se perderán y la sesión se cerrará.`)) {
    try {
      await API.post("/backups/restore", { filename });
      alert("Base de datos restaurada correctamente. La sesión se cerrará.");
      API.clearToken();
      window.location.reload();
    } catch (error) {
      App.showToast("Error de Restauración", error.message || "Fallo crítico al restaurar.", "error");
    }
  }
}

// --- GESTIÓN DE USUARIOS ---

async function loadUsersList() {
  const tbody = document.getElementById("users-list-body");
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="4" style="text-align: center;">Cargando lista de usuarios...</td></tr>`;

  try {
    const list = await API.get("/settings/users");
    tbody.innerHTML = "";
    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" style="text-align: center;">No hay usuarios registrados.</td></tr>`;
      return;
    }

    list.forEach(u => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><strong>${u.nombre}</strong></td>
        <td><code>${u.username}</code></td>
        <td>${u.rol}</td>
        <td style="text-align: center;">
          <button class="btn btn-primary btn-edit-user-credentials" data-id="${u.id}" style="padding: 4px 8px; font-size: 0.75rem;">✏️ Modificar</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll(".btn-edit-user-credentials").forEach(btn => {
      btn.onclick = () => {
        const id = parseInt(btn.getAttribute("data-id"));
        const userObj = list.find(x => x.id === id);
        if (userObj) {
          openUserEditModal(userObj);
        }
      };
    });
  } catch (error) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--error);">Error al cargar usuarios: ${error.message}</td></tr>`;
  }
}

function openUserEditModal(user) {
  document.getElementById("edit-user-id").value = user.id;
  document.getElementById("edit-user-nombre").value = user.nombre;
  document.getElementById("edit-user-username").value = user.username;
  document.getElementById("edit-user-email").value = user.email || "";
  document.getElementById("edit-user-password").value = "";
  
  App.openModal("user-edit-modal");
}

async function saveUserCredentials() {
  const id = document.getElementById("edit-user-id").value;
  const btn = document.getElementById("btn-save-user");
  
  const payload = {
    nombre: document.getElementById("edit-user-nombre").value.trim(),
    username: document.getElementById("edit-user-username").value.trim(),
    email: document.getElementById("edit-user-email").value.trim(),
    password: document.getElementById("edit-user-password").value.trim()
  };

  if (!payload.nombre || !payload.username) {
    App.showToast("Campos requeridos", "Nombre y nombre de usuario son obligatorios.", "warning");
    return;
  }

  btn.disabled = true;
  btn.textContent = "Guardando...";

  try {
    await API.put(`/settings/users/${id}`, payload);
    App.showToast("Usuario Actualizado", "Las credenciales del usuario se han modificado con éxito.", "success");
    document.getElementById("user-edit-modal").classList.remove("active");
    loadUsersList();
  } catch (error) {
    App.showToast("Error", error.message || "No se pudo actualizar el usuario.", "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "💾 Guardar Cambios";
  }
}
