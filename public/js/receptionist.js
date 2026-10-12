/**
 * Pinnacle Bay Hotel Management System - Receptionist Controller Module
 * Handles Walk-In Reservations, Room Availability Grid, Bookings, Complaints, Requests & Reports
 */

var RECEPTION_API_BASE = (typeof window !== 'undefined' && window.location && window.location.origin && window.location.origin.includes('localhost:3000'))
  ? '' 
  : 'http://localhost:3000';

var roomGridData = typeof roomGridData !== 'undefined' ? roomGridData : [];
var currentRoomGridFilter = typeof currentRoomGridFilter !== 'undefined' ? currentRoomGridFilter : 'all';
var allReservationsData = typeof allReservationsData !== 'undefined' ? allReservationsData : [];
var reservationsData = typeof reservationsData !== 'undefined' ? reservationsData : [];
var complaintsData = typeof complaintsData !== 'undefined' ? complaintsData : [];
var requestsData = typeof requestsData !== 'undefined' ? requestsData : [];
var roomsData = typeof roomsData !== 'undefined' ? roomsData : [];
var reportsData = typeof reportsData !== 'undefined' ? reportsData : [];
var reportsSummary = typeof reportsSummary !== 'undefined' ? reportsSummary : {};
var currentBookingStatusFilter = typeof currentBookingStatusFilter !== 'undefined' ? currentBookingStatusFilter : 'active';
var currentBookingSourceTab = typeof currentBookingSourceTab !== 'undefined' ? currentBookingSourceTab : 'all';

/**
 * Toast Notification Helper
 */
function showToast(msg, type = 'info') {
  if (typeof document === 'undefined') {
    console.log(`[Toast ${type}]: ${msg}`);
    return;
  }
  const toast = document.getElementById('toast');
  const text = document.getElementById('toastText');
  if (toast && text) {
    text.textContent = msg;
    toast.classList.add('active');
    setTimeout(() => {
      toast.classList.remove('active');
    }, 3200);
  } else {
    console.log(`[Toast ${type}]: ${msg}`);
  }
}

/**
 * Fetch Room Availability Grid data with Joined In-House Bookings
 */
