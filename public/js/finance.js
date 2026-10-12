/**
 * Pinnacle Bay Hotel Management System - Finance Dashboard Module
 * Dynamic Unified Folio and Payment Settlement Controllers
 */

let currentUnifiedInv = null;

/**
 * Dynamically populates the Itemized Folio Ledger table inside the Guest Folio modal
 * and syncs with the printable tax receipt preview.
 */
async function populateFolioItemizedLedger(inv) {
  const listEl = document.getElementById('folioItemizedList');
  const recListEl = document.getElementById('rec-itemized-list');
  if (!listEl && !recListEl) return;

  const totalAmount = parseFloat(inv.total_amount || inv.amount || 0);
  const roomNo = inv.room_number || inv.room || '';

  // 1. Fetch live delivered dining orders for this room
  let diningOrders = [];
  try {
    if (roomNo && roomNo !== '-' && roomNo !== 'No Room') {
      const API_BASE = window.location.origin.includes('localhost:3000') ? '' : 'http://localhost:3000';
      const res = await fetch(`${API_BASE}/api/orders/room-service?room=${encodeURIComponent(roomNo)}`);
      if (res.ok) {
        const d = await res.json();
        const orders = d.orders || d.data || [];
        diningOrders = orders.filter(o => {
          const st = (o.status || '').toLowerCase().trim();
          return st === 'delivered' || st === 'billed' || st === 'paid' || st === 'completed';
        });
      }
    }
  } catch (err) {
    console.warn('Could not fetch dining orders for folio:', err);
  }

  const diningTotal = diningOrders.reduce((sum, o) => sum + Number(o.total_price || 0), 0);

  // Parse items from inv.items if available
  const items = Array.isArray(inv.items) ? inv.items : [];
  const roomItem = items.find(it => (it.category || '').toLowerCase().includes('room'));
  const packageItems = items.filter(it => (it.category || '').toLowerCase().includes('package'));
  const customItems = items.filter(it => (it.category || '').toLowerCase().includes('custom') || (it.category || '').toLowerCase().includes('incidental'));
  const discountItem = items.find(it => (it.category || '').toLowerCase().includes('discount') || parseFloat(it.total_price || 0) < 0);
  const diningItem = items.find(it => (it.category || '').toLowerCase().includes('dining') || (it.category || '').toLowerCase().includes('food') || (it.category || '').toLowerCase().includes('meal'));

  const finalDiningTotal = diningTotal > 0 ? diningTotal : (diningItem ? parseFloat(diningItem.total_price || 0) : 0);

  let roomPrice = roomItem ? parseFloat(roomItem.total_price || 0) : 0;
  let roomDesc = roomItem ? roomItem.description : (roomNo ? `Room Stay (${roomNo})` : 'Room Accommodation');

  if (!roomItem) {
    const pkgTotal = packageItems.reduce((s, it) => s + parseFloat(it.total_price || 0), 0);
    const customTotal = customItems.reduce((s, it) => s + parseFloat(it.total_price || 0), 0);
    const discAmount = discountItem ? Math.abs(parseFloat(discountItem.total_price || 0)) : 0;
    roomPrice = Math.max(0, totalAmount - finalDiningTotal - pkgTotal - customTotal + discAmount);
  }

  // 2. Build HTML for Modal (#folioItemizedList)
  if (listEl) {
    let html = `
      <div style="display: flex; justify-content: space-between; color: #cbd5e1;">
        <span>🛏️ ${roomDesc}</span>
        <span style="font-weight: 600;">Rs. ${roomPrice.toFixed(2)}</span>
      </div>
    `;

    // Dining Section
    if (finalDiningTotal > 0 || diningOrders.length > 0) {
      html += `
        <div style="border-top: 1px dashed #1e293b; padding-top: 6px;">
          <div style="display: flex; justify-content: space-between; color: #38bdf8; font-weight: 600; font-size: 0.8rem; margin-bottom: 4px;">
            <span>🍽️ In-Room Dining &amp; Meals</span>
            <span>Rs. ${finalDiningTotal.toFixed(2)}</span>
          </div>
          <div id="folioDiningItemsList" style="padding-left: 12px; font-size: 0.75rem; color: #94a3b8; display: flex; flex-direction: column; gap: 2px;">
      `;
      if (diningOrders.length > 0) {
        diningOrders.forEach(o => {
          const dName = o.dish_name || o.item_name || 'In-Room Dish';
          const qty = o.quantity || 1;
          const p = Number(o.total_price || 0).toFixed(2);
          html += `
            <div style="display: flex; justify-content: space-between;">
              <span>• ${dName} x${qty}</span>
              <span>Rs. ${p}</span>
            </div>
          `;
        });
      } else {
        html += `
          <div style="display: flex; justify-content: space-between;">
            <span>• In-Room Dining Charges</span>
            <span>Rs. ${finalDiningTotal.toFixed(2)}</span>
          </div>
        `;
      }
      html += `
          </div>
        </div>
      `;
    }

    // Package Add-ons
    packageItems.forEach(pkg => {
      html += `
        <div style="border-top: 1px dashed #1e293b; padding-top: 6px; display: flex; justify-content: space-between; color: #cbd5e1; font-size: 0.8rem;">
          <span>✨ ${pkg.description || 'Package Add-on'}</span>
          <span style="font-weight: 600;">Rs. ${parseFloat(pkg.total_price || 0).toFixed(2)}</span>
        </div>
      `;
    });

    // Special Charges
    customItems.forEach(chg => {
      html += `
        <div style="border-top: 1px dashed #1e293b; padding-top: 6px; display: flex; justify-content: space-between; color: #cbd5e1; font-size: 0.8rem;">
          <span>📌 ${chg.description || 'Special Charge'}</span>
          <span style="font-weight: 600;">Rs. ${parseFloat(chg.total_price || 0).toFixed(2)}</span>
        </div>
      `;
    });

    // Discount
    if (discountItem && parseFloat(discountItem.total_price || 0) !== 0) {
      const discVal = Math.abs(parseFloat(discountItem.total_price || 0));
      html += `
        <div style="border-top: 1px dashed #1e293b; padding-top: 6px; display: flex; justify-content: space-between; color: #34d399; font-size: 0.8rem;">
          <span>🏷️ ${discountItem.description || 'Discount'}</span>
          <span style="font-weight: 600;">-Rs. ${discVal.toFixed(2)}</span>
        </div>
      `;
    }

    // Taxes & Service Charge
    html += `
      <div style="border-top: 1px dashed #1e293b; padding-top: 6px; display: flex; justify-content: space-between; color: #94a3b8; font-size: 0.8rem;">
        <span>Service Charge &amp; Tax</span>
        <span style="color: #10b981; font-weight: 600;">Included</span>
      </div>
    `;

    listEl.innerHTML = html;
  }

  // 3. Build HTML for Printable Receipt (#rec-itemized-list)
  if (recListEl) {
    let recHtml = `
      <div style="display: flex; justify-content: space-between;">
        <span>🛏️ ${roomDesc}</span>
        <span style="font-weight: 600;">Rs. ${roomPrice.toFixed(2)}</span>
      </div>
    `;

    if (finalDiningTotal > 0 || diningOrders.length > 0) {
      recHtml += `
        <div style="border-top: 1px dashed #334155; padding-top: 4px; margin-top: 4px;">
          <div style="display: flex; justify-content: space-between; font-weight: 600; color: #38bdf8;">
            <span>🍽️ In-Room Dining &amp; Meals</span>
            <span>Rs. ${finalDiningTotal.toFixed(2)}</span>
          </div>
          <div style="padding-left: 10px; font-size: 0.72rem; color: #94a3b8; margin-top: 2px;">
      `;
      if (diningOrders.length > 0) {
        diningOrders.forEach(o => {
          const dName = o.dish_name || o.item_name || 'In-Room Dish';
          const qty = o.quantity || 1;
          const p = Number(o.total_price || 0).toFixed(2);
          recHtml += `<div style="display: flex; justify-content: space-between;"><span>• ${dName} x${qty}</span><span>Rs. ${p}</span></div>`;
        });
      } else {
        recHtml += `<div style="display: flex; justify-content: space-between;"><span>• In-Room Dining Charges</span><span>Rs. ${finalDiningTotal.toFixed(2)}</span></div>`;
      }
      recHtml += `</div></div>`;
    }

    packageItems.forEach(pkg => {
      recHtml += `
        <div style="border-top: 1px dashed #334155; padding-top: 4px; display: flex; justify-content: space-between;">
          <span>✨ ${pkg.description || 'Package Add-on'}</span>
          <span style="font-weight: 600;">Rs. ${parseFloat(pkg.total_price || 0).toFixed(2)}</span>
        </div>
      `;
    });

    customItems.forEach(chg => {
      recHtml += `
        <div style="border-top: 1px dashed #334155; padding-top: 4px; display: flex; justify-content: space-between;">
          <span>📌 ${chg.description || 'Special Charge'}</span>
          <span style="font-weight: 600;">Rs. ${parseFloat(chg.total_price || 0).toFixed(2)}</span>
        </div>
      `;
    });

    if (discountItem && parseFloat(discountItem.total_price || 0) !== 0) {
      const discVal = Math.abs(parseFloat(discountItem.total_price || 0));
      recHtml += `
        <div style="border-top: 1px dashed #334155; padding-top: 4px; display: flex; justify-content: space-between; color: #34d399;">
          <span>🏷️ ${discountItem.description || 'Discount'}</span>
          <span style="font-weight: 600;">-Rs. ${discVal.toFixed(2)}</span>
        </div>
      `;
    }

    recHtml += `
      <div style="border-top: 1px dashed #334155; padding-top: 4px; display: flex; justify-content: space-between; color: #94a3b8;">
        <span>Service Charge &amp; Resort Tax</span>
        <span style="font-weight: 600; color: #10b981;">Included</span>
      </div>
    `;

    recListEl.innerHTML = recHtml;
  }
}

