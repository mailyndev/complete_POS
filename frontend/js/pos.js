import { API } from "./api.js";
import { DBOffline } from "./db_offline.js";
import { App } from "./app.js";

// Carrito en memoria local
let cart = [];
let selectedPaymentMethod = "efectivo";
let selectedClient = null;
let discountPercent = 0;
let taxRate = 13; // default
let currentCashierArqueo = null;

export async function renderPOS(container) {
  // 1. Validar si la caja está abierta primero
  try {
    const cashStatus = await API.get("/cash/status");
    if (!cashStatus.open) {
      renderCashRegisterClosedScreen(container);
      return;
    }
    currentCashierArqueo = cashStatus.arqueo;
  } catch (error) {
    console.error("Error verificando caja:", error);
    // En modo offline asumimos que está abierta si hay datos locales previos
    currentCashierArqueo = { id: 1, caja_nombre: "Caja Local (Offline)" };
  }

  // 2. Si está abierta, renderizar pantalla de POS
  container.innerHTML = `
    <div class="pos-container">
      
      <!-- PANEL IZQUIERDO: CARRITO DE COMPRAS -->
      <div class="pos-cart-panel">
        <div class="pos-panel-title">
          <span>🛒 Carrito de Compras</span>
          <button id="clear-cart-btn" class="btn btn-secondary" style="padding: 4px 8px; font-size: 0.75rem;">Limpiar Todo</button>
        </div>
        <div id="cart-list" class="cart-items-list">
          <!-- Items del carrito se inyectan dinámicamente -->
          <div style="text-align: center; color: var(--text-muted); padding: 40px 20px; font-size: 0.85rem;">
            Carrito vacío. Escanee un producto o búsquelo en el catálogo.
          </div>
        </div>
        
        <!-- Teclado de apoyo táctil/numérico rápido -->
        <div style="padding: 12px; border-top: 1px solid var(--border-color); background-color: var(--bg-tertiary);">
          <div class="pos-numpad">
            <button class="numpad-btn" data-num="1">1</button>
            <button class="numpad-btn" data-num="2">2</button>
            <button class="numpad-btn" data-num="3">3</button>
            <button class="numpad-btn" data-num="4">4</button>
            <button class="numpad-btn" data-num="5">5</button>
            <button class="numpad-btn" data-num="6">6</button>
            <button class="numpad-btn" data-num="7">7</button>
            <button class="numpad-btn" data-num="8">8</button>
            <button class="numpad-btn" data-num="9">9</button>
            <button class="numpad-btn" data-num="C">C</button>
            <button class="numpad-btn" data-num="0">0</button>
            <button class="numpad-btn" data-num="*">* Cant</button>
          </div>
        </div>
      </div>

      <!-- PANEL CENTRAL: BÚSQUEDA Y CATÁLOGO -->
      <div class="pos-catalog-panel">
        <div class="pos-search-bar">
          <div class="pos-scanner-input-container">
            <input type="text" id="pos-search-input" class="input-field" style="width: 100%;" placeholder="Escriba código de barras, SKU o nombre..." autocomplete="off">
            <span class="scanner-indicator" title="Listo para escanear"></span>
          </div>
          <button id="pos-search-btn" class="btn btn-primary">🔍</button>
        </div>

        <div id="pos-categories" class="pos-categories-strip">
          <button class="category-tab active" data-cat="all">Todos</button>
          <!-- Categorías inyectadas dinámicamente -->
        </div>

        <div id="pos-products-grid" class="pos-products-grid">
          <!-- Productos inyectados dinámicamente -->
        </div>
      </div>

      <!-- PANEL DERECHO: RESUMEN DE TRANSACCIÓN -->
      <div class="pos-checkout-panel">
        <div class="totals-summary">
          <div class="pos-panel-title" style="padding: 0 0 10px 0; border: none;">
            <span>📋 Resumen de Compra</span>
          </div>
          
          <div class="summary-row">
            <span>Subtotal:</span>
            <span id="pos-summary-subtotal">₡0.00</span>
          </div>
          <div class="summary-row">
            <span>Descuento %:</span>
            <input type="number" id="pos-discount-input" value="0" min="0" max="100" style="width: 60px; text-align: right;" class="input-field">
          </div>
          <div class="summary-row">
            <span>Impuestos (IVA):</span>
            <span id="pos-summary-tax">₡0.00</span>
          </div>
          <div class="summary-row total-row">
            <span>TOTAL:</span>
            <span id="pos-summary-total">₡0.00</span>
          </div>
        </div>

        <div class="payment-selector">
          <div class="form-group">
            <label>Cliente (Fideicomiso / Puntos)</label>
            <select id="pos-client-select" class="input-field">
              <option value="1">Cliente General</option>
              <!-- Clientes cargados dinámicamente -->
            </select>
          </div>

          <label class="form-group" style="font-size: 0.85rem; font-weight: 600;">Método de Pago</label>
          <div class="payment-methods-grid">
            <button class="payment-method-btn active" data-method="efectivo">💵 Efectivo (F1)</button>
            <button class="payment-method-btn" data-method="tarjeta">💳 Tarjeta (F2)</button>
            <button class="payment-method-btn" data-method="sinpe">📱 SINPE Móvil (F3)</button>
            <button class="payment-method-btn" data-method="credito">🤝 Crédito (F4)</button>
            <button class="payment-method-btn" data-method="puntos">🎖️ Puntos (F5)</button>
          </div>

          <div class="checkout-inputs mt-4">
            <div class="form-group" id="received-amount-group">
              <label>Monto Recibido</label>
              <input type="number" id="pos-received-input" class="input-field" placeholder="₡0.00">
            </div>
            
            <div id="change-box" class="change-display">
              Vuelto: ₡0.00
            </div>
          </div>
        </div>

        <div class="checkout-actions">
          <button id="pos-suspend-btn" class="btn btn-secondary">📥 Suspender (F8)</button>
          <button id="pos-suspended-list-btn" class="btn btn-secondary">📂 Recuperar Venta</button>
          <button id="pos-pay-btn" class="btn btn-primary" style="height: 50px; font-size: 1.1rem;">💰 REGISTRAR VENTA (F12)</button>
        </div>
      </div>

    </div>

    <!-- MODAL DE TICKET / FACTURA -->
    <div id="ticket-modal" class="modal-wrapper">
      <div class="modal-card" style="width: 380px;">
        <div class="modal-header">
          <h3>🧾 Tiquete de Caja</h3>
          <button class="close-btn" id="close-ticket-btn">&times;</button>
        </div>
        <div class="modal-body" style="background-color: #fff; color: #000; font-family: monospace; font-size: 0.8rem; padding: 16px;">
          <pre id="ticket-text" style="white-space: pre-wrap; font-family: monospace;"></pre>
        </div>
        <div class="modal-footer">
          <button id="print-ticket-btn" class="btn btn-primary">Imprimir Ticket</button>
          <button id="done-ticket-btn" class="btn btn-secondary">Listo</button>
        </div>
      </div>
    </div>

    <!-- MODAL DE VENTAS SUSPENDIDAS -->
    <div id="suspended-modal" class="modal-wrapper">
      <div class="modal-card" style="width: 600px;">
        <div class="modal-header">
          <h3>📥 Ventas Suspendidas</h3>
          <button class="close-btn" id="close-suspended-btn">&times;</button>
        </div>
        <div class="modal-body">
          <div class="table-container" style="margin-top: 0; max-height: 300px; overflow-y: auto;">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Consecutivo</th>
                  <th>Fecha</th>
                  <th>Cliente</th>
                  <th>Total</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody id="suspended-sales-list">
                <tr>
                  <td colspan="5" style="text-align: center;">Buscando ventas suspendidas...</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  `;

  // Inicializar componentes dinámicos
  setupPOSCatalog();
  setupPOSListeners();
  setupPOSKeyboardShortcuts();
}

