/**
 * Pinnacle Bay Hotel Management System - Operations & Housekeeping Dashboard Logic
 */

// Global Dashboard State
let rooms = [];
let serviceRequests = [];
let housekeepingPackages = [];
let packageAssignments = [];
let dailyMenuItems = [];
let selectedImageData = '';
let editingTaskId = null;
let currentActiveTab = 'view-cleaning-grid';
let currentRoomFilter = 'all';

/**
 * Safe Initialization on DOMContentLoaded with try/catch
 */
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', async () => {
    try {
      initSidebarTabs();
      initRoomFilterTabs();
      initRoomImageFileInput();
      initMenuEventListeners();
      setupDialogLightDismiss();
      await loadDashboardData();
    } catch (err) {
      console.error("Dashboard initialization error:", err);
    }
  });
}

function getApiBase() {
  return window.location.origin.includes('localhost:3000') ? '' : 'http://localhost:3000';
}

/**
 * Initializes sidebar tab navigation and user session header
 */
function initSidebarTabs() {
  const navBtns = document.querySelectorAll('.sidebar-nav-btn');
  navBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const tabId = btn.getAttribute('data-tab');
      if (tabId) {
        switchTab(tabId);
      }
    });
  });

  // Pull user session if available
  const sessionUser = localStorage.getItem('currentUser') || localStorage.getItem('user') || sessionStorage.getItem('currentUser') || sessionStorage.getItem('user');
  if (sessionUser) {
    try {
      const u = JSON.parse(sessionUser);
      const cleanName = u.name ? u.name.split(' (')[0] : 'Hirushan';
      const userNameHeader = document.getElementById('userNameHeader');
      const sidebarFooterUserName = document.getElementById('sidebarFooterUserName');
      const sidebarFooterAvatar = document.getElementById('sidebarFooterAvatar');
      
      if (userNameHeader) userNameHeader.textContent = cleanName;
      if (sidebarFooterUserName) sidebarFooterUserName.textContent = cleanName;
      if (sidebarFooterAvatar) sidebarFooterAvatar.textContent = cleanName.charAt(0).toUpperCase();

      const role = (u.role || '').toLowerCase();
      if (role === 'admin' || role === 'administrator' || role === 'sysadmin') {
        const bar = document.getElementById('admin-oversight-bar');
        if (bar) bar.style.display = 'flex';
        const userRoleBadge = document.querySelector('.user-role');
        if (userRoleBadge) userRoleBadge.textContent = 'Administrator';
      }
    } catch (e) {
      console.error('Session user parse error:', e);
    }
  }

  const backBtn = document.getElementById('btn-back-to-admin');
  if (backBtn) {
    backBtn.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.href = 'admin-dashboard.html';
    });
  }
}

/**
 * Initializes and binds file reading / preview for the room image file picker
 */
function initRoomImageFileInput() {
  const fileInput = document.getElementById('room-image-file');
  const previewContainer = document.getElementById('image-preview-container');
  const previewImg = document.getElementById('image-preview');
  const roomImgError = document.getElementById('room-img-error');

  if (!fileInput) return;

  fileInput.addEventListener('change', function(e) {
    const file = e.target.files && e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function(evt) {
        selectedImageData = evt.target.result;
        if (previewImg) {
          previewImg.src = selectedImageData;
        }
        if (previewContainer) {
          previewContainer.classList.remove('hidden');
          previewContainer.style.display = 'block';
        }
        if (roomImgError) {
          roomImgError.classList.add('hidden');
          roomImgError.style.display = 'none';
        }
        fileInput.style.border = '';
      };
      reader.readAsDataURL(file);
    } else {
      selectedImageData = '';
      if (previewImg) previewImg.src = '';
      if (previewContainer) {
        previewContainer.classList.add('hidden');
        previewContainer.style.display = 'none';
      }
    }
  });
}

/**
 * Tab Switching Logic with Immediate Fetch for Requests Tab
 */
function switchTab(targetTabId) {
  currentActiveTab = targetTabId;

  document.querySelectorAll('.sidebar-nav-btn').forEach(btn => {
    btn.classList.remove('active');
    if (btn.getAttribute('data-tab') === targetTabId) {
      btn.classList.add('active');
    }
  });

  document.querySelectorAll('.view-container').forEach(view => {
    view.classList.remove('active');
    view.style.display = 'none';
  });

  const targetView = document.getElementById(targetTabId);
  if (targetView) {
    targetView.style.display = 'flex';
    targetView.classList.add('active');
  }

  // When user navigates to Active Requests & Complaints, fetch latest immediately
  if (targetTabId === 'view-requests' || targetTabId === 'requests') {
    loadActiveRequests();
  }

  // When user navigates to Room Packages & Setups, fetch latest packages & assignments
  if (targetTabId === 'view-packages' || targetTabId === 'packages') {
    loadHousekeepingPackagesData();
  }

  // When user navigates to Kitchen & Dining Management, fetch latest dishes & orders
  if (targetTabId === 'view-menu' || targetTabId === 'menu') {
    if (window.KitchenSystem && typeof window.KitchenSystem.loadAll === 'function') {
      window.KitchenSystem.loadAll();
    } else {
      loadDailyMenuItems();
    }
  }
}

/**
 * Loads latest active service requests and complaints
 */
async function loadActiveRequests() {
  const API_BASE = getApiBase();
  try {
    const res = await fetch(`${API_BASE}/api/ops/requests`);
    const requestsData = await res.json();
    const rawRequests = Array.isArray(requestsData) ? requestsData : (requestsData && Array.isArray(requestsData.requests) ? requestsData.requests : (requestsData && Array.isArray(requestsData.data) ? requestsData.data : []));
    if (Array.isArray(rawRequests)) {
      serviceRequests = rawRequests.map(req => ({
        id: req.id || req.taskId || req.request_id || `REQ-${Date.now()}`,
        source: req.source || (req.id && req.id.toString().startsWith('CMP-') ? 'complaint' : (req.id && req.id.toString().startsWith('REQ-') ? 'request' : 'maintenance')),
        sourceLabel: req.source_label || req.sourceBadge || (req.source === 'complaint' ? 'Guest Complaint' : (req.source === 'request' ? 'Guest Request' : 'Maintenance')),
        roomNo: req.room_number || req.roomNo || req.room_no || '101',
        type: req.type || req.request_type || req.description || 'Service Request',
        description: req.description || req.type || req.request_type || '',
        time: req.time || (req.created_at ? new Date(req.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Today'),
        priority: req.priority || 'Medium',
        status: req.status || 'Pending',
        guest_name: req.guest_name || ''
      }));
      renderTable();
      updateKPIs();
    }
  } catch (err) {
    console.error('Failed to load active requests:', err);
  }
}

// 10-second lightweight auto-polling interval on the active requests table
setInterval(() => {
  if (currentActiveTab === 'requests' || currentActiveTab === 'view-requests') {
    loadActiveRequests();
  }
}, 10000);

/**
 * Loads dashboard data from API endpoints
 */
async function loadDashboardData() {
  await fetchOpsData();
  await loadHousekeepingPackagesData();
  await loadDailyMenuItems();
}

/**
 * Fetches operations data: rooms, requests, and summary counts
 */
async function fetchOpsData() {
  const API_BASE = getApiBase();

  try {
    const [roomsData, requestsData, summaryData] = await Promise.all([
      fetch(`${API_BASE}/api/ops/rooms`).then(res => res.json()).catch(() => []),
      fetch(`${API_BASE}/api/ops/requests`).then(res => res.json()).catch(() => []),
      fetch(`${API_BASE}/api/ops/summary`).then(res => res.json()).catch(() => null)
    ]);

    // Populate rooms array
    const rawRooms = Array.isArray(roomsData) ? roomsData : (roomsData && Array.isArray(roomsData.data) ? roomsData.data : (roomsData && Array.isArray(roomsData.rooms) ? roomsData.rooms : []));
    if (Array.isArray(rawRooms)) {
      rooms = rawRooms.map(r => {
        const roomNoVal = String(r.room_number || r.roomNo || r.room_no || r.room_id || '101');
        const stRaw = String(r.status || (r.housekeeping_status === 'Needs Cleaning' ? 'Dirty' : (r.housekeeping_status === 'Occupied' ? 'Occupied' : 'Available')));
        const stLower = stRaw.toLowerCase();
        const hkStatus = r.housekeeping_status || (stLower === 'dirty' || stLower === 'cleaning' ? 'Needs Cleaning' : (stLower === 'occupied' ? 'Occupied' : 'Cleaned & Ready'));
        const cleanStatus = r.cleaning_status || (stLower === 'dirty' || stLower === 'cleaning' || hkStatus === 'Needs Cleaning' ? 'Dirty' : 'Clean');

        return {
          roomNo: roomNoVal,
          room_number: roomNoVal,
          room_no: roomNoVal,
          room_id: roomNoVal,
          type: r.category || r.room_type || r.type || 'Single Room',
          category: r.category || r.room_type || r.type || 'Single Room',
          room_type: r.room_type || r.category || r.type || 'Single Room',
          acType: r.ac_type || r.acType || 'A/C',
          ac_type: r.ac_type || r.acType || 'A/C',
          price: parseFloat(r.price_per_night !== undefined ? r.price_per_night : (r.rate_per_night !== undefined ? r.rate_per_night : r.price)) || 45,
          price_per_night: parseFloat(r.price_per_night !== undefined ? r.price_per_night : (r.rate_per_night !== undefined ? r.rate_per_night : r.price)) || 45,
          rate_per_night: parseFloat(r.rate_per_night !== undefined ? r.rate_per_night : (r.price_per_night !== undefined ? r.price_per_night : r.price)) || 45,
          floor: r.floor || (roomNoVal.charAt(0) === '2' ? 2 : 1),
          imageUrl: r.image_url || r.imageUrl || '',
          image_url: r.image_url || r.imageUrl || '',
          cleaningStatus: cleanStatus,
          cleaning_status: cleanStatus,
          housekeeping_status: hkStatus,
          hasMaintenance: !!r.has_maintenance,
          has_maintenance: !!r.has_maintenance,
          status: (stLower === 'dirty' || stLower === 'cleaning' || hkStatus === 'Needs Cleaning') ? 'dirty' : (stLower === 'occupied' || hkStatus === 'Occupied' ? 'occupied' : (stLower === 'maintenance' ? 'maintenance' : 'available'))
        };
      });
    }

    // Populate requests array
    const rawRequests = Array.isArray(requestsData) ? requestsData : (requestsData && Array.isArray(requestsData.requests) ? requestsData.requests : (requestsData && Array.isArray(requestsData.data) ? requestsData.data : []));
    if (Array.isArray(rawRequests)) {
      serviceRequests = rawRequests.map(req => ({
        id: req.id || req.taskId || req.request_id || `REQ-${Date.now()}`,
        source: req.source || (req.id && req.id.toString().startsWith('CMP-') ? 'complaint' : (req.id && req.id.toString().startsWith('REQ-') ? 'request' : 'maintenance')),
        sourceLabel: req.source_label || req.sourceBadge || (req.source === 'complaint' ? 'Guest Complaint' : (req.source === 'request' ? 'Guest Request' : 'Maintenance')),
        roomNo: req.room_number || req.roomNo || req.room_no || '101',
        type: req.type || req.request_type || req.description || 'Service Request',
        description: req.description || req.type || req.request_type || '',
        time: req.time || (req.created_at ? new Date(req.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Today'),
        priority: req.priority || 'Medium',
        status: req.status || 'Pending',
        guest_name: req.guest_name || ''
      }));
    }

    populateRoomSelect();
    renderGrid();
    renderTable();
    renderInventoryTable();
    updateKPIs(summaryData);
    await loadDailyMenuItems();
  } catch (err) {
    console.error('Failed to sync operations data:', err);
  }
}

/**
 * Populates room select dropdown in maintenance modal
 */
function populateRoomSelect() {
  const select = document.getElementById('reqRoomNo');
  if (!select) return;
  
  const currentVal = select.value;
  select.innerHTML = '';
  
  if (rooms.length === 0) {
    select.innerHTML = '<option value="101">Room 101</option>';
    return;
  }

  rooms.forEach(r => {
    const opt = document.createElement('option');
    opt.value = r.roomNo;
    opt.textContent = `Room ${r.roomNo} (${r.type} • ${r.acType})`;
    select.appendChild(opt);
  });

  if (currentVal && Array.from(select.options).some(o => o.value === currentVal)) {
    select.value = currentVal;
  }

  // Also sync with the Room Packages target room dropdown
  populateOpsPackageRoomDropdown();
}

/**
 * Room Filtering Predicates & Tabs Handler
 */
function isRoomNeedingCleaning(r) {
  const st = (r.status || '').toLowerCase();
  const cs = (r.cleaning_status || r.cleaningStatus || '').toLowerCase();
  const hs = (r.housekeeping_status || '').toLowerCase();
  return st === 'dirty' || st === 'cleaning' || cs === 'dirty' || cs === 'in progress' || hs.includes('needs cleaning') || hs === 'dirty';
}

function isRoomCleanedAndReady(r) {
  const st = (r.status || '').toLowerCase();
  const cs = (r.cleaning_status || r.cleaningStatus || '').toLowerCase();
  const hs = (r.housekeeping_status || '').toLowerCase();
  if (isRoomNeedingCleaning(r)) return false;
  return st === 'available' || hs.includes('cleaned') || (cs === 'clean' && st !== 'occupied' && st !== 'maintenance');
}

function initRoomFilterTabs() {
  const filterBtns = document.querySelectorAll('.ops-filter-btn');
  filterBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const filter = btn.getAttribute('data-filter') || 'all';
      setRoomFilter(filter);
    });
  });
}

