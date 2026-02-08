/* app.js - Dashboard Inventario & Ventas (completo) v2.3.0 2025-15-11 
*/

//Fecha actual en el footer
document.getElementById('yearFooter').textContent = new Date().getFullYear();


const LS_PRODUCTS = 'inventory_products';
const LS_SALES = 'inventory_sales';

const LS_MOVEMENTS = 'inventory_movements';

const loadMovements = () => JSON.parse(localStorage.getItem(LS_MOVEMENTS) || '[]');
const saveMovements = arr => localStorage.setItem(LS_MOVEMENTS, JSON.stringify(arr));

/* ---------- Util ---------- */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from((root || document).querySelectorAll(sel));

const formatCurrency = n => '$ ' + (Number(n) || 0).toLocaleString('es-CO', { minimumFractionDigits: 0 });
const nowISO = () => new Date().toISOString();
const dateReadable = iso => iso ? new Date(iso).toLocaleString() : '';
const cryptoId = () => 'id_' + Math.random().toString(36).slice(2, 9);
const esc = s => String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"':'&quot;', "'":'&#39;' })[c]);

/* ---------- Seed (sample data si vacío) ---------- */
function seedIfEmpty() {
  if (!localStorage.getItem(LS_PRODUCTS)) {
    localStorage.setItem(LS_PRODUCTS, "[]");
  }
  if (!localStorage.getItem(LS_SALES)) {
    localStorage.setItem(LS_SALES, "[]");
  }
}


/* ---------- Storage helpers ---------- */
const loadProducts = () => JSON.parse(localStorage.getItem(LS_PRODUCTS) || '[]');
const saveProducts = (arr) => localStorage.setItem(LS_PRODUCTS, JSON.stringify(arr));
const loadSales = () => JSON.parse(localStorage.getItem(LS_SALES) || '[]');
const saveSales = (arr) => localStorage.setItem(LS_SALES, JSON.stringify(arr));





