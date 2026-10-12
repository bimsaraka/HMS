/**
 * Pinnacle Bay Hotel Management System
 * Global Admin Return & Persistent Oversight Navigation Banner
 */
(function() {
  // Transparent Bearer Token Injector for outgoing API calls from authenticated sessions
  if (typeof window !== 'undefined' && window.fetch) {
    const _origFetch = window.fetch;
    window.fetch = function(input, init) {
      try {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        if (token) {
          init = init || {};
          let headers = init.headers || {};
          if (typeof Headers !== 'undefined' && headers instanceof Headers) {
            if (!headers.has('Authorization')) {
              headers.set('Authorization', 'Bearer ' + token);
            }
          } else if (Array.isArray(headers)) {
            const hasAuth = headers.some(([k]) => k.toLowerCase() === 'authorization');
            if (!hasAuth) headers.push(['Authorization', 'Bearer ' + token]);
          } else {
            const hasAuth = Object.keys(headers).some(k => k.toLowerCase() === 'authorization');
            if (!hasAuth) {
              headers = Object.assign({}, headers, { 'Authorization': 'Bearer ' + token });
            }
          }
          init.headers = headers;
        }
      } catch (e) {
        // pass through
      }
      return _origFetch.call(this, input, init);
    };
  }

  function initAdminOversight() {
    const currentPath = window.location.pathname.toLowerCase();
    
    // Do not show banner on the Admin Hub itself or the login page
    if (
      currentPath.endsWith('admin-dashboard.html') || 
      currentPath.endsWith('/admin') || 
      currentPath.endsWith('index.html') || 
      currentPath === '/'
    ) {
      return;
    }

    // Check user state from localStorage and sessionStorage
    let isAdmin = false;
    let userName = 'Administrator';
    try {
      const userRaw = localStorage.getItem('user') || sessionStorage.getItem('user');
      if (userRaw) {
        const u = JSON.parse(userRaw);
        const role = (u.role || '').toLowerCase();
        if (role === 'admin' || role === 'administrator' || role === 'sysadmin') {
          isAdmin = true;
          if (u.name) userName = u.name;
        }
      }
      
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      if (token && token.toLowerCase().includes('admin')) {
        isAdmin = true;
      }

      // Check URL search parameters (e.g., ?role=admin or ?from=admin)
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('admin') === 'true' || urlParams.get('role') === 'admin' || urlParams.get('from') === 'admin') {
        isAdmin = true;
      }
    } catch (e) {
      console.error('[Admin Oversight] Error checking user state:', e);
    }

    // If not logged in as Admin, remove any existing banner and return
    if (!isAdmin) {
      const existing = document.getElementById('admin-oversight-bar');
      if (existing) existing.remove();
      return;
    }

    // Determine current department name
    let deptName = 'Observing Department View';
    if (currentPath.includes('reception') || document.title.toLowerCase().includes('reception')) {
      deptName = 'Observing Front Desk & Reservations';
    } else if (currentPath.includes('ops') || document.title.toLowerCase().includes('operation') || document.title.toLowerCase().includes('housekeeping')) {
      deptName = 'Observing Housekeeping & Operations';
    } else if (currentPath.includes('finance') || document.title.toLowerCase().includes('finance') || document.title.toLowerCase().includes('billing')) {
      deptName = 'Observing Finance & Billing';
    }

    // Check if banner already exists
    let banner = document.getElementById('admin-oversight-bar');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'admin-oversight-bar';
      banner.setAttribute('style', 'background: linear-gradient(90deg, #1e293b, #0f172a); border-bottom: 2px solid #d97706; padding: 10px 24px; display: flex; justify-content: space-between; align-items: center; z-index: 99999; position: sticky; top: 0; width: 100%; box-sizing: border-box;');
      banner.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px; color: #f8fafc; font-size: 14px; font-weight: 500; font-family: 'Inter', -apple-system, sans-serif;">
          <span style="background: #d97706; color: #fff; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 700; font-family: 'Outfit', sans-serif; letter-spacing: 0.5px;">ADMIN VIEW</span>
          <span id="admin-oversight-dept-text">${deptName}</span>
        </div>
        <button id="btn-back-to-admin" type="button" style="background: #d97706; color: #fff; border: none; padding: 6px 14px; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 13px; font-family: 'Outfit', sans-serif; transition: background 0.2s; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 2px 6px rgba(0,0,0,0.25);">
          ← Back to Admin Hub
        </button>
      `;

      if (document.body) {
        document.body.prepend(banner);
      } else {
        window.addEventListener('DOMContentLoaded', () => {
          if (document.body && !document.getElementById('admin-oversight-bar')) {
            document.body.prepend(banner);
          }
        });
      }
    } else {
      const deptEl = document.getElementById('admin-oversight-dept-text');
      if (deptEl) deptEl.textContent = deptName;
    }

    // Attach click listener to Return button
    const backBtn = document.getElementById('btn-back-to-admin');
    if (backBtn) {
      backBtn.onclick = function(e) {
        e.preventDefault();
        window.location.href = 'admin-dashboard.html';
      };
      backBtn.onmouseover = function() { this.style.background = '#b45309'; };
      backBtn.onmouseout = function() { this.style.background = '#d97706'; };
    }

    // Update role badge in header if present
    const userRoleEl = document.querySelector('.user-role');
    if (userRoleEl && isAdmin) {
      userRoleEl.textContent = 'Administrator';
    }
  }

  // Run on initial script execution and on events
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAdminOversight);
  } else {
    initAdminOversight();
  }

  window.addEventListener('pageshow', initAdminOversight);
  window.addEventListener('load', initAdminOversight);
})();

// =======================================================
// Monthly Staff Attendance Summary View Module
// =======================================================
(function() {
  /**
   * Initializes the Monthly Staff Attendance Summary panel
   */
  function initMonthlyAttendanceSummary() {
    const staffSelect = document.getElementById('monthlySummaryStaffSelect');
    const monthPicker = document.getElementById('monthlySummaryMonth');
    const viewBtn = document.getElementById('btnViewMonthlySummary');

    if (!staffSelect || !monthPicker) return;

    // Set default month to current year-month (e.g. 2026-09)
    if (!monthPicker.value) {
      const now = new Date();
      const yr = now.getFullYear();
      const mo = String(now.getMonth() + 1).padStart(2, '0');
      monthPicker.value = `${yr}-${mo}`;
    }

    // Populate staff dropdown
    populateMonthlyStaffDropdown();

    // Attach button click handler
    if (viewBtn) {
      viewBtn.onclick = function(e) {
        if (e) e.preventDefault();
        loadMonthlyAttendanceSummary();
      };
    }

    // When staff dropdown or month changes, update summary
    staffSelect.onchange = function() {
      if (staffSelect.value) {
        loadMonthlyAttendanceSummary();
      }
    };
    monthPicker.onchange = function() {
      if (staffSelect.value) {
        loadMonthlyAttendanceSummary();
      }
    };
  }

  /**
   * Populates the Monthly Summary staff dropdown from available user/staff records
   */
  function populateMonthlyStaffDropdown(customUsers) {
    const select = document.getElementById('monthlySummaryStaffSelect');
    if (!select) return;

    const currentVal = select.value;
    select.innerHTML = '<option value="">-- Select Staff Member --</option>';

    const usersList = customUsers || window.users || [];
    if (usersList.length > 0) {
      renderStaffOptions(usersList, currentVal);
    } else {
      // Fetch users from API
      const API_BASE = window.location.origin.includes('localhost:3000') ? '' : 'http://localhost:3000';
      fetch(`${API_BASE}/api/users`)
        .then(res => res.json())
        .then(data => {
          const list = data.users || data || [];
          renderStaffOptions(list, currentVal);
        })
        .catch(err => {
          console.warn('[Monthly Attendance] Could not fetch users for dropdown:', err);
        });
    }
  }

  function renderStaffOptions(usersList, currentVal) {
    const select = document.getElementById('monthlySummaryStaffSelect');
    if (!select) return;

    usersList.forEach(u => {
      const staffId = u.user_id ? u.user_id : (typeof u.id === 'string' && u.id.startsWith('PB-') ? u.id : `PB-USR-${u.id}`);
      const opt = document.createElement('option');
      opt.value = staffId;
      opt.dataset.name = u.name || u.full_name || '';
      const roleStr = u.role ? (u.role.charAt(0).toUpperCase() + u.role.slice(1)) : 'Staff';
      const desigSuffix = u.designation ? ` - ${u.designation}` : '';
      opt.textContent = `[${staffId}] ${u.name || u.full_name} (${roleStr}${desigSuffix})`;
      select.appendChild(opt);
    });

    if (currentVal) {
      select.value = currentVal;
    } else if (select.options.length > 1) {
      // Auto-select first staff member and load summary
      select.selectedIndex = 1;
      setTimeout(() => {
        loadMonthlyAttendanceSummary();
      }, 100);
    }
  }

  /**
   * Sends GET request to /api/admin/attendance/monthly-summary and populates KPIs and breakdown table
   */
  async function loadMonthlyAttendanceSummary() {
    const staffSelect = document.getElementById('monthlySummaryStaffSelect');
    const monthPicker = document.getElementById('monthlySummaryMonth');
    const kpiPresent = document.getElementById('kpiMonthlyPresent');
    const kpiOT = document.getElementById('kpiMonthlyOT');
    const kpiLeaves = document.getElementById('kpiMonthlyLeaves');
    const kpiHalfDays = document.getElementById('kpiMonthlyHalfDays');
    const tableBody = document.getElementById('monthlyAttendanceTableBody');
    const emptyState = document.getElementById('monthlyAttendanceEmpty');
    const countBadge = document.getElementById('monthlyAttendanceCountBadge');
    const staffNameHeader = document.getElementById('monthlyStaffSelectedName');

    if (!staffSelect || !monthPicker) return;

    const staffId = staffSelect.value.trim();
    const month = monthPicker.value.trim();

    if (!staffId) {
      if (typeof showToast === 'function') {
        showToast('Please select a staff member to view attendance summary.', true);
      } else {
        alert('Please select a staff member to view attendance summary.');
      }
      return;
    }

    const selectedOption = staffSelect.options[staffSelect.selectedIndex];
    const staffDisplayName = selectedOption ? (selectedOption.dataset.name || selectedOption.textContent) : staffId;
    if (staffNameHeader) {
      staffNameHeader.textContent = staffDisplayName;
    }

    // Set loading indicator in KPIs
    if (kpiPresent) kpiPresent.textContent = '...';
    if (kpiOT) kpiOT.textContent = '...';
    if (kpiLeaves) kpiLeaves.textContent = '...';
    if (kpiHalfDays) kpiHalfDays.textContent = '...';
    if (tableBody) {
      tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 2rem; color: var(--text-gray);">
        <span style="display:inline-block; margin-right: 8px;">⏳</span> Loading monthly attendance records...
      </td></tr>`;
    }
    if (emptyState) emptyState.style.display = 'none';

    try {
      const API_BASE = window.location.origin.includes('localhost:3000') ? '' : 'http://localhost:3000';
      const url = `${API_BASE}/api/admin/attendance/monthly-summary?staff_id=${encodeURIComponent(staffId)}&month=${encodeURIComponent(month)}`;
      
      const res = await fetch(url);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Failed to fetch monthly attendance summary');
      }

      const data = await res.json();

      // 1. Populate the 4 KPI metric cards dynamically
      const presentDays = data.present_days !== undefined ? data.present_days : 0;
      const totalOT = data.total_ot_hours !== undefined ? parseFloat(data.total_ot_hours).toFixed(1) : '0.0';
      const leaveDays = data.leave_days !== undefined ? data.leave_days : 0;
      const halfDays = data.half_days !== undefined ? data.half_days : 0;

      if (kpiPresent) kpiPresent.textContent = `${presentDays} ${presentDays === 1 ? 'Day' : 'Days'}`;
      if (kpiOT) kpiOT.textContent = `${totalOT} hrs`;
      if (kpiLeaves) kpiLeaves.textContent = `${leaveDays} ${leaveDays === 1 ? 'Day' : 'Days'}`;
      if (kpiHalfDays) kpiHalfDays.textContent = `${halfDays} ${halfDays === 1 ? 'Day' : 'Days'}`;

      // 2. Populate Detailed Month Table
      const records = Array.isArray(data.records) ? data.records : [];
      if (countBadge) {
        countBadge.textContent = `${records.length} ${records.length === 1 ? 'Day Logged' : 'Days Logged'}`;
      }

      if (!tableBody) return;
      tableBody.innerHTML = '';

      if (records.length === 0) {
        if (emptyState) emptyState.style.display = 'block';
      } else {
        if (emptyState) emptyState.style.display = 'none';

        records.forEach(rec => {
          const row = document.createElement('tr');
          const st = (rec.status || 'Present').trim();
          const stUpper = st.toUpperCase();

          let badgeClass = 'badge-present';
          let customBadgeStyle = '';
          if (stUpper === 'HALF DAY') {
            badgeClass = 'badge-half-day';
          } else if (stUpper === 'LEAVE') {
            customBadgeStyle = 'background: rgba(168, 85, 247, 0.15); color: #c084fc; border: 1px solid rgba(168, 85, 247, 0.3);';
          } else if (stUpper === 'ABSENT') {
            badgeClass = 'badge-absent';
          }

          const otNum = parseFloat(rec.ot_hours) || 0;
          const otHtml = otNum > 0
            ? `<span style="display:inline-flex; align-items:center; gap:0.35rem; background:rgba(var(--accent-gold-rgb), 0.12); color:var(--accent-gold); border:1px solid rgba(var(--accent-gold-rgb), 0.3); padding:0.2rem 0.55rem; border-radius:6px; font-weight:700; font-size:0.8rem;">+${otNum.toFixed(1)} hrs OT</span>`
            : `<span style="color:var(--text-muted); font-size:0.85rem;">0.0 hrs</span>`;

          const clockInDisplay = rec.clock_in && rec.clock_in !== '--' ? rec.clock_in : '<span style="color:var(--text-muted);">--</span>';
          const clockOutDisplay = rec.clock_out && rec.clock_out !== '--' ? rec.clock_out : '<span style="color:var(--text-muted);">--</span>';

          row.innerHTML = `
            <td style="font-weight:600; color:var(--text-white); font-family:var(--font-outfit);">${rec.date}</td>
            <td><span class="role-badge" style="background-color:rgba(255,255,255,0.03);">${rec.shift || 'Morning Shift (8:00 AM - 5:00 PM)'}</span></td>
            <td style="font-weight:600; color:var(--text-white);">${clockInDisplay}</td>
            <td style="font-weight:600; color:var(--text-white);">${clockOutDisplay}</td>
            <td>${otHtml}</td>
            <td>
              <span class="badge ${badgeClass}" style="${customBadgeStyle}">${st}</span>
            </td>
          `;
          tableBody.appendChild(row);
        });
      }

    } catch (err) {
      console.error('[Monthly Attendance Summary] Error:', err);
      if (kpiPresent) kpiPresent.textContent = '0 Days';
      if (kpiOT) kpiOT.textContent = '0.0 hrs';
      if (kpiLeaves) kpiLeaves.textContent = '0 Days';
      if (kpiHalfDays) kpiHalfDays.textContent = '0 Days';
      if (tableBody) {
        tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 1.5rem; color: #ef4444;">
          Failed to load monthly attendance summary: ${err.message}
        </td></tr>`;
      }
      if (typeof showToast === 'function') {
        showToast('Error loading monthly attendance summary: ' + err.message, true);
      }
    }
  }

  /**
   * Toggles collapse/expand of the Detailed Month Table
   */
  function toggleMonthlyAttendanceTable() {
    const container = document.getElementById('monthlyAttendanceTableWrapper');
    const toggleIcon = document.getElementById('monthlyTableToggleIcon');
    const toggleText = document.getElementById('monthlyTableToggleText');

    if (!container) return;

    const isHidden = container.style.display === 'none';
    if (isHidden) {
      container.style.display = 'block';
      if (toggleText) toggleText.textContent = 'Hide Breakdown';
      if (toggleIcon) toggleIcon.style.transform = 'rotate(180deg)';
    } else {
      container.style.display = 'none';
      if (toggleText) toggleText.textContent = 'Show Breakdown';
      if (toggleIcon) toggleIcon.style.transform = 'rotate(0deg)';
    }
  }

  // Export functions to global scope
  window.initMonthlyAttendanceSummary = initMonthlyAttendanceSummary;
  window.populateMonthlyStaffDropdown = populateMonthlyStaffDropdown;
  window.loadMonthlyAttendanceSummary = loadMonthlyAttendanceSummary;
  window.toggleMonthlyAttendanceTable = toggleMonthlyAttendanceTable;

  // Auto-init when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMonthlyAttendanceSummary);
  } else {
    initMonthlyAttendanceSummary();
  }
})();

// =======================================================
// Admin Module: Client Validation & Error Feedback Utilities
// =======================================================
(function() {
  /**
   * Parses time string (12-hour AM/PM or 24-hour HH:mm) into minutes from midnight
   */
  function parseTimeToMinutes(timeStr) {
    if (!timeStr || typeof timeStr !== 'string') return null;
    const str = timeStr.trim();
    if (str === '--' || str === '--:--' || str.toLowerCase() === 'pending') return null;

    // Check 12-hour format: e.g. "08:00 AM", "5:00 PM", "8:30pm"
    const match12 = str.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (match12) {
      let hours = parseInt(match12[1], 10);
      const mins = parseInt(match12[2], 10);
      const meridiem = match12[3].toUpperCase();
      if (meridiem === 'PM' && hours < 12) hours += 12;
      if (meridiem === 'AM' && hours === 12) hours = 0;
      return hours * 60 + mins;
    }

    // Check 24-hour format: e.g. "08:00", "17:30"
    const match24 = str.match(/^(\d{1,2}):(\d{2})$/);
    if (match24) {
      const hours = parseInt(match24[1], 10);
      const mins = parseInt(match24[2], 10);
      return hours * 60 + mins;
    }

    return null;
  }

  /**
   * Validates clock-in and clock-out time logic.
   * If both times are provided, verifies clock_out > clock_in.
   * If invalid, returns { valid: false, error: 'Clock-out time cannot be earlier than clock-in time.' }
   */
  function validateAttendanceTimes(clockIn, clockOut) {
    if (!clockIn || !clockOut) {
      return { valid: true };
    }

    const inMins = parseTimeToMinutes(clockIn);
    const outMins = parseTimeToMinutes(clockOut);

    if (inMins !== null && outMins !== null) {
      if (outMins <= inMins) {
        return {
          valid: false,
          error: 'Clock-out time cannot be earlier than clock-in time.'
        };
      }
    }

    return { valid: true };
  }

  /**
   * Displays a user-friendly inline alert within a specified container or form.
   */
  function showInlineAlert(containerOrId, message, type = 'error') {
    const container = typeof containerOrId === 'string'
      ? document.getElementById(containerOrId)
      : containerOrId;

    if (!container) return;

    const isError = type === 'error';
    const bgColor = isError ? 'rgba(239, 68, 68, 0.12)' : 'rgba(16, 185, 129, 0.12)';
    const borderColor = isError ? 'rgba(239, 68, 68, 0.35)' : 'rgba(16, 185, 129, 0.35)';
    const textColor = isError ? '#fca5a5' : '#6ee7b7';
    const iconSvg = isError
      ? `<svg style="width: 18px; height: 18px; fill: #ef4444; flex-shrink: 0;" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>`
      : `<svg style="width: 18px; height: 18px; fill: #10b981; flex-shrink: 0;" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>`;

    container.style.display = 'flex';
    container.style.alignItems = 'center';
    container.style.gap = '0.75rem';
    container.style.padding = '0.75rem 1rem';
    container.style.borderRadius = '8px';
    container.style.background = bgColor;
    container.style.border = `1px solid ${borderColor}`;
    container.style.color = textColor;
    container.style.fontSize = '0.875rem';
    container.style.fontWeight = '500';
    container.style.lineHeight = '1.4';
    container.innerHTML = `
      ${iconSvg}
      <span style="flex: 1;">${message}</span>
      <button type="button" style="background: none; border: none; color: ${textColor}; cursor: pointer; padding: 0 4px; font-size: 16px; opacity: 0.8;" onclick="this.parentElement.style.display='none'" aria-label="Dismiss alert">&times;</button>
    `;
  }

  /**
   * Clears an inline alert.
   */
  function clearInlineAlert(containerOrId) {
    const container = typeof containerOrId === 'string'
      ? document.getElementById(containerOrId)
      : containerOrId;

    if (container) {
      container.style.display = 'none';
      container.innerHTML = '';
    }
  }

  /**
   * Comprehensive validation for Attendance Marking Form or Modal.
   * Checks required fields, OT hours (0-12), and time logic (clock_out > clock_in).
   */
  function validateAttendanceForm(options = {}) {
    const staffId = (options.staff_id || '').trim();
    const date = (options.date || '').trim();
    const shift = (options.shift || '').trim();
    const otHours = options.ot_hours;
    const clockIn = (options.clock_in || '').trim();
    const clockOut = (options.clock_out || '').trim();
    const alertContainerId = options.alertContainerId || 'attendanceFormAlert';

    clearInlineAlert(alertContainerId);

    // 1. Validate required fields
    if (!staffId) {
      const errMsg = 'Please select a staff member.';
      showInlineAlert(alertContainerId, errMsg, 'error');
      if (typeof showToast === 'function') showToast(errMsg, true);
      return false;
    }

    if (!date) {
      const errMsg = 'Attendance date is required.';
      showInlineAlert(alertContainerId, errMsg, 'error');
      if (typeof showToast === 'function') showToast(errMsg, true);
      return false;
    }

    if (!shift) {
      const errMsg = 'Assigned shift is required.';
      showInlineAlert(alertContainerId, errMsg, 'error');
      if (typeof showToast === 'function') showToast(errMsg, true);
      return false;
    }

    // 2. Validate OT Hours
    if (otHours !== undefined && otHours !== null && otHours !== '') {
      const otNum = parseFloat(otHours);
      if (isNaN(otNum) || otNum < 0) {
        const errMsg = 'Overtime (OT) hours cannot be negative.';
        showInlineAlert(alertContainerId, errMsg, 'error');
        if (typeof showToast === 'function') showToast(errMsg, true);
        return false;
      }
      if (otNum > 12) {
        const errMsg = 'Overtime (OT) hours cannot exceed 12 hours.';
        showInlineAlert(alertContainerId, errMsg, 'error');
        if (typeof showToast === 'function') showToast(errMsg, true);
        return false;
      }
    }

    // 3. Validate Time Logic (clock_out > clock_in)
    if (clockIn && clockOut) {
      const timeValidation = validateAttendanceTimes(clockIn, clockOut);
      if (!timeValidation.valid) {
        const errMsg = timeValidation.error || 'Clock-out time cannot be earlier than clock-in time.';
        showInlineAlert(alertContainerId, errMsg, 'error');
        if (typeof showToast === 'function') {
          showToast(errMsg, true);
        } else if (typeof alert === 'function') {
          alert(errMsg);
        }
        return false;
      }
    }

    return true;
  }

  // Export to global scope
  window.parseTimeToMinutes = parseTimeToMinutes;
  window.validateAttendanceTimes = validateAttendanceTimes;
  window.showInlineAlert = showInlineAlert;
  window.clearInlineAlert = clearInlineAlert;
  window.validateAttendanceForm = validateAttendanceForm;
})();