function setRoomFilter(filter) {
  currentRoomFilter = filter;
  const filterBtns = document.querySelectorAll('.ops-filter-btn');
  filterBtns.forEach(btn => {
    const btnFilter = btn.getAttribute('data-filter');
    if (btnFilter === filter) {
      btn.className = 'ops-filter-btn px-4 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition bg-amber-500 text-slate-950 shadow active';
    } else {
      btn.className = 'ops-filter-btn px-4 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition text-slate-400 hover:text-white';
    }
  });
  renderGrid();
}

/**
 * Populates Visual Room Cards Grid (Tab 1)
 */
function renderGrid() {
  const roomGrid = document.getElementById('roomGrid');
  if (!roomGrid) return;

  // Update dynamic count indicators on filter tabs
  const cntAll = document.getElementById('cnt-all');
  const cntDirty = document.getElementById('cnt-dirty');
  const cntClean = document.getElementById('cnt-clean');
  if (cntAll) cntAll.textContent = rooms.length;
  if (cntDirty) cntDirty.textContent = rooms.filter(isRoomNeedingCleaning).length;
  if (cntClean) cntClean.textContent = rooms.filter(isRoomCleanedAndReady).length;

  roomGrid.innerHTML = '';

  // Filter rooms based on active status filter tab
  let filteredRooms = rooms;
  if (currentRoomFilter === 'dirty') {
    filteredRooms = rooms.filter(isRoomNeedingCleaning);
  } else if (currentRoomFilter === 'cleaned') {
    filteredRooms = rooms.filter(isRoomCleanedAndReady);
  }

  if (filteredRooms.length === 0) {
    roomGrid.innerHTML = `
      <div style="grid-column: 1 / -1; padding: 3rem 1.5rem; text-align: center; background: rgba(17, 24, 39, 0.4); border: 1px dashed var(--border-color); border-radius: 12px;">
        <div style="font-size: 2rem; margin-bottom: 0.5rem;">✨</div>
        <div style="font-size: 1rem; font-weight: 700; color: var(--text-white);">No rooms match this filter</div>
        <div style="font-size: 0.85rem; color: var(--text-gray); margin-top: 0.25rem;">
          ${currentRoomFilter === 'dirty' ? 'All rooms are cleaned or in other statuses.' : currentRoomFilter === 'cleaned' ? 'No rooms are currently cleaned and available.' : 'No rooms available in the inventory.'}
        </div>
      </div>
    `;
    return;
  }
  
  filteredRooms.forEach(room => {
    const card = document.createElement('div');
    card.className = 'room-card';
    card.id = `room-card-${room.room_number || room.roomNo}`;
    
    let badgeHtml = '';
    let buttonHtml = '';
    
    if (room.status === 'available') {
      badgeHtml = `<span class="status-badge status-available">Available</span>`;
      buttonHtml = `
        <button class="btn-room-action" onclick="toggleRoomStatus('${room.room_number || room.roomNo}', 'cleaning')">
          <svg viewBox="0 0 24 24"><path d="M19 13H5v-2h14v2z"/></svg>
          Mark Dirty (Prep)
        </button>`;
    } else if (room.status === 'occupied') {
      badgeHtml = `<span class="status-badge status-occupied">Occupied</span>`;
      buttonHtml = `
        <button class="btn-room-action" onclick="toggleRoomStatus('${room.room_number || room.roomNo}', 'cleaning')">
          <svg viewBox="0 0 24 24"><path d="M19 13H5v-2h14v2z"/></svg>
          Mark Dirty (Checkout)
        </button>`;
    } else if (room.status === 'cleaning' || room.status === 'dirty') {
      badgeHtml = `<span class="status-badge status-cleaning">Cleaning</span>`;
      buttonHtml = `
        <button class="btn-room-action action-clean" onclick="toggleRoomStatus('${room.room_number || room.roomNo}', 'available')">
          <svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
          Mark Cleaned
        </button>`;
    } else if (room.status === 'maintenance') {
      badgeHtml = `<span class="status-badge status-maintenance">Maintenance</span>`;
      buttonHtml = `
        <button class="btn-room-action" onclick="resolveRoomMaintenance('${room.room_number || room.roomNo}')">
          <svg viewBox="0 0 24 24"><path d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.3C.5 6.7.9 9.8 2.9 11.8c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.5z"/></svg>
          Resolve Maintenance
        </button>`;
    }

    const isAc = (room.acType || room.ac_type || '').toUpperCase().includes('A/C') && !(room.acType || room.ac_type || '').toUpperCase().includes('NON');
    const acBadgeBg = isAc ? 'rgba(59, 130, 246, 0.15)' : 'rgba(156, 163, 175, 0.15)';
    const acBadgeColor = isAc ? '#60a5fa' : '#9ca3af';
    const acBadgeBorder = isAc ? 'rgba(59, 130, 246, 0.3)' : 'rgba(156, 163, 175, 0.3)';

    card.innerHTML = `
      <div class="w-full h-32 overflow-hidden rounded-t-xl bg-gray-900 relative">
        <img src="${room.image_url || 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=80'}" 
             alt="Room ${room.room_number || room.roomNo}" 
             class="w-full h-full object-cover" 
             onerror="this.onerror=null;this.src='https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=80';">
      </div>
      <div class="room-card-content">
        <div class="room-card-header">
          <div>
            <div class="room-number">Room ${room.room_number || room.roomNo}</div>
            <div style="display: flex; gap: 0.35rem; align-items: center; margin-top: 0.4rem; flex-wrap: wrap;">
              <span style="background: rgba(197, 168, 128, 0.15); color: var(--accent-gold); font-size: 0.75rem; font-weight: 700; padding: 2px 8px; border-radius: 4px; border: 1px solid rgba(197, 168, 128, 0.3);">${room.type}</span>
              <span style="background: ${acBadgeBg}; color: ${acBadgeColor}; font-size: 0.75rem; font-weight: 700; padding: 2px 8px; border-radius: 4px; border: 1px solid ${acBadgeBorder};">${room.acType}</span>
              <span style="color: #94a3b8; font-size: 0.75rem; font-weight: 600; margin-left: 2px;">Rs. ${Number(room.price || 0).toFixed(0)}/nt</span>
            </div>
          </div>
          ${badgeHtml}
        </div>
        ${buttonHtml}
      </div>
    `;
    
    roomGrid.appendChild(card);
  });
}

/**
 * Resolves room maintenance by completing related pending tasks
 */
function resolveRoomMaintenance(roomNo) {
  const pendingTask = serviceRequests.find(r => r.roomNo === roomNo && (r.status === 'Pending' || r.status === 'In Progress' || r.status === 'Open'));
  if (pendingTask) {
    completeRequest(pendingTask.id);
  } else {
    toggleRoomStatus(roomNo, 'available');
  }
}

/**
 * Populates Unified Requests Tables (Tab 2 & Tab 4)
 */
function renderTable() {
  const requestTableBody = document.getElementById('requestTableBody');
  const completedTableBody = document.getElementById('completedTableBody');
  const emptyState = document.getElementById('emptyState');
  const emptyCompletedState = document.getElementById('emptyCompletedState');

  if (!requestTableBody || !completedTableBody) return;
  requestTableBody.innerHTML = '';
  completedTableBody.innerHTML = '';
  
  const activeRequests = serviceRequests.filter(r => {
    const s = (r.status || '').toLowerCase().trim();
    return s === 'pending' || s === 'in progress' || s === 'in-progress' || s === 'open';
  });
  const completedRequests = serviceRequests.filter(r => {
    const s = (r.status || '').toLowerCase().trim();
    return s === 'resolved' || s === 'completed' || s === 'cleaned' || s === 'closed';
  });

  // 1. Active Requests Table
  if (activeRequests.length === 0) {
    if (emptyState) emptyState.style.display = 'block';
  } else {
    if (emptyState) emptyState.style.display = 'none';
    
    activeRequests.forEach((req) => {
      const row = document.createElement('tr');
      
      let sourceBadge = '';
      if (req.source === 'complaint') {
        sourceBadge = `<span style="background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3); padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; font-weight: 700; margin-right: 6px;">COMPLAINT</span>`;
      } else if (req.source === 'request') {
        sourceBadge = `<span style="background: rgba(168, 85, 247, 0.15); color: #c084fc; border: 1px solid rgba(168, 85, 247, 0.3); padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; font-weight: 700; margin-right: 6px;">GUEST REQ</span>`;
      } else {
        sourceBadge = `<span style="background: rgba(59, 130, 246, 0.15); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.3); padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; font-weight: 700; margin-right: 6px;">MAINTENANCE</span>`;
      }

      const isMnt = req.source === 'maintenance';

      row.innerHTML = `
        <td style="font-weight: 700; color: var(--accent-gold)">Room ${req.roomNo}</td>
        <td>
          <div style="display: flex; align-items: center; flex-wrap: wrap; gap: 4px;">
            ${sourceBadge}
            <span style="font-weight: 600;">${req.type}</span>
          </div>
          ${req.description && req.description !== req.type ? `<div style="font-size: 0.8rem; color: #94a3b8; margin-top: 2px;">${req.description}</div>` : ''}
        </td>
        <td>${req.time}</td>
        <td><span class="priority-badge priority-${req.priority.toLowerCase()}">${req.priority}</span></td>
        <td>
          <span style="font-size:0.85rem;color:var(--cleaning-text);font-weight:500;display:flex;align-items:center;gap:0.25rem">
            <svg style="width:16px;height:16px;fill:currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
            ${req.status}
          </span>
        </td>
        <td>
          <div style="display: flex; gap: 0.5rem; align-items: center;">
            <button class="btn-action-sm" onclick="completeRequest('${req.id}')" style="background-color: var(--available-bg); color: var(--available-text); border-color: transparent;">
              ✓ Complete
            </button>
            ${isMnt ? `
            <button class="btn-action-sm" onclick="editRequest('${req.id}')" style="background-color: rgba(197, 168, 128, 0.12); color: var(--accent-gold); border: 1px solid var(--accent-gold); border-radius: 4px; padding: 0.25rem 0.5rem; font-size: 0.85rem; font-weight: 600; cursor: pointer;">
              ✏️ Edit
            </button>` : ''}
            <button class="btn-action-sm" onclick="deleteRequest('${req.id}')" style="background-color: rgba(239, 68, 68, 0.12); color: #ef4444; border: 1px solid #ef4444; border-radius: 4px; padding: 0.25rem 0.5rem; font-size: 0.85rem; font-weight: 600; cursor: pointer;">
              🗑️ Delete
            </button>
          </div>
        </td>
      `;
      
      requestTableBody.appendChild(row);
    });
  }

  // 2. Completed Requests Table
  if (completedRequests.length === 0) {
    if (emptyCompletedState) emptyCompletedState.style.display = 'block';
  } else {
    if (emptyCompletedState) emptyCompletedState.style.display = 'none';
    
    completedRequests.forEach((req) => {
      const row = document.createElement('tr');

      let sourceBadge = '';
      if (req.source === 'complaint') {
        sourceBadge = `<span style="background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3); padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; font-weight: 700; margin-right: 6px;">COMPLAINT</span>`;
      } else if (req.source === 'request') {
        sourceBadge = `<span style="background: rgba(168, 85, 247, 0.15); color: #c084fc; border: 1px solid rgba(168, 85, 247, 0.3); padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; font-weight: 700; margin-right: 6px;">GUEST REQ</span>`;
      } else {
        sourceBadge = `<span style="background: rgba(59, 130, 246, 0.15); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.3); padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; font-weight: 700; margin-right: 6px;">MAINTENANCE</span>`;
      }

      row.innerHTML = `
        <td style="font-weight: 700; color: var(--accent-gold)">Room ${req.roomNo}</td>
        <td>
          <div style="display: flex; align-items: center; flex-wrap: wrap; gap: 4px;">
            ${sourceBadge}
            <span style="font-weight: 600;">${req.type}</span>
          </div>
        </td>
        <td>${req.time}</td>
        <td><span class="priority-badge priority-${req.priority.toLowerCase()}">${req.priority}</span></td>
        <td>
          <span class="status-badge status-available" style="font-size:0.85rem;font-weight:600;display:inline-flex;align-items:center;gap:0.25rem;padding:0.25rem 0.5rem;border-radius:4px;background-color:rgba(16,185,129,0.12);color:#10b981;">
            <svg style="width:16px;height:16px;fill:currentColor" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
            Resolved
          </span>
        </td>
        <td>
          <button class="btn-action-sm" onclick="deleteRequest('${req.id}')" style="background-color: rgba(239, 68, 68, 0.12); color: #ef4444; border: 1px solid #ef4444; border-radius: 4px; padding: 0.25rem 0.5rem; font-size: 0.85rem; font-weight: 600; cursor: pointer;">
            🗑️ Delete
          </button>
        </td>
      `;
      
      completedTableBody.appendChild(row);
    });
  }
}

