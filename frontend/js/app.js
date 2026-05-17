import { MENU_DATA } from './menuData.js?v=2';
import * as auth from './auth.js?v=2';
import * as admin from './admin.js?v=2';
import { initRealtime, saveOrders, loadOrders, placeOrderAPI, updateOrderStatusAPI, fetchAllOrdersAPI } from './realtime.js?v=2';
import { initNotifications, addNotification, markAllRead, renderNotifDropdown } from './notifications.js?v=2';

export let state = {
    user: null,
    cart: [],
    orders: [],
    activeFilter: 'All',
    typeFilter: 'all',   // 'all' | 'veg' | 'nonveg'
    menuData: MENU_DATA.map(i => ({ ...i })),
    orderCounter: 1001,
    orderType: 'now',
};

// Animation Util
export function animateValue(id, start, end, duration, prefix = '') {
    const obj = document.getElementById(id);
    if (!obj) return;
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        // Easing out cubic
        const ease = 1 - Math.pow(1 - progress, 3);
        const current = Math.floor(ease * (end - start) + start);
        obj.innerHTML = `${prefix}${current}`;
        if (progress < 1) {
            window.requestAnimationFrame(step);
        } else {
            obj.innerHTML = `${prefix}${end}`;
        }
    };
    window.requestAnimationFrame(step);
}
window.animateValue = animateValue;

// Global Exposure
window.showPage = showPage;
window.toggleCart = toggleCart;
window.switchAuthTab = auth.switchAuthTab;
window.doLogin = doLogin;
window.doRegister = doRegister;
window.doAdminLogin = doAdminLogin;
window.logout = logout;
window.addToCart = addToCart;
window.updateQty = updateQty;
window.placeOrder = placeOrder;
window.confirmOrder = confirmOrder;
window.closeModal = closeModal;
window.setFilter = setFilter;
window.setTypeFilter = setTypeFilter;
window.showAdminSection = admin.showAdminSection;
window.filterMenu = filterMenu;
window.updatePickupOptions = updatePickupOptions;
window.switchOrderTab = switchOrderTab;
window.markCompleted = markCompleted;
window.rateOrder = rateOrder;
window.showQR = showQR;
window.createGroupOrder = createGroupOrder;
window.toggleNotifPanel = toggleNotifPanel;
window.clearNotifs = clearNotifs;
window.setOrderType = setOrderType;

const CAT_MAP = {
    'All': 'All',
    'Breakfast': 'Breakfast',
    'Starters': 'Starters',
    'Fast Food': 'FastFood',
    'Biryani': 'MainCourse',
    'Curries': 'Curries',
    'Burgers & Pizza': 'FastFood2',
    'Beverages': 'Beverages',
};

// Initialization
document.addEventListener('DOMContentLoaded', () => { (async () => {
    // Restore session from localStorage (survive page refresh)
    const savedUser = localStorage.getItem('vsd_user');
    if (savedUser) {
        try {
            state.user = JSON.parse(savedUser);
            if (state.user.role === 'admin') enterAdmin();
            else enterStudent();
        } catch { localStorage.removeItem('vsd_user'); }
    }

    // Init notification system
    initNotifications((unread) => {
        const badge = document.getElementById('notifBadge');
        if (badge) {
            badge.textContent = unread;
            badge.style.display = unread > 0 ? 'inline-flex' : 'none';
        }
    });

    // Load orders from server (fallback to localStorage)
    const serverOrders = await fetchAllOrdersAPI();
    state.orders = serverOrders || loadOrders();

    // Real-time sync — server pushes updates to all tabs/devices
    initRealtime((updatedOrders) => {
        state.orders = updatedOrders;
        if (document.getElementById('page-orders')?.classList.contains('active')) loadOrders_page();
        if (document.getElementById('page-admin')?.classList.contains('active')) admin.refreshAdminOrders();
        if (document.getElementById('page-home')?.classList.contains('active')) updateWaitTime();
    });

    // Listen for menu availability changes from admin tab
    try {
        const bc = new BroadcastChannel('vignan_smartdine');
        bc.onmessage = (e) => {
            if (e.data?.type === 'MENU_UPDATE') {
                e.data.menuData.forEach(update => {
                    const item = state.menuData.find(m => m.id === update.id);
                    if (item) Object.assign(item, update);
                });
                if (document.getElementById('page-menu')?.classList.contains('active')) filterMenu();
                if (document.getElementById('page-home')?.classList.contains('active')) renderPopular();
            }
        };
    } catch {}

    // Init date/time pickers with sensible defaults
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];
    const timeStr = String(today.getHours() + 1).padStart(2, '0') + ':00';
    const datePicker = document.getElementById('scheduleDate');
    const timePicker = document.getElementById('scheduleTime');
    if (datePicker) { datePicker.value = dateStr; datePicker.min = dateStr; }
    if (timePicker) { timePicker.value = timeStr; }
    if (datePicker) datePicker.addEventListener('change', updateSchedulePreview);
    if (timePicker) timePicker.addEventListener('change', updateSchedulePreview);

    // Auto-activate scheduled orders every 30s
    setInterval(checkScheduledOrders, 30000);

    // Live stats ticker
    setInterval(() => {
        const el = document.getElementById('statOrders');
        if (el) el.textContent = 240 + state.orders.length;
    }, 8000);
})(); });

export function showPage(pg) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const target = document.getElementById('page-' + pg);
    if (target) target.classList.add('active');

    document.querySelectorAll('#mainNav .nav-btn').forEach(b => {
        b.classList.toggle('active', b.getAttribute('onclick')?.includes(`'${pg}'`));
    });

    if (pg === 'home') initHome();
    if (pg === 'menu') renderMenu();
    if (pg === 'orders') loadOrders_page();
    if (pg === 'profile') updateProfile();
    if (pg === 'admin') admin.initAdmin();
}