/**
 * Opens Unified Folio Modal adapting dynamically for both PAID and PENDING states
 * @param {string} invoiceId 
 */
async function openUnifiedFolio(invoiceId) {
  console.log('Button clicked: Open Unified Folio');
  try {
    const API_BASE = window.location.origin.includes('localhost:3000') ? '' : 'http://localhost:3000';
    
    // Fetch specific invoice details
    const res = await fetch(`${API_BASE}/api/finance/invoices/${invoiceId}`);
    let data;
    if (res.ok) {
      data = await res.json();
    } else {
      // Fallback to local invoices cache if API call encounters issue
      const local = (typeof invoices !== 'undefined' && Array.isArray(invoices))
        ? invoices.find(i => (i.id || i.invoice_id) === invoiceId)
        : null;
      if (local) {
        data = { invoice: local };
      } else {
        throw new Error(`Invoice not found (${res.status})`);
      }
    }

    const inv = data.invoice || data;
    currentUnifiedInv = inv;

    // 1. Fill Folio Data
    const elId = document.getElementById('m-folio-id');
    const elGuest = document.getElementById('m-folio-guest');
    const elRoom = document.getElementById('m-folio-room');
    const elEmail = document.getElementById('m-folio-email');
    const elPhone = document.getElementById('m-folio-phone');
    const elTotal = document.getElementById('m-folio-total');

    if (elId) elId.textContent = inv.invoice_id || inv.id || invoiceId;
    if (elGuest) elGuest.textContent = inv.guest_name || inv.guest || 'Guest';
    if (elRoom) elRoom.textContent = inv.room_number || inv.room || '-';
    if (elEmail) elEmail.textContent = inv.guest_email || 'Not provided';
    if (elPhone) elPhone.textContent = inv.guest_phone || 'Not provided';
    if (elTotal) elTotal.textContent = `Rs. ${parseFloat(inv.total_amount || inv.amount || 0).toFixed(2)}`;

    // Populate Single Consolidated Itemized Folio Ledger & Printable breakdown
    await populateFolioItemizedLedger(inv);

    const statusVal = (inv.payment_status || inv.status || '').toUpperCase();
    const isPending = statusVal === 'PENDING' || statusVal !== 'PAID';
    
    const statusBadge = document.getElementById('m-folio-status');
    const paymentSection = document.getElementById('m-payment-section');
    const settleBtn = document.getElementById('btnConfirmSettle') || document.getElementById('m-btn-settle');
    const paidActions = document.getElementById('m-paid-actions');

    if (isPending) {
      // PENDING STATE: Show settlement form
      if (statusBadge) {
        statusBadge.className = "ml-1 font-bold px-2 py-0.5 rounded text-[11px] bg-amber-500/20 text-amber-400 border border-amber-500/30";
        statusBadge.textContent = "PENDING";
      }
      if (paymentSection) paymentSection.classList.remove('hidden');
      if (settleBtn) settleBtn.classList.remove('hidden');
      if (paidActions) paidActions.classList.add('hidden');
    } else {
      // PAID STATE: Hide settlement inputs, show settled info and resend options
      if (statusBadge) {
        statusBadge.className = "ml-1 font-bold px-2 py-0.5 rounded text-[11px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30";
        statusBadge.textContent = `PAID (${inv.payment_method || inv.method || 'Cash'})`;
      }
      if (paymentSection) paymentSection.classList.add('hidden');
      if (settleBtn) settleBtn.classList.add('hidden');
      if (paidActions) paidActions.classList.remove('hidden');
    }

    const modal = document.getElementById('folio-settle-modal');
    if (modal) modal.classList.remove('hidden');
  } catch (err) {
    console.error('Error opening unified folio:', err);
    alert(`Error opening folio: ${err.message}`);
    if (typeof showToast === 'function') {
      showToast(`Error opening folio: ${err.message}`);
    }
  }
}

function closeUnifiedFolio() {
  console.log('Button clicked: Close Unified Folio');
  const modal = document.getElementById('folio-settle-modal');
  if (modal) modal.classList.add('hidden');
  currentUnifiedInv = null;
}

// Aliases for backwards compatibility with earlier settlement modal calls
function openSettleModal(invoiceId) {
  console.log('Button clicked: Open Settle Modal');
  openUnifiedFolio(invoiceId);
}

function closeSettleModal() {
  console.log('Button clicked: Close Settle Modal');
  closeUnifiedFolio();
}

/**
 * Handles Settlement from within the Unified Folio Modal
 */
