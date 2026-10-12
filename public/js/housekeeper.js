/**
 * Pinnacle Bay Hotel Management System - Housekeeper Controller Module
 * Handles Special Requests & Tasks routing, room cleaning status updates, and live polling
 */

let housekeepingRequests = [];
let housekeepingRooms = [];
let housekeepingPackages = [];
let packageAssignments = [];
let currentRequestFilter = 'all';

function getApiBase() {
  return (typeof window !== 'undefined' && window.location && window.location.origin && window.location.origin.includes('localhost:3000'))
    ? '' 
    : 'http://localhost:3000';
}

/**
 * Initialize Housekeeper Dashboard
 */
document.addEventListener('DOMContentLoaded', () => {
  // Pull session user if available
  const sessionUser = localStorage.getItem('currentUser') || localStorage.getItem('user') || sessionStorage.getItem('currentUser') || sessionStorage.getItem('user');
  if (sessionUser) {
    try {
      const u = JSON.parse(sessionUser);
      const hkHeader = document.getElementById('hkUserNameHeader');
      if (hkHeader && u.name) hkHeader.textContent = u.name.split(' (')[0];
    } catch (e) {
      console.error('Session user parse error:', e);
    }
  }

  loadHousekeeperData();
  
  // Set up auto-refresh polling every 8 seconds
  setInterval(() => {
    loadHousekeeperRequests(true);
  }, 8000);
});

/**
 * Load all Housekeeper Dashboard Data
 */
async function loadHousekeeperData() {
  await Promise.all([
    loadHousekeeperRequests(),
    loadHousekeepingRooms(),
    loadHousekeepingPackages(),
    loadPackageAssignments()
  ]);
  updateHousekeeperKPIs();
}

/**
 * Fetch Special Requests & Tasks from /api/housekeeping/requests
 */
async function loadHousekeeperRequests(silent = false) {
  const API_BASE = getApiBase();
  const loadingEl = document.getElementById('hkRequestsLoading');
  if (loadingEl && !silent) loadingEl.style.display = 'block';

  try {
    const res = await fetch(`${API_BASE}/api/housekeeping/requests?all=true`);
    const data = await res.json();
    
    if (data.success && Array.isArray(data.requests)) {
      housekeepingRequests = data.requests.map(r => ({
        id: r.id || r.request_id,
        requestId: r.request_id || r.id,
        roomNumber: r.room_number || r.roomNo || 'General',
        guestName: r.guest_name || 'Guest',
        requestType: r.request_type || 'Special Request',
        description: r.description || r.notes || r.request_type || '',
        priority: r.priority || 'Medium',
        status: r.status || 'Pending',
        createdAt: r.created_at ? new Date(r.created_at) : new Date(),
        timeStr: r.created_at ? new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Today'
      }));
      renderHousekeeperRequests();
      updateHousekeeperKPIs();
    }
  } catch (err) {
    console.error('[Housekeeper] Error loading special requests:', err);
  } finally {
    if (loadingEl) loadingEl.style.display = 'none';
  }
}

/**
 * Fetch Room List and Cleaning Status
 */
async function loadHousekeepingRooms() {
  const API_BASE = getApiBase();
  try {
    const [roomsRes, hkRes] = await Promise.all([
      fetch(`${API_BASE}/api/rooms`).then(r => r.json()).catch(() => []),
      fetch(`${API_BASE}/api/ops/housekeeping`).then(r => r.json()).catch(() => [])
    ]);

    const roomsArr = Array.isArray(roomsRes) ? roomsRes : (roomsRes.rooms || roomsRes.data || []);
    const hkMap = {};
    if (Array.isArray(hkRes)) {
      hkRes.forEach(h => { hkMap[h.room_number] = h; });
    }

    housekeepingRooms = roomsArr.map(r => {
      const hk = hkMap[r.room_number] || {};
      return {
        roomNumber: r.room_number,
        category: r.category || r.room_type || 'Standard Suite',
        status: (r.status || 'Available').toLowerCase(),
        cleaningStatus: hk.cleaning_status || (r.status === 'Occupied' ? 'Occupied' : 'Clean'),
        lastCleaned: hk.last_cleaned || 'Today',
        floor: r.floor || Math.floor(parseInt(r.room_number, 10) / 100) || 1,
        imageUrl: r.image_url || 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=600&q=80'
      };
    });

    renderHousekeepingRooms();
    populatePackageRoomDropdown();
    updateHousekeeperKPIs();
  } catch (err) {
    console.error('[Housekeeper] Error loading rooms:', err);
  }
}