function fetchRoomGrid() {
  return fetch(`${RECEPTION_API_BASE}/api/reception/rooms/grid`)
    .then(res => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then(data => {
      roomGridData = data.rooms || data.data || (Array.isArray(data) ? data : []);
      
      // Update summary counters
      const total = data.counts?.total ?? roomGridData.length;
      const available = data.counts?.available ?? roomGridData.filter(r => (r.status || '').toLowerCase() === 'available').length;
      const occupied = data.counts?.occupied ?? roomGridData.filter(r => (r.status || '').toLowerCase() === 'occupied').length;
      const dirty = data.counts?.dirty ?? roomGridData.filter(r => ['dirty', 'cleaning', 'in progress'].includes((r.status || '').toLowerCase())).length;

      const elTotal = document.getElementById('gridTotalRooms');
      const elAvail = document.getElementById('gridAvailableRooms');
      const elOcc = document.getElementById('gridOccupiedRooms');
      const elDirty = document.getElementById('gridDirtyRooms');
      const badgeAvail = document.getElementById('badgeRoomsAvailable');

      if (elTotal) elTotal.textContent = `${total} Rooms`;
      if (elAvail) elAvail.textContent = `${available} Available`;
      if (elOcc) elOcc.textContent = `${occupied} Occupied`;
      if (elDirty) elDirty.textContent = `${dirty} Dirty`;
      if (badgeAvail) badgeAvail.textContent = `${available} Avail`;

      // Update filter button counts
      const fAll = document.getElementById('filterCountAll');
      const fAvail = document.getElementById('filterCountAvailable');
      const fOcc = document.getElementById('filterCountOccupied');
      const fDirty = document.getElementById('filterCountDirty');
      if (fAll) fAll.textContent = total;
      if (fAvail) fAvail.textContent = available;
      if (fOcc) fOcc.textContent = occupied;
      if (fDirty) fDirty.textContent = dirty;

      renderRoomGridCards();
      return data;
    })
    .catch(err => {
      console.warn('Fetch room grid non-fatal error:', err);
      showToast('Could not refresh room status grid', 'warning');
      renderRoomGridCards();
      return { rooms: roomGridData };
    });
}

/**
 * Fetch Rooms Alias for compatibility
 */
function fetchRooms() {
  return fetchRoomGrid();
}

/**
 * Fetch Room Types Alias for compatibility
 */
function fetchRoomTypes() {
  return Promise.resolve([]);
}

/**
 * Fetch Bookings data from backend
 */
function fetchBookings() {
  return fetch(`${RECEPTION_API_BASE}/api/reception/bookings`)
    .then(res => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then(data => {
      allReservationsData = Array.isArray(data) ? data : (data.bookings || data.data || []);
      reservationsData = allReservationsData;
      updatePillCounts();
      applyBookingFilter();
      updateBookingsKPIs();
      return allReservationsData;
    })
    .catch(err => {
      console.warn('[Receptionist] Fetch bookings non-fatal error:', err);
      showToast('Could not load reservations from server', 'warning');
      return [];
    });
}

/**
 * Aliases for direct refresh invocation
 */
function loadBookingsTable() {
  return fetchBookings();
}

function loadRoomGrid() {
  return fetchRoomGrid();
}

function loadDashboardStats() {
  return fetchDashboardCounters();
}

function loadComplaintsTable() {
  return fetchComplaints();
}

function loadRequestsTable() {
  return fetchSpecialRequests();
}

/**
 * Returns badge CSS class for room status
 */
function getStatusBadgeClass(status) {
  const s = (status || '').toLowerCase();
  if (s === 'available') {
    return 'badge badge-paid';
  } else if (s === 'occupied') {
    return 'badge badge-urgent';
  } else if (s === 'dirty' || s === 'cleaning' || s === 'in progress') {
    return 'badge badge-pending';
  } else {
    return 'badge badge-vip-standard';
  }
}

/**
 * Filter room grid by status: 'all', 'available', 'occupied', 'dirty'
 */
function setRoomGridFilter(filterKey) {
  currentRoomGridFilter = filterKey;

  ['roomFilterAll', 'roomFilterAvailable', 'roomFilterOccupied', 'roomFilterDirty'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('active');
  });

  const activeIdMap = {
    'all': 'roomFilterAll',
    'available': 'roomFilterAvailable',
    'occupied': 'roomFilterOccupied',
    'dirty': 'roomFilterDirty'
  };
  const activeEl = document.getElementById(activeIdMap[filterKey] || 'roomFilterAll');
  if (activeEl) activeEl.classList.add('active');

  filterRoomGrid();
}

/**
 * Filter Room Grid by status, category, and AC type
 */
function filterRoomGrid() {
  renderRoomGridCards();
}

/**
 * Render room cards grid with top photo container, color borders, badges, guest info, and quick actions
 */
function renderRoomGridCards() {
  const container = document.getElementById('roomCardsContainer');
  const emptyState = document.getElementById('roomGridEmptyState');
  const summaryText = document.getElementById('roomGridSummaryText');
  if (!container) return;

  container.innerHTML = '';

  const selCat = document.getElementById('gridCategoryFilter')?.value || 'All';
  const selAc = document.getElementById('gridAcTypeFilter')?.value || 'All';

  let filtered = [...roomGridData];

  // Status filter
  if (currentRoomGridFilter === 'available') {
    filtered = filtered.filter(r => (r.status || '').toLowerCase() === 'available');
  } else if (currentRoomGridFilter === 'occupied') {
    filtered = filtered.filter(r => (r.status || '').toLowerCase() === 'occupied');
  } else if (currentRoomGridFilter === 'dirty') {
    filtered = filtered.filter(r => ['dirty', 'cleaning', 'in progress'].includes((r.status || '').toLowerCase()));
  }

  // Category filter
  if (selCat && selCat !== 'All' && selCat !== 'All Categories') {
    filtered = filtered.filter(r => (r.category || '').toLowerCase() === selCat.toLowerCase().trim());
  }

  // A/C Type filter
  if (selAc && selAc !== 'All' && selAc !== 'All Types') {
    filtered = filtered.filter(r => (r.ac_type || '').toLowerCase() === selAc.toLowerCase().trim());
  }

  if (summaryText) {
    summaryText.textContent = `Showing ${filtered.length} of ${roomGridData.length} rooms`;
  }

  if (filtered.length === 0) {
    if (emptyState) emptyState.style.display = 'block';
    return;
  }
  if (emptyState) emptyState.style.display = 'none';

  filtered.forEach(r => {
    const s = (r.status || 'Available').toLowerCase();
    const isOccupied = s === 'occupied';
    const isDirty = s === 'dirty' || s === 'cleaning' || s === 'in progress';

    const category = r.category || (r.type ? r.type.split('(')[0].trim() : 'Single Room');
    const acType = r.ac_type || ((r.type && r.type.includes('Non-A/C')) ? 'Non-A/C' : 'A/C');
    const isAc = acType === 'A/C';

    let borderClass = 'status-border-available';
    let guestInfoHtml = '';
    let footerRightHtml = `
      <button class="btn-action-sm btn-checkin" onclick="openWalkInForRoom('${r.room_number}', ${r.price_per_night || 45})">
        <svg viewBox="0 0 24 24" style="width:14px;height:14px;fill:currentColor;"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
        Book Walk-In
      </button>
    `;

    if (isOccupied) {
      borderClass = 'status-border-occupied';
      const guestName = r.current_guest || (r.booking && r.booking.guest_name) || 'In-House Guest';
      const bookingId = (r.booking && r.booking.booking_id) || '';
      const checkoutDate = r.check_out || (r.booking && r.booking.check_out) || 'N/A';

      guestInfoHtml = `
        <div class="room-guest-info-box" style="margin: 0.5rem 0; padding: 0.5rem; background: rgba(15, 23, 42, 0.6); border-radius: 6px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 3px;">
            <strong style="color: var(--text-white); font-weight:600; font-size: 0.85rem;">${guestName}</strong>
            <span style="font-size: 0.72rem; color: #60a5fa; font-weight: 700;">${bookingId}</span>
          </div>
          <div style="color: var(--text-gray); font-size: 0.75rem; display: flex; align-items: center; gap: 4px;">
            Checkout: <span style="color: var(--text-white); font-weight: 600;">${checkoutDate}</span>
          </div>
        </div>
      `;

      if (bookingId) {
        footerRightHtml = `
          <button class="btn-action-sm btn-checkout" onclick="processCheckOut('${bookingId}', '${guestName.replace(/'/g, "\\'")}')" title="Check Out Guest">
            <svg viewBox="0 0 24 24" style="width:14px;height:14px;fill:currentColor;"><path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zm-2-5H7v-2h10v2z"/></svg>
            Check-Out
          </button>
        `;
      } else {
        footerRightHtml = `<span style="font-size:0.75rem; color:#60a5fa; font-weight:600;">In-House Occupied</span>`;
      }
    } else if (isDirty) {
      borderClass = 'status-border-dirty';
      footerRightHtml = `<span style="font-size:0.75rem; color:var(--pending-text); font-weight:600;">Housekeeping Active</span>`;
    } else if (s !== 'available') {
      borderClass = 'status-border-maintenance';
      footerRightHtml = `<span style="font-size:0.75rem; color:var(--text-muted); font-weight:600;">${r.status}</span>`;
    }

    const card = document.createElement('div');
    card.className = `room-card ${borderClass}`;
    card.style.cssText = "background: #111827; border-radius: 12px; border: 1px solid #1f2937; padding: 1rem; display: flex; flex-direction: column; gap: 0.5rem;";
    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: flex-start;">
        <div>
          <h3 style="font-size: 1.15rem; font-weight: 700; color: #f8fafc; margin: 0;">Room ${r.room_number}</h3>
          <span style="font-size: 0.75rem; color: #94a3b8;">${category} • ${acType}</span>
        </div>
        <span class="badge ${getStatusBadgeClass(r.status)}" style="text-transform: uppercase; font-size: 0.7rem; font-weight: 700; padding: 2px 8px; border-radius: 4px;">${r.status || 'Available'}</span>
      </div>
      ${guestInfoHtml}
      <div style="margin-top: auto; display: flex; justify-content: space-between; align-items: center; pt-2; border-top: 1px solid #1f2937; padding-top: 0.5rem;">
        <span style="font-size: 0.85rem; font-weight: 700; color: #34d399;">Rs. ${parseFloat(r.price_per_night || 45).toFixed(2)}/nt</span>
        ${footerRightHtml}
      </div>
    `;
    container.appendChild(card);
  });
}

/**
 * Open Walk-In Modal prefilled for a specific room from the room grid
 */
function openWalkInForRoom(roomNumber, pricePerNight) {
  openWalkInModal();
  setTimeout(() => {
    const roomSelect = document.getElementById('cw-room-select');
    if (roomSelect && roomNumber) {
      let opt = Array.from(roomSelect.options).find(o => String(o.value) === String(roomNumber));
      if (!opt) {
        const roomObj = (typeof roomGridData !== 'undefined' ? roomGridData : []).find(r => String(r.room_number) === String(roomNumber));
        const rType = (roomObj && (roomObj.room_type || roomObj.category)) || 'Single Room';
        opt = new Option(`Room ${roomNumber} (${rType})`, roomNumber, true, true);
        roomSelect.add(opt);
      }
      roomSelect.value = roomNumber;
      if (typeof updateWalkInBillingUI === 'function') updateWalkInBillingUI();
    }
    const nameInput = document.getElementById('cw-guest-name');
    if (nameInput) nameInput.focus();
  }, 100);
}

/**
 * Open Clean Walk-In Reservation Modal
 */
function openWalkInModal() {
  const modal = document.getElementById('clean-walkin-modal');
  if (modal) {
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
    const nameInput = document.getElementById('cw-guest-name');
    if (nameInput) setTimeout(() => nameInput.focus(), 100);
  }
}

/**
 * Close Clean Walk-In Reservation Modal
 */
function closeWalkInModal() {
  const modal = document.getElementById('clean-walkin-modal');
  if (modal) {
    modal.classList.add('hidden');
    modal.style.display = 'none';
  }
}

/**
 * Close Booking Modal (Alias helper)
 */
function closeBookingModal() {
  closeWalkInModal();
  const resModal = document.getElementById('newReservationModal');
  if (resModal && typeof resModal.close === 'function') {
    try { resModal.close(); } catch (e) {}
  }
}
window.closeBookingModal = closeBookingModal;

/**
 * Open Modal Dialog Helper
 */
function openModal(modalId) {
  if (modalId === 'modal-walkin' || modalId === 'clean-walkin-modal') {
    return openWalkInModal();
  }
  const modal = document.getElementById(modalId);
  if (modal) {
    if (typeof modal.showModal === 'function') {
      try {
        if (!modal.open) modal.showModal();
      } catch (e) {
        modal.show();
      }
    } else {
      modal.style.display = 'flex';
      modal.classList.add('active');
    }
  }
}

/**
 * Close Modal Dialog Helper
 */
function closeModal(modalId) {
  if (modalId === 'modal-walkin' || modalId === 'clean-walkin-modal') {
    return closeWalkInModal();
  }
  if (!modalId) {
    document.querySelectorAll('dialog[open]').forEach(d => {
      if (typeof d.close === 'function') d.close();
      else d.style.display = 'none';
    });
    closeWalkInModal();
    return;
  }
  const modal = document.getElementById(modalId);
  if (modal) {
    if (typeof modal.close === 'function') {
      try {
        if (modal.open) modal.close();
      } catch (e) {
        modal.style.display = 'none';
      }
    } else {
      modal.style.display = 'none';
      modal.classList.remove('active');
    }
  }
}

/**
 * Open New Complaint Modal
 */
function openNewComplaintModal() {
  openModal('newComplaintModal');
}

/**
 * Open New Request Modal
 */
function openNewRequestModal() {
  openModal('newRequestModal');
}

/**
 * Open New Online/Standard Reservation Modal
 */
function openReservationModal() {
  openModal('newReservationModal');
}

/**
 * Update Pill Counts on Bookings tab
 */
function updatePillCounts() {
  const activeCount = allReservationsData.filter(b => {
    const s = (b.status || '').toLowerCase().trim();
    return s === 'confirmed' || s === 'booked' || s === 'checked-in';
  }).length;

  const departedCount = allReservationsData.filter(b => (b.status || '').toLowerCase().trim() === 'checked-out').length;
  const cancelledCount = allReservationsData.filter(b => (b.status || '').toLowerCase().trim() === 'cancelled').length;
  const totalCount = allReservationsData.length;

  const pillAct = document.getElementById('countPillActive');
  const pillDep = document.getElementById('countPillDeparted');
  const pillCan = document.getElementById('countPillCancelled');
  const pillAll = document.getElementById('countPillAll');

  if (pillAct) pillAct.textContent = activeCount;
  if (pillDep) pillDep.textContent = departedCount;
  if (pillCan) pillCan.textContent = cancelledCount;
  if (pillAll) pillAll.textContent = totalCount;
}

/**
 * Select Booking Status Pill ('active', 'checked-out', 'cancelled', 'all')
 */
function selectBookingStatusPill(statusKey) {
  currentBookingStatusFilter = statusKey;

  const pillMap = {
    'active': 'pillActive',
    'checked-out': 'pillDeparted',
    'cancelled': 'pillCancelled',
    'all': 'pillAll'
  };

  Object.values(pillMap).forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.classList.remove('active');
      el.setAttribute('aria-selected', 'false');
    }
  });

  const activePillId = pillMap[statusKey] || 'pillActive';
  const activePillEl = document.getElementById(activePillId);
  if (activePillEl) {
    activePillEl.classList.add('active');
    activePillEl.setAttribute('aria-selected', 'true');
  }

  applyBookingFilter();
}

/**
 * Set Booking Source Tab ('all', 'online', 'walkin')
 */
function setBookingSourceTab(sourceTab) {
  currentBookingSourceTab = sourceTab;

  const tabBtns = ['sourceTabAll', 'sourceTabOnline', 'sourceTabWalkIn'];
  tabBtns.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('active');
  });

  const tabMap = {
    'all': 'sourceTabAll',
    'online': 'sourceTabOnline',
    'walkin': 'sourceTabWalkIn'
  };
  const activeTabEl = document.getElementById(tabMap[sourceTab] || 'sourceTabAll');
  if (activeTabEl) activeTabEl.classList.add('active');

  applyBookingFilter();
}

/**
 * Apply filters to bookings list
 */
function applyBookingFilter() {
  let list = [...allReservationsData];

  // 1. Status Filter
  if (currentBookingStatusFilter === 'active') {
    list = list.filter(b => {
      const s = (b.status || '').toLowerCase().trim();
      return s === 'confirmed' || s === 'booked' || s === 'checked-in';
    });
  } else if (currentBookingStatusFilter === 'checked-out') {
    list = list.filter(b => (b.status || '').toLowerCase().trim() === 'checked-out');
  } else if (currentBookingStatusFilter === 'cancelled') {
    list = list.filter(b => (b.status || '').toLowerCase().trim() === 'cancelled');
  }

  // 2. Source Filter
  const checkIsOnline = (b) => {
    if (typeof window.isOnlineBooking === 'function') return window.isOnlineBooking(b);
    if (!b) return false;
    const bType = String(b.booking_type || '').trim().toLowerCase();
    const bSource = String(b.source || b.booking_source || '').trim().toLowerCase();
    const idPass = String(b.id_passport || '').trim().toLowerCase();
    const room = String(b.room_number || '').trim().toLowerCase();
    if (bType === 'online' || bSource === 'online' || bSource === 'online reservation' || idPass === 'online-guest') return true;
    if (bType.includes('walk') || bSource.includes('walk')) return false;
    if (!room || room === 'unassigned' || room === 'null' || room === 'undefined') return true;
    return true;
  };

  if (currentBookingSourceTab === 'online') {
    list = list.filter(b => checkIsOnline(b));
  } else if (currentBookingSourceTab === 'walkin') {
    list = list.filter(b => !checkIsOnline(b));
  }

  // 3. Search query filter
  const searchInput = document.getElementById('searchGuestInput') || document.getElementById('searchQuery');
  if (searchInput && searchInput.value.trim()) {
    const q = searchInput.value.trim().toLowerCase();
    list = list.filter(b => 
      (b.guest_name && b.guest_name.toLowerCase().includes(q)) ||
      (b.booking_id && String(b.booking_id).toLowerCase().includes(q)) ||
      (b.room_number && String(b.room_number).toLowerCase().includes(q)) ||
      (b.phone && b.phone.toLowerCase().includes(q))
    );
  }

  renderBookingsTable(list);
}

/**
 * Render Bookings Table Rows
 */
function renderBookingsTable(bookings = []) {
  const tbody = document.getElementById('reservationsTableBody') || document.getElementById('bookingsTableBody');
  const emptyEl = document.getElementById('bookingsEmptyState');
  if (!tbody) return;

  tbody.innerHTML = '';

  if (bookings.length === 0) {
    if (emptyEl) emptyEl.style.display = 'block';
    return;
  }
  if (emptyEl) emptyEl.style.display = 'none';

  bookings.forEach(b => {
    const tr = document.createElement('tr');
    const s = (b.status || 'Confirmed').toLowerCase();
    const isCheckedIn = s === 'checked-in';
    const isCheckedOut = s === 'checked-out';
    const isCancelled = s === 'cancelled';
    const isUnassigned = !b.room_number || b.room_number === 'Unassigned' || String(b.room_number).toLowerCase() === 'unassigned' || b.room_number === 'null';

    let statusBadge = `<span class="badge badge-paid" style="padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 700; background: rgba(52, 211, 153, 0.15); color: #34d399;">Confirmed</span>`;
    if (isCheckedIn) {
      statusBadge = `<span class="badge badge-urgent" style="padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 700; background: rgba(245, 158, 11, 0.15); color: #fbbf24;">Checked-In</span>`;
    } else if (isCheckedOut) {
      statusBadge = `<span class="badge badge-pending" style="padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 700; background: rgba(148, 163, 184, 0.15); color: #94a3b8;">Checked-Out</span>`;
    } else if (isCancelled) {
      statusBadge = `<span class="badge badge-cancelled" style="padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 700; background: rgba(244, 63, 94, 0.15); color: #fb7185;">Cancelled</span>`;
    }

    let actionButtons = '';
    const safeGuest = (b.guest_name || 'Guest').replace(/'/g, "\\'");

    if (isCheckedIn) {
      actionButtons += `
        <button class="btn-action-sm btn-checkout" onclick="processCheckOut('${b.booking_id}', '${safeGuest}')" title="Check Out Guest" style="padding: 4px 8px; font-size: 0.75rem; background: #0284c7; color: #fff; border-radius: 4px; border: none; cursor: pointer;">
          Check-Out
        </button>
      `;
    } else if (!isCheckedOut && !isCancelled) {
      if (isUnassigned) {
        actionButtons += `
          <button class="btn-action-sm btn-assign" onclick="openAssignRoomModal('${b.booking_id}', '${b.room_type || b.category || 'Single Room'}')" title="Assign Room" style="padding: 4px 8px; font-size: 0.75rem; background: #d97706; color: #fff; border-radius: 4px; border: none; cursor: pointer;">
            Assign Room
          </button>
        `;
      } else {
        actionButtons += `
          <button class="btn-action-sm btn-checkin" onclick="processCheckIn('${b.booking_id}', '${safeGuest}')" title="Check In Guest" style="padding: 4px 8px; font-size: 0.75rem; background: #059669; color: #fff; border-radius: 4px; border: none; cursor: pointer;">
            Check-In
          </button>
        `;
      }
    }

    actionButtons += `
      <button class="btn-action-sm btn-edit" onclick="openEditBookingModal('${b.booking_id}')" title="Edit Booking" style="padding: 4px 8px; font-size: 0.75rem; background: #334155; color: #cbd5e1; border-radius: 4px; border: none; cursor: pointer; margin-left: 4px;">
        Edit
      </button>
    `;

    if (!isCheckedOut && !isCancelled) {
      actionButtons += `
        <button class="btn-action-sm btn-cancel" onclick="cancelBooking('${b.booking_id}', '${b.room_number || ''}')" title="Cancel Booking" style="padding: 4px 8px; font-size: 0.75rem; background: rgba(244, 63, 94, 0.2); color: #fb7185; border-radius: 4px; border: 1px solid rgba(244, 63, 94, 0.3); cursor: pointer; margin-left: 4px;">
          Cancel
        </button>
      `;
    } else {
      actionButtons += `
        <button class="btn-action-sm btn-delete" onclick="deleteBooking('${b.booking_id}', '${b.room_number || ''}')" title="Delete Record" style="padding: 4px 8px; font-size: 0.75rem; background: rgba(244, 63, 94, 0.2); color: #fb7185; border-radius: 4px; border: 1px solid rgba(244, 63, 94, 0.3); cursor: pointer; margin-left: 4px;">
          Delete
        </button>
      `;
    }

    const roomDisplay = isUnassigned 
      ? `<span style="color: #f59e0b; font-weight: 600; font-size: 0.8rem;">⚠️ Unassigned</span>` 
      : `<span style="color: #f8fafc; font-weight: 600;">Room ${b.room_number}</span>`;

    tr.innerHTML = `
      <td style="padding: 0.75rem; border-bottom: 1px solid #1e293b; font-weight: 700; color: #60a5fa;">${b.booking_id}</td>
      <td style="padding: 0.75rem; border-bottom: 1px solid #1e293b; font-weight: 600; color: #f8fafc;">${b.guest_name || 'Guest'}</td>
      <td style="padding: 0.75rem; border-bottom: 1px solid #1e293b;">${roomDisplay}</td>
      <td style="padding: 0.75rem; border-bottom: 1px solid #1e293b; color: #cbd5e1; font-size: 0.85rem;">${b.check_in || 'N/A'}</td>
      <td style="padding: 0.75rem; border-bottom: 1px solid #1e293b; color: #cbd5e1; font-size: 0.85rem;">${b.check_out || 'N/A'}</td>
      <td style="padding: 0.75rem; border-bottom: 1px solid #1e293b; font-weight: 600; color: #34d399;">Rs. ${parseFloat(b.total_amount || 0).toFixed(2)}</td>
      <td style="padding: 0.75rem; border-bottom: 1px solid #1e293b;">${statusBadge}</td>
      <td style="padding: 0.75rem; border-bottom: 1px solid #1e293b; text-align: right; white-space: nowrap;">${actionButtons}</td>
    `;
    tbody.appendChild(tr);
  });
}

/**
 * Update Bookings Tab KPIs
 */
function updateBookingsKPIs() {
  const kpiTotal = document.getElementById('kpiTotalBookings');
  const kpiIn = document.getElementById('kpiCheckIns');
  const kpiOut = document.getElementById('kpiCheckOuts');
  const kpiRev = document.getElementById('kpiActiveRevenue');

  const todayStr = new Date().toISOString().split('T')[0];

  const total = allReservationsData.length;
  const todayCheckIns = allReservationsData.filter(b => b.check_in && b.check_in.startsWith(todayStr)).length;
  const todayCheckOuts = allReservationsData.filter(b => b.check_out && b.check_out.startsWith(todayStr)).length;
  const revenue = allReservationsData.reduce((acc, b) => acc + (parseFloat(b.total_amount) || 0), 0);

  if (kpiTotal) kpiTotal.textContent = `${total} Bookings`;
  if (kpiIn) kpiIn.textContent = `${todayCheckIns} Today`;
  if (kpiOut) kpiOut.textContent = `${todayCheckOuts} Today`;
  if (kpiRev) kpiRev.textContent = `Rs. ${revenue.toFixed(2)}`;
}

/**
 * Check-In Guest Handler
 */
function processCheckIn(bookingId, guestName) {
  const b = allReservationsData.find(x => String(x.booking_id) === String(bookingId) || String(x.id) === String(bookingId)) || {};
  const isUnassigned = !b.room_number || b.room_number === 'Unassigned' || String(b.room_number).toLowerCase() === 'unassigned' || b.room_number === 'null';
  
  if (isUnassigned) {
    showToast(`Please allocate a room for ${guestName || 'guest'} before check-in.`, 'warning');
    openAssignRoomModal(bookingId, b.room_type || b.category || 'Single Room');
    return;
  }

  if (typeof confirm === 'function' && !confirm(`Check in ${guestName || 'guest'} into Room ${b.room_number}?`)) {
    return;
  }

  fetch(`${RECEPTION_API_BASE}/api/reception/bookings/${bookingId}/checkin`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'Checked-In' })
  })
  .then(res => res.json())
  .then(data => {
    if (data.success) {
      showToast(`Guest ${guestName || ''} checked in successfully. Room ${b.room_number} set to Occupied.`, 'success');
      fetchBookings();
      fetchRoomGrid();
      fetchDashboardCounters();
    } else {
      showToast(data.message || 'Check-in failed', 'error');
    }
  })
  .catch(err => {
    console.error('Check-in error:', err);
    showToast('Network error during check-in', 'error');
  });
}

function handleCheckIn(bookingId) {
  const b = allReservationsData.find(x => String(x.booking_id) === String(bookingId)) || {};
  processCheckIn(bookingId, b.guest_name || 'Guest');
}

/**
 * Check-Out Guest Handler
 */
function processCheckOut(bookingId, guestName) {
  if (typeof confirm === 'function' && !confirm(`Complete check-out for ${guestName || 'guest'}?`)) {
    return;
  }

  fetch(`${RECEPTION_API_BASE}/api/reception/bookings/${bookingId}/checkout`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'Checked-Out' })
  })
  .then(res => res.json())
  .then(data => {
    if (data.success) {
      showToast(`Guest ${guestName || ''} checked out. Room marked Dirty for Housekeeping.`, 'success');
      fetchBookings();
      fetchRoomGrid();
      fetchDashboardCounters();
    } else {
      showToast(data.message || 'Check-out failed', 'error');
    }
  })
  .catch(err => {
    console.error('Check-out error:', err);
    showToast('Network error during check-out', 'error');
  });
}

function handleCheckOut(bookingId) {
  const b = allReservationsData.find(x => String(x.booking_id) === String(bookingId)) || {};
  processCheckOut(bookingId, b.guest_name || 'Guest');
}

function processCheckout(bookingId, guestName) {
  processCheckOut(bookingId, guestName);
}

/**
 * Cancel Booking Handler
 */
function cancelBooking(bookingId, roomNumber) {
  const roomMsg = roomNumber ? ` and free Room ${roomNumber} back to Available` : '';
  if (typeof confirm === 'function' && !confirm(`Are you sure you want to cancel booking ${bookingId}${roomMsg}?`)) {
    return;
  }

  fetch(`${RECEPTION_API_BASE}/api/reception/bookings/${bookingId}/cancel`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'Cancelled', room_number: roomNumber })
  })
  .then(res => res.json())
  .then(data => {
    if (data.success) {
      showToast(`Booking ${bookingId} cancelled successfully.`, 'success');
      fetchBookings();
      fetchRoomGrid();
      fetchDashboardCounters();
    } else {
      showToast(data.message || 'Failed to cancel reservation.', 'error');
    }
  })
  .catch(err => {
    console.error('Cancel booking error:', err);
    showToast('Network error while cancelling reservation.', 'error');
  });
}

/**
 * Delete Booking Handler
 */
function deleteBooking(bookingId, roomNumber) {
  const roomMsg = roomNumber ? ` and set Room ${roomNumber} to Available` : '';
  if (typeof confirm === 'function' && !confirm(`Are you sure you want to permanently delete booking ${bookingId}? This cannot be undone${roomMsg}.`)) {
    return;
  }

  fetch(`${RECEPTION_API_BASE}/api/reception/bookings/${bookingId}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' }
  })
  .then(res => res.json())
  .then(data => {
    if (data.success) {
      showToast(`Booking ${bookingId} permanently deleted.`, 'success');
      fetchBookings();
      fetchRoomGrid();
      fetchDashboardCounters();
    } else {
      showToast(data.message || 'Failed to delete reservation.', 'error');
    }
  })
  .catch(err => {
    console.error('Delete booking error:', err);
    showToast('Network error while deleting reservation.', 'error');
  });
}

/**
 * Open Assign Room Modal
 */
function openAssignRoomModal(bookingId, roomType) {
  const modal = document.getElementById('assignRoomModal');
  const targetBookingEl = document.getElementById('assignModalBookingId') || document.getElementById('assignBookingIdDisplay');
  const targetTypeEl = document.getElementById('assignModalRoomType') || document.getElementById('assignRoomTypeBadge');
  const roomSelect = document.getElementById('assignModalRoomSelect') || document.getElementById('assignRoomSelect');
  const hiddenId = document.getElementById('assignBookingIdHidden') || document.getElementById('assignBookingId');

  if (targetBookingEl) targetBookingEl.textContent = bookingId;
  if (targetTypeEl) targetTypeEl.textContent = roomType || 'Single Room';
  if (hiddenId) hiddenId.value = bookingId;

  if (roomSelect) {
    roomSelect.innerHTML = '<option value="">Loading available rooms...</option>';
    fetch(`${RECEPTION_API_BASE}/api/reception/rooms/available?category=${encodeURIComponent(roomType || '')}`)
      .then(res => res.json())
      .then(data => {
        const rooms = data.rooms || data.data || (Array.isArray(data) ? data : []);
        if (rooms.length > 0) {
          roomSelect.innerHTML = rooms.map(r => {
            let rawPrice = parseFloat(r.price_per_night || r.rate_per_night || r.price || 0);
            if (rawPrice < 500 && rawPrice > 0) rawPrice = rawPrice * 500;
            if (rawPrice <= 0) rawPrice = 25000;
            const priceFormatted = Number(rawPrice).toLocaleString('en-LK', { minimumFractionDigits: 2 });
            return `<option value="${r.room_number}">Room ${r.room_number} (${r.room_type || r.category || 'Standard'}) - Rs. ${priceFormatted}/night</option>`;
          }).join('');
        } else {
          roomSelect.innerHTML = '<option value="101">Room 101 (Single Room) - Rs. 15,000.00/night</option><option value="102">Room 102 (Single Room) - Rs. 15,000.00/night</option>';
        }
      })
      .catch(() => {
        roomSelect.innerHTML = '<option value="101">Room 101 (Single Room) - Rs. 15,000.00/night</option><option value="102">Room 102 (Single Room) - Rs. 15,000.00/night</option>';
      });
  }

  openModal('assignRoomModal');
}

/**
 * Confirm Room Allocation
 */
function handleConfirmRoomAllocation(e) {
  if (e && e.preventDefault) e.preventDefault();
  const bookingId = document.getElementById('assignBookingId')?.value 
                 || document.getElementById('assignBookingIdHidden')?.value;
  const roomNumber = document.getElementById('assignRoomSelect')?.value 
                  || document.getElementById('assignModalRoomSelect')?.value;

  if (!bookingId || !roomNumber) {
    showToast('Please select a valid room to allocate.', 'warning');
    return;
  }

  assignRoom(bookingId, roomNumber);
}

/**
 * Assign Room API call
 */
function assignRoom(bookingId, roomNumber) {
  const btn = document.getElementById('btnConfirmAllocation') || document.getElementById('btnConfirmAssignRoom');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span>Allocating...</span>';
  }

  return fetch(`${RECEPTION_API_BASE}/api/reception/assign-room`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ booking_id: bookingId, room_number: roomNumber })
  })
  .then(res => res.json())
  .then(data => {
    if (data.success) {
      showToast(`Room ${roomNumber} assigned successfully to booking ${bookingId}`, 'success');
      closeModal('assignRoomModal');
      if (typeof fetchBookings === 'function') fetchBookings();
      if (typeof fetchRoomGrid === 'function') fetchRoomGrid();
      if (typeof fetchRooms === 'function') fetchRooms();
      if (typeof fetchDashboardCounters === 'function') fetchDashboardCounters();
    } else {
      showToast(data.message || 'Room allocation failed', 'error');
    }
    return data;
  })
  .catch(err => {
    console.error('Room allocation error:', err);
    showToast('Network error during room allocation', 'error');
  })
  .finally(() => {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<span>Confirm Allocation</span>';
    }
  });
}