function renderCashRegisterClosedScreen(container) {
  container.innerHTML = `
    <div style="max-width: 500px; margin: 80px auto; text-align: center; background-color: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 48px; box-shadow: var(--shadow-lg);">
      <div style="font-size: 4rem; margin-bottom: 24px;">🔒</div>
      <h1 style="font-size: 1.6rem; font-weight: 700; margin-bottom: 16px;">Turno de Caja Cerrado</h1>
      <p style="color: var(--text-secondary); line-height: 1.5; margin-bottom: 32px;">
        Para poder realizar ventas y utilizar la pantalla del POS, primero debe iniciar el turno diario de caja registrando el fondo inicial de efectivo.
      </p>
      <button id="pos-go-open-cash-btn" class="btn btn-primary" style="height: 48px; padding: 0 32px;">🔑 Ir a Apertura de Caja</button>
    </div>
  `;

  document.getElementById("pos-go-open-cash-btn").addEventListener("click", () => {
    App.navigateTo("cash");
  });
}

// --- CONFIGURACIÓN DE CATÁLOGO Y CATEGORÍAS ---

let catalogProducts = [];
let activeCategory = "all";

async function setupPOSCatalog() {
  const grid = document.getElementById("pos-products-grid");
  const categoriesStrip = document.getElementById("pos-categories");

  if (!grid || !categoriesStrip) return;

  try {
    // Intentar traer productos del servidor, si falla, cargar de IndexedDB
    if (App.isOnline) {
      catalogProducts = await API.get("/inventory/products");
      // Sincronizar localmente en background
      DBOffline.saveProducts(catalogProducts);
    } else {
      catalogProducts = await DBOffline.searchProducts("");
    }
    
    // Cargar categorías únicas de los productos
    const categoriesSet = new Set(catalogProducts.map(p => p.categoria));
    categoriesStrip.innerHTML = `<button class="category-tab active" data-cat="all">Todos</button>`;
    
    categoriesSet.forEach(cat => {
      if (cat) {
        categoriesStrip.innerHTML += `<button class="category-tab" data-cat="${cat}">${cat}</button>`;
      }
    });

    // Delegación de clic para categorías
    categoriesStrip.querySelectorAll(".category-tab").forEach(tab => {
      tab.addEventListener("click", () => {
        categoriesStrip.querySelectorAll(".category-tab").forEach(t => t.classList.remove("active"));
        tab.classList.add("active");
        activeCategory = tab.getAttribute("data-cat");
        filterPOSProducts();
      });
    });

    filterPOSProducts();

    // Cargar Clientes en el selector
    let clients = [];
    if (App.isOnline) {
      clients = await API.get("/clients");
      // Podríamos guardar clientes localmente si quisiéramos, pero por ahora usamos el endpoint online
    }
    const select = document.getElementById("pos-client-select");
    if (select) {
      select.innerHTML = `<option value="1" data-pts="0">Cliente General (0 pts)</option>`;
      clients.forEach(c => {
        if (c.identificacion !== "0000000000") {
          select.innerHTML += `<option value="${c.id}" data-pts="${c.puntos_acumulados}">${c.nombre} (${c.puntos_acumulados} pts)</option>`;
        }
      });
    }

  } catch (error) {
    console.error("Error cargando catálogo POS:", error);
    grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--error);">Error al cargar catálogo de productos.</div>`;
  }
}

function filterPOSProducts(searchStr = "") {
  const grid = document.getElementById("pos-products-grid");
  if (!grid) return;

  grid.innerHTML = "";

  // Si no hay búsqueda activa ni categoría seleccionada (está en "Todos"), mostrar pantalla limpia y minimalista
  if (!searchStr && activeCategory === "all") {
    grid.innerHTML = `
      <div style="grid-column: 1/-1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60px 20px; color: var(--text-secondary); text-align: center; background: var(--bg-secondary); border: 1px dashed var(--border-color); border-radius: var(--radius-lg); margin-top: 10px; box-shadow: var(--shadow-sm);">
        <div style="font-size: 3.5rem; margin-bottom: 16px; color: var(--brand-color); opacity: 0.85;">🏪</div>
        <h3 style="font-size: 1.1rem; font-weight: 600; margin-bottom: 8px; color: var(--text-primary);">Escáner y Autocompletado Listos</h3>
        <p style="font-size: 0.85rem; max-width: 340px; line-height: 1.5; color: var(--text-muted);">
          Escanee un código de barras o escriba para usar el autocompletado inteligente. Seleccione una categoría para explorar productos manualmente.
        </p>
      </div>
    `;
    return;
  }

  const filtered = catalogProducts.filter(p => {
    const matchesCat = activeCategory === "all" || p.categoria === activeCategory;
    const matchesSearch = !searchStr || 
      p.nombre.toLowerCase().includes(searchStr.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchStr.toLowerCase()) ||
      p.codigo_barras === searchStr;
    return matchesCat && matchesSearch;
  });

  if (filtered.length === 0) {
    grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted); font-size: 0.85rem;">No se encontraron productos.</div>`;
    return;
  }

  filtered.forEach(p => {
    grid.innerHTML += `
      <div class="pos-product-card" data-id="${p.id}">
        <div class="pos-product-name">${p.nombre}</div>
        <div class="flex-between" style="align-items: flex-end; margin-top: auto;">
          <div class="pos-product-price">₡${p.precio_venta.toLocaleString("es-CR", { minimumFractionDigits: 2 })}</div>
          <div class="pos-product-stock">Stock: ${p.existencia}</div>
        </div>
      </div>
    `;
  });

  // Evento click en tarjetas de producto
  grid.querySelectorAll(".pos-product-card").forEach(card => {
    card.addEventListener("click", () => {
      const id = parseInt(card.getAttribute("data-id"));
      const product = catalogProducts.find(p => p.id === id);
      if (product) {
        addToCart(product);
      }
    });
  });
}

