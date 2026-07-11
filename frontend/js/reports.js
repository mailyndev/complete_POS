import { API } from "./api.js";
import { App } from "./app.js";

export async function renderReports(container, isCompactDashboard = false) {
  if (isCompactDashboard) {
    // Si es el panel de inicio rápido, mostrar solo widgets compactos
    container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 24px;">
        <div id="dashboard-widgets" class="dashboard-grid">
          <div style="grid-column: 1/-1; text-align: center; padding: 20px;">Cargando analíticas rápidas...</div>
        </div>
        
        <div class="dashboard-sections" id="dashboard-details-row">
          <div class="dashboard-panel">
            <div class="panel-header">
              <h3>Ventas vs Utilidades</h3>
            </div>
            <div style="position: relative; height: 260px; width: 100%;">
              <canvas id="sales-analytics-chart"></canvas>
            </div>
          </div>
          
          <div class="dashboard-panel" style="display: flex; flex-direction: column; justify-content: space-between;">
            <div class="panel-header">
              <h3>Existencias Críticas</h3>
            </div>
            <div id="dashboard-alerts-list" style="flex: 1; overflow-y: auto; max-height: 200px;">
              <div style="text-align: center; color: var(--text-muted); padding: 20px;">Buscando alertas...</div>
            </div>
          </div>
        </div>
      </div>
    `;
    await loadDashboardData(true);
    return;
  }

  // Vista de Reportes Detallados Completa
  container.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 24px;">
      
      <!-- Pestañas de Navegación del Módulo -->
      <div class="flex-between" style="border-bottom: 1px solid var(--border-color); padding-bottom: 8px;">
        <div style="display: flex; gap: 16px;">
          <button class="category-tab active" id="tab-rep-summary">Dashboard Ejecutivo</button>
          <button class="category-tab" id="tab-rep-details">Historial de Ventas y Márgenes</button>
        </div>
      </div>

      <!-- CONTENEDOR SEGÚN PESTAÑA -->
      <div id="reports-tab-body">
        <!-- Dashboard Principal (Por defecto) -->
        <div style="display: flex; flex-direction: column; gap: 24px;">
          <div id="dashboard-widgets" class="dashboard-grid">
            <div style="grid-column: 1/-1; text-align: center; padding: 20px;">Cargando...</div>
          </div>

          <div class="dashboard-sections">
            <div class="dashboard-panel">
              <div class="panel-header">
                <h3>Rendimiento Financiero</h3>
              </div>
              <div style="position: relative; height: 300px; width: 100%;">
                <canvas id="sales-analytics-chart"></canvas>
              </div>
            </div>

            <div class="dashboard-panel">
              <div class="panel-header">
                <h3>Alertas de Inventario</h3>
              </div>
              <div id="dashboard-alerts-list" style="overflow-y: auto; max-height: 260px;">
                <div style="text-align: center; color: var(--text-muted); padding: 40px 10px;">Cargando alertas...</div>
              </div>
            </div>
          </div>

          <div class="dashboard-panel">
            <div class="panel-header">
              <h3>Últimas Transacciones</h3>
            </div>
            <div class="table-container" style="margin-top:0;">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Consecutivo</th>
                    <th>Cajero</th>
                    <th>Fecha y Hora</th>
                    <th>Tipo</th>
                    <th>Total Cobrado</th>
                  </tr>
                </thead>
                <tbody id="dashboard-recent-sales-list">
                  <tr><td colspan="5" style="text-align: center;">Buscando...</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

    </div>
  `;

  // Asignar controladores de pestañas
  const tabSummary = document.getElementById("tab-rep-summary");
  const tabDetails = document.getElementById("tab-rep-details");

  tabSummary.onclick = () => {
    tabDetails.classList.remove("active");
    tabSummary.classList.add("active");
    renderReports(container, false); // Vuelve a cargar la vista base
  };

  tabDetails.onclick = () => {
    tabSummary.classList.remove("active");
    tabDetails.classList.add("active");
    renderDetailedSalesTab();
  };

  // Cargar vista por defecto
  loadDashboardData(false);
}

async function loadDashboardData(isCompact) {
  const widgetsGrid = document.getElementById("dashboard-widgets");
  const alertsList = document.getElementById("dashboard-alerts-list");
  const recentSalesList = document.getElementById("dashboard-recent-sales-list");

  if (!widgetsGrid) return;

  try {
    const data = await API.get("/reports/dashboard");
    const user = API.getUserInfo();

    // 1. RENDER WIDGETS
    let widgetsHtml = "";
    const isAdminOrGerente = user.rol === "Administrador General" || user.rol === "Gerente";

    if (isAdminOrGerente) {
      widgetsHtml += `
        <div class="stat-card">
          <div class="stat-header">
            <span class="stat-title">Ventas Hoy</span>
            <div class="stat-icon">💵</div>
          </div>
          <div class="stat-value">₡${data.ventas_hoy.toLocaleString("es-CR", { minimumFractionDigits: 2 })}</div>
          <div class="stat-footer">Ventas del día</div>
        </div>

        <div class="stat-card">
          <div class="stat-header">
            <span class="stat-title">Utilidad Bruta Hoy</span>
            <div class="stat-icon" style="color:var(--success);">📈</div>
          </div>
          <div class="stat-value" style="color:var(--success);">₡${data.utilidad_hoy.toLocaleString("es-CR", { minimumFractionDigits: 2 })}</div>
          <div class="stat-footer">Excluyendo costos base</div>
        </div>

        <div class="stat-card alert-critical">
          <div class="stat-header">
            <span class="stat-title">Productos Críticos</span>
            <div class="stat-icon" style="color:var(--error);">🚨</div>
          </div>
          <div class="stat-value" style="color:var(--error);">${data.productos_agotados} / ${data.productos_stock_bajo}</div>
          <div class="stat-footer">Sin Stock / Stock Bajo</div>
        </div>

        <div class="stat-card alert-warning">
          <div class="stat-header">
            <span class="stat-title">Lotes por Vencer</span>
            <div class="stat-icon" style="color:var(--warning);">📅</div>
          </div>
          <div class="stat-value" style="color:var(--warning);">${data.productos_por_vencer}</div>
          <div class="stat-footer">Vence en menos de 30 días</div>
        </div>
      `;
    } else {
      // Cajeros y otros roles
      const caja = data.caja_turno;
      widgetsHtml += `
        <div class="stat-card">
          <div class="stat-header">
            <span class="stat-title">Caja Asignada</span>
            <div class="stat-icon">🔑</div>
          </div>
          <div class="stat-value" style="font-size: 1.3rem;">${caja.caja_nombre || "Sin Asignar"}</div>
          <div class="stat-footer">Estado: ${caja.caja_abierta ? "Abierta" : "Cerrada"}</div>
        </div>

        <div class="stat-card">
          <div class="stat-header">
            <span class="stat-title">Ventas Turno</span>
            <div class="stat-icon">💵</div>
          </div>
          <div class="stat-value">₡${(caja.ventas_turno || 0).toLocaleString("es-CR", { minimumFractionDigits: 2 })}</div>
          <div class="stat-footer">Cobrado en tu turno</div>
        </div>
      `;
    }

    widgetsGrid.innerHTML = widgetsHtml;

    // 2. ALERTAS DE INVENTARIO
    if (alertsList) {
      alertsList.innerHTML = "";
      if (data.productos_agotados === 0 && data.productos_stock_bajo === 0 && data.productos_por_vencer === 0) {
        alertsList.innerHTML = `<div style="text-align: center; color: var(--success); padding: 40px 10px;">🟢 Inventario en óptimas condiciones.</div>`;
      } else {
        if (data.productos_agotados > 0) {
          alertsList.innerHTML += `
            <div class="alert-row">
              <div class="alert-item-info">
                <span class="alert-item-title">${data.productos_agotados} Productos Agotados</span>
                <span class="alert-item-meta">Existencia actual: 0 unidades</span>
              </div>
              <span class="alert-level level-critical">Crítico</span>
            </div>
          `;
        }
        if (data.productos_stock_bajo > 0) {
          alertsList.innerHTML += `
            <div class="alert-row">
              <div class="alert-item-info">
                <span class="alert-item-title">${data.productos_stock_bajo} Productos con Stock Bajo</span>
                <span class="alert-item-meta">Por debajo del límite de seguridad</span>
              </div>
              <span class="alert-level level-warning">Advertencia</span>
            </div>
          `;
        }
        if (data.productos_por_vencer > 0) {
          alertsList.innerHTML += `
            <div class="alert-row">
              <div class="alert-item-info">
                <span class="alert-item-title">${data.productos_por_vencer} Lotes Próximos a Vencer</span>
                <span class="alert-item-meta">Vence en menos de 30 días</span>
              </div>
              <span class="alert-level level-warning">Advertencia</span>
            </div>
          `;
        }
      }
    }

    // 3. ÚLTIMAS VENTAS
    if (recentSalesList) {
      if (data.ultimas_ventas.length === 0) {
        recentSalesList.innerHTML = `<tr><td colspan="5" style="text-align: center;">No hay transacciones registradas hoy.</td></tr>`;
      } else {
        recentSalesList.innerHTML = data.ultimas_ventas.map(v => `
          <tr>
            <td><strong>${v.consecutivo}</strong></td>
            <td>${v.cajero}</td>
            <td>${new Date(v.fecha).toLocaleString("es-CR")}</td>
            <td><span class="badge badge-info">${v.tipo_documento.toUpperCase()}</span></td>
            <td><strong>₡${v.total.toLocaleString("es-CR", { minimumFractionDigits: 2 })}</strong></td>
          </tr>
        `).join("");
      }
    }

    // 4. CHART
    renderAnalyticsChart(data);

  } catch (error) {
    widgetsGrid.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:20px; color:var(--error);">Error: ${error.message}</div>`;
  }
}

function renderAnalyticsChart(data) {
  const ctx = document.getElementById("sales-analytics-chart");
  if (!ctx) return;

  if (typeof Chart === "undefined") {
    ctx.parentElement.innerHTML = `
      <div style="padding:40px; text-align:center;">
        <strong>Total de Ventas Mensuales:</strong> ₡${data.ventas_mes.toLocaleString("es-CR")}
        <br><br>
        <span style="color:var(--success);"><strong>Utilidad:</strong> ₡${data.utilidad_mes.toLocaleString("es-CR")}</span>
      </div>
    `;
    return;
  }

  if (window.myDashboardChart) {
    window.myDashboardChart.destroy();
  }

  // Dinamically read brand/success colors to stay in sync with themes
  const style = getComputedStyle(document.documentElement);
  const brandColor = style.getPropertyValue('--brand-color').trim() || '#4a6125';
  const successColor = style.getPropertyValue('--success').trim() || '#2e7d32';
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

  window.myDashboardChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: ["Hoy", "Acumulado Mes"],
      datasets: [
        {
          label: "Ventas Brutas (₡)",
          data: [data.ventas_hoy, data.ventas_mes],
          backgroundColor: brandColor + "a6", // 65% opacity
          borderColor: brandColor,
          borderWidth: 1.5,
          borderRadius: 6
        },
        {
          label: "Utilidad Bruta (₡)",
          data: [data.utilidad_hoy, data.utilidad_mes],
          backgroundColor: successColor + "a6", // 65% opacity
          borderColor: successColor,
          borderWidth: 1.5,
          borderRadius: 6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            font: { family: "'Inter', sans-serif", size: 12, weight: 500 },
            color: isDark ? '#F5F6F3' : '#1C1E18',
            boxWidth: 10,
            boxHeight: 10,
            usePointStyle: true,
            pointStyle: 'circle'
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            font: { family: "'Inter', sans-serif", size: 11 },
            color: isDark ? '#A6A99E' : '#4A4D45'
          }
        },
        y: {
          beginAtZero: true,
          grid: {
            color: isDark ? 'rgba(93, 96, 87, 0.08)' : 'rgba(230, 223, 211, 0.4)',
            drawTicks: false
          },
          ticks: {
            callback: (val) => "₡" + val.toLocaleString("es-CR"),
            font: { family: "'Inter', sans-serif", size: 11 },
            color: isDark ? '#A6A99E' : '#4A4D45'
          }
        }
      }
    }
  });
}

