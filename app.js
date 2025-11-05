// app.js - Train Ticket System frontend (complete)

/* Configuration */
window.forceRealMode = true;
localStorage.setItem('scriptUrl', localStorage.getItem('scriptUrl') || '');
const CONFIG = {
    scriptUrl: localStorage.getItem('scriptUrl') || ''
};

let currentUser = null;
let tickets = [];

/* -----------------------------
   Utility / API wrapper
   ----------------------------- */
async function callAppsScript(endpoint, data) {
    if (!CONFIG.scriptUrl) {
        throw new Error('Apps Script URL not configured');
    }

    try {
        const response = await fetch(`${CONFIG.scriptUrl}?path=${encodeURIComponent(endpoint)}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            // pass an object - server will parse
            body: JSON.stringify(data || {})
        });

        const result = await response.json().catch(() => {
            throw new Error('Invalid JSON response from server');
        });

        if (!result.success) {
            const errMsg = result.error || (result.data && result.data.message) || 'Unknown error from server';
            throw new Error(errMsg);
        }
        return result.data;
    } catch (error) {
        console.error('API call failed:', endpoint, error);
        // Fallback to mock in dev mode for some endpoints
        return getMockData(endpoint, data);
    }
}

function getMockData(endpoint, data) {
    // Minimal mock responses so UI doesn't break during dev
    switch (endpoint) {
        case 'login':
            return { email: data.email || 'demo@local', staff_id: 'staff_mock', role: 'staff' };
        case 'getQueue':
            return JSON.parse(localStorage.getItem('demo_tickets') || '[]');
        case 'getReport':
            return { totals: { calls: 0, booked: 0, pending: 0 }, staff_performance: {} };
        case 'addCall':
            // Create a demo id and echo duplicates if mobile matches existing demo ticket
            const demoTickets = JSON.parse(localStorage.getItem('demo_tickets') || '[]');
            const newId = 'demo_' + Date.now();
            const ticket = {
                id: newId,
                created_at: new Date().toISOString(),
                ...data,
                status: 'received'
            };
            demoTickets.push(ticket);
            localStorage.setItem('demo_tickets', JSON.stringify(demoTickets));
            // check duplicates in demo (same primary_mobile)
            const duplicates = demoTickets
                .filter(t => t.id !== newId && t.primary_mobile && t.primary_mobile === data.primary_mobile)
                .map(t => ({ id: t.id, primary_mobile: t.primary_mobile, from_station: t.from_station, to_station: t.to_station, journey_date: t.journey_date }));
            return { id: newId, duplicates: duplicates, message: 'Demo: saved locally' };
        case 'markBooked':
            // mark demo ticket booked
            const demo = JSON.parse(localStorage.getItem('demo_tickets') || '[]');
            const idx = demo.findIndex(t => t.id === data.call_id);
            if (idx !== -1) {
                demo[idx].status = 'booked';
                demo[idx].booking_ticket_number = data.ticket_number;
                localStorage.setItem('demo_tickets', JSON.stringify(demo));
                return { success: true, ledger_id: 'demo_ledger_' + Date.now() };
            }
            throw new Error('Demo: call not found');
        default:
            return {};
    }
}

async function testBackend() {
    if (!CONFIG.scriptUrl) return { connected: false, message: 'URL not set' };
    try {
        const response = await fetch(CONFIG.scriptUrl);
        const result = await response.json();
        return { connected: true, message: 'Backend connected successfully', raw: result };
    } catch (error) {
        return { connected: false, message: 'Connection failed: ' + error.message };
    }
}

/* -----------------------------
   Status / UI helpers
   ----------------------------- */
function showStatus(message, type = 'info') {
    const statusDiv = document.getElementById('login-status');
    if (!statusDiv) return;
    statusDiv.textContent = message;
    statusDiv.className = type;
    statusDiv.style.display = 'block';
}

function clearStatus() {
    const statusDiv = document.getElementById('login-status');
    if (!statusDiv) return;
    statusDiv.textContent = '';
    statusDiv.className = '';
    statusDiv.style.display = 'none';
}

function escapeHtml(s) {
    if (!s && s !== 0) return '';
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function setLoading(buttonEl, isLoading) {
    if (!buttonEl) return;
    if (isLoading) {
        buttonEl.disabled = true;
        buttonEl.dataset.origText = buttonEl.innerHTML;
        buttonEl.innerHTML = 'Please wait...';
        buttonEl.classList.add('btn-loading');
    } else {
        buttonEl.disabled = false;
        if (buttonEl.dataset.origText) buttonEl.innerHTML = buttonEl.dataset.origText;
        buttonEl.classList.remove('btn-loading');
    }
}

/* -----------------------------
   Authentication & main view
   ----------------------------- */

async function handleLogin() {
    const emailInput = document.getElementById('login-email');
    const email = emailInput.value.trim();
    if (!email) {
        showStatus('Please enter your email address', 'error');
        return;
    }

    showStatus('Logging in...', 'info');

    try {
        const user = await callAppsScript('login', { email: email });
        currentUser = user;
        currentUser.demo = (user.status === 'new_setup') || false;
        showMainApp();
        showStatus('Login successful! Welcome ' + user.email, 'success');
        await loadQueue();
    } catch (error) {
        console.error(error);
        showStatus('Login failed: ' + error.message, 'error');
    }
}

function showMainApp() {
    document.getElementById('login-screen').classList.remove('active');
    document.getElementById('main-app').classList.add('active');

    const roleText = currentUser && currentUser.role ? ` (${currentUser.role})` : '';
    document.getElementById('user-name').textContent = (currentUser && currentUser.email ? currentUser.email : 'Unknown') + roleText;

    // Set today's date on quick entry & reports
    const today = new Date().toISOString().split('T')[0];
    if (document.getElementById('journey-date')) document.getElementById('journey-date').value = today;
    if (document.getElementById('report-from')) document.getElementById('report-from').value = today;
    if (document.getElementById('report-to')) document.getElementById('report-to').value = today;
}

/* -----------------------------
   Navigation
   ----------------------------- */
function showPage(pageName, callerEvent) {
    // Hide all pages
    document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
    // Show selected
    const target = document.getElementById(pageName);
    if (target) target.classList.add('active');

    // Update nav active class
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    if (callerEvent && callerEvent.target) callerEvent.target.classList.add('active');

    // Load page-specific data
    if (pageName === 'queue') loadQueue();
    if (pageName === 'reports') generateReport();
    if (pageName === 'admin') checkBackendStatus();
}

/* -----------------------------
   Quick Entry (form) functions
   ----------------------------- */
function addPassenger() {
    const passengersList = document.getElementById('passengers-list');
    if (!passengersList) return;
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
        <button type="button" class="btn-secondary remove-passenger" style="width:120px;">Remove</button>
    `;
    passengersList.appendChild(newRow);

    // attach remove handler
    newRow.querySelector('.remove-passenger').addEventListener('click', () => {
        newRow.remove();
    });
}

function resetForm() {
    document.getElementById('from-station').value = '';
    document.getElementById('to-station').value = '';
    document.getElementById('class').value = '';
    document.getElementById('remark').value = '';
    const passengersList = document.getElementById('passengers-list');
    passengersList.innerHTML = `
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

/* Save a call - quick entry */
async function saveCall() {
    const btn = document.querySelector('.btn-primary');
    setLoading(btn, true);

    try {
        const fromStation = document.getElementById('from-station').value.trim();
        const toStation = document.getElementById('to-station').value.trim();
        const journeyClass = document.getElementById('class').value;
        const journeyDate = document.getElementById('journey-date').value;

        if (!fromStation || !toStation || !journeyClass || !journeyDate) {
            alert('Please fill all required fields (From, To, Class, Date)');
            setLoading(btn, false);
            return;
        }

        const passengerRows = document.querySelectorAll('.passenger-row');
        const passengers = [];
        passengerRows.forEach(row => {
            const name = row.querySelector('.passenger-name')?.value?.trim();
            if (name) {
                passengers.push({
                    name: name,
                    age: row.querySelector('.passenger-age')?.value || '',
                    gender: row.querySelector('.passenger-gender')?.value || '',
                    mobile: row.querySelector('.passenger-mobile')?.value || ''
                });
            }
        });

        if (passengers.length === 0) {
            alert('Please add at least one passenger with a name');
            setLoading(btn, false);
            return;
        }

        const callData = {
            staff_id: currentUser?.staff_id || ('guest_' + Math.random().toString(36).slice(2,8)),
            call_source: '', // optional
            from_station: fromStation,
            to_station: toStation,
            class: journeyClass,
            journey_date: journeyDate,
            passengers: passengers,
            primary_mobile: passengers[0]?.mobile || '',
            remark: document.getElementById('remark')?.value || ''
        };

        if (currentUser && currentUser.demo) {
            // local demo save
            const demoTickets = JSON.parse(localStorage.getItem('demo_tickets') || '[]');
            const id = 'demo_' + Date.now();
            const ticket = {
                id: id,
                created_at: new Date().toISOString(),
                ...callData,
                status: 'received'
            };
            demoTickets.push(ticket);
            localStorage.setItem('demo_tickets', JSON.stringify(demoTickets));
            alert('Demo: saved locally');
            resetForm();
            await loadQueue();
            showPage('queue');
            setLoading(btn, false);
            return;
        }

        // Real mode
        const result = await callAppsScript('addCall', callData);

        // handle duplicates if returned
        if (result && result.duplicates && Array.isArray(result.duplicates) && result.duplicates.length > 0) {
            const list = result.duplicates.map(d => `${d.match_type} — ${d.from_station}→${d.to_station} on ${d.journey_date} (id: ${d.id})`).join('\n');
            // Show a non-blocking alert — staff can continue if needed
            if (confirm('Possible duplicate(s) found:\n\n' + list + '\n\nPress OK to continue saving or Cancel to view queue.')) {
                alert('Saved. Please review duplicates in Queue.');
            } else {
                // open queue for review
                await loadQueue();
                showPage('queue');
            }
        } else {
            alert('Ticket saved successfully!');
        }

        resetForm();
        await loadQueue();
        showPage('queue');
    } catch (error) {
        alert('Error saving ticket: ' + error.message);
    } finally {
        setLoading(btn, false);
    }
}

/* -----------------------------
   Queue & Booking
   ----------------------------- */

async function loadQueue() {
    const queueContent = document.getElementById('queue-content');
    queueContent.innerHTML = '<p>Loading...</p>';
    try {
        if (currentUser && currentUser.demo) {
            tickets = JSON.parse(localStorage.getItem('demo_tickets') || '[]');
            displayQueue(tickets);
            return;
        }

        const queueData = await callAppsScript('getQueue', { status: 'all' });
        // ensure date fields are strings so JS new Date works safely
        tickets = (Array.isArray(queueData) ? queueData : []);
        displayQueue(tickets);
    } catch (error) {
        queueContent.innerHTML = `<div class="error">Error loading queue: ${escapeHtml(error.message)}</div>`;
    }
}

function displayQueue(ticketsData) {
    const queueContent = document.getElementById('queue-content');
    if (!ticketsData || ticketsData.length === 0) {
        queueContent.innerHTML = '<p>No tickets found. Create your first ticket in Quick Entry!</p>';
        return;
    }

    queueContent.innerHTML = ticketsData.map(ticket => {
        const created = ticket.created_at ? new Date(ticket.created_at).toLocaleString() : '—';
        const jdate = ticket.journey_date ? new Date(ticket.journey_date).toLocaleDateString() : '—';
        const firstName = ticket.passengers && ticket.passengers[0] ? ticket.passengers[0].name : 'Unknown Passenger';
        const remarkHtml = ticket.remark ? `<p><strong>Remarks:</strong> ${escapeHtml(ticket.remark)}</p>` : '';
        const statusBadge = `<span class="status-badge status-${escapeHtml(ticket.status || 'unknown')}">${escapeHtml(ticket.status || 'unknown')}</span>`;

        // Buttons: Mark as Booked (only in real non-demo) + show assign if admin
        const bookBtn = (!currentUser || currentUser.demo) ? '' : `<button onclick="markAsBooked('${escapeHtml(ticket.id)}')" class="btn-primary" style="margin-top:10px;">Mark as Booked</button>`;
        const assignBtn = (currentUser && currentUser.role === 'admin') ? `<button onclick="openAssignDialog('${escapeHtml(ticket.id)}')" class="btn-secondary" style="margin-top:10px;">Assign</button>` : '';

        const passengerList = (ticket.passengers && ticket.passengers.length) ? `<div style="margin-top:8px;"><strong>Passengers:</strong> ${ticket.passengers.map(p => escapeHtml(p.name)).join(', ')}</div>` : '';

        return `
            <div class="queue-item">
                <div class="queue-header" style="display:flex; justify-content:space-between; gap:20px;">
                    <div class="passenger-info">
                        <h4>${escapeHtml(firstName)}</h4>
                        <p><strong>Route:</strong> ${escapeHtml(ticket.from_station)} → ${escapeHtml(ticket.to_station)}</p>
                        <p><strong>Class:</strong> ${escapeHtml(ticket.class || '')} | <strong>Date:</strong> ${escapeHtml(jdate)}</p>
                        <p><strong>Mobile:</strong> ${escapeHtml(ticket.primary_mobile || 'N/A')} | <strong>Passengers:</strong> ${ticket.passengers?.length || 0}</p>
                        ${passengerList}
                        ${remarkHtml}
                        <p><small>Created: ${escapeHtml(created)}</small></p>
                    </div>
                    <div class="queue-actions" style="text-align:right;">
                        ${statusBadge}
                        <div style="margin-top:10px;">${bookBtn} ${assignBtn}</div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

/* Prompt & mark booked */
async function markAsBooked(ticketId) {
    try {
        // Ask for ticket number
        const ticketNumber = prompt('Enter ticket number (e.g., TKT12345)', 'TKT' + Date.now());
        if (!ticketNumber) {
            alert('Ticket number required');
            return;
        }

        // Ask for service charge and payment status
        const serviceChargeRaw = prompt('Service charge (numeric)', '50');
        const serviceCharge = parseFloat(serviceChargeRaw || '0') || 0;
        const paid = confirm('Was payment received? OK = Yes, Cancel = No');
        const paymentStatus = paid ? 'paid' : 'unpaid';

        const bookingData = {
            call_id: ticketId,
            ticket_number: ticketNumber,
            service_charge: serviceCharge,
            payment_status: paymentStatus,
            amount_net_debit: 0,
            amount_credit: 0,
            debit_bank: '',
            credit_bank: '',
            notes: '',
            staff_id: currentUser?.staff_id || ''
        };

        if (currentUser && currentUser.demo) {
            // demo flow
            const demo = JSON.parse(localStorage.getItem('demo_tickets') || '[]');
            const idx = demo.findIndex(t => t.id === ticketId);
            if (idx !== -1) {
                demo[idx].status = 'booked';
                demo[idx].booking_ticket_number = ticketNumber;
                demo[idx].payment_status = paymentStatus;
                demo[idx].service_charge = serviceCharge;
                localStorage.setItem('demo_tickets', JSON.stringify(demo));
                alert('Demo: marked booked locally');
                await loadQueue();
                return;
            } else {
                alert('Demo: ticket not found');
                return;
            }
        }

        await callAppsScript('markBooked', bookingData);
        alert('Ticket marked as booked!');
        await loadQueue();
    } catch (error) {
        alert('Error marking as booked: ' + error.message);
    }
}

/* Admin assign dialog (simple prompt) */
async function openAssignDialog(callId) {
    try {
        const staffId = prompt('Enter staff_id to assign to (e.g., staff1)', '');
        if (!staffId) return;
        const result = await callAppsScript('assignTicket', { call_ids: [callId], staff_id: staffId });
        alert('Assigned updated: ' + (result.updated || 0) + ' row(s)');
        await loadQueue();
    } catch (error) {
        alert('Assign failed: ' + error.message);
    }
}

/* -----------------------------
   Reports
   ----------------------------- */
async function generateReport() {
    const fromDate = document.getElementById('report-from').value;
    const toDate = document.getElementById('report-to').value;
    const reportContent = document.getElementById('report-content');

    reportContent.innerHTML = '<p>Loading report...</p>';

    try {
        if (currentUser && currentUser.demo) {
            const demoData = JSON.parse(localStorage.getItem('demo_tickets') || '[]');
            const receivedCount = demoData.filter(t => t.status === 'received').length;
            const totalCount = demoData.length;
            reportContent.innerHTML = `
                <div class="call-form">
                    <h3>Demo Report: ${escapeHtml(fromDate)} to ${escapeHtml(toDate)}</h3>
                    <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(200px,1fr)); gap:20px; margin:20px 0;">
                        <div style="text-align:center; padding:20px; background:#e3f2fd; border-radius:10px;">
                            <div style="font-size:2rem; font-weight:bold; color:#1976d2;">${totalCount}</div>
                            <div>Total Tickets</div>
                        </div>
                        <div style="text-align:center; padding:20px; background:#fff3e0; border-radius:10px;">
                            <div style="font-size:2rem; font-weight:bold; color:#f57c00;">${receivedCount}</div>
                            <div>Pending</div>
                        </div>
                    </div>
                    <p><em>This is demo data. Connect to backend for real reports.</em></p>
                </div>
            `;
            return;
        }

        const reportData = await callAppsScript('getReport', { date_from: fromDate, date_to: toDate });

        reportContent.innerHTML = `
            <div class="call-form">
                <h3>Report: ${escapeHtml(fromDate)} to ${escapeHtml(toDate)}</h3>
                <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(200px,1fr)); gap:20px; margin:20px 0;">
                    <div style="text-align:center; padding:20px; background:#e3f2fd; border-radius:10px;">
                        <div style="font-size:2rem; font-weight:bold; color:#1976d2;">${escapeHtml(reportData.totals.calls || 0)}</div>
                        <div>Total Calls</div>
                    </div>
                    <div style="text-align:center; padding:20px; background:#e8f5e8; border-radius:10px;">
                        <div style="font-size:2rem; font-weight:bold; color:#388e3c;">${escapeHtml(reportData.totals.booked || 0)}</div>
                        <div>Booked</div>
                    </div>
                    <div style="text-align:center; padding:20px; background:#fff3e0; border-radius:10px;">
                        <div style="font-size:2rem; font-weight:bold; color:#f57c00;">${escapeHtml(reportData.totals.pending || 0)}</div>
                        <div>Pending</div>
                    </div>
                </div>
                <div>
                    <h4>Staff performance</h4>
                    <pre>${escapeHtml(JSON.stringify(reportData.staff_performance || {}, null, 2))}</pre>
                </div>
            </div>
        `;
    } catch (error) {
        reportContent.innerHTML = `<div class="error">Error generating report: ${escapeHtml(error.message)}</div>`;
    }
}

/* -----------------------------
   Admin: Backend URL & status
   ----------------------------- */
function saveScriptUrl() {
    const urlInput = document.getElementById('script-url');
    const url = (urlInput && urlInput.value || '').trim();
    if (!url) { alert('Please enter Apps Script URL'); return; }
    if (!url.startsWith('https://script.google.com/')) {
        alert('Please enter a valid Google Apps Script URL');
        return;
    }
    CONFIG.scriptUrl = url;
    localStorage.setItem('scriptUrl', url);
    checkBackendStatus();
    alert('Apps Script URL saved!');
}

async function checkBackendStatus() {
    const statusElement = document.getElementById('backend-status');
    if (!statusElement) return;
    statusElement.textContent = 'Checking connection...';
    try {
        const result = await testBackend();
        if (result.connected) {
            statusElement.textContent = '✅ Connected to Apps Script';
            statusElement.style.color = 'green';
        } else {
            statusElement.textContent = '❌ ' + result.message;
            statusElement.style.color = 'red';
        }
    } catch (error) {
        statusElement.textContent = '❌ Error: ' + error.message;
        statusElement.style.color = 'red';
    }
}

/* -----------------------------
   Logout
   ----------------------------- */
function logout() {
    currentUser = null;
    document.getElementById('main-app').classList.remove('active');
    document.getElementById('login-screen').classList.add('active');
    document.getElementById('login-email').value = '';
    clearStatus();
}

/* -----------------------------
   Initialization
   ----------------------------- */
document.addEventListener('DOMContentLoaded', () => {
    // Enter key for login
    const loginEmail = document.getElementById('login-email');
    if (loginEmail) {
        loginEmail.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleLogin();
        });
    }

    // Hook quick-entry buttons
    const addPaxBtn = document.querySelector('button[onclick="addPassenger()"]');
    if (addPaxBtn) addPaxBtn.addEventListener('click', addPassenger);

    const saveBtn = document.querySelector('.btn-primary');
    if (saveBtn) saveBtn.addEventListener('click', (e) => { e.preventDefault(); saveCall(); });

    // Set today's date
    const today = new Date().toISOString().split('T')[0];
    if (document.getElementById('journey-date')) document.getElementById('journey-date').value = today;

    // Load saved Apps Script URL
    const savedUrl = localStorage.getItem('scriptUrl');
    if (savedUrl) {
        document.getElementById('script-url').value = savedUrl;
        CONFIG.scriptUrl = savedUrl;
    }

    // Load demo tickets (if any)
    tickets = JSON.parse(localStorage.getItem('demo_tickets') || '[]');

    console.log('Frontend initialized');
});