// --- LÓGICA DEL CARRITO ---

function isProductSoldByWeight(product) {
  if (!product || !product.unidad_medida) return false;
  const unit = product.unidad_medida.toLowerCase();
  return unit === "kilogramo" || unit === "kg" || unit === "gramo" || unit === "g" || unit === "libra" || unit === "lb";
}

function promptForWeight(product, multiplier = 1, callback) {
  // Crear contenedor de modal si no existe
  let modal = document.getElementById("pos-weight-modal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "pos-weight-modal";
    modal.className = "modal-wrapper";
    document.body.appendChild(modal);
  }
  
  modal.innerHTML = `
    <div class="modal-card" style="width: 320px;">
      <div class="modal-header">
        <h3>⚖️ Registrar Peso</h3>
      </div>
      <div class="modal-body" style="display: flex; flex-direction: column; gap: 12px; padding: 20px;">
        <div style="font-size: 0.95rem; font-weight: 600; color: var(--text-primary); text-align: center; margin-bottom: 8px;">
          ${product.nombre}
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 4px;">
          <span>Precio por ${product.unidad_medida}:</span>
          <strong>₡${product.precio_venta.toLocaleString("es-CR", { minimumFractionDigits: 2 })}</strong>
        </div>
        <div class="form-group">
          <label for="weight-input-value">Ingrese el peso (${product.unidad_medida}):</label>
          <input type="number" id="weight-input-value" class="input-field" step="0.001" min="0.001" placeholder="0.000" style="font-size: 1.5rem; text-align: center; font-weight: 700; width: 100%;">
        </div>
      </div>
      <div class="modal-footer" style="display: flex; justify-content: space-between; gap: 8px; width: 100%;">
        <button id="weight-modal-cancel" class="btn btn-secondary" style="flex: 1;">Cancelar</button>
        <button id="weight-modal-confirm" class="btn btn-primary" style="flex: 1;">Confirmar</button>
      </div>
    </div>
  `;
  
  modal.classList.add("active");
  
  const input = document.getElementById("weight-input-value");
  const confirmBtn = document.getElementById("weight-modal-confirm");
  const cancelBtn = document.getElementById("weight-modal-cancel");
  
  input.focus();
  
  function closeModal() {
    modal.classList.remove("active");
    const searchInput = document.getElementById("pos-search-input");
    if (searchInput) searchInput.focus();
  }
  
  function handleConfirm() {
    const weight = parseFloat(input.value);
    if (isNaN(weight) || weight <= 0) {
      App.showToast("Error de Peso", "Ingrese un peso válido mayor a cero.", "error");
      input.focus();
      return;
    }
    closeModal();
    callback(weight);
  }
  
  confirmBtn.addEventListener("click", handleConfirm);
  cancelBtn.addEventListener("click", closeModal);
  
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleConfirm();
    } else if (e.key === "Escape") {
      closeModal();
    }
  });
}

function addToCart(product, quantity = 1, isWeightConfirmed = false) {
  if (isProductSoldByWeight(product) && !isWeightConfirmed) {
    promptForWeight(product, quantity, (weight) => {
      addToCart(product, weight, true);
    });
    return;
  }

  const existing = cart.find(item => item.id === product.id);
  if (existing) {
    existing.cantidad += quantity;
  } else {
    cart.push({
      id: product.id,
      producto_id: product.id,
      nombre: product.nombre,
      sku: product.sku,
      codigo_barras: product.codigo_barras,
      precio_unitario: product.precio_venta,
      precio_costo: product.precio_costo,
      impuesto_porcentaje: product.impuesto_porcentaje || 13,
      impuesto_id: product.impuesto_id,
      cantidad: quantity,
      descuento_unitario: 0.0,
      unidad_medida: product.unidad_medida
    });
  }

  renderCart();
  
  const qtyText = isProductSoldByWeight(product) ? `${quantity.toFixed(3)} ${product.unidad_medida}` : `${quantity} ud`;
  App.showToast("Carrito", `${product.nombre} (${qtyText}) agregado.`, "info");
  
  const searchInput = document.getElementById("pos-search-input");
  if (searchInput) {
    searchInput.value = "";
    searchInput.focus();
  }
}

