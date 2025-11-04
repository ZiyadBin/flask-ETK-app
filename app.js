// Configuration
const CONFIG = {
    scriptUrl: localStorage.getItem('scriptUrl') || ''
};

let currentUser = null;

// Test backend connection
async function testBackend() {
    if (!CONFIG.scriptUrl) {
        return { connected: false, message: 'URL not set' };
    }

    try {
        const response = await fetch(CONFIG.scriptUrl);
        const result = await response.json();
        return { connected: true, message: 'Backend connected' };
    } catch (error) {
        return { connected: false, message: 'Connection failed: ' + error.message };
    }
}

// Login function
async function handleLogin() {
    const emailInput = document.getElementById('login-email');
    const statusDiv = document.getElementById('login-status');
    const email = emailInput.value.trim();
    
    if (!email) {
        showStatus('Please enter your email', 'error');
        return;
    }

    showStatus('Logging in...', 'info');

    try {
        // For demo - simulate login
        currentUser = {
            email: email,
            staff_id: 'user_' + Math.random().toString(36).substr(2, 5),
            role: 'staff'
        };
        
        showMainApp();
        showStatus('Login successful!', 'success');
        
    } catch (error) {
        showStatus('Login error: ' + error.message, 'error');
    }
}

function showStatus(message, type) {
    const statusDiv = document.getElementById('login-status');
    statusDiv.textContent = message;
    statusDiv.className = type;
    statusDiv.style.display = 'block';
}

function showMainApp() {
    document.getElementById('login-screen').classList.remove('active');
    document.getElementById('main-app').classList.add('active');
    
    document.getElementById('user-name').textContent = currentUser.email;
    
    // Set today's date
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('journey-date').value = today;
}

function showPage(pageName) {
    // Hide all pages
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    
    // Show selected page
    document.getElementById(pageName).classList.add('active');
    
    // Update active nav button
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
}

function addPassenger() {
    const passengersList = document.getElementById('passengers-list');
    const newRow = document.createElement('div');
    newRow.className = 'passenger-row';
    newRow.innerHTML = `
        <input type="text" placeholder="Name *" class="passenger-name" required>
        <input type="number" placeholder="Age" class="passenger-age" min="1" max="120">
        <select class="passenger-gender">
            <option value="">Gender</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
        </select>
        <input type="tel" placeholder="Mobile" class="passenger-mobile">
    `;
    passengersList.appendChild(newRow);
}

function saveCall() {
    const fromStation = document.getElementById('from-station').value;
    const toStation = document.getElementById('to-station').value;
    const journeyClass = document.getElementById('class').value;
    const journeyDate = document.getElementById('journey-date').value;
    
    if (!fromStation || !toStation || !journeyClass || !journeyDate) {
        alert('Please fill all required fields');
        return;
    }

    // Gather passenger data
    const passengerRows = document.querySelectorAll('.passenger-row');
    const passengers = [];
    
    passengerRows.forEach(row => {
        const name = row.querySelector('.passenger-name').value;
        if (name) {
            passengers.push({
                name: name,
                age: row.querySelector('.passenger-age').value,
                gender: row.querySelector('.passenger-gender').value,
                mobile: row.querySelector('.passenger-mobile').value
            });
        }
    });
    
    if (passengers.length === 0) {
        alert('Please add at least one passenger');
        return;
    }

    alert('Ticket saved successfully!\n\nIn production, this would connect to Google Apps Script backend.');
    
    // Reset form
    document.getElementById('from-station').value = '';
    document.getElementById('to-station').value = '';
    document.getElementById('class').value = '';
    document.getElementById('remark').value = '';
    document.getElementById('passengers-list').innerHTML = `
        <div class="passenger-row">
            <input type="text" placeholder="Name *" class="passenger-name" required>
            <input type="number" placeholder="Age" class="passenger-age" min="1" max="120">
            <select class="passenger-gender">
                <option value="">Gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
            </select>
            <input type="tel" placeholder="Mobile" class="passenger-mobile">
        </div>
    `;
}

function saveScriptUrl() {
    const urlInput = document.getElementById('script-url');
    const url = urlInput.value.trim();
    
    if (!url) {
        alert('Please enter Apps Script URL');
        return;
    }
    
    CONFIG.scriptUrl = url;
    localStorage.setItem('scriptUrl', url);
    
    checkBackendStatus();
    alert('URL saved successfully!');
}

async function checkBackendStatus() {
    const statusElement = document.getElementById('backend-status');
    statusElement.textContent = 'Checking...';
    
    const result = await testBackend();
    statusElement.textContent = result.connected ? '✅ Connected' : '❌ Disconnected';
    statusElement.className = result.connected ? 'connected' : 'disconnected';
}

function logout() {
    currentUser = null;
    document.getElementById('main-app').classList.remove('active');
    document.getElementById('login-screen').classList.add('active');
    document.getElementById('login-email').value = '';
    document.getElementById('login-status').textContent = '';
}

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    // Enter key for login
    document.getElementById('login-email').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') handleLogin();
    });
    
    // Set today's date
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('journey-date').value = today;
    
    // Load saved URL
    const savedUrl = localStorage.getItem('scriptUrl');
    if (savedUrl) {
        document.getElementById('script-url').value = savedUrl;
        CONFIG.scriptUrl = savedUrl;
    }
});
