const sql = require('mssql');
require('dotenv').config();

// MS SQL Connection Configurations
const defaultServer = process.env.DB_SERVER || 'localhost';
const defaultDatabase = process.env.DB_DATABASE || 'PinnacleBayDB';
const defaultUser = process.env.DB_USER || 'kavindu';
const defaultPassword = process.env.DB_PASSWORD || 'Bimsara123@';
const defaultPort = process.env.DB_PORT
  ? parseInt(process.env.DB_PORT, 10)
  : (defaultServer.includes('\\') ? undefined : 1433);
const defaultInstance = process.env.DB_INSTANCE || (defaultServer.includes('\\') ? defaultServer.split('\\')[1] : undefined);
const defaultEncrypt = process.env.DB_ENCRYPT === 'true';

const masterConfig = {
  user: defaultUser,
  password: defaultPassword,
  server: defaultServer,
  database: 'master',
  port: defaultPort,
  connectionTimeout: 10000,
  requestTimeout: 10000,
  options: {
    encrypt: defaultEncrypt,
    trustServerCertificate: true,
    enableArithAbort: true,
    requestTimeout: 10000,
    connectTimeout: 10000,
    instanceName: defaultInstance
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
    acquireTimeoutMillis: 10000
  }
};

const dbConfig = {
  user: defaultUser,
  password: defaultPassword,
  server: defaultServer,
  database: defaultDatabase,
  port: defaultPort,
  connectionTimeout: 10000,
  requestTimeout: 10000,
  options: {
    encrypt: defaultEncrypt,
    trustServerCertificate: true,
    enableArithAbort: true,
    requestTimeout: 10000,
    connectTimeout: 10000,
    instanceName: defaultInstance
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
    acquireTimeoutMillis: 10000
  }
};

let dbConnected = false;
let dbPool = null;

// Pool Promise for modular query executions
let poolPromise = null;