function renderCart() {
  const list = document.getElementById("cart-list");
  if (!list) return;

  if (cart.length === 0) {
    list.innerHTML = `
      <div style="text-align: center; color: var(--text-muted); padding: 40px 20px; font-size: 0.85rem;">
        Carrito vacío. Escanee un producto o búsquelo en el catálogo.
      </div>
    `;
    calculateTotals();
    return;
  }

  list.innerHTML = "";
  cart.forEach((item, index) => {
    const totalItem = (item.precio_unitario - item.descuento_unitario) * item.cantidad;
    const isWeight = item.unidad_medida && (
      item.unidad_medida.toLowerCase() === "kilogramo" || 
      item.unidad_medida.toLowerCase() === "kg" || 
      item.unidad_medida.toLowerCase() === "gramo" || 
      item.unidad_medida.toLowerCase() === "g" ||
      item.unidad_medida.toLowerCase() === "libra" ||
      item.unidad_medida.toLowerCase() === "lb"
    );
    const qtyDisplay = isWeight ? item.cantidad.toFixed(3) : item.cantidad;
    const unitLabel = isWeight ? ` ${item.unidad_medida}` : "";

    list.innerHTML += `
      <div class="cart-item" data-index="${index}">
        <div class="cart-item-details">
          <div class="cart-item-name" title="${item.nombre}">${item.nombre}</div>
          <div class="cart-item-price">₡${item.precio_unitario.toFixed(2)}${unitLabel ? ' /' + unitLabel : ''}</div>
        </div>
        <div class="cart-item-qty-control">
          <button class="qty-btn btn-minus">-</button>
          <div class="qty-value">${qtyDisplay}</div>
          <button class="qty-btn btn-plus">+</button>
        </div>
        <div class="cart-item-total">₡${totalItem.toFixed(2)}</div>
        <button class="cart-item-remove" title="Quitar">🗑️</button>
      </div>
    `;
  });

  list.querySelectorAll(".cart-item").forEach(itemEl => {
    const idx = parseInt(itemEl.getAttribute("data-index"));
    const item = cart[idx];
    const isWeight = item.unidad_medida && (
      item.unidad_medida.toLowerCase() === "kilogramo" || 
      item.unidad_medida.toLowerCase() === "kg" || 
      item.unidad_medida.toLowerCase() === "gramo" || 
      item.unidad_medida.toLowerCase() === "g" ||
      item.unidad_medida.toLowerCase() === "libra" ||
      item.unidad_medida.toLowerCase() === "lb"
    );

    itemEl.querySelector(".btn-plus").addEventListener("click", () => {
      if (isWeight) {
        const product = catalogProducts.find(p => p.id === item.id);
        if (product) {
          promptForWeight(product, 1, (weight) => {
            item.cantidad += weight;
            renderCart();
          });
        }
      } else {
        item.cantidad += 1;
        renderCart();
      }
    });

    itemEl.querySelector(".btn-minus").addEventListener("click", () => {
      if (isWeight) {
        const product = catalogProducts.find(p => p.id === item.id);
        if (product) {
          promptForWeight(product, 1, (weight) => {
            if (item.cantidad > weight) {
              item.cantidad -= weight;
            } else {
              cart.splice(idx, 1);
            }
            renderCart();
          });
        }
      } else {
        if (item.cantidad > 1) {
          item.cantidad -= 1;
        } else {
          cart.splice(idx, 1);
        }
        renderCart();
      }
    });

    itemEl.querySelector(".cart-item-remove").addEventListener("click", () => {
      cart.splice(idx, 1);
      renderCart();
    });
  });

  calculateTotals();
}

let cartTotals = { subtotal: 0, descuento: 0, impuesto: 0, total: 0 };

function calculateTotals() {
  let subtotal = 0;
  let impuesto = 0;
  
  cart.forEach(item => {
    const netoFila = (item.precio_unitario - item.descuento_unitario) * item.cantidad;
    subtotal += netoFila;
    // El impuesto se calcula sobre el neto de la fila
    // Impuesto = neto * (porcentaje / (100 + porcentaje)) si el precio tiene impuesto incluido.
    // Asumiremos que el precio de venta en Costa Rica ya incluye el IVA (precio final al consumidor),
    // por lo que debemos "desglosarlo".
    const factorImp = item.impuesto_porcentaje / (100 + item.impuesto_porcentaje);
    impuesto += netoFila * factorImp;
  });

  // Descuento global
  const descuento = subtotal * (discountPercent / 100);
  const total = subtotal - descuento;
  
  // Si aplicamos descuento global, recalculamos proporcionalmente el impuesto
  const impuestoAjustado = impuesto * (1 - (discountPercent / 100));
  const subtotalDesglosado = total - impuestoAjustado;

  cartTotals = {
    subtotal: subtotalDesglosado,
    descuento: descuento,
    impuesto: impuestoAjustado,
    total: total
  };

  // Renderizar en UI
  const subEl = document.getElementById("pos-summary-subtotal");
  const taxEl = document.getElementById("pos-summary-tax");
  const totEl = document.getElementById("pos-summary-total");

  if (subEl) subEl.textContent = `₡${cartTotals.subtotal.toLocaleString("es-CR", { minimumFractionDigits: 2 })}`;
  if (taxEl) taxEl.textContent = `₡${cartTotals.impuesto.toLocaleString("es-CR", { minimumFractionDigits: 2 })}`;
  if (totEl) totEl.textContent = `₡${cartTotals.total.toLocaleString("es-CR", { minimumFractionDigits: 2 })}`;

  // Autorellenar monto recibido si es Efectivo
  const recInput = document.getElementById("pos-received-input");
  if (recInput && selectedPaymentMethod === "efectivo" && !recInput.value) {
    // Sugerir cobro exacto o no setear nada para obligar a meter el pago
  }
  
  calculateChange();
}

function calculateChange() {
  const receivedInput = document.getElementById("pos-received-input");
  const changeBox = document.getElementById("change-box");

  if (!receivedInput || !changeBox) return;

  const recibido = parseFloat(receivedInput.value) || 0;
  const vuelto = recibido - cartTotals.total;

  if (selectedPaymentMethod === "efectivo") {
    if (vuelto >= 0) {
      changeBox.textContent = `Vuelto: ₡${vuelto.toLocaleString("es-CR", { minimumFractionDigits: 2 })}`;
      changeBox.style.color = "var(--success)";
    } else {
      changeBox.textContent = `Faltan: ₡${Math.abs(vuelto).toLocaleString("es-CR", { minimumFractionDigits: 2 })}`;
      changeBox.style.color = "var(--error)";
    }
  } else {
    changeBox.textContent = "Pago exacto requerido";
    changeBox.style.color = "var(--text-muted)";
  }
}

// --- GESTIÓN DE ACCIONES Y COBROS ---

// --- AUTOCOMPLETADO INTELIGENTE Y PREVENCIÓN DE INTERFERENCIA ---

let activeDropdownIndex = -1;
let autocompleteDebounceTimeout = null;
let lastKeyTime = 0;
let keyIntervals = [];