/**
 * Filter requests by status
 */
function setRequestFilter(filter) {
  currentRequestFilter = filter;
  document.querySelectorAll('.hk-filter-btn').forEach(btn => {
    btn.classList.remove('active');
    if (btn.getAttribute('data-filter') === filter) {
      btn.classList.add('active');
    }
  });
  renderHousekeeperRequests();
}

/**
 * Render Special Requests & Tasks List
 */
function renderHousekeeperRequests() {
  const tbody = document.getElementById('hkRequestsTableBody');
  const emptyState = document.getElementById('hkRequestsEmpty');
  if (!tbody) return;

  tbody.innerHTML = '';

  let filtered = housekeepingRequests;
  if (currentRequestFilter === 'pending') {
    filtered = housekeepingRequests.filter(r => ['pending', 'in progress', 'open', 'assigned'].includes(r.status.toLowerCase()));
  } else if (currentRequestFilter === 'completed') {
    filtered = housekeepingRequests.filter(r => ['completed', 'resolved', 'done'].includes(r.status.toLowerCase()));
  }

  if (filtered.length === 0) {
    if (emptyState) emptyState.style.display = 'block';
    return;
  }
  if (emptyState) emptyState.style.display = 'none';

  filtered.forEach(req => {
    const tr = document.createElement('tr');
    tr.className = 'border-b border-slate-800 hover:bg-slate-800/40 transition duration-150';

    const isDone = ['completed', 'resolved', 'done'].includes(req.status.toLowerCase());
    const statusBadge = isDone
      ? `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
           <svg class="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
           Completed
         </span>`
      : `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
           <span class="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
           ${req.status}
         </span>`;

    let priorityBadge = '';
    const prio = req.priority.toLowerCase();
    if (prio === 'high' || prio === 'urgent') {
      priorityBadge = `<span class="px-2 py-0.5 rounded text-xs font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20 uppercase">High</span>`;
    } else if (prio === 'medium' || prio === 'normal') {
      priorityBadge = `<span class="px-2 py-0.5 rounded text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase">Medium</span>`;
    } else {
      priorityBadge = `<span class="px-2 py-0.5 rounded text-xs font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 uppercase">Low</span>`;
    }

    tr.innerHTML = `
      <td class="py-3.5 px-4 font-bold text-amber-400">
        <span class="bg-amber-400/10 text-amber-400 border border-amber-400/20 px-2.5 py-1 rounded-lg">
          Room ${req.roomNumber}
        </span>
      </td>
      <td class="py-3.5 px-4">
        <div class="font-semibold text-white flex items-center gap-2">
          <span>${req.requestType}</span>
        </div>
        ${req.description && req.description !== req.requestType 
          ? `<div class="text-xs text-slate-400 mt-1">${req.description}</div>` 
          : ''}
        ${req.guestName ? `<div class="text-xs text-slate-500 mt-0.5">Guest: ${req.guestName}</div>` : ''}
      </td>
      <td class="py-3.5 px-4 text-xs text-slate-300">
        ${req.timeStr}
      </td>
      <td class="py-3.5 px-4">
        ${priorityBadge}
      </td>
      <td class="py-3.5 px-4">
        ${statusBadge}
      </td>
      <td class="py-3.5 px-4 text-right">
        ${!isDone 
          ? `<button onclick="completeHousekeepingTask('${req.id}', '${req.roomNumber}')" class="px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-md transition duration-150 inline-flex items-center gap-1.5 cursor-pointer">
               <svg class="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
               Mark Done
             </button>`
          : `<span class="text-xs text-emerald-400 font-medium inline-flex items-center gap-1">
               <svg class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>
               Completed
             </span>`
        }
      </td>
    `;
    tbody.appendChild(tr);
  });
}