/* ---------- Ensure modals & analysis-table exist ---------- */
function ensureUiExtras() {
  // Product modal (create if missing)
  if (!$('#modalOverlay')) {
   const html = `
  <div id="modalOverlay" class="modal-overlay hidden" style="display:none;">
    <div class="modal card" id="productModal" style="max-width:420px;">
      <button id="closeModal" class="modal-close">✕</button>
      <h2 id="modalTitle">Nuevo Producto</h2>

      <form id="productForm" class="form-grid">
        <input id="p_id" type="hidden">

        <!-- VISIBLE -->
        <label>Nombre*<input id="p_name" required /></label>

        <!-- OCULTOS PERO PRESENTES -->
        <label style="display:none;">Marca*
          <input id="p_brand" type="text" />
        </label>

        <label style="display:none;">Categoría
          <input id="p_category" type="text" />
        </label>

        <label style="display:none;">Subcategoría
          <input id="p_subcategory" type="text" />
        </label>

        <label style="display:none;">Costo por Unidad*
          <input id="p_cost" type="number" min="0" step="0.01" />
        </label>

        <label style="display:none;">% Margen*
          <input id="p_margin" type="number" min="0" step="0.01" value="100" />
        </label>

        <!-- VISIBLE -->
        <label>Cantidad*
          <input id="p_qty" type="number" min="0" step="1" value="1" />
        </label>

        <div class="modal-actions" style="display:flex;justify-content:flex-end;gap:8px;margin-top:8px;">
          <button type="button" id="cancelModal" class="btn ghost">Cancelar</button>
          <button type="submit" class="btn primary">Guardar</button>
        </div>
      </form>

    </div>
  </div>`;

    document.body.insertAdjacentHTML('beforeend', html);
    $('#modalOverlay').style.display = ''; // take out display:none placeholder

    // <<-- FIX: attach submit listener right after creating the modal so the listener is not lost
    const productForm = $('#productForm');
    if (productForm && !productForm.__productSubmitAttached) {
      productForm.addEventListener('submit', e => {
        e.preventDefault();

        // grab current products
        const products = loadProducts();
        const id = editingId || cryptoId();

        const product = {
          id,
          name: $('#p_name').value.trim(),
          brand: $('#p_brand').value.trim(),
          category: $('#p_category').value.trim(),
          subcategory: $('#p_subcategory').value.trim(),
          cost: parseFloat($('#p_cost').value.replace(/[^\d]/g, '')) || 0,
          marginPercent: parseFloat($('#p_margin').value) || 0,
          qty: parseInt($('#p_qty').value) || 0,
          sold: editingId ? products.find(p => p.id === editingId)?.sold || 0 : 0,
          createdAt: nowISO()
        };

        if (editingId) {
          const idx = products.findIndex(p => p.id === editingId);
          if (idx !== -1) products[idx] = product;
        } else {
          products.push(product);
        }

        saveProducts(products);


        const movements = loadMovements();

movements.unshift({
  id: cryptoId(),
  productId: product.id,
  name: product.name,
  type: editingId ? 'MODIFICACION' : 'INGRESO',
  qty: product.qty,
  timestamp: nowISO()
});

saveMovements(movements);


        hide('#modalOverlay');
        renderAll();
      });
      // mark so we don't attach twice
      productForm.__productSubmitAttached = true;
    }

    // Formatear automáticamente el campo de costo en pesos colombianos
   const costInput = $('#p_cost');
   if (costInput && !costInput.__formatListener) {
   costInput.addEventListener('input', () => {
   const val = costInput.value.replace(/[^\d]/g, '');
   if (!val) return;
   const num = Number(val);
   if (num >= 1000) {
      costInput.value = num.toLocaleString('es-CO');
    } else {
      costInput.value = val;
    }
  });
  costInput.addEventListener('blur', () => {
    const val = costInput.value.replace(/[^\d]/g, '');
    if (val) costInput.value = Number(val).toLocaleString('es-CO');
  });
  costInput.__formatListener = true;
}

    // end FIX
  }

  // Sell modal
  if (!$('#sellOverlay')) {
    const sellHtml = `
      <div id="sellOverlay" class="modal-overlay hidden" style="display:none;">
        <div class="modal card" id="sellModal" style="max-width:420px;">
          <button id="closeSellModal" class="modal-close">✕</button>
          <h2>Llevar a producción</h2>
          <form id="sellForm" class="form-grid">
            <div id="sellProductInfo" style="font-weight:600;margin-bottom:6px;"></div>
            <label>Cantidad*<input id="sell_qty" type="number" min="1" value="1" required /></label>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              <div style="flex:1;" hidden>
  <label>Método de Pago 1
    <select id="paymentMethod1">
      <option value="Efectivo">Efectivo</option>
      <option value="Transferencia">Transferencia</option>
      <option value="Datafono">Datafono</option>
      <option value="Sistecredito">Sistecredito</option>
      <option value="Addi">Addi</option>
    </select>
  </label>
  <label>Monto 1
    <input id="amount1" type="number" min="0" value="0" />
  </label>
</div>

<div style="flex:1;" hidden>
  <label>Método de Pago 2
    <select id="paymentMethod2">
      <option value="">Ninguno</option>
      <option value="Efectivo">Efectivo</option>
      <option value="Transferencia">Transferencia</option>
      <option value="Datafono">Datafono</option>
      <option value="Sistecredito">Sistecredito</option>
      <option value="Addi">Addi</option>
    </select>
  </label>
  <label>Monto 2
    <input id="amount2" type="number" min="0" value="0" />
  </label>
</div>

<div class="totalDisplay" style="margin-top:6px;" hidden>Total Venta: $0</div>

            <div class="modal-actions" style="display:flex;justify-content:flex-end;gap:8px;margin-top:8px;">
              <button type="button" id="cancelSell" class="btn ghost">Cancelar</button>
              <button type="submit" class="btn primary">Confirmar Retiro</button>
            </div>
          </form>
        </div>
      </div>`;
    document.body.insertAdjacentHTML('beforeend', sellHtml);
    $('#sellOverlay').style.display = '';

    // Añadir listeners del formulario de venta una vez creado
const sellForm = $('#sellForm');
if (sellForm && !sellForm.__listenersAttached) {
  sellForm.addEventListener('input', updateSellTotals);

  sellForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!sellingProductId) return alert('Producto no seleccionado');
    const qty = Math.max(0, Number($('#sell_qty').value) || 0);
    if (qty <= 0) return alert('Cantidad inválida');
    const products = loadProducts();
    const idx = products.findIndex(p => p.id === sellingProductId);
    if (idx === -1) return alert('Producto no encontrado');
    const prod = products[idx];
    if (qty > prod.qty) return alert('Stock insuficiente');

    const unit = computeUnitPrice(prod);
    const total = unit * qty;
    const profit = (unit - (prod.cost || 0)) * qty;

    let amount1 = Number($('#amount1').value) || 0;
    let amount2 = Number($('#amount2').value) || 0;
    if (amount1 > total) amount1 = total;
    if (amount1 + amount2 > total) amount2 = total - amount1;

    // Actualizar inventario
    prod.qty = Math.max(0, prod.qty - qty);
    prod.sold = (prod.sold || 0) + qty;
    products[idx] = prod;
    saveProducts(products);

    // Registrar venta
    const sales = loadSales();
    sales.unshift({
      id: cryptoId(),
      productId: prod.id,
      name: prod.name,
      brand: prod.brand || '',
      qty,
      total,
      profit,
      method1: $('#paymentMethod1').value || 'Efectivo',
      amount1,
      method2: $('#paymentMethod2').value || '',
      amount2,
      timestamp: nowISO()
    });
    saveSales(sales);

    const movements = loadMovements();

movements.unshift({
  id: cryptoId(),
  productId: prod.id,
  name: prod.name,
  type: 'SALIDA',
  qty: qty,
  timestamp: nowISO()
});

saveMovements(movements);

    hide('#sellOverlay');
    renderAll();
  });

  sellForm.__listenersAttached = true;
}

  }

 // Ensure brandAnalysisTable exists inside analysis; if not, create a card with it
if (!$('#brandAnalysisTable')) {
  const analysis = $('#analysis');
  if (analysis) {
    const node = document.createElement('div');
    node.className = 'card table-card';
    node.style.marginTop = '0px';
    const chartCard = $('#analysis .card.chart-row');
    if (chartCard) analysis.insertBefore(node, chartCard);
    else analysis.appendChild(node);
  }
}

}

/* ---------- Modal helpers ---------- */
function show(selector) { const el = document.querySelector(selector); if (el) el.classList.remove('hidden'); }
function hide(selector) { const el = document.querySelector(selector); if (el) el.classList.add('hidden'); }