async function doLogin() {
    const user = await auth.handleLogin();
    if (user) {
        state.user = user;
        localStorage.setItem('vsd_user', JSON.stringify(user)); // persist session
        enterStudent();
    }
}

async function doAdminLogin() {
    const user = await auth.handleAdminLogin();
    if (user) {
        state.user = user;
        localStorage.setItem('vsd_user', JSON.stringify(user)); // persist session
        enterAdmin();
    }
}

async function doRegister() {
    const user = await auth.handleRegister();
    if (user) {
        state.user = user;
        localStorage.setItem('vsd_user', JSON.stringify(user));
        showNotif('Account created! Welcome 🎉', 'success');
        enterStudent();
    }
}

function enterStudent() {
    document.getElementById('page-auth').classList.remove('active');
    document.getElementById('mainNav').classList.remove('hidden');
    document.getElementById('adminNav').classList.add('hidden');
    
    // Set user info
    const name = state.user?.name || 'Student';
    document.getElementById('navUserName').textContent = name;
    document.getElementById('ddUserName').textContent = name;
    document.getElementById('ddUserEmail').textContent = state.user?.email || '';
    document.getElementById('ddUserYear').textContent = state.user?.year || 'Student';
    
    showPage('home');
    initHome();
    loadOrders_page();
    updateProfile();
    document.getElementById('chatTrigger').classList.remove('hidden');
}

function enterAdmin() {
    document.getElementById('page-auth').classList.remove('active');
    document.getElementById('adminNav').classList.remove('hidden');
    document.getElementById('mainNav').classList.add('hidden');
    
    // Set admin info
    const name = state.user?.name || 'Admin';
    document.getElementById('navAdminName').textContent = name;
    document.getElementById('ddAdminName').textContent = name;
    document.getElementById('ddAdminEmail').textContent = state.user?.email || 'admin@vignan.ac.in';
    
    showPage('admin');
    document.getElementById('chatTrigger').classList.remove('hidden');
}

function logout() {
    state.user = null;
    state.cart = [];
    localStorage.removeItem('vsd_user'); // clear session
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('mainNav').classList.add('hidden');
    document.getElementById('adminNav').classList.add('hidden');
    document.getElementById('page-auth').classList.add('active');
    document.getElementById('chatTrigger').classList.add('hidden');
    document.getElementById('chatWindow').classList.add('hidden');
    updateCartBadge();
}

// Home Logic
function initHome() {
    renderHeatmap();
    renderAIRecs();
    renderPopular();
    updateWaitTime();
}

function renderHeatmap() {
    const hours = ['8a', '9a', '10a', '11a', '12p', '1p', '2p', '3p', '4p', '5p', '6p', '7p'];
    const levels = [0, 0, 1, 2, 2, 2, 1, 1, 0, 0, 0, 0];
    const classes = ['heat-low', 'heat-med', 'heat-high'];
    const descs = ['Low', 'Moderate', 'Peak'];
    const h = document.getElementById('heatmap');
    if (h) h.innerHTML = hours.map((hr, i) => `<div class="heat-cell ${classes[levels[i]]}" title="${hr}: ${descs[levels[i]]}">${hr}</div>`).join('');
}

function renderAIRecs() {
    const hour = new Date().getHours();
    let recs = [];
    if (hour < 10) recs = state.menuData.filter(i => i.tags?.includes('breakfast') && i.popular).slice(0, 5);
    else if (hour < 15) recs = state.menuData.filter(i => (i.tags?.includes('biryani') || i.tags?.includes('meals')) && i.popular).slice(0, 5);
    else recs = state.menuData.filter(i => i.tags?.includes('fast') && i.popular).slice(0, 5);
    if (recs.length === 0) recs = state.menuData.filter(i => i.popular).slice(0, 5);
    const el = document.getElementById('aiRecs');
    if (el) el.innerHTML = recs.map(i => `<div class="rec-chip" onclick="addToCart(${i.id})">+ ${i.name} <span style="color:var(--accent)">₹${i.price}</span></div>`).join('');
}

function renderPopular() {
    const pop = state.menuData.filter(i => i.popular).slice(0, 6);
    const g = document.getElementById('popularGrid');
    if (g) g.innerHTML = pop.map(renderMenuCard).join('');
}

