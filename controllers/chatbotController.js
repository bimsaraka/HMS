const { sql, poolPromise, fallbackDb } = require('../config/db');

/**
 * Rates configuration matching the hotel booking engine.
 */
const BASE_LKR_RATES = {
  'Single Room': 15000,
  'Couple Room': 25000,
  'Family Room': 45000
};

/**
 * Calculates standard LKR nightly price for a room.
 */
function getStandardLkrRate(category = '', acType = '', dbPrice = null) {
  if (dbPrice && dbPrice >= 1000) return parseFloat(dbPrice);
  const cat = (category || '').toLowerCase();
  const isAc = (acType || '').toLowerCase().includes('a/c') && !acType.toLowerCase().includes('non');

  if (cat.includes('single')) {
    return isAc ? 20000 : 15000;
  }
  if (cat.includes('family') || cat.includes('suite')) {
    return isAc ? 45000 : 35000;
  }
  // Couple / Deluxe
  return isAc ? 25000 : 22000;
}

/**
 * Returns formatted features and amenities for each room.
 */
function getRoomFeatures(category = '', acType = '') {
  const cat = (category || '').toLowerCase();
  const isAc = (acType || '').toLowerCase().includes('a/c') && !acType.toLowerCase().includes('non');

  if (cat.includes('single')) {
    return isAc
      ? 'Air Conditioning (A/C), Balcony, High-Speed Wi-Fi, Rainfall Shower, Smart TV'
      : 'Ceiling Fan, Free Wi-Fi, Tropical Garden View, Work Desk, En-suite Bathroom';
  }
  if (cat.includes('family') || cat.includes('suite')) {
    return isAc
      ? 'Air Conditioning (A/C), 2 King Beds, Panoramic Coastal View, Complimentary Breakfast, Pool Access, Luxury Bathtub'
      : '2 Queen Beds, Mountain View, Free Wi-Fi, Spacious Living Area, Tea/Coffee Station';
  }
  // Couple / Deluxe
  return isAc
    ? 'Air Conditioning (A/C), King Bed, Private Oceanview Balcony, Free Breakfast, Pool Access, Mini Bar'
    : 'Queen Bed, Free Wi-Fi, Private Balcony, Garden View, En-suite Bathroom';
}

/**
 * Returns special discount & package offers for a room.
 */
function getRoomDiscount(category = '', price = 25000) {
  if (price >= 40000) {
    return '15% off for 3+ nights & VIP airport transfer';
  }
  if (price >= 25000) {
    return '10% off for 2+ nights & welcome cocktails';
  }
  return 'Complimentary gourmet Ceylon tea & breakfast offer';
}

/**
 * Extracts budget limits and keywords from the user message.
 */