// --- PESTAÑA: HISTORIAL DETALLADO DE VENTAS ---

async function renderDetailedSalesTab() {
  const body = document.getElementById("reports-tab-body");
  if (!body) return;

  body.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:20px;">
      
      <!-- Panel de Filtros -->
      <div class="dashboard-panel" style="padding: 16px;">
        <div style="display:grid; grid-template-columns: 1fr 1fr auto; gap:16px; align-items:flex-end;">
          <div class="form-group">
            <label>Fecha Desde</label>
            <input type="date" id="rep-filter-start" class="input-field">
          </div>
          <div class="form-group">
            <label>Fecha Hasta</label>
            <input type="date" id="rep-filter-end" class="input-field">
          </div>
          <button id="rep-btn-apply-filter" class="btn btn-primary" style="height:45px; padding:0 32px;">Filtrar Historial</button>
        </div>
      </div>

      <!-- Resumen Consolidado del Período -->
      <div class="grid-cols-3" id="period-summary-row" style="display:none;">
        <div style="background-color: var(--bg-secondary); border: 1px solid var(--border-color); padding: 20px; border-radius: var(--radius-md); text-align: center;">
          <div style="font-size: 0.8rem; color: var(--text-secondary); text-transform: uppercase;">Total Facturado</div>
          <div style="font-size: 1.5rem; font-weight: 700; margin-top: 8px;" id="period-sales-total">₡0.00</div>
        </div>
        <div style="background-color: var(--bg-secondary); border: 1px solid var(--border-color); padding: 20px; border-radius: var(--radius-md); text-align: center;">
          <div style="font-size: 0.8rem; color: var(--text-secondary); text-transform: uppercase; color:var(--success);">Utilidad del Período</div>
          <div style="font-size: 1.5rem; font-weight: 700; margin-top: 8px; color:var(--success);" id="period-profit-total">₡0.00</div>
        </div>
        <div style="background-color: var(--bg-secondary); border: 1px solid var(--border-color); padding: 20px; border-radius: var(--radius-md); text-align: center;">
          <div style="font-size: 0.8rem; color: var(--text-secondary); text-transform: uppercase;">Margen Promedio</div>
          <div style="font-size: 1.5rem; font-weight: 700; margin-top: 8px;" id="period-margin-average">0.0%</div>
        </div>
      </div>

      <!-- Tabla de Ventas Filtradas -->
      <div class="dashboard-panel">
        <div class="table-container" style="margin-top:0;">
          <table class="data-table">
            <thead>
              <tr>
                <th>Consecutivo</th>
                <th>Fecha</th>
                <th>Subtotal</th>
                <th>IVA (Impuestos)</th>
                <th>Descuento</th>
                <th>Total Neto</th>
                <th>Utilidad Estimada</th>
              </tr>
            </thead>
            <tbody id="detailed-sales-list-body">
              <tr><td colspan="7" style="text-align: center; color:var(--text-muted);">Configure las fechas y aplique el filtro para ver transacciones.</td></tr>
            </tbody>
          </table>
        </div>
      </div>

    </div>
  `;

  // Autocompletar fechas
  const today = new Date().toISOString().split("T")[0];
  document.getElementById("rep-filter-start").value = today;
  document.getElementById("rep-filter-end").value = today;

  document.getElementById("rep-btn-apply-filter").onclick = loadDetailedSalesHistory;
  
  // Ejecutar filtro inicial
  loadDetailedSalesHistory();
}

async function loadDetailedSalesHistory() {
  const start = document.getElementById("rep-filter-start").value;
  const end = document.getElementById("rep-filter-end").value;
  const tbody = document.getElementById("detailed-sales-list-body");
  const summaryRow = document.getElementById("period-summary-row");

  if (!start || !end) {
    App.showToast("Filtros", "Ambas fechas son obligatorias.", "warning");
    return;
  }

  tbody.innerHTML = `<tr><td colspan="7" style="text-align: center;">Procesando reportes financieros...</td></tr>`;
  if (summaryRow) summaryRow.style.display = "none";

  try {
    // Para la demo de la Fase 2, utilizaremos el listado de ventas del mes en backend
    // y aplicaremos el filtro de fechas en frontend.
    const user = API.getUserInfo();
    const allSales = await API.get("/reports/dashboard");
    
    // NOTA: Como la API de Dashboard retorna solo las métricas consolidadas,
    // vamos a consultar directamente la base de datos simulando el cálculo con las ventas de hoy/mes.
    // Para hacerlo completamente funcional con filtros reales, usaremos la api de reportes o ventas directamente.
    // Vamos a consultar en el backend todas las ventas del mes (obteniendo de /cash/history o inventariados si fuera necesario),
    // pero para Phase 2 podemos hacer una petición al endpoint general de ventas.
    // Espera, no creamos un endpoint para listar todas las ventas directamente en /pos, sino en arqueos y reports.
    // Vamos a añadir un endpoint de reporte de ventas en backend/routers/reports.py:
    // GET /api/reports/sales?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD
    // Esto es sumamente limpio y profesional! Let's build that backend endpoint first or mock it in client side.
    // De hecho, para hacer que el sistema sea real y profesional, agreguemos el endpoint en backend/routers/reports.py!
    // Pero espera, primero comprobemos si podemos llamar a un endpoint y si falla hacer un mock.
    // Crearemos el endpoint en reports.py para que el filtro funcione con precisión matemática desde la base de datos!
    
    const url = `/reports/sales?start=${start}&end=${end}`;
    const salesList = await API.get(url);

    if (salesList.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color:var(--text-muted);">No hay ventas registradas en el rango seleccionado.</td></tr>`;
      return;
    }

    tbody.innerHTML = "";
    let totalNeto = 0;
    let totalUtilidad = 0;

    salesList.forEach(s => {
      totalNeto += s.total;
      totalUtilidad += s.utilidad;
      
      tbody.innerHTML += `
        <tr>
          <td><strong>${s.consecutivo}</strong></td>
          <td>${new Date(s.fecha).toLocaleString("es-CR")}</td>
          <td>₡${s.subtotal.toFixed(2)}</td>
          <td>₡${s.impuesto.toFixed(2)}</td>
          <td>₡${s.descuento.toFixed(2)}</td>
          <td><strong>₡${s.total.toFixed(2)}</strong></td>
          <td style="color:var(--success); font-weight:600;">₡${s.utilidad.toFixed(2)}</td>
        </tr>
      `;
    });

    // Calcular promedios
    const avgMargin = totalNeto > 0 ? (totalUtilidad / totalNeto * 100) : 0;

    // Inyectar en cabecera de resumen
    if (summaryRow) {
      summaryRow.style.display = "grid";
      document.getElementById("period-sales-total").textContent = `₡${totalNeto.toLocaleString("es-CR", { minimumFractionDigits: 2 })}`;
      document.getElementById("period-profit-total").textContent = `₡${totalUtilidad.toLocaleString("es-CR", { minimumFractionDigits: 2 })}`;
      document.getElementById("period-margin-average").textContent = `${avgMargin.toFixed(1)}%`;
    }

  } catch (error) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--error);">Error al cargar reportes: ${error.message}</td></tr>`;
  }
}