function updateWaitTime() {
    const base = 5 + state.orders.filter(o => o.status === 'pending' || o.status === 'preparing').length * 2;
    const wait = Math.min(30, base);
    const hWait = document.getElementById('homeWaitTime');
    const sWait = document.getElementById('statWait');
    if (hWait) hWait.textContent = `${wait} mins`;
    if (sWait) sWait.textContent = `${wait}m`;
    const now = new Date();
    now.setMinutes(now.getMinutes() + wait);
    const rTime = document.getElementById('readyTime');
    if (rTime) rTime.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Menu Logic
function renderMenu() {
    renderMenuFilters();
    renderTypeFilters();
    
    const grid = document.getElementById('menuGrid');
    if (grid) {
        // Show skeleton loaders for dynamic feel
        grid.innerHTML = Array(8).fill(`
            <div class="skeleton-card">

                <div class="skeleton skeleton-line"></div>
                <div class="skeleton skeleton-line short"></div>
                <div style="margin-top:auto;display:flex;justify-content:space-between;">
                    <div class="skeleton skeleton-line xshort"></div>
                    <div class="skeleton skeleton-line xshort" style="width:30px;"></div>
                </div>
            </div>`).join('');
            
        setTimeout(() => filterMenu(), 400);
    } else {
        filterMenu();
    }
}

function renderMenuFilters() {
    const f = document.getElementById('menuFilters');
    if (f) f.innerHTML = Object.keys(CAT_MAP).map(k => `<button class="filter-btn${state.activeFilter === k ? ' active' : ''}" onclick="setFilter('${k}')">${k}</button>`).join('');
}

function renderTypeFilters() {
    const el = document.getElementById('typeFilters');
    if (!el) return;
    const opts = [
        { key: 'all',    label: '🍽️ All',      color: 'var(--accent)' },
        { key: 'veg',    label: '🟢 Veg Only', color: 'var(--success)' },
        { key: 'nonveg', label: '🔴 Non-Veg',  color: 'var(--danger)' },
    ];
    el.innerHTML = opts.map(o => {
        const isActive = state.typeFilter === o.key;
        return `<button onclick="setTypeFilter('${o.key}')" style="
            padding:7px 16px;border-radius:20px;border:1.5px solid ${isActive ? o.color : 'var(--border)'};
            background:${isActive ? o.color + '22' : 'transparent'};
            color:${isActive ? o.color : 'var(--text2)'};
            font-family:var(--font-body);font-size:0.8rem;font-weight:${isActive ? '700' : '500'};
            cursor:pointer;transition:all .2s;">${o.label}</button>`;
    }).join('');
}

function setFilter(f) {
    state.activeFilter = f;
    renderMenu();
}

function setTypeFilter(t) {
    state.typeFilter = t;
    renderTypeFilters();
    filterMenu();
}

function filterMenu() {
    const q = (document.getElementById('menuSearch')?.value || '').toLowerCase();
    const cat = CAT_MAP[state.activeFilter] || 'All';
    let items = state.menuData;
    if (cat !== 'All') items = items.filter(i => i.cat === cat);
    if (state.typeFilter === 'veg')    items = items.filter(i => i.type === 'veg');
    if (state.typeFilter === 'nonveg') items = items.filter(i => i.type === 'nonveg');
    if (q) items = items.filter(i => i.name.toLowerCase().includes(q) || i.tags?.some(t => t.includes(q)));
    const grid = document.getElementById('menuGrid');
    if (grid) grid.innerHTML = items.map(renderMenuCard).join('');
    const count = document.getElementById('menuResultCount');
    if (count) count.textContent = q ? `${items.length} result${items.length !== 1 ? 's' : ''} for "${q}"` : `${items.length} items`;
    const clearBtn = document.getElementById('searchClear');
    if (clearBtn) clearBtn.style.display = q ? 'flex' : 'none';
}

window.clearSearch = function() {
    const input = document.getElementById('menuSearch');
    if (input) { input.value = ''; filterMenu(); input.focus(); }
};



function renderMenuCard(item) {
    const cartItem = state.cart.find(c => c.id === item.id);
    const qty = cartItem ? cartItem.qty : 0;
    const badge = item.type === 'veg' ? 'badge-veg' : 'badge-nonveg';
    const badgeText = item.type === 'veg' ? '🟢 Veg' : '🔴 Non-Veg';

    const availTag = item.available
        ? '<div class="avail-tag">● Available</div>'
        : '<div class="avail-tag unavail-tag">● Unavailable</div>';
    const addCtrl = item.available ? (qty > 0
        ? `<div class="qty-ctrl"><button onclick="updateQty(${item.id},-1)">−</button><span>${qty}</span><button onclick="updateQty(${item.id},1)">+</button></div>`
        : `<button class="add-btn" onclick="addToCart(${item.id})">+</button>`)
        : `<button class="add-btn" disabled style="opacity:0.3;cursor:not-allowed;">+</button>`;
    
    return `<div class="menu-item">
      <span class="item-badge ${badge}">${badgeText}</span>
      <div class="item-content">
        ${availTag}
        <div class="item-name">${item.name}</div>
        <div class="item-cat">${item.subcat}</div>
        <div class="item-footer">
          <div class="item-price">₹${item.price} <span>/plate</span></div>
          ${addCtrl}
        </div>
      </div>
    </div>`;
}

// Cart Logic
function addToCart(id) {
    const item = state.menuData.find(i => i.id === id);
    if (!item || !item.available) return;
    const existing = state.cart.find(c => c.id === id);
    if (existing) existing.qty++;
    else state.cart.push({ ...item, qty: 1 });
    updateCartUI();
    showNotif(`${item.name} added to cart 🛒`, 'success');
}

function updateQty(id, delta) {
    const idx = state.cart.findIndex(c => c.id === id);
    if (idx === -1) return;
    state.cart[idx].qty += delta;
    if (state.cart[idx].qty <= 0) state.cart.splice(idx, 1);
    updateCartUI();
    if (document.getElementById('page-menu').classList.contains('active')) filterMenu();
    if (document.getElementById('page-home').classList.contains('active')) renderPopular();
}

function updateCartUI() {
    updateCartBadge();
    renderCartSidebar();
}

function updateCartBadge() {
    const total = state.cart.reduce((a, c) => a + c.qty, 0);
    const badge = document.getElementById('cartBadge');
    if (badge) {
        badge.textContent = total;
        // Trigger bounce animation
        badge.classList.remove('cart-badge-bounce');
        void badge.offsetWidth; // trigger reflow
        badge.classList.add('cart-badge-bounce');
    }
}

function renderCartSidebar() {
    const body = document.getElementById('cartBody');
    const footer = document.getElementById('cartFooter');
    if (state.cart.length === 0) {
        body.innerHTML = '<div class="empty-cart"><div class="icon">🍽️</div><div>Your cart is empty</div></div>';
        footer.style.display = 'none';
        return;
    }
    body.innerHTML = state.cart.map(c => `
    <div class="cart-item">
      <div class="cart-item-info">
        <div class="cart-item-name">${c.name}</div>
        <div class="cart-item-price">₹${c.price} × ${c.qty} = ₹${c.price * c.qty}</div>
      </div>
      <div class="qty-ctrl">
        <button onclick="updateQty(${c.id},-1)">−</button>
        <span>${c.qty}</span>
        <button onclick="updateQty(${c.id},1)">+</button>
      </div>
    </div>`).join('');

    const sub   = state.cart.reduce((a, c) => a + c.price * c.qty, 0);
    const tax   = Math.round(sub * 0.05);
    const total = sub + tax;

    // Estimate wait time dynamically
    const activeOrders   = state.orders.filter(o => ['pending','accepted','preparing'].includes(o.status)).length;
    const itemsInCart    = state.cart.reduce((a, c) => a + c.qty, 0);
    const queueWait      = activeOrders * 3;          // 3 min per active order
    const prepWait       = Math.min(itemsInCart * 2, 15); // 2 min per item, max 15
    const baseWait       = 5;
    const estWait        = baseWait + queueWait + prepWait;
    const readyAt        = new Date(Date.now() + estWait * 60000);
    const readyTimeStr   = readyAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const waitColor      = estWait <= 10 ? 'var(--success)' : estWait <= 20 ? 'var(--warn)' : 'var(--danger)';
    const waitEmoji      = estWait <= 10 ? '🟢' : estWait <= 20 ? '🟡' : '🔴';
    const queueLabel     = activeOrders === 0 ? 'No queue — express pickup!' : `${activeOrders} order${activeOrders > 1 ? 's' : ''} ahead of you`;

    const totalsEl = document.getElementById('cartTotals');
    if (totalsEl) {
        totalsEl.innerHTML = `
        <div class="cart-total-row"><span>Subtotal</span><span>₹${sub}</span></div>
        <div class="cart-total-row"><span>GST (5%)</span><span>₹${tax}</span></div>
        <div class="cart-total-row total"><span>Total</span><span>₹${total}</span></div>

        <div style="margin-top:14px;background:var(--bg3);border:1px solid var(--border);border-radius:12px;padding:14px;">
          <div style="font-size:0.72rem;font-weight:600;color:var(--text2);letter-spacing:0.05em;margin-bottom:10px;">⏱️ ESTIMATED WAIT TIME</div>
          <div style="display:flex;align-items:center;justify-content:space-between;">
            <div style="text-align:center;flex:1;">
              <div style="font-family:var(--font-head);font-size:1.8rem;font-weight:800;color:${waitColor};line-height:1;">${estWait}</div>
              <div style="font-size:0.68rem;color:var(--text3);margin-top:2px;">mins</div>
            </div>
            <div style="width:1px;height:36px;background:var(--border);"></div>
            <div style="text-align:center;flex:1;">
              <div style="font-family:var(--font-head);font-size:1.1rem;font-weight:700;color:var(--text);">${readyTimeStr}</div>
              <div style="font-size:0.68rem;color:var(--text3);margin-top:2px;">ready by</div>
            </div>
            <div style="width:1px;height:36px;background:var(--border);"></div>
            <div style="text-align:center;flex:1;">
              <div style="font-size:1.2rem;">${waitEmoji}</div>
              <div style="font-size:0.65rem;color:var(--text3);margin-top:2px;">${activeOrders === 0 ? 'Express' : 'Busy'}</div>
            </div>
          </div>
          <div style="margin-top:10px;font-size:0.72rem;color:var(--text3);text-align:center;border-top:1px solid var(--border);padding-top:8px;">
            ${waitEmoji} ${queueLabel}
          </div>
        </div>`;
    }
    footer.style.display = 'block';
}

function toggleCart() {
    document.getElementById('cartOverlay').classList.toggle('open');
    document.getElementById('cartSidebar').classList.toggle('open');
    renderCartSidebar();
}

function updatePickupOptions() {
    document.getElementById('scheduleTime').style.display =
        document.getElementById('pickupType').value === 'scheduled' ? 'block' : 'none';
}

// ─── Scheduling Logic ───────────────────────────────────────────────────────
function setOrderType(type) {
    state.orderType = type;
    const nowBtn  = document.getElementById('orderTypeNow');
    const schBtn  = document.getElementById('orderTypeSchedule');
    const picker  = document.getElementById('schedulePicker');
    const placeBtn = document.getElementById('placeOrderBtn');

    if (type === 'now') {
        if (nowBtn) { nowBtn.style.background = 'var(--accent)'; nowBtn.style.color = '#fff'; }
        if (schBtn) { schBtn.style.background = 'transparent'; schBtn.style.color = 'var(--text2)'; }
        if (picker)  picker.style.display = 'none';
        if (placeBtn) placeBtn.innerHTML = '⚡ Place Order →';
    } else {
        if (schBtn) { schBtn.style.background = 'var(--accent)'; schBtn.style.color = '#fff'; }
        if (nowBtn) { nowBtn.style.background = 'transparent'; nowBtn.style.color = 'var(--text2)'; }
        if (picker)  picker.style.display = 'block';
        if (placeBtn) placeBtn.innerHTML = '📅 Schedule Order →';
        updateSchedulePreview();
    }
}

function updateSchedulePreview() {
    const date = document.getElementById('scheduleDate')?.value;
    const time = document.getElementById('scheduleTime')?.value;
    const preview = document.getElementById('schedulePreview');
    if (!preview || !date || !time) return;
    const dt = new Date(`${date}T${time}`);
    const now = new Date();
    if (dt <= now) {
        preview.innerHTML = '<span style="color:var(--danger);">⚠️ Please pick a future time</span>';
        return;
    }
    const diffMs  = dt - now;
    const diffMin = Math.round(diffMs / 60000);
    const diffHr  = Math.floor(diffMin / 60);
    const remMin  = diffMin % 60;
    const fromNow = diffHr > 0 ? `${diffHr}h ${remMin}m from now` : `${diffMin} min from now`;
    preview.innerHTML = `✅ Order will be sent to kitchen at <strong>${dt.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })}</strong> on <strong>${dt.toLocaleDateString([], { weekday:'short', day:'2-digit', month:'short' })}</strong> <span style="color:var(--text3);">(${fromNow})</span>`;
}

function getScheduledTime() {
    if (state.orderType !== 'schedule') return null;
    const date = document.getElementById('scheduleDate')?.value;
    const time = document.getElementById('scheduleTime')?.value;
    if (!date || !time) return null;
    const dt = new Date(`${date}T${time}`);
    return dt > new Date() ? dt.toISOString() : null;
}

function checkScheduledOrders() {
    const now = new Date();
    let changed = false;
    state.orders.forEach(o => {
        if (o.status === 'scheduled' && o.scheduledFor && new Date(o.scheduledFor) <= now) {
            o.status = 'pending';
            changed = true;
            addNotification({ title: 'Scheduled Order Activated', message: `Order ${o.id} is now in queue for the kitchen.`, type: 'info', orderId: o.id });
            showNotif(`⏰ Scheduled order ${o.id} is now active!`, 'info');
        }
    });
    if (changed) {
        saveOrders(state.orders);
        if (document.getElementById('page-orders')?.classList.contains('active')) loadOrders_page();
    }
}

// Order Placement
function placeOrder() {
    if (!state.cart.length) { showNotif('Cart is empty', 'error'); return; }

    if (state.orderType === 'schedule') {
        const st = getScheduledTime();
        if (!st) { showNotif('Please pick a valid future time', 'error'); return; }
    }

    const method = document.getElementById('paymentMethod')?.value || 'cash';
    if (method === 'upi' || method === 'card') {
        simulateRazorpay();
    } else {
        confirmOrder();
    }
}

function simulateRazorpay() {
    const sub = state.cart.reduce((a, c) => a + c.price * c.qty, 0);
    const total = sub + Math.round(sub * 0.05);
    openModal(`
    <div style="text-align:center;margin-bottom:20px;">
      <div style="font-size:2.5rem;margin-bottom:8px;">💳</div>
      <h2 style="margin-bottom:4px;">Razorpay Payment</h2>
      <div style="color:var(--text2);font-size:0.9rem;">Secure payment gateway</div>
    </div>
    <div style="background:var(--bg3);border-radius:10px;padding:16px;margin-bottom:20px;">
      <div style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:0.88rem;"><span style="color:var(--text2)">Amount</span><strong>₹${total}</strong></div>
      <div style="display:flex;justify-content:space-between;font-size:0.88rem;"><span style="color:var(--text2)">Order ID</span><strong>ORD-${state.orderCounter}</strong></div>
    </div>
    <div class="form-group"><label>Card / UPI ID</label><input type="text" placeholder="9876543210@upi or card number" style="width:100%;background:var(--bg3);border:1px solid var(--border);color:var(--text);padding:12px;border-radius:10px;font-family:var(--font-body);"/></div>
    <button class="btn btn-green" style="width:100%;justify-content:center;font-size:1rem;" onclick="confirmOrder();closeModal();">✓ Pay ₹${total} →</button>
    <div style="text-align:center;margin-top:12px;font-size:0.75rem;color:var(--text3);">🔒 256-bit SSL encrypted · Powered by Razorpay</div>
  `);
}

async function confirmOrder() {
    const sub  = state.cart.reduce((a, c) => a + c.price * c.qty, 0);
    const tax  = Math.round(sub * 0.05);
    const total = sub + tax;
    const method = document.getElementById('paymentMethod')?.value || 'cash';
    const isScheduled = state.orderType === 'schedule';
    const scheduledFor = isScheduled ? getScheduledTime() : null;
    const wait = isScheduled ? 0 : 5 + state.orders.filter(o => ['pending','accepted','preparing'].includes(o.status)).length * 2;

    const orderPayload = {
        user:        state.user?.name || 'Student',
        userEmail:   state.user?.email || '',
        items:       [...state.cart],
        subtotal: sub, tax, total,
        paymentMethod: method,
        waitTime: wait,
        scheduledFor,
        isScheduled,
    };

    let order = await placeOrderAPI(orderPayload);
    if (!order) {
        order = {
            id: `ORD-${state.orderCounter++}`,
            billNum: `BILL-${Math.random().toString(36).substr(2,8).toUpperCase()}`,
            ...orderPayload,
            status: isScheduled ? 'scheduled' : 'pending',
            timestamp: new Date(),
            rating: null,
        };
        state.orders.unshift(order);
        saveOrders(state.orders);
    } else {
        order.timestamp = new Date(order.timestamp);
        // Backend returns 'pending' for now; override if scheduled
        if (isScheduled) order.status = 'scheduled';
        state.orders.unshift(order);
    }

    // Notify for scheduled
    if (isScheduled && scheduledFor) {
        const dt = new Date(scheduledFor);
        addNotification({ title: 'Order Scheduled 📅', message: `Order ${order.id} will be sent to kitchen at ${dt.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })}`, type: 'info', orderId: order.id });
    }

    state.cart = [];
    state.orderType = 'now'; // reset toggle
    setOrderType('now');
    if (state.user) state.user.points = (state.user.points || 0) + Math.floor(total / 10);
    if (document.getElementById('cartSidebar').classList.contains('open')) toggleCart();
    updateCartUI();
    updateWaitTime();
    showOrderConfirmation(order);
}


export function updateOrderStatus(id, status) {
    const o = state.orders.find(o => o.id === id);
    if (o) {
        o.status = status;
        saveOrders(state.orders);
        const notifMap = {
            accepted:  { title: `Order ${id} Accepted`,  message: 'Your order has been accepted by the canteen!', type: 'success' },
            preparing: { title: `Order ${id} Preparing`, message: '🍳 Your food is being prepared right now.', type: 'info' },
            ready:     { title: `Order ${id} Ready! 🔔`, message: 'Your order is ready for pickup at the counter!', type: 'success' },
            completed: { title: `Order ${id} Completed`, message: '🎉 Enjoy your meal! Thanks for using SmartDine.', type: 'info' },
            rejected:  { title: `Order ${id} Rejected`,  message: 'Your order was rejected. Please contact the counter.', type: 'error' },
        };
        const n = notifMap[status];
        if (n) {
            addNotification({ ...n, orderId: id });
            showNotif(n.message, n.type === 'error' ? 'error' : 'success');
        }
        if (document.getElementById('page-orders')?.classList.contains('active')) loadOrders_page();
        updateWaitTime();
    }
}

function showOrderConfirmation(order) {
    openModal(`
    <div style="text-align:center;margin-bottom:20px;">
      <div style="font-size:3rem;margin-bottom:8px;">✅</div>
      <h2>Order Confirmed!</h2>
    </div>
    <div style="background:var(--bg3);border-radius:12px;padding:20px;margin-bottom:16px;">
      <div style="display:flex;justify-content:space-between;margin-bottom:10px;">
        <span style="color:var(--text2);font-size:0.85rem;">Order ID</span>
        <strong style="color:var(--accent);font-family:var(--font-head);">${order.id}</strong>
      </div>
      <div style="display:flex;justify-content:space-between;margin-bottom:10px;">
        <span style="color:var(--text2);font-size:0.85rem;">Bill Number</span>
        <strong>${order.billNum}</strong>
      </div>
      <div style="display:flex;justify-content:space-between;margin-bottom:10px;">
        <span style="color:var(--text2);font-size:0.85rem;">Total Paid</span>
        <strong style="color:var(--success);">₹${order.total}</strong>
      </div>
      <div style="display:flex;justify-content:space-between;margin-bottom:10px;">
        <span style="color:var(--text2);font-size:0.85rem;">Est. Wait Time</span>
        <strong style="color:var(--accent3);">${order.waitTime} mins</strong>
      </div>
    </div>
    <div id="qrContainer" style="display:flex;justify-content:center;margin-bottom:16px;"></div>
    <button class="btn btn-outline" style="width:100%;justify-content:center;margin-top:12px;" onclick="closeModal();showPage('orders');">View Orders →</button>
  `);
    setTimeout(() => {
        const el = document.getElementById('qrContainer');
        if (el && typeof QRCode !== 'undefined') {
            new QRCode(el, { text: `VIGNAN-SMARTDINE:${order.id}:${order.billNum}`, width: 120, height: 120, colorDark: '#ff6b35', colorLight: '#1e1e2e' });
        }
    }, 100);
}

// Orders Page
export function loadOrders_page() {
    const activeEl    = document.getElementById('ordersActive');
    const historyEl   = document.getElementById('ordersHistory');
    // Filter so students only see their own orders
    let myOrders = state.orders;
    if (state.user && state.user.role !== 'admin') {
        myOrders = state.orders.filter(o => o.userEmail === state.user.email);
    }

    const scheduled   = myOrders.filter(o => o.status === 'scheduled');
    const active      = myOrders.filter(o => !['completed','rejected','scheduled'].includes(o.status));
    const history     = myOrders.filter(o => ['completed','rejected'].includes(o.status));

    if (activeEl) {
        const allActive = [...scheduled, ...active];
        if (allActive.length === 0) {
            activeEl.innerHTML = '<div style="text-align:center;padding:60px;color:var(--text3);"><div style="font-size:3rem;margin-bottom:12px;">📭</div><div>No active orders</div><button class="btn btn-primary" style="margin-top:16px;" onclick="showPage(\'menu\')">Order Now →</button></div>';
        } else {
            activeEl.innerHTML = allActive.map(renderOrderCard).join('');
        }
    }
    if (historyEl) {
        historyEl.innerHTML = history.length ? history.map(renderOrderCard).join('') : '<div style="text-align:center;padding:60px;color:var(--text3);"><div style="font-size:3rem;margin-bottom:12px;">📜</div><div>No past orders</div></div>';
    }
    updateWaitTime();
}

function renderOrderCard(order) {
    // Scheduled orders get special card
    if (order.status === 'scheduled') {
        const sf = new Date(order.scheduledFor);
        const now = new Date();
        const diffMs  = sf - now;
        const diffMin = Math.max(0, Math.round(diffMs / 60000));
        const diffHr  = Math.floor(diffMin / 60);
        const remMin  = diffMin % 60;
        const countdown = diffHr > 0 ? `${diffHr}h ${remMin}m` : `${diffMin} min`;
        const itemList = order.items.map(i => `${i.name} ×${i.qty}`).join(', ');
        const ts = order.timestamp instanceof Date ? order.timestamp : new Date(order.timestamp);
        return `<div class="order-card" style="border-left:4px solid var(--purple);">
        <div class="order-header">
          <div>
            <div class="order-id">${order.id}</div>
            <div style="font-size:0.75rem;color:var(--text3);margin-top:2px;">Placed ${ts.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</div>
          </div>
          <span class="status-badge" style="background:rgba(124,58,237,0.15);color:var(--purple);">📅 Scheduled</span>
        </div>
        <div class="order-items">${itemList}</div>
        <div style="background:rgba(124,58,237,0.08);border:1px solid rgba(124,58,237,0.2);border-radius:10px;padding:12px;margin:10px 0;">
          <div style="font-size:0.78rem;color:var(--text2);margin-bottom:4px;">🕐 Sending to kitchen at:</div>
          <div style="font-family:var(--font-head);font-weight:700;color:var(--purple);">${sf.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})} · ${sf.toLocaleDateString([],{weekday:'short',day:'2-digit',month:'short'})}</div>
          <div style="font-size:0.75rem;color:var(--text3);margin-top:4px;">⏳ Activates in <strong style="color:var(--purple);">${countdown}</strong></div>
        </div>
        <div class="order-footer">
          <div style="font-size:0.85rem;color:var(--text2);">₹${order.total} · ${order.paymentMethod}</div>
        </div>
      </div>`;
    }

    const statusClass = { pending:'status-pending', accepted:'status-accepted', preparing:'status-preparing', ready:'status-ready', completed:'status-completed', rejected:'status-completed' };
    const statusText  = { pending:'⏳ Pending', accepted:'✅ Accepted', preparing:'🍳 Preparing', ready:'🔔 Ready!', completed:'✔ Completed', rejected:'✗ Rejected' };
    const steps = ['pending','accepted','preparing','ready','completed'];
    const step = steps.indexOf(order.status);
    const itemList = order.items.map(i => `${i.name} ×${i.qty}`).join(', ');
    const ts = order.timestamp instanceof Date ? order.timestamp : new Date(order.timestamp);
    const timeStr = ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const dateStr = ts.toLocaleDateString([], { day:'2-digit', month:'short' });
    return `<div class="order-card">
    <div class="order-header">
      <div>
        <div class="order-id">${order.id}</div>
        <div style="font-size:0.75rem;color:var(--text3);margin-top:2px;">${order.billNum} · 🗓️ ${dateStr} · ⏰ ${timeStr}</div>
      </div>
      <span class="status-badge ${statusClass[order.status] || 'status-pending'}">${statusText[order.status] || order.status}</span>
    </div>
    <div class="order-items">${itemList}</div>
    <div style="margin:14px 0;">
      <div style="display:flex;gap:0;margin-bottom:6px;">
        ${steps.map((s, i) => `<div style="flex:1;height:4px;background:${i <= step ? 'var(--accent3)' : 'var(--bg3)'};border-radius:${i === 0 ? '4px 0 0 4px' : i === 4 ? '0 4px 4px 0' : '0'};transition:background .5s;"></div>`).join('')}
      </div>
      <div style="display:flex;justify-content:space-between;font-size:0.7rem;color:var(--text3);">
        <span>Placed</span><span>Accepted</span><span>Preparing</span><span>Ready</span><span>Done</span>
      </div>
    </div>
    <div class="order-footer">
      <div style="font-size:0.85rem;color:var(--text2);">₹${order.total} · ${order.paymentMethod}</div>
      <div style="display:flex;gap:8px;">
        ${order.status === 'ready' ? `<button class="btn btn-green btn-sm" onclick="markCompleted('${order.id}')">📦 Received</button>` : ''}
        <button class="btn btn-outline btn-sm" onclick="showQR('${order.id}')">QR</button>
      </div>
    </div>
    ${order.status === 'completed' && !order.rating ? `<div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border);">
      <div style="font-size:0.82rem;color:var(--text2);margin-bottom:8px;">Rate your order:</div>
      <div style="display:flex;gap:4px;">${[1,2,3,4,5].map(s => `<span style="font-size:1.3rem;cursor:pointer;" onclick="rateOrder('${order.id}',${s})">★</span>`).join('')}</div>
    </div>` : ''}
  </div>`;
}

