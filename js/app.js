import { MENU_DATA } from './menuData.js';
import * as auth from './auth.js';
import * as admin from './admin.js';

export let state = {
    user: null,
    cart: [],
    orders: [],
    activeFilter: 'All',
    menuData: MENU_DATA.map(i => ({ ...i })),
    orderCounter: 1001,
};

// Global Exposure for HTML onclick events
window.showPage = showPage;
window.toggleCart = toggleCart;
window.switchAuthTab = auth.switchAuthTab;
window.doLogin = doLogin;
window.doRegister = doRegister;
window.logout = logout;
window.addToCart = addToCart;
window.updateQty = updateQty;
window.placeOrder = placeOrder;
window.confirmOrder = confirmOrder;
window.closeModal = closeModal;
window.setFilter = setFilter;
window.showAdminSection = admin.showAdminSection;

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    initHome();
});

export function showPage(pg) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const target = document.getElementById('page-' + pg);
    if (target) target.classList.add('active');

    document.querySelectorAll('#mainNav .nav-btn').forEach(b => {
        b.classList.toggle('active', b.getAttribute('onclick')?.includes(`'${pg}'`));
    });

    if (pg === 'menu') renderMenu();
    if (pg === 'orders') renderOrders();
    if (pg === 'profile') updateProfile();
    if (pg === 'admin') admin.initAdmin();
}

function doLogin() {
    const user = auth.handleLogin();
    if (user) {
        state.user = user;
        if (user.role === 'admin') enterAdmin();
        else enterStudent();
    }
}

function doRegister() {
    const user = auth.handleRegister();
    if (user) {
        state.user = user;
        showNotif('Account created! Welcome 🎉', 'success');
        enterStudent();
    }
}

function enterStudent() {
    document.getElementById('page-auth').classList.remove('active');
    document.getElementById('mainNav').classList.remove('hidden');
    document.getElementById('adminNav').classList.add('hidden');
    showPage('home');
    initHome();
}

function enterAdmin() {
    document.getElementById('page-auth').classList.remove('active');
    document.getElementById('adminNav').classList.remove('hidden');
    document.getElementById('mainNav').classList.add('hidden');
    showPage('admin');
}

function logout() {
    state.user = null;
    state.cart = [];
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('mainNav').classList.add('hidden');
    document.getElementById('adminNav').classList.add('hidden');
    document.getElementById('page-auth').classList.add('active');
    updateCartBadge();
}

// Menu Logic
function renderMenu() {
    const grid = document.getElementById('menuGrid');
    const items = state.activeFilter === 'All' 
        ? state.menuData 
        : state.menuData.filter(i => i.cat === state.activeFilter);
    
    grid.innerHTML = items.map(renderMenuCard).join('');
    renderMenuFilters();
}

function renderMenuFilters() {
    const filters = ['All', 'Breakfast', 'Starters', 'FastFood', 'MainCourse', 'Curries', 'Beverages'];
    const el = document.getElementById('menuFilters');
    el.innerHTML = filters.map(f => `
        <button class="filter-btn ${state.activeFilter === f ? 'active' : ''}" onclick="setFilter('${f}')">${f}</button>
    `).join('');
}

function setFilter(f) {
    state.activeFilter = f;
    renderMenu();
}

function renderMenuCard(item) {
    const inCart = state.cart.find(c => c.id === item.id);
    const qty = inCart ? inCart.qty : 0;
    return `
    <div class="menu-item">
      <span class="item-badge ${item.type === 'veg' ? 'badge-veg' : 'badge-nonveg'}">${item.type.toUpperCase()}</span>
      <img src="${item.image}" class="item-img" alt="${item.name}">
      <div class="item-content">
        <div class="item-name">${item.name}</div>
        <div class="item-cat">${item.subcat}</div>
        <div class="item-footer">
          <div class="item-price">₹${item.price}</div>
          ${qty > 0 
            ? `<div class="qty-ctrl"><button onclick="updateQty(${item.id},-1)">-</button><span>${qty}</span><button onclick="updateQty(${item.id},1)">+</button></div>`
            : `<button class="add-btn" onclick="addToCart(${item.id})">+</button>`}
        </div>
      </div>
    </div>`;
}