function setupAutocomplete(searchInput) {
  let dropdown = document.querySelector(".pos-autocomplete-dropdown");
  if (!dropdown) {
    dropdown = document.createElement("div");
    dropdown.className = "pos-autocomplete-dropdown";
    dropdown.style.display = "none";
    searchInput.parentNode.appendChild(dropdown);
  }

  // Ocultar al hacer click fuera
  document.addEventListener("click", (e) => {
    if (e.target !== searchInput && !dropdown.contains(e.target)) {
      hideDropdown();
    }
  });

  function hideDropdown() {
    dropdown.style.display = "none";
    dropdown.innerHTML = "";
    activeDropdownIndex = -1;
  }

  // Detectar velocidad de escritura para identificar escáneres de código de barras
  searchInput.addEventListener("input", (e) => {
    const now = Date.now();
    if (lastKeyTime > 0) {
      const interval = now - lastKeyTime;
      keyIntervals.push(interval);
      if (keyIntervals.length > 5) keyIntervals.shift();
    }
    lastKeyTime = now;

    // Si el intervalo promedio entre teclas es muy bajo, es un escáner
    let isScanner = false;
    if (keyIntervals.length >= 3) {
      const avgInterval = keyIntervals.reduce((a, b) => a + b, 0) / keyIntervals.length;
      if (avgInterval < 35) {
        isScanner = true;
      }
    }

    if (isScanner) {
      hideDropdown();
      return;
    }

    clearTimeout(autocompleteDebounceTimeout);
    autocompleteDebounceTimeout = setTimeout(() => {
      renderSuggestions();
    }, 150);
  });

  function renderSuggestions() {
    const query = searchInput.value.trim().toLowerCase();
    if (!query || query.startsWith("*")) {
      hideDropdown();
      return;
    }

    // Buscar en el catálogo en memoria local catalogProducts
    const matches = catalogProducts.filter(p => {
      const nameMatch = p.nombre && p.nombre.toLowerCase().includes(query);
      const skuMatch = p.sku && p.sku.toLowerCase().includes(query);
      const barcodeMatch = p.codigo_barras && p.codigo_barras.includes(query);
      const catMatch = p.categoria && p.categoria.toLowerCase().includes(query);
      const brandMatch = p.marca && p.marca.toLowerCase().includes(query);
      return nameMatch || skuMatch || barcodeMatch || catMatch || brandMatch;
    }).slice(0, 8);

    if (matches.length === 0) {
      hideDropdown();
      return;
    }

    dropdown.innerHTML = matches.map((p, idx) => {
      const isLowStock = p.existencia <= (p.stock_minimo || 5);
      return `
        <div class="autocomplete-item" data-id="${p.id}" data-idx="${idx}">
          <div class="autocomplete-item-left">
            <span class="autocomplete-item-name">${p.nombre}</span>
            <span class="autocomplete-item-meta">Cód: ${p.codigo_barras || p.sku || 'N/A'} | Cat: ${p.categoria || 'General'}</span>
          </div>
          <div class="autocomplete-item-right">
            <span class="autocomplete-item-price">₡${p.precio_venta.toLocaleString("es-CR", { minimumFractionDigits: 2 })}</span>
            <span class="autocomplete-item-stock ${isLowStock ? 'low-stock' : ''}">
              ${p.existencia <= 0 ? 'Agotado' : `Stock: ${p.existencia}`}
            </span>
          </div>
        </div>
      `;
    }).join("");

    dropdown.style.display = "block";
    activeDropdownIndex = -1;

    dropdown.querySelectorAll(".autocomplete-item").forEach(itemEl => {
      itemEl.addEventListener("click", () => {
        const id = parseInt(itemEl.getAttribute("data-id"));
        const product = catalogProducts.find(p => p.id === id);
        if (product) {
          addToCart(product);
          searchInput.value = "";
          hideDropdown();
        }
      });
    });
  }

  // Navegación por teclado en el input de búsqueda
  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      hideDropdown();
      return;
    }

    const items = dropdown.querySelectorAll(".autocomplete-item");

    if (dropdown.style.display === "block" && items.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        activeDropdownIndex = (activeDropdownIndex + 1) % items.length;
        highlightItem(items);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        activeDropdownIndex = (activeDropdownIndex - 1 + items.length) % items.length;
        highlightItem(items);
        return;
      }
    }

    if (e.key === "Enter") {
      // Solo interceptar Enter si el dropdown está abierto y hay un elemento activamente seleccionado por flechas
      if (dropdown.style.display === "block" && activeDropdownIndex >= 0 && activeDropdownIndex < items.length) {
        e.preventDefault();
        e.stopPropagation();
        const selectedEl = items[activeDropdownIndex];
        const id = parseInt(selectedEl.getAttribute("data-id"));
        const product = catalogProducts.find(p => p.id === id);
        if (product) {
          addToCart(product);
        }
        searchInput.value = "";
        hideDropdown();
      } else {
        // En caso contrario (por ejemplo, entrada directa de escáner), ocultar dropdown y dejar pasar
        hideDropdown();
      }
    }
  });

  function highlightItem(items) {
    items.forEach((item, idx) => {
      if (idx === activeDropdownIndex) {
        item.classList.add("selected");
        item.scrollIntoView({ block: "nearest" });
      } else {
        item.classList.remove("selected");
      }
    });
  }
}