/* ---------- Inventory rendering ---------- */
function renderInventoryTable(filter = '', stockFilter = 'all') {
  const tbody = $('#inventoryTable tbody');
  if (!tbody) return;

  // ====== INSERTAR FILTRO SI NO EXISTE ======
  let filterContainer = document.getElementById('stock-filter-container');
  if (!filterContainer) {
    filterContainer = document.createElement('div');
    filterContainer.id = 'stock-filter-container';
    filterContainer.style = `
      margin-bottom: 12px;
      display:flex;
      gap:10px;
      align-items:center;
      background: #24c4a3;         /* Rosado suave */
      padding: 8px 12px;
      border-radius: 8px;
    `;

    filterContainer.innerHTML = `
      <label style="font-weight:600; color:#000;">Filtrar:</label>
      <select id="stockFilter" 
        style="
          padding:6px 10px; 
          border-radius:6px;
          background:#ffb9d8;   /* Rosado */
          border:1px solid #e898b9;
          color:#000;           /* Letra negra */
          font-weight:600;
        ">
        <option value="all">Todos</option>
        <option value="agotados">Agotados</option>
      </select>
    `;

    const table = document.getElementById('inventoryTable');
    table.parentNode.insertBefore(filterContainer, table);

    // Evento del filtro
    document.getElementById('stockFilter').addEventListener('change', e => {
      renderInventoryTable(filter, e.target.value);
    });
  }

  // ==================================================
  // LIMPIAR TABLA
  // ==================================================
  tbody.innerHTML = '';

  const q = (filter || '').trim().toLowerCase();
  const products = loadProducts();

  products
    .filter(p => {
      // FILTRO DE TEXTO (YA EXISTENTE)
      const matchesText =
        !q ||
        (p.name || '').toLowerCase().includes(q) ||
        (p.brand || '').toLowerCase().includes(q) ||
        (p.category || '').toLowerCase().includes(q);

      if (!matchesText) return false;

      // FILTRO NUEVO: AGOTADOS / TODOS
      if (stockFilter === 'agotados') {
        return (p.qty || 0) <= 0;
      }

      return true; // "all"
    })
    .forEach(p => {
      const isZero = (p.qty || 0) <= 0;

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><input class="row-select" data-id="${p.id}" type="checkbox"></td>

        <td>${esc(p.name)}</td>

        <td ${isZero ? 'style="color:#ff5555;font-weight:bold;"' : ''}>
          ${isZero ? 'AGOTADO' : p.qty}
        </td>

        <!-- Editable sold column -->
        <td>
          <input 
            type="number" 
            class="sold-edit" 
            data-id="${p.id}" 
            value="${p.sold || 0}" 
            min="0"
            style="width:70px; padding:4px; border-radius:6px; text-align:center;"
          >
        </td>

        <td>
          <button class="btn ghost sell-btn" data-id="${p.id}" ${isZero ? 'disabled' : ''}>Salida</button>
          <button class="btn ghost add-stock-btn" data-id="${p.id}">Añadir</button>
          <button class="btn ghost edit-btn" data-id="${p.id}">Editar</button>
          <button class="btn ghost delete-btn" data-id="${p.id}">Eliminar</button>
        </td>
      `;

      tbody.appendChild(tr);
    });

  updateSelectedCount();

  // ===============================
  // GUARDAR CAMBIOS MANUALES DE SOLD
  // ===============================
  $$('.sold-edit').forEach(input => {
    input.addEventListener("change", e => {
      const id = e.target.dataset.id;
      let newValue = parseInt(e.target.value);

      if (isNaN(newValue) || newValue < 0) {
        alert("Valor inválido");
        renderInventoryTable();
        return;
      }

      const products = loadProducts();
      const p = products.find(x => x.id === id);
      if (!p) return;

      p.sold = newValue; // ← Guardamos manualmente, incluyendo 0

      saveProducts(products);
    });
  });
}





// ================================MODAL PARA AGREGAR UNIDADES AL STOCK EXISTENTE============

let addStockProductId = null;

// ABRIR MODAL
document.addEventListener('click', e => {
  if (e.target.classList.contains('add-stock-btn')) {
    addStockProductId = e.target.dataset.id;

    $('#addStockOverlay').style.display = 'flex';
    $('#addStockOverlay').classList.remove('hidden');

    $('#addStockInput').value = '';
    $('#addStockInput').focus();
  }
});

// CERRAR MODAL
$('#closeAddStockModal').onclick = () => {
  $('#addStockOverlay').classList.add('hidden');
  setTimeout(() => $('#addStockOverlay').style.display = 'none', 200);
};

// CONFIRMAR AÑADIR STOCK
$('#confirmAddStockBtn').onclick = () => {
  const qtyToAdd = parseInt($('#addStockInput').value);

  if (!qtyToAdd || qtyToAdd <= 0) {
    alert("Ingrese una cantidad válida.");
    return;
  }

  let products = loadProducts();
  let p = products.find(x => x.id === addStockProductId);
  if (!p) return;

  p.qty = (p.qty || 0) + qtyToAdd;
  saveProducts(products);

  const movements = loadMovements();

movements.unshift({
  id: cryptoId(),
  productId: p.id,
  name: p.name,
  type: 'ENTRADA',
  qty: qtyToAdd,
  timestamp: nowISO()
});

saveMovements(movements);
renderInventoryTable();

  $('#addStockOverlay').classList.add('hidden');
  setTimeout(() => $('#addStockOverlay').style.display = 'none', 200);
};

//==========================FIN DEL MODAL DE AGREGAR STOCK O DEL BOTON AÑADIR================



// Formatear fecha en estilo "Dom, ene 1, 2023 | 3:45 PM PARA LA TABLA EN PRODUCCION "
function formatPrettyDate(isoString) {
  const d = new Date(isoString);

  const dias = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

  const diaSemana = dias[d.getDay()];
  const mes = meses[d.getMonth()];
  const dia = d.getDate();
  const year = d.getFullYear();

  let hours = d.getHours();
  const minutes = d.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? "PM" : "AM";

  hours = hours % 12;
  if (hours === 0) hours = 12; // 12 AM/PM

  return `${diaSemana}, ${mes} ${dia}, ${year} | ${hours}:${minutes} ${ampm}`;
}


/* ---------- Sales rendering ---------- */
function renderSalesTable(filter = '') {
  const tbody = $('#salesTable tbody');
  if (!tbody) return;

  tbody.innerHTML = '';
  const q = (filter || '').trim().toLowerCase();

  const movements = loadMovements();

  movements
    .filter(m => {
      if (!q) return true;
      return (m.name || '').toLowerCase().includes(q) ||
             (m.type || '').toLowerCase().includes(q);
    })
    .forEach(m => {

      let bg = '#ffffff';
      let color = '#000';

      if (m.type === 'SALIDA') {
        bg = '#e53935';
        color = '#ffffff';
      }
      else if (m.type === 'ENTRADA') {
        bg = '#2e7d32';
        color = '#ffffff';
      }
      else if (m.type === 'MODIFICACION') {
        bg = '#fbc02d';
        color = '#000000';
      }

      const descripcion =
        m.type === 'SALIDA' ? 'Salida de Stock' :
        m.type === 'ENTRADA' ? 'Ingreso de stock' :
        m.type === 'MODIFICACION' ? 'Edición manual' :
        'Movimiento';

      const tr = document.createElement('tr');

      tr.innerHTML = `
        <td>${esc(m.name)}</td>
        <td>
          <span style="
            background:${bg};
            color:${color};
            padding:4px 10px;
            border-radius:10px;
            font-weight:600;
            display:inline-block;
          ">
            ${m.type}
          </span>
        </td>
        <td>${descripcion}</td>
        <td>
          <span style="
            background:${bg};
            color:${color};
            width:28px;
            height:28px;
            display:inline-flex;
            align-items:center;
            justify-content:center;
            border-radius:50%;
            font-weight:700;
            font-size:13px;
          ">
            ${m.qty}
          </span>
        </td>
        <td>${formatPrettyDate(m.timestamp)}</td>
      `;

      tbody.appendChild(tr);
    });
}



 




/* ---------- Sold table: only products fully sold (qty === 0 && sold > 0) ---------- */
function renderSoldTable() {
  const tbody = $('#soldTable tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  const products = loadProducts();
  products
    .filter(p => (p.qty === 0) && (p.sold || 0) > 0)
    .forEach(p => {
      const price = Math.round((p.cost || 0) * (1 + (p.marginPercent || 0)/100));
      const totalCost = (p.cost || 0) * (p.sold || 0);
      const totalSales = price * (p.sold || 0);
      const profit = (price - (p.cost || 0)) * (p.sold || 0);
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${esc(p.name)}</td>
        <td>${p.sold||0}</td>
      `;
      tbody.appendChild(tr);
    });

      // Escuchar clicks en los botones eliminar
  $$('#soldTable .btn-delete-sold').forEach(btn => {
    btn.addEventListener('click', e => {
      const index = e.target.dataset.index;
      deleteSoldProduct(index);
    });
  });
}