/**
 * Populates Dedicated Room Inventory Table (Tab 3)
 */
function renderInventoryTable() {
  const inventoryTableBody = document.getElementById('inventoryTableBody');
  const emptyInventoryState = document.getElementById('emptyInventoryState');
  const inventoryCountHeader = document.getElementById('inventoryCountHeader');

  if (!inventoryTableBody) return;
  inventoryTableBody.innerHTML = '';

  if (rooms.length === 0) {
    if (emptyInventoryState) emptyInventoryState.style.display = 'block';
    if (inventoryCountHeader) inventoryCountHeader.textContent = '0 Units';
  } else {
    if (emptyInventoryState) emptyInventoryState.style.display = 'none';
    if (inventoryCountHeader) inventoryCountHeader.textContent = `${rooms.length} Units in Inventory`;

    rooms.forEach(room => {
      const row = document.createElement('tr');

      const isAc = (room.acType || '').toUpperCase().includes('A/C') && !(room.acType || '').toUpperCase().includes('NON');
      const acBadgeBg = isAc ? 'rgba(59, 130, 246, 0.15)' : 'rgba(156, 163, 175, 0.15)';
      const acBadgeColor = isAc ? '#60a5fa' : '#9ca3af';

      let statusBadgeClass = 'status-available';
      let statusText = 'Available';
      if (room.status === 'occupied') { 
        statusBadgeClass = 'status-occupied'; 
        statusText = 'Occupied'; 
      } else if (room.status === 'cleaning' || room.status === 'dirty') { 
        statusBadgeClass = 'status-cleaning'; 
        statusText = 'Dirty'; 
      } else if (room.status === 'maintenance') { 
        statusBadgeClass = 'status-maintenance'; 
        statusText = 'Maintenance'; 
      }

      // Room Photo Thumbnail
      const photoSrc = room.image_url || room.imageUrl || 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=80';
      const thumbHtml = `
        <img src="${photoSrc}" alt="Room ${room.roomNo}" class="w-16 h-12 object-cover rounded-lg" style="width: 64px; height: 48px; object-fit: cover; border-radius: 8px; border: 1px solid var(--border-color); display: block;" onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=80';">
      `;

      row.innerHTML = `
        <td>${thumbHtml}</td>
        <td style="font-weight: 800; font-family: var(--font-outfit); font-size: 1.15rem; color: var(--accent-gold);">
          Room ${room.roomNo}
        </td>
        <td>
          <span style="background: rgba(197, 168, 128, 0.15); color: var(--accent-gold); font-size: 0.8rem; font-weight: 700; padding: 3px 8px; border-radius: 4px; border: 1px solid rgba(197, 168, 128, 0.3);">
            ${room.type}
          </span>
        </td>
        <td>
          <span style="background: ${acBadgeBg}; color: ${acBadgeColor}; font-size: 0.8rem; font-weight: 700; padding: 3px 8px; border-radius: 4px;">
            ${room.acType}
          </span>
        </td>
        <td style="font-weight: 700; color: #fff; font-size: 0.95rem;">
          Rs. ${Number(room.price || 0).toFixed(2)}
        </td>
        <td>
          <span class="status-badge ${statusBadgeClass}">
            ${statusText}
          </span>
        </td>
        <td>
          <div style="display: flex; gap: 0.5rem; align-items: center;">
            <button class="btn-action-sm" onclick="openEditRoomModal('${escapeHtml(room.roomNo)}')" title="Edit Room" style="background-color: rgba(245, 158, 11, 0.15); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.35); border-radius: 6px; padding: 0.4rem 0.65rem; font-size: 0.8rem; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 0.35rem;">
              ✏️ Edit
            </button>
            <button class="btn-action-sm" onclick="deleteRoom('${escapeHtml(room.roomNo)}')" title="Delete Room" style="background-color: rgba(239, 68, 68, 0.15); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.35); border-radius: 6px; padding: 0.4rem 0.65rem; font-size: 0.8rem; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 0.35rem;">
              🗑️ Delete
            </button>
          </div>
        </td>
      `;

      inventoryTableBody.appendChild(row);
    });
  }
}

/**
 * Modal helpers for Update Room Photo
 */
function openUpdatePhotoModal(roomNo, rawPhotoUrl, categoryInfo) {
  const currentUrl = decodeURIComponent(rawPhotoUrl || '');
  const catText = decodeURIComponent(categoryInfo || '');

  const editPhotoRoomNo = document.getElementById('editPhotoRoomNo');
  const editPhotoRoomDisplay = document.getElementById('editPhotoRoomDisplay');
  const editPhotoCategoryDisplay = document.getElementById('editPhotoCategoryDisplay');
  const editPhotoUrl = document.getElementById('editPhotoUrl');
  const errorEl = document.getElementById('edit-photo-error');

  if (editPhotoRoomNo) editPhotoRoomNo.value = roomNo;
  if (editPhotoRoomDisplay) editPhotoRoomDisplay.textContent = `Room ${roomNo}`;
  if (editPhotoCategoryDisplay) editPhotoCategoryDisplay.textContent = catText || `Room ${roomNo}`;
  if (editPhotoUrl) {
    editPhotoUrl.value = currentUrl;
    editPhotoUrl.style.border = '';
  }
  if (errorEl) {
    errorEl.classList.add('hidden');
    errorEl.style.display = 'none';
  }

  previewEditPhoto(currentUrl);

  const updatePhotoModal = document.getElementById('updatePhotoModal');
  if (updatePhotoModal) {
    updatePhotoModal.showModal();
    if (editPhotoUrl) editPhotoUrl.focus();
  }
}

function previewEditPhoto(url) {
  const preview = document.getElementById('editPhotoPreview');
  const placeholder = document.getElementById('editPhotoPlaceholder');
  const urlInput = document.getElementById('editPhotoUrl');
  const errorEl = document.getElementById('edit-photo-error');

  if (urlInput) urlInput.style.border = '';
  if (errorEl) {
    errorEl.classList.add('hidden');
    errorEl.style.display = 'none';
  }

  if (url && url.trim() !== '') {
    if (preview) {
      preview.onerror = function() {
        handlePhotoPreviewError(preview);
      };
      preview.src = url.trim();
      preview.style.display = 'block';
    }
    if (placeholder) placeholder.style.display = 'none';
  } else {
    if (preview) {
      preview.onerror = null;
      preview.removeAttribute('src');
      preview.style.display = 'none';
    }
    if (placeholder) {
      placeholder.textContent = 'Enter a photo URL above to preview';
      placeholder.style.display = 'block';
    }
  }
}

function handlePhotoPreviewError(img) {
  const targetImg = img || document.getElementById('editPhotoPreview');
  if (targetImg) {
    targetImg.onerror = null;
    targetImg.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="%2364748b"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>';
    targetImg.style.display = 'block';
  }
  const placeholder = document.getElementById('editPhotoPlaceholder');
  if (placeholder) {
    placeholder.textContent = '⚠️ Image preview failed to load. Check URL format.';
    placeholder.style.display = 'block';
  }
}

function handleUpdateRoomPhoto(e) {
  e.preventDefault();
  const roomNo = document.getElementById('editPhotoRoomNo').value;
  const urlInput = document.getElementById('editPhotoUrl');
  const errorEl = document.getElementById('edit-photo-error');
  const photoUrl = urlInput ? urlInput.value.trim() : '';

  if (!photoUrl || photoUrl === '') {
    if (urlInput) {
      urlInput.style.border = '1.5px solid #ef4444';
      urlInput.focus();
    }
    if (errorEl) {
      errorEl.classList.remove('hidden');
      errorEl.style.display = 'block';
    }
    return false;
  }

  const API_BASE = getApiBase();

  fetch(`${API_BASE}/api/ops/rooms/${roomNo}/photo`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image_url: photoUrl })
  })
  .then(res => {
    if (!res.ok) {
      return res.json().then(err => { throw new Error(err.message || 'Failed to update photo'); });
    }
    return res.json();
  })
  .then(data => {
    closeModal('updatePhotoModal');
    showToast(`Room ${roomNo} photo updated successfully!`);
    fetchOpsData();
  })
  .catch(err => {
    console.error('Error updating room photo:', err);
    alert(err.message || 'Failed to update photo URL.');
  });
}

/**
 * Dynamic Live KPI statistics & Sidebar Count Badges
 */