function setupPOSListeners() {
  const searchInput = document.getElementById("pos-search-input");
  const searchBtn = document.getElementById("pos-search-btn");
  const clearBtn = document.getElementById("clear-cart-btn");
  const discountInput = document.getElementById("pos-discount-input");
  const receivedInput = document.getElementById("pos-received-input");
  const payBtn = document.getElementById("pos-pay-btn");
  const methodBtns = document.querySelectorAll(".payment-method-btn");
  const clientSelect = document.getElementById("pos-client-select");
  
  // Input de búsqueda / Código de barras
  if (searchInput) {
    searchInput.focus();
    
    // Inicializar el sistema de autocompletado inteligente
    setupAutocomplete(searchInput);
    
    // Si presiona enter en el buscador (y no fue interceptado por el autocompletado), busca el producto normalmente
    searchInput.addEventListener("keydown", async (e) => {
      if (e.key === "Enter") {
        const query = searchInput.value.trim();
        if (query) {
          e.preventDefault();
          await handleBarcodeOrSearch(query);
        }
      }
    });
  }

  if (searchBtn && searchInput) {
    searchBtn.addEventListener("click", () => {
      const query = searchInput.value.trim();
      if (query) {
        filterPOSProducts(query);
        App.showToast("Búsqueda", `Buscando resultados para: ${query}`, "info");
      }
    });
  }

  // Teclado numérico táctil
  document.querySelectorAll(".numpad-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const num = btn.getAttribute("data-num");
      const rec = document.getElementById("pos-received-input");
      if (!rec) return;

      if (num === "C") {
        rec.value = "";
      } else if (num === "*") {
        // Multiplicador rápido (ej: *5 en el buscador)
        const search = document.getElementById("pos-search-input");
        if (search) {
          search.value = "*" + search.value;
          search.focus();
        }
      } else {
        rec.value = (rec.value || "") + num;
      }
      calculateChange();
    });
  });

  // Métodos de pago
  methodBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      methodBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      selectedPaymentMethod = btn.getAttribute("data-method");
      
      const receivedGroup = document.getElementById("received-amount-group");
      const rec = document.getElementById("pos-received-input");
      
      if (selectedPaymentMethod !== "efectivo") {
        if (receivedGroup) receivedGroup.style.display = "none";
        if (rec) rec.value = cartTotals.total.toString();
      } else {
        if (receivedGroup) receivedGroup.style.display = "flex";
        if (rec) rec.value = "";
      }
      calculateTotals();
    });
  });

  // Cambio de descuento
  if (discountInput) {
    discountInput.addEventListener("input", () => {
      let val = parseInt(discountInput.value) || 0;
      if (val < 0) val = 0;
      if (val > 100) val = 100;
      discountInput.value = val;
      discountPercent = val;
      calculateTotals();
    });
  }

  // Cambio de monto recibido
  if (receivedInput) {
    receivedInput.addEventListener("input", calculateChange);
  }

  // Limpiar Carrito
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      cart = [];
      discountPercent = 0;
      if (discountInput) discountInput.value = 0;
      renderCart();
      App.showToast("Carrito", "El carrito ha sido vaciado.", "info");
    });
  }

  // Registro de Venta (Cobrar)
  if (payBtn) {
    payBtn.addEventListener("click", processCheckout);
  }

  // Clientes
  if (clientSelect) {
    clientSelect.addEventListener("change", () => {
      const selOpt = clientSelect.options[clientSelect.selectedIndex];
      selectedClient = {
        id: parseInt(clientSelect.value),
        nombre: selOpt.text,
        puntos: parseInt(selOpt.getAttribute("data-pts") || 0)
      };
    });
  }

  // Suspender Venta
  const suspendBtn = document.getElementById("pos-suspend-btn");
  if (suspendBtn) {
    suspendBtn.addEventListener("click", suspendCurrentSale);
  }

  // Lista de Suspendidas
  const listSuspBtn = document.getElementById("pos-suspended-list-btn");
  if (listSuspBtn) {
    listSuspBtn.addEventListener("click", openSuspendedSalesModal);
  }

  // Modales
  document.getElementById("close-ticket-btn").onclick = () => App.closeModal("ticket-modal");
  document.getElementById("done-ticket-btn").onclick = () => {
    App.closeModal("ticket-modal");
    // Limpiar carrito para nueva venta
    cart = [];
    discountPercent = 0;
    if (discountInput) discountInput.value = 0;
    renderCart();
  };
  document.getElementById("print-ticket-btn").onclick = () => {
    window.print();
  };

  document.getElementById("close-suspended-btn").onclick = () => App.closeModal("suspended-modal");
}

// --- INTEGRACIÓN DE ESCÁNER Y MULTIPLICADORES ---

async function handleBarcodeOrSearch(query) {
  let quantity = 1;
  
  // Soporte para multiplicador en buscador. Ej: *5 o 5* seguido de código
  if (query.startsWith("*")) {
    const parts = query.split("*");
    quantity = parseInt(parts[1]) || 1;
    // Esperar a que el usuario digite el código de barras después (flujo de cajero rápido)
    App.showToast("Multiplicador", `Cantidad fijada en ${quantity}. Escanee el producto.`, "info");
    const searchInput = document.getElementById("pos-search-input");
    if (searchInput) {
      searchInput.value = "";
      searchInput.setAttribute("data-qty-multiplier", quantity);
    }
    return;
  }

  // Recuperar multiplicador anterior si existe
  const searchInput = document.getElementById("pos-search-input");
  if (searchInput && searchInput.hasAttribute("data-qty-multiplier")) {
    quantity = parseInt(searchInput.getAttribute("data-qty-multiplier")) || 1;
    searchInput.removeAttribute("data-qty-multiplier");
  }

  // Intentar buscar coincidencia directa y estricta (Código de barras o SKU exacto)
  // Si está offline, buscar en IndexedDB
  let matchedProduct = null;
  
  if (App.isOnline) {
    try {
      const results = await API.get(`/pos/products?q=${encodeURIComponent(query)}`);
      if (results && results.length > 0) {
        // Coincidencia exacta de SKU o código
        matchedProduct = results.find(p => p.codigo_barras === query || p.sku === query);
      }
    } catch (e) {
      console.warn("Fallo búsqueda online en POS. Buscando local...", e);
    }
  }

  // Fallback a IndexedDB
  if (!matchedProduct) {
    try {
      const results = await DBOffline.searchProducts(query);
      matchedProduct = results.find(p => p.codigo_barras === query || p.sku === query);
    } catch (e) {
      console.error("Error buscando en DB local offline:", e);
    }
  }

  if (matchedProduct) {
    addToCart(matchedProduct, quantity);
  } else {
    // Si no coincide directo, filtrar el panel central de catálogo con la búsqueda del usuario
    filterPOSProducts(query);
    App.showToast("Búsqueda", `Mostrando resultados para: ${query}`, "info");
  }
}

// --- PROCESAR COBRO Y GENERACIÓN DE TIQUETES ---