function markCompleted(id) {
    const o = state.orders.find(o => o.id === id);
    if (o) { o.status = 'completed'; saveOrders(state.orders); loadOrders_page(); showNotif('Enjoy your meal! 🍽️', 'success'); }
}

function rateOrder(id, rating) {
    const o = state.orders.find(o => o.id === id);
    if (o) { o.rating = rating; saveOrders(state.orders); loadOrders_page(); showNotif(`Rated ${rating}/5 ⭐ Thank you!`, 'success'); }
}

function showQR(id) {
    const order = state.orders.find(o => o.id === id);
    if (!order) return;
    openModal(`
    <h2>QR Pickup Code</h2>
    <div style="text-align:center;padding:20px;">
      <div id="qrSingle" style="display:flex;justify-content:center;margin-bottom:16px;"></div>
      <div style="font-family:var(--font-head);font-size:1.4rem;font-weight:700;color:var(--accent);">${order.id}</div>
      <div style="color:var(--text2);font-size:0.85rem;margin-top:4px;">Show this at the counter to collect your order</div>
    </div>
  `);
    setTimeout(() => {
        const el = document.getElementById('qrSingle');
        if (el && typeof QRCode !== 'undefined') {
            new QRCode(el, { text: order.id + ':' + order.billNum, width: 160, height: 160, colorDark: '#ff6b35', colorLight: '#1e1e2e' });
        }
    }, 100);
}