function updateKPIs(summaryData) {
  const summary = (summaryData && summaryData.summary) ? summaryData.summary : summaryData;
  const kpiCleaning = document.getElementById('kpiCleaning');
  const kpiRequests = document.getElementById('kpiRequests');
  const kpiOccupied = document.getElementById('kpiOccupied');
  const badgeCleaningCount = document.getElementById('badge-cleaning-count');
  const badgeRequestsCount = document.getElementById('badge-requests-count');
  const badgeInventoryCount = document.getElementById('badge-inventory-count');
  const badgeHistoryCount = document.getElementById('badge-history-count');

  const activeReqList = serviceRequests.filter(r => {
    const s = (r.status || '').toLowerCase().trim();
    return s === 'pending' || s === 'in progress' || s === 'in-progress' || s === 'open';
  });
  const completedReqList = serviceRequests.filter(r => {
    const s = (r.status || '').toLowerCase().trim();
    return s === 'resolved' || s === 'completed' || s === 'cleaned' || s === 'closed';
  });

  const cleaningCount = (summary && summary.cleaning_required !== undefined)
    ? summary.cleaning_required 
    : rooms.filter(isRoomNeedingCleaning).length;
  const pendingCount = (summary && summary.pending_requests !== undefined) 
    ? summary.pending_requests 
    : activeReqList.length;
  const occupiedCount = (summary && summary.occupied_rooms !== undefined) 
    ? summary.occupied_rooms 
    : rooms.filter(r => (r.status || '').toLowerCase() === 'occupied' || (r.housekeeping_status || '').toLowerCase() === 'occupied').length;
  const totalCount = (summary && summary.total_rooms !== undefined) 
    ? summary.total_rooms 
    : rooms.length;
  const cleanedAndReadyCount = (summary && summary.cleaned_and_ready !== undefined)
    ? summary.cleaned_and_ready
    : rooms.filter(isRoomCleanedAndReady).length;
  const historyCount = completedReqList.length;

  if (kpiCleaning) kpiCleaning.textContent = `${cleaningCount} Rooms`;
  if (kpiRequests) kpiRequests.textContent = `${pendingCount} Requests`;
  if (kpiOccupied) kpiOccupied.textContent = `${occupiedCount} Rooms`;

  if (badgeCleaningCount) badgeCleaningCount.textContent = cleaningCount;
  if (badgeRequestsCount) badgeRequestsCount.textContent = pendingCount;
  if (badgeInventoryCount) badgeInventoryCount.textContent = totalCount;
  if (badgeHistoryCount) badgeHistoryCount.textContent = historyCount;

  // Filter Tab Badges
  const cntAll = document.getElementById('cnt-all');
  const cntDirty = document.getElementById('cnt-dirty');
  const cntClean = document.getElementById('cnt-clean');
  if (cntAll) cntAll.textContent = totalCount;
  if (cntDirty) cntDirty.textContent = cleaningCount;
  if (cntClean) cntClean.textContent = cleanedAndReadyCount;
}

/**
 * Toggle Room Status helper via unified Rooms API
 */
function toggleRoomStatus(roomNo, nextStatus) {
  const API_BASE = getApiBase();
  const cleanStatus = (nextStatus === 'available') ? 'Clean' : 'Dirty';

  fetch(`${API_BASE}/api/ops/rooms/${roomNo}/status`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      status: nextStatus,
      cleaning_status: cleanStatus
    })
  })
  .then(res => res.json())
  .then(data => {
    showToast(`Room ${roomNo} status changed to ${nextStatus === 'available' ? 'CLEANED' : nextStatus.toUpperCase()}.`);
    fetchOpsData();
  })
  .catch(err => {
    console.error('Failed to toggle room status:', err);
    showToast('Error updating room status.');
  });
}

/**
 * Complete active request across departments
 */
function completeRequest(taskId) {
  if (!taskId) return;
  const API_BASE = getApiBase();

  fetch(`${API_BASE}/api/ops/requests/${taskId}/complete`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'Resolved' })
  })
  .then(res => res.json())
  .then(data => {
    showToast(data.message || `Request ${taskId} marked as resolved.`);
    fetchOpsData();
  })
  .catch(err => {
    console.error('Failed to complete request:', err);
    showToast('Error resolving task.');
  });
}

function editRequest(taskId) {
  const task = serviceRequests.find(t => t.id === taskId);
  if (task) {
    editingTaskId = taskId;
    const statusGroup = document.getElementById('statusGroup');
    const dialogTitle = document.getElementById('dialogTitle');
    const reqRoomNo = document.getElementById('reqRoomNo');
    const reqType = document.getElementById('reqType');
    const reqPriority = document.getElementById('reqPriority');
    const reqStatus = document.getElementById('reqStatus');

    if (statusGroup) statusGroup.style.display = 'block';
    if (dialogTitle) dialogTitle.textContent = 'Edit Maintenance/Service Request';
    if (reqRoomNo) reqRoomNo.value = task.roomNo;
    if (reqType) reqType.value = task.type;
    if (reqPriority) reqPriority.value = task.priority;
    if (reqStatus) reqStatus.value = task.status || 'Pending';
    openMaintenanceModal();
  }
}

function deleteRequest(taskId) {
  if (!confirm("Are you sure you want to delete this record?")) return;
  
  const API_BASE = getApiBase();
  let url = `${API_BASE}/api/ops/maintenance/${taskId}`;
  if (taskId.startsWith('CMP-')) {
    url = `${API_BASE}/api/complaints/${taskId}`;
  } else if (taskId.startsWith('REQ-')) {
    url = `${API_BASE}/api/reception/special-requests/${taskId}`;
  }

  fetch(url, { method: 'DELETE' })
  .then(res => res.json())
  .then(data => {
    showToast("Record deleted successfully");
    fetchOpsData();
  })
  .catch(err => {
    console.error('Failed to delete record:', err);
    showToast("Error deleting record.");
  });
}

function deleteRoom(roomNo) {
  const targetRoom = (rooms || []).find(r => String(r.roomNo || r.room_number) === String(roomNo));
  if (targetRoom && String(targetRoom.status).toLowerCase() === 'occupied') {
    alert(`Cannot delete Room ${roomNo} because it is currently Occupied by a guest.`);
    return;
  }

  if (!confirm(`Are you sure you want to delete Room ${roomNo} from inventory?`)) return;

  const API_BASE = getApiBase();
  fetch(`${API_BASE}/api/rooms/${encodeURIComponent(roomNo)}`, { method: 'DELETE' })
    .then(async res => {
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.message || `Failed to delete Room ${roomNo}.`);
      }
      return data;
    })
    .then(data => {
      showToast(data.message || `Room ${roomNo} deleted from inventory.`);
      fetchOpsData();
    })
    .catch(err => {
      console.error('Failed to delete room:', err);
      alert(err.message || 'Error deleting room.');
    });
}

/**
 * Add Room handler with Strict Mandatory Validations
 */
function handleCreateRoom(e) {
  e.preventDefault();
  const roomNumberInput = document.getElementById('newRoomNumber');
  const roomNumber = roomNumberInput ? roomNumberInput.value.trim() : '';
  const categorySelect = document.getElementById('newRoomCategory');
  const category = categorySelect ? categorySelect.value.trim() : '';
  const acType = document.getElementById('newRoomAcType') ? document.getElementById('newRoomAcType').value : 'A/C';
  const priceInput = document.getElementById('newRoomPrice');
  const price = parseFloat(priceInput ? priceInput.value : 0);
  const roomImgFileInput = document.getElementById('room-image-file');
  const roomImgError = document.getElementById('room-img-error');
  const packageSelect = document.getElementById('new-room-package');
  const selectedPackage = packageSelect ? packageSelect.value.trim() : '';

  // 1. Validate room_number: alphanumeric and required
  const roomNumRegex = /^[a-zA-Z0-9_-]+$/;
  if (!roomNumber || !roomNumRegex.test(roomNumber)) {
    if (roomNumberInput) roomNumberInput.focus();
    alert('Room number is required and must be alphanumeric (e.g. 101, 202A).');
    return false;
  }

  // 2. Validate room_number uniqueness
  const isDuplicate = (rooms || []).some(r => String(r.roomNo || r.room_number).toUpperCase() === roomNumber.toUpperCase());
  if (isDuplicate) {
    if (roomNumberInput) roomNumberInput.focus();
    alert(`Room ${roomNumber} already exists in inventory.`);
    return false;
  }

  // 3. Validate room_category: must not be empty
  if (!category) {
    if (categorySelect) categorySelect.focus();
    alert('Room category must not be empty.');
    return false;
  }

  // 4. Validate price_per_night: must be positive (> 0)
  if (isNaN(price) || price <= 0) {
    if (priceInput) priceInput.focus();
    alert('Price per night must be a positive number (> 0).');
    return false;
  }

  // 5. Mandatory room photo file
  if (!selectedImageData || selectedImageData.trim() === '') {
    if (roomImgFileInput) {
      roomImgFileInput.style.border = '1.5px solid #ef4444';
      roomImgFileInput.focus();
    }
    if (roomImgError) {
      roomImgError.classList.remove('hidden');
      roomImgError.style.display = 'block';
    }
    return false;
  }

  // Clear photo error states
  if (roomImgFileInput) roomImgFileInput.style.border = '';
  if (roomImgError) {
    roomImgError.classList.add('hidden');
    roomImgError.style.display = 'none';
  }

  const API_BASE = getApiBase();

  fetch(`${API_BASE}/api/ops/rooms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      room_number: roomNumber,
      category: category,
      ac_type: acType,
      price_per_night: price,
      image_url: selectedImageData,
      status: 'Available',
      package_name: selectedPackage
    })
  })
  .then(res => {
    if (!res.ok) {
      return res.json().then(err => { throw new Error(err.message || err.error || 'Failed to add room'); });
    }
    return res.json();
  })
  .then(data => {
    document.getElementById('addRoomForm').reset();
    selectedImageData = '';
    if (packageSelect) packageSelect.value = '';
    const previewContainer = document.getElementById('image-preview-container');
    const previewImg = document.getElementById('image-preview');
    if (previewImg) previewImg.src = '';
    if (previewContainer) {
      previewContainer.classList.add('hidden');
      previewContainer.style.display = 'none';
    }
    handleCategoryPriceDefault(document.getElementById('newRoomCategory').value);
    showToast(`Room ${roomNumber} added to inventory successfully!`);
    fetchOpsData();

    if (selectedPackage) {
      let matchedPkg = (housekeepingPackages || []).find(p => 
        p.package_name.toLowerCase() === selectedPackage.toLowerCase() ||
        p.package_name.toLowerCase().includes(selectedPackage.toLowerCase()) ||
        selectedPackage.toLowerCase().includes(p.package_name.toLowerCase())
      );
      const pkgId = matchedPkg ? matchedPkg.package_id : 1;
      fetch(`${API_BASE}/api/housekeeping/assignments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room_number: roomNumber,
          package_id: pkgId,
          assigned_by: 'Operations (Room Creation)',
          notes: `Included setup package: ${selectedPackage}`
        })
      }).then(() => {
        loadHousekeepingPackagesData();
      }).catch(e => console.error('[Auto Assign Package Error]:', e));
    }
  })
  .catch(err => {
    console.error('Error adding room:', err);
    alert(err.message || 'Error creating room.');
  });
}

/**
 * Opens Edit Room Modal pre-filled with room details (Price, Category, A/C status)
 */
function openEditRoomModal(roomNo) {
  const room = (rooms || []).find(r => String(r.roomNo || r.room_number) === String(roomNo));
  if (!room) {
    showToast(`Room ${roomNo} not found.`, 'error');
    return;
  }

  const editRoomNumber = document.getElementById('editRoomNumber');
  const editRoomCategory = document.getElementById('editRoomCategory');
  const editRoomAcType = document.getElementById('editRoomAcType');
  const editRoomPrice = document.getElementById('editRoomPrice');
  const editRoomPhotoUrl = document.getElementById('editRoomPhotoUrl');

  if (editRoomNumber) editRoomNumber.value = room.roomNo || room.room_number;

  if (editRoomCategory) {
    const cat = room.category || room.type || 'Couple Room';
    let matchedOption = false;
    for (let opt of editRoomCategory.options) {
      if (cat.toLowerCase().includes(opt.value.toLowerCase()) || opt.value.toLowerCase().includes(cat.toLowerCase())) {
        editRoomCategory.value = opt.value;
        matchedOption = true;
        break;
      }
    }
    if (!matchedOption && cat) {
      editRoomCategory.value = cat;
    }
  }

  if (editRoomAcType) {
    const isAc = (room.acType || room.ac_type || '').toUpperCase().includes('A/C') && !(room.acType || room.ac_type || '').toUpperCase().includes('NON');
    editRoomAcType.value = isAc ? 'A/C' : 'Non-A/C';
  }

  if (editRoomPrice) {
    editRoomPrice.value = Number(room.price || room.price_per_night || 45).toFixed(2);
  }

  if (editRoomPhotoUrl) {
    editRoomPhotoUrl.value = room.imageUrl || room.image_url || '';
  }

  const modal = document.getElementById('editRoomModal');
  if (modal) modal.showModal();
}