// ---------- Eliminar todos los productos vendidos ----------
$('#deleteAllSoldBtn')?.addEventListener('click', () => {
  if (!confirm('¿Eliminar todos los productos vendidos (agotados)?')) return;
  const products = loadProducts();
  const remaining = products.filter(p => !(p.qty === 0 && (p.sold || 0) > 0));
  saveProducts(remaining);
  renderAll();
});


/* ---------- Brand analysis table ---------- */
// ---------- Render Análisis por Marca (con filtro por marca o producto) ----------
function renderBrandAnalysis(filter = '') {
  // const tbody = $('#brandAnalysisTable tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  const products = loadProducts();
  const sales = loadSales();

  const brands = {};
  const search = filter.trim().toLowerCase();

  // Crear estructura base
  products.forEach(p => {
    const brand = p.brand || 'Sin marca';
    const prodName = p.name || 'Desconocido';
    if (!brands[brand]) brands[brand] = {
      brand,
      productCount: 0,
      sold: 0,
      costTotal: 0,
      salesTotal: 0,
      profit: 0,
      products: []
    };
    brands[brand].productCount++;
    brands[brand].products.push(p);
  });

  // Agregar datos de ventas
  sales.forEach(s => {
    const brand = s.brand || 'Sin marca';
    if (!brands[brand]) brands[brand] = {
      brand,
      productCount: 0,
      sold: 0,
      costTotal: 0,
      salesTotal: 0,
      profit: 0,
      products: []
    };
    brands[brand].sold += s.qty || 0;
    brands[brand].salesTotal += s.total || 0;
    brands[brand].profit += s.profit || 0;

    const prod = products.find(p => p.id === s.productId);
    if (prod) brands[brand].costTotal += (prod.cost || 0) * (s.qty || 0);
  });

  // Aplicar filtro
  const filtered = Object.values(brands).filter(b => {
    if (!search) return true;
    const matchBrand = b.brand.toLowerCase().includes(search);
    const matchProduct = b.products.some(p => p.name.toLowerCase().includes(search));
    return matchBrand || matchProduct;
  });

  // Renderizar tabla principal
  // filtered.forEach(b => {
  //   const tr = document.createElement('tr');
  //   tr.innerHTML = `
  //     <td class="clickable-brand" style="color:#7f5af0;cursor:pointer;">${esc(b.brand)}</td>
  //     <td>${b.productCount}</td>
  //     <td>${b.sold}</td>
  //     <td>${formatCurrency(b.costTotal)}</td>
  //     <td>${formatCurrency(b.salesTotal)}</td>
  //     <td style="color:#45d37a;">${formatCurrency(b.profit)}</td>
  //   `;
  //   tr.querySelector('.clickable-brand').addEventListener('click', () => showBrandDetail(b.brand));
  //   tbody.appendChild(tr);
  // });

  // if (!filtered.length) {
  //   const tr = document.createElement('tr');
  //   tr.innerHTML = `<td colspan="6" style="text-align:center;opacity:.6;">Sin resultados</td>`;
  //   tbody.appendChild(tr);
  // }
}