function switchOrderTab(tab, el) {
    document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
    if (el) el.classList.add('active');
    const activeEl = document.getElementById('ordersActive');
    const histEl = document.getElementById('ordersHistory');
    if (activeEl) activeEl.classList.toggle('hidden', tab !== 'active');
    if (histEl) histEl.classList.toggle('hidden', tab !== 'history');
}

function createGroupOrder() {
    const name = document.getElementById('groupName').value;
    if (!name) { showNotif('Enter group name', 'error'); return; }
    showNotif(`Group "${name}" created!`, 'success');
}

// Profile Page
function updateProfile() {
    if (!state.user) return;
    const u = state.user;
    const avatar = document.getElementById('profileAvatar');
    if (avatar) avatar.textContent = u.name[0].toUpperCase();
    document.getElementById('profileName').textContent = u.name;
    document.getElementById('profileEmail').textContent = u.email;
    const details = document.getElementById('profileDetails');
    if (details) details.textContent = `${u.roll || ''} · ${u.year || ''} · ${u.branch || ''}`;
    document.getElementById('profileOrders').textContent = state.orders.length;
    document.getElementById('profileSpent').textContent = '₹' + state.orders.reduce((a, o) => a + o.total, 0);
    document.getElementById('profilePoints').textContent = (u.points || 0) + ' pts';
}