function parseUserQuery(message = '') {
  const text = (message || '').trim().toLowerCase();

  // 1. Budget extraction: identify 4 to 6 digit amounts (e.g., 30000, 25000, 15000)
  // Also catches prefixed formats like Rs. 30000, LKR 25000
  const budgetMatches = text.match(/\b\d{4,6}\b/g) || text.match(/(?:rs\.?|lkr|\$)\s*(\d+)/i);
  let budget = null;
  if (budgetMatches) {
    const rawNum = typeof budgetMatches[0] === 'string' && (budgetMatches[0].includes('rs') || budgetMatches[0].includes('lkr') || budgetMatches[0].includes('$'))
      ? parseInt(budgetMatches[1] || budgetMatches[0].replace(/\D/g, ''), 10)
      : parseInt(budgetMatches[0], 10);
    if (!isNaN(rawNum) && rawNum > 0) {
      budget = rawNum;
    }
  }

  // 2. Budget & Price keywords (including Sinhala phonetics)
  const budgetKeywords = [
    'budget', 'cheap', 'low', 'price', 'adu', 'aduma', 'ganan', 'mila', 
    'cost', 'affordable', 'economic', 'reasonable', 'under', 'below', 'less', 'aduwen'
  ];
  const hasBudgetIntent = budgetKeywords.some(kw => text.includes(kw)) || budget !== null;

  // 3. Room Type keywords
  let roomTypePreference = null;
  if (text.includes('single') || text.includes('thani')) {
    roomTypePreference = 'Single Room';
  } else if (text.includes('family') || text.includes('pawula') || text.includes('suite')) {
    roomTypePreference = 'Family Room';
  } else if (text.includes('couple') || text.includes('deluxe') || text.includes('double') || text.includes('dekak')) {
    roomTypePreference = 'Couple Room';
  } else if (text.includes('standard')) {
    roomTypePreference = 'Standard';
  }

  // 4. Amenities & Offer keywords
  const wantsAc = (text.includes('ac') || text.includes('a/c') || text.includes('air-con') || text.includes('air con') || text.includes('air condition')) 
    && !text.includes('non-ac') && !text.includes('non ac');
  const wantsNonAc = text.includes('non-ac') || text.includes('non ac') || text.includes('fan');
  const wantsPool = text.includes('pool') || text.includes('swimming');
  const wantsBreakfast = text.includes('breakfast') || text.includes('kema') || text.includes('meal') || text.includes('dining') || text.includes('food') || text.includes('bb');
  const wantsDiscount = text.includes('discount') || text.includes('offer') || text.includes('deal') || text.includes('package') || text.includes('promo');
  const wantsView = text.includes('ocean') || text.includes('sea') || text.includes('view') || text.includes('balcony');

  return {
    original: message,
    budget,
    hasBudgetIntent,
    roomTypePreference,
    wantsAc,
    wantsNonAc,
    wantsPool,
    wantsBreakfast,
    wantsDiscount,
    wantsView
  };
}