function showBrandDetail(brandName) {
  const modal = $('#brandDetailModal');
  const title = $('#brandDetailTitle');
  const tbody = $('#brandDetailBody');
  const products = loadProducts().filter(p => (p.brand || 'Sin marca') === brandName);

  title.textContent = `Productos de ${brandName}`;
  tbody.innerHTML = '';

  products.forEach(p => {
    const qty = Number(p.qty || 0);
    const cost = Number(p.cost || 0);
    const total = qty * cost;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${esc(p.name)}</td>
      <td>${qty}</td>
      <td>${formatCurrency(cost)}</td>
      <td>${formatCurrency(total)}</td>
    `;
    tbody.appendChild(tr);
  });

  if (!products.length) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="4" style="text-align:center;opacity:.6;">Sin productos</td>`;
    tbody.appendChild(tr);
  }

  modal.classList.remove('hidden');
}

// Cerrar modal
$('#closeBrandDetail').addEventListener('click', () => {
  $('#brandDetailModal').classList.add('hidden');
});
$('#brandDetailModal').addEventListener('click', e => {
  if (e.target.id === 'brandDetailModal') $('#brandDetailModal').classList.add('hidden');
});



// ---------- Buscador para tabla de Análisis por Marca ----------
document.addEventListener('input', e => {
  if (e.target.id === 'searchBrandAnalysis') {
    const filter = e.target.value.trim().toLowerCase();
    renderBrandAnalysis(filter);
  }
});


/* ---------- Stats & Charts ---------- */
let salesByMonthChart = null, topProductsChart = null;

function renderStatsAndCharts() {
  console.log("📊 Iniciando renderStatsAndCharts() (solo top productos)...");

  const sales = loadSales();
  const products = loadProducts();

  // === Productos top (los más retirados / vendidos) ===
  const productMap = {};

  sales.forEach(s => {
    const id = s.productId || s.name;
    if (!productMap[id]) {
      productMap[id] = {
        name: s.name || 'Desconocido',
        sold: 0
      };
    }
    productMap[id].sold += s.qty || 0;
  });

  // Incluir productos que tengan sold pero nunca hayan aparecido en sales
  products.forEach(p => {
    if (!productMap[p.id]) {
      productMap[p.id] = {
        name: p.name,
        sold: p.sold || 0
      };
    }
  });

  // Ordenar y tomar top 6
  const top = Object.values(productMap)
    .sort((a, b) => b.sold - a.sold)
    .slice(0, 6);

  // === Render del chart ===
  const ctx2 = $('#topProductsChart')?.getContext && $('#topProductsChart').getContext('2d');
  if (ctx2) {
    if (window.topProductsChart instanceof Chart) window.topProductsChart.destroy();

    window.topProductsChart = new Chart(ctx2, {
      type: 'bar',
      data: {
        labels: top.map(t => t.name),
        datasets: [{
          label: 'Unidades retiradas',
          data: top.map(t => t.sold),
          backgroundColor: 'rgba(59,130,246,0.85)'
        }]
      },
      options: {
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true } }
      }
    });
  }

  console.log("✅ renderStatsAndCharts() completado (solo top productos).");
}



// === Toggle KPI visibility ===
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.toggle-visibility');
  if (!btn) return;

  const wrapper = btn.closest('.kpi-wrapper');
  const valueEl = wrapper.querySelector('.kpi-value');
  const realValueEl = wrapper.querySelector('.kpi-real-value');
  const icon = btn.querySelector('i');
  const isVisible = valueEl.dataset.visible === 'true';

  if (isVisible) {
    valueEl.textContent = '***';
    valueEl.dataset.visible = 'false';
    icon.classList.replace('fa-eye-slash', 'fa-eye');
  } else {
    valueEl.textContent = realValueEl.textContent;
    valueEl.dataset.visible = 'true';
    icon.classList.replace('fa-eye', 'fa-eye-slash');
  }
});