/**
 * Open Edit Booking Modal
 */
async function openEditBookingModal(bookingId) {
  const bList = (typeof allReservationsData !== 'undefined' && allReservationsData.length > 0) 
    ? allReservationsData 
    : (typeof reservationsData !== 'undefined' ? reservationsData : []);
  const b = (typeof bookingId === 'object' && bookingId !== null)
    ? bookingId
    : (bList.find(x => String(x.booking_id) === String(bookingId) || String(x.id) === String(bookingId)) || {});

  if (!b || (!b.booking_id && !b.id)) {
    showToast('Booking record not found', 'warning');
    return;
  }

  const idEl = document.getElementById('editBookingId');
  const nameEl = document.getElementById('editGuestName');
  const phoneEl = document.getElementById('editGuestPhone');
  const emailEl = document.getElementById('editGuestEmail');
  const inEl = document.getElementById('editCheckIn');
  const outEl = document.getElementById('editCheckOut');
  const statusEl = document.getElementById('editBookingStatus');
  const roomSelect = document.getElementById('editRoomSelect') || document.getElementById('editAssignedRoom') || document.querySelector('select[name="assigned_room"]');

  if (idEl) idEl.value = b.booking_id || b.id;
  if (nameEl) nameEl.value = b.guest_name || '';
  if (phoneEl) phoneEl.value = b.phone || b.guest_phone || '';
  if (emailEl) emailEl.value = b.guest_email || b.email || '';
  if (inEl) inEl.value = (b.check_in || '').split('T')[0];
  if (outEl) outEl.value = (b.check_out || '').split('T')[0];
  if (statusEl) statusEl.value = b.status || 'Confirmed';

  const currentRoom = b.room_number || b.room_no || b.room || b.assigned_room;

  if (roomSelect) {
    roomSelect.innerHTML = '<option value="">Loading rooms inventory...</option>';
    let rooms = [];
    try {
      const res = await fetch(`${RECEPTION_API_BASE}/api/reception/rooms`);
      const data = await res.json();
      rooms = Array.isArray(data) ? data : (data.rooms || data.data || []);
    } catch (e) {
      try {
        const res2 = await fetch(`${RECEPTION_API_BASE}/api/rooms`);
        const data2 = await res2.json();
        rooms = Array.isArray(data2) ? data2 : (data2.rooms || data2.data || []);
      } catch (e2) {
        console.warn('Could not fetch rooms list:', e2);
      }
    }

    roomSelect.innerHTML = '';
    const defaultOpt = document.createElement('option');
    defaultOpt.value = '';
    defaultOpt.textContent = '-- Select Room --';
    roomSelect.appendChild(defaultOpt);

    const normCurrent = currentRoom ? String(currentRoom).trim() : '';
    let currentFound = false;

    if (Array.isArray(rooms) && rooms.length > 0) {
      rooms.forEach(r => {
        const roomNum = String(r.room_number || r.room_no || r.room || '').trim();
        if (!roomNum) return;
        if (normCurrent && roomNum.toLowerCase() === normCurrent.toLowerCase()) {
          currentFound = true;
        }
        const roomType = r.type || r.room_type || r.category || 'Standard';
        const opt = document.createElement('option');
        opt.value = roomNum;
        opt.textContent = `Room ${roomNum} (${roomType})`;
        roomSelect.appendChild(opt);
      });
    }

    if (normCurrent && !currentFound && normCurrent.toLowerCase() !== 'unassigned' && normCurrent.toLowerCase() !== 'null') {
      const opt = document.createElement('option');
      opt.value = normCurrent;
      opt.textContent = `Room ${normCurrent} (Currently Assigned)`;
      roomSelect.appendChild(opt);
    }

    if (normCurrent && normCurrent.toLowerCase() !== 'unassigned' && normCurrent.toLowerCase() !== 'null') {
      roomSelect.value = normCurrent;
    } else {
      roomSelect.value = '';
    }
  }

  openModal('editBookingModal');
}

