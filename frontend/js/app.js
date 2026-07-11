import { API } from "./api.js";
import { DBOffline } from "./db_offline.js";

// Componentes modulares
import { renderPOS } from "./pos.js";
import { renderInventory } from "./inventory.js";
import { renderCash } from "./cash.js?v=turno";
import { renderReports } from "./reports.js";
import { renderSettings } from "./settings.js";
import { renderClients } from "./clients.js";
import { renderPurchases } from "./purchases.js?v=ocr";
import { renderBilling } from "./billing.js";


export const App = {
  activeView: "dashboard",
  isOnline: navigator.onLine,
  syncIntervalId: null,

  companySettings: null,

  async loadCompanySettings() {
    try {
      this.companySettings = await API.get("/settings/company");
      this.applyCompanySettings();
    } catch (e) {
      console.error("Error loading company settings:", e);
    }
  },

  applyCompanySettings() {
    if (!this.companySettings) return;
    const logoImg = document.getElementById("sidebar-logo-img");
    const logoIcon = document.getElementById("sidebar-logo-icon");
    const logoText = document.getElementById("sidebar-logo-text");
    if (logoText) {
      logoText.textContent = this.companySettings.nombre_comercial || "Minisúper M Y M";
    }
    if (this.companySettings.logo_path) {
      if (logoImg) {
        logoImg.src = this.companySettings.logo_path + "?t=" + new Date().getTime();
        logoImg.style.display = "block";
      }
      if (logoIcon) logoIcon.style.display = "none";
    } else {
      if (logoImg) logoImg.style.display = "none";
      if (logoIcon) logoIcon.style.display = "block";
    }
    document.title = `${this.companySettings.nombre_comercial || "Minisúper M Y M"} - ERP & POS`;
  },

  async init() {
    this.setupTheme();
    this.setupNetworkMonitor();
    this.setupUnauthorizedHandler();
    this.setupNavigation();
    await this.loadCompanySettings();
    if (API.getToken()) {
      await this.loadUserProfile();
    } else {
      this.showLoginOverlay();
    }
  },

  // --- CONFIGURACIÓN DE TEMA (CLARO/OSCURO) ---
  setupTheme() {
    const savedTheme = localStorage.getItem("app_theme") || "light";
    document.documentElement.setAttribute("data-theme", savedTheme);
    
    const themeBtn = document.getElementById("theme-toggle");
    if (themeBtn) {
      themeBtn.innerHTML = savedTheme === "dark" 
        ? '☀️ Modo Claro' 
        : '🌙 Modo Oscuro';
      themeBtn.addEventListener("click", () => {
        const currentTheme = document.documentElement.getAttribute("data-theme");
        const newTheme = currentTheme === "dark" ? "light" : "dark";
        document.documentElement.setAttribute("data-theme", newTheme);
        localStorage.setItem("app_theme", newTheme);
        themeBtn.innerHTML = newTheme === "dark" ? '☀️ Modo Claro' : '🌙 Modo Oscuro';
      });
    }
  },

  // --- CONTROLADOR DE SESIÓN VENCIDA ---
  setupUnauthorizedHandler() {
    window.addEventListener("pos-unauthorized", () => {
      this.showToast("Sesión Vencida", "Su sesión ha expirado. Por favor, inicie sesión de nuevo.", "warning");
      this.showLoginOverlay();
    });
  },

  // --- MONITOREO DE CONEXIÓN A INTERNET ---
  setupNetworkMonitor() {
    const updateIndicator = () => {
      this.isOnline = navigator.onLine;
      const dot = document.getElementById("connection-dot");
      const text = document.getElementById("connection-text");
      
      if (dot && text) {
        if (this.isOnline) {
          dot.classList.remove("offline");
          text.textContent = "En Línea";
          this.showToast("Conexión Restablecida", "Sincronizando transacciones offline...", "success");
          this.triggerOfflineSync();
        } else {
          dot.classList.add("offline");
          text.textContent = "Modo Fuera de Línea";
          this.showToast("Sin Conexión", "El POS seguirá funcionando de forma offline.", "warning");
        }
      }
    };

    window.addEventListener("online", updateIndicator);
    window.addEventListener("offline", updateIndicator);
    
    // Inicializar indicador
    updateIndicator();

    // Cron automático de sincronización cada 60 segundos si está online
    this.syncIntervalId = setInterval(() => {
      if (this.isOnline && API.getToken()) {
        this.triggerOfflineSync();
      }
    }, 60000);
  },

  // --- SINCRONIZACIÓN DE TRANSACCIONES OFFLINE ---
  async triggerOfflineSync() {
    try {
      const pendingSales = await DBOffline.getQueuedSales();
      if (pendingSales.length === 0) return;

      console.log(`Sincronizando ${pendingSales.length} ventas offline...`);
      const syncResult = await API.post("/pos/sync", pendingSales);
      
      if (syncResult.status === "completed") {
        // Remover de la cola local las que se sincronizaron con éxito
        for (const consec of syncResult.sincronizadas) {
          await DBOffline.removeQueuedSale(consec);
        }
        
        if (syncResult.sincronizadas.length > 0) {
          this.showToast("Sincronización POS", `Sincronizadas con éxito ${syncResult.sincronizadas.length} ventas locales.`, "success");
          // Si estamos en la vista de reportes o pos, refrescar datos
          this.refreshActiveView();
        }
        
        if (syncResult.conflictos.length > 0) {
          this.showToast("Conflictos en Sinc.", `${syncResult.conflictos.length} ventas presentaron conflictos de integridad.`, "error");
          console.warn("Conflictos detectados en sync offline:", syncResult.conflictos);
          this.showConflictResolutionModal(syncResult.conflictos);
        }
      }
    } catch (error) {
      console.error("Error en sincronización automática offline:", error);
    }
  },

  // --- NAVEGACIÓN Y CARGA DE VISTAS (SPA) ---
  setupNavigation() {
    const navLinks = document.querySelectorAll(".nav-item a");
    navLinks.forEach(link => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        const viewName = link.getAttribute("data-view");
        this.navigateTo(viewName);
      });
    });
  },

  navigateTo(viewName) {
    if (!API.getToken()) {
      this.showLoginOverlay();
      return;
    }
    
    // Validar permisos del usuario para la vista
    const user = API.getUserInfo();
    const mapPermisos = {
      "pos": "pos:access",
      "inventory": "inventory:view",
      "cash": "cash:access",
      "reports": "reports:view",
      "settings": "settings:edit",
      "clients": "clients:access",
      "purchases": "purchases:access",
      "billing": "pos:access"
    };

    if (viewName !== "dashboard" && mapPermisos[viewName] && !user.permisos.includes(mapPermisos[viewName])) {
      this.showToast("Acceso Denegado", "No posee permisos para ingresar a este módulo.", "error");
      return;
    }

    this.activeView = viewName;

    // Actualizar clase activa en menú lateral
    document.querySelectorAll(".nav-item").forEach(item => {
      item.classList.remove("active");
      const link = item.querySelector("a");
      if (link && link.getAttribute("data-view") === viewName) {
        item.classList.add("active");
      }
    });

    // Cambiar título de cabecera
    const headerTitle = document.getElementById("header-title-text");
    const mapTitles = {
      "dashboard": "Dashboard Ejecutivo",
      "pos": "Punto de Venta (POS)",
      "inventory": "Control de Inventario y Catálogo",
      "cash": "Arqueo y Flujo de Caja",
      "reports": "Analíticas y Ganancias",
      "settings": "Configuración General",
      "clients": "Gestión de Clientes y Créditos",
      "purchases": "Recepción de Mercadería y Compras",
      "billing": "Facturación Electrónica (Hacienda Costa Rica)"
    };
    if (headerTitle) {
      headerTitle.textContent = mapTitles[viewName] || "Administración";
    }

    // Limpiar cuerpo y renderizar la vista seleccionada
    const body = document.getElementById("content-body-root");
    if (body) {
      body.innerHTML = "";
      this.renderView(viewName, body);
    }
  },

  renderView(viewName, container) {
    switch (viewName) {
      case "dashboard":
        renderReports(container, true); // Dashboard principal es una variante compacta de reportes
        break;
      case "pos":
        renderPOS(container);
        break;
      case "inventory":
        renderInventory(container);
        break;
      case "cash":
        renderCash(container);
        break;
      case "reports":
        renderReports(container, false);
        break;
      case "settings":
        renderSettings(container);
        break;
      case "clients":
        renderClients(container);
        break;
      case "purchases":
        renderPurchases(container);
        break;
      case "billing":
        renderBilling(container);
        break;
    }
  },

  refreshActiveView() {
    const body = document.getElementById("content-body-root");
    if (body) {
      body.innerHTML = "";
      this.renderView(this.activeView, body);
    }
  },

  // --- AUTENTICACIÓN: LOGIN & PERFIL ---
  showLoginOverlay() {
    // Si ya existe modal previo, removerlo
    const prev = document.getElementById("login-modal-overlay");
    if (prev) prev.remove();

    const overlay = document.createElement("div");
    overlay.id = "login-modal-overlay";
    overlay.className = "login-overlay";

    const logoHtml = this.companySettings && this.companySettings.logo_path
      ? `<img src="${this.companySettings.logo_path}?t=${new Date().getTime()}" alt="Logo" style="height: 70px; margin-bottom: 12px; border-radius: 6px; object-fit: contain;">`
      : `<div class="logo-icon">🏪</div>`;
      
    const nameText = this.companySettings && this.companySettings.nombre_comercial
      ? this.companySettings.nombre_comercial.toUpperCase()
      : "MINISÚPER M Y M";

    overlay.innerHTML = `
      <div class="login-card">
        <div class="login-header" style="text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center;">
          ${logoHtml}
          <h1 style="font-size: 1.6rem; font-weight: 700; margin-top: 8px; margin-bottom: 4px;">${nameText}</h1>
          <p style="font-size: 0.85rem; font-weight: 600; color: var(--text-secondary); margin-bottom: 12px;">Sistema ERP • POS • Inventario • Facturación</p>
          <p style="font-size: 0.8rem; color: var(--text-muted);">Ingrese sus credenciales de acceso</p>
        </div>
        <div class="form-group">
          <label>Usuario</label>
          <input type="text" id="login-username" class="input-field" placeholder="ej. admin" autocomplete="username">
        </div>
        <div class="form-group">
          <label>Contraseña</label>
          <input type="password" id="login-password" class="input-field" placeholder="••••••••" autocomplete="current-password">
        </div>
        <button id="login-submit-btn" class="btn btn-primary mt-4">Iniciar Sesión</button>
      </div>
    `;
    
    document.body.appendChild(overlay);

    // Enfocar campo usuario
    setTimeout(() => {
      document.getElementById("login-username").focus();
    }, 100);

    const submit = document.getElementById("login-submit-btn");
    
    const handleLoginSubmit = async () => {
      const username = document.getElementById("login-username").value;
      const password = document.getElementById("login-password").value;
      
      if (!username || !password) {
        this.showToast("Campos Vacíos", "Ingrese usuario y contraseña.", "warning");
        return;
      }

      submit.disabled = true;
      submit.textContent = "Verificando...";

      try {
        const data = await API.post("/auth/login", { username, password });
        API.setToken(data.access_token);
        API.setUserInfo(data.user);
        
        // Remover formulario
        overlay.remove();
        this.showToast("Bienvenido", `Sesión iniciada como ${data.user.nombre}`, "success");
        
        await this.loadUserProfile();
      } catch (error) {
        this.showToast("Acceso Fallido", error.message || "Usuario o contraseña incorrectos", "error");
        submit.disabled = false;
        submit.textContent = "Iniciar Sesión";
      }
    };

    submit.addEventListener("click", handleLoginSubmit);
    
    // Soporte para Enter
    overlay.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        handleLoginSubmit();
      }
    });
  },

  async loadUserProfile() {
    try {
      const user = await API.get("/auth/me");
      API.setUserInfo(user);
      
      // Renderizar datos del perfil en sidebar
      const avatar = document.getElementById("user-avatar-initials");
      const name = document.getElementById("user-profile-name");
      const role = document.getElementById("user-profile-role");
      
      if (avatar) avatar.textContent = user.nombre.substring(0, 2).toUpperCase();
      if (name) name.textContent = user.nombre;
      if (role) role.textContent = user.rol;

      // Habilitar/Deshabilitar botones del menú lateral según sus permisos
      const navPOS = document.getElementById("nav-pos");
      const navInv = document.getElementById("nav-inventory");
      const navCash = document.getElementById("nav-cash");
      const navRep = document.getElementById("nav-reports");
      const navSet = document.getElementById("nav-settings");
      const navClients = document.getElementById("nav-clients");
      const navPurchases = document.getElementById("nav-purchases");
      const navBilling = document.getElementById("nav-billing");
      
      if (navPOS) navPOS.style.display = user.permisos.includes("pos:access") ? "block" : "none";
      if (navInv) navInv.style.display = user.permisos.includes("inventory:view") ? "block" : "none";
      if (navCash) navCash.style.display = user.permisos.includes("cash:access") ? "block" : "none";
      if (navRep) navRep.style.display = user.permisos.includes("reports:view") ? "block" : "none";
      if (navSet) navSet.style.display = user.permisos.includes("settings:edit") ? "block" : "none";
      if (navClients) navClients.style.display = user.permisos.includes("clients:access") ? "block" : "none";
      if (navPurchases) navPurchases.style.display = user.permisos.includes("purchases:access") ? "block" : "none";
      if (navBilling) navBilling.style.display = user.permisos.includes("pos:access") ? "block" : "none";

      // Configurar botón logout
      const logoutBtn = document.getElementById("logout-btn");
      if (logoutBtn) {
        logoutBtn.onclick = async (e) => {
          e.preventDefault();
          try {
            await API.post("/auth/logout");
          } catch(err) {}
          API.clearToken();
          this.showLoginOverlay();
        };
      }

      // Sincronizar catálogo local de productos con IndexedDB en segundo plano
      this.syncCatalogLocal();

      // Ir a la vista principal
      this.navigateTo("dashboard");

    } catch (error) {
      console.error("Error cargando perfil:", error);
      this.showLoginOverlay();
    }
  },

  async syncCatalogLocal() {
    if (!this.isOnline) return;
    try {
      console.log("Actualizando catálogo local offline...");
      const products = await API.get("/inventory/products");
      await DBOffline.saveProducts(products);
      console.log("Catálogo offline de productos guardado con éxito.");
    } catch (e) {
      console.error("Error sincronizando catálogo local en IndexedDB:", e);
    }
  },

  // --- UTILERÍA DE NOTIFICACIONES TOAST ---
  showToast(title, message, type = "info") {
    const container = document.getElementById("toast-root");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    
    // Iconos temáticos
    const icons = {
      success: "🟢",
      error: "🔴",
      warning: "🟡",
      info: "🔵"
    };

    toast.innerHTML = `
      <div class="toast-icon">${icons[type] || "🔵"}</div>
      <div class="toast-content">
        <div class="toast-title">${title}</div>
        <div class="toast-message">${message}</div>
      </div>
    `;

    container.appendChild(toast);

    // Auto desvanecer a los 4 segundos
    setTimeout(() => {
      toast.style.opacity = "0";
      setTimeout(() => {
        toast.remove();
      }, 200);
    }, 4000);
  },

  // --- UTILERÍA PARA MANEJO DE MODALES ---
  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add("active");
    }
  },

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove("active");
    }
  },

  showConflictResolutionModal(conflictos) {
    const prev = document.getElementById("conflict-modal-overlay");
    if (prev) prev.remove();

    const overlay = document.createElement("div");
    overlay.id = "conflict-modal-overlay";
    overlay.className = "modal-wrapper active";
    
    let rowsHtml = "";
    conflictos.forEach(c => {
      rowsHtml += `
        <tr style="border-bottom: 1px solid var(--border-color);">
          <td style="padding: 12px; font-weight: 600;">${c.consecutivo}</td>
          <td style="padding: 12px; color: var(--error);">${c.error}</td>
          <td style="padding: 12px;">
            <button class="btn btn-secondary" onclick="window.removeConflictiveSale('${c.consecutivo}')" style="padding: 4px 8px; font-size: 0.75rem;">Descartar</button>
          </td>
        </tr>
      `;
    });

    overlay.innerHTML = `
      <div class="modal-card" style="width: 650px; max-width: 90%;">
        <div class="modal-header">
          <h3>🚨 Conflictos de Sincronización Offline</h3>
          <button class="close-btn" onclick="document.getElementById('conflict-modal-overlay').remove()">&times;</button>
        </div>
        <div class="modal-body">
          <p style="margin-bottom: 16px; color: var(--text-secondary);">
            Los siguientes comprobantes registrados fuera de línea no se pudieron sincronizar debido a problemas de consistencia (ej: falta de stock, límite de crédito excedido, etc.).
          </p>
          <div class="table-container" style="margin-top: 0; max-height: 250px; overflow-y: auto;">
            <table class="data-table" style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr style="background-color: var(--bg-tertiary); text-align: left;">
                  <th style="padding: 12px;">Comprobante</th>
                  <th style="padding: 12px;">Causa del Error</th>
                  <th style="padding: 12px;">Acción</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-primary" onclick="document.getElementById('conflict-modal-overlay').remove()">Cerrar</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    window.removeConflictiveSale = async (consecutivo) => {
      if (confirm(`¿Está seguro de descartar la venta offline ${consecutivo}? Esta acción no se puede deshacer.`)) {
        await DBOffline.removeQueuedSale(consecutivo);
        App.showToast("Descartado", `Comprobante ${consecutivo} eliminado de la cola local.`, "info");
        const index = conflictos.findIndex(c => c.consecutivo === consecutivo);
        if (index > -1) {
          conflictos.splice(index, 1);
          if (conflictos.length === 0) {
            overlay.remove();
          } else {
            this.showConflictResolutionModal(conflictos);
          }
        }
      }
    };
  }
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    App.init();
  });
} else {
  App.init();
}
