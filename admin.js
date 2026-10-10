// ─── Sunil Store — Admin Panel ─────────────────────────────────────────────

const STATUS_FLOW = ['Pending','Confirmed','Preparing','Ready','Completed'];
const STATUS_BADGE = {
  Pending:   'badge-orange', Confirmed: 'badge-blue',
  Preparing: 'badge-purple', Ready:     'badge-blue',
  Completed: 'badge-green',  Cancelled: 'badge-red',
};

// ── Auth ──────────────────────────────────────────────────────────────────────
let loginAttempts = 0;
let lockUntil = 0;

function doLogin() {
  const now = Date.now();
  const errEl = document.getElementById('loginError');
  if (now < lockUntil) {
    const secs = Math.ceil((lockUntil - now) / 1000);
    errEl.textContent = `Too many attempts. Try again in ${secs}s.`;
    errEl.classList.remove('hidden');
    return;
  }
  const pass = document.getElementById('loginPass').value;
  if (DB.adminLogin(pass)) {
    loginAttempts = 0;
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('adminApp').classList.remove('hidden');
    initAdmin();
  } else {
    loginAttempts++;
    if (loginAttempts >= 5) {
      lockUntil = Date.now() + 30000;
      loginAttempts = 0;
      errEl.textContent = 'Too many attempts. Locked for 30s.';
    } else {
      errEl.textContent = 'Incorrect password.';
    }
    errEl.classList.remove('hidden');
  }
}

function doLogout() {
  DB.adminLogout();
  location.reload();
}