/* ---------- Reiniciar ventas diarias a medianoche (hora Bogotá o UTC) ---------- */
function scheduleDailyReset() {
  console.log("⏰ Iniciando verificación de reinicio diario...");

  const lastReset = localStorage.getItem('lastDailyReset');
  const now = new Date();

  // Convertir hora local de Bogotá (UTC-5) a UTC
  const nowUTC = new Date(now.getTime() + now.getTimezoneOffset() * 60000);

  // Fecha actual en formato YYYY-MM-DD (según UTC o Bogotá)
  const todayKey = nowUTC.toISOString().slice(0, 10);

  // Si nunca se ha reiniciado, guardamos la fecha actual
  if (!lastReset) {
    localStorage.setItem('lastDailyReset', todayKey);
    console.log("📅 Primera inicialización de lastDailyReset:", todayKey);
    return;
  }

  // Si ya cambió el día → reiniciar contador diario
  if (lastReset !== todayKey) {
    console.log(`🔄 Día cambió (${lastReset} → ${todayKey}). Reiniciando ventas diarias...`);

    // Reiniciar el valor visible
    const stToday = document.querySelector('#statTodaySales');
    if (stToday) stToday.textContent = '$ 0';

    // Guardar la nueva fecha de reinicio
    localStorage.setItem('lastDailyReset', todayKey);

    // Recalcular y volver a renderizar todo
    renderStatsAndCharts();
  } else {
    console.log("✅ Día no ha cambiado. Sin reinicio necesario.");
  }
}

// Llamar la función cada cierto tiempo para asegurarse de detectar el cambio
setInterval(scheduleDailyReset, 60 * 1000); // cada minuto
scheduleDailyReset(); // ejecutar inmediatamente al cargar


/* ---------- Create / Wire modals behavior ---------- */
function wireModals() {
  // product modal buttons
  $('#closeModal')?.addEventListener('click', () => hide('#modalOverlay'));
  $('#cancelModal')?.addEventListener('click', () => hide('#modalOverlay'));

  // sell modal buttons
  $('#closeSellModal')?.addEventListener('click', () => hide('#sellOverlay'));
  $('#cancelSell')?.addEventListener('click', () => hide('#sellOverlay'));

  // product editing/creation handled in product form listener further down (attached inside ensureUiExtras)
}

// ---------- Evento botón "Agregar Producto" ----------
$('#addProductBtn')?.addEventListener('click', () => {
  editingId = null; // asegura que no sea una edición
  $('#modalTitle').textContent = 'Nuevo Producto';
  // reset inputs if the modal exists
  const formEl = document.querySelector('#productForm');
  if (formEl) formEl.reset();
  show('#modalOverlay');
});


/* ---------- Product add / edit form ---------- */
let editingId = null;

/* NOTE:
   The original code attempted to query '#productForm' very early in the script
   before ensureUiExtras() created it, which meant the submit listener was never attached.
   That logic has been moved into ensureUiExtras() (see above). We keep editingId here.
*/

/* ---------- Edit / Delete / Sell (delegated) ---------- */
$('#inventoryTable')?.addEventListener('click', (e) => {
  const id = e.target.dataset?.id;
  if (!id) return;
  if (e.target.classList.contains('edit-btn')) {
    const p = loadProducts().find(x=>x.id===id);
    if (!p) return;
    // open modal with data
    editingId = p.id;
    $('#modalTitle').textContent = 'Editar Producto';
    $('#p_name').value = p.name || '';
    $('#p_brand').value = p.brand || '';
    $('#p_category').value = p.category || '';
    $('#p_subcategory').value = p.subcategory || '';
    $('#p_cost').value = p.cost || 0;
    $('#p_margin').value = p.marginPercent || 0;
    $('#p_qty').value = p.qty || 0;
    show('#modalOverlay');
  } else if (e.target.classList.contains('delete-btn')) {
    if (!confirm('Eliminar producto definitivamente?')) return;
    const remaining = loadProducts().filter(p => p.id !== id);
    saveProducts(remaining);
    renderAll();
  } else if (e.target.classList.contains('sell-btn')) {
    openSellModal(id);
  }
});

/* ---------- Selected count and bulk delete for inventory ---------- */
function updateSelectedCount() {
  const cnt = $$('.row-select:checked').length;
  const btn = $('#deleteSelectedBtn');
  if (btn) btn.textContent = `Eliminar Seleccionados (${cnt})`;
}
$('#selectAllProducts')?.addEventListener('change', function() {
  const checked = this.checked;
  $$('.row-select').forEach(cb => cb.checked = checked);
  updateSelectedCount();
});
document.addEventListener('change', (e) => {
  if (e.target.classList && e.target.classList.contains('row-select')) updateSelectedCount();
});
$('#deleteSelectedBtn')?.addEventListener('click', () => {
  const ids = $$('.row-select:checked').map(n=>n.dataset.id);
  if (!ids.length) return alert('No hay seleccionados');
  if (!confirm('Eliminar seleccionados?')) return;
  const remaining = loadProducts().filter(p => !ids.includes(p.id));
  saveProducts(remaining);
  renderAll();
});

/* ---------- Sell modal logic (inteligente) ---------- */
let sellingProductId = null;
function openSellModal(productId) {
  sellingProductId = productId;
  const product = loadProducts().find(p => p.id === productId);
  if (!product) return alert('Producto no encontrado');

  const price = computeUnitPrice(product);
  const initialTotal = price * 1;

  $('#sellProductInfo').innerHTML = `
  <strong>${esc(product.name)}</strong><br>
  Disponibles: ${product.qty}<br>
`;

  $('#sell_qty').value = 1;
  $('#paymentMethod1').value = 'Efectivo';
  $('#paymentMethod2').value = '';
  $('#amount1').value = initialTotal;
  $('#amount2').value = 0;

  $('.totalDisplay').textContent = `Total Venta: ${formatCurrency(initialTotal)}`;
  updateSellTotals();
  show('#sellOverlay');
}


