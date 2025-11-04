// Configuration
const CONFIG = {
    scriptUrl: localStorage.getItem('scriptUrl') || ''
};

// Global state
let currentUser = null;
let currentCallData = null;
let duplicateMatches = [];

// API functions
async function callAppsScript(endpoint, data) {
    if (!CONFIG.scriptUrl) {
        throw new Error('Apps Script URL not configured. Go to Admin page to set it.');
    }

    const response = await fetch(`${CONFIG.scriptUrl}?path=${endpoint}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
    });

    const result = await response.json();
    
    if (!result.success) {
        throw new Error(result.error);
    }
    
    return result.data;
}

// Test backend connection
async function testBackend() {
    try {
        if (!CONFIG.scriptUrl) {
            return { connected: false, message: 'URL not set' };
        }

        const response = await fetch(CONFIG.scriptUrl);
        const result = await response.json();
        return { connected: true, message: 'Connected successfully' };
    } catch (error) {
        return { connected: false, message: error.message };
    }
}

// Login function
async function handleLogin() {
    const emailInput = document.getElementById('login-email');
    const statusDiv = document.getElementById('login-status');
    const email = emailInput.value.trim();
    
    if (!email) {
        showStatus('Please enter your email address', 'error');
        return;
    }

    showStatus('Connecting to server...', 'info');

    try {
        const user = await callAppsScript('login', { email: email });
        currentUser = user;
        
        showMainApp();
        showStatus('Login successful!', 'success');
        
        // Update backend status
        checkBackendStatus();
        
    } catch (error) {
        showStatus('Login failed: ' + error.message, 'error');
    }
}

function showStatus(message, type) {
    const statusDiv = document.getElementById('login-status');
    statusDiv.textContent = message;
    statusDiv.className = type;
}

function showMainApp() {
    document.getElementById('login-screen').classList.remove('active');
    document.getElementById('main-app').classList.add('active');
    
    document.getElementById('user-name').textContent = `${currentUser.email} (${currentUser.role})`;
    
    // Set default dates
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('journey-date').value = today;
    document.getElementById('report-from').value = today;
    document.getElementById('report-to').value = today;
    
    // Load initial data
    loadQueue();
}

// Other functions (showPage, addPassenger, saveCall, etc.) remain similar
// but now they call callAppsScript() instead of using local storage

async function saveCall(action) {
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

        const result = await callAppsScript('addCall', callData);
        
        alert(`Ticket ${action === 'queue' ? 'saved and sent to queue' : 'saved'} successfully!`);
        
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
                    <option value="Other">Other</option>
                </select>
                <input type="tel" placeholder="Mobile" class="passenger-mobile">
            </div>
        `;
        
        if (action === 'queue') {
            showPage('queue');
            loadQueue();
        }
        
    } catch (error) {
        alert('Error saving ticket: ' + error.message);
    }
}

async function loadQueue() {
    try {
        const filter = document.getElementById('queue-filter').value;
        const queueData = await callAppsScript('getQueue', {
            status: filter === 'all' ? '' : filter
        });
        
        displayQueue(queueData);
    } catch (error) {
        document.getElementById('queue-content').innerHTML = 
            `<div class="error">Error loading queue: ${error.message}</div>`;
    }
}

function displayQueue(tickets) {
    const queueContent = document.getElementById('queue-content');
    
    if (tickets.length === 0) {
        queueContent.innerHTML = '<p>No tickets found.</p>';
        return;
    }
    
    queueContent.innerHTML = tickets.map(ticket => `
        <div class="queue-item">
            <div class="queue-header">
                <div class="passenger-info">
                    <h4>${ticket.passengers[0]?.name || 'Unknown'}</h4>
                    <p>${ticket.from_station} → ${ticket.to_station} • ${ticket.class}</p>
                    <p>Date: ${new Date(ticket.journey_date).toLocaleDateString()} • Passengers: ${ticket.pax_count}</p>
                    <p>Mobile: ${ticket.primary_mobile || 'N/A'}</p>
                    ${ticket.remark ? `<p><strong>Remarks:</strong> ${ticket.remark}</p>` : ''}
                </div>
                <div class="queue-actions">
                    <span class="status-badge status-${ticket.status}">${ticket.status}</span>
                    ${ticket.status !== 'booked' ? `
                        <button onclick="openBookingModal('${ticket.id}')" class="btn-primary">
                            Mark as Booked
                        </button>
                    ` : ''}
                </div>
            </div>
        </div>
    `).join('');
}

// Admin functions
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
    
    try {
        const result = await testBackend();
        statusElement.textContent = result.connected ? '✅ Connected' : '❌ Disconnected';
        statusElement.className = result.connected ? 'connected' : 'disconnected';
    } catch (error) {
        statusElement.textContent = '❌ Error checking status';
        statusElement.className = 'disconnected';
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    // Set up event listeners
    document.getElementById('login-email').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') handleLogin();
    });
    
    // Set default dates
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('journey-date').value = today;
    
    // Load saved script URL
    const savedUrl = localStorage.getItem('scriptUrl');
    if (savedUrl) {
        document.getElementById('script-url').value = savedUrl;
        CONFIG.scriptUrl = savedUrl;
    }
    
    // Check backend status on admin page load
    document.querySelector('[onclick="showPage(\'admin\')"]').addEventListener('click', checkBackendStatus);
});
