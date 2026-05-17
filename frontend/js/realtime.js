/**
 * realtime.js — Socket.io client for real-time order sync
 * Connects to the Express + Socket.io backend at port 3001.
 * Falls back to BroadcastChannel if server is not reachable.
 */

const SERVER_URL = 'http://localhost:3001';
let socket = null;
let onUpdateCallback = null;
let usingFallback = false;

// ─── Primary: Socket.io ─────────────────────────────────────────────────────
export async function initRealtime(onUpdate) {
    onUpdateCallback = onUpdate;

    try {
        // Dynamically load Socket.io client from the backend
        await loadSocketIOScript();

        socket = window.io(SERVER_URL, { transports: ['websocket', 'polling'], reconnectionDelay: 1000 });

        socket.on('connect', () => {
            console.log('[SmartDine] Connected to server ✅', socket.id);
        });

        socket.on('orders:updated', (orders) => {
            const deserialized = orders.map(deserializeOrder);
            onUpdateCallback(deserialized);
        });

        socket.on('order:status_changed', ({ orderId, status }) => {
            console.log(`[SmartDine] Order ${orderId} → ${status}`);
        });

        socket.on('disconnect', () => {
            console.warn('[SmartDine] Disconnected from server');
        });

        socket.on('connect_error', () => {
            if (!usingFallback) {
                console.warn('[SmartDine] Server unreachable, using BroadcastChannel fallback');
                initFallback();
            }
        });

    } catch (e) {
        console.warn('[SmartDine] Socket.io load failed, using BroadcastChannel fallback');
        initFallback();
    }
}

// ─── Place/update order via REST API ────────────────────────────────────────
export async function placeOrderAPI(orderData) {
    try {
        const res = await fetch(`${SERVER_URL}/api/orders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(orderData),
        });
        return await res.json();
    } catch {
        return null; // will fallback to local
    }
}

export async function updateOrderStatusAPI(orderId, status) {
    try {
        const res = await fetch(`${SERVER_URL}/api/orders/${orderId}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status }),
        });
        return await res.json();
    } catch {
        return null;
    }
}

export async function fetchAllOrdersAPI() {
    try {
        const res = await fetch(`${SERVER_URL}/api/orders`);
        return (await res.json()).map(deserializeOrder);
    } catch {
        return null;
    }
}

export async function loginAPI(email, password, isAdmin = false) {
    try {
        const res = await fetch(`${SERVER_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, isAdmin }),
        });
        if (!res.ok) return null;
        return await res.json();
    } catch {
        return null;
    }
}

export async function registerAPI(userData) {
    try {
        const res = await fetch(`${SERVER_URL}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData),
        });
        if (!res.ok) return null;
        return await res.json();
    } catch {
        return null;
    }
}

// Emit an event to the server (used for manual broadcasts)
export function saveOrders(orders) {
    if (usingFallback) {
        saveFallback(orders);
    }
    // With socket.io backend, orders are saved via REST API calls
    // The server then broadcasts via socket — no need to manually push
}

// ─── Fallback: BroadcastChannel + localStorage ───────────────────────────────
const STORAGE_KEY = 'vsd_orders';
let fallbackChannel = null;

function initFallback() {
    usingFallback = true;

    if (typeof BroadcastChannel !== 'undefined') {
        fallbackChannel = new BroadcastChannel('vignan_smartdine');
        fallbackChannel.onmessage = (e) => {
            if (e.data?.type === 'ORDER_UPDATE') {
                onUpdateCallback(e.data.orders.map(deserializeOrder));
            }
        };
    }

    window.addEventListener('storage', (e) => {
        if (e.key === STORAGE_KEY && e.newValue) {
            try {
                onUpdateCallback(JSON.parse(e.newValue).map(deserializeOrder));
            } catch {}
        }
    });
}

function saveFallback(orders) {
    const serialized = orders.map(serializeOrder);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(serialized)); } catch {}
    if (fallbackChannel) {
        fallbackChannel.postMessage({ type: 'ORDER_UPDATE', orders: serialized });
    }
}

export function loadOrders() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        return JSON.parse(raw).map(deserializeOrder);
    } catch { return []; }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function serializeOrder(o) {
    return { ...o, timestamp: o.timestamp instanceof Date ? o.timestamp.toISOString() : o.timestamp };
}

function deserializeOrder(o) {
    return { ...o, timestamp: new Date(o.timestamp) };
}

function loadSocketIOScript() {
    return new Promise((resolve, reject) => {
        if (window.io) return resolve();
        const script = document.createElement('script');
        script.src = `${SERVER_URL}/socket.io/socket.io.js`;
        script.onload  = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}