function computeUnitPrice(product) {
  return Math.round((product.cost || 0) * (1 + (product.marginPercent || 0)/100));
}

function updateSellTotals() {
  if (!sellingProductId) return;

  const product = loadProducts().find(p => p.id === sellingProductId);
  if (!product) return;

  const qty = Math.max(0, Number($('#sell_qty').value) || 0);
  const price = computeUnitPrice(product);
  const total = price * qty;

  const paymentMethod2 = $('#paymentMethod2').value;
  const amount1Input = $('#amount1');
  const amount2Input = $('#amount2');

  let amount1 = Number(amount1Input.value) || 0;
  let amount2 = Number(amount2Input.value) || 0;

  console.log("🧮 Depuración updateSellTotals()");
  console.log("Cantidad:", qty, "Precio unitario:", price, "Total:", total);
  console.log("Método 2:", paymentMethod2);

  // Caso 1: no hay método de pago 2
  if (!paymentMethod2) {
    amount1 = total; // todo el monto en el primer método
    amount2 = 0;
  } 
  // Caso 2: hay método 2 seleccionado
  else {
    // Si el monto1 supera el total, lo ajustamos
    if (amount1 > total) amount1 = total;

    // Calculamos el restante
    amount2 = Math.max(total - amount1, 0);
  }

  // Asignar los valores actualizados
  amount1Input.value = amount1;
  amount2Input.value = amount2;

  // Mostrar total visual
  $('.totalDisplay').textContent = `Total Venta: ${formatCurrency(total)}`;

  console.log("➡ amount1:", amount1, "amount2:", amount2);
}




/* ---------- Sales delete helpers (bulk & all) ---------- */
$('#deleteAllSales')?.addEventListener('click', () => {
  if (!confirm('Eliminar todas las ventas?')) return;
  localStorage.removeItem(LS_SALES);
  renderAll();
});
$('#deleteSelectedSales')?.addEventListener('click', () => {
  const checks = $$('.sale-select:checked');
  if (!checks.length) return alert('Selecciona alguna venta');
  const sales = loadSales();
  // compute remaining by matching rows: we build remaining by excluding selected ids
  const selectedIds = checks.map(ch => ch.dataset.id);
  const remaining = sales.filter(s => !selectedIds.includes(s.id));
  saveSales(remaining);
  renderAll();
});

/* ---------- Export helpers ---------- */
async function exportElementToPdf(elSelector, filename = 'export.pdf') {
  const el = typeof elSelector === 'string' ? document.querySelector(elSelector) : elSelector;
  if (!el) return alert('Elemento no encontrado para exportar');
  const canvas = await html2canvas(el, { scale: 2, useCORS: true });
  const img = canvas.toDataURL('image/png');
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF('p', 'pt', 'a4');
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const imgW = pageW;
  const imgH = (canvas.height * imgW) / canvas.width;
  let pos = 0;
  pdf.addImage(img, 'PNG', 0, pos, imgW, imgH);
  let hLeft = imgH - pageH;
  while (hLeft > 0) {
    pos = hLeft - imgH;
    pdf.addPage();
    pdf.addImage(img, 'PNG', 0, pos, imgW, imgH);
    hLeft -= pageH;
  }
  pdf.save(filename);
}

function exportSalesCsv() {
  const sales = loadSales();
  if (!sales.length) return alert('No hay ventas para exportar.');
  const rows = [['Producto','Marca','Cantidad','Total Venta','Ganancia','Método1','Monto1','Método2','Monto2','Fecha']];
  sales.forEach(s => rows.push([s.name, s.brand||'', s.qty, s.total, s.profit, s.method1||'', s.amount1||0, s.method2||'', s.amount2||0, s.timestamp]));
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'ventas.csv'; a.click();
}

function exportInventoryCsv() {
  const products = loadProducts();
  if (!products.length) return alert('No hay productos para exportar.');
  const rows = [['Nombre','Marca','Categoria','Costo','Margen %','Stock','Vendidos']];
  products.forEach(p => rows.push([p.name, p.brand||'', p.category||'', p.cost, p.marginPercent||0, p.qty||0, p.sold||0]));
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'inventario.csv'; a.click();
}

/* ---------- Wire top-level UI controls ---------- */
function wireUiButtons() {
  $('#addProductBtn')?.addEventListener('click', () => {
    editingId = null;
    $('#modalTitle').textContent = 'Nuevo Producto';
    $('#productForm')?.reset();
    show('#modalOverlay');
  });

  $('#downloadInventoryPdfBtn')?.addEventListener('click', () => exportElementToPdf('#inventoryTableWrapper', 'inventario.pdf'));
  $('#downloadSalesPdfBtn')?.addEventListener('click', () => exportElementToPdf('#salesTableWrapper', 'ventas.pdf'));
  $('#exportSalesExcel')?.addEventListener('click', () => exportSalesCsv());
  $('#exportInventoryExcel')?.addEventListener('click', () => exportInventoryCsv());
  $('#importInventoryExcel')?.addEventListener('click', () => importInventoryFromExcel()); // if you attach a button with that id

  $('#refreshAnalysisBtn')?.addEventListener('click', () => {
    renderAll();
    setTimeout(() => renderStatsAndCharts(), 150);
  });
}

