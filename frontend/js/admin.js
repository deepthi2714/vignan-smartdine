import { state, showNotif, openModal, closeModal } from './app.js';

let adminRefreshTimer = null;

export function initAdmin() {
    showAdminSection('orders', null);
    // Auto-refresh live orders every 5 seconds
    clearInterval(adminRefreshTimer);
    adminRefreshTimer = setInterval(() => {
        const el = document.getElementById('admin-orders');
        if (el && !el.classList.contains('hidden')) renderAdminOrders();
    }, 5000);
}

export function showAdminSection(sec, el) {
    document.querySelectorAll('[id^="admin-"]').forEach(d => d.classList.add('hidden'));
    document.querySelectorAll('.admin-nav-item').forEach(n => n.classList.remove('active'));
    if (el) el.classList.add('active');
    const target = document.getElementById('admin-' + sec);
    if (target) target.classList.remove('hidden');

    const renders = {
        dashboard: renderAdminDashboard,
        orders: renderAdminOrders,
        menu: renderAdminMenu,
        payments: renderAdminPayments,
        analytics: renderAdminAnalytics,
    };
    if (renders[sec]) renders[sec]();
}

// ── Helper: compute real stats from state.orders ──────────────────────────
function getOrderStats() {
    const orders = state.orders;
    const revenue = orders.reduce((a, o) => a + (o.total || 0), 0);
    const active  = orders.filter(o => !['completed','rejected'].includes(o.status)).length;
    const completed = orders.filter(o => o.status === 'completed').length;
    const avgOrder = orders.length ? Math.round(revenue / orders.length) : 0;

    // Peak hours: bucket orders into 0-23 hour slots
    const hourBuckets = Array(24).fill(0);
    orders.forEach(o => {
        const h = new Date(o.timestamp).getHours();
        if (!isNaN(h)) hourBuckets[h]++;
    });

    // Most ordered items
    const itemCounts = {};
    orders.forEach(o => o.items?.forEach(i => {
        itemCounts[i.name] = (itemCounts[i.name] || 0) + (i.qty || 1);
    }));
    const topItems = Object.entries(itemCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, count]) => ({ name, count }));

    // Category breakdown from orders
    const catCounts = {};
    orders.forEach(o => o.items?.forEach(i => {
        const item = state.menuData.find(m => m.name === i.name);
        const cat = item?.cat || 'Other';
        catCounts[cat] = (catCounts[cat] || 0) + (i.qty || 1);
    }));

    return { orders, revenue, active, completed, avgOrder, hourBuckets, topItems, catCounts };
}