/**
 * Mark Task as Completed via PUT /api/housekeeping/requests/:id/complete
 */
async function completeHousekeepingTask(taskId, roomNumber) {
  const API_BASE = getApiBase();
  try {
    const res = await fetch(`${API_BASE}/api/housekeeping/requests/${taskId}/complete`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'Completed' })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      showHkToast(`Task for Room ${roomNumber} marked as Completed!`);
      await loadHousekeeperRequests(true);
    } else {
      alert("Error completing task: " + (data.message || "Failed to update"));
    }
  } catch (err) {
    console.error("[Housekeeper] Failed to complete task:", err);
    alert("Network error updating task: " + err.message);
  }
}

/**
 * Render Room Housekeeping Grid
 */
function renderHousekeepingRooms() {
  const grid = document.getElementById('hkRoomsGrid');
  if (!grid) return;

  grid.innerHTML = '';
  housekeepingRooms.forEach(room => {
    const isDirty = ['dirty', 'cleaning', 'in progress'].includes((room.cleaningStatus || '').toLowerCase()) || room.status === 'dirty';
    const isOccupied = room.status === 'occupied';

    let statusColor = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
    let statusLabel = 'Clean / Ready';
    if (isDirty) {
      statusColor = 'text-amber-400 bg-amber-500/10 border-amber-500/20';
      statusLabel = 'Needs Cleaning';
    } else if (isOccupied) {
      statusColor = 'text-rose-400 bg-rose-500/10 border-rose-500/20';
      statusLabel = 'Occupied';
    }

    const card = document.createElement('div');
    card.className = 'bg-slate-900 border border-slate-800 rounded-xl overflow-hidden hover:border-amber-400/50 transition duration-200 flex flex-col justify-between';
    card.innerHTML = `
      <div class="p-4">
        <div class="flex justify-between items-start mb-2">
          <div>
            <h4 class="text-lg font-bold text-white">Room ${room.roomNumber}</h4>
            <span class="text-xs text-slate-400">${room.category} • Floor ${room.floor}</span>
          </div>
          <span class="px-2.5 py-1 rounded-full text-xs font-bold border ${statusColor}">
            ${statusLabel}
          </span>
        </div>
      </div>
      <div class="p-3 bg-slate-950/60 border-t border-slate-800 flex justify-between items-center gap-2">
        <button onclick="updateRoomCleaning('${room.roomNumber}', 'Clean')" class="flex-1 py-1.5 px-2 rounded bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-slate-950 border border-emerald-500/20 text-xs font-bold transition duration-150 cursor-pointer text-center">
          ✓ Mark Clean
        </button>
        <button onclick="updateRoomCleaning('${room.roomNumber}', 'Dirty')" class="flex-1 py-1.5 px-2 rounded bg-amber-500/10 hover:bg-amber-500 text-amber-400 hover:text-slate-950 border border-amber-500/20 text-xs font-bold transition duration-150 cursor-pointer text-center">
          🧹 Mark Dirty
        </button>
      </div>
    `;
    grid.appendChild(card);
  });
}

/**
 * Update Room Cleaning Status via PUT /api/ops/housekeeping/:room_number
 */