class ChatbotController {
  /**
   * POST /api/chatbot/query
   * Accepts { message: string }
   * Returns { reply: string, rooms: Array, budget?: number, matched_keywords?: Array }
   */
  static async query(req, res) {
    try {
      const userMessage = req.body && req.body.message ? String(req.body.message) : '';
      if (!userMessage.trim()) {
        return res.status(200).json({
          reply: "Hello! Welcome to Pinnacle Bay 96. Tell me your budget or room preference (e.g., 'Rooms under 30000' or 'Deluxe with breakfast').",
          rooms: []
        });
      }

      const parsed = parseUserQuery(userMessage);

      // Fetch all available rooms from SQL database or fallbackDb
      let rawRooms = [];
      const pool = await poolPromise;
      if (pool) {
        try {
          const result = await pool.request().query(`
            SELECT 
              room_number,
              ISNULL(category, ISNULL(type, 'Couple Room')) AS category,
              ISNULL(type, ISNULL(category, 'Couple Room')) AS type,
              ISNULL(ac_type, 'A/C') AS ac_type,
              price_per_night,
              image_url,
              ISNULL(status, 'Available') AS status
            FROM Rooms
            WHERE LOWER(status) = 'available'
            ORDER BY TRY_CAST(room_number AS INT) ASC, room_number ASC
          `);
          rawRooms = result.recordset;
        } catch (dbErr) {
          console.warn('[ChatbotController] Database room query fallback:', dbErr.message);
          rawRooms = (fallbackDb.rooms || []).filter(r => (r.status || '').toLowerCase() === 'available');
        }
      } else {
        rawRooms = (fallbackDb.rooms || []).filter(r => (r.status || '').toLowerCase() === 'available');
      }

      // Map raw rooms to standardized objects with LKR prices, features, and offers
      let enrichedRooms = rawRooms.map(r => {
        const cat = r.category || r.type || 'Couple Room';
        const acType = r.ac_type || 'A/C';
        const price = getStandardLkrRate(cat, acType, r.price_per_night);
        return {
          room_number: String(r.room_number || r.room_no || '101'),
          room_type: `${cat} (${acType})`,
          category: cat,
          ac_type: acType,
          price: price,
          price_formatted: `Rs. ${price.toLocaleString('en-LK')}`,
          features: getRoomFeatures(cat, acType),
          discount: getRoomDiscount(cat, price),
          image_url: r.image_url || 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=80',
          status: 'Available'
        };
      });

      // Filter rooms based on extracted criteria
      let filteredRooms = [...enrichedRooms];

      // 1. Filter by AC Preference
      if (parsed.wantsAc) {
        filteredRooms = filteredRooms.filter(r => r.ac_type.toLowerCase().includes('a/c') && !r.ac_type.toLowerCase().includes('non'));
      } else if (parsed.wantsNonAc) {
        filteredRooms = filteredRooms.filter(r => r.ac_type.toLowerCase().includes('non'));
      }

      // 2. Filter by Room Type
      if (parsed.roomTypePreference) {
        const typeMatch = filteredRooms.filter(r => 
          r.category.toLowerCase().includes(parsed.roomTypePreference.toLowerCase()) ||
          r.room_type.toLowerCase().includes(parsed.roomTypePreference.toLowerCase())
        );
        if (typeMatch.length > 0) {
          filteredRooms = typeMatch;
        }
      }

      // 3. Filter by Budget
      let replyMessage = '';
      if (parsed.budget !== null) {
        const underBudget = filteredRooms.filter(r => r.price <= parsed.budget);
        if (underBudget.length > 0) {
          filteredRooms = underBudget.sort((a, b) => a.price - b.price);
          replyMessage = `Found ${filteredRooms.length} available room(s) within your budget of Rs. ${parsed.budget.toLocaleString('en-LK')}:`;
        } else {
          // If no rooms under budget, sort ascending and provide the closest affordable option
          filteredRooms.sort((a, b) => a.price - b.price);
          const minPrice = filteredRooms.length > 0 ? filteredRooms[0].price : 20000;
          replyMessage = `We don't have available rooms under Rs. ${parsed.budget.toLocaleString('en-LK')} at the moment. Here are our closest affordable sanctuary options starting from Rs. ${minPrice.toLocaleString('en-LK')}:`;
        }
      } else if (parsed.hasBudgetIntent) {
        // User asked for cheap/budget without a specific amount
        filteredRooms.sort((a, b) => a.price - b.price);
        replyMessage = `Here are our most affordable and budget-friendly sanctuary rooms:`;
      } else if (parsed.roomTypePreference) {
        filteredRooms.sort((a, b) => a.price - b.price);
        replyMessage = `Here are our available ${parsed.roomTypePreference} options matching your stay preference:`;
      } else if (parsed.wantsBreakfast || parsed.wantsPool || parsed.wantsDiscount || parsed.wantsView) {
        replyMessage = `Here are our top recommended luxury rooms featuring premium amenities and exclusive stay packages:`;
      } else {
        filteredRooms.sort((a, b) => a.price - b.price);
        replyMessage = `Welcome to Pinnacle Bay 96! Here are our recommended available rooms for your coastal getaway:`;
      }

      // Limit response to top 4 recommendations for clean UI presentation
      const finalRooms = filteredRooms.slice(0, 4);

      return res.status(200).json({
        success: true,
        reply: replyMessage,
        rooms: finalRooms,
        budget: parsed.budget,
        parsed_criteria: {
          budget: parsed.budget,
          room_type: parsed.roomTypePreference,
          ac: parsed.wantsAc ? 'A/C' : (parsed.wantsNonAc ? 'Non-A/C' : null)
        }
      });
    } catch (err) {
      console.error('[ChatbotController] Error handling query:', err);
      return res.status(500).json({
        success: false,
        reply: "I apologize, but I encountered an issue retrieving room availability. Please try again or contact our front desk.",
        rooms: []
      });
    }
  }
}

module.exports = ChatbotController;