/**
 * Handle Update Booking Form Submit
 */
function handleUpdateBooking(event) {
  if (event && event.preventDefault) event.preventDefault();

  const bookingId = document.getElementById('editBookingId')?.value;
  const guest_name = document.getElementById('editGuestName')?.value.trim();
  const guest_phone = document.getElementById('editGuestPhone')?.value.trim();
  const guest_email = document.getElementById('editGuestEmail')?.value.trim();
  const check_in = document.getElementById('editCheckIn')?.value;
  const check_out = document.getElementById('editCheckOut')?.value;
  const status = document.getElementById('editBookingStatus')?.value;

  if (!bookingId || !guest_name) {
    showToast('Guest name and booking ID are required.', 'warning');
    return;
  }

  fetch(`${RECEPTION_API_BASE}/api/reception/bookings/${bookingId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      guest_name,
      guest_phone,
      guest_email,
      check_in,
      check_out,
      status
    })
  })
  .then(res => res.json())
  .then(data => {
    if (data.success) {
      showToast('Booking updated successfully!', 'success');
      closeModal('editBookingModal');
      fetchBookings();
      fetchDashboardCounters();
    } else {
      showToast(data.message || 'Failed to update booking', 'error');
    }
  })
  .catch(err => {
    console.error('Update booking error:', err);
    showToast('Network error updating booking', 'error');
  });
}

/**
 * Reset Booking Filters
 */
function resetBookingFilters() {
  const searchInput = document.getElementById('searchGuestInput') || document.getElementById('searchQuery');
  if (searchInput) searchInput.value = '';
  selectBookingStatusPill('active');
  setBookingSourceTab('all');
}

/**
 * Fetch Complaints
 */
function fetchComplaints(filters = {}) {
  const url = new URL(`${RECEPTION_API_BASE}/api/reception/complaints`, (typeof window !== 'undefined' && window.location ? window.location.origin : 'http://localhost:3000'));
  if (filters.status && filters.status !== 'All') url.searchParams.append('status', filters.status);
  if (filters.category && filters.category !== 'All') url.searchParams.append('category', filters.category);
  if (filters.priority && filters.priority !== 'All') url.searchParams.append('priority', filters.priority);

  return fetch(url.toString())
    .then(res => res.json())
    .then(data => {
      complaintsData = Array.isArray(data) ? data : (data.complaints || data.data || []);
      renderComplaintsTable(complaintsData);
      return complaintsData;
    })
    .catch(err => {
      console.warn('Fetch complaints non-fatal error:', err);
      showToast('Could not refresh complaints list', 'warning');
      return [];
    });
}

function renderComplaintsTable(list = []) {
  const tbody = document.getElementById('complaintsTableBody');
  if (!tbody) return;

  tbody.innerHTML = '';
  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 2rem; color: #94a3b8;">No complaints found.</td></tr>`;
    return;
  }

  list.forEach(c => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="padding: 0.75rem; border-bottom: 1px solid #1e293b; font-weight: 700; color: #60a5fa;">#${c.complaint_id}</td>
      <td style="padding: 0.75rem; border-bottom: 1px solid #1e293b; font-weight: 600; color: #f8fafc;">Room ${c.room_number}</td>
      <td style="padding: 0.75rem; border-bottom: 1px solid #1e293b; color: #cbd5e1;">${c.guest_name || 'Guest'}</td>
      <td style="padding: 0.75rem; border-bottom: 1px solid #1e293b; color: #cbd5e1;">${c.category || c.request_type || 'General'}</td>
      <td style="padding: 0.75rem; border-bottom: 1px solid #1e293b; color: #94a3b8; font-size: 0.85rem;">${c.description || ''}</td>
      <td style="padding: 0.75rem; border-bottom: 1px solid #1e293b;"><span class="badge" style="padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; font-weight: 700; background: rgba(245, 158, 11, 0.2); color: #fbbf24;">${c.status || 'Pending'}</span></td>
      <td style="padding: 0.75rem; border-bottom: 1px solid #1e293b; text-align: right;">
        <button onclick="updateComplaintStatus(${c.complaint_id}, 'Resolved')" style="padding: 4px 8px; font-size: 0.75rem; background: #059669; color: #fff; border-radius: 4px; border: none; cursor: pointer;">Resolve</button>
        <button onclick="deleteComplaint(${c.complaint_id})" style="padding: 4px 8px; font-size: 0.75rem; background: rgba(244, 63, 94, 0.2); color: #fb7185; border-radius: 4px; border: none; cursor: pointer; margin-left: 4px;">Delete</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

/**
 * Handle Create Complaint Submit
 */
function handleCreateComplaintSubmit(e) {
  if (e && e.preventDefault) e.preventDefault();

  const room_number = document.getElementById('compRoom')?.value.trim();
  const guest_name = document.getElementById('compGuest')?.value.trim();
  const category = document.getElementById('compCategory')?.value || 'Cleanliness';
  const priority = document.getElementById('compPriority')?.value || 'Medium';
  const description = document.getElementById('compDescription')?.value.trim();

  if (!room_number || !guest_name || !description) {
    showToast('Room, guest name, and description are required', 'warning');
    return;
  }

  fetch(`${RECEPTION_API_BASE}/api/reception/complaints`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ room_number, guest_name, category, priority, description, status: 'Pending' })
  })
  .then(res => res.json())
  .then(data => {
    if (data.success) {
      showToast('Complaint logged and dispatched!', 'success');
      closeModal('newComplaintModal');
      const form = document.getElementById('newComplaintForm');
      if (form) form.reset();
      fetchComplaints();
      fetchDashboardCounters();
    } else {
      showToast(data.message || 'Failed to log complaint', 'error');
    }
  })
  .catch(err => {
    console.error('Log complaint error:', err);
    showToast('Network error logging complaint', 'error');
  });
}