async function updateRoomCleaning(roomNumber, cleaningStatus) {
  const API_BASE = getApiBase();
  try {
    const res = await fetch(`${API_BASE}/api/ops/housekeeping/${roomNumber}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cleaning_status: cleaningStatus, assigned_staff: 'Housekeeping Lead' })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      showHkToast(`Room ${roomNumber} marked as ${cleaningStatus}!`);
      await loadHousekeepingRooms();
    } else {
      alert("Failed to update room: " + (data.message || 'Error'));
    }
  } catch (err) {
    console.error("[Housekeeper] Error updating room cleaning status:", err);
  }
}

/**
 * Update Summary Counters & Badges
 */
function updateHousekeeperKPIs() {
  const activeTasks = housekeepingRequests.filter(r => ['pending', 'in progress', 'open', 'assigned'].includes(r.status.toLowerCase())).length;
  const completedTasks = housekeepingRequests.filter(r => ['completed', 'resolved', 'done'].includes(r.status.toLowerCase())).length;
  const dirtyRooms = housekeepingRooms.filter(r => ['dirty', 'cleaning', 'in progress'].includes((r.cleaningStatus || '').toLowerCase()) || r.status === 'dirty').length;
  const totalRooms = housekeepingRooms.length;

  const elActiveTasks = document.getElementById('kpiActiveTasks');
  const elCompletedTasks = document.getElementById('kpiCompletedTasks');
  const elDirtyRooms = document.getElementById('kpiDirtyRooms');
  const elTotalRooms = document.getElementById('kpiTotalRooms');
  const elHeaderBadge = document.getElementById('hkHeaderPendingBadge');

  if (elActiveTasks) elActiveTasks.textContent = activeTasks;
  if (elCompletedTasks) elCompletedTasks.textContent = completedTasks;
  if (elDirtyRooms) elDirtyRooms.textContent = dirtyRooms;
  if (elTotalRooms) elTotalRooms.textContent = totalRooms;
  if (elHeaderBadge) elHeaderBadge.textContent = `${activeTasks} Active`;
}

/**
 * Toast notification
 */
function showHkToast(message) {
  const toast = document.getElementById('hkToast');
  const toastMsg = document.getElementById('hkToastMsg');
  if (!toast || !toastMsg) return;

  toastMsg.textContent = message;
  toast.classList.remove('hidden');
  toast.classList.add('flex');

  setTimeout(() => {
    toast.classList.add('hidden');
    toast.classList.remove('flex');
  }, 3500);
}

// =============================================
// ROOM AMENITY & SETUP PACKAGE MANAGEMENT
// =============================================

/**
 * Load available housekeeping packages
 */
async function loadHousekeepingPackages() {
  const API_BASE = getApiBase();
  try {
    const res = await fetch(`${API_BASE}/api/housekeeping/packages`);
    const data = await res.json();
    const pkgList = data.packages || (Array.isArray(data) ? data : []);
    housekeepingPackages = pkgList;
    populatePackageDropdown();
    renderAvailablePackagesList();
  } catch (err) {
    console.error('[Housekeeper] Error loading packages:', err);
  }
}

/**
 * Load room package assignments
 */
async function loadPackageAssignments() {
  const API_BASE = getApiBase();
  try {
    const res = await fetch(`${API_BASE}/api/housekeeping/assignments`);
    const data = await res.json();
    const assignList = data.assignments || (Array.isArray(data) ? data : []);
    packageAssignments = assignList;
    renderPackageAssignments();
  } catch (err) {
    console.error('[Housekeeper] Error loading assignments:', err);
  }
}

/**
 * Populate room dropdown in the assign form
 */
function populatePackageRoomDropdown() {
  const sel = document.getElementById('pkgRoomSelect');
  if (!sel) return;
  sel.innerHTML = '<option value="">-- Choose Room --</option>';
  housekeepingRooms.forEach(r => {
    sel.innerHTML += `<option value="${r.roomNumber}">Room ${r.roomNumber} — ${r.category}</option>`;
  });
}

/**
 * Populate package dropdown in the assign form
 */
function populatePackageDropdown() {
  const sel = document.getElementById('pkgPackageSelect');
  if (!sel) return;
  sel.innerHTML = '<option value="">-- Choose Package --</option>';
  housekeepingPackages.forEach(p => {
    sel.innerHTML += `<option value="${p.package_id}">${p.package_name}</option>`;
  });
}

/**
 * Render the Available Packages sidebar list
 */
function renderAvailablePackagesList() {
  const list = document.getElementById('pkgAvailableList');
  if (!list) return;
  if (housekeepingPackages.length === 0) {
    list.innerHTML = '<p class="text-slate-500 text-xs">No packages defined yet.</p>';
    return;
  }
  list.innerHTML = housekeepingPackages.map(p => `
    <div class="bg-slate-950 border border-slate-800 rounded-lg p-2.5 flex items-start justify-between gap-2">
      <div>
        <div class="font-semibold text-white text-xs">${p.package_name}</div>
        <div class="text-slate-400 mt-0.5" style="font-size: 0.65rem;">${p.description || 'No description'}</div>
        ${p.items_included ? `<div class="text-slate-500 mt-0.5" style="font-size: 0.6rem;">📦 ${p.items_included}</div>` : ''}
      </div>
      <button onclick="deletePackage(${p.package_id})" class="text-rose-400 hover:text-rose-300 cursor-pointer flex-shrink-0" title="Delete package">
        <svg class="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>
      </button>
    </div>
  `).join('');
}

/**
 * Render the Active Package Assignments table
 */
function renderPackageAssignments() {
  const tbody = document.getElementById('pkgAssignmentsTableBody');
  const emptyEl = document.getElementById('pkgAssignmentsEmpty');
  const countEl = document.getElementById('pkgAssignmentCount');
  if (!tbody) return;

  tbody.innerHTML = '';
  if (countEl) countEl.textContent = packageAssignments.length;

  if (packageAssignments.length === 0) {
    if (emptyEl) emptyEl.style.display = 'block';
    return;
  }
  if (emptyEl) emptyEl.style.display = 'none';

  packageAssignments.forEach(a => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-800/40 transition duration-150';

    const statusLower = (a.status || 'Pending').toLowerCase();
    let statusBadge, nextAction;
    if (statusLower === 'delivered') {
      statusBadge = `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">✓ Delivered</span>`;
      nextAction = '';
    } else if (statusLower === 'prepared') {
      statusBadge = `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">📦 Prepared</span>`;
      nextAction = `<button onclick="progressAssignment(${a.assignment_id}, 'Delivered')" class="px-2.5 py-1 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold shadow transition cursor-pointer">Mark Delivered</button>`;
    } else {
      statusBadge = `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20"><span class="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span> Pending</span>`;
      nextAction = `<button onclick="progressAssignment(${a.assignment_id}, 'Prepared')" class="px-2.5 py-1 rounded bg-blue-500 hover:bg-blue-400 text-white text-xs font-bold shadow transition cursor-pointer">Mark Prepared</button>`;
    }

    tr.innerHTML = `
      <td class="py-3 px-4">
        <span class="bg-amber-400/10 text-amber-400 border border-amber-400/20 px-2 py-0.5 rounded-lg text-xs font-bold">Room ${a.room_number}</span>
      </td>
      <td class="py-3 px-4">
        <div class="font-semibold text-white text-sm">${a.package_name || 'Package'}</div>
        ${a.package_description ? `<div class="text-xs text-slate-400 mt-0.5">${a.package_description}</div>` : ''}
        ${a.notes ? `<div class="text-xs text-slate-500 mt-0.5 italic">Note: ${a.notes}</div>` : ''}
      </td>
      <td class="py-3 px-4">
        <div class="text-xs text-slate-300">${a.items_included || '—'}</div>
      </td>
      <td class="py-3 px-4">${statusBadge}</td>
      <td class="py-3 px-4 text-right">
        <div class="flex items-center justify-end gap-2">
          ${nextAction}
          <button onclick="deleteAssignment(${a.assignment_id})" class="px-2 py-1 rounded bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white border border-rose-500/20 text-xs font-bold shadow transition cursor-pointer" title="Remove">🗑</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

/**
 * Submit Package Assignment form
 */
async function submitPackageAssignment(e) {
  e.preventDefault();
  const roomNumber = document.getElementById('pkgRoomSelect')?.value;
  const packageId = document.getElementById('pkgPackageSelect')?.value;
  const notes = document.getElementById('pkgNotes')?.value.trim();

  if (!roomNumber || !packageId) {
    alert('Please select both a Room and a Package.');
    return;
  }

  const API_BASE = getApiBase();
  try {
    const res = await fetch(`${API_BASE}/api/housekeeping/assignments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ room_number: roomNumber, package_id: parseInt(packageId, 10), notes })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      showHkToast(data.message || 'Package assigned successfully!');
      document.getElementById('assignPackageForm')?.reset();
      await loadPackageAssignments();
    } else {
      alert('Error: ' + (data.message || 'Failed to assign package'));
    }
  } catch (err) {
    alert('Network error: ' + err.message);
  }
}

