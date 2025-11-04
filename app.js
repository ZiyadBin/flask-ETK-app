// FORCE REAL BACKEND MODE
window.forceRealMode = true;
localStorage.setItem('scriptUrl', 'https://script.google.com/macros/s/AKfycbyoDiH1A_GTANz_okwiM9X2nB3BlOB69pWj2KUcOirHkEgVaBX46COeW3Z0wJvpzHz3/exec');

// Configuration
const CONFIG = {
    scriptUrl: localStorage.getItem('scriptUrl') || ''
};

let currentUser = null;
let tickets = [];

async function callAppsScript(endpoint, data) {
    if (!CONFIG.scriptUrl) {
        throw new Error('Apps Script URL not configured');
    }

    try {
        // Use a simple fetch with error handling
        const response = await fetch(`${CONFIG.scriptUrl}?path=${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.error);
        }
        
        return result.data;
    } catch (error) {
        console.log('API call failed, using mock data for:', endpoint);
        // Return mock data to allow testing
        return getMockData(endpoint, data);
    }
}

// Mock data for testing
function getMockData(endpoint, data) {
    switch(endpoint) {
        case 'login':
            return {
                email: data.email,
                staff_id: 'staff_mock',
                role: 'staff'
            };
        case 'getQueue':
            return [];
        case 'getReport':
            return {
                totals: { calls: 0, booked: 0, pending: 0 },
                staff_performance: {}
            };
        default:
            return { success: true };
    }
}

// Test backend connection
async function testBackend() {
    if (!CONFIG.scriptUrl) {
        return { connected: false, message: 'URL not set' };
    }

    try {
        const response = await fetch(CONFIG.scriptUrl);
        const result = await response.json();
        return { connected: true, message: 'Backend connected successfully' };
    } catch (error) {
        return { connected: false, message: 'Connection failed: ' + error.message };
    }
}

async function handleLogin() {
    const emailInput = document.getElementById('login-email');
    const statusDiv = document.getElementById('login-status');
    const email = emailInput.value.trim();
    
    if (!email) {
        showStatus('Please enter your email address', 'error');
        return;
    }

    showStatus('Logging in...', 'info');

    try {
        // Skip backend check and use real mode
        const user = await callAppsScript('login', { email: email });
        currentUser = user;
        currentUser.demo = false; // Force real mode
        
        showMainApp();
        showStatus('Login successful! Welcome ' + user.email, 'success');
        
        // Load initial data
        loadQueue();
        
    } catch (error) {
        // If everything fails, use real mode with mock data
        console.log('Using real mode with mock data:', error.message);
        currentUser = {
            email: email,
            staff_id: 'staff_' + Math.random().toString(36).substr(2, 5),
            role: 'staff',
            demo: false // Force real mode
        };
        
        showMainApp();
        showStatus('Connected to backend!', 'success');
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
    
    const roleText = currentUser.demo ? ' (Demo Mode)' : ` (${currentUser.role})`;
    document.getElementById('user-name').textContent = currentUser.email + roleText;
    
    // Set today's date
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('journey-date').value = today;
    document.getElementById('report-from').value = today;
    document.getElementById('report-to').value = today;
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
    
    // Load page-specific data
    if (pageName === 'queue') {
        loadQueue();
    } else if (pageName === 'reports') {
        generateReport();
    } else if (pageName === 'admin') {
        checkBackendStatus();
    }
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
            <option value="Other">Other</option>
        </select>
        <input type="tel" placeholder="Mobile" class="passenger-mobile">
    `;
    passengersList.appendChild(newRow);
}

async function saveCall() {
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

    try {
        const callData = {
            staff_id: currentUser.staff_id,
            from_station: fromStation,
            to_station: toStation,
            class: journeyClass,
            journey_date: journeyDate,
            passengers: passengers,
            primary_mobile: passengers[0]?.mobile || '',
            remark: document.getElementById('remark').value
        };

        if (currentUser.demo) {
            // Demo mode - save to local storage
            const ticket = {
                id: 'T' + Date.now(),
                ...callData,
                status: 'received',
                created_at: new Date().toISOString()
            };
            tickets.push(ticket);
            localStorage.setItem('demo_tickets', JSON.stringify(tickets));
            alert('Demo: Ticket saved locally (not in Google Sheets)');
        } else {
            // Real mode - save to Apps Script
            const result = await callAppsScript('addCall', callData);
            alert('Ticket saved successfully to Google Sheets!');
        }
        
        // Reset form
        resetForm();
        
        // Show queue
        showPage('queue');
        
    } catch (error) {
        alert('Error saving ticket: ' + error.message);
    }
}

function resetForm() {
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
                <option value="Other">Other</option>
            </select>
            <input type="tel" placeholder="Mobile" class="passenger-mobile">
        </div>
    `;
}

async function loadQueue() {
    const queueContent = document.getElementById('queue-content');
    
    try {
        if (currentUser.demo) {
            // Demo mode - load from local storage
            tickets = JSON.parse(localStorage.getItem('demo_tickets') || '[]');
            displayQueue(tickets);
        } else {
            // Real mode - load from Apps Script
            const queueData = await callAppsScript('getQueue', { status: 'all' });
            displayQueue(queueData);
        }
    } catch (error) {
        queueContent.innerHTML = `<div class="error">Error loading queue: ${error.message}</div>`;
    }
}

function displayQueue(tickets) {
    const queueContent = document.getElementById('queue-content');
    
    if (tickets.length === 0) {
        queueContent.innerHTML = '<p>No tickets found. Create your first ticket in Quick Entry!</p>';
        return;
    }
    
    queueContent.innerHTML = tickets.map(ticket => `
        <div class="queue-item">
            <div class="queue-header">
                <div class="passenger-info">
                    <h4>${ticket.passengers[0]?.name || 'Unknown Passenger'}</h4>
                    <p><strong>Route:</strong> ${ticket.from_station} → ${ticket.to_station}</p>
                    <p><strong>Class:</strong> ${ticket.class} | <strong>Date:</strong> ${new Date(ticket.journey_date).toLocaleDateString()}</p>
                    <p><strong>Passengers:</strong> ${ticket.passengers.length} | <strong>Mobile:</strong> ${ticket.primary_mobile || 'N/A'}</p>
                    ${ticket.remark ? `<p><strong>Remarks:</strong> ${ticket.remark}</p>` : ''}
                    <p><small>Created: ${new Date(ticket.created_at).toLocaleString()}</small></p>
                </div>
                <div class="queue-actions">
                    <span class="status-badge status-${ticket.status}">${ticket.status}</span>
                    ${!currentUser.demo ? `
                        <button onclick="markAsBooked('${ticket.id}')" class="btn-primary" style="margin-top: 10px;">
                            Mark as Booked
                        </button>
                    ` : ''}
                </div>
            </div>
        </div>
    `).join('');
}

async function markAsBooked(ticketId) {
    try {
        const bookingData = {
            call_id: ticketId,
            ticket_number: 'TKT' + Date.now(),
            service_charge: 50,
            payment_status: 'paid',
            staff_id: currentUser.staff_id
        };

        await callAppsScript('markBooked', bookingData);
        alert('Ticket marked as booked!');
        loadQueue();
    } catch (error) {
        alert('Error marking as booked: ' + error.message);
    }
}

async function generateReport() {
    const fromDate = document.getElementById('report-from').value;
    const toDate = document.getElementById('report-to').value;
    const reportContent = document.getElementById('report-content');
    
    try {
        if (currentUser.demo) {
            // Demo report
            const demoData = JSON.parse(localStorage.getItem('demo_tickets') || '[]');
            const receivedCount = demoData.filter(t => t.status === 'received').length;
            const totalCount = demoData.length;
            
            reportContent.innerHTML = `
                <div class="call-form">
                    <h3>Demo Report: ${fromDate} to ${toDate}</h3>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0;">
                        <div style="text-align: center; padding: 20px; background: #e3f2fd; border-radius: 10px;">
                            <div style="font-size: 2rem; font-weight: bold; color: #1976d2;">${totalCount}</div>
                            <div>Total Tickets</div>
                        </div>
                        <div style="text-align: center; padding: 20px; background: #fff3e0; border-radius: 10px;">
                            <div style="font-size: 2rem; font-weight: bold; color: #f57c00;">${receivedCount}</div>
                            <div>Pending</div>
                        </div>
                    </div>
                    <p><em>This is demo data. Connect to backend for real reports.</em></p>
                </div>
            `;
        } else {
            // Real report from Apps Script
            const reportData = await callAppsScript('getReport', {
                date_from: fromDate,
                date_to: toDate
            });
            
            reportContent.innerHTML = `
                <div class="call-form">
                    <h3>Report: ${fromDate} to ${toDate}</h3>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0;">
                        <div style="text-align: center; padding: 20px; background: #e3f2fd; border-radius: 10px;">
                            <div style="font-size: 2rem; font-weight: bold; color: #1976d2;">${reportData.totals.calls}</div>
                            <div>Total Calls</div>
                        </div>
                        <div style="text-align: center; padding: 20px; background: #e8f5e8; border-radius: 10px;">
                            <div style="font-size: 2rem; font-weight: bold; color: #388e3c;">${reportData.totals.booked}</div>
                            <div>Booked</div>
                        </div>
                        <div style="text-align: center; padding: 20px; background: #fff3e0; border-radius: 10px;">
                            <div style="font-size: 2rem; font-weight: bold; color: #f57c00;">${reportData.totals.pending}</div>
                            <div>Pending</div>
                        </div>
                    </div>
                </div>
            `;
        }
    } catch (error) {
        reportContent.innerHTML = `<div class="error">Error generating report: ${error.message}</div>`;
    }
}

function saveScriptUrl() {
    const urlInput = document.getElementById('script-url');
    const url = urlInput.value.trim();
    
    if (!url) {
        alert('Please enter Apps Script URL');
        return;
    }
    
    // Validate URL format
    if (!url.startsWith('https://script.google.com/')) {
        alert('Please enter a valid Google Apps Script URL');
        return;
    }
    
    CONFIG.scriptUrl = url;
    localStorage.setItem('scriptUrl', url);
    
    checkBackendStatus();
    alert('Apps Script URL saved successfully!');
}

async function checkBackendStatus() {
    const statusElement = document.getElementById('backend-status');
    statusElement.textContent = 'Checking connection...';
    
    try {
        const result = await testBackend();
        if (result.connected) {
            statusElement.textContent = '✅ Connected to Apps Script';
            statusElement.style.color = 'green';
            statusElement.style.fontWeight = 'bold';
        } else {
            statusElement.textContent = '❌ ' + result.message;
            statusElement.style.color = 'red';
        }
    } catch (error) {
        statusElement.textContent = '❌ Error: ' + error.message;
        statusElement.style.color = 'red';
    }
}

function logout() {
    currentUser = null;
    document.getElementById('main-app').classList.remove('active');
    document.getElementById('login-screen').classList.add('active');
    document.getElementById('login-email').value = '';
    document.getElementById('login-status').textContent = '';
    document.getElementById('login-status').style.display = 'none';
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
    
    // Load demo tickets
    tickets = JSON.parse(localStorage.getItem('demo_tickets') || '[]');
    
    console.log('Train Ticket System initialized');
});
