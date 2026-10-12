/**
 * Pinnacle Bay 96 - Reception Walk-In Reservation & Channel Segmentation Engine
 * public/js/reception.js
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    const exports = factory();
    Object.assign(root, exports);
  }
})(typeof self !== 'undefined' ? self : this, function () {

  const MEAL_PLAN_RATES = {
    'Room Only': 0,
    'Bed & Breakfast': 15,
    'Half Board': 30,
    'Full Board': 50
  };

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Identifies whether a booking was created online.
   * @param {Object} b - Booking record
   * @returns {boolean}
   */
  function isOnlineBooking(b) {
    if (!b) return false;
    const bType = String(b.booking_type || '').trim().toLowerCase();
    const bSource = String(b.source || b.booking_source || '').trim().toLowerCase();
    const idPass = String(b.id_passport || '').trim().toLowerCase();
    const room = String(b.room_number || '').trim().toLowerCase();

    // 1. Explicit online channel markers
    if (bType === 'online' || bSource === 'online' || bSource === 'online reservation' || idPass === 'online-guest') {
      return true;
    }
    // 2. Explicit walk-in channel markers
    if (bType.includes('walk') || bSource.includes('walk')) {
      return false;
    }
    // 3. Unassigned room implies pending online allocation
    if (!room || room === 'unassigned' || room === 'null' || room === 'undefined') {
      return true;
    }
    // 4. Default: If not explicitly marked as walk-in, preserve as online
    return true;
  }

  /**
   * Identifies whether a booking is a front-desk walk-in.
   * @param {Object} b - Booking record
   * @returns {boolean}
   */
  function isWalkInBooking(b) {
    return !isOnlineBooking(b);
  }

  /**
   * Filters bookings by channel/source tab ('online', 'walkin', 'all').
   * @param {Array} bookings 
   * @param {string} sourceTab - 'online' | 'walkin' | 'all'
   * @returns {Array}
   */
  function filterBookingsBySource(bookings = [], sourceTab = 'all') {
    if (!Array.isArray(bookings)) return [];
    if (sourceTab === 'online') {
      return bookings.filter(isOnlineBooking);
    } else if (sourceTab === 'walkin') {
      return bookings.filter(isWalkInBooking);
    }
    return bookings;
  }

  /**
   * Calculates counter summaries for tab badges.
   * @param {Array} bookings 
   * @returns {Object} { onlineCount, onlineUnassignedCount, walkinCount, allCount }
   */
  function calculateSourceCounts(bookings = []) {
    if (!Array.isArray(bookings)) {
      return { onlineCount: 0, onlineUnassignedCount: 0, walkinCount: 0, allCount: 0 };
    }

    let onlineCount = 0;
    let onlineUnassignedCount = 0;
    let walkinCount = 0;

    bookings.forEach(b => {
      const isOnline = isOnlineBooking(b);
      const room = String(b.room_number || '').trim().toLowerCase();
      const isUnassigned = !room || room === 'unassigned' || room === 'null';
      const normStatus = (b.status || '').toLowerCase().trim();
      const isActive = normStatus === 'confirmed' || normStatus === 'checked-in' || normStatus === 'booked';

      if (isOnline) {
        onlineCount++;
        if (isUnassigned && isActive) {
          onlineUnassignedCount++;
        }
      } else {
        walkinCount++;
      }
    });

    return {
      onlineCount,
      onlineUnassignedCount,
      walkinCount,
      allCount: bookings.length
    };
  }

  /**
   * Calculates the walk-in billing breakdown and total.
   * Formula: Total Bill = (Room Rate per night + Meal Package Rate per night) * Number of Nights + (Special Setup Price if any)
   * 
   * @param {Object} params
   * @param {number} params.roomPrice - Room rate per night ($)
   * @param {number|string} params.mealPackage - Meal package name or price per night
   * @param {number} params.nights - Number of nights
   * @param {number} [params.specialSetupPrice=0] - Special room setup / housekeeping package price ($)
   * @param {string} [params.mealPackageName='Room Only']
   * @param {string} [params.specialSetupName='']
   * @returns {Object}
   */
  function calculateWalkInBilling(params = {}) {
    const roomRate = parseFloat(params.roomPrice || params.roomRate) || 45.00;
    const nights = Math.max(1, parseInt(params.nights, 10) || 1);
    const setupPrice = parseFloat(params.specialSetupPrice || params.setupPrice || params.packagePrice) || 0.00;
    const setupName = (params.specialSetupName || params.packageName || '').trim();

    let mealRate = 0.00;
    let mealName = 'Room Only';

    if (typeof params.mealPackage === 'number') {
      mealRate = params.mealPackage;
      mealName = params.mealPackageName || 'Meal Package';
    } else if (typeof params.mealPackage === 'string') {
      mealName = params.mealPackage;
      const lower = mealName.toLowerCase();
      if (lower.includes('bed') || lower.includes('breakfast') || lower === 'bb') {
        mealRate = MEAL_PLAN_RATES['Bed & Breakfast'];
        mealName = 'Bed & Breakfast';
      } else if (lower.includes('half') || lower === 'hb') {
        mealRate = MEAL_PLAN_RATES['Half Board'];
        mealName = 'Half Board';
      } else if (lower.includes('full') || lower === 'fb') {
        mealRate = MEAL_PLAN_RATES['Full Board'];
        mealName = 'Full Board';
      } else {
        mealRate = MEAL_PLAN_RATES['Room Only'];
        mealName = 'Room Only';
      }
    } else if (params.mealPackageRate !== undefined) {
      mealRate = parseFloat(params.mealPackageRate) || 0.00;
      mealName = params.mealPackageName || 'Meal Package';
    }

    const roomTotal = roomRate * nights;
    const mealTotal = mealRate * nights;
    const baseTotal = (roomRate + mealRate) * nights;
    const totalBill = baseTotal + setupPrice;

    const nightText = nights === 1 ? '1 night' : `${nights} nights`;
    let previewText = `Room: $${roomRate.toFixed(2)} × ${nightText}`;
    if (mealRate > 0) {
      previewText += ` + ${mealName} ($${mealRate.toFixed(2)}${nights > 1 ? ` × ${nightText}` : ''})`;
    }
    if (setupPrice > 0) {
      previewText += ` + ${setupName || 'Setup'} ($${setupPrice.toFixed(2)})`;
    }
    previewText += ` -> Total: $${totalBill.toFixed(2)}`;

    return {
      roomRate,
      mealRate,
      mealPackageName: mealName,
      setupPrice,
      setupName,
      nights,
      roomTotal,
      mealTotal,
      baseTotal,
      totalBill,
      previewText
    };
  }

  /**
   * Helper to recalculate walk-in modal UI state in real-time.
   */
  function updateWalkInBillingUI() {
    const roomDropdown = document.getElementById('cw-room-select') || document.getElementById('resRoomSelect');
    const mealDropdown = document.getElementById('walkInMealPackage') || document.getElementById('cw-meal-package');
    const packageDropdown = document.getElementById('cw-package');
    const checkinInput = document.getElementById('cw-checkin') || document.getElementById('resCheckIn');
    const checkoutInput = document.getElementById('cw-checkout') || document.getElementById('resCheckOut');
    const totalInput = document.getElementById('cw-total');
    const advancePaidInput = document.getElementById('cw-advance-paid');
    const balanceDueEl = document.getElementById('cw-balance-due');
    const priceCalcEl = document.getElementById('cw-price-calc');
    const pkgCalcEl = document.getElementById('cw-pkg-calc');

    // 1. Determine Room Rate
    let roomPrice = 45.00;
    if (roomDropdown && roomDropdown.selectedIndex >= 0) {
      const selectedRoomOpt = roomDropdown.options[roomDropdown.selectedIndex];
      const dataPrice = parseFloat(selectedRoomOpt?.getAttribute('data-price'));
      if (!isNaN(dataPrice) && dataPrice > 0) {
        roomPrice = dataPrice;
      }
    }

    // 2. Determine Meal Package
    let mealName = 'Room Only';
    let mealPrice = 0.00;
    if (mealDropdown && mealDropdown.selectedIndex >= 0) {
      const mealOpt = mealDropdown.options[mealDropdown.selectedIndex];
      mealName = mealOpt.value || 'Room Only';
      mealPrice = parseFloat(mealOpt.getAttribute('data-price')) || MEAL_PLAN_RATES[mealName] || 0.00;
    }

    // 3. Determine Special Setup Package Price
    let pkgPrice = 0.00;
    let pkgName = '';
    if (packageDropdown && packageDropdown.selectedIndex >= 0) {
      const pkgOpt = packageDropdown.options[packageDropdown.selectedIndex];
      pkgPrice = parseFloat(pkgOpt.getAttribute('data-price')) || 0.00;
      pkgName = pkgOpt.value || '';
    }

    // 4. Calculate Nights
    const inVal = checkinInput ? checkinInput.value : '';
    const outVal = checkoutInput ? checkoutInput.value : '';
    let nights = 1;
    if (inVal && outVal) {
      const d1 = new Date(inVal);
      const d2 = new Date(outVal);
      if (!isNaN(d1.getTime()) && !isNaN(d2.getTime()) && d2 > d1) {
        nights = Math.max(1, Math.round((d2 - d1) / (1000 * 60 * 60 * 24)));
      }
    }

    // 5. Calculate Total Bill
    const calc = calculateWalkInBilling({
      roomPrice,
      mealPackage: mealName,
      mealPackageRate: mealPrice,
      mealPackageName: mealName,
      nights,
      specialSetupPrice: pkgPrice,
      specialSetupName: pkgName
    });

    if (totalInput) {
      totalInput.value = calc.totalBill.toFixed(2);
    }

    const nightText = nights === 1 ? '1 night' : `${nights} nights`;
    if (priceCalcEl) {
      if (mealPrice > 0) {
        priceCalcEl.innerText = `Room: $${roomPrice.toFixed(2)} × ${nightText} + ${mealName} ($${mealPrice.toFixed(2)}${nights > 1 ? ` × ${nightText}` : ''})`;
      } else {
        priceCalcEl.innerText = `Room: $${roomPrice.toFixed(2)} × ${nightText} (Room Only)`;
      }
    }

    if (pkgCalcEl) {
      pkgCalcEl.innerText = pkgPrice > 0 ? `+ ${pkgName} ($${pkgPrice.toFixed(2)})` : `+ No Setup ($0.00)`;
    }

    // 6. Update Balance Due
    const total = calc.totalBill;
    const advance = parseFloat(advancePaidInput ? advancePaidInput.value : 0) || 0;
    const balance = Math.max(0, total - advance);

    if (balanceDueEl) {
      balanceDueEl.innerText = '$' + balance.toFixed(2);
      if (balance === 0) {
        balanceDueEl.style.color = '#34d399';
        balanceDueEl.className = 'text-sm font-semibold text-emerald-400';
      } else {
        balanceDueEl.style.color = '#fb7185';
        balanceDueEl.className = 'text-sm font-semibold text-rose-400';
      }
    }

    return calc;
  }

  /**
   * Generates HTML string for a list of daily menu items for a specific meal category.
   * @param {Array} dishArray - Array of dish objects
   * @param {string} mealType - 'Breakfast', 'Lunch', or 'Dinner'
   * @returns {string} HTML string
   */
  function renderReceptionMenuListHtml(dishArray, mealType) {
    if (!dishArray || dishArray.length === 0) {
      return `
        <div style="text-align: center; padding: 2rem 1rem; color: #94a3b8; font-size: 0.8rem;">
          <div style="font-size: 1.5rem; margin-bottom: 0.25rem; opacity: 0.6;">🍽️</div>
          No ${mealType.toLowerCase()} menu published yet by Operations.
        </div>
      `;
    }

    return dishArray.map(dish => {
      const name = dish.item_name || 'Dish Item';
      const desc = dish.description || '';
      return `
        <div style="background: rgba(30, 41, 59, 0.6); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; padding: 0.75rem 0.85rem; display: flex; flex-direction: column; gap: 0.25rem;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem;">
            <span style="font-weight: 600; font-size: 0.88rem; color: #f8fafc;">${name}</span>
            <span style="font-size: 0.65rem; background: rgba(52, 211, 153, 0.15); color: #34d399; padding: 1px 6px; border-radius: 4px; font-weight: 600; white-space: nowrap;">Available</span>
          </div>
          ${desc ? `<p style="margin: 0; font-size: 0.75rem; color: #94a3b8; line-height: 1.35;">${desc}</p>` : ''}
        </div>
      `;
    }).join('');
  }

  /**
   * Fetches today's active menu from /api/menu?available_only=1 and renders into modal columns.
   */
  async function fetchAndRenderReceptionMenu() {
    const breakfastList = document.getElementById('receptionBreakfastList');
    const lunchList = document.getElementById('receptionLunchList');
    const dinnerList = document.getElementById('receptionDinnerList');

    const breakfastBadge = document.getElementById('receptionBreakfastBadge');
    const lunchBadge = document.getElementById('receptionLunchBadge');
    const dinnerBadge = document.getElementById('receptionDinnerBadge');

    const loadingHtml = `
      <div style="text-align: center; padding: 1.5rem; color: #94a3b8; font-size: 0.8rem;">
        Loading menu...
      </div>
    `;

    if (breakfastList) breakfastList.innerHTML = loadingHtml;
    if (lunchList) lunchList.innerHTML = loadingHtml;
    if (dinnerList) dinnerList.innerHTML = loadingHtml;

    try {
      const res = await fetch('/api/menu?available_only=1');
      if (!res.ok) throw new Error('Failed to fetch menu');
      const json = await res.json();
      
      let breakfast = [];
      let lunch = [];
      let dinner = [];

      if (json.grouped) {
        breakfast = json.grouped.Breakfast || [];
        lunch = json.grouped.Lunch || [];
        dinner = json.grouped.Dinner || [];
      } else if (json.Breakfast || json.Lunch || json.Dinner) {
        breakfast = json.Breakfast || [];
        lunch = json.Lunch || [];
        dinner = json.Dinner || [];
      } else if (Array.isArray(json.data || json.items || json)) {
        const list = Array.isArray(json.data) ? json.data : (Array.isArray(json.items) ? json.items : (Array.isArray(json) ? json : []));
        breakfast = list.filter(i => (i.meal_type || '').toLowerCase() === 'breakfast');
        lunch = list.filter(i => (i.meal_type || '').toLowerCase() === 'lunch');
        dinner = list.filter(i => (i.meal_type || '').toLowerCase() === 'dinner');
      } else if (typeof json.data === 'object') {
        breakfast = json.data.Breakfast || [];
        lunch = json.data.Lunch || [];
        dinner = json.data.Dinner || [];
      }

      if (breakfastList) breakfastList.innerHTML = renderReceptionMenuListHtml(breakfast, 'Breakfast');
      if (lunchList) lunchList.innerHTML = renderReceptionMenuListHtml(lunch, 'Lunch');
      if (dinnerList) dinnerList.innerHTML = renderReceptionMenuListHtml(dinner, 'Dinner');

      if (breakfastBadge) breakfastBadge.innerText = `${breakfast.length} Dish${breakfast.length === 1 ? '' : 'es'}`;
      if (lunchBadge) lunchBadge.innerText = `${lunch.length} Dish${lunch.length === 1 ? '' : 'es'}`;
      if (dinnerBadge) dinnerBadge.innerText = `${dinner.length} Dish${dinner.length === 1 ? '' : 'es'}`;

      return { breakfast, lunch, dinner };
    } catch (err) {
      console.error('Error loading dining menu for reception:', err);
      const errorHtml = `
        <div style="text-align: center; padding: 1.5rem; color: #fb7185; font-size: 0.8rem;">
          ⚠️ Unable to load menu items.
        </div>
      `;
      if (breakfastList) breakfastList.innerHTML = errorHtml;
      if (lunchList) lunchList.innerHTML = errorHtml;
      if (dinnerList) dinnerList.innerHTML = errorHtml;
      return null;
    }
  }

  /**
   * Opens the Reception Menu Modal and triggers a fresh load of dishes.
   */
  function openReceptionMenuModal() {
    try {
      const modal = document.getElementById('receptionMenuModal');
      if (modal) {
        if (typeof modal.showModal === 'function') {
          if (!modal.open) {
            modal.showModal();
          }
        } else {
          modal.style.display = 'block';
        }
      }
    } catch (e) {
      console.warn('Could not show receptionMenuModal:', e);
    }
    try {
      fetchAndRenderReceptionMenu();
    } catch (e) {
      console.error('fetchAndRenderReceptionMenu error:', e);
    }
  }

  /**
   * Closes the Reception Menu Modal.
   */
  function closeReceptionMenuModal() {
    try {
      const modal = document.getElementById('receptionMenuModal');
      if (modal) {
        if (typeof modal.close === 'function') {
          if (modal.open) modal.close();
        } else {
          modal.style.display = 'none';
        }
      }
    } catch (e) {
      console.warn('Could not close receptionMenuModal:', e);
    }
  }

  let cachedInHouseRooms = [];
  let cachedDiningMenuDishes = [];

  /**
   * Fetches active in-house rooms for room service order dropdown.
   */
  async function loadInHouseRoomsForDining() {
    const roomSelect = document.getElementById('diningRoomSelect');
    if (!roomSelect) return [];
    try {
      const res = await fetch('/api/orders/room-service/in-house-rooms');
      const data = await res.json();
      const rooms = data.rooms || data.data || [];
      cachedInHouseRooms = rooms;

      if (!rooms || rooms.length === 0) {
        roomSelect.innerHTML = '<option value="">-- No In-House Guests Currently Found --</option>';
        return [];
      }

      roomSelect.innerHTML = '<option value="">-- Select In-House Guest / Room --</option>' +
        rooms.map(r => {
          const guest = r.guest_name || 'In-House Guest';
          const cat = r.category ? ` (${r.category})` : '';
          return `<option value="${escapeHtml(r.room_number)}" data-guest="${escapeHtml(guest)}">Room ${escapeHtml(r.room_number)} - ${escapeHtml(guest)}${escapeHtml(cat)}</option>`;
        }).join('');

      return rooms;
    } catch (err) {
      console.error('Failed to load in-house rooms:', err);
      roomSelect.innerHTML = `
        <option value="101" data-guest="Arthur Pendragon">Room 101 - Arthur Pendragon (Single Room)</option>
        <option value="102" data-guest="Amanda Lewis">Room 102 - Amanda Lewis (Single Room)</option>
        <option value="103" data-guest="Eleanor Vance">Room 103 - Eleanor Vance (Couple Room)</option>
        <option value="201" data-guest="Marcus Holloway">Room 201 - Marcus Holloway (Family Room)</option>
        <option value="202" data-guest="Sophia Loren">Room 202 - Sophia Loren (Family Room)</option>
      `;
      return [];
    }
  }

  /**
   * Fetches available menu items and populates the dish dropdown for the given session.
   */
  async function loadDiningDishesForSession(session = 'Breakfast') {
    const dishSelect = document.getElementById('diningDishSelect');
    const descPreview = document.getElementById('diningDishDescPreview');
    if (!dishSelect) return [];

    try {
      if (!cachedDiningMenuDishes || cachedDiningMenuDishes.length === 0) {
        const res = await fetch('/api/menu?available_only=1');
        const data = await res.json();
        cachedDiningMenuDishes = data.items || data.data || [];
      }

      const normSession = (session || 'Breakfast').trim().toLowerCase();
      const sessionDishes = cachedDiningMenuDishes.filter(d => 
        (d.meal_type || '').toLowerCase() === normSession && Boolean(d.is_available)
      );

      if (sessionDishes.length === 0) {
        dishSelect.innerHTML = `<option value="">-- No available dishes found for ${session} --</option>`;
        if (descPreview) descPreview.textContent = 'Please select another meal session or ask Kitchen to add dishes.';
        return [];
      }

      dishSelect.innerHTML = '<option value="">-- Select a Dish from Active Menu --</option>' +
        sessionDishes.map(d => {
          const desc = d.description ? ` (${d.description})` : '';
          return `<option value="${escapeHtml(d.item_name)}" data-desc="${escapeHtml(d.description || '')}">${escapeHtml(d.item_name)}${escapeHtml(desc)}</option>`;
        }).join('');

      if (descPreview) descPreview.textContent = '';
      return sessionDishes;
    } catch (err) {
      console.error('Failed to load dining dishes:', err);
      dishSelect.innerHTML = '<option value="">-- Error loading dishes --</option>';
      return [];
    }
  }

  function handleDiningRoomChange(roomVal) {
    const roomSelect = document.getElementById('diningRoomSelect');
    const guestInput = document.getElementById('diningGuestName');
    if (roomSelect && guestInput) {
      const opt = roomSelect.options[roomSelect.selectedIndex];
      const guestName = opt ? (opt.getAttribute('data-guest') || '') : '';
      guestInput.value = guestName;
    }
  }

  function handleDiningSessionChange(sessionVal) {
    loadDiningDishesForSession(sessionVal);
  }

  function handleDiningDishChange(dishVal) {
    const dishSelect = document.getElementById('diningDishSelect');
    const descPreview = document.getElementById('diningDishDescPreview');
    if (dishSelect && descPreview) {
      const opt = dishSelect.options[dishSelect.selectedIndex];
      const desc = opt ? (opt.getAttribute('data-desc') || '') : '';
      descPreview.textContent = desc ? `🍲 ${desc}` : '';
    }
  }

  // Safe non-throwing stubs for room dining
  function openRoomDiningModal() { return false; }
  function closeRoomDiningModal() { return false; }
  function handleRoomDiningOrderSubmit(event) { if (event && event.preventDefault) event.preventDefault(); return false; }
  function handleDiningRoomChange() {}
  function handleDiningSessionChange() {}
  function handleDiningDishChange() {}

  // Auto-bind UI triggers if running in browser DOM
  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
      const btnViewTodayMenu = document.getElementById('btnViewTodayMenu');
      if (btnViewTodayMenu) {
        btnViewTodayMenu.onclick = (e) => {
          if (e && typeof e.preventDefault === 'function') e.preventDefault();
          openReceptionMenuModal();
        };
      }

      const linkPreviewMenuInclusions = document.getElementById('linkPreviewMenuInclusions');
      if (linkPreviewMenuInclusions) {
        linkPreviewMenuInclusions.onclick = (e) => {
          if (e && typeof e.preventDefault === 'function') e.preventDefault();
          openReceptionMenuModal();
        };
      }

      const receptionMenuModal = document.getElementById('receptionMenuModal');
      if (receptionMenuModal) {
        receptionMenuModal.addEventListener('click', (e) => {
          if (e.target === receptionMenuModal) {
            closeReceptionMenuModal();
          }
        });
      }
    });
  }

  // Attach to global window scope for inline onclick handlers
  if (typeof window !== 'undefined') {
    window.openReceptionMenuModal = openReceptionMenuModal;
    window.closeReceptionMenuModal = closeReceptionMenuModal;
    window.fetchAndRenderReceptionMenu = fetchAndRenderReceptionMenu;
    window.renderReceptionMenuListHtml = renderReceptionMenuListHtml;
    window.openRoomDiningModal = openRoomDiningModal;
    window.closeRoomDiningModal = closeRoomDiningModal;
    window.handleDiningRoomChange = handleDiningRoomChange;
    window.handleDiningSessionChange = handleDiningSessionChange;
    window.handleDiningDishChange = handleDiningDishChange;
    window.handleRoomDiningOrderSubmit = handleRoomDiningOrderSubmit;
    window.calculateWalkInBilling = calculateWalkInBilling;
    window.filterBookingsBySource = filterBookingsBySource;
    window.calculateSourceCounts = calculateSourceCounts;
  }

  return {
    MEAL_PLAN_RATES,
    isOnlineBooking,
    isWalkInBooking,
    filterBookingsBySource,
    calculateSourceCounts,
    calculateWalkInBilling,
    updateWalkInBillingUI,
    renderReceptionMenuListHtml,
    fetchAndRenderReceptionMenu,
    openReceptionMenuModal,
    closeReceptionMenuModal,
    openRoomDiningModal,
    closeRoomDiningModal,
    handleDiningRoomChange,
    handleDiningSessionChange,
    handleDiningDishChange,
    handleRoomDiningOrderSubmit
  };
});