function renderAdminDashboard() {
    const el = document.getElementById('admin-dashboard');
    if (!el) return;
    const { orders, revenue, active, completed, avgOrder, topItems } = getOrderStats();
    const pending = orders.filter(o => o.status === 'pending').length;
    const maxItem = topItems[0]?.count || 1;

    el.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;flex-wrap:wrap;gap:12px;">
      <div>
        <div style="font-family:var(--font-head);font-size:1.6rem;font-weight:800;">📊 Dashboard</div>
        <div style="color:var(--text2);font-size:0.85rem;margin-top:4px;">Live stats · updated from real orders <span class="live-dot" style="margin-left:6px;"></span></div>
      </div>
      <div style="font-size:0.8rem;color:var(--text3);">Last refreshed: ${new Date().toLocaleTimeString()}</div>
    </div>

    <div class="admin-stats" style="grid-template-columns:repeat(4,1fr);">
      <div class="admin-stat"><div class="num" id="stat-total" style="color:var(--accent);">0</div><div class="lbl">Total Orders</div></div>
      <div class="admin-stat"><div class="num" id="stat-rev" style="color:var(--success);">₹0</div><div class="lbl">Revenue</div></div>
      <div class="admin-stat"><div class="num" id="stat-active" style="color:var(--blue);">0</div><div class="lbl">Active Orders</div></div>
      <div class="admin-stat"><div class="num" id="stat-pending" style="color:var(--warn);">0</div><div class="lbl">Awaiting Accept</div></div>
      <div class="admin-stat"><div class="num" id="stat-comp" style="color:var(--accent3);">0</div><div class="lbl">Completed</div></div>
      <div class="admin-stat"><div class="num" id="stat-avg" style="color:var(--purple);">₹0</div><div class="lbl">Avg Order Value</div></div>
      <div class="admin-stat"><div class="num" id="stat-avail" style="color:var(--success);">0</div><div class="lbl">Available Items</div></div>
      <div class="admin-stat"><div class="num" id="stat-unavail" style="color:var(--text2);">0</div><div class="lbl">Unavailable Items</div></div>
    </div>

    <div class="two-col" style="margin-bottom:20px;">
      <div class="chart-wrap">
        <div style="font-weight:600;margin-bottom:12px;">⏰ Peak Hours (from real orders)</div>
        <canvas id="peakHourChart" height="200"></canvas>
      </div>
      <div class="chart-wrap">
        <div style="font-weight:600;margin-bottom:12px;">🍽️ Category Breakdown</div>
        <canvas id="catBreakChart" height="200"></canvas>
      </div>
    </div>

    <div class="card">
      <div style="font-family:var(--font-head);font-weight:700;margin-bottom:16px;">🔥 Most Ordered Items (from real orders)</div>
      ${topItems.length === 0 ? '<div style="color:var(--text3);text-align:center;padding:20px;">No orders yet — place some orders to see data here</div>' : `
      <div style="display:grid;gap:12px;">
        ${topItems.map((item, idx) => `
        <div style="display:flex;align-items:center;gap:12px;">
          <span style="font-family:var(--font-head);font-weight:800;font-size:1.1rem;color:${idx===0?'var(--accent)':idx===1?'var(--warn)':'var(--text3)'}; min-width:28px;">#${idx+1}</span>
          <div style="flex:1;">
            <div style="font-size:0.9rem;font-weight:500;margin-bottom:4px;">${item.name}</div>
            <div class="progress-bar"><div class="progress-fill" style="width:${Math.round(item.count/maxItem*100)}%;"></div></div>
          </div>
          <span style="font-family:var(--font-head);font-weight:700;color:var(--accent);min-width:60px;text-align:right;">${item.count} qty</span>
        </div>`).join('')}
      </div>`}
    </div>`;

    if (window.animateValue) {
        window.animateValue('stat-total', 0, orders.length, 1000);
        window.animateValue('stat-rev', 0, revenue, 1000, '₹');
        window.animateValue('stat-active', 0, active, 1000);
        window.animateValue('stat-pending', 0, pending, 1000);
        window.animateValue('stat-comp', 0, completed, 1000);
        window.animateValue('stat-avg', 0, avgOrder, 1000, '₹');
        window.animateValue('stat-avail', 0, state.menuData.filter(i => i.available).length, 1000);
        window.animateValue('stat-unavail', 0, state.menuData.filter(i => !i.available).length, 1000);
    }

    setTimeout(() => initDashboardCharts(), 100);
}

function initDashboardCharts() {
    const { hourBuckets, catCounts } = getOrderStats();

    // Peak hours chart — real data, canteen hours 7am-10pm
    const hours = ['7am','8am','9am','10am','11am','12pm','1pm','2pm','3pm','4pm','5pm','6pm','7pm','8pm','9pm'];
    const hourData = hours.map((_, i) => hourBuckets[i + 7] || 0);
    const maxHour = Math.max(...hourData);
    const barColors = hourData.map(v => {
        if (v === maxHour && maxHour > 0) return '#ef4444';
        if (v >= maxHour * 0.7) return '#f59e0b';
        return 'rgba(255,107,53,0.6)';
    });

    const ctx1 = document.getElementById('peakHourChart');
    if (ctx1) {
        // Destroy any existing chart
        Chart.getChart(ctx1)?.destroy();
        new Chart(ctx1, {
            type: 'bar',
            data: { labels: hours, datasets: [{ label: 'Orders', data: hourData, backgroundColor: barColors, borderRadius: 6 }] },
            options: { responsive: true, plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ` ${ctx.parsed.y} orders` } } }, scales: { x: { ticks: { color: '#606080' }, grid: { display: false } }, y: { ticks: { color: '#606080', stepSize: 1 }, grid: { color: '#2a2a3d' } } } }
        });
    }

    // Category breakdown — real data
    const catLabels = Object.keys(catCounts);
    const catData   = Object.values(catCounts);
    const ctx2 = document.getElementById('catBreakChart');
    if (ctx2) {
        Chart.getChart(ctx2)?.destroy();
        if (catLabels.length > 0) {
            new Chart(ctx2, {
                type: 'doughnut',
                data: { labels: catLabels, datasets: [{ data: catData, backgroundColor: ['#ff6b35','#7c3aed','#3b82f6','#00d4aa','#f59e0b','#ef4444','#22c55e'] }] },
                options: { responsive: true, plugins: { legend: { position: 'bottom', labels: { color: '#a0a0c0' } } } }
            });
        } else {
            ctx2.parentElement.innerHTML += '<div style="text-align:center;color:var(--text3);padding:20px;">No order data yet</div>';
        }
    }
}

function renderAdminOrders() {
    const el = document.getElementById('admin-orders');
    if (!el) return;
    const scheduled = state.orders.filter(o => o.status === 'scheduled');
    const pending   = state.orders.filter(o => o.status === 'pending');
    const active    = state.orders.filter(o => ['accepted','preparing','ready'].includes(o.status));
    const done      = state.orders.filter(o => ['completed','rejected'].includes(o.status));

    el.innerHTML = `
    <div style="font-family:var(--font-head);font-size:1.4rem;font-weight:800;margin-bottom:20px;">📦 Live Orders
      <span style="font-size:0.85rem;font-weight:400;color:var(--text2);margin-left:12px;">${pending.length} new · ${active.length} in progress · ${scheduled.length} scheduled</span>
    </div>

    ${scheduled.length ? `
    <div style="margin-bottom:24px;">
      <div style="font-weight:700;color:var(--purple);margin-bottom:12px;font-size:0.9rem;">📅 SCHEDULED — Upcoming Orders (${scheduled.length})</div>
      ${scheduled.map(o => renderAdminOrderCard(o)).join('')}
    </div>` : ''}

    ${pending.length ? `
    <div style="margin-bottom:24px;">
      <div style="font-weight:700;color:var(--warn);margin-bottom:12px;font-size:0.9rem;">🔴 NEW ORDERS — Awaiting Acceptance</div>
      ${pending.map(o => renderAdminOrderCard(o)).join('')}
    </div>` : ''}

    ${active.length ? `
    <div style="margin-bottom:24px;">
      <div style="font-weight:700;color:var(--blue);margin-bottom:12px;font-size:0.9rem;">🍳 IN PROGRESS</div>
      ${active.map(o => renderAdminOrderCard(o)).join('')}
    </div>` : ''}

    ${done.length ? `
    <div>
      <div style="font-weight:700;color:var(--text3);margin-bottom:12px;font-size:0.9rem;">✅ COMPLETED TODAY (${done.length})</div>
      ${done.slice(0,5).map(o => renderAdminOrderCard(o)).join('')}
    </div>` : ''}

    ${!state.orders.length ? '<div style="text-align:center;padding:60px;color:var(--text3);"><div style="font-size:3rem;">📭</div><div style="margin-top:12px;">No orders yet</div></div>' : ''}
    `;
}

function renderAdminOrderCard(o) {
    const ts = new Date(o.timestamp);
    const timeStr = ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const dateStr = ts.toLocaleDateString([], { day: '2-digit', month: 'short' });
    const itemList = o.items.map(i => `${i.name} ×${i.qty}`).join(', ');

    const statusColors = {
        scheduled:'var(--purple)', pending:'var(--warn)', accepted:'var(--blue)',
        preparing:'var(--accent)', ready:'var(--success)', completed:'var(--text3)', rejected:'var(--danger)'
    };
    const statusLabels = {
        scheduled:'📅 Scheduled', pending:'⏳ New', accepted:'✅ Accepted',
        preparing:'🍳 Preparing', ready:'🔔 Ready', completed:'✔ Done', rejected:'✗ Rejected'
    };

    // Scheduled time banner (only for scheduled orders)
    const scheduledBanner = (o.status === 'scheduled' && o.scheduledFor) ? (() => {
        const sf = new Date(o.scheduledFor);
        const now = new Date();
        const diffMin = Math.max(0, Math.round((sf - now) / 60000));
        const diffHr  = Math.floor(diffMin / 60);
        const remMin  = diffMin % 60;
        const countdown = diffHr > 0 ? `${diffHr}h ${remMin}m` : `${diffMin} min`;
        return `<div style="background:rgba(124,58,237,0.1);border:1px solid rgba(124,58,237,0.25);border-radius:8px;padding:10px 12px;margin-bottom:10px;">
            <div style="font-size:0.75rem;color:var(--text2);margin-bottom:2px;">📅 Scheduled pickup time:</div>
            <div style="font-family:var(--font-head);font-weight:700;color:var(--purple);font-size:0.95rem;">
                ${sf.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})} &nbsp;·&nbsp; ${sf.toLocaleDateString([],{weekday:'short',day:'2-digit',month:'short'})}
            </div>
            <div style="font-size:0.72rem;color:var(--text3);margin-top:2px;">⏳ Activates in <strong style="color:var(--purple);">${countdown}</strong></div>
        </div>`;
    })() : '';

    // Scheduled time note on non-scheduled orders that were originally scheduled
    const scheduledNote = (o.status !== 'scheduled' && o.scheduledFor) ? (() => {
        const sf = new Date(o.scheduledFor);
        return `<span style="font-size:0.72rem;color:var(--purple);margin-left:8px;">📅 Scheduled for ${sf.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</span>`;
    })() : '';

    let actionBtns = '';
    if (o.status === 'pending') {
        actionBtns = `<button class="btn btn-green btn-sm" onclick="window.adminAction('${o.id}','accepted')">✅ Accept</button>
                      <button class="btn btn-outline btn-sm" style="color:var(--danger);" onclick="window.adminAction('${o.id}','rejected')">✗ Reject</button>`;
    } else if (o.status === 'accepted') {
        actionBtns = `<button class="btn btn-primary btn-sm" onclick="window.adminAction('${o.id}','preparing')">🍳 Start Preparing</button>`;
    } else if (o.status === 'preparing') {
        actionBtns = `<button class="btn btn-green btn-sm" onclick="window.adminAction('${o.id}','ready')">🔔 Mark Ready</button>`;
    } else if (o.status === 'ready') {
        actionBtns = `<button class="btn btn-outline btn-sm" onclick="window.adminAction('${o.id}','completed')">📦 Received</button>`;
    }

    const borderColor = statusColors[o.status] || 'var(--border)';
    return `<div style="background:var(--card);border:1px solid var(--border);border-left:4px solid ${borderColor};border-radius:var(--radius);padding:16px;margin-bottom:12px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;flex-wrap:wrap;gap:8px;">
        <div>
          <strong style="font-family:var(--font-head);">${o.id}</strong>
          <span style="color:var(--text2);font-size:0.78rem;margin-left:10px;">${o.user || 'Student'} · ${dateStr} ${timeStr}</span>
          ${scheduledNote}
        </div>
        <span style="background:${borderColor}22;color:${borderColor};padding:4px 12px;border-radius:20px;font-size:0.78rem;font-weight:600;">${statusLabels[o.status] || o.status}</span>
      </div>
      ${scheduledBanner}
      <div style="font-size:0.85rem;color:var(--text2);margin-bottom:10px;">${itemList}</div>
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;">
        <div style="display:flex;gap:6px;align-items:center;">
          <span style="font-family:var(--font-head);font-weight:700;color:var(--accent);">₹${o.total}</span>
          <span class="pill pill-blue">${o.paymentMethod}</span>
        </div>
        <div style="display:flex;gap:8px;">${actionBtns}
          <button class="btn btn-outline btn-sm" onclick="window.printBill('${o.id}')">🖨️</button>
        </div>
      </div>
    </div>`;
}

// Admin action — calls REST API → server broadcasts to all clients
window.adminAction = async (id, status) => {
    const o = state.orders.find(o => o.id === id);
    if (!o) return;

    try {
        const { updateOrderStatusAPI } = await import('./realtime.js');
        const updated = await updateOrderStatusAPI(id, status);
        if (updated) {
            o.status = status;
        } else {
            // Offline fallback
            o.status = status;
            const { saveOrders } = await import('./realtime.js');
            saveOrders(state.orders);
        }
    } catch {
        o.status = status;
    }

    const msgs = { accepted:`Order ${id} accepted ✅`, preparing:`${id} → Preparing 🍳`, ready:`${id} → Ready! 🔔`, completed:`${id} completed ✔`, rejected:`${id} rejected` };
    showNotif(msgs[status] || `${id} updated`, 'success');
    renderAdminOrders();
};

// Called by realtime listener when student tab makes a change
export function refreshAdminOrders() {
    renderAdminOrders();
    // Update dashboard stats too if visible
    const dashEl = document.getElementById('admin-dashboard');
    if (dashEl && !dashEl.classList.contains('hidden')) renderAdminDashboard();
}

window.printBill = (id) => {
    const order = state.orders.find(o => o.id === id);
    if (!order) return;
    openModal(`
    <h2>🖨️ Bill / Receipt</h2>
    <div style="background:var(--bg3);border-radius:10px;padding:20px;font-family:monospace;font-size:0.85rem;line-height:1.8;">
      <div style="text-align:center;font-weight:700;font-size:1rem;margin-bottom:8px;">VIGNAN UNIVERSITY SMARTDINE</div>
      <div style="text-align:center;color:var(--text2);font-size:0.78rem;margin-bottom:12px;">MHP SmartDine · Guntur, AP</div>
      <div>Order: ${order.id}</div>
      <div>Bill: ${order.billNum}</div>
      <div>Date: ${new Date().toLocaleString()}</div>
      <div style="border-top:1px dashed var(--border);margin:10px 0;"></div>
      ${order.items.map(i => `<div>${i.name.padEnd(20)} ${i.qty} × ₹${i.price} = ₹${(i.qty * i.price)}</div>`).join('')}
      <div style="border-top:1px dashed var(--border);margin:10px 0;"></div>
      <div>Total: ₹${order.total}</div>
      <div style="text-align:center;margin-top:12px;color:var(--text3);">Thank you! Come again 🙏</div>
    </div>
    <button class="btn btn-outline" style="width:100%;justify-content:center;margin-top:12px;" onclick="window.print()">Print</button>
  `);
};

function renderAdminMenu() {
    const el = document.getElementById('admin-menu');
    el.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:12px;">
      <div style="font-family:var(--font-head);font-size:1.4rem;font-weight:800;">🍽️ Menu Manager</div>
      <button class="btn btn-primary" onclick="window.showAddItem()">+ Add Item</button>
    </div>
    <div style="margin-bottom:12px;">
      <input type="text" id="adminMenuSearch" placeholder="Search items..." oninput="window.renderAdminMenuTable()" style="background:var(--bg3);border:1px solid var(--border);color:var(--text);padding:10px 14px;border-radius:10px;font-family:var(--font-body);font-size:0.88rem;width:250px;outline:none;"/>
    </div>
    <div class="table-wrap" id="adminMenuTable"></div>`;
    window.renderAdminMenuTable();
}