// UI Helpers
export function showNotif(msg, type = 'info') {
    const stack = document.getElementById('notifStack');
    const el = document.createElement('div');
    el.className = `notif ${type}`;
    el.textContent = msg;
    stack.appendChild(el);
    setTimeout(() => el.classList.add('show'), 50);
    setTimeout(() => {
        el.classList.remove('show');
        setTimeout(() => el.remove(), 400);
    }, 3000);
}

export function openModal(html) {
    const body = document.getElementById('modalBody');
    if (body) body.innerHTML = html;
    document.getElementById('modalOverlay').classList.add('open');
}

export function closeModal() {
    document.getElementById('modalOverlay').classList.remove('open');
}

window.closeModalOutside = function(e) {
    if (e.target === document.getElementById('modalOverlay')) closeModal();
};

// ─── Notification Panel ─────────────────────────────────────────────────────
function toggleNotifPanel() {
    const panel = document.getElementById('notifPanel');
    if (!panel) return;
    const isOpen = !panel.classList.contains('hidden');
    if (isOpen) {
        panel.classList.add('hidden');
    } else {
        // Render latest notifications
        document.getElementById('notifPanelBody').innerHTML = renderNotifDropdown();
        panel.classList.remove('hidden');
    }
}

function clearNotifs() {
    markAllRead();
    document.getElementById('notifPanelBody').innerHTML = renderNotifDropdown();
    const badge = document.getElementById('notifBadge');
    if (badge) badge.style.display = 'none';
}