/**
 * Handles saving changes to an existing room
 */
async function handleUpdateRoom(e) {
  if (e && e.preventDefault) e.preventDefault();

  const roomNo = document.getElementById('editRoomNumber')?.value.trim();
  const category = document.getElementById('editRoomCategory')?.value.trim();
  const acType = document.getElementById('editRoomAcType')?.value;
  const priceVal = parseFloat(document.getElementById('editRoomPrice')?.value);
  const photoUrl = document.getElementById('editRoomPhotoUrl')?.value.trim();

  if (!roomNo) {
    alert('Room number is missing.');
    return;
  }

  // Room Form Validations: category non-empty, price > 0
  if (!category) {
    alert('Room category must not be empty.');
    return;
  }

  if (isNaN(priceVal) || priceVal <= 0) {
    alert('Price per night must be a positive number (> 0).');
    return;
  }

  const API_BASE = getApiBase();
  try {
    const res = await fetch(`${API_BASE}/api/rooms/${encodeURIComponent(roomNo)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category: category,
        room_category: category,
        ac_type: acType,
        ac_configuration: acType,
        price_per_night: priceVal,
        price: priceVal,
        image_url: photoUrl
      })
    });

    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success) {
      showToast(data.message || `Room ${roomNo} updated successfully!`);
      closeModal('editRoomModal');
      await fetchOpsData();
    } else {
      alert(data.message || `Failed to update Room ${roomNo}.`);
    }
  } catch (err) {
    console.error('Update room error:', err);
    alert('Network error updating room: ' + err.message);
  }
}

function handleCategoryPriceDefault(category) {
  const priceInput = document.getElementById('newRoomPrice');
  if (!priceInput) return;
  if (category === 'Single Room') priceInput.value = '30.00';
  else if (category === 'Couple Room') priceInput.value = '45.00';
  else if (category === 'Family Room') priceInput.value = '70.00';
}

/**
 * Modal dialog operations
 */
function openMaintenanceModal() {
  const maintenanceModal = document.getElementById('maintenanceModal');
  if (maintenanceModal) maintenanceModal.showModal();
}

function closeModal(modalId) {
  const maintenanceModal = document.getElementById('maintenanceModal');
  if (modalId === 'maintenanceModal' && maintenanceModal) {
    maintenanceModal.close();
    document.getElementById('maintenanceForm').reset();
    editingTaskId = null;
    document.getElementById('statusGroup').style.display = 'none';
    document.getElementById('dialogTitle').textContent = 'Log Maintenance/Service Request';
  } else if (modalId === 'updatePhotoModal') {
    const updatePhotoModal = document.getElementById('updatePhotoModal');
    if (updatePhotoModal) {
      updatePhotoModal.close();
      const form = document.getElementById('updatePhotoForm');
      if (form) form.reset();
      const preview = document.getElementById('editPhotoPreview');
      const placeholder = document.getElementById('editPhotoPlaceholder');
      if (preview) preview.style.display = 'none';
      if (placeholder) placeholder.style.display = 'block';
    }
  } else if (modalId === 'createPackageModal') {
    const pkgModal = document.getElementById('createPackageModal');
    if (pkgModal) {
      pkgModal.close();
      const form = document.getElementById('createPackageForm');
      if (form) form.reset();
    }
  } else if (modalId === 'addDishModal') {
    const dishModal = document.getElementById('addDishModal');
    if (dishModal) {
      dishModal.style.display = 'none';
      if (typeof dishModal.close === 'function') {
        dishModal.close();
      }
      const form = document.getElementById('formAddDish') || document.getElementById('addDishForm');
      if (form) form.reset();
    }
  } else {
    const d = document.getElementById(modalId);
    if (d && d.open) d.close();
  }
}

/**
 * Fallback script for light-dismiss dialog (backdrop clicks)
 */
function setupDialogLightDismiss() {
  const modals = [
    document.getElementById('maintenanceModal'), 
    document.getElementById('updatePhotoModal'),
    document.getElementById('createPackageModal'),
    document.getElementById('addDishModal')
  ];
  modals.forEach(modal => {
    if (!modal) return;
    modal.addEventListener('click', (event) => {
      if (event.target !== modal) return;
      const rect = modal.getBoundingClientRect();
      const isInside = (
        rect.top <= event.clientY &&
        event.clientY <= rect.top + rect.height &&
        rect.left <= event.clientX &&
        event.clientX <= rect.left + rect.width
      );
      if (!isInside) {
        modal.close();
      }
    });
  });
}

/**
 * Toast helper
 */
function showToast(message) {
  const toast = document.getElementById('toast');
  const toastText = document.getElementById('toastText');
  if (toast && toastText) {
    toastText.textContent = message;
    toast.classList.add('active');
    setTimeout(() => {
      toast.classList.remove('active');
    }, 3000);
  }
}

/**
 * Form submit maintenance log handler
 */
function handleCreateRequest(e) {
  e.preventDefault();
  
  const roomNo = document.getElementById('reqRoomNo').value;
  const type = document.getElementById('reqType').value.trim();
  const priority = document.getElementById('reqPriority').value;
  const status = document.getElementById('reqStatus').value;

  const API_BASE = getApiBase();

  if (editingTaskId) {
    const payload = {
      room_number: roomNo,
      issue: type,
      priority,
      status
    };

    fetch(`${API_BASE}/api/ops/maintenance/${editingTaskId}/edit`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    .then(res => res.json())
    .then(data => {
      closeModal('maintenanceModal');
      showToast("Record updated successfully");
      fetchOpsData();
    })
    .catch(err => {
      console.error('Failed to update request:', err);
      showToast('Error updating issue.');
    });
  } else {
    const payload = {
      room_number: roomNo,
      issue: type,
      priority
    };

    fetch(`${API_BASE}/api/ops/maintenance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    .then(res => res.json())
    .then(data => {
      closeModal('maintenanceModal');
      showToast(`Logged maintenance issue: "${type}" for Room ${roomNo}.`);
      fetchOpsData();
    })
    .catch(err => {
      console.error('Failed to create maintenance request:', err);
      showToast('Error reporting issue.');
    });
  }
}

/**
 * Handle logout link redirect
 */
function handleLogout(event) {
  event.preventDefault();
  localStorage.removeItem('user');
  localStorage.removeItem('token');
  window.location.href = 'index.html';
}

/**
 * Generates the HTML markup for an Operations Room Card including top photo
 */
function renderRoomCardHtml(room) {
  const roomNo = room.room_number || room.roomNo;
  const category = room.category || room.type || 'Single Room';
  const acType = room.ac_type || room.acType || 'Non-A/C';
  const price = room.price_per_night || room.price || 0;
  const status = (room.status || 'available').toLowerCase();
  const imageUrl = room.image_url || room.imageUrl || 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=80';

  let badgeHtml = '';
  let buttonHtml = '';

  if (status === 'available') {
    badgeHtml = `<span class="status-badge status-available">Available</span>`;
    buttonHtml = `
      <button class="btn-room-action" onclick="toggleRoomStatus('${roomNo}', 'cleaning')">
        <svg viewBox="0 0 24 24"><path d="M19 13H5v-2h14v2z"/></svg>
        Mark Dirty (Prep)
      </button>`;
  } else if (status === 'occupied') {
    badgeHtml = `<span class="status-badge status-occupied">Occupied</span>`;
    buttonHtml = `
      <button class="btn-room-action" onclick="toggleRoomStatus('${roomNo}', 'cleaning')">
        <svg viewBox="0 0 24 24"><path d="M19 13H5v-2h14v2z"/></svg>
        Mark Dirty (Checkout)
      </button>`;
  } else if (status === 'cleaning' || status === 'dirty') {
    badgeHtml = `<span class="status-badge status-cleaning">Cleaning</span>`;
    buttonHtml = `
      <button class="btn-room-action action-clean" onclick="toggleRoomStatus('${roomNo}', 'available')">
        <svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
        Mark Cleaned
      </button>`;
  } else if (status === 'maintenance') {
    badgeHtml = `<span class="status-badge status-maintenance">Maintenance</span>`;
    buttonHtml = `
      <button class="btn-room-action" onclick="resolveRoomMaintenance('${roomNo}')">
        <svg viewBox="0 0 24 24"><path d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.3C.5 6.7.9 9.8 2.9 11.8c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.5z"/></svg>
        Resolve Maintenance
      </button>`;
  }

  const isAc = (acType || '').toUpperCase().includes('A/C') && !(acType || '').toUpperCase().includes('NON');
  const acBadgeBg = isAc ? 'rgba(59, 130, 246, 0.15)' : 'rgba(156, 163, 175, 0.15)';
  const acBadgeColor = isAc ? '#60a5fa' : '#9ca3af';
  const acBadgeBorder = isAc ? 'rgba(59, 130, 246, 0.3)' : 'rgba(156, 163, 175, 0.3)';

  return `
    <div class="w-full h-32 overflow-hidden rounded-t-xl bg-gray-900 relative">
      <img src="${imageUrl}" 
           alt="Room ${roomNo}" 
           class="w-full h-full object-cover" 
           onerror="this.onerror=null;this.src='https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=80';">
    </div>
    <div class="room-card-content">
      <div class="room-card-header">
        <div>
          <div class="room-number">Room ${roomNo}</div>
          <div style="display: flex; gap: 0.35rem; align-items: center; margin-top: 0.4rem; flex-wrap: wrap;">
            <span style="background: rgba(197, 168, 128, 0.15); color: var(--accent-gold); font-size: 0.75rem; font-weight: 700; padding: 2px 8px; border-radius: 4px; border: 1px solid rgba(197, 168, 128, 0.3);">${category}</span>
            <span style="background: ${acBadgeBg}; color: ${acBadgeColor}; font-size: 0.75rem; font-weight: 700; padding: 2px 8px; border-radius: 4px; border: 1px solid ${acBadgeBorder};">${acType}</span>
            <span style="color: #94a3b8; font-size: 0.75rem; font-weight: 600; margin-left: 2px;">Rs. ${Number(price).toFixed(0)}/nt</span>
          </div>
        </div>
        ${badgeHtml}
      </div>
      ${buttonHtml}
    </div>
  `;
}

// Helper to escape HTML characters
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ========================================================
// ROOM PACKAGES & SPECIAL SETUPS OPERATIONS LOGIC
// ========================================================

/**
 * Loads available packages and room assignments from live API
 */
async function loadHousekeepingPackagesData() {
  const API_BASE = getApiBase();
  try {
    const [pkgRes, assignRes] = await Promise.all([
      fetch(`${API_BASE}/api/housekeeping/packages`).then(r => r.json()).catch(() => ({ success: false, packages: [] })),
      fetch(`${API_BASE}/api/housekeeping/assignments`).then(r => r.json()).catch(() => ({ success: false, assignments: [] }))
    ]);

    if (pkgRes && pkgRes.success && Array.isArray(pkgRes.packages)) {
      housekeepingPackages = pkgRes.packages;
    } else if (Array.isArray(pkgRes)) {
      housekeepingPackages = pkgRes;
    }

    if (assignRes && assignRes.success && Array.isArray(assignRes.assignments)) {
      packageAssignments = assignRes.assignments;
    } else if (Array.isArray(assignRes)) {
      packageAssignments = assignRes;
    }

    populateOpsPackageRoomDropdown();
    populateOpsPackageDropdown();
    renderOpsAvailablePackagesList();
    renderOpsPackageAssignments();
    updateOpsPackageKPIs();
  } catch (err) {
    console.error('[Ops Dashboard] Error loading packages data:', err);
  }
}

/**
 * Populates Room Select dropdown in Assign Package form
 */
function populateOpsPackageRoomDropdown() {
  const select = document.getElementById('opsPkgRoomSelect');
  if (!select) return;

  const currentVal = select.value;
  select.innerHTML = '<option value="">-- Choose Room Unit --</option>';

  if (rooms.length === 0) {
    // Fallback if rooms not loaded yet
    select.innerHTML += `
      <option value="101">Room 101 — Single Room (Non-A/C)</option>
      <option value="102">Room 102 — Single Room (A/C)</option>
      <option value="103">Room 103 — Couple Room (A/C)</option>
      <option value="104">Room 104 — Couple Room (A/C)</option>
      <option value="201">Room 201 — Family Room (Non-A/C)</option>
      <option value="202">Room 202 — Family Room (A/C)</option>
    `;
    return;
  }

  rooms.forEach(r => {
    const opt = document.createElement('option');
    opt.value = r.roomNo;
    opt.textContent = `Room ${r.roomNo} — ${r.type || r.category || 'Standard'} (${r.acType || r.ac_type || 'A/C'})`;
    select.appendChild(opt);
  });

  if (currentVal && Array.from(select.options).some(o => o.value === currentVal)) {
    select.value = currentVal;
  }
}

/**
 * Populates Setup Package dropdown in Assign Package form
 */
function populateOpsPackageDropdown() {
  const select = document.getElementById('opsPkgPackageSelect');
  if (!select) return;

  const currentVal = select.value;
  select.innerHTML = '<option value="">-- Choose Package --</option>';

  housekeepingPackages.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.package_id;
    opt.textContent = p.package_name;
    select.appendChild(opt);
  });

  if (currentVal && Array.from(select.options).some(o => o.value === currentVal)) {
    select.value = currentVal;
  }
}