function updateComplaintStatus(id, status) {
  fetch(`${RECEPTION_API_BASE}/api/reception/complaints/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status })
  })
  .then(res => res.json())
  .then(data => {
    if (data.success) {
      showToast(`Complaint #${id} marked as ${status}`, 'success');
      fetchComplaints();
      fetchDashboardCounters();
    }
  })
  .catch(err => {
    console.error('Update complaint error:', err);
    showToast('Error updating complaint', 'error');
  });
}

function deleteComplaint(id) {
  if (typeof confirm === 'function' && !confirm(`Delete complaint #${id}?`)) return;
  fetch(`${RECEPTION_API_BASE}/api/reception/complaints/${id}`, { method: 'DELETE' })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        showToast('Complaint deleted', 'success');
        fetchComplaints();
        fetchDashboardCounters();
      }
    })
    .catch(err => {
      console.error('Delete complaint error:', err);
      showToast('Error deleting complaint', 'error');
    });
}

function resetComplaintFilters() {
  fetchComplaints();
}

/**
 * Fetch Special Requests
 */
function fetchSpecialRequests(filters = {}) {
  const url = new URL(`${RECEPTION_API_BASE}/api/reception/special-requests`, (typeof window !== 'undefined' && window.location ? window.location.origin : 'http://localhost:3000'));
  if (filters.status && filters.status !== 'All') url.searchParams.append('status', filters.status);

  return fetch(url.toString())
    .then(res => res.json())
    .then(data => {
      requestsData = Array.isArray(data) ? data : (data.requests || data.data || []);
      renderRequestsTable(requestsData);
      return requestsData;
    })
    .catch(err => {
      console.warn('Fetch special requests non-fatal error:', err);
      showToast('Could not refresh special requests list', 'warning');
      return [];
    });
}