// Close notification panel when clicking outside
document.addEventListener('click', (e) => {
    const panel = document.getElementById('notifPanel');
    const bell  = document.getElementById('notifBellBtn');
    if (panel && bell && !panel.contains(e.target) && !bell.contains(e.target)) {
        panel.classList.add('hidden');
    }
});

// ─── AI CHATBOT LOGIC (RAG Simulation) ──────────────────────────────────────
window.toggleChat = () => {
    const win = document.getElementById('chatWindow');
    win.classList.toggle('hidden');
    if (!win.classList.contains('hidden')) {
        document.getElementById('chatInput').focus();
    }
};

window.handleChatKey = (e) => {
    if (e.key === 'Enter') sendChatMessage();
};

window.sendChatMessage = async () => {
    const input = document.getElementById('chatInput');
    const text = input.value.trim();
    if (!text) return;

    addMsg(text, 'user');
    input.value = '';

    // Show typing indicator
    const typingId = 'typing-' + Date.now();
    const body = document.getElementById('chatBody');
    const typingDiv = document.createElement('div');
    typingDiv.id = typingId;
    typingDiv.className = 'msg bot-msg';
    typingDiv.innerHTML = '<span class="typing-dot">.</span><span class="typing-dot">.</span><span class="typing-dot">.</span>';
    body.appendChild(typingDiv);
    body.scrollTop = body.scrollHeight;

    // Simulate AI Processing (RAG)
    setTimeout(() => {
        typingDiv.remove();
        processBotResponse(text.toLowerCase());
    }, 1000);
};