/**
 * Progress Assignment Status (Pending → Prepared → Delivered)
 */
async function progressAssignment(assignmentId, targetStatus) {
  const API_BASE = getApiBase();
  try {
    const res = await fetch(`${API_BASE}/api/housekeeping/assignments/${assignmentId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: targetStatus })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      showHkToast(data.message || `Status updated to ${targetStatus}`);
      await loadPackageAssignments();
    } else {
      alert('Error: ' + (data.message || 'Failed to update'));
    }
  } catch (err) {
    alert('Network error: ' + err.message);
  }
}

/**
 * Delete an assignment
 */
async function deleteAssignment(assignmentId) {
  if (!confirm('Remove this package assignment?')) return;
  const API_BASE = getApiBase();
  try {
    const res = await fetch(`${API_BASE}/api/housekeeping/assignments/${assignmentId}`, { method: 'DELETE' });
    const data = await res.json();
    showHkToast(data.message || 'Assignment removed.');
    await loadPackageAssignments();
  } catch (err) {
    alert('Error: ' + err.message);
  }
}

/**
 * Open / Close Create Package Form
 */
function openCreatePackageForm() {
  const sec = document.getElementById('createPackageSection');
  if (sec) sec.classList.remove('hidden');
}
function closeCreatePackageForm() {
  const sec = document.getElementById('createPackageSection');
  if (sec) sec.classList.add('hidden');
}

/**
 * Submit New Package
 */
async function submitNewPackage() {
  const name = document.getElementById('newPkgName')?.value.trim();
  const desc = document.getElementById('newPkgDesc')?.value.trim();
  const items = document.getElementById('newPkgItems')?.value.trim();

  if (!name) {
    alert('Package name is required.');
    return;
  }

  const API_BASE = getApiBase();
  try {
    const res = await fetch(`${API_BASE}/api/housekeeping/packages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ package_name: name, description: desc, items_included: items })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      showHkToast(data.message || 'Package created!');
      document.getElementById('newPkgName').value = '';
      document.getElementById('newPkgDesc').value = '';
      document.getElementById('newPkgItems').value = '';
      closeCreatePackageForm();
      await loadHousekeepingPackages();
    } else {
      alert('Error: ' + (data.message || 'Failed to create package'));
    }
  } catch (err) {
    alert('Network error: ' + err.message);
  }
}

/**
 * Delete a Package (and its assignments)
 */
async function deletePackage(packageId) {
  if (!confirm('Delete this package? All room assignments using it will also be removed.')) return;
  const API_BASE = getApiBase();
  try {
    const res = await fetch(`${API_BASE}/api/housekeeping/packages/${packageId}`, { method: 'DELETE' });
    const data = await res.json();
    showHkToast(data.message || 'Package deleted.');
    await loadHousekeepingPackages();
    await loadPackageAssignments();
  } catch (err) {
    alert('Error: ' + err.message);
  }
}