function renderRequestsTable(list = []) {
  const tbody = document.getElementById('requestsTableBody');
  if (!tbody) return;

  tbody.innerHTML = '';
  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 2rem; color: #94a3b8;">No special requests found.</td></tr>`;
    return;
  }

  list.forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="padding: 0.75rem; border-bottom: 1px solid #1e293b; font-weight: 700; color: #60a5fa;">#${r.request_id}</td>
      <td style="padding: 0.75rem; border-bottom: 1px solid #1e293b; font-weight: 600; color: #f8fafc;">Room ${r.room_number}</td>
      <td style="padding: 0.75rem; border-bottom: 1px solid #1e293b; color: #cbd5e1;">${r.guest_name || 'Guest'}</td>
      <td style="padding: 0.75rem; border-bottom: 1px solid #1e293b; color: #cbd5e1;">${r.request_type || 'General'}</td>
      <td style="padding: 0.75rem; border-bottom: 1px solid #1e293b; color: #94a3b8; font-size: 0.85rem;">${r.description || ''}</td>
      <td style="padding: 0.75rem; border-bottom: 1px solid #1e293b;"><span class="badge" style="padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; font-weight: 700; background: rgba(52, 211, 153, 0.2); color: #34d399;">${r.status || 'Pending'}</span></td>
      <td style="padding: 0.75rem; border-bottom: 1px solid #1e293b; text-align: right;">
        <button onclick="quickCompleteRequest(${r.request_id})" style="padding: 4px 8px; font-size: 0.75rem; background: #059669; color: #fff; border-radius: 4px; border: none; cursor: pointer;">Complete</button>
        <button onclick="deleteSpecialRequest(${r.request_id})" style="padding: 4px 8px; font-size: 0.75rem; background: rgba(244, 63, 94, 0.2); color: #fb7185; border-radius: 4px; border: none; cursor: pointer; margin-left: 4px;">Delete</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function quickCompleteRequest(id) {
  updateSpecialRequestStatus(id, 'Completed');
}

function updateSpecialRequestStatus(id, status) {
  fetch(`${RECEPTION_API_BASE}/api/reception/special-requests/${id}/status`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status })
  })
  .then(res => res.json())
  .then(data => {
    if (data.success) {
      showToast(`Request #${id} marked as ${status}`, 'success');
      fetchSpecialRequests();
      fetchDashboardCounters();
    }
  })
  .catch(err => {
    console.error('Update request error:', err);
    showToast('Error updating request', 'error');
  });
}

function deleteSpecialRequest(id) {
  if (typeof confirm === 'function' && !confirm(`Delete special request #${id}?`)) return;
  fetch(`${RECEPTION_API_BASE}/api/reception/special-requests/${id}`, { method: 'DELETE' })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        showToast('Special request deleted', 'success');
        fetchSpecialRequests();
        fetchDashboardCounters();
      }
    })
    .catch(err => {
      console.error('Delete request error:', err);
      showToast('Error deleting request', 'error');
    });
}

function resetRequestFilters() {
  fetchSpecialRequests();
}

/**
 * Fetch Dashboard Counters for Navigation Badges
 */