async function processCheckout() {
  if (cart.length === 0) {
    App.showToast("Error de Venta", "El carrito de compras está vacío.", "error");
    return;
  }

  const recInput = document.getElementById("pos-received-input");
  const recibido = parseFloat(recInput ? recInput.value : 0) || 0;
  
  if (selectedPaymentMethod === "efectivo" && recibido < cartTotals.total) {
    App.showToast("Error de Cobro", "El monto recibido es menor al total a pagar.", "error");
    return;
  }

  const clientSelect = document.getElementById("pos-client-select");
  const cliente_id = clientSelect ? parseInt(clientSelect.value) : 1;
  const selOpt = clientSelect ? clientSelect.options[clientSelect.selectedIndex] : null;
  const puntosAcumulados = selOpt ? parseInt(selOpt.getAttribute("data-pts") || 0) : 0;

  if (selectedPaymentMethod === "credito") {
    if (cliente_id === 1) {
      App.showToast("Error de Cobro", "No se permite vender a crédito al Cliente General.", "error");
      return;
    }
  }

  if (selectedPaymentMethod === "puntos") {
    if (cliente_id === 1) {
      App.showToast("Error de Cobro", "No se permite canje de puntos al Cliente General.", "error");
      return;
    }
    const puntosRequeridos = Math.floor(cartTotals.total / 10);
    if (puntosAcumulados < puntosRequeridos) {
      App.showToast("Puntos Insuficientes", `Se requieren ${puntosRequeridos} puntos para esta compra. Disponibles: ${puntosAcumulados}`, "error");
      return;
    }
  }

  // Armar objeto de venta
  const saleData = {
    caja_id: currentCashierArqueo ? currentCashierArqueo.caja_id : 1,
    cliente_id: cliente_id,
    subtotal: cartTotals.subtotal,
    descuento: cartTotals.descuento,
    impuesto: cartTotals.impuesto,
    total: cartTotals.total,
    tipo_documento: "ticket",
    pagos: [
      {
        metodo_pago: selectedPaymentMethod,
        monto: cartTotals.total
      }
    ],
    items: cart.map(item => ({
      producto_id: item.producto_id,
      nombre: item.nombre,
      cantidad: item.cantidad,
      precio_unitario: item.precio_unitario,
      descuento_unitario: item.descuento_unitario,
      unidad_medida: item.unidad_medida
    }))
  };

  // Si no hay red, guardar local en IndexedDB con Consecutivo Offline
  if (!App.isOnline) {
    const timestamp = Date.now();
    saleData.consecutivo = `OFF-${currentCashierArqueo.caja_id}-${timestamp}`;
    
    try {
      await DBOffline.queueSale(saleData);
      App.showToast("Venta Offline", "Venta guardada localmente en IndexedDB. Se sincronizará al recuperar la conexión.", "warning");
      
      // Renderizar Ticket Offline
      renderReceiptTicket(saleData, true);
    } catch (e) {
      App.showToast("Error Crítico", "No se pudo guardar la transacción localmente: " + e.message, "error");
    }
    return;
  }

  // Transacción Online normal
  try {
    const payBtn = document.getElementById("pos-pay-btn");
    payBtn.disabled = true;
    payBtn.textContent = "Procesando Venta...";
    
    const response = await API.post("/pos/sales", saleData);
    
    App.showToast("Venta Exitosa", `Venta registrada con el consecutivo ${response.consecutivo}`, "success");
    
    // Obtener detalles para el Ticket final
    saleData.consecutivo = response.consecutivo;
    renderReceiptTicket(saleData, false);
  } catch (error) {
    App.showToast("Error al cobrar", error.message || "La transacción fue rechazada por el servidor.", "error");
  } finally {
    const payBtn = document.getElementById("pos-pay-btn");
    if (payBtn) {
      payBtn.disabled = false;
      payBtn.textContent = "💰 REGISTRAR VENTA (F12)";
    }
  }
}

function renderReceiptTicket(saleData, isOffline = false) {
  const textEl = document.getElementById("ticket-text");
  if (!textEl) return;

  const clientName = document.getElementById("pos-client-select").options[document.getElementById("pos-client-select").selectedIndex].text;

  const bizName = App.companySettings?.nombre_comercial || "Minisúper M Y M";
  const bizCedula = App.companySettings?.cedula_juridica || "3-101-000000";
  const bizTel = App.companySettings?.telefonos || "0000-0000";
  const bizDir = App.companySettings?.direccion || "Costa Rica";
  
  const centerText = (text, width = 32) => {
    if (text.length >= width) return text.substring(0, width);
    const pad = Math.floor((width - text.length) / 2);
    return " ".repeat(pad) + text + " ".repeat(width - text.length - pad);
  };
  
  let ticket = `================================\n`;
  ticket += `${centerText(bizName.toUpperCase())}\n`;
  ticket += `${centerText("Ced. Juridica: " + bizCedula)}\n`;
  ticket += `${centerText("Tel: " + bizTel)}\n`;
  ticket += `${centerText(bizDir)}\n`;
  ticket += `================================\n`;
  ticket += `Ticket: ${saleData.consecutivo}\n`;
  if (isOffline) {
    ticket += `ESTADO: [PENDIENTE SINCRONIZAR]\n`;
  }
  ticket += `Fecha: ${new Date().toLocaleString("es-CR")}\n`;
  ticket += `Cajero: ${API.getUserInfo()?.nombre || "Cajero"}\n`;
  ticket += `Cliente: ${clientName}\n`;
  ticket += `--------------------------------\n`;
  ticket += `Cant  Producto          Total\n`;
  ticket += `--------------------------------\n`;
  
  saleData.items.forEach(item => {
    const totalLine = item.cantidad * item.precio_unitario;
    const isWeight = item.unidad_medida && (
      item.unidad_medida.toLowerCase() === "kilogramo" || 
      item.unidad_medida.toLowerCase() === "kg" || 
      item.unidad_medida.toLowerCase() === "libra" || 
      item.unidad_medida.toLowerCase() === "lb" ||
      item.unidad_medida.toLowerCase() === "gramo" || 
      item.unidad_medida.toLowerCase() === "g"
    );
    const qtyStr = isWeight ? item.cantidad.toFixed(3) : item.cantidad.toString();
    const nameTrunc = item.nombre.substring(0, 14).padEnd(14, " ");
    ticket += `${qtyStr.padEnd(7, " ")}${nameTrunc} ₡${totalLine.toFixed(2).padStart(8, " ")}\n`;
  });
  
  ticket += `--------------------------------\n`;
  ticket += `Subtotal:      ₡${saleData.subtotal.toFixed(2).padStart(12, " ")}\n`;
  ticket += `Descuento:     ₡${saleData.descuento.toFixed(2).padStart(12, " ")}\n`;
  ticket += `IVA (Incl.):   ₡${saleData.impuesto.toFixed(2).padStart(12, " ")}\n`;
  ticket += `TOTAL A PAGAR: ₡${saleData.total.toFixed(2).padStart(12, " ")}\n`;
  ticket += `================================\n`;
  
  const rec = parseFloat(document.getElementById("pos-received-input")?.value) || saleData.total;
  const vuelto = rec - saleData.total;
  
  ticket += `Recibido:      ₡${rec.toFixed(2).padStart(12, " ")}\n`;
  ticket += `Vuelto:        ₡${vuelto.toFixed(2).padStart(12, " ")}\n`;
  ticket += `================================\n`;
  ticket += `      GRACIAS POR SU COMPRA     \n`;
  ticket += `================================\n`;

  textEl.textContent = ticket;
  
  // Abrir Modal
  App.openModal("ticket-modal");
}

