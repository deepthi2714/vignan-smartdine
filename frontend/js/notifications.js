/**
 * notifications.js — Full notification system
 * - Browser Push Notifications (background alerts)
 * - In-app bell with unread count + history dropdown
 */

export const notifHistory = [];
let unreadCount = 0;
let bellUpdateCallback = null;

// ─── Init ─────────────────────────────────────────────────────────────────
export function initNotifications(onBellUpdate) {
    bellUpdateCallback = onBellUpdate;

    // Request browser notification permission on init
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
}

// ─── Add a notification ────────────────────────────────────────────────────
export function addNotification({ title, message, type = 'info', orderId = null }) {
    const notif = {
        id:        Date.now(),
        title,
        message,
        type,      // 'success' | 'info' | 'warning' | 'error'
        orderId,
        time:      new Date(),
        read:      false,
    };
    notifHistory.unshift(notif);
    if (notifHistory.length > 50) notifHistory.pop(); // keep last 50

    unreadCount++;
    bellUpdateCallback?.(unreadCount);

    // Trigger browser push notification if tab is not focused
    if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
        const icon = type === 'success' ? '✅' : type === 'warning' ? '⚠️' : 'ℹ️';
        new Notification(`${icon} Vignan SmartDine`, {
            body: `${title}: ${message}`,
            icon: '/assets/img.jpeg',
            badge: '/assets/img.jpeg',
            tag: orderId || 'smartdine',
        });
    }

    return notif;
}

// ─── Mark all as read ─────────────────────────────────────────────────────
export function markAllRead() {
    notifHistory.forEach(n => n.read = true);
    unreadCount = 0;
    bellUpdateCallback?.(0);
}

// ─── Render dropdown HTML ─────────────────────────────────────────────────
export function renderNotifDropdown() {
    if (notifHistory.length === 0) {
        return `<div style="padding:32px;text-align:center;color:#a0a0c0;">
            <div style="font-size:2rem;margin-bottom:8px;">🔔</div>
            <div style="font-size:0.85rem;">No notifications yet</div>
        </div>`;
    }

    const typeColors = {
        success: '#22c55e', info: '#3b82f6', warning: '#f59e0b', error: '#ef4444'
    };
    const typeIcons = {
        success: '✅', info: 'ℹ️', warning: '⚠️', error: '❌'
    };

    return notifHistory.map(n => {
        const timeStr = n.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const dateStr = n.time.toLocaleDateString([], { day: '2-digit', month: 'short' });
        return `
        <div style="padding:14px 18px;border-bottom:1px solid #2a2a3d;background:${n.read ? 'transparent' : 'rgba(255,107,53,0.04)'};cursor:default;transition:background .2s;" 
             onmouseenter="this.style.background='rgba(255,255,255,0.03)'" 
             onmouseleave="this.style.background='${n.read ? 'transparent' : 'rgba(255,107,53,0.04)'}'">
            <div style="display:flex;align-items:flex-start;gap:10px;">
                <div style="width:32px;height:32px;border-radius:50%;background:${typeColors[n.type]}22;display:flex;align-items:center;justify-content:center;font-size:0.9rem;flex-shrink:0;">${typeIcons[n.type]}</div>
                <div style="flex:1;min-width:0;">
                    <div style="font-weight:600;font-size:0.85rem;color:#f0f0f8;margin-bottom:2px;">${n.title}</div>
                    <div style="font-size:0.78rem;color:#a0a0c0;line-height:1.4;">${n.message}</div>
                    <div style="font-size:0.7rem;color:#606080;margin-top:4px;">${dateStr} · ${timeStr}</div>
                </div>
                ${!n.read ? '<div style="width:8px;height:8px;border-radius:50%;background:var(--accent);flex-shrink:0;margin-top:4px;"></div>' : ''}
            </div>
        </div>`;
    }).join('');
}