let isSettleSubmitting = false;
async function handleUnifiedSettleSubmit(e) {
  if (e && typeof e.preventDefault === 'function') e.preventDefault();
  console.log('Button clicked: Confirm & Settle Bill');
  if (isSettleSubmitting) return;
  if (!currentUnifiedInv) return;

  isSettleSubmitting = true;
  const invId = currentUnifiedInv.invoice_id || currentUnifiedInv.id;
  const methodSelect = document.getElementById('m-payment-method');
  const method = methodSelect ? methodSelect.value : 'Cash';
  const settleBtn = document.getElementById('btnConfirmSettle') || document.getElementById('m-btn-settle');

  if (settleBtn) {
    settleBtn.disabled = true;
    settleBtn.textContent = 'Processing Settlement...';
  }

  const API_BASE = window.location.origin.includes('localhost:3000') ? '' : 'http://localhost:3000';

  try {
    const res = await fetch(`${API_BASE}/api/finance/invoices/${invId}/settle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payment_method: method })
    });

    let data;
    try {
      data = await res.json();
    } catch (parseErr) {
      data = {};
    }

    if (!res.ok || !data.success) {
      const errMsg = data.message || data.error || `Server error (${res.status}): Failed to settle invoice`;
      throw new Error(errMsg);
    }

    if (typeof showToast === 'function') {
      showToast(`Invoice ${invId} successfully settled via ${method}!`);
    }

    closeUnifiedFolio();
    if (typeof fetchInvoices === 'function') {
      fetchInvoices();
    }
    if (typeof updateFinanceOverviewMetrics === 'function') {
      updateFinanceOverviewMetrics();
    }
  } catch (err) {
    console.error('Settlement error:', err);
    alert(`Failed to settle invoice: ${err.message}`);
    if (typeof showToast === 'function') {
      showToast(`Error: ${err.message}`);
    }
  } finally {
    isSettleSubmitting = false;
    if (settleBtn) {
      settleBtn.disabled = false;
      settleBtn.textContent = '💳 Confirm & Settle Bill';
    }
  }
}

/**
 * Triggers folio receipt printing directly from unified modal
 */
function triggerPrintFromFolio() {
  console.log('Button clicked: Print From Folio');
  if (!currentUnifiedInv) return;
  if (typeof viewReceipt === 'function') {
    viewReceipt(
      currentUnifiedInv.invoice_id || currentUnifiedInv.id,
      currentUnifiedInv.guest_name || currentUnifiedInv.guest,
      currentUnifiedInv.room_number || currentUnifiedInv.room,
      currentUnifiedInv.total_amount || currentUnifiedInv.amount,
      currentUnifiedInv.payment_method || currentUnifiedInv.method,
      currentUnifiedInv.payment_status || currentUnifiedInv.status,
      currentUnifiedInv.created_at || currentUnifiedInv.date
    );
  }
}

/**
 * Simulates resending receipt to guest's email
 */
function resendReceiptEmail() {
  console.log('Button clicked: Resend Receipt Email');
  if (!currentUnifiedInv) return;
  const email = currentUnifiedInv.guest_email || 'guest@pinnaclebay.com';
  if (typeof showToast === 'function') {
    showToast(`Receipt folio email dispatched to ${email}`);
  }
}

/**
 * Fetch and render payroll disbursements in Staff & Payroll view
 */
async function loadPayrollData() {
  const tbody = document.getElementById('payroll-table-body');
  if (!tbody) return;

  try {
    const res = await fetch('/api/finance/payroll');
    if (!res.ok) {
      throw new Error(`Failed to load payroll records (${res.status})`);
    }
    const records = await res.json();

    if (!records || !records.length) {
      tbody.innerHTML = `<tr><td colspan="10" class="px-6 py-8 text-center text-slate-500">No payroll disbursements recorded yet.</td></tr>`;
      return;
    }

    tbody.innerHTML = records.map(p => {
      const staffName = p.name || p.staff_name || p.full_name || p.username || 'Staff Member';
      const staffRole = p.designation || p.role || 'Staff';
      const monthYear = p.month_year || '-';
      const basicSal = parseFloat(p.basic_salary || 0).toFixed(2);
      const allowances = parseFloat(p.allowances || 0).toFixed(2);
      const deductions = parseFloat(p.deductions || 0).toFixed(2);
      const netSalary = parseFloat(p.net_salary || 0).toFixed(2);
      const payStatus = p.payment_status || 'PAID';
      const payDate = p.payment_date ? new Date(p.payment_date).toLocaleDateString() : '-';
      const payrollId = p.payroll_id || p.id || '';

      return `
      <tr class="hover:bg-slate-800/30 transition">
        <td class="px-6 py-4 font-semibold text-white">${staffName}</td>
        <td class="px-6 py-4 text-slate-400"><span class="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-[11px]">${staffRole}</span></td>
        <td class="px-6 py-4 font-medium text-slate-300">${monthYear}</td>
        <td class="px-6 py-4 text-slate-300">Rs. ${basicSal}</td>
        <td class="px-6 py-4 text-emerald-400">+Rs. ${allowances}</td>
        <td class="px-6 py-4 text-rose-400">-Rs. ${deductions}</td>
        <td class="px-6 py-4 font-bold text-amber-400">Rs. ${netSalary}</td>
        <td class="px-6 py-4">
          <span class="px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            ${payStatus}
          </span>
        </td>
        <td class="px-6 py-4 text-slate-400">${payDate}</td>
        <td class="px-6 py-4 text-right">
          <button onclick="event.stopPropagation(); deletePayrollRecord('${payrollId}')" class="px-2.5 py-1 text-[11px] font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg border border-rose-500/20 transition">
            Delete
          </button>
        </td>
      </tr>
      `;
    }).join('');
  } catch (err) {
    console.error('Error loading payroll:', err);
    tbody.innerHTML = `<tr><td colspan="10" class="px-6 py-8 text-center text-rose-400">Failed to load payroll records.</td></tr>`;
  }
}

let staffCache = [];

function formatPeriodToYYYYMM(val) {
  if (!val) {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }
  const str = String(val).trim();
  if (/^\d{4}-\d{1,2}$/.test(str)) {
    const parts = str.split('-');
    return `${parts[0]}-${String(parts[1]).padStart(2, '0')}`;
  }
  const monthNames = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
  const parts = str.split(/[\s,/-]+/);
  let year = new Date().getFullYear();
  let month = new Date().getMonth() + 1;

  for (const p of parts) {
    const mIdx = monthNames.indexOf(p.toLowerCase());
    if (mIdx !== -1) {
      month = mIdx + 1;
    } else if (/^\d{4}$/.test(p)) {
      year = parseInt(p, 10);
    } else if (/^\d{1,2}$/.test(p) && parts.length === 2) {
      const num = parseInt(p, 10);
      if (num >= 1 && num <= 12) month = num;
    }
  }

  return `${year}-${String(month).padStart(2, '0')}`;
}

async function openAddPayrollModal() {
  console.log('Button clicked: Open Add Payroll Modal');
  const modal = document.getElementById('add-payroll-modal');
  const select = document.getElementById('pr-staff-select');
  
  try {
    const res = await fetch('/api/finance/employees');
    if (!res.ok) {
      throw new Error(`Failed to load employees (${res.status})`);
    }
    staffCache = await res.json();
    
    if (select) {
      select.innerHTML = '<option value="">-- Choose Employee --</option>' + 
        staffCache.map(s => {
          const sId = s.staff_id || s.id || s.user_id;
          const sName = s.name || s.full_name || s.username || 'Employee';
          const sRole = s.designation || s.role || 'Staff';
          return `<option value="${sId}">${sName} (${sRole})</option>`;
        }).join('');
    }
    
    document.getElementById('pr-basic').value = '';
    document.getElementById('pr-allowances').value = '0.00';
    document.getElementById('pr-deductions').value = '0.00';
    document.getElementById('pr-net-display').textContent = 'Rs. 0.00';
    
    const summaryRow = document.getElementById('pr-attendance-summary');
    if (summaryRow) summaryRow.classList.add('hidden');

    const bWorked = document.getElementById('pr-badge-worked');
    if (bWorked) bWorked.textContent = 'Worked: 0 Days';
    const bOt = document.getElementById('pr-badge-ot');
    if (bOt) bOt.textContent = 'OT Hours: 0 hrs';
    const bLeaves = document.getElementById('pr-badge-leaves');
    if (bLeaves) bLeaves.textContent = 'Leaves: 0 Days';

    const warning = document.getElementById('pr-warning');
    if (warning) warning.classList.add('hidden');
    if (modal) modal.classList.remove('hidden');
  } catch (err) {
    console.error('Failed to load employee list:', err);
    alert(`Failed to load employee list: ${err.message}`);
  }
}

function closeAddPayrollModal() {
  console.log('Button clicked: Close Add Payroll Modal');
  const modal = document.getElementById('add-payroll-modal');
  if (modal) modal.classList.add('hidden');
}

async function onStaffSelected() {
  const staffSelect = document.getElementById('pr-staff-select');
  const staffId = staffSelect ? staffSelect.value : '';
  const summaryRow = document.getElementById('pr-attendance-summary');

  if (!staffId) {
    if (summaryRow) summaryRow.classList.add('hidden');
    document.getElementById('pr-basic').value = '0.00';
    document.getElementById('pr-allowances').value = '0.00';
    document.getElementById('pr-deductions').value = '0.00';
    calculateNetPayout();
    return;
  }

  const staff = staffCache.find(s => (s.staff_id == staffId || s.id == staffId || s.user_id == staffId));
  let baseSalary = staff && staff.basic_salary ? parseFloat(staff.basic_salary) : 0;
  if (baseSalary > 0) {
    document.getElementById('pr-basic').value = baseSalary.toFixed(2);
  }

  const periodVal = document.getElementById('pr-month-year') ? document.getElementById('pr-month-year').value : 'September 2026';
  const monthParam = formatPeriodToYYYYMM(periodVal);

  try {
    const res = await fetch(`/api/finance/payroll/attendance-summary?staff_id=${encodeURIComponent(staffId)}&month=${encodeURIComponent(monthParam)}`);
    if (res.ok) {
      const data = await res.json();

      // 1. Basic Salary (from API / staff profile)
      if (data.basic_salary !== undefined && data.basic_salary !== null) {
        baseSalary = parseFloat(data.basic_salary) || 0;
        document.getElementById('pr-basic').value = baseSalary.toFixed(2);
      }

      // 2. Summary badges
      const daysWorked = data.days_worked !== undefined ? data.days_worked : 0;
      const otHours = data.ot_hours !== undefined ? data.ot_hours : 0;
      const leaveDays = data.leave_days !== undefined ? data.leave_days : 0;

      const bWorked = document.getElementById('pr-badge-worked');
      if (bWorked) bWorked.textContent = `Worked: ${daysWorked} Days`;
      const bOt = document.getElementById('pr-badge-ot');
      if (bOt) bOt.textContent = `OT Hours: ${otHours} hrs`;
      const bLeaves = document.getElementById('pr-badge-leaves');
      if (bLeaves) bLeaves.textContent = `Leaves: ${leaveDays} Days`;

      if (summaryRow) summaryRow.classList.remove('hidden');

      // 3. Allowances: Pre-fill with (OT Hours * Rs. 1,500)
      const allowances = (parseFloat(otHours) || 0) * 1500;
      document.getElementById('pr-allowances').value = allowances.toFixed(2);

      // 4. Deductions: Pre-fill with (Unpaid Leaves * Daily Rate)
      const dailyRate = baseSalary > 0 ? (baseSalary / 30) : 0;
      const deductions = (parseFloat(leaveDays) || 0) * dailyRate;
      document.getElementById('pr-deductions').value = deductions.toFixed(2);
    }
  } catch (err) {
    console.warn('Could not fetch attendance summary:', err);
  }

  // Recalculate Total Net Payout = Basic Salary + Allowances - Deductions
  calculateNetPayout();
}

function calculateNetPayout() {
  const basic = parseFloat(document.getElementById('pr-basic').value) || 0;
  const allow = parseFloat(document.getElementById('pr-allowances').value) || 0;
  const deduct = parseFloat(document.getElementById('pr-deductions').value) || 0;
  const net = (basic + allow) - deduct;

  const netDisplay = document.getElementById('pr-net-display');
  const warning = document.getElementById('pr-warning');
  const submitBtn = document.querySelector('#payrollForm button[type="submit"], #payroll-form button[type="submit"]');

  if (netDisplay) {
    netDisplay.textContent = `Rs. ${net.toFixed(2)}`;
    if (net < 0) {
      netDisplay.className = 'text-lg font-bold text-rose-400';
    } else {
      netDisplay.className = 'text-lg font-bold text-amber-400';
    }
  }

  if (net < 0) {
    if (warning) warning.classList.remove('hidden');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.classList.add('opacity-50', 'cursor-not-allowed');
    }
  } else {
    if (warning) warning.classList.add('hidden');
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    }
  }
}

let isPayrollSubmitting = false;
async function handlePayrollSubmit(e) {
  if (e && typeof e.preventDefault === 'function') e.preventDefault();
  console.log('Button clicked: Disburse & Pay');
  if (isPayrollSubmitting) return;

  const staffSelect = document.getElementById('pr-staff-select');
  const staffId = staffSelect ? staffSelect.value : '';
  const monthYear = document.getElementById('pr-month-year') ? document.getElementById('pr-month-year').value : '';
  const basic = document.getElementById('pr-basic') ? document.getElementById('pr-basic').value : '0';
  const allow = document.getElementById('pr-allowances') ? document.getElementById('pr-allowances').value : '0';
  const deduct = document.getElementById('pr-deductions') ? document.getElementById('pr-deductions').value : '0';

  if (!staffId) {
    alert("Please select an employee first.");
    return;
  }

  const basicNum = parseFloat(basic);
  const allowNum = parseFloat(allow) || 0;
  const deductNum = parseFloat(deduct) || 0;

  if (isNaN(basicNum) || basicNum < 0 || allowNum < 0 || deductNum < 0 || (basicNum + allowNum) < deductNum) {
    alert("Invalid numeric values or deductions exceed earnings.");
    return;
  }

  const selectedStaff = staffCache.find(s => (s.staff_id == staffId || s.id == staffId || s.user_id == staffId));
  const sName = selectedStaff ? (selectedStaff.name || selectedStaff.username || selectedStaff.full_name) : '';
  const sRole = selectedStaff ? (selectedStaff.designation || selectedStaff.role) : '';

  isPayrollSubmitting = true;
  try {
    const res = await fetch('/api/finance/payroll', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        staff_id: staffId,
        name: sName,
        staff_name: sName,
        full_name: sName,
        role: sRole,
        designation: sRole,
        month_year: monthYear,
        basic_salary: basic,
        allowances: allow,
        deductions: deduct
      })
    });

    let data;
    try {
      data = await res.json();
    } catch (parseErr) {
      data = {};
    }

    if (!res.ok || !data.success) {
      const errMsg = data.error || data.message || `Server error (${res.status}): Failed to process payroll.`;
      throw new Error(errMsg);
    }

    closeAddPayrollModal();
    loadPayrollData();
    if (typeof updateFinanceOverviewMetrics === 'function') updateFinanceOverviewMetrics();
    if (typeof showToast === 'function') {
      showToast('Payroll processed and disbursed successfully!');
    }
  } catch (err) {
    console.error('Error processing payroll:', err);
    alert(`Failed to process payroll: ${err.message}`);
    if (typeof showToast === 'function') {
      showToast(`Error: ${err.message}`);
    }
  } finally {
    isPayrollSubmitting = false;
  }
}

/**
 * Safe delete payroll record with user confirmation dialog
 */
async function deletePayrollRecord(id) {
  console.log('Button clicked: Delete Payroll Record');
  const confirmed = confirm("Are you sure you want to delete this payroll record? This action cannot be undone.");
  if (!confirmed) return;

  try {
    const res = await fetch(`/api/finance/payroll/${id}`, { method: 'DELETE' });
    let data;
    try {
      data = await res.json();
    } catch (e) {
      data = {};
    }

    if (data.success) {
      loadPayrollData();
      if (typeof updateFinanceOverviewMetrics === 'function') updateFinanceOverviewMetrics();
      if (typeof showToast === 'function') showToast('Payroll record deleted.');
    } else if (data.requiresAdminConfirm) {
      const adminConfirm = confirm("Warning: " + data.error + "\n\nDo you want to proceed with Admin Override deletion?");
      if (adminConfirm) {
        const forceRes = await fetch(`/api/finance/payroll/${id}?force=true`, { method: 'DELETE' });
        let forceData;
        try { forceData = await forceRes.json(); } catch(e) { forceData = {}; }
        if (!forceRes.ok || !forceData.success) {
          throw new Error(forceData.error || forceData.message || 'Failed to delete record via Admin Override.');
        }
        loadPayrollData();
        if (typeof updateFinanceOverviewMetrics === 'function') updateFinanceOverviewMetrics();
        if (typeof showToast === 'function') showToast('Payroll record deleted with override.');
      }
    } else {
      throw new Error(data.error || data.message || `Server error (${res.status}): Failed to delete record.`);
    }
  } catch (err) {
    console.error('Error deleting payroll record:', err);
    alert(`Error deleting record: ${err.message}`);
    if (typeof showToast === 'function') {
      showToast(`Error: ${err.message}`);
    }
  }
}


/**
 * Updates Net Profit KPI card (Total Revenue - Total Payroll Disbursements)
 */
async function updateFinanceOverviewMetrics(knownRevenue = null) {
  const kpiNetProfit = document.getElementById('kpiNetProfit');
  const kpiRevenue = document.getElementById('kpiRevenue');
  if (!kpiNetProfit) return;

  try {
    let revenue = knownRevenue;
    if (revenue === null || revenue === undefined) {
      try {
        const sumRes = await fetch('/api/finance/summary');
        if (sumRes.ok) {
          const sumData = await sumRes.json();
          if (sumData && typeof sumData.total_revenue === 'number') {
            revenue = sumData.total_revenue;
          }
        }
      } catch (e) {}

      if (revenue === null || revenue === undefined) {
        const invRes = await fetch('/api/finance/invoices');
        if (invRes.ok) {
          const invData = await invRes.json();
          const list = Array.isArray(invData) ? invData : (invData.invoices || []);
          revenue = list.reduce((acc, inv) => {
            const isPaid = (inv.status || inv.payment_status || '').toUpperCase() === 'PAID';
            return isPaid ? acc + (parseFloat(inv.total_amount || inv.amount) || 0) : acc;
          }, 0);
        } else if (kpiRevenue) {
          const parsed = parseFloat(kpiRevenue.textContent.replace(/[^0-9.-]+/g, ''));
          revenue = isNaN(parsed) ? 0 : parsed;
        } else {
          revenue = 0;
        }
      }
    }

    const prRes = await fetch('/api/finance/payroll');
    let payrollTotal = 0;
    if (prRes.ok) {
      const prRecords = await prRes.json();
      payrollTotal = (prRecords || []).reduce((acc, p) => {
        return acc + (parseFloat(p.net_salary) || 0);
      }, 0);
    }

    const netProfit = (parseFloat(revenue) || 0) - payrollTotal;
    kpiNetProfit.textContent = `Rs. ${netProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (netProfit >= 0) {
      kpiNetProfit.className = 'kpi-value text-emerald-400 font-bold';
    } else {
      kpiNetProfit.className = 'kpi-value text-rose-400 font-bold';
    }
  } catch (err) {
    console.error('Error updating finance overview metrics:', err);
  }
}

/* ==========================================================================
   CUSTOM GUEST FOLIO & INVOICE GENERATOR CONTROLLER
   ========================================================================== */

let activeGuestsCache = [];

/**
 * Multi-Step Wizard Step Switcher for Guest Invoice Generator
 * Step 1: Itemized Stay & Consumption Review
 * Step 2: Payment & Final Generation
 */
function goToInvoiceStep(step) {
  const step1 = document.getElementById('invoiceStep1');
  const step2 = document.getElementById('invoiceStep2');
  const step1Tab = document.getElementById('wizardStep1Tab');
  const step2Tab = document.getElementById('wizardStep2Tab');
  const step1Num = document.getElementById('wizardStep1Num');
  const step2Num = document.getElementById('wizardStep2Num');
  const progressLine = document.getElementById('wizardProgressLine');

  if (step === 2) {
    const bookingSelect = document.getElementById('custBookingSelect');
    if (!bookingSelect || !bookingSelect.value) {
      alert('Please select an active guest first before proceeding.');
      if (typeof showToast === 'function') {
        showToast('Please select an active guest first.');
      }
      return;
    }

    const {
      baseCharge,
      totalPackages,
      totalCustom,
      diningCharge,
      discount,
      grandTotal
    } = calculateCustomTotal();

    const subtotal = baseCharge + totalPackages + totalCustom + (diningCharge || 0);
    if (discount > subtotal) {
      alert('Discount cannot exceed the total charges amount.');
      if (typeof showToast === 'function') {
        showToast('Discount cannot exceed the total charges amount.');
      }
      return;
    }

    if (grandTotal <= 0) {
      alert('Total invoice net amount must be greater than zero.');
      if (typeof showToast === 'function') {
        showToast('Total invoice net amount must be greater than zero.');
      }
      return;
    }

    // Populate Step 2 Details
    const guestName = document.getElementById('custHiddenGuestName')?.value || 'Guest';
    const roomNumber = document.getElementById('custHiddenRoomNumber')?.value || '';
    const nights = parseInt(document.getElementById('custHiddenNights')?.value, 10) || 1;

    const s2Badge = document.getElementById('step2NetPayableBadge');
    const s2Guest = document.getElementById('step2GuestSummary');
    const s2Room = document.getElementById('step2RoomSummary');
    const s2Dining = document.getElementById('step2DiningSummary');
    const s2Extras = document.getElementById('step2ExtrasSummary');
    const s2Discount = document.getElementById('step2DiscountSummary');

    if (s2Badge) s2Badge.textContent = `Rs. ${grandTotal.toFixed(2)}`;
    if (s2Guest) s2Guest.textContent = `Guest: ${guestName} (${roomNumber ? 'Room ' + roomNumber : 'No Room Assigned'})`;
    if (s2Room) s2Room.textContent = `${nights} night${nights > 1 ? 's' : ''} (Rs. ${baseCharge.toFixed(2)})`;
    if (s2Dining) s2Dining.textContent = `Rs. ${diningCharge.toFixed(2)}`;
    if (s2Extras) s2Extras.textContent = `Rs. ${(totalPackages + totalCustom).toFixed(2)}`;
    if (s2Discount) s2Discount.textContent = `-Rs. ${discount.toFixed(2)}`;

    // Show Step 2, Hide Step 1
    if (step1) step1.style.display = 'none';
    if (step2) step2.style.display = 'block';

    // Update Wizard Tab UI (Step 1 Completed, Step 2 Active)
    if (step1Tab) {
      step1Tab.className = 'flex items-center gap-2 text-xs font-semibold text-emerald-400';
    }
    if (step1Num) {
      step1Num.className = 'flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500 text-slate-950 text-[10px] font-bold';
      step1Num.innerHTML = '&#10003;';
    }
    if (step2Tab) {
      step2Tab.className = 'flex items-center gap-2 text-xs font-semibold text-amber-400';
    }
    if (step2Num) {
      step2Num.className = 'flex items-center justify-center w-5 h-5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-bold';
      step2Num.textContent = '2';
    }
    if (progressLine) {
      progressLine.className = 'h-0.5 flex-1 bg-amber-400 mx-3';
    }
  } else {
    // Return to Step 1
    if (step2) step2.style.display = 'none';
    if (step1) step1.style.display = 'block';

    // Update Wizard Tab UI (Step 1 Active, Step 2 Inactive)
    if (step1Tab) {
      step1Tab.className = 'flex items-center gap-2 text-xs font-semibold text-amber-400';
    }
    if (step1Num) {
      step1Num.className = 'flex items-center justify-center w-5 h-5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-bold';
      step1Num.textContent = '1';
    }
    if (step2Tab) {
      step2Tab.className = 'flex items-center gap-2 text-xs font-semibold text-slate-500';
    }
    if (step2Num) {
      step2Num.className = 'flex items-center justify-center w-5 h-5 rounded-full bg-slate-800 text-slate-400 text-[10px] font-bold';
      step2Num.textContent = '2';
    }
    if (progressLine) {
      progressLine.className = 'h-0.5 flex-1 bg-slate-800 mx-3';
    }
  }
}

/**
 * Loads strictly active/checked-in guests, filtering out already checked-out or paid guests,
 * and populating the dropdown without duplicates.
 */
async function loadActiveCheckedInGuests() {
  const select = document.getElementById('custBookingSelect');
  if (!select) return [];

  // Clear previous options before populating
  select.innerHTML = '<option value="">-- Choose active checked-in guest --</option>';
  const API_BASE = window.location.origin.includes('localhost:3000') ? '' : 'http://localhost:3000';

  let rawList = [];
  try {
    const res = await fetch(`${API_BASE}/api/finance/guests/active`);
    if (res.ok) {
      rawList = await res.json();
    } else {
      const fallbackRes = await fetch(`${API_BASE}/api/finance/active-guests`);
      if (fallbackRes.ok) {
        rawList = await fallbackRes.json();
      }
    }
  } catch (e) {
    console.warn('Could not fetch from /api/finance/guests/active, falling back to /api/finance/active-guests:', e);
    try {
      const fallbackRes = await fetch(`${API_BASE}/api/finance/active-guests`);
      if (fallbackRes.ok) {
        rawList = await fallbackRes.json();
      }
    } catch (err2) {}
  }

  if (!Array.isArray(rawList) || rawList.length === 0) {
    try {
      const res = await fetch(`${API_BASE}/api/bookings`);
      if (res.ok) {
        const bookingsData = await res.json();
        rawList = Array.isArray(bookingsData) ? bookingsData : (bookingsData.bookings || []);
      }
    } catch (e) {}
  }

  const list = Array.isArray(rawList) ? rawList : [];

  // Strictly filter only active checked-in reservations
  const seenBookingIds = new Set();
  activeGuestsCache = [];

  list.forEach(b => {
    const status = (b.status || '').toLowerCase().trim();
    const isCheckedOut = status === 'checked-out' || status === 'checked out' || status === 'cancelled';
    const isCheckedInOrActive = status === 'checked-in' || status === 'checkedin' || status === 'confirmed' || status === 'active' || status === 'booked';

    if (isCheckedInOrActive && !isCheckedOut) {
      const bId = String(b.booking_id || b.id || '');
      if (bId && !seenBookingIds.has(bId)) {
        seenBookingIds.add(bId);
        activeGuestsCache.push({
          ...b,
          booking_id: b.booking_id || b.id,
          guest_name: b.guest_name || b.name || 'Guest',
          room_no: b.room_no || b.room_number || 'N/A',
          room_number: b.room_number || b.room_no || 'N/A',
          status: b.status || 'Checked-In'
        });
      }
    }
  });

  console.log("Loaded checked-in guests for invoice:", activeGuestsCache);

  // Clear and dynamically populate dropdown without dummy guests
  select.innerHTML = '<option value="">-- Choose active checked-in guest --</option>';

  if (activeGuestsCache.length === 0) {
    const emptyOpt = document.createElement('option');
    emptyOpt.value = '';
    emptyOpt.disabled = true;
    emptyOpt.textContent = 'No active checked-in guests awaiting billing';
    select.appendChild(emptyOpt);
  } else {
    activeGuestsCache.forEach(guest => {
      const opt = document.createElement('option');
      opt.value = guest.booking_id;
      const roomStr = guest.room_no || guest.room_number || 'N/A';
      opt.textContent = `${guest.guest_name} (Room ${roomStr}) - [${guest.status}]`;
      select.appendChild(opt);
    });
  }

  return activeGuestsCache;
}
window.loadActiveCheckedInGuests = loadActiveCheckedInGuests;

/**
 * Open Custom Bill / Invoice Generation Modal
 */
async function openCustomInvoiceModal() {
  console.log('Button clicked: Open Custom Invoice Modal');
  try {
    const modal = document.getElementById('invoiceModal') || document.getElementById('customInvoiceModal');
    if (!modal) return;

    // Reset form elements
    const form = document.getElementById('customInvoiceForm') || document.getElementById('invoiceForm');
    if (form) form.reset();

    // Default to Step 1
    goToInvoiceStep(1);

    // Reset hidden fields & displays
    const hBookingId = document.getElementById('custHiddenBookingId');
    const hGuestName = document.getElementById('custHiddenGuestName');
    const hGuestEmail = document.getElementById('custHiddenGuestEmail');
    const hGuestPhone = document.getElementById('custHiddenGuestPhone');
    const hRoomNumber = document.getElementById('custHiddenRoomNumber');
    const hNights = document.getElementById('custHiddenNights');
    const hRate = document.getElementById('custHiddenRate');
    const hRoomType = document.getElementById('custHiddenRoomType');

    if (hBookingId) hBookingId.value = '';
    if (hGuestName) hGuestName.value = '';
    if (hGuestEmail) hGuestEmail.value = '';
    if (hGuestPhone) hGuestPhone.value = '';
    if (hRoomNumber) hRoomNumber.value = '';
    if (hNights) hNights.value = '1';
    if (hRate) hRate.value = '0';
    if (hRoomType) hRoomType.value = '';

    const nightsDisp = document.getElementById('custNightsDisplay');
    const baseInput = document.getElementById('custBaseRoomCharge');
    if (nightsDisp) nightsDisp.value = '0 nights';
    if (baseInput) baseInput.value = '0.00';

    // Reset In-Room Dining fields
    const diningInput = document.getElementById('invoiceDiningCharge');
    const diningBadge = document.getElementById('diningOrdersCountBadge');
    const diningBreakdown = document.getElementById('invoiceDiningBreakdown');
    if (diningInput) diningInput.value = '0.00';
    if (diningBadge) diningBadge.textContent = '0 delivered orders';
    if (diningBreakdown) diningBreakdown.textContent = 'No dining orders for selected stay.';

    // Reset live summary box
    const sTag = document.getElementById('summaryGuestRoomTag');
    const sRoom = document.getElementById('summaryRoomStay');
    const sPkgs = document.getElementById('summaryPackages');
    const sDinTot = document.getElementById('summaryDiningTotal');
    const sDinList = document.getElementById('summaryDiningList');
    const sExtras = document.getElementById('summaryExtras');
    const sDisc = document.getElementById('summaryDiscount');
    const sNet = document.getElementById('sumFinalTotal');

    if (sTag) sTag.textContent = 'No guest selected';
    if (sRoom) sRoom.textContent = '-';
    if (sPkgs) sPkgs.textContent = 'None';
    if (sDinTot) sDinTot.textContent = 'Rs. 0.00';
    if (sDinList) sDinList.innerHTML = 'No orders';
    if (sExtras) sExtras.textContent = 'Rs. 0.00';
    if (sDisc) sDisc.textContent = '-Rs. 0.00';
    if (sNet) sNet.textContent = 'Rs. 0.00';

    // Reset breakdown calculations
    calculateCustomTotal();

    // Auto-refresh active checked-in guests freshly on modal open
    await loadActiveCheckedInGuests();

    modal.classList.remove('hidden');
  } catch (err) {
    console.error('Error opening custom invoice modal:', err);
    alert(`Could not load active bookings: ${err.message}`);
    if (typeof showToast === 'function') {
      showToast('Could not load active bookings.');
    }
  }
}

/**
 * Close Custom Invoice Modal
 */
function closeCustomInvoiceModal() {
  console.log('Button clicked: Close Custom Invoice Modal');
  const modal = document.getElementById('invoiceModal') || document.getElementById('customInvoiceModal');
  if (modal) modal.classList.add('hidden');
}

/**
 * Handle Guest Selection from Dropdown
 * Auto-populates room details, nights, rate, base room charge, and in-room dining orders
 */
async function onCustomGuestSelected(bookingId) {
  const nightsDisp = document.getElementById('custNightsDisplay');
  const baseInput = document.getElementById('custBaseRoomCharge');
  const diningInput = document.getElementById('invoiceDiningCharge');
  const diningBadge = document.getElementById('diningOrdersCountBadge');
  const diningBreakdown = document.getElementById('invoiceDiningBreakdown');
  const sTag = document.getElementById('summaryGuestRoomTag');
  const sRoom = document.getElementById('summaryRoomStay');
  const sDinList = document.getElementById('summaryDiningList');
  const sDinTot = document.getElementById('summaryDiningTotal');

  if (!bookingId) {
    if (nightsDisp) nightsDisp.value = '0 nights';
    if (baseInput) baseInput.value = '0.00';
    if (diningInput) diningInput.value = '0.00';
    if (diningBadge) diningBadge.textContent = '0 delivered orders';
    if (diningBreakdown) diningBreakdown.textContent = 'No dining orders for selected stay.';
    if (sTag) sTag.textContent = 'No guest selected';
    if (sRoom) sRoom.textContent = '-';
    if (sDinList) sDinList.innerHTML = 'No orders';
    if (sDinTot) sDinTot.textContent = 'Rs. 0.00';
    calculateCustomTotal();
    return;
  }

  const guest = activeGuestsCache.find(g => String(g.booking_id) === String(bookingId));
  if (!guest) return;

  const nights = parseInt(guest.nights, 10) || 1;
  const rate = parseFloat(guest.nightly_rate != null ? guest.nightly_rate : guest.price_per_night) || 0;
  const baseCharge = parseFloat(guest.base_room_charge != null ? guest.base_room_charge : (rate * nights)) || (rate * nights);
  const roomType = guest.room_type || guest.type || 'Deluxe Room';

  // Set hidden fields
  const hBookingId = document.getElementById('custHiddenBookingId');
  const hGuestName = document.getElementById('custHiddenGuestName');
  const hGuestEmail = document.getElementById('custHiddenGuestEmail');
  const hGuestPhone = document.getElementById('custHiddenGuestPhone');
  const hRoomNumber = document.getElementById('custHiddenRoomNumber');
  const hNights = document.getElementById('custHiddenNights');
  const hRate = document.getElementById('custHiddenRate');
  const hRoomType = document.getElementById('custHiddenRoomType');

  if (hBookingId) hBookingId.value = guest.booking_id;
  if (hGuestName) hGuestName.value = guest.guest_name || '';
  if (hGuestEmail) hGuestEmail.value = guest.guest_email || guest.email || '';
  if (hGuestPhone) hGuestPhone.value = guest.phone || guest.guest_phone || '';
  if (hRoomNumber) hRoomNumber.value = guest.room_number || '';
  if (hNights) hNights.value = nights;
  if (hRate) hRate.value = rate;
  if (hRoomType) hRoomType.value = roomType;

  // Auto-fill inputs (read-only)
  if (nightsDisp) nightsDisp.value = `${nights} night${nights > 1 ? 's' : ''}`;
  if (baseInput) baseInput.value = baseCharge.toFixed(2);

  // Update Summary Tag & Room Stay
  if (sTag) sTag.textContent = `${guest.guest_name} • Room ${guest.room_number || 'N/A'}`;
  if (sRoom) sRoom.textContent = `${roomType} - ${nights} Night${nights > 1 ? 's' : ''} (Rs. ${baseCharge.toFixed(2)})`;

  // Dynamic In-Room Dining Calculations
  if (diningInput) diningInput.value = '0.00';
  if (diningBadge) diningBadge.textContent = 'Fetching orders...';
  if (diningBreakdown) diningBreakdown.textContent = 'Loading dining orders...';
  if (sDinList) sDinList.innerHTML = '<span class="italic text-slate-500">Loading orders...</span>';

  const roomNo = guest.room_number || '';
  if (roomNo) {
    try {
      const API_BASE = window.location.origin.includes('localhost:3000') ? '' : 'http://localhost:3000';
      const res = await fetch(`${API_BASE}/api/orders/room-service?room=${encodeURIComponent(roomNo)}`);
      if (res.ok) {
        const data = await res.json();
        const allOrders = data.orders || data.data || [];
        // Sum delivered / fulfilled room service orders
        const deliveredOrders = allOrders.filter(o => {
          const st = (o.status || '').toLowerCase().trim();
          return st === 'delivered' || st === 'billed' || st === 'paid' || st === 'completed';
        });

        const diningTotal = deliveredOrders.reduce((sum, o) => sum + Number(o.total_price || 0), 0);

        if (diningInput) diningInput.value = diningTotal.toFixed(2);
        if (diningBadge) {
          diningBadge.textContent = `${deliveredOrders.length} delivered order${deliveredOrders.length === 1 ? '' : 's'}`;
        }
        if (sDinTot) sDinTot.textContent = `Rs. ${diningTotal.toFixed(2)}`;

        if (deliveredOrders.length > 0) {
          const dishesText = deliveredOrders.map(o => {
            const dName = o.dish_name || o.item_name || 'Dish';
            const qty = o.quantity || 1;
            const price = Number(o.total_price || 0).toFixed(2);
            return `${dName} x${qty} (Rs. ${price})`;
          }).join(', ');
          
          if (diningBreakdown) diningBreakdown.textContent = dishesText;

          // Itemized list in Step 1 live summary box
          if (sDinList) {
            sDinList.innerHTML = deliveredOrders.map(o => {
              const dName = o.dish_name || o.item_name || 'Dish';
              const qty = o.quantity || 1;
              const price = Number(o.total_price || 0).toFixed(2);
              return `<div class="flex justify-between py-0.5 border-b border-slate-800/40 last:border-0"><span class="text-slate-300">• ${dName} &times; ${qty}</span><span class="text-slate-400 font-mono">Rs. ${price}</span></div>`;
            }).join('');
          }
        } else {
          if (diningBreakdown) diningBreakdown.textContent = 'No dining orders for selected stay.';
          if (sDinList) sDinList.innerHTML = '<span class="text-slate-500 italic">No dining orders for this stay</span>';
        }
      } else {
        if (diningBadge) diningBadge.textContent = '0 delivered orders';
        if (diningBreakdown) diningBreakdown.textContent = 'No dining orders for selected stay.';
        if (sDinList) sDinList.innerHTML = '<span class="text-slate-500 italic">No dining orders</span>';
      }
    } catch (err) {
      console.error('Error fetching room service orders for invoice:', err);
      if (diningBadge) diningBadge.textContent = '0 delivered orders';
      if (diningBreakdown) diningBreakdown.textContent = 'No dining orders for selected stay.';
      if (sDinList) sDinList.innerHTML = '<span class="text-slate-500 italic">No dining orders</span>';
    }
  } else {
    if (diningBadge) diningBadge.textContent = '0 delivered orders';
    if (diningBreakdown) diningBreakdown.textContent = 'No dining orders for selected stay.';
    if (sDinList) sDinList.innerHTML = '<span class="text-slate-500 italic">No dining orders</span>';
  }

  // Update live Net Payable formula & summary
  calculateCustomTotal();
}

/**
 * Real-time dynamic calculation of invoice breakdown:
 * Total Net Payable = Base Room Charge + Package Add-ons + Special Charges + Dining Charges - Discount
 */
function calculateCustomTotal() {
  const baseInput = document.getElementById('custBaseRoomCharge');
  const baseCharge = Math.max(0, parseFloat(baseInput ? baseInput.value : 0) || 0);

  // Add-on Packages (Checkboxes):
  // Spa & Wellness (+Rs. 6,000), Airport Transfer (+Rs. 4,000), Full Board Dining (+Rs. 5,000)
  const pkgSpa = document.getElementById('pkgSpa');
  const pkgTransfer = document.getElementById('pkgTransfer');
  const pkgMeal = document.getElementById('pkgMeal');

  const spaPrice = (pkgSpa && pkgSpa.checked) ? 6000 : 0;
  const transferPrice = (pkgTransfer && pkgTransfer.checked) ? 4000 : 0;
  const mealPrice = (pkgMeal && pkgMeal.checked) ? 5000 : 0;
  const totalPackages = spaPrice + transferPrice + mealPrice;

  // Selected packages summary list
  const selectedPkgs = [];
  if (spaPrice > 0) selectedPkgs.push('Spa (+Rs. 6,000)');
  if (transferPrice > 0) selectedPkgs.push('Transfer (+Rs. 4,000)');
  if (mealPrice > 0) selectedPkgs.push('Full Board (+Rs. 5,000)');
  const sPkgs = document.getElementById('summaryPackages');
  if (sPkgs) {
    sPkgs.textContent = selectedPkgs.length > 0 
      ? `${selectedPkgs.join(', ')} (+Rs. ${totalPackages.toFixed(2)})` 
      : 'None (Rs. 0.00)';
  }

  // Special Charges
  const desc1 = (document.getElementById('custChargeDesc1')?.value || '').trim();
  const amt1 = Math.max(0, parseFloat(document.getElementById('custChargeAmount1')?.value) || 0);
  const totalCustom = amt1;

  const sExtras = document.getElementById('summaryExtras');
  if (sExtras) {
    sExtras.textContent = totalCustom > 0 
      ? `${desc1 || 'Special Charges'} (+Rs. ${totalCustom.toFixed(2)})` 
      : 'Rs. 0.00';
  }

  // In-Room Dining Charges
  const diningInput = document.getElementById('invoiceDiningCharge');
  const diningCharge = Math.max(0, parseFloat(diningInput ? diningInput.value : 0) || 0);

  const sDinTot = document.getElementById('summaryDiningTotal');
  if (sDinTot) {
    sDinTot.textContent = `Rs. ${diningCharge.toFixed(2)}`;
  }

  // Discount validation (default 0.00, min="0")
  const discInput = document.getElementById('custDiscount');
  if (discInput && parseFloat(discInput.value) < 0) {
    discInput.value = '0.00';
  }
  const discount = Math.max(0, parseFloat(discInput?.value) || 0);

  const sDisc = document.getElementById('summaryDiscount');
  if (sDisc) {
    sDisc.textContent = `-Rs. ${discount.toFixed(2)}`;
  }

  // Live Calculated Total: Base Room Charge + Package Add-ons + Special Charges + Dining Charges - Discount
  const subtotal = baseCharge + totalPackages + totalCustom + diningCharge;
  const grandTotal = subtotal - discount;

  // Real-time Validation Warning
  const warning = document.getElementById('cust-warning');
  const proceedBtn = document.getElementById('btnGoToStep2') || document.getElementById('btnProceedToStep2');
  const submitBtn = document.getElementById('btnSubmitCustomInvoice');

  if (grandTotal < 0) {
    if (warning) warning.classList.remove('hidden');
    if (proceedBtn) proceedBtn.disabled = true;
    if (submitBtn) submitBtn.disabled = true;
  } else {
    if (warning) warning.classList.add('hidden');
    if (proceedBtn) proceedBtn.disabled = false;
    if (submitBtn) submitBtn.disabled = false;
  }

  // Update live Net Payable in Step 1 box
  const sumTotal = document.getElementById('sumFinalTotal');
  if (sumTotal) {
    sumTotal.textContent = `Rs. ${Math.max(0, grandTotal).toFixed(2)}`;
  }

  // Update Step 2 badge if visible
  const s2Badge = document.getElementById('step2NetPayableBadge');
  if (s2Badge) {
    s2Badge.textContent = `Rs. ${Math.max(0, grandTotal).toFixed(2)}`;
  }

  return {
    baseCharge,
    spaPrice,
    transferPrice,
    mealPrice,
    totalPackages,
    totalCustom,
    diningCharge,
    discount,
    grandTotal: Math.max(0, grandTotal)
  };
}

/**
 * Handle Custom Invoice Submission
 * Sends payload { booking_id, guest_name, total_amount, payment_method, notes }
 * to /api/finance/invoices/create-custom
 */
let isCustomInvoiceSubmitting = false;
async function handleCustomInvoiceSubmit(event) {
  if (event && typeof event.preventDefault === 'function') event.preventDefault();
  console.log('Button clicked: Settle & Generate Invoice');
  if (isCustomInvoiceSubmitting) return;

  const select = document.getElementById('custBookingSelect');
  const bookingId = select ? select.value : '';
  if (!bookingId) {
    alert('Please select an active guest first.');
    if (typeof showToast === 'function') showToast('Please select an active guest first.');
    return;
  }

  const {
    baseCharge,
    spaPrice,
    transferPrice,
    mealPrice,
    totalPackages,
    totalCustom,
    diningCharge,
    discount,
    grandTotal
  } = calculateCustomTotal();

  // Form Validation: Prevent negative totals or invalid entries
  const subtotal = baseCharge + totalPackages + totalCustom + (diningCharge || 0);
  if (discount > subtotal) {
    alert('Discount cannot exceed the total charges amount.');
    if (typeof showToast === 'function') showToast('Discount cannot exceed the total charges amount.');
    return;
  }
  if (grandTotal <= 0) {
    alert('Total invoice amount must be greater than zero.');
    if (typeof showToast === 'function') showToast('Total invoice amount must be greater than zero.');
    return;
  }

  const guestName = document.getElementById('custHiddenGuestName')?.value || 'Guest';
  const guestEmail = document.getElementById('custHiddenGuestEmail')?.value || '';
  const guestPhone = document.getElementById('custHiddenGuestPhone')?.value || '';
  const roomNumber = document.getElementById('custHiddenRoomNumber')?.value || '';
  const nights = parseInt(document.getElementById('custHiddenNights')?.value, 10) || 1;
  const rate = parseFloat(document.getElementById('custHiddenRate')?.value) || 0;
  const paymentMethod = document.getElementById('custPaymentMethod')?.value || 'Card';

  // Build itemized breakdown & notes string
  const items = [];

  // 1. Room Charge
  items.push({
    description: `Room Charge (${nights} night${nights > 1 ? 's' : ''} @ Rs. ${rate.toFixed(2)}/nt)`,
    category: 'room',
    quantity: nights,
    unit_price: rate,
    total_price: baseCharge
  });

  // 2. Packages
  if (spaPrice > 0) {
    items.push({
      description: 'Spa & Wellness (+Rs. 6,000)',
      category: 'package',
      quantity: 1,
      unit_price: 6000,
      total_price: 6000
    });
  }
  if (transferPrice > 0) {
    items.push({
      description: 'Airport Transfer (+Rs. 4,000)',
      category: 'package',
      quantity: 1,
      unit_price: 4000,
      total_price: 4000
    });
  }
  if (mealPrice > 0) {
    items.push({
      description: 'Full Board Dining (+Rs. 5,000)',
      category: 'package',
      quantity: 1,
      unit_price: 5000,
      total_price: 5000
    });
  }

  // 3. Special / Custom Charges
  const desc1 = (document.getElementById('custChargeDesc1')?.value || '').trim();
  const amt1 = Math.max(0, parseFloat(document.getElementById('custChargeAmount1')?.value) || 0);
  if (amt1 > 0) {
    items.push({
      description: desc1 || 'Special Charges / Incidentals',
      category: 'custom',
      quantity: 1,
      unit_price: amt1,
      total_price: amt1
    });
  }

  // 4. In-Room Dining Charges
  if (diningCharge > 0) {
    items.push({
      description: 'In-Room Dining Charges',
      category: 'dining',
      quantity: 1,
      unit_price: diningCharge,
      total_price: diningCharge
    });
  }

  // 5. Discount
  if (discount > 0) {
    items.push({
      description: 'Manager Applied Discount',
      category: 'discount',
      quantity: 1,
      unit_price: -discount,
      total_price: -discount
    });
  }

  // Construct structured notes breakdown
  const notesParts = [
    `Room: Rs. ${baseCharge.toFixed(2)} (${nights}n @ Rs. ${rate.toFixed(2)})`
  ];
  const pkgs = [];
  if (spaPrice > 0) pkgs.push('Spa (Rs. 6,000)');
  if (transferPrice > 0) pkgs.push('Transfer (Rs. 4,000)');
  if (mealPrice > 0) pkgs.push('Full Board Dining (Rs. 5,000)');
  if (pkgs.length > 0) notesParts.push(`Packages: ${pkgs.join(', ')}`);

  if (amt1 > 0) notesParts.push(`Charges: ${desc1 || 'Special Charges'} (Rs. ${amt1.toFixed(2)})`);
  if (diningCharge > 0) notesParts.push(`Dining: Rs. ${diningCharge.toFixed(2)}`);
  if (discount > 0) notesParts.push(`Discount: -Rs. ${discount.toFixed(2)}`);
  notesParts.push(`Method: ${paymentMethod}`);
  const notes = notesParts.join(' | ');

  const payload = {
    booking_id: bookingId,
    guest_name: guestName,
    total_amount: grandTotal,
    payment_method: paymentMethod,
    notes: notes,
    // Supporting fields
    room_number: roomNumber,
    guest_email: guestEmail,
    guest_phone: guestPhone,
    nights: nights,
    nightly_rate: rate,
    base_room_charge: baseCharge,
    dining_charges: diningCharge || 0,
    packages: {
      spa: spaPrice > 0,
      transfer: transferPrice > 0,
      meal: mealPrice > 0
    },
    package_total: totalPackages,
    custom_charges: [
      amt1 > 0 ? { desc: desc1 || 'Special Charge', amount: amt1 } : null
    ].filter(Boolean),
    custom_total: totalCustom,
    discount: discount,
    items: items
  };

  const submitBtn = document.getElementById('btnSubmitCustomInvoice');
  const originalBtnText = submitBtn ? submitBtn.innerHTML : '';
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span>⏳ Processing Folio...</span>';
  }

  isCustomInvoiceSubmitting = true;
  try {
    const API_BASE = window.location.origin.includes('localhost:3000') ? '' : 'http://localhost:3000';
    const res = await fetch(`${API_BASE}/api/finance/invoices/create-custom`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    let data;
    try {
      data = await res.json();
    } catch (parseErr) {
      data = {};
    }

    if (!res.ok || !data.success) {
      const errMsg = data.error || data.message || `Server error (${res.status}): Failed to generate custom bill.`;
      throw new Error(errMsg);
    }

    // Success! Close modal and notify
    closeCustomInvoiceModal();

    if (typeof showToast === 'function') {
      showToast(`Folio ${data.invoice_id} generated & settled successfully!`);
    }

    // Refresh invoices table instantly
    if (typeof fetchInvoices === 'function') {
      fetchInvoices();
    }
    if (typeof updateFinanceOverviewMetrics === 'function') {
      updateFinanceOverviewMetrics();
    }
    if (typeof loadActiveCheckedInGuests === 'function') {
      loadActiveCheckedInGuests();
    }

    // Open Unified Folio modal for the generated invoice
    setTimeout(() => {
      openUnifiedFolio(data.invoice_id);
    }, 250);

  } catch (err) {
    console.error('Error creating custom invoice:', err);
    alert(`Failed to generate custom bill: ${err.message}`);
    if (typeof showToast === 'function') {
      showToast(`Error: ${err.message}`);
    }
  } finally {
    isCustomInvoiceSubmitting = false;
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalBtnText;
    }
  }
}

// Aliases for invoice modal triggers
function openInvoiceModal() {
  openCustomInvoiceModal();
}

function closeInvoiceModal() {
  closeCustomInvoiceModal();
}

/* ==========================================================================
   UNIFIED DOMContentLoaded EVENT LISTENER BINDINGS
   ========================================================================== */
document.addEventListener('DOMContentLoaded', () => {
  // 1. Keyboard dismiss listener
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeUnifiedFolio();
      closeCustomInvoiceModal();
      closeAddPayrollModal();
    }
  });

  // 2. Modal backdrop click listeners
  const folioModal = document.getElementById('folio-settle-modal');
  if (folioModal) {
    folioModal.addEventListener('click', (e) => {
      if (e.target === folioModal) {
        closeUnifiedFolio();
      }
    });
  }

  const invoiceModal = document.getElementById('invoiceModal') || document.getElementById('customInvoiceModal');
  if (invoiceModal) {
    invoiceModal.addEventListener('click', (e) => {
      if (e.target === invoiceModal) {
        closeCustomInvoiceModal();
      }
    });
  }

  const payrollModal = document.getElementById('add-payroll-modal');
  if (payrollModal) {
    payrollModal.addEventListener('click', (e) => {
      if (e.target === payrollModal) {
        closeAddPayrollModal();
      }
    });
  }

  const receiptModal = document.getElementById('invoice-modal');
  if (receiptModal) {
    receiptModal.addEventListener('click', (e) => {
      if (e.target === receiptModal) {
        receiptModal.classList.add('hidden');
      }
    });
  }

  // 3. Form Submit Listeners
  const invoiceForm = document.getElementById('customInvoiceForm') || document.getElementById('invoiceForm');
  if (invoiceForm) {
    invoiceForm.addEventListener('submit', (e) => {
      handleCustomInvoiceSubmit(e);
    });
  }

  const payrollForm = document.getElementById('payrollForm') || document.getElementById('payroll-form');
  if (payrollForm) {
    payrollForm.addEventListener('submit', (e) => {
      handlePayrollSubmit(e);
    });
  }

  // 4. Submit & Action Buttons Click Listeners
  const submitCustomBtn = document.getElementById('btnSubmitCustomInvoice');
  if (submitCustomBtn) {
    submitCustomBtn.addEventListener('click', (e) => {
      console.log('Button clicked: Settle & Generate Invoice');
      if (invoiceForm && !invoiceForm.checkValidity()) {
        invoiceForm.reportValidity();
      }
    });
  }

  const confirmSettleBtn = document.getElementById('btnConfirmSettle') || document.getElementById('m-btn-settle');
  if (confirmSettleBtn) {
    confirmSettleBtn.addEventListener('click', (e) => {
      console.log('Button clicked: Confirm & Settle Bill');
      handleUnifiedSettleSubmit(e);
    });
  }

  const disburseBtn = document.getElementById('btnDisbursePayroll');
  if (disburseBtn) {
    disburseBtn.addEventListener('click', (e) => {
      console.log('Button clicked: Disburse & Pay');
      if (payrollForm && !payrollForm.checkValidity()) {
        payrollForm.reportValidity();
      }
    });
  }

  // 5. Select & Input Listeners
  const staffSelect = document.getElementById('pr-staff-select');
  if (staffSelect) {
    staffSelect.addEventListener('change', onStaffSelected);
  }

  const monthYearInput = document.getElementById('pr-month-year');
  if (monthYearInput) {
    monthYearInput.addEventListener('change', onStaffSelected);
  }

  ['pr-basic', 'pr-allowances', 'pr-deductions'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', calculateNetPayout);
  });

  const guestSelect = document.getElementById('custBookingSelect');
  if (guestSelect) {
    guestSelect.addEventListener('change', (e) => onCustomGuestSelected(e.target.value));
  }

  ['pkgSpa', 'pkgTransfer', 'pkgMeal'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', calculateCustomTotal);
  });

  ['custChargeAmount1', 'custDiscount'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', calculateCustomTotal);
  });

  // 6. Pre-fetch payroll records, active guests, and update overview metrics if present
  if (document.getElementById('payroll-table-body')) {
    loadPayrollData();
  }
  if (document.getElementById('custBookingSelect')) {
    loadActiveCheckedInGuests();
  }
  if (document.getElementById('kpiNetProfit')) {
    updateFinanceOverviewMetrics();
  }
});