window.renderAdminMenuTable = () => {
    const q = (document.getElementById('adminMenuSearch')?.value || '').toLowerCase();
    const items = state.menuData.filter(i => !q || i.name.toLowerCase().includes(q));
    const table = document.getElementById('adminMenuTable');
    if (table) {
        table.innerHTML = `
        <table>
          <thead><tr><th>Name</th><th>Category</th><th>Price</th><th>Type</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            ${items.map(i => `<tr>
              <td><strong>${i.name}</strong></td>
              <td style="font-size:0.82rem;">${i.cat} / ${i.subcat}</td>
              <td>₹${i.price}</td>
              <td><span class="pill ${i.type === 'veg' ? 'pill-green' : 'pill-red'}">${i.type}</span></td>
              <td>
                <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:0.82rem;">
                  <input type="checkbox" ${i.available ? 'checked' : ''} onchange="window.toggleAvail(${i.id},this.checked)"/> Available
                </label>
              </td>
              <td style="display:flex;gap:6px;">
                <button class="btn btn-outline btn-sm" onclick="window.editItem(${i.id})">Edit</button>
                <button class="btn btn-danger btn-sm" onclick="window.deleteItem(${i.id})">Del</button>
              </td>
            </tr>`).join('')}
          </tbody>
        </table>`;
    }
};

