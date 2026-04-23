import { showNotif } from './app.js';

export function handleLogin() {
    const email = document.getElementById('loginEmail').value.trim();
    const pass = document.getElementById('loginPass').value;
    const isAdmin = document.getElementById('isAdmin').checked;

    if (!email || !pass) {
        showNotif('Please fill all fields', 'error');
        return;
    }

    if (isAdmin) {
        if (email === 'admin@vignan.ac.in' && pass === 'admin123') {
            return { name: 'Admin', email, role: 'admin' };
        } else {
            showNotif('Invalid admin credentials', 'error');
            return null;
        }
    }

    // Student Login
    return {
        name: email.split('@')[0].replace(/\d/g, '').replace(/^./, c => c.toUpperCase()) || 'Student',
        email,
        role: 'student',
        year: '3rd Year',
        branch: 'CSE',
        roll: email.split('@')[0].toUpperCase(),
        phone: '9876543210',
        points: 120
    };
}

export function handleRegister() {
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

    return {
        name: `${first} ${last}`,
        email,
        role: 'student',
        year,
        branch,
        roll,
        phone,
        points: 0
    };
}

export function switchAuthTab(tab) {
    document.getElementById('loginForm').classList.toggle('hidden', tab === 'register');
    document.getElementById('registerForm').classList.toggle('hidden', tab === 'login');
    document.getElementById('tab-login').classList.toggle('active', tab === 'login');
    document.getElementById('tab-register').classList.toggle('active', tab === 'register');
}