// Explicit Global Window Attachments
window.openUnifiedFolio = openUnifiedFolio;
window.closeUnifiedFolio = closeUnifiedFolio;
window.openSettleModal = openSettleModal;
window.closeSettleModal = closeSettleModal;
window.handleUnifiedSettleSubmit = handleUnifiedSettleSubmit;
window.triggerPrintFromFolio = triggerPrintFromFolio;
window.resendReceiptEmail = resendReceiptEmail;
window.loadPayrollData = loadPayrollData;
window.openAddPayrollModal = openAddPayrollModal;
window.closeAddPayrollModal = closeAddPayrollModal;
window.onStaffSelected = onStaffSelected;
window.calculateNetPayout = calculateNetPayout;
window.handlePayrollSubmit = handlePayrollSubmit;
window.deletePayrollRecord = deletePayrollRecord;
window.updateFinanceOverviewMetrics = updateFinanceOverviewMetrics;
window.openCustomInvoiceModal = openCustomInvoiceModal;
window.closeCustomInvoiceModal = closeCustomInvoiceModal;
window.openInvoiceModal = openInvoiceModal;
window.closeInvoiceModal = closeInvoiceModal;
window.onCustomGuestSelected = onCustomGuestSelected;
window.calculateCustomTotal = calculateCustomTotal;
window.goToInvoiceStep = goToInvoiceStep;
window.populateFolioItemizedLedger = populateFolioItemizedLedger;
window.handleCustomInvoiceSubmit = handleCustomInvoiceSubmit;