function fetchDashboardCounters() {
  return fetch(`${RECEPTION_API_BASE}/api/reception/dashboard-counters`)
    .then(res => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then(data => {
      if (data && (data.success || data.counts)) {
        const counts = data.counts || data;
        const totalActive = counts.total_active_bookings ?? 0;
        const openComplaints = counts.open_complaints ?? 0;
        const pendingRequests = counts.pending_requests ?? 0;
        const availableRooms = counts.available_rooms ?? 0;

        if (typeof document !== 'undefined') {
          const bBookings = document.getElementById('badgeBookingsCount');
          const bComplaints = document.getElementById('badgeComplaintsCount');
          const bRequests = document.getElementById('badgeRequestsCount');
          const bRooms = document.getElementById('badgeRoomsAvailable');

          if (bBookings) bBookings.textContent = totalActive;
          if (bComplaints) bComplaints.textContent = openComplaints;
          if (bRequests) bRequests.textContent = pendingRequests;
          if (bRooms) bRooms.textContent = `${availableRooms} Avail`;
        }
      }
      return data;
    })
    .catch(err => {
      console.warn('Dashboard counters non-fatal error:', err);
      return {};
    });
}

/**
 * Reports and Summary Handlers
 */
function getReportFilterValues() {
  const start = document.getElementById('reportStartDate')?.value || '';
  const end = document.getElementById('reportEndDate')?.value || '';
  const category = document.getElementById('reportCategoryFilter')?.value || 'All';
  const payment = document.getElementById('reportPaymentStatus')?.value || 'All';
  return { start_date: start, end_date: end, category, payment_status: payment };
}

function syncReportDatePreset(preset) {
  const startInput = document.getElementById('reportStartDate');
  const endInput = document.getElementById('reportEndDate');
  const todayStr = new Date().toISOString().split('T')[0];

  if (preset === 'All Time' || preset === 'All' || !preset) {
    if (startInput) startInput.value = '';
    if (endInput) endInput.value = '';
  } else if (preset === 'Today') {
    if (startInput) startInput.value = todayStr;
    if (endInput) endInput.value = todayStr;
  } else if (preset === 'This Week' || preset === 'Week') {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    if (startInput) startInput.value = d.toISOString().split('T')[0];
    if (endInput) endInput.value = todayStr;
  } else if (preset === 'This Month' || preset === 'Month') {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    if (startInput) startInput.value = d.toISOString().split('T')[0];
    if (endInput) endInput.value = todayStr;
  }
}

function fetchReportsSummary(filterParams) {
  const params = filterParams || getReportFilterValues();
  const url = new URL(`${RECEPTION_API_BASE}/api/reception/reports/summary`, (typeof window !== 'undefined' && window.location ? window.location.origin : 'http://localhost:3000'));
  if (params.start_date || params.startDate) url.searchParams.append('start_date', params.start_date || params.startDate);
  if (params.end_date || params.endDate) url.searchParams.append('end_date', params.end_date || params.endDate);
  if (params.category && params.category !== 'All' && params.category !== 'All Categories') url.searchParams.append('category', params.category);
  if (params.payment_status && params.payment_status !== 'All') url.searchParams.append('payment_status', params.payment_status);

  return fetch(url.toString())
    .then(res => res.json())
    .then(data => {
      const bookingsList = data.bookings || data.reservations || (Array.isArray(data) ? data : []);
      reportsData = bookingsList;
      reportsSummary = data.summary || {};
      updateReportKPIs(reportsSummary);
      renderReportsTable(reportsData);
      return data;
    })
    .catch(err => {
      console.warn('Reports summary non-fatal error:', err);
      showToast('Could not load reports summary', 'warning');
      return { bookings: [], summary: {} };
    });
}

function loadReportsData(customFilters) {
  return fetchReportsSummary(customFilters);
}

function updateReportKPIs(summary = {}) {
  const totalRev = summary.total_revenue ?? 0;
  const totalBookings = summary.total_bookings ?? 0;
  const totalCheckIns = summary.total_checkins ?? 0;
  const occupancy = summary.occupancy_rate ?? 0;

  const elRev = document.getElementById('metricTotalRevenue');
  const elBookings = document.getElementById('metricTotalBookings');
  const elCheckIns = document.getElementById('metricTotalCheckIns');
  const elOcc = document.getElementById('metricOccupancyRate');

  if (elRev) elRev.textContent = `Rs. ${parseFloat(totalRev).toFixed(2)}`;
  if (elBookings) elBookings.textContent = totalBookings;
  if (elCheckIns) elCheckIns.textContent = totalCheckIns;
  if (elOcc) elOcc.textContent = `${occupancy}%`;
}

function renderReportsTable(bookings = []) {
  const tbody = document.getElementById('reportTableBody');
  if (!tbody) return;

  tbody.innerHTML = '';
  if (bookings.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 2rem; color: #94a3b8;">No bookings found for this report period.</td></tr>`;
    return;
  }

  bookings.forEach(b => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="padding: 0.75rem; border-bottom: 1px solid #1e293b; font-weight: 700; color: #60a5fa;">${b.booking_id}</td>
      <td style="padding: 0.75rem; border-bottom: 1px solid #1e293b; font-weight: 600; color: #f8fafc;">${b.guest_name}</td>
      <td style="padding: 0.75rem; border-bottom: 1px solid #1e293b;">Room ${b.room_number || 'Unassigned'}</td>
      <td style="padding: 0.75rem; border-bottom: 1px solid #1e293b; color: #cbd5e1;">${b.check_in}</td>
      <td style="padding: 0.75rem; border-bottom: 1px solid #1e293b; color: #cbd5e1;">${b.check_out}</td>
      <td style="padding: 0.75rem; border-bottom: 1px solid #1e293b; font-weight: 600; color: #34d399;">Rs. ${parseFloat(b.total_amount || 0).toFixed(2)}</td>
      <td style="padding: 0.75rem; border-bottom: 1px solid #1e293b;"><span class="badge badge-paid" style="padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; font-weight: 700; background: rgba(52, 211, 153, 0.2); color: #34d399;">${b.status || 'Confirmed'}</span></td>
    `;
    tbody.appendChild(tr);
  });
}

function handleReportFilter() {
  fetchReportsSummary();
}

function resetReportFilters() {
  syncReportDatePreset('Today');
  const cat = document.getElementById('reportCategoryFilter');
  const pay = document.getElementById('reportPaymentStatus');
  if (cat) cat.value = 'All';
  if (pay) pay.value = 'All';
  fetchReportsSummary();
}

function printReport() {
  if (typeof window !== 'undefined' && typeof window.print === 'function') {
    window.print();
  }
}

/**
 * Tab Navigation Controller (Modular)
 */
function switchReceptionTab(tabName) {
  if (typeof document === 'undefined') return;

  // Hide all view panels
  const tabs = document.querySelectorAll('.dashboard-tab-content, .module-view, #overview-view, #dining-module-view, .tab-view');
  tabs.forEach(t => {
    t.style.display = 'none';
    t.classList.remove('active');
  });

  // De-activate all sidebar module buttons
  document.querySelectorAll('.nav-module-btn, .sidebar button, .sidebar-nav-btn').forEach(b => {
    b.classList.remove('active');
    b.style.background = 'transparent';
    b.style.color = '#9ca3af';
  });

  if (tabName === 'dining-module' || tabName === 'dining') {
    const diningView = document.getElementById('dining-module-view');
    const diningBtn = document.getElementById('modBtnDining');
    if (diningView) {
      diningView.style.display = 'flex';
      diningView.classList.add('active');
    }
    if (diningBtn) {
      diningBtn.classList.add('active');
      diningBtn.style.background = '#1e293b';
      diningBtn.style.color = '#f59e0b';
    }
    if (typeof window !== 'undefined' && typeof window.loadReceptionistOrders === 'function') {
      window.loadReceptionistOrders();
    }
  } else {
    // Default back to Overview & Bookings
    const defaultView = document.getElementById('viewBookings') || document.getElementById('overview-view') || document.querySelector('.overview-content');
    if (defaultView) {
      defaultView.style.display = 'flex';
      defaultView.classList.add('active');
    }
    const defaultBtn = document.getElementById('tabBookingsBtn') || document.getElementById('modBtnOverview') || document.querySelector('.sidebar button:first-child');
    if (defaultBtn) {
      defaultBtn.classList.add('active');
      defaultBtn.style.background = '#1e293b';
      defaultBtn.style.color = '#fff';
    }
    if (typeof fetchBookings === 'function') {
      fetchBookings();
    }
  }
}

/**
 * Tab Navigation Controller
 */
function switchTab(tabId) {
  if (tabId === 'dining' || tabId === 'dining-module') {
    return switchReceptionTab('dining-module');
  }

  const buttons = ['tabBookingsBtn', 'tabRoomsBtn', 'tabComplaintsBtn', 'tabRequestsBtn', 'tabReportsBtn', 'modBtnDining'];
  buttons.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.classList.remove('active');
      if (id === 'modBtnDining') {
        el.style.background = 'transparent';
        el.style.color = '#9ca3af';
      } else {
        el.style.background = '';
        el.style.color = '';
      }
    }
  });

  const views = ['viewBookings', 'viewRooms', 'viewComplaints', 'viewRequests', 'viewReports', 'dining-module-view'];
  views.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.classList.remove('active');
      el.style.display = 'none';
    }
  });

  const btnMap = {
    'bookings': 'tabBookingsBtn',
    'rooms': 'tabRoomsBtn',
    'complaints': 'tabComplaintsBtn',
    'requests': 'tabRequestsBtn',
    'reports': 'tabReportsBtn',
    'dining': 'modBtnDining'
  };

  const viewMap = {
    'bookings': 'viewBookings',
    'rooms': 'viewRooms',
    'complaints': 'viewComplaints',
    'requests': 'viewRequests',
    'reports': 'viewReports',
    'dining': 'dining-module-view'
  };

  const activeBtn = document.getElementById(btnMap[tabId] || 'tabBookingsBtn');
  const activeView = document.getElementById(viewMap[tabId] || 'viewBookings');

  if (activeBtn) {
    activeBtn.classList.add('active');
    activeBtn.style.background = '';
    activeBtn.style.color = '';
  }
  if (activeView) {
    activeView.classList.add('active');
    activeView.style.display = 'flex';
  }

  if (tabId === 'bookings') {
    fetchBookings();
  } else if (tabId === 'rooms') {
    fetchRoomGrid();
  } else if (tabId === 'complaints') {
    fetchComplaints();
  } else if (tabId === 'requests') {
    fetchSpecialRequests();
  } else if (tabId === 'reports') {
    fetchReportsSummary();
  }

  fetchDashboardCounters();
}

/**
 * Initialize all Primary Receptionist Dashboard Buttons & Modals
 */
function initReceptionistButtons() {
  if (typeof document === 'undefined') return;

  // 1. Walk-In & Reservation Buttons
  const walkInButtons = [
    document.getElementById('btnNewWalkIn'),
    document.getElementById('btn-new-walkin'),
    document.getElementById('btnNewReservation'),
    document.getElementById('btn-new-reservation')
  ].filter(Boolean);

  walkInButtons.forEach(btn => {
    btn.onclick = (e) => {
      if (e && typeof e.preventDefault === 'function') e.preventDefault();
      openWalkInModal();
    };
  });

  // 2. Complaint & Request Modal Buttons
  const btnLogComp = document.getElementById('btnLogComplaint') || document.getElementById('btn-log-complaint');
  if (btnLogComp) {
    btnLogComp.onclick = (e) => {
      if (e && typeof e.preventDefault === 'function') e.preventDefault();
      openNewComplaintModal();
    };
  }

  const btnLogReq = document.getElementById('btnNewSpecialRequest') || document.getElementById('btn-new-special-request');
  if (btnLogReq) {
    btnLogReq.onclick = (e) => {
      if (e && typeof e.preventDefault === 'function') e.preventDefault();
      openNewRequestModal();
    };
  }

  // 3. Tab Buttons
  const tabMap = {
    'tabBookingsBtn': 'bookings',
    'tabRoomsBtn': 'rooms',
    'tabComplaintsBtn': 'complaints',
    'tabRequestsBtn': 'requests',
    'tabReportsBtn': 'reports'
  };

  Object.entries(tabMap).forEach(([id, tabName]) => {
    const btn = document.getElementById(id);
    if (btn) {
      btn.onclick = (e) => {
        if (e && typeof e.preventDefault === 'function') e.preventDefault();
        switchTab(tabName);
      };
    }
  });

  // 4. Report Buttons
  const btnGenReport = document.getElementById('btn-generate-report') || document.getElementById('btnGenerateReport') || document.getElementById('btnApplyReportFilter');
  if (btnGenReport) {
    btnGenReport.onclick = (e) => {
      if (e && typeof e.preventDefault === 'function') e.preventDefault();
      fetchReportsSummary();
    };
  }

  const btnResetRep = document.getElementById('btnResetReportFilter') || document.getElementById('btn-reset-report');
  if (btnResetRep) {
    btnResetRep.onclick = (e) => {
      if (e && typeof e.preventDefault === 'function') e.preventDefault();
      resetReportFilters();
    };
  }

  const btnPrintRep = document.getElementById('btnPrintReport') || document.getElementById('btn-print-report');
  if (btnPrintRep) {
    btnPrintRep.onclick = (e) => {
      if (e && typeof e.preventDefault === 'function') e.preventDefault();
      printReport();
    };
  }

  // 5. Clean Walk-in close handlers
  const closeWalkinBtn = document.getElementById('btn-walkin-close');
  const cancelWalkinBtn = document.getElementById('btn-walkin-cancel');
  if (closeWalkinBtn) closeWalkinBtn.onclick = closeWalkInModal;
  if (cancelWalkinBtn) cancelWalkinBtn.onclick = closeWalkInModal;
}

// Bind to window object for global availability
if (typeof window !== 'undefined') {
  window.showToast = showToast;
  window.fetchBookings = fetchBookings;
  window.fetchRoomGrid = fetchRoomGrid;
  window.fetchRooms = fetchRooms;
  window.fetchRoomTypes = fetchRoomTypes;
  window.fetchComplaints = fetchComplaints;
  window.fetchSpecialRequests = fetchSpecialRequests;
  window.fetchDashboardCounters = fetchDashboardCounters;
  window.loadBookingsTable = loadBookingsTable;
  window.loadRoomGrid = loadRoomGrid;
  window.loadDashboardStats = loadDashboardStats;
  window.loadComplaintsTable = loadComplaintsTable;
  window.loadRequestsTable = loadRequestsTable;
  window.setRoomGridFilter = setRoomGridFilter;
  window.filterRoomGrid = filterRoomGrid;
  window.renderRoomGridCards = renderRoomGridCards;
  window.openWalkInForRoom = openWalkInForRoom;
  window.openWalkInModal = openWalkInModal;
  window.closeWalkInModal = closeWalkInModal;
  window.openModal = openModal;
  window.closeModal = closeModal;
  window.openReservationModal = openReservationModal;
  window.openNewComplaintModal = openNewComplaintModal;
  window.openNewRequestModal = openNewRequestModal;
  window.openEditBookingModal = openEditBookingModal;
  window.openEditReservationModal = openEditBookingModal;
  window.populateEditModal = openEditBookingModal;
  window.handleUpdateBooking = handleUpdateBooking;
  window.openAssignRoomModal = openAssignRoomModal;
  window.handleConfirmRoomAllocation = handleConfirmRoomAllocation;
  window.assignRoom = assignRoom;
  window.processCheckIn = processCheckIn;
  window.handleCheckIn = handleCheckIn;
  window.processCheckOut = processCheckOut;
  window.handleCheckOut = handleCheckOut;
  window.processCheckout = processCheckout;
  window.cancelBooking = cancelBooking;
  window.deleteBooking = deleteBooking;
  window.handleCreateComplaintSubmit = handleCreateComplaintSubmit;
  window.updateComplaintStatus = updateComplaintStatus;
  window.deleteComplaint = deleteComplaint;
  window.updateSpecialRequestStatus = updateSpecialRequestStatus;
  window.deleteSpecialRequest = deleteSpecialRequest;
  window.quickCompleteRequest = quickCompleteRequest;
  window.resetBookingFilters = resetBookingFilters;
  window.resetComplaintFilters = resetComplaintFilters;
  window.resetRequestFilters = resetRequestFilters;
  window.resetReportFilters = resetReportFilters;
  window.selectBookingStatusPill = selectBookingStatusPill;
  window.setBookingSourceTab = setBookingSourceTab;
  window.switchTab = switchTab;
  window.switchReceptionTab = switchReceptionTab;
  window.printReport = printReport;
  window.handleReportFilter = handleReportFilter;
  window.syncReportDatePreset = syncReportDatePreset;
  window.fetchReportsSummary = fetchReportsSummary;
  window.loadReportsData = loadReportsData;
  window.initReceptionistButtons = initReceptionistButtons;
}

// Auto-bind on DOM ready
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initReceptionistButtons();
    });
  } else {
    initReceptionistButtons();
  }
}

// Export functions for node/module environments if applicable
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    showToast,
    fetchBookings,
    fetchRoomGrid,
    fetchRooms,
    fetchRoomTypes,
    loadBookingsTable,
    loadRoomGrid,
    loadDashboardStats,
    loadComplaintsTable,
    loadRequestsTable,
    setRoomGridFilter,
    filterRoomGrid,
    renderRoomGridCards,
    openWalkInForRoom,
    openWalkInModal,
    closeWalkInModal,
    openModal,
    closeModal,
    openNewComplaintModal,
    openNewRequestModal,
    openReservationModal,
    fetchComplaints,
    handleCreateComplaintSubmit,
    updateComplaintStatus,
    deleteComplaint,
    fetchSpecialRequests,
    updateSpecialRequestStatus,
    deleteSpecialRequest,
    quickCompleteRequest,
    fetchDashboardCounters,
    getReportFilterValues,
    fetchReportsSummary,
    loadReportsData,
    handleReportFilter,
    resetReportFilters,
    syncReportDatePreset,
    updateReportKPIs,
    renderReportsTable,
    printReport,
    switchTab,
    switchReceptionTab,
    processCheckIn,
    handleCheckIn,
    processCheckOut,
    handleCheckOut,
    processCheckout,
    cancelBooking,
    deleteBooking,
    openEditBookingModal,
    handleUpdateBooking,
    getStatusBadgeClass,
    assignRoom,
    openAssignRoomModal,
    handleConfirmRoomAllocation,
    selectBookingStatusPill,
    setBookingSourceTab,
    resetBookingFilters,
    resetComplaintFilters,
    resetRequestFilters,
    initReceptionistButtons
  };
}
