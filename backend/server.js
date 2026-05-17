/**
 * Vignan SmartDine — Backend Server
 * Express + Socket.io for real-time multi-user canteen ordering
 *
 * Order lifecycle:
 *   pending → accepted → preparing → ready → completed
 */

const express  = require('express');
const http     = require('http');
const { Server } = require('socket.io');
const cors     = require('cors');
const path     = require('path');

// ─── App Setup ─────────────────────────────────────────────────────────────
const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST', 'PATCH'] }
});

app.use(cors());
app.use(express.json());

// Serve the frontend from the frontend/ folder
app.use(express.static(path.join(__dirname, '..', 'frontend')));

const mongoose = require('mongoose');

// ─── MongoDB Setup ────────────────────────────────────────────────────────
const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/smartdine';
mongoose.connect(mongoURI)
    .then(() => console.log('[DB] Connected to MongoDB (smartdine)'))
    .catch(err => console.error('[DB] MongoDB connection error:', err));

const userSchema = new mongoose.Schema({
    id: Number,
    name: String,
    email: { type: String, unique: true },
    password: { type: String, required: true },
    roll: String,
    phone: String,
    year: String,
    branch: String,
    points: { type: Number, default: 0 },
    createdAt: Date
});
const User = mongoose.model('User', userSchema);

const orderSchema = new mongoose.Schema({
    id: String,
    billNum: String,
    user: String,
    userEmail: String,
    items: Array,
    total: Number,
    paymentMethod: String,
    scheduledFor: Date,
    isScheduled: Boolean,
    status: { type: String, default: 'pending' },
    timestamp: Date,
    updatedAt: Date,
    rating: Number
});
const Order = mongoose.model('Order', orderSchema);

// Helper to broadcast orders
async function broadcastOrders() {
    const orders = await Order.find().sort({ timestamp: -1 });
    io.emit('orders:updated', orders);
}

// ─── REST API ───────────────────────────────────────────────────────────────

// GET all orders (admin)
app.get('/api/orders', async (req, res) => {
    const orders = await Order.find().sort({ timestamp: -1 });
    res.json(orders);
});

// GET orders for a specific user
app.get('/api/orders/user/:email', async (req, res) => {
    const orders = await Order.find({ userEmail: req.params.email }).sort({ timestamp: -1 });
    res.json(orders);
});

// POST new order (student places order)
app.post('/api/orders', async (req, res) => {
    const count = await Order.countDocuments();
    const newOrder = new Order({
        id: `ORD-${1001 + count}`,
        billNum: `BILL-${Math.random().toString(36).substr(2,8).toUpperCase()}`,
        ...req.body,
        status: req.body.isScheduled ? 'scheduled' : 'pending',
        timestamp: new Date(),
    });
    await newOrder.save();
    
    // Broadcast
    io.emit('order:new', newOrder);
    await broadcastOrders();

    console.log(`[ORDER] New order ${newOrder.id} from ${newOrder.user || 'Guest'}`);
    res.status(201).json(newOrder);
});

// PATCH update order status (admin action)
app.patch('/api/orders/:id/status', async (req, res) => {
    const { status } = req.body;
    const order = await Order.findOne({ id: req.params.id });

    if (!order) return res.status(404).json({ error: 'Order not found' });

    const validFlow = ['pending','accepted','preparing','ready','completed','rejected','scheduled'];
    if (!validFlow.includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
    }

    order.status = status;
    order.updatedAt = new Date();
    await order.save();

    io.emit('order:status_changed', { orderId: order.id, status, order });
    await broadcastOrders();

    console.log(`[ORDER] ${order.id} → ${status}`);
    res.json(order);
});

// PATCH rate a completed order
app.patch('/api/orders/:id/rate', async (req, res) => {
    const { rating } = req.body;
    const order = await Order.findOne({ id: req.params.id });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    
    order.rating = rating;
    await order.save();
    
    await broadcastOrders();
    res.json(order);
});

// GET stats for admin dashboard
app.get('/api/stats', async (req, res) => {
    const orders = await Order.find();
    const today = new Date().toDateString();
    const todayOrders = orders.filter(o => new Date(o.timestamp).toDateString() === today);
    res.json({
        totalOrders: orders.length,
        todayOrders: todayOrders.length,
        revenue: todayOrders.reduce((a, o) => a + (o.total || 0), 0),
        activeOrders: orders.filter(o => !['completed','rejected'].includes(o.status)).length,
        pendingOrders: orders.filter(o => o.status === 'pending').length,
    });
});

// POST register user
app.post('/api/auth/register', async (req, res) => {
    const { email } = req.body;
    const existing = await User.findOne({ email });
    if (existing) {
        return res.status(409).json({ error: 'Email already registered' });
    }
    const user = new User({ id: Date.now(), ...req.body, points: 0, createdAt: new Date() });
    await user.save();
    res.status(201).json(user);
});

// POST login user
app.post('/api/auth/login', async (req, res) => {
    const { email, password, isAdmin } = req.body;

    if (isAdmin) {
        if (email === 'admin@vignan.ac.in' && password === 'admin123') {
            return res.json({ name: 'Admin', email, role: 'admin' });
        }
        return res.status(401).json({ error: 'Invalid admin credentials' });
    }

    const existing = await User.findOne({ email });
    if (!existing) {
        return res.status(404).json({ error: 'User not found. Please register.' });
    }

    if (existing.password !== password) {
        return res.status(401).json({ error: 'Invalid password' });
    }

    const userObj = existing.toObject();
    delete userObj.password;
    res.json(userObj);
});

// GET menu (served from menuData — optional REST endpoint)
app.get('/api/menu', (req, res) => {
    res.json({ message: 'Menu data served via JS module. See /js/menuData.js' });
});

// Health check
app.get('/api/health', async (req, res) => {
    const count = await Order.countDocuments();
    res.json({ status: 'ok', uptime: process.uptime(), orders: count });
});

// ─── Socket.io Real-time ────────────────────────────────────────────────────
io.on('connection', async (socket) => {
    const clientIp = socket.handshake.address;
    console.log(`[WS] Client connected: ${socket.id} (${clientIp})`);

    // Send current orders on connect
    const orders = await Order.find().sort({ timestamp: -1 });
    socket.emit('orders:updated', orders);

    socket.on('disconnect', () => {
        console.log(`[WS] Client disconnected: ${socket.id}`);
    });
});

// ─── Start Server ────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log('');
    console.log('  ┌─────────────────────────────────────────────┐');
    console.log('  │        Vignan SmartDine — Server             │');
    console.log(`  │   http://localhost:${PORT}  (API + Frontend)    │`);
    console.log(`  │   http://localhost:${PORT}/api/health           │`);
    console.log('  └─────────────────────────────────────────────┘');
    console.log('');
});