// Cart Logic
function addToCart(id) {
    const item = state.menuData.find(i => i.id === id);
    const existing = state.cart.find(c => c.id === id);
    if (existing) existing.qty++;
    else state.cart.push({ ...item, qty: 1 });
    updateCartUI();
}

function updateQty(id, delta) {
    const idx = state.cart.findIndex(c => c.id === id);
    if (idx === -1) return;
    state.cart[idx].qty += delta;
    if (state.cart[idx].qty <= 0) state.cart.splice(idx, 1);
    updateCartUI();
    if (document.getElementById('page-menu').classList.contains('active')) renderMenu();
}

function updateCartUI() {
    updateCartBadge();
    renderCartSidebar();
}

function updateCartBadge() {
    const total = state.cart.reduce((a, c) => a + c.qty, 0);
    document.getElementById('cartBadge').textContent = total;
}

function renderCartSidebar() {
    const body = document.getElementById('cartBody');
    const footer = document.getElementById('cartFooter');
    if (state.cart.length === 0) {
        body.innerHTML = '<div class="empty-cart">Your cart is empty</div>';
        footer.style.display = 'none';
        return;
    }
    body.innerHTML = state.cart.map(c => `
        <div class="cart-item">
            <div class="cart-item-info">
                <div class="cart-item-name">${c.name}</div>
                <div class="cart-item-price">₹${c.price} x ${c.qty}</div>
            </div>
            <div class="qty-ctrl">
                <button onclick="updateQty(${c.id},-1)">-</button>
                <span>${c.qty}</span>
                <button onclick="updateQty(${c.id},1)">+</button>
            </div>
        </div>
    `).join('');
    footer.style.display = 'block';
    const sub = state.cart.reduce((a, c) => a + c.price * c.qty, 0);
    document.getElementById('cartTotals').innerHTML = `
        <div class="cart-total-row total"><span>Total</span><span>₹${sub}</span></div>
    `;
}

function toggleCart() {
    document.getElementById('cartOverlay').classList.toggle('open');
    document.getElementById('cartSidebar').classList.toggle('open');
}

function placeOrder() {
    if (!state.cart.length) return;
    confirmOrder();
}

function confirmOrder() {
    const order = {
        id: `ORD-${state.orderCounter++}`,
        items: [...state.cart],
        total: state.cart.reduce((a, c) => a + c.price * c.qty, 0),
        status: 'pending',
        timestamp: new Date()
    };
    state.orders.unshift(order);
    state.cart = [];
    updateCartUI();
    toggleCart();
    showNotif('Order placed successfully! ✅', 'success');
    showPage('orders');
}

// Home Logic
function initHome() {
    const heatmap = document.getElementById('heatmap');
    if (heatmap) {
        const hours = ['8a', '9a', '10a', '11a', '12p', '1p', '2p', '3p', '4p', '5p', '6p', '7p'];
        const levels = ['heat-low', 'heat-low', 'heat-med', 'heat-high', 'heat-high', 'heat-high', 'heat-med', 'heat-low', 'heat-low', 'heat-low', 'heat-low', 'heat-low'];
        heatmap.innerHTML = hours.map((h, i) => `<div class="heat-cell ${levels[i]}">${h}</div>`).join('');
    }
}

function renderOrders() {
    const el = document.getElementById('ordersActive');
    if (state.orders.length === 0) {
        el.innerHTML = '<div style="text-align:center; padding:40px; color:var(--text3);">No orders yet.</div>';
        return;
    }
    el.innerHTML = state.orders.map(o => `
        <div class="card" style="margin-bottom:16px;">
            <div style="display:flex; justify-content:space-between;">
                <strong>${o.id}</strong>
                <span class="pill pill-orange">${o.status}</span>
            </div>
            <div style="margin-top:12px; color:var(--text2); font-size:0.9rem;">
                ${o.items.map(i => `${i.name} x${i.qty}`).join(', ')}
            </div>
            <div style="margin-top:12px; font-weight:700;">Total: ₹${o.total}</div>
        </div>
    `).join('');
}

function updateProfile() {
    if (!state.user) return;
    document.getElementById('profileName').textContent = state.user.name;
    document.getElementById('profileEmail').textContent = state.user.email;
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
    document.getElementById('modalBody').innerHTML = html;
    document.getElementById('modalOverlay').classList.add('open');
}

export function closeModal() {
    document.getElementById('modalOverlay').classList.remove('open');
}