function addMsg(text, side) {
    const body = document.getElementById('chatBody');
    const div = document.createElement('div');
    div.className = `msg ${side}-msg`;
    div.innerHTML = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    body.appendChild(div);
    body.scrollTop = body.scrollHeight;
}


function processBotResponse(query) {
    let reply = "";
    let recs = [];

    const greetings = ["Hi there! How can I help you eat well today?", "Hello! Hungry? I can suggest some great dishes.", "Namaste! Looking for something special at Vignan Canteen?"];
    const popularIntro = ["Our top-rated items according to student feedback are:", "Students are loving these right now:", "Based on recent orders, these are the most popular:"];

    if (query.includes('popular') || query.includes('recommend') || query.includes('best') || query.includes('top')) {
        recs = state.menuData.filter(i => i.popular).slice(0, 3);
        reply = popularIntro[Math.floor(Math.random() * popularIntro.length)];
    } else if (query.includes('veg') && !query.includes('non')) {
        recs = state.menuData.filter(i => i.type === 'veg' && i.popular).slice(0, 3);
        reply = "Here are some top-rated vegetarian options for you:";
    } else if (query.includes('nonveg') || query.includes('chicken') || query.includes('biryani') || query.includes('egg')) {
        recs = state.menuData.filter(i => (i.type === 'nonveg' || i.name.toLowerCase().includes('egg')) && i.popular).slice(0, 3);
        reply = "Craving something hearty? These are our best-selling non-veg dishes:";
    } else if (query.includes('breakfast') || query.includes('morning') || query.includes('idly') || query.includes('dosa')) {
        recs = state.menuData.filter(i => i.cat === 'Breakfast').slice(0, 3);
        reply = "Starting your day? Here's what's hot for breakfast:";
    } else if (query.includes('drink') || query.includes('juice') || query.includes('shake') || query.includes('coffee') || query.includes('tea')) {
        recs = state.menuData.filter(i => i.cat === 'Beverages').slice(0, 3);
        reply = "Thirsty? Our most refreshing drinks are:";
    } else if (query.includes('hi') || query.includes('hello') || query.includes('hey')) {
        reply = greetings[Math.floor(Math.random() * greetings.length)];
    } else if (query.includes('thank')) {
        reply = "You're very welcome! Enjoy your meal at SmartDine. 😊";
    } else {
        // Advanced RAG: Search across names and categories
        recs = state.menuData.filter(i => {
            const keywords = query.split(' ').filter(w => w.length > 2);
            return keywords.some(k => i.name.toLowerCase().includes(k) || i.cat.toLowerCase().includes(k));
        }).slice(0, 3);

        if (recs.length > 0) {
            reply = "I found some items that might interest you:";
        } else {
            reply = "I'm still learning! I couldn't find exactly that, but here are some general student favorites:";
            recs = state.menuData.filter(i => i.popular).sort(() => 0.5 - Math.random()).slice(0, 2);
        }
    }

    addMsg(reply, 'bot');
    
    if (recs.length > 0) {
        const body = document.getElementById('chatBody');
        recs.forEach(i => {
            const card = document.createElement('div');
            card.className = 'chat-rec-card';
            card.innerHTML = `
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <div>
                        <div class="chat-rec-name">${i.name}</div>
                        <div class="chat-rec-price">₹${i.price}</div>
                    </div>
                    <button class="btn btn-primary btn-sm" onclick="addToCart(${i.id})">+</button>
                </div>
            `;
            body.appendChild(card);
        });
        body.scrollTop = body.scrollHeight;
    }
}

window.clearChat = () => {
    const body = document.getElementById('chatBody');
    body.innerHTML = `<div class="msg bot-msg">👋 Chat history cleared. <br><br>I'm ready for new questions! What are you looking for today?</div>`;
};