// In-Memory fallback data structures
const fallbackDb = {
  rooms: [
    { id: "101", room_number: "101", category: "Single Room", ac_type: "Non-A/C", type: "Single Room", price_per_night: 20.00, status: "Available", image_url: "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?auto=format&fit=crop&w=800&q=80" },
    { id: "102", room_number: "102", category: "Single Room", ac_type: "A/C", type: "Single Room", price_per_night: 30.00, status: "Available", image_url: "https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=80" },
    { id: "103", room_number: "103", category: "Couple Room", ac_type: "A/C", type: "Couple Room", price_per_night: 45.00, status: "Available", image_url: "https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=800&q=80" },
    { id: "104", room_number: "104", category: "Couple Room", ac_type: "A/C", type: "Couple Room", price_per_night: 45.00, status: "Available", image_url: "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=800&q=80" },
    { id: "201", room_number: "201", category: "Family Room", ac_type: "Non-A/C", type: "Family Room", price_per_night: 55.00, status: "Available", image_url: "https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf?auto=format&fit=crop&w=800&q=80" },
    { id: "202", room_number: "202", category: "Family Room", ac_type: "A/C", type: "Family Room", price_per_night: 75.00, status: "Available", image_url: "https://images.unsplash.com/photo-1578683010236-d716f9a3f461?auto=format&fit=crop&w=800&q=80" }
  ],
  bookings: [
    { booking_id: "BK-401", guest_name: "Eleanor Vance", guest_email: "eleanor@example.com", phone: "+94771234567", room_number: "101", check_in: "2026-08-19", check_out: "2026-08-22", total_amount: 450, status: "Confirmed", payment_status: "Pending" },
    { booking_id: "BK-402", guest_name: "Arthur Pendragon", guest_email: "arthur@example.com", phone: "+94771234568", room_number: "201", check_in: "2026-08-19", check_out: "2026-08-26", total_amount: 1960, status: "Confirmed", payment_status: "Pending" },
    { booking_id: "BK-403", guest_name: "Clara Oswald", guest_email: "clara@example.com", phone: "+94771234569", room_number: "103", check_in: "2026-08-20", check_out: "2026-08-21", total_amount: 90, status: "Confirmed", payment_status: "Pending" },
    { booking_id: "BK-404", guest_name: "Bruce Wayne", guest_email: "bruce@example.com", phone: "+94771234570", room_number: "202", check_in: "2026-08-21", check_out: "2026-08-25", total_amount: 1800, status: "Confirmed", payment_status: "Pending" },
    { booking_id: "BK-405", guest_name: "Selina Kyle", guest_email: "selina@example.com", phone: "+94771234571", room_number: "102", check_in: "2026-08-22", check_out: "2026-08-24", total_amount: 0, status: "Confirmed", payment_status: "Pending" }
  ],
  complaints: [
    { complaint_id: 1, room_number: '102', guest_name: 'Arthur Pendragon', category: 'AC/Maintenance', description: 'Air conditioner blowing warm air and making a vibrating noise', priority: 'High', status: 'In-Progress', created_at: new Date('2026-08-19T11:45:00.000Z') },
    { complaint_id: 2, room_number: '201', guest_name: 'Eleanor Vance', category: 'Noise', description: 'Loud party music coming from adjacent balcony late at night', priority: 'Medium', status: 'Open', created_at: new Date('2026-08-20T23:15:00.000Z') },
    { complaint_id: 3, room_number: '103', guest_name: 'Clara Oswald', category: 'Cleanliness', description: 'Extra bath towels requested, bathroom floor damp upon check-in', priority: 'Low', status: 'Resolved', created_at: new Date('2026-08-21T09:30:00.000Z') }
  ],
  guestRequests: [
    { request_id: 1, booking_id: 1, room_number: '101', guest_name: 'Eleanor Vance', request_type: 'Extra Bed', notes: 'Requires 1 additional rollaway bed with hypoallergenic pillows', priority: 'High', status: 'Pending', created_at: new Date('2026-08-19T10:30:00.000Z') },
    { request_id: 2, booking_id: 2, room_number: '201', guest_name: 'Arthur Pendragon', request_type: 'Late Check-out', notes: 'Late check-out requested until 3:00 PM for flight schedule', priority: 'Normal', status: 'In-Progress', created_at: new Date('2026-08-19T12:00:00.000Z') },
    { request_id: 3, booking_id: 3, room_number: '103', guest_name: 'Clara Oswald', request_type: 'Airport Transfer', notes: 'Luxury sedan pick-up requested from BIA Airport at 18:00', priority: 'Urgent', status: 'Completed', created_at: new Date('2026-08-20T09:45:00.000Z') }
  ],
  housekeeping: [
    { room_number: "101", cleaning_status: "Clean", assigned_staff: "Kamal Perera", last_cleaned: "2026-08-19" },
    { room_number: "102", cleaning_status: "Dirty", assigned_staff: "Nimal Silva", last_cleaned: "2026-08-18" },
    { room_number: "201", cleaning_status: "In Progress", assigned_staff: "Sunil Fernando", last_cleaned: "2026-08-19" }
  ],
  housekeepingPackages: [
    { package_id: 1, package_name: 'Honeymoon Special', description: 'Swan towels, rose petals, aromatherapy', items_included: 'Towel Swans, Rose Petals, Scented Candles, Bath Salts', price: 40.00 },
    { package_id: 2, package_name: 'Family & Kids Pack', description: 'Extra bedding, kids toiletries, crib upon request', items_included: 'Extra Cot/Bedding, Baby Shampoo, Cartoon Bath Mat, Night Light', price: 25.00 },
    { package_id: 3, package_name: 'VIP Refreshment', description: 'Chilled wine, fresh exotic fruit platter, artisan chocolates', items_included: 'Sparkling Wine, Tropical Fruit Basket, Dark Chocolates, 2 Flutes', price: 50.00 }
  ],
  packageAssignments: [
    { assignment_id: 1, room_number: '103', package_id: 1, package_name: 'Honeymoon Special', assigned_by: 'Front Desk Lead', notes: 'VIP anniversary guests', status: 'Pending', assigned_at: new Date() },
    { assignment_id: 2, room_number: '201', package_id: 2, package_name: 'Family & Kids Pack', assigned_by: 'Operations Supervisor', notes: '2 kids extra crib setup', status: 'Prepared', assigned_at: new Date() }
  ],
  maintenance: [
    { id: 1, task_id: 'MNT-101', room_number: '102', issue: 'Air conditioner blowing warm air and vibrating', priority: 'High', status: 'Pending', reported_at: new Date() },
    { id: 2, task_id: 'MNT-102', room_number: '201', issue: 'Balcony light fixture flickering', priority: 'Medium', status: 'In Progress', reported_at: new Date() }
  ],
  menuItems: [
    { item_id: 1, meal_type: 'Breakfast', item_name: 'Ceylon Continental Platter', description: 'Fresh tropical fruits, artisan bakery basket, buffalo curd & treacle, and Ceylon tea.', price: 18.00, is_available: true, created_at: new Date('2026-09-14T07:00:00.000Z') },
    { item_id: 2, meal_type: 'Breakfast', item_name: 'Traditional Sri Lankan Egg Hoppers', description: 'Crispy golden hoppers served with spicy katta sambol, seeni sambol, and lunu miris.', price: 14.00, is_available: true, created_at: new Date('2026-09-14T07:15:00.000Z') },
    { item_id: 3, meal_type: 'Lunch', item_name: 'Southern Seafood Rice & Curry', description: 'Fresh catch lagoon prawns, yellow rice, dhal, pol sambol, and spiced mango chutney.', price: 24.00, is_available: true, created_at: new Date('2026-09-14T12:00:00.000Z') },
    { item_id: 4, meal_type: 'Lunch', item_name: 'Char-Grilled Beef Burger', description: 'Prime beef patty with smoked cheddar, caramelized onions, and hand-cut truffle fries.', price: 20.00, is_available: true, created_at: new Date('2026-09-14T12:30:00.000Z') },
    { item_id: 5, meal_type: 'Dinner', item_name: 'Pinnacle Bay Lobster Thermidor', description: 'Oven-baked whole lobster with creamy mustard sauce, gruyere glaze, and buttered asparagus.', price: 42.00, is_available: true, created_at: new Date('2026-09-14T19:00:00.000Z') },
    { item_id: 6, meal_type: 'Dinner', item_name: 'Slow-Braised Lamb Shank', description: 'Tender lamb shank served on garlic mashed potatoes with rosemary red-wine reduction.', price: 36.00, is_available: true, created_at: new Date('2026-09-14T19:30:00.000Z') }
  ],
  roomServiceOrders: [
    { order_id: 1, room_number: '103', guest_name: 'Eleanor Vance', meal_type: 'Breakfast', item_name: 'Ceylon Continental Platter', quantity: 2, price: 18.00, total_price: 36.00, special_instructions: 'Deliver by 8:00 AM, extra tea bags', status: 'PENDING', order_time: new Date(Date.now() - 25 * 60000) },
    { order_id: 2, room_number: '202', guest_name: 'Sophia Loren', meal_type: 'Lunch', item_name: 'Southern Seafood Rice & Curry', quantity: 1, price: 24.00, total_price: 24.00, special_instructions: 'Extra spicy katta sambol on the side', status: 'PREPARING', order_time: new Date(Date.now() - 15 * 60000) },
    { order_id: 3, room_number: '101', guest_name: 'Arthur Pendragon', meal_type: 'Dinner', item_name: 'Pinnacle Bay Lobster Thermidor', quantity: 1, price: 42.00, total_price: 42.00, special_instructions: 'Room delivery at 7:30 PM', status: 'DELIVERED', order_time: new Date(Date.now() - 120 * 60000) }
  ],
  invoices: [
    { invoice_id: "INV-1001", booking_id: "BK-001", guest_name: "John Doe", room_number: "202", total_amount: 1350.00, paid_amount: 1350.00, status: "Paid", payment_method: "Credit Card", date: "2026-08-19" },
    { invoice_id: "INV-1002", booking_id: "BK-002", guest_name: "Amanda Lewis", room_number: "101", total_amount: 450.00, paid_amount: 0.00, status: "Pending", payment_method: "Unpaid", date: "2026-08-19" }
  ],
  transactions: [
    { txn_id: "TXN-5001", type: "Income", category: "Room Booking", amount: 1350.00, description: "Payment for INV-1001", date: "2026-08-19" },
    { txn_id: "TXN-5002", type: "Expense", category: "Maintenance", amount: 120.00, description: "AC Repair Room 201", date: "2026-08-18" }
  ],
  users: [
    { id: 101, user_id: 'PB-USR-101', name: 'Bimsara', email: 'bimsara@pinnaclebay.com', password: 'Admin@123', role: 'Administrator', designation: 'System Administrator', status: 'Active', redirect: 'admin-dashboard.html' },
    { id: 102, user_id: 'PB-USR-102', name: 'Vimaya', email: 'vimaya@pinnaclebay.com', password: 'Recept@123', role: 'Receptionist', designation: 'Front Desk Lead', status: 'Active', redirect: 'reception-dashboard.html' },
    { id: 103, user_id: 'PB-USR-103', name: 'Hirushan', email: 'hirushan@pinnaclebay.com', password: 'Ops@123', role: 'Operations', designation: 'Operations Supervisor', status: 'Active', redirect: 'ops-dashboard.html' },
    { id: 104, user_id: 'PB-USR-104', name: 'Malith', email: 'malith@pinnaclebay.com', password: 'Finance@123', role: 'Accountant', designation: 'Finance Officer', status: 'Active', redirect: 'finance-dashboard.html' },
    { id: 105, user_id: 'PB-USR-105', name: 'Jonathan Pierce', email: 'jpierce@pinnaclebay.com', password: 'password123', role: 'Receptionist', designation: 'Night Auditor', status: 'Active', redirect: 'reception-dashboard.html' },
    { id: 106, user_id: 'PB-USR-106', name: 'Alice Winters', email: 'awinters@pinnaclebay.com', password: 'password123', role: 'Administrator', designation: 'IT Director', status: 'Active', redirect: 'admin-dashboard.html' },
    { id: 107, user_id: 'PB-USR-107', name: 'Robert Chen', email: 'rchen@pinnaclebay.com', password: 'password123', role: 'Operations', designation: 'Housekeeping Lead', status: 'Active', redirect: 'ops-dashboard.html' }
  ],
  staff: [
    { staff_id: 1, full_name: 'Sunil Perera', role: 'Receptionist', phone: '+94 71 234 5678', basic_salary: 350.00, status: 'ACTIVE', created_at: new Date('2026-09-01T08:00:00.000Z') },
    { staff_id: 2, full_name: 'Kamala Silva', role: 'Housekeeper', phone: '+94 77 987 6543', basic_salary: 250.00, status: 'ACTIVE', created_at: new Date('2026-09-01T08:00:00.000Z') },
    { staff_id: 3, full_name: 'Anura Kumara', role: 'Maintenance Tech', phone: '+94 70 555 1234', basic_salary: 300.00, status: 'ACTIVE', created_at: new Date('2026-09-01T08:00:00.000Z') }
  ],
  payroll: [
    { payroll_id: 1, staff_id: 1, month_year: 'September 2026', basic_salary: 350.00, allowances: 40.00, deductions: 10.00, net_salary: 380.00, payment_status: 'PAID', payment_date: '2026-09-07', created_at: new Date('2026-09-07T08:00:00.000Z') },
    { payroll_id: 2, staff_id: 2, month_year: 'September 2026', basic_salary: 250.00, allowances: 25.00, deductions: 5.00, net_salary: 270.00, payment_status: 'PAID', payment_date: '2026-09-07', created_at: new Date('2026-09-07T08:00:00.000Z') }
  ],
  attendance: [
    { id: 1, staff_id: 'PB-USR-101', staff_name: 'Bimsara', date: '2026-09-01', shift_name: 'Morning Shift (8:00 AM - 5:00 PM)', status: 'Present', extra_hours: 2.00, ot_hours: 2.00, clock_in_time: '08:00 AM', clock_out_time: '07:00 PM', created_at: '2026-09-01T08:00:00.000Z' },
    { id: 2, staff_id: 'PB-USR-101', staff_name: 'Bimsara', date: '2026-09-02', shift_name: 'Morning Shift (8:00 AM - 5:00 PM)', status: 'Present', extra_hours: 3.50, ot_hours: 3.50, clock_in_time: '07:45 AM', clock_out_time: '08:30 PM', created_at: '2026-09-02T08:00:00.000Z' }
  ]
};

