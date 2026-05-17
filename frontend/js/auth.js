import { showNotif } from './app.js';

export async function handleLogin() {
    const email = document.getElementById('loginEmail').value.trim();
    const pass = document.getElementById('loginPass').value;

    if (!email || !pass) {
        showNotif('Please fill all fields', 'error');
        return null;
    }

    try {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password: pass })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Login failed');
        return data;
    } catch (err) {
        showNotif(err.message, 'error');
        return null;
    }
}

export async function handleAdminLogin() {
    const email = document.getElementById('adminEmail').value.trim();
    const pass = document.getElementById('adminPass').value;

    if (!email || !pass) {
        showNotif('Please enter admin credentials', 'error');
        return null;
    }

    try {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password: pass, isAdmin: true })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Admin login failed');
        return data;
    } catch (err) {
        showNotif(err.message, 'error');
        return null;
    }
}

export async function handleRegister() {
    const first = document.getElementById('regFirst').value.trim();
    const last = document.getElementById('regLast').value.trim();
    const roll = document.getElementById('regRoll').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const year = document.getElementById('regYear').value;
    const branch = document.getElementById('regBranch').value;
    const phone = document.getElementById('regPhone').value.trim();
    const pass = document.getElementById('regPass').value;

    if (!first || !roll || !email || !pass) {
        showNotif('Please fill all required fields', 'error');
        return null;
    }

    if (pass.length < 6) {
        showNotif('Password must be at least 6 characters', 'error');
        return null;
    }

    try {
        const res = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: `${first} ${last}`,
                email,
                role: 'student',
                year,
                branch,
                roll,
                phone,
                password: pass
            })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Registration failed');
        return data;
    } catch (err) {
        showNotif(err.message, 'error');
        return null;
    }
}

export function switchAuthTab(tab) {
    document.getElementById('loginForm').classList.toggle('hidden', tab !== 'login');
    document.getElementById('registerForm').classList.toggle('hidden', tab !== 'register');
    document.getElementById('adminForm').classList.toggle('hidden', tab !== 'admin');
    
    document.getElementById('tab-login').classList.toggle('active', tab === 'login');
    document.getElementById('tab-register').classList.toggle('active', tab === 'register');
    document.getElementById('tab-admin').classList.toggle('active', tab === 'admin');
}