// --- SUSPENDER Y RECUPERAR ---

async function suspendCurrentSale() {
  if (cart.length === 0) {
    App.showToast("Error", "No hay items para suspender.", "error");
    return;
  }

  const clientSelect = document.getElementById("pos-client-select");
  const cliente_id = clientSelect ? parseInt(clientSelect.value) : 1;

  const payload = {
    caja_id: currentCashierArqueo ? currentCashierArqueo.caja_id : 1,
    cliente_id: cliente_id,
    subtotal: cartTotals.subtotal,
    descuento: cartTotals.descuento,
    impuesto: cartTotals.impuesto,
    total: cartTotals.total,
    items: cart.map(item => ({
      producto_id: item.producto_id,
      nombre: item.nombre,
      cantidad: item.cantidad,
      precio_unitario: item.precio_unitario,
      descuento_unitario: item.descuento_unitario
    }))
  };

  try {
    const res = await API.post("/pos/suspend", payload);
    App.showToast("Venta Suspendida", `Venta retenida bajo el código ${res.consecutivo}`, "success");
    
    // Limpiar carrito
    cart = [];
    discountPercent = 0;
    if (document.getElementById("pos-discount-input")) {
      document.getElementById("pos-discount-input").value = 0;
    }
    renderCart();
  } catch (error) {
    App.showToast("Error", "No se pudo suspender la venta: " + error.message, "error");
  }
}

async function openSuspendedSalesModal() {
  App.openModal("suspended-modal");
  const tbody = document.getElementById("suspended-sales-list");
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="5" style="text-align: center;">Cargando...</td></tr>`;

  try {
    const list = await API.get("/pos/suspended");
    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align: center;">No hay ventas suspendidas.</td></tr>`;
      return;
    }

    tbody.innerHTML = "";
    list.forEach(v => {
      tbody.innerHTML += `
        <tr>
          <td><strong>${v.consecutivo}</strong></td>
          <td>${new Date(v.fecha).toLocaleTimeString("es-CR")}</td>
          <td>${v.cliente_nombre}</td>
          <td>₡${v.total.toLocaleString("es-CR", { minimumFractionDigits: 2 })}</td>
          <td>
            <button class="btn btn-primary btn-recuperar" data-id="${v.id}" style="padding: 4px 8px; font-size: 0.8rem;">Recuperar</button>
            <button class="btn btn-danger btn-eliminar-susp" data-id="${v.id}" style="padding: 4px 8px; font-size: 0.8rem; background-color: var(--error);">🗑️</button>
          </td>
        </tr>
      `;
    });

    tbody.querySelectorAll(".btn-recuperar").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = parseInt(btn.getAttribute("data-id"));
        const sale = list.find(v => v.id === id);
        if (sale) {
          // Cargar items en el carrito
          cart = sale.items.map(item => ({
            id: item.producto_id,
            producto_id: item.producto_id,
            nombre: item.nombre,
            sku: item.sku,
            codigo_barras: item.codigo_barras,
            precio_unitario: item.precio_unitario,
            precio_costo: item.precio_unitario * 0.75, // Estimación aproximada para costo
            impuesto_porcentaje: item.impuesto_porcentaje,
            impuesto_id: 1, // fallback
            cantidad: item.cantidad,
            descuento_unitario: item.descuento_unitario
          }));
          
          renderCart();
          
          // Borrar del listado de suspendidas en servidor
          API.delete(`/pos/suspended/${id}`);
          App.closeModal("suspended-modal");
          App.showToast("Venta Recuperada", `Cargada la venta suspendida ${sale.consecutivo}`, "success");
        }
      });
    });

    tbody.querySelectorAll(".btn-eliminar-susp").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = parseInt(btn.getAttribute("data-id"));
        if (confirm("¿Seguro de descartar esta venta suspendida?")) {
          try {
            await API.delete(`/pos/suspended/${id}`);
            App.showToast("Eliminado", "Venta suspendida descartada.", "success");
            openSuspendedSalesModal(); // recargar
          } catch(err) {}
        }
      });
    });

  } catch (error) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--error);">Error al recuperar datos.</td></tr>`;
  }
}

// --- TECLADO Y ATAJOS DE TECLADO ---

function setupPOSKeyboardShortcuts() {
  // Limpiar escuchador anterior si existiera en window
  if (window.posKeydownHandler) {
    window.removeEventListener("keydown", window.posKeydownHandler);
  }

  window.posKeydownHandler = (e) => {
    // Si la pantalla activa no es POS, apagar escuchador
    if (App.activeView !== "pos") return;

    switch (e.key) {
      case "F1":
        e.preventDefault();
        triggerPaymentMethod("efectivo");
        break;
      case "F2":
        e.preventDefault();
        triggerPaymentMethod("tarjeta");
        break;
      case "F3":
        e.preventDefault();
        triggerPaymentMethod("sinpe");
        break;
      case "F4":
        e.preventDefault();
        triggerPaymentMethod("credito");
        break;
      case "F5":
        e.preventDefault();
        triggerPaymentMethod("puntos");
        break;
      case "F8":
        e.preventDefault();
        suspendCurrentSale();
        break;
      case "F9":
        e.preventDefault();
        // Cancelar / Limpiar todo
        document.getElementById("clear-cart-btn")?.click();
        break;
      case "F12":
        e.preventDefault();
        processCheckout();
        break;
    }
  };

  window.addEventListener("keydown", window.posKeydownHandler);
}

function triggerPaymentMethod(method) {
  const btn = document.querySelector(`.payment-method-btn[data-method="${method}"]`);
  if (btn) btn.click();
}