async function initDB() {
  console.log("Attempting MS SQL connection with config:", {
    server: dbConfig.server,
    database: dbConfig.database,
    user: dbConfig.user,
    port: dbConfig.port,
    options: dbConfig.options
  });

  try {
    try {
      dbPool = await sql.connect(dbConfig);
    } catch (directErr) {
      if (directErr.message && directErr.message.includes('Cannot open database')) {
        console.log(`[SQL] Database "${dbConfig.database}" does not exist. Connecting to master to create it...`);
        const masterPool = await sql.connect(masterConfig);
        await masterPool.request().query(`CREATE DATABASE [${dbConfig.database}];`);
        console.log(`[SQL] Database "${dbConfig.database}" created successfully.`);
        await sql.close();
        dbPool = await sql.connect(dbConfig);
      } else {
        throw directErr;
      }
    }

    dbConnected = true;
    console.log(`✔ [SQL Server] Connected to database: ${dbConfig.database}`);
    return dbPool;
  } catch (err) {
    dbConnected = false;
    console.error("SQL Connection Error Detail:", err);
    console.warn("⚠️ MS SQL connection failed. Continuing in Fail-Safe In-Memory mode.");
    return null;
  }
}

// Helper to get pool or throw/fallback
function getPool() {
  return dbPool;
}

function isConnected() {
  return dbConnected && dbPool !== null;
}

// Initialize poolPromise
poolPromise = initDB();

module.exports = {
  sql,
  poolPromise,
  initDB,
  getPool,
  isConnected,
  dbConfig,
  fallbackDb
};