/* ---------- Import Excel function (reuse earlier logic) ---------- */
function importInventoryFromExcel() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.xlsx,.xls';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(ev) {
      try {
        const data = new Uint8Array(ev.target.result);
        const wb = XLSX.read(data, { type: 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet);
        if (!rows.length) return alert('Archivo vacío o formato no válido');
        const products = loadProducts();
        let added = 0;
        rows.forEach(r => {
          if (!r.name || !r.brand || isNaN(r.cost)) return;
          products.push({
            id: cryptoId(),
            name: String(r.name).trim(),
            brand: String(r.brand||'').trim(),
            category: String(r.category||'').trim(),
            subcategory: String(r.subcategory||'').trim(),
            cost: Number(r.cost) || 0,
            marginPercent: Number(r.marginPercent) || 0,
            qty: Number(r.qty) || 0,
            sold: 0,
            createdAt: nowISO()
          });
          added++;
        });
        saveProducts(products);
        renderAll();
        alert(`Se importaron ${added} productos.`);
      } catch (err) {
        console.error(err);
        alert('Error leyendo Excel');
      }
    };
    reader.readAsArrayBuffer(file);
  };
  input.click();
}

/* ---------- Search wiring ---------- */
$('#searchInventory')?.addEventListener('input', (e)=> renderInventoryTable(e.target.value));
$('#searchSales')?.addEventListener('input', (e)=> renderSalesTable(e.target.value));

/* ---------- Tabs ---------- */
$$('.tab-btn').forEach(btn => btn.addEventListener('click', (e) => {
  e.stopPropagation(); // 🚫 Evita que otros clics disparen cosas
  $$('.tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const tab = btn.dataset.tab;
  $$('.tab-content').forEach(t => t.classList.add('hidden'));
  const section = document.getElementById(tab);
  if (section) section.classList.remove('hidden');
  if (tab === 'clients') renderClientsTable(); // ✅ Render clientes al abrir
  if (tab === 'analysis') setTimeout(() => {
    renderStatsAndCharts();
    renderBrandAnalysis();
  }, 120);
}));


/* ---------- Render all ---------- */
function renderAll() {
  // show main if hidden
  const main = document.querySelector('main.container');
  if (main) main.classList.remove('hidden');

  renderInventoryTable($('#searchInventory')?.value || '');
  renderSalesTable($('#searchSales')?.value || '');
  
  renderSoldTable();
  renderBrandAnalysis();
  renderStatsAndCharts();
}

/* ---------- Init ---------- */
(function init() {
  seedIfEmpty();
  ensureUiExtras();
  wireModals();
  wireUiButtons();
  // extra listeners created after modals
  // wire cancel close for sell/product modals
  $('#cancelModal')?.addEventListener('click', () => hide('#modalOverlay'));
  $('#closeModal')?.addEventListener('click', () => hide('#modalOverlay'));
  $('#cancelSell')?.addEventListener('click', () => hide('#sellOverlay'));
  $('#closeSellModal')?.addEventListener('click', () => hide('#sellOverlay'));

  // Sell amount inputs auto-update
  $('#amount1')?.addEventListener('input', updateSellTotals);
  $('#amount2')?.addEventListener('input', updateSellTotals);
  $('#paymentMethod1')?.addEventListener('change', updateSellTotals);
  $('#paymentMethod2')?.addEventListener('change', updateSellTotals);
  $('#sell_qty')?.addEventListener('input', updateSellTotals);

  // delete selected / all sales buttons (alternate ids present in HTML)
  $('#deleteAllSales')?.addEventListener('click', () => {
    if (!confirm('Eliminar todas las ventas?')) return;
    localStorage.removeItem(LS_SALES);
    renderAll();
  });
  $('#deleteSelectedSales')?.addEventListener('click', () => {
    const checked = $$('.sale-select:checked');
    if (!checked.length) return alert('Selecciona ventas');
    const ids = checked.map(c=>c.dataset.id);
    saveSales(loadSales().filter(s => !ids.includes(s.id)));
    renderAll();
  });

  // Ensure "deleteSelectedBtn" exists; if not, create small fallback (some templates use different ids)
  if (!$('#deleteSelectedBtn')) {
    const btn = document.createElement('button');
    btn.id = 'deleteSelectedBtn';
    btn.className = 'btn ghost';
    btn.style.display = 'none'; // hidden fallback
    document.body.appendChild(btn);
  }

  // ... resto de funciones ...
function renderAll() {
  renderInventoryTable();
  renderSalesTable();
  renderSoldTable();
  renderBrandAnalysis();
  renderStatsAndCharts();
}


renderAll();

function init() {
  seedIfEmpty();        // crea claves vacías
  ensureUiExtras();     // crea el modal y otros elementos
  wireModals();         // conecta los botones del modal
  wireUiButtons();      // conecta el botón “Agregar producto”
  renderAll();          // muestra tablas vacías (sin error)
}


/* ---------- Ejecutar cuando el DOM esté listo ---------- */
window.addEventListener('DOMContentLoaded', init);


// refresh on storage change (multitab)
  window.addEventListener('storage', () => renderAll());
})();