/**
 * Renders the Available Packages Catalog card list
 */
function renderOpsAvailablePackagesList() {
  const container = document.getElementById('opsPkgCatalogList');
  if (!container) return;

  if (housekeepingPackages.length === 0) {
    container.innerHTML = `<p style="font-size: 0.8rem; color: var(--text-gray); padding: 0.5rem 0;">No setup packages catalogued yet.</p>`;
    return;
  }

  container.innerHTML = housekeepingPackages.map(p => {
    const items = p.items_included || p.included_items || '';
    const category = p.category || 'Luxury';
    return `
    <div class="pkg-catalog-card">
      <div style="flex: 1; min-width: 0;">
        <div style="font-weight: 700; color: #fff; font-size: 0.85rem; display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
          <span>🎁</span> <span>${escapeHtml(p.package_name)}</span>
          <span style="background: rgba(59, 130, 246, 0.18); color: #60a5fa; font-size: 0.72rem; font-weight: 600; padding: 1px 7px; border-radius: 9999px; border: 1px solid rgba(59, 130, 246, 0.35);">
            ${escapeHtml(category)}
          </span>
          <span style="background: rgba(245, 158, 11, 0.18); color: #fbbf24; font-size: 0.75rem; font-weight: 700; padding: 2px 7px; border-radius: 9999px; border: 1px solid rgba(245, 158, 11, 0.35);">
            ${Number(p.price || 0) === 0 ? 'Complimentary (Rs. 0)' : 'Rs. ' + Number(p.price).toFixed(2)}
          </span>
        </div>
        <div style="font-size: 0.75rem; color: var(--text-gray); margin-top: 3px;">
          ${escapeHtml(p.description || 'No description provided')}
        </div>
        ${items ? `
          <div style="font-size: 0.7rem; color: var(--accent-gold); margin-top: 5px; display: flex; align-items: center; gap: 4px; flex-wrap: wrap;">
            <span>📦</span> <span>${escapeHtml(items)}</span>
          </div>
        ` : ''}
      </div>
      <div style="display: flex; align-items: center; gap: 0.4rem; flex-shrink: 0;">
        <button type="button" onclick="openEditPackageModal(${p.package_id})" class="btn-action-sm" title="Edit Package" style="background: rgba(245, 158, 11, 0.15); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 6px; padding: 0.35rem 0.6rem; font-size: 0.75rem; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;">
          ✏️ Edit
        </button>
        <button type="button" onclick="handleDeleteOpsPackage(${p.package_id})" class="btn-action-delete" title="Delete Package Template" style="padding: 0.35rem 0.6rem; font-size: 0.75rem;">
          <svg viewBox="0 0 24 24" style="width:14px;height:14px;fill:currentColor;"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
        </button>
      </div>
    </div>
  `;
  }).join('');
}

/**
 * Renders the Ops Package Assignments Board (Fulfillment table)
 */
function renderOpsPackageAssignments() {
  const tbody = document.getElementById('opsPkgAssignmentsTbody');
  const emptyState = document.getElementById('opsPkgEmptyState');
  const filterSelect = document.getElementById('opsPkgStatusFilter');
  const searchInput = document.getElementById('opsPkgSearchInput');

  if (!tbody) return;

  const currentFilter = filterSelect ? filterSelect.value.toLowerCase() : 'all';
  const searchTerm = searchInput ? searchInput.value.trim().toLowerCase() : '';

  // Filter list
  const filtered = packageAssignments.filter(a => {
    const status = (a.status || 'Pending').toLowerCase();
    const room = (a.room_number || '').toString().toLowerCase();
    const pkgName = (a.package_name || '').toLowerCase();
    const notes = (a.notes || '').toLowerCase();

    const matchesStatus = currentFilter === 'all' || status === currentFilter;
    const matchesSearch = !searchTerm || room.includes(searchTerm) || pkgName.includes(searchTerm) || notes.includes(searchTerm);

    return matchesStatus && matchesSearch;
  });

  tbody.innerHTML = '';

  if (filtered.length === 0) {
    if (emptyState) emptyState.style.display = 'block';
  } else {
    if (emptyState) emptyState.style.display = 'none';

    filtered.forEach(a => {
      const tr = document.createElement('tr');
      const statusLower = (a.status || 'Pending').toLowerCase();

      let statusBadge = '';
      let actionBtn = '';

      if (statusLower === 'delivered') {
        statusBadge = `<span class="badge-pkg-delivered">✓ Delivered</span>`;
        actionBtn = `<span style="font-size: 0.75rem; color: #10b981; font-weight: 600; padding: 0.25rem 0.5rem;">Completed</span>`;
      } else if (statusLower === 'prepared') {
        statusBadge = `<span class="badge-pkg-prepared">📦 Prepared</span>`;
        actionBtn = `
          <button type="button" class="btn-action-delivered" onclick="handleProgressOpsAssignment(${a.assignment_id}, 'Delivered')" title="Mark as Delivered to guest room">
            Mark Delivered ✓
          </button>
        `;
      } else {
        // Pending
        statusBadge = `<span class="badge-pkg-pending"><span style="width: 6px; height: 6px; border-radius: 50%; background: #fbbf24; display: inline-block;"></span> Pending</span>`;
        actionBtn = `
          <button type="button" class="btn-action-prepared" onclick="handleProgressOpsAssignment(${a.assignment_id}, 'Prepared')" title="Mark package prepared">
            Mark Prepared 📦
          </button>
        `;
      }

      tr.innerHTML = `
        <td>
          <span style="background: rgba(197, 168, 128, 0.15); color: var(--accent-gold); border: 1px solid rgba(197, 168, 128, 0.3); padding: 0.2rem 0.6rem; border-radius: 6px; font-weight: 800; font-family: var(--font-outfit); font-size: 0.85rem;">
            Room ${escapeHtml(a.room_number)}
          </span>
        </td>
        <td>
          <div style="font-weight: 600; color: var(--text-white); font-size: 0.85rem;">${escapeHtml(a.package_name || 'Setup Package')}</div>
          ${a.package_description ? `<div style="font-size: 0.75rem; color: var(--text-gray); margin-top: 1px;">${escapeHtml(a.package_description)}</div>` : ''}
          ${a.notes ? `<div style="font-size: 0.7rem; color: var(--accent-gold); margin-top: 2px; font-style: italic;">📝 ${escapeHtml(a.notes)}</div>` : ''}
        </td>
        <td>
          <div style="font-size: 0.75rem; color: var(--text-gray); max-width: 260px;">
            ${escapeHtml(a.items_included || 'Standard Amenities')}
          </div>
        </td>
        <td>
          ${statusBadge}
        </td>
        <td style="text-align: right;">
          <div style="display: flex; align-items: center; justify-content: flex-end; gap: 0.5rem;">
            ${actionBtn}
            <button type="button" class="btn-action-delete" onclick="handleDeleteOpsAssignment(${a.assignment_id})" title="Delete Assignment">
              <svg viewBox="0 0 24 24" style="width:14px;height:14px;fill:currentColor;"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
            </button>
          </div>
        </td>
      `;

      tbody.appendChild(tr);
    });
  }

  updateOpsPackageKPIs();
}

/**
 * Filter change event listener helper
 */
function filterOpsPackageAssignments() {
  renderOpsPackageAssignments();
}

/**
 * Updates KPI Summary Cards and Sidebar Badge for Packages
 */
function updateOpsPackageKPIs() {
  const totalEl = document.getElementById('kpi-ops-pkg-total');
  const pendingEl = document.getElementById('kpi-ops-pkg-pending');
  const preparedEl = document.getElementById('kpi-ops-pkg-prepared');
  const deliveredEl = document.getElementById('kpi-ops-pkg-delivered');
  const badgeEl = document.getElementById('package-count-badge');

  const pendingCount = packageAssignments.filter(a => (a.status || 'Pending').toLowerCase() === 'pending').length;
  const preparedCount = packageAssignments.filter(a => (a.status || '').toLowerCase() === 'prepared').length;
  const deliveredCount = packageAssignments.filter(a => (a.status || '').toLowerCase() === 'delivered').length;
  const activeCount = pendingCount + preparedCount;

  if (totalEl) totalEl.textContent = housekeepingPackages.length;
  if (pendingEl) pendingEl.textContent = pendingCount;
  if (preparedEl) preparedEl.textContent = preparedCount;
  if (deliveredEl) deliveredEl.textContent = deliveredCount;

  if (badgeEl) {
    badgeEl.textContent = activeCount > 0 ? activeCount : (packageAssignments.length > 0 ? packageAssignments.length : 0);
  }
}

/**
 * Submits assignment form to assign package to room
 */
async function handleAssignOpsPackage(e) {
  if (e && e.preventDefault) e.preventDefault();
  const roomNumber = document.getElementById('opsPkgRoomSelect')?.value;
  const packageId = document.getElementById('opsPkgPackageSelect')?.value;
  const notes = document.getElementById('opsPkgNotes')?.value.trim();

  if (!roomNumber || !packageId) {
    showToast('Please select both a room and a setup package.', 'error');
    return;
  }

  const API_BASE = getApiBase();
  try {
    const res = await fetch(`${API_BASE}/api/housekeeping/assignments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        room_number: roomNumber,
        package_id: parseInt(packageId, 10),
        assigned_by: 'Hirushan (Operations)',
        notes
      })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      showToast(data.message || 'Package assigned to room successfully!');
      document.getElementById('assignOpsPackageForm')?.reset();
      await loadHousekeepingPackagesData();
    } else {
      showToast(data.message || 'Failed to assign package.', 'error');
    }
  } catch (err) {
    showToast('Network error: ' + err.message, 'error');
  }
}

/**
 * Updates assignment status (Pending -> Prepared -> Delivered)
 */
async function handleProgressOpsAssignment(assignmentId, targetStatus) {
  const API_BASE = getApiBase();
  try {
    const res = await fetch(`${API_BASE}/api/housekeeping/assignments/${assignmentId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: targetStatus })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      showToast(data.message || `Package status updated to ${targetStatus}!`);
      await loadHousekeepingPackagesData();
    } else {
      showToast(data.message || 'Failed to update assignment.', 'error');
    }
  } catch (err) {
    showToast('Network error: ' + err.message, 'error');
  }
}