// ── Sidebar ───────────────────────────────────────────────────────────────────
function toggleSidebar() {
  document.getElementById('adminSidebar').classList.toggle('open');
  document.getElementById('sidebarOverlay').classList.toggle('show');
}
function closeSidebar() {
  document.getElementById('adminSidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('show');
}

// ── Tabs ──────────────────────────────────────────────────────────────────────
const TAB_TITLES = { dashboard:'Dashboard', products:'Products', categories:'Categories', orders:'Orders', settings:'Settings' };
let currentTab = 'dashboard';

function showTab(tab) {
  document.getElementById(`tab-${currentTab}`).classList.add('hidden');
  document.getElementById(`nav-${currentTab}`).classList.remove('active');
  currentTab = tab;
  document.getElementById(`tab-${tab}`).classList.remove('hidden');
  document.getElementById(`nav-${tab}`).classList.add('active');
  document.getElementById('tabTitle').textContent = TAB_TITLES[tab];
  closeSidebar();
  if (tab === 'dashboard')  renderDashboard();
  if (tab === 'products')   renderProductsTable();
  if (tab === 'categories') renderCatsTable();
  if (tab === 'orders')     renderOrdersTable();
  if (tab === 'settings')   renderSettings();
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
function renderDashboard() {
  const orders   = DB.getOrders();
  const products = DB.getProducts();
  const cats     = DB.getCategories();
  const revenue  = orders.filter(o=>o.status==='Completed').reduce((s,o)=>s+o.total,0);
  const pending  = orders.filter(o=>o.status==='Pending').length;

  document.getElementById('statsGrid').innerHTML = [
    { icon:'📦', val: products.length, lbl:'Total Products' },
    { icon:'📂', val: cats.length,     lbl:'Categories' },
    { icon:'📋', val: orders.length,   lbl:'Total Orders' },
    { icon:'⏳', val: pending,          lbl:'Pending Orders' },
    { icon:'💰', val:`Rs.${revenue.toFixed(0)}`, lbl:'Revenue (Completed)' },
  ].map(s=>`
    <div class="stat-card">
      <div class="stat-icon">${s.icon}</div>
      <div><div class="stat-val">${s.val}</div><div class="stat-lbl">${s.lbl}</div></div>
    </div>`).join('');

  const recent = orders.slice(0,10);
  document.getElementById('recentOrdersBody').innerHTML = recent.length
    ? recent.map(o=>`<tr>
        <td><strong>${o.id}</strong></td>
        <td>${o.customer.name}</td>
        <td>Rs. ${o.total.toFixed(2)}</td>
        <td><span class="badge ${STATUS_BADGE[o.status]||'badge-grey'}">${o.status}</span></td>
        <td>${fmtDate(o.createdAt)}</td>
        <td><button class="btn btn-danger btn-sm" onclick="confirmDelete('order','${o.id}')">🗑️</button></td>
      </tr>`).join('')
    : '<tr><td colspan="6" class="text-center" style="color:var(--muted);padding:2rem;">No orders yet.</td></tr>';
}

// ── Products ──────────────────────────────────────────────────────────────────
function renderProductsTable() {
  const prods = [...DB.getProducts()].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  const cats  = DB.getCategories();
  document.getElementById('productsTableBody').innerHTML = prods.length
    ? prods.map(p => {
        const cat = cats.find(c=>c.id===p.categoryId);
        const imgHtml = p.image
          ? `<img src="${p.image}" style="width:44px;height:44px;border-radius:8px;object-fit:cover;" onerror="this.style.display='none'" />`
          : `<span style="font-size:1.6rem;">${cat?.icon||'🛒'}</span>`;
        return `<tr>
          <td>${imgHtml}</td>
          <td><strong>${p.name}</strong><br/><small style="color:var(--muted)">${p.nameSi}</small></td>
          <td>${cat ? cat.icon+' '+cat.name : '—'}</td>
          <td>Rs. ${p.price.toFixed(2)}</td>
          <td>${p.unit}</td>
          <td>
            <input type="number" value="${p.stock}" min="0" style="width:70px;padding:.3rem .5rem;"
              onchange="updateStock(${p.id},this.value)" />
          </td>
          <td>
            <button class="btn btn-outline btn-sm" onclick="openProductModal(${p.id})">✏️</button>
            <button class="btn btn-danger btn-sm" onclick="confirmDelete('product',${p.id})">🗑️</button>
          </td>
        </tr>`;
      }).join('')
    : '<tr><td colspan="7" class="text-center" style="color:var(--muted);padding:2rem;">No products.</td></tr>';
}

function openProductModal(id=null) {
  const cats = [...DB.getCategories()].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  document.getElementById('pCategory').innerHTML = cats.map(c=>`<option value="${c.id}">${c.icon} ${c.name}</option>`).join('');
  if (id) {
    const p = DB.getProducts().find(x=>x.id===id);
    document.getElementById('productModalTitle').textContent = 'Edit Product';
    document.getElementById('pId').value      = p.id;
    document.getElementById('pName').value    = p.name;
    document.getElementById('pNameSi').value  = p.nameSi;
    document.getElementById('pCategory').value= p.categoryId;
    document.getElementById('pUnit').value    = p.unit;
    document.getElementById('pPrice').value   = p.price;
    document.getElementById('pStock').value   = p.stock;
    document.getElementById('pImage').value   = p.image||'';
    previewImg();
  } else {
    document.getElementById('productModalTitle').textContent = 'Add Product';
    ['pId','pName','pNameSi','pUnit','pPrice','pStock','pImage'].forEach(id=>document.getElementById(id).value='');
    document.getElementById('imgPreview').style.display='none';
  }
  openModal('productModal');
}

function previewImg() {
  const url = document.getElementById('pImage').value.trim();
  const img = document.getElementById('imgPreview');
  if (url) { img.src = url; img.style.display='block'; }
  else      { img.style.display='none'; }
}

function saveProduct() {
  const name   = document.getElementById('pName').value.trim();
  const nameSi = document.getElementById('pNameSi').value.trim();
  const catId  = parseInt(document.getElementById('pCategory').value);
  const unit   = document.getElementById('pUnit').value.trim();
  const price  = parseFloat(document.getElementById('pPrice').value);
  const stock  = parseInt(document.getElementById('pStock').value);
  const image  = document.getElementById('pImage').value.trim();
  const idVal  = document.getElementById('pId').value;

  if (!name || !unit || isNaN(price) || isNaN(stock)) { showToast('Please fill all required fields.', true); return; }

  const prods = DB.getProducts();
  if (idVal) {
    const idx = prods.findIndex(p=>p.id===parseInt(idVal));
    if (idx>=0) prods[idx] = { ...prods[idx], name, nameSi, categoryId:catId, unit, price, stock, image };
    showToast('Product updated!');
  } else {
    const newId = prods.length ? Math.max(...prods.map(p=>p.id))+1 : 1;
    prods.push({ id:newId, categoryId:catId, name, nameSi, price, unit, stock, image });
    showToast('Product added!');
  }
  DB.saveProducts(prods);
  closeModal('productModal');
  renderProductsTable();
}

function updateStock(id, val) {
  const prods = DB.getProducts();
  const idx   = prods.findIndex(p=>p.id===id);
  if (idx>=0) { prods[idx].stock = Math.max(0, parseInt(val)||0); DB.saveProducts(prods); showToast('Stock updated!'); }
}

// ── Categories ────────────────────────────────────────────────────────────────
function renderCatsTable() {
  const cats  = [...DB.getCategories()].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  const prods = DB.getProducts();
  document.getElementById('catsTableBody').innerHTML = cats.length
    ? cats.map(c=>`<tr>
        <td style="font-size:1.6rem;">${c.icon}</td>
        <td><strong>${c.name}</strong></td>
        <td>${c.nameSi}</td>
        <td><span class="badge badge-green">${prods.filter(p=>p.categoryId===c.id).length}</span></td>
        <td>
          <button class="btn btn-outline btn-sm" onclick="openCatModal(${c.id})">✏️</button>
          <button class="btn btn-danger btn-sm" onclick="confirmDelete('category',${c.id})">🗑️</button>
        </td>
      </tr>`).join('')
    : '<tr><td colspan="5" class="text-center" style="color:var(--muted);padding:2rem;">No categories.</td></tr>';
}

function openCatModal(id=null) {
  if (id) {
    const c = DB.getCategories().find(x=>x.id===id);
    document.getElementById('catModalTitle').textContent = 'Edit Category';
    document.getElementById('cId').value     = c.id;
    document.getElementById('cName').value   = c.name;
    document.getElementById('cNameSi').value = c.nameSi;
    document.getElementById('cIcon').value   = c.icon;
  } else {
    document.getElementById('catModalTitle').textContent = 'Add Category';
    ['cId','cName','cNameSi','cIcon'].forEach(id=>document.getElementById(id).value='');
  }
  openModal('catModal');
}

function saveCategory() {
  const name   = document.getElementById('cName').value.trim();
  const nameSi = document.getElementById('cNameSi').value.trim();
  const icon   = document.getElementById('cIcon').value.trim() || '📦';
  const idVal  = document.getElementById('cId').value;

  if (!name) { showToast('Category name is required.', true); return; }

  const cats = DB.getCategories();
  if (idVal) {
    const idx = cats.findIndex(c=>c.id===parseInt(idVal));
    if (idx>=0) cats[idx] = { ...cats[idx], name, nameSi, icon };
    showToast('Category updated!');
  } else {
    const newId = cats.length ? Math.max(...cats.map(c=>c.id))+1 : 1;
    cats.push({ id:newId, name, nameSi, icon });
    showToast('Category added!');
  }
  DB.saveCategories(cats);
  closeModal('catModal');
  renderCatsTable();
}

// ── Orders ────────────────────────────────────────────────────────────────────
let orderStatusFilter = 'All';

function renderOrdersTable() {
  const statuses = ['All', ...STATUS_FLOW, 'Cancelled'];
  document.getElementById('orderFilters').innerHTML = statuses.map(s=>`
    <button class="btn btn-sm ${orderStatusFilter===s?'btn-primary':'btn-outline'}" onclick="setOrderFilter('${s}')">${s}</button>
  `).join('');

  let orders = DB.getOrders();
  if (orderStatusFilter !== 'All') orders = orders.filter(o=>o.status===orderStatusFilter);

  document.getElementById('ordersTableBody').innerHTML = orders.length
    ? orders.map(o=>`<tr>
        <td><strong>${o.id}</strong></td>
        <td>${o.customer.name}</td>
        <td><a href="tel:${o.customer.phone}">${o.customer.phone}</a></td>
        <td>Rs. ${o.total.toFixed(2)}</td>
        <td><span class="badge ${STATUS_BADGE[o.status]||'badge-grey'}">${o.status}</span></td>
        <td>${fmtDate(o.createdAt)}</td>
        <td style="display:flex;gap:.3rem;flex-wrap:wrap;">
          <button class="btn btn-outline btn-sm" onclick="openOrderDetail('${o.id}')">👁️</button>
          ${nextStatusBtn(o)}
          ${o.status!=='Cancelled'&&o.status!=='Completed'
            ? `<button class="btn btn-danger btn-sm" onclick="setOrderStatus('${o.id}','Cancelled')">✕</button>`
            : ''}
          <button class="btn btn-danger btn-sm" onclick="confirmDelete('order','${o.id}')">🗑️</button>
        </td>
      </tr>`).join('')
    : '<tr><td colspan="7" class="text-center" style="color:var(--muted);padding:2rem;">No orders found.</td></tr>';
}

function nextStatusBtn(o) {
  const idx = STATUS_FLOW.indexOf(o.status);
  if (idx < 0 || idx >= STATUS_FLOW.length-1) return '';
  const next = STATUS_FLOW[idx+1];
  return `<button class="btn btn-primary btn-sm" onclick="setOrderStatus('${o.id}','${next}')">→ ${next}</button>`;
}

function setOrderFilter(s) {
  orderStatusFilter = s;
  renderOrdersTable();
}

function setOrderStatus(id, status) {
  const orders = DB.getOrders();
  const idx    = orders.findIndex(o=>o.id===id);
  if (idx>=0) { orders[idx].status = status; DB.saveOrders(orders); }
  showToast(`Order ${id} → ${status}`);
  updatePendingBadge();
  renderOrdersTable();
  if (currentTab==='dashboard') renderDashboard();
}

function openOrderDetail(id) {
  const o = DB.getOrders().find(x=>x.id===id);
  if (!o) return;
  document.getElementById('orderDetailTitle').textContent = `Order ${o.id}`;
  document.getElementById('orderDetailBody').innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:.5rem;margin-bottom:1rem;font-size:.88rem;">
      <div><strong>Customer:</strong> ${o.customer.name}</div>
      <div><strong>Phone:</strong> <a href="tel:${o.customer.phone}">${o.customer.phone}</a></div>
      <div style="grid-column:1/-1;"><strong>Address:</strong> ${o.customer.address}</div>
      <div><strong>Status:</strong> <span class="badge ${STATUS_BADGE[o.status]||'badge-grey'}">${o.status}</span></div>
      <div><strong>Date:</strong> ${fmtDate(o.createdAt)}</div>
    </div>
    <div style="font-weight:700;margin-bottom:.5rem;">Items</div>
    <div class="order-items-list">
      ${o.items.map(i=>`
        <div class="oi">
          <span>${i.name} (${i.nameSi}) × ${i.qty} ${i.unit}</span>
          <span>Rs. ${(i.price*i.qty).toFixed(2)}</span>
        </div>`).join('')}
      <div class="oi" style="font-weight:800;">
        <span>Total</span><span style="color:var(--orange);">Rs. ${o.total.toFixed(2)}</span>
      </div>
    </div>
    <div style="margin-top:1rem;display:flex;gap:.5rem;flex-wrap:wrap;">
      ${STATUS_FLOW.map(s=>`
        <button class="btn btn-sm ${o.status===s?'btn-primary':'btn-outline'}" onclick="setOrderStatus('${o.id}','${s}');closeModal('orderDetailModal');">${s}</button>
      `).join('')}
      <button class="btn btn-danger btn-sm" onclick="setOrderStatus('${o.id}','Cancelled');closeModal('orderDetailModal');">Cancelled</button>
      <button class="btn btn-danger btn-sm" onclick="closeModal('orderDetailModal');confirmDelete('order','${o.id}');">🗑️ Delete</button>
    </div>`;
  openModal('orderDetailModal');
}

// ── Settings ─────────────────────────────────────────────────────────────────
function renderSettings() {
  const s = DB.getSettings();
  document.getElementById('setName').value     = s.name;
  document.getElementById('setTagline').value  = s.tagline;
  document.getElementById('setPhone').value    = s.phone;
  document.getElementById('setAddress').value  = s.address;
  document.getElementById('setMapUrl').value   = s.mapUrl;
  document.getElementById('setOpenTime').value = s.openTime;
  document.getElementById('setCloseTime').value= s.closeTime;
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  document.getElementById('setOpenDays').innerHTML = days.map((d,i) => `
    <label style="display:flex;align-items:center;gap:.3rem;cursor:pointer;font-size:.85rem;font-weight:600;">
      <input type="checkbox" value="${i}" ${s.openDays.includes(i)?'checked':''} />${d}
    </label>`).join('');
}

function saveSettings() {
  const openDays = [...document.querySelectorAll('#setOpenDays input:checked')].map(c => parseInt(c.value));
  DB.saveSettings({
    name:      document.getElementById('setName').value.trim()      || 'Sunil Store',
    tagline:   document.getElementById('setTagline').value.trim()   || 'Fresh Choices, Happy Homes.',
    phone:     document.getElementById('setPhone').value.trim()     || '0775163271',
    address:   document.getElementById('setAddress').value.trim()   || 'Udalamatta, Galle',
    mapUrl:    document.getElementById('setMapUrl').value.trim()    || 'https://www.google.com/maps/place/Sunil+Store/@6.1829866,80.2948983,17z/data=!3m1!4b1!4m6!3m5!1s0x3ae1650053d15c7b:0xb8600c6f5bb91ff!8m2!3d6.1829866!4d80.2948983!16s%2Fg%2F11xh5tx4py?entry=ttu&g_ep=EgoyMDI2MDkwMi4wIKXMDSoASAFQAw%3D%3D',
    openTime:  document.getElementById('setOpenTime').value         || '06:00',
    closeTime: document.getElementById('setCloseTime').value        || '21:00',
    openDays,
  });
  showToast('Settings saved! Store updated.');
}

// ── Pending badge & live order sync ──────────────────────────────────────────
function updatePendingBadge() {
  const count = DB.getOrders().filter(o => o.status === 'Pending').length;
  const badge = document.getElementById('pendingBadge');
  if (count > 0) { badge.textContent = count; badge.classList.remove('hidden'); }
  else           { badge.classList.add('hidden'); }
}

window.addEventListener('storage', e => {
  if (e.key === 'ss_orders') {
    updatePendingBadge();
    if (currentTab === 'dashboard') renderDashboard();
    if (currentTab === 'orders')    renderOrdersTable();
  }
  if (e.key === 'ss_products' && currentTab === 'products') renderProductsTable();
});

// ── Delete confirm ────────────────────────────────────────────────────────────
function confirmDelete(type, id) {
  document.getElementById('confirmMsg').textContent =
    `Are you sure you want to delete this ${type}? This cannot be undone.`;
  document.getElementById('confirmOkBtn').onclick = () => {
    if (type==='product') {
      DB.saveProducts(DB.getProducts().filter(p=>p.id!==id));
      renderProductsTable(); showToast('Product deleted.');
    } else if (type==='order') {
      DB.saveOrders(DB.getOrders().filter(o=>o.id!==id));
      renderOrdersTable();
      renderDashboard();
      updatePendingBadge();
      showToast('Order deleted.');
    } else {
      DB.saveCategories(DB.getCategories().filter(c=>c.id!==id));
      renderCatsTable(); showToast('Category deleted.');
    }
    closeModal('confirmModal');
  };
  openModal('confirmModal');
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB') + ' ' + d.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});
}

function openModal(id)  { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

document.querySelectorAll('.modal-overlay').forEach(el => {
  el.addEventListener('click', e => { if (e.target===el) el.classList.add('hidden'); });
});

let toastTimer;
function showToast(msg, error=false) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className   = 'show' + (error?' error':'');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>el.className='', 2800);
}

// ── Init ─────────────────────────────────────────────────────────────────────
async function removeOrdersOlderThanTwoDays() {
  const cutoff = Date.now() - (2 * 24 * 60 * 60 * 1000);
  const orders = DB.getOrders();
  const activeOrders = orders.filter(order => {
    const createdAt = Date.parse(order.createdAt);
    return !Number.isFinite(createdAt) || createdAt >= cutoff;
  });

  if (activeOrders.length !== orders.length) {
    await DB.saveOrders(activeOrders);
  }
}

async function initAdmin() {
  try {
    await removeOrdersOlderThanTwoDays();
  } catch (error) {
    console.warn('Old order cleanup failed:', error.message || error);
  }
  renderDashboard();
  updatePendingBadge();
  setInterval(async () => {
    try {
      await DB.refreshFromServer('orders');
      await removeOrdersOlderThanTwoDays();
      if (currentTab === 'dashboard') renderDashboard();
      if (currentTab === 'orders') renderOrdersTable();
      updatePendingBadge();
    } catch (error) {
      console.warn('Order refresh failed:', error.message || error);
    }
  }, 15000);
}

// Auto-login if session active
DB.hydrateFromServer().finally(() => {
  if (DB.isAdmin()) {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('adminApp').classList.remove('hidden');
    initAdmin();
  }
});