window.toggleAvail = (id, val) => {
    const i = state.menuData.find(x => x.id === id);
    if (!i) return;
    i.available = val;
    showNotif(`${i.name} ${val ? '✅ enabled' : '🔴 disabled'}`, 'info');
    // Immediately re-render user menu if they're on it
    if (typeof window.filterMenu === 'function') window.filterMenu();
    // Broadcast via BroadcastChannel so other tabs update instantly
    try {
        const bc = new BroadcastChannel('vignan_smartdine');
        bc.postMessage({ type: 'MENU_UPDATE', menuData: state.menuData.map(x => ({ id: x.id, available: x.available })) });
        bc.close();
    } catch {}
};

window.deleteItem = (id) => {
    if (!confirm('Delete this item?')) return;
    state.menuData = state.menuData.filter(i => i.id !== id);
    window.renderAdminMenuTable();
    showNotif('Item deleted', 'info');
};

window.editItem = (id) => {
    const item = state.menuData.find(i => i.id === id);
    if (!item) return;
    openModal(`
    <h2>Edit Item</h2>
    <div class="form-group"><label>Name</label><input type="text" id="editName" value="${item.name}"/></div>
    <div class="form-group"><label>Price (₹)</label><input type="number" id="editPrice" value="${item.price}"/></div>
    <div class="form-group"><label>Available</label><select id="editAvail"><option value="1" ${item.available ? 'selected' : ''}>Yes</option><option value="0" ${!item.available ? 'selected' : ''}>No</option></select></div>
    <button class="btn btn-primary" style="width:100%;justify-content:center;" onclick="window.saveEdit(${id})">Save Changes</button>
  `);
};

