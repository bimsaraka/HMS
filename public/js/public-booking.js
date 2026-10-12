/**
 * Pinnacle Bay 96 - Public Guest Booking & Meal Package Calculation Engine
 * public/js/public-booking.js
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    const exports = factory();
    Object.assign(root, exports);
  }
})(typeof self !== 'undefined' ? self : this, function () {

  const ROOM_RATES = {
    'Single Room': 15000,
    'Couple Room': 25000,
    'Family Room': 45000
  };

  const MEAL_RATES = {
    'Room Only': 0,
    'Bed & Breakfast': 3500,
    'Half Board': 5500,
    'Full Board': 8000
  };

  /**
   * Calculates the booking breakdown and total cost.
   * Formula: Total = (Room Rate + Meal Rate) * Nights
   * 
   * @param {string} roomType - 'Single Room', 'Couple Room', 'Family Room'
   * @param {string} mealPackage - 'Room Only', 'Bed & Breakfast', 'Half Board', 'Full Board'
   * @param {string|Date} checkInDate
   * @param {string|Date} checkOutDate
   * @returns {Object} { nights, roomRate, mealRate, ratePerNight, total, breakdownText }
   */
  function calculateBookingTotal(roomType = 'Couple Room', mealPackage = 'Room Only', checkInDate = null, checkOutDate = null) {
    // 1. Resolve Room Rate
    let roomRate = 25000;
    const lowerRoom = (roomType || '').toLowerCase();
    if (lowerRoom.includes('single')) {
      roomRate = ROOM_RATES['Single Room'];
      roomType = 'Single Room';
    } else if (lowerRoom.includes('family')) {
      roomRate = ROOM_RATES['Family Room'];
      roomType = 'Family Room';
    } else {
      roomRate = ROOM_RATES['Couple Room'];
      roomType = 'Couple Room';
    }

    // 2. Resolve Meal Rate
    let mealRate = 0;
    const lowerMeal = (mealPackage || '').toLowerCase();
    if (lowerMeal.includes('bed') || lowerMeal.includes('breakfast') || lowerMeal === 'bb') {
      mealRate = MEAL_RATES['Bed & Breakfast'];
      mealPackage = 'Bed & Breakfast';
    } else if (lowerMeal.includes('half') || lowerMeal === 'hb') {
      mealRate = MEAL_RATES['Half Board'];
      mealPackage = 'Half Board';
    } else if (lowerMeal.includes('full') || lowerMeal === 'fb') {
      mealRate = MEAL_RATES['Full Board'];
      mealPackage = 'Full Board';
    } else {
      mealRate = MEAL_RATES['Room Only'];
      mealPackage = 'Room Only';
    }

    // 3. Resolve Nights
    let nights = 1;
    if (checkInDate && checkOutDate) {
      const dIn = new Date(checkInDate);
      const dOut = new Date(checkOutDate);
      if (!isNaN(dIn.getTime()) && !isNaN(dOut.getTime()) && dOut > dIn) {
        const diffMs = dOut.getTime() - dIn.getTime();
        nights = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
      }
    }

    const ratePerNight = roomRate + mealRate;
    const total = ratePerNight * nights;
    const nightLabel = nights === 1 ? '1 Night' : `${nights} Nights`;
    const formattedRoom = Number(roomRate).toLocaleString('en-LK');
    const formattedMeal = Number(mealRate).toLocaleString('en-LK');
    const formattedTotal = Number(total).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const breakdownText = `${roomType} (Rs. ${formattedRoom}) + ${mealPackage} (Rs. ${formattedMeal}) × ${nightLabel} = Rs. ${formattedTotal}`;

    
  function getTodayDateString() {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  function getNextDayDateString(dateStr) {
    const base = dateStr ? new Date(dateStr) : new Date();
    base.setDate(base.getDate() + 1);
    const yyyy = base.getFullYear();
    const mm = String(base.getMonth() + 1).padStart(2, '0');
    const dd = String(base.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  function handleGuestCheckInChange() {
    if (typeof clearGuestBookingFieldErrors === 'function') clearGuestBookingFieldErrors();
    const checkInInput = document.getElementById('guestCheckInDate') || document.getElementById('bookCheckIn');
    const checkOutInput = document.getElementById('guestCheckOutDate') || document.getElementById('bookCheckOut');
    if (!checkInInput || !checkOutInput) return;

    const todayStr = getTodayDateString();
    checkInInput.min = todayStr;

    if (checkInInput.value && checkInInput.value < todayStr) {
      checkInInput.value = todayStr;
      if (typeof showGuestBookingAlert === 'function') {
        showGuestBookingAlert('Past dates cannot be selected for Check-in.');
      }
    }

    if (checkInInput.value) {
      const nextDayStr = getNextDayDateString(checkInInput.value);
      checkOutInput.min = nextDayStr;
      if (checkOutInput.value && checkOutInput.value <= checkInInput.value) {
        checkOutInput.value = nextDayStr;
        if (typeof showGuestBookingAlert === 'function') {
          showGuestBookingAlert('Check-out date must be at least one day after Check-in date.');
        }
      }
    }
    updateGuestBookingPricing();
  }

  function handleGuestCheckOutChange() {
    if (typeof clearGuestBookingFieldErrors === 'function') clearGuestBookingFieldErrors();
    const checkInInput = document.getElementById('guestCheckInDate') || document.getElementById('bookCheckIn');
    const checkOutInput = document.getElementById('guestCheckOutDate') || document.getElementById('bookCheckOut');
    if (!checkInInput || !checkOutInput) return;

    if (checkInInput.value && checkOutInput.value) {
      if (checkOutInput.value <= checkInInput.value) {
        checkOutInput.value = '';
        checkOutInput.style.border = '2px solid #ef4444';
        if (typeof showGuestBookingAlert === 'function') {
          showGuestBookingAlert('Check-out date must be at least one day after Check-in date.');
        }
        return;
      }
    }
    updateGuestBookingPricing();
  }

  return {
    getTodayDateString,
    getNextDayDateString,
    handleGuestCheckInChange,
    handleGuestCheckOutChange,
      roomType,
      mealPackage,
      roomRate,
      mealRate,
      ratePerNight,
      nights,
      total,
      breakdownText
    };
  }

  /**
   * Recalculates and updates the pricing breakdown UI inside #guestBookingModal.
   */
  function updateGuestBookingPricing() {
    const roomSelect = document.getElementById('guestRoomType') || document.getElementById('bookRoomType');
    const mealSelect = document.getElementById('bookMealPackage') || document.getElementById('guestMealPackage');
    const checkInInput = document.getElementById('guestCheckInDate') || document.getElementById('bookCheckIn');
    const checkOutInput = document.getElementById('guestCheckOutDate') || document.getElementById('bookCheckOut');

    const selectedRoomVal = roomSelect ? roomSelect.value : 'Couple Room';
    const selectedMealVal = mealSelect ? mealSelect.value : 'Room Only';
    const checkInVal = checkInInput ? checkInInput.value : '';
    const checkOutVal = checkOutInput ? checkOutInput.value : '';

    const pricing = calculateBookingTotal(selectedRoomVal, selectedMealVal, checkInVal, checkOutVal);

    // Update UI elements
    const suiteNameEl = document.getElementById('guestPricingSuiteName') || document.getElementById('pricingSuiteName');
    const durationEl = document.getElementById('guestPricingDuration') || document.getElementById('pricingDuration');
    const totalEl = document.getElementById('guestPricingTotalValue') || document.getElementById('pricingTotalValue');

    if (suiteNameEl) {
      suiteNameEl.textContent = `${pricing.roomType} • ${pricing.mealPackage}`;
    }
    if (durationEl) {
      durationEl.textContent = pricing.breakdownText;
    }
    if (totalEl) {
      totalEl.textContent = `Rs. ${pricing.total.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

    return pricing;
  }

  // Auto-initialize when DOM is ready
  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
      const roomSelect = document.getElementById('guestRoomType') || document.getElementById('bookRoomType');
      const mealSelect = document.getElementById('bookMealPackage') || document.getElementById('guestMealPackage');
      const checkInInput = document.getElementById('guestCheckInDate') || document.getElementById('bookCheckIn');
      const checkOutInput = document.getElementById('guestCheckOutDate') || document.getElementById('bookCheckOut');

      if (roomSelect) roomSelect.addEventListener('change', updateGuestBookingPricing);
      if (mealSelect) mealSelect.addEventListener('change', updateGuestBookingPricing);
      if (checkInInput) checkInInput.addEventListener('change', updateGuestBookingPricing);
      if (checkOutInput) checkOutInput.addEventListener('change', updateGuestBookingPricing);

      // Trigger initial pricing calculation
      updateGuestBookingPricing();
    });
  }

  return {
    ROOM_RATES,
    MEAL_RATES,
    calculateBookingTotal,
    updateGuestBookingPricing
  };
});