/**
 * Removes a package assignment
 */
async function handleDeleteOpsAssignment(assignmentId) {
  if (!confirm('Remove this room package assignment?')) return;
  const API_BASE = getApiBase();
  try {
    const res = await fetch(`${API_BASE}/api/housekeeping/assignments/${assignmentId}`, {
      method: 'DELETE'
    });
    const data = await res.json();
    if (res.ok && data.success) {
      showToast(data.message || 'Package assignment removed.');
      await loadHousekeepingPackagesData();
    } else {
      showToast(data.message || 'Failed to remove assignment.', 'error');
    }
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
}

/**
 * Modal helpers for Create Package
 */
function openCreatePackageModal() {
  const modal = document.getElementById('createPackageModal') || document.getElementById('newPackageModal');
  if (modal) {
    const form = document.getElementById('createPackageForm') || document.getElementById('newPackageForm');
    if (form) form.reset();
    if (typeof modal.showModal === 'function') {
      try {
        modal.showModal();
      } catch (e) {
        modal.style.display = 'block';
        modal.classList.remove('hidden');
      }
    } else {
      modal.style.display = 'block';
      modal.classList.remove('hidden');
    }
  }
}

function openNewPackageModal() {
  openCreatePackageModal();
}

function closeNewPackageModal() {
  closeModal('createPackageModal');
  closeModal('newPackageModal');
}

/**
 * Creates a new setup package template
 */
async function handleCreateOpsPackage(e) {
  if (e && e.preventDefault) e.preventDefault();
  const name = (document.getElementById('newPkgName')?.value || document.getElementById('pkgName')?.value || '').trim();
  const category = (document.getElementById('newPkgCategory')?.value || document.getElementById('pkgCategory')?.value || 'Luxury').trim();
  const priceInput = document.getElementById('newPkgPrice') || document.getElementById('pkgPrice');
  const priceVal = parseFloat(priceInput ? priceInput.value : 0);
  const desc = (document.getElementById('newPkgDesc')?.value || document.getElementById('pkgDescription')?.value || '').trim();
  const items = (document.getElementById('newPkgItems')?.value || document.getElementById('pkgIncludedItems')?.value || '').trim();

  // Package Form Validations: min 3 chars, price >= 0
  if (!name || name.length < 3) {
    alert('Package name is required and must be at least 3 characters.');
    return;
  }

  if (isNaN(priceVal) || priceVal < 0) {
    alert('Package price must be a number greater than or equal to 0.');
    return;
  }

  const API_BASE = getApiBase();
  try {
    const res = await fetch(`${API_BASE}/api/housekeeping/packages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        package_name: name,
        category: category,
        price: priceVal,
        description: desc,
        included_items: items,
        items_included: items
      })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      showToast(data.message || 'Setup package created successfully!');
      closeModal('createPackageModal');
      closeModal('newPackageModal');
      document.getElementById('createPackageForm')?.reset();
      document.getElementById('newPackageForm')?.reset();
      await loadHousekeepingPackagesData();
    } else {
      alert(data.message || 'Failed to create package.');
    }
  } catch (err) {
    alert('Network error: ' + err.message);
  }
}

/**
 * Opens Edit Package Modal pre-filled with package details
 */
function openEditPackageModal(pkgId) {
  const pkg = (housekeepingPackages || []).find(p => p.package_id === pkgId);
  if (!pkg) {
    showToast('Package template not found.', 'error');
    return;
  }

  const editPkgId = document.getElementById('editPkgId');
  const editPkgName = document.getElementById('editPkgName');
  const editPkgCategory = document.getElementById('editPkgCategory');
  const editPkgPrice = document.getElementById('editPkgPrice');
  const editPkgDesc = document.getElementById('editPkgDesc');
  const editPkgItems = document.getElementById('editPkgItems');

  if (editPkgId) editPkgId.value = pkg.package_id;
  if (editPkgName) editPkgName.value = pkg.package_name || '';
  if (editPkgCategory && pkg.category) editPkgCategory.value = pkg.category;
  if (editPkgPrice) editPkgPrice.value = Number(pkg.price || 0).toFixed(2);
  if (editPkgDesc) editPkgDesc.value = pkg.description || '';
  if (editPkgItems) editPkgItems.value = pkg.included_items || pkg.items_included || '';

  const modal = document.getElementById('editPackageModal');
  if (modal) {
    if (typeof modal.showModal === 'function') {
      try {
        modal.showModal();
      } catch (e) {
        modal.style.display = 'block';
        modal.classList.remove('hidden');
      }
    } else {
      modal.style.display = 'block';
      modal.classList.remove('hidden');
    }
  }
}

/**
 * Handles updating an existing setup package template
 */
async function handleUpdateOpsPackage(e) {
  if (e && e.preventDefault) e.preventDefault();
  const pkgId = document.getElementById('editPkgId')?.value;
  const name = document.getElementById('editPkgName')?.value.trim();
  const category = document.getElementById('editPkgCategory')?.value || 'Luxury';
  const priceVal = parseFloat(document.getElementById('editPkgPrice')?.value);
  const desc = document.getElementById('editPkgDesc')?.value.trim();
  const items = document.getElementById('editPkgItems')?.value.trim();

  if (!pkgId) {
    alert('Package ID is missing.');
    return;
  }

  // Package Form Validations: min 3 chars, price >= 0
  if (!name || name.length < 3) {
    alert('Package name is required and must be at least 3 characters.');
    return;
  }

  if (isNaN(priceVal) || priceVal < 0) {
    alert('Package price must be a number greater than or equal to 0.');
    return;
  }

  const API_BASE = getApiBase();
  try {
    const res = await fetch(`${API_BASE}/api/housekeeping/packages/${encodeURIComponent(pkgId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        package_name: name,
        category: category,
        price: priceVal,
        description: desc,
        included_items: items,
        items_included: items
      })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      showToast(data.message || 'Setup package updated successfully!');
      closeModal('editPackageModal');
      await loadHousekeepingPackagesData();
    } else {
      alert(data.message || 'Failed to update package.');
    }
  } catch (err) {
    alert('Network error updating package: ' + err.message);
  }
}

/**
 * Deletes a package template
 */
async function handleDeleteOpsPackage(pkgId) {
  if (!confirm('Are you sure you want to delete this package template? Any related assignments will also be removed.')) return;
  const API_BASE = getApiBase();
  try {
    const res = await fetch(`${API_BASE}/api/housekeeping/packages/${pkgId}`, {
      method: 'DELETE'
    });
    const data = await res.json();
    if (res.ok && data.success) {
      showToast(data.message || 'Package template deleted.');
      await loadHousekeepingPackagesData();
    } else {
      showToast(data.message || 'Failed to delete package.', 'error');
    }
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
}

// =========================================================
// DAILY KITCHEN & MEAL MENU MODULE LOGIC
// =========================================================

/**
 * Loads daily meal menu items from API
 */
async function loadDailyMenuItems() {
  const API_BASE = getApiBase();
  try {
    const res = await fetch(`${API_BASE}/api/menu`);
    const data = await res.json();
    if (data && (Array.isArray(data.items) || Array.isArray(data.data) || Array.isArray(data))) {
      dailyMenuItems = data.items || data.data || data;
    } else {
      dailyMenuItems = [];
    }

    renderMenuItems(dailyMenuItems);
    updateMenuKPIs(dailyMenuItems);
  } catch (err) {
    console.error('Failed to fetch daily menu items:', err);
  }
}

/**
 * Updates Menu KPIs & badge count
 */
function updateMenuKPIs(items) {
  const list = Array.isArray(items) ? items : [];
  const breakfastCount = list.filter(i => (i.meal_type || '').toLowerCase() === 'breakfast').length;
  const lunchCount = list.filter(i => (i.meal_type || '').toLowerCase() === 'lunch').length;
  const dinnerCount = list.filter(i => (i.meal_type || '').toLowerCase() === 'dinner').length;
  const availableCount = list.filter(i => Boolean(i.is_available)).length;

  const kpiBreakfast = document.getElementById('kpi-menu-breakfast');
  const kpiLunch = document.getElementById('kpi-menu-lunch');
  const kpiDinner = document.getElementById('kpi-menu-dinner');
  const kpiAvailable = document.getElementById('kpi-menu-available');
  const badgeMenuCount = document.getElementById('badge-menu-count');

  if (kpiBreakfast) kpiBreakfast.textContent = `${breakfastCount} Dishes`;
  if (kpiLunch) kpiLunch.textContent = `${lunchCount} Dishes`;
  if (kpiDinner) kpiDinner.textContent = `${dinnerCount} Dishes`;
  if (kpiAvailable) kpiAvailable.textContent = `${availableCount} Ready`;
  if (badgeMenuCount) badgeMenuCount.textContent = list.length;
}

/**
 * Renders meal menu items into 3 distinct column containers
 */
function renderMenuItems(items) {
  const list = Array.isArray(items) ? items : [];
  const breakfastList = document.getElementById('breakfastMenuList');
  const lunchList = document.getElementById('lunchMenuList');
  const dinnerList = document.getElementById('dinnerMenuList');

  if (!breakfastList || !lunchList || !dinnerList) return;

  const breakfastItems = list.filter(i => (i.meal_type || '').toLowerCase() === 'breakfast');
  const lunchItems = list.filter(i => (i.meal_type || '').toLowerCase() === 'lunch');
  const dinnerItems = list.filter(i => (i.meal_type || '').toLowerCase() === 'dinner');

  breakfastList.innerHTML = renderDishListHtml(breakfastItems, 'Breakfast');
  lunchList.innerHTML = renderDishListHtml(lunchItems, 'Lunch');
  dinnerList.innerHTML = renderDishListHtml(dinnerItems, 'Dinner');
}

/**
 * Helper to render list of dish cards
 */
function renderDishListHtml(dishArray, mealType) {
  if (!dishArray || dishArray.length === 0) {
    return `
      <div class="menu-empty-placeholder">
        <span style="font-size: 1.5rem; opacity: 0.5;">🍽️</span>
        <p>No ${mealType.toLowerCase()} dishes added yet.</p>
        <button type="button" class="btn-secondary" style="font-size: 0.75rem; padding: 0.35rem 0.75rem; margin-top: 4px;" onclick="openAddDishModal('${mealType}')">
          + Add First Dish
        </button>
      </div>
    `;
  }

  return dishArray.map(dish => {
    const isAvail = Boolean(dish.is_available);
    const itemId = dish.item_id;
    const itemName = escapeHtml(dish.item_name || 'Unnamed Dish');
    const itemDesc = escapeHtml(dish.description || 'No description provided');
    const stockClass = isAvail ? '' : 'out-of-stock';
    const statusText = isAvail ? 'Available' : 'Out of Stock';
    const statusClass = isAvail ? 'available' : 'out-of-stock';

    return `
      <div class="menu-dish-card ${stockClass}" id="dish-card-${itemId}">
        <div class="menu-dish-header">
          <span class="menu-dish-name">${itemName}</span>
          <span class="switch-label ${statusClass}" style="font-size: 0.7rem; font-weight: 700; text-transform: uppercase;">
            ${isAvail ? '🟢 Ready' : '🔴 Out of Stock'}
          </span>
        </div>
        ${dish.description ? `<p class="menu-dish-desc">${itemDesc}</p>` : ''}
        <div class="menu-dish-footer">
          <label class="switch-container" title="Toggle dish availability">
            <input type="checkbox" class="switch-input" ${isAvail ? 'checked' : ''} onchange="toggleDishAvailability(${itemId})">
            <span class="switch-slider"></span>
            <span class="switch-label ${statusClass}">${statusText}</span>
          </label>
          <button type="button" class="btn-delete-dish" onclick="deleteDishItem(${itemId}, '${escapeHtml(dish.item_name || '')}')" title="Delete Dish">
            <svg viewBox="0 0 24 24" style="width: 14px; height: 14px; fill: currentColor;"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
            Delete
          </button>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Initializes and binds event listeners for Daily Menu + buttons and form
 */
function initMenuEventListeners() {
  const btnOpenAddDishModal = document.getElementById('btnOpenAddDishModal');
  if (btnOpenAddDishModal) {
    btnOpenAddDishModal.addEventListener('click', (e) => {
      e.preventDefault();
      openAddDishModal();
    });
  }

  const btnCloseDishModal = document.getElementById('btnCloseDishModal');
  if (btnCloseDishModal) {
    btnCloseDishModal.addEventListener('click', (e) => {
      e.preventDefault();
      closeModal('addDishModal');
    });
  }

  const btnCancelDish = document.getElementById('btnCancelDish');
  if (btnCancelDish) {
    btnCancelDish.addEventListener('click', (e) => {
      e.preventDefault();
      closeModal('addDishModal');
    });
  }

  const addButtons = document.querySelectorAll('.btn-add-column-dish, [data-action="add-dish"]');
  addButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const mealType = btn.getAttribute('data-meal') || (btn.title && btn.title.includes('Breakfast') ? 'Breakfast' : (btn.title && btn.title.includes('Lunch') ? 'Lunch' : 'Dinner')) || 'Breakfast';
      openAddDishModal(mealType);
    });
  });

  const dishForm = document.getElementById('formAddDish') || document.getElementById('addDishForm');
  if (dishForm) {
    dishForm.onsubmit = handleAddDishSubmit;
  }

  const dishModal = document.getElementById('addDishModal');
  if (dishModal) {
    dishModal.addEventListener('click', (e) => {
      if (e.target === dishModal) {
        closeModal('addDishModal');
      }
    });
  }
}

/**
 * Open Modal to Add Dish with Pre-selected Meal Category
 */
function openAddDishModal(prefillType) {
  if (typeof window.openMenuModal === 'function') {
    window.openMenuModal(prefillType);
    return;
  }
  const kitchenDishModal = document.getElementById('kitchenDishModal');
  if (kitchenDishModal) {
    kitchenDishModal.style.display = 'flex';
    if (prefillType) {
      const sess = document.getElementById('modalMealSession');
      if (sess) sess.value = prefillType;
    }
    return;
  }
  const mealModal = document.getElementById('mealModal');
  if (mealModal) {
    mealModal.style.display = 'flex';
    if (prefillType) {
      const sess = document.getElementById('mSession');
      if (sess) sess.value = prefillType;
    }
    const nameInput = document.getElementById('mName');
    if (nameInput) {
      nameInput.value = '';
      nameInput.focus();
    }
    return;
  }
  const modal = document.getElementById('addDishModal');
  const typeSelect = document.getElementById('dishMealType');
  const form = document.getElementById('formAddDish') || document.getElementById('addDishForm');
  const statusSelect = document.getElementById('dishStatus');
  
  if (form) form.reset();
  if (typeSelect && prefillType) {
    typeSelect.value = prefillType;
  }
  if (statusSelect) {
    statusSelect.value = '1';
  }
  if (modal) {
    modal.style.display = 'flex';
    if (typeof modal.showModal === 'function') {
      try {
        modal.showModal();
      } catch (err) {
        // Modal is standard div with backdrop
      }
    }
    const nameInput = document.getElementById('dishItemName') || document.getElementById('dishName');
    if (nameInput) {
      nameInput.value = '';
      nameInput.focus();
    }
  }
}

/**
 * Handle Add Dish Submission
 */
async function handleAddDishSubmit(e) {
  if (e && e.preventDefault) e.preventDefault();
  const mealTypeEl = document.getElementById('dishMealType');
  const nameEl = document.getElementById('dishItemName') || document.getElementById('dishName');
  const descEl = document.getElementById('dishDescription');
  const statusEl = document.getElementById('dishStatus');

  const mealType = mealTypeEl ? mealTypeEl.value : 'Breakfast';
  const itemName = nameEl ? nameEl.value.trim() : '';
  const description = descEl ? descEl.value.trim() : '';
  const isAvailable = statusEl ? (statusEl.value === '1' || statusEl.value === 'true') : true;

  if (!itemName) {
    alert('Please enter a valid dish name.');
    return;
  }

  const API_BASE = getApiBase();
  try {
    const res = await fetch(`${API_BASE}/api/menu`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        meal_type: mealType,
        item_name: itemName,
        description: description,
        is_available: isAvailable
      })
    });

    const data = await res.json();
    if (res.ok && data.success) {
      closeModal('addDishModal');
      if (typeof showToast === 'function') {
        showToast(data.message || `Dish "${itemName}" added to ${mealType} menu!`);
      }
      await loadDailyMenuItems();
    } else {
      alert(data.message || 'Failed to add dish to menu.');
    }
  } catch (err) {
    console.error('Error adding dish:', err);
    alert('Network error while adding dish: ' + err.message);
  }
}

/**
 * Toggle Dish Availability
 */
async function toggleDishAvailability(itemId) {
  const API_BASE = getApiBase();
  try {
    const res = await fetch(`${API_BASE}/api/menu/${itemId}/toggle`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' }
    });

    const data = await res.json();
    if (res.ok && data.success) {
      showToast(data.message || 'Dish availability updated.');
      await loadDailyMenuItems();
    } else {
      alert(data.message || 'Failed to toggle dish availability.');
      await loadDailyMenuItems();
    }
  } catch (err) {
    console.error('Error toggling dish availability:', err);
    showToast('Error updating dish availability.');
    await loadDailyMenuItems();
  }
}

/**
 * Delete Menu Item
 */
async function deleteDishItem(itemId, dishName) {
  if (!confirm(`Are you sure you want to remove "${dishName || 'this dish'}" from the menu?`)) {
    return;
  }

  const API_BASE = getApiBase();
  try {
    const res = await fetch(`${API_BASE}/api/menu/${itemId}`, {
      method: 'DELETE'
    });

    const data = await res.json();
    if (res.ok && data.success) {
      showToast(data.message || 'Dish removed from menu.');
      await loadDailyMenuItems();
    } else {
      alert(data.message || 'Failed to delete dish.');
    }
  } catch (err) {
    console.error('Error deleting dish:', err);
    alert('Network error deleting dish: ' + err.message);
  }
}

// Global Browser Window Attachments
if (typeof window !== 'undefined') {
  window.switchTab = switchTab;
  window.toggleRoomStatus = toggleRoomStatus;
  window.resolveRoomMaintenance = resolveRoomMaintenance;
  window.handleCreateRoom = handleCreateRoom;
  window.openEditRoomModal = openEditRoomModal;
  window.handleUpdateRoom = handleUpdateRoom;
  window.handleCategoryPriceDefault = handleCategoryPriceDefault;
  window.deleteRoom = deleteRoom;
  window.completeRequest = completeRequest;
  window.editRequest = editRequest;
  window.deleteRequest = deleteRequest;
  window.openMaintenanceModal = openMaintenanceModal;
  window.closeModal = closeModal;
  window.openUpdatePhotoModal = openUpdatePhotoModal;
  window.previewEditPhoto = previewEditPhoto;
  window.handlePhotoPreviewError = handlePhotoPreviewError;
  window.handleUpdateRoomPhoto = handleUpdateRoomPhoto;
  window.handleCreateRequest = handleCreateRequest;
  window.handleLogout = handleLogout;
  window.showToast = showToast;
  window.fetchOpsData = fetchOpsData;
  window.loadDashboardData = loadDashboardData;
  window.initSidebarTabs = initSidebarTabs;
  window.initRoomImageFileInput = initRoomImageFileInput;
  window.setupDialogLightDismiss = setupDialogLightDismiss;
  window.populateRoomSelect = populateRoomSelect;
  window.renderGrid = renderGrid;
  window.renderTable = renderTable;
  window.renderInventoryTable = renderInventoryTable;
  window.renderRoomCardHtml = renderRoomCardHtml;
  window.updateKPIs = updateKPIs;

  // Packages Operations Attachments
  window.loadHousekeepingPackagesData = loadHousekeepingPackagesData;
  window.populateOpsPackageRoomDropdown = populateOpsPackageRoomDropdown;
  window.populateOpsPackageDropdown = populateOpsPackageDropdown;
  window.renderOpsAvailablePackagesList = renderOpsAvailablePackagesList;
  window.renderOpsPackageAssignments = renderOpsPackageAssignments;
  window.updateOpsPackageKPIs = updateOpsPackageKPIs;
  window.handleAssignOpsPackage = handleAssignOpsPackage;
  window.handleProgressOpsAssignment = handleProgressOpsAssignment;
  window.handleDeleteOpsAssignment = handleDeleteOpsAssignment;
  window.openCreatePackageModal = openCreatePackageModal;
  window.openNewPackageModal = openNewPackageModal;
  window.closeNewPackageModal = closeNewPackageModal;
  window.openEditPackageModal = openEditPackageModal;
  window.handleCreateOpsPackage = handleCreateOpsPackage;
  window.handleUpdateOpsPackage = handleUpdateOpsPackage;
  window.handleDeleteOpsPackage = handleDeleteOpsPackage;
  window.filterOpsPackageAssignments = filterOpsPackageAssignments;

  // Daily Meal Menu Attachments
  window.loadDailyMenuItems = loadDailyMenuItems;
  window.updateMenuKPIs = updateMenuKPIs;
  window.renderMenuItems = renderMenuItems;
  window.renderDishListHtml = renderDishListHtml;
  window.openAddDishModal = openAddDishModal;
  window.handleAddDishSubmit = handleAddDishSubmit;
  window.initMenuEventListeners = initMenuEventListeners;
  window.toggleDishAvailability = toggleDishAvailability;
  window.deleteDishItem = deleteDishItem;

  // Filter Tabs
  window.setRoomFilter = setRoomFilter;
  window.initRoomFilterTabs = initRoomFilterTabs;
  window.isRoomNeedingCleaning = isRoomNeedingCleaning;
  window.isRoomCleanedAndReady = isRoomCleanedAndReady;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { 
    renderRoomCardHtml, 
    initRoomImageFileInput, 
    initSidebarTabs, 
    loadDashboardData, 
    fetchOpsData,
    switchTab,
    renderGrid,
    renderTable,
    renderInventoryTable,
    handleCreateRoom,
    openEditRoomModal,
    handleUpdateRoom,
    deleteRoom,
    loadHousekeepingPackagesData,
    renderOpsPackageAssignments,
    handleAssignOpsPackage,
    openEditPackageModal,
    handleCreateOpsPackage,
    handleUpdateOpsPackage,
    handleDeleteOpsPackage,
    setRoomFilter,
    initRoomFilterTabs,
    isRoomNeedingCleaning,
    isRoomCleanedAndReady,
    loadDailyMenuItems,
    updateMenuKPIs,
    renderMenuItems,
    renderDishListHtml,
    openAddDishModal,
    handleAddDishSubmit,
    initMenuEventListeners,
    toggleDishAvailability,
    deleteDishItem,
    previewEditPhoto,
    handlePhotoPreviewError,
    handleUpdateRoomPhoto
  };
}