window.saveEdit = (id) => {
    const item = state.menuData.find(i => i.id === id);
    if (!item) return;
    item.name     = document.getElementById('editName').value;
    item.price    = parseInt(document.getElementById('editPrice').value) || item.price;
    item.available = document.getElementById('editAvail').value === '1';
    closeModal();
    window.renderAdminMenuTable();
    showNotif('Item updated ✓', 'success');
    // Sync menu changes to user tab
    if (typeof window.filterMenu === 'function') window.filterMenu();
    try {
        const bc = new BroadcastChannel('vignan_smartdine');
        bc.postMessage({ type: 'MENU_UPDATE', menuData: state.menuData.map(x => ({ id: x.id, available: x.available, name: x.name, price: x.price })) });
        bc.close();
    } catch {}
};

window.showAddItem = () => {
    openModal(`
    <h2>Add New Item</h2>
    <div class="form-group"><label>Name</label><input type="text" id="newName" placeholder="Item name"/></div>
    <div class="two-col">
      <div class="form-group"><label>Price (₹)</label><input type="number" id="newPrice" placeholder="0"/></div>
      <div class="form-group"><label>Type</label><select id="newType"><option value="veg">Veg</option><option value="nonveg">Non-Veg</option></select></div>
    </div>
    <div class="form-group"><label>Category</label><select id="newCat">
      <option value="Breakfast">Breakfast</option><option value="Starters">Starters</option><option value="FastFood">Fast Food</option><option value="MainCourse">Main Course</option><option value="Curries">Curries</option><option value="FastFood2">Burgers/Pizza</option><option value="Beverages">Beverages</option>
    </select></div>
    <button class="btn btn-primary" style="width:100%;justify-content:center;" onclick="window.addNewItem()">Add Item →</button>
  `);
};

window.addNewItem = () => {
    const name = document.getElementById('newName').value;
    const price = parseInt(document.getElementById('newPrice').value);
    if (!name || !price) { showNotif('Fill all fields', 'error'); return; }
    const newId = Math.max(...state.menuData.map(i => i.id)) + 1;
    state.menuData.push({ id: newId, name, price, type: document.getElementById('newType').value, cat: document.getElementById('newCat').value, subcat: 'New', available: true, popular: false, tags: [], image: 'assets/img.jpeg' });
    closeModal();
    window.renderAdminMenuTable();
    showNotif(`${name} added to menu ✓`, 'success');
};

function renderAdminPayments() {
    const el = document.getElementById('admin-payments');
    const orders = state.orders;
    const total = orders.reduce((a, o) => a + (o.total || 0), 0);
    const razorpay = orders.filter(o => o.paymentMethod === 'razorpay').reduce((a, o) => a + (o.total || 0), 0);
    const cash = orders.filter(o => o.paymentMethod === 'cash').reduce((a, o) => a + (o.total || 0), 0);
    el.innerHTML = `
    <div style="font-family:var(--font-head);font-size:1.4rem;font-weight:800;margin-bottom:20px;">💳 Payment Records</div>
    <div class="three-col" style="margin-bottom:24px;">
      <div class="admin-stat"><div class="num" style="color:var(--success);">₹${total}</div><div class="lbl">Total Revenue</div></div>
      <div class="admin-stat"><div class="num" style="color:var(--blue);">₹${razorpay}</div><div class="lbl">Online (Razorpay)</div></div>
      <div class="admin-stat"><div class="num" style="color:var(--warn);">₹${cash}</div><div class="lbl">Cash Payments</div></div>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Order ID</th><th>Bill Number</th><th>Amount</th><th>Method</th><th>Status</th><th>Time</th></tr></thead>
        <tbody>
          ${orders.map(o => `<tr>
            <td><strong>${o.id}</strong></td>
            <td style="font-size:0.82rem;">${o.billNum}</td>
            <td><strong style="color:var(--success);">₹${o.total || 0}</strong></td>
            <td><span class="pill ${o.paymentMethod === 'razorpay' ? 'pill-blue' : 'pill-orange'}">${o.paymentMethod === 'razorpay' ? '💳 Razorpay' : o.paymentMethod === 'upi' ? '📱 UPI' : '💵 Cash'}</span></td>
            <td><span class="pill ${o.status === 'completed' ? 'pill-green' : 'pill-blue'}">${o.status}</span></td>
            <td style="font-size:0.8rem;color:var(--text2);">${new Date(o.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

function renderAdminAnalytics() {
    const el = document.getElementById('admin-analytics');
    el.innerHTML = `
    <div style="font-family:var(--font-head);font-size:1.4rem;font-weight:800;margin-bottom:20px;">📈 Analytics</div>
    <div class="two-col" style="margin-bottom:20px;">
      <div class="chart-wrap"><div style="font-weight:600;margin-bottom:12px;">Weekly Revenue</div><canvas id="weekChart" height="200"></canvas></div>
      <div class="chart-wrap"><div style="font-weight:600;margin-bottom:12px;">Peak Hours</div><canvas id="peakChart" height="200"></canvas></div>
    </div>`;
    setTimeout(() => {
        new Chart(document.getElementById('weekChart'), { type: 'line', data: { labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], datasets: [{ label: 'Revenue ₹', data: [4200, 5800, 4900, 7200, 8500, 3200, 2100], borderColor: '#ff6b35', backgroundColor: 'rgba(255,107,53,0.1)', tension: 0.4, fill: true }] }, options: { responsive: true, plugins: { legend: { labels: { color: '#a0a0c0' } } }, scales: { x: { ticks: { color: '#606080' }, grid: { color: '#2a2a3d' } }, y: { ticks: { color: '#606080' }, grid: { color: '#2a2a3d' } } } } });
        new Chart(document.getElementById('peakChart'), { type: 'bar', data: { labels: ['8-9', '9-10', '10-11', '11-12', '12-1', '1-2', '2-3', '3-4'], datasets: [{ label: 'Orders', data: [15, 32, 48, 95, 142, 118, 72, 45], backgroundColor: ['#22c55e', '#22c55e', '#f59e0b', '#ef4444', '#ef4444', '#ef4444', '#f59e0b', '#22c55e'] }] }, options: { responsive: true, plugins: { legend: { labels: { color: '#a0a0c0' } } }, scales: { x: { ticks: { color: '#606080' }, grid: { color: '#2a2a3d' } }, y: { ticks: { color: '#606080' }, grid: { color: '#2a2a3d' } } } } });
    }, 100);
}

