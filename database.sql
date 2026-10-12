-- ==========================================
-- Pinnacle Bay HMS - Database Initialization
-- Target Database: Microsoft SQL Server
-- ==========================================

-- 1. Create Database
IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = 'PinnacleBayDB')
BEGIN
    CREATE DATABASE PinnacleBayDB;
END
GO

USE PinnacleBayDB;
GO

-- 2. Create Users Table
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Users]') AND type in (N'U'))
BEGIN
    CREATE TABLE Users (
        id INT IDENTITY(1,1) PRIMARY KEY,
        user_id VARCHAR(20) UNIQUE,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL,
        designation VARCHAR(100),
        status VARCHAR(20) NOT NULL,
        created_at DATETIME DEFAULT GETDATE()
    );
END
ELSE
BEGIN
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Users]') AND name = 'designation')
    BEGIN
        ALTER TABLE Users ADD designation VARCHAR(100);
    END
END
GO

-- 3. Clear existing seed records (optional, for safety re-running script)
TRUNCATE TABLE Users;
GO

-- 4. Seed Initial User Records (24 staff records mirroring standard metrics)
INSERT INTO Users (user_id, name, email, password, role, designation, status) VALUES
('PB-USR-101', 'Bimsara', 'bimsara@pinnaclebay.com', 'Admin@123', 'Administrator', 'System Administrator', 'Active'),
('PB-USR-102', 'Vimaya', 'vimaya@pinnaclebay.com', 'Recept@123', 'Receptionist', 'Front Desk Lead', 'Active'),
('PB-USR-103', 'Hirushan', 'hirushan@pinnaclebay.com', 'Ops@123', 'Operations', 'Operations Supervisor', 'Active'),
('PB-USR-104', 'Malith', 'malith@pinnaclebay.com', 'Finance@123', 'Accountant', 'Finance Officer', 'Active'),
('PB-USR-105', 'Jonathan Pierce', 'jpierce@pinnaclebay.com', 'password123', 'Receptionist', 'Night Auditor', 'Active'),
('PB-USR-106', 'Alice Winters', 'awinters@pinnaclebay.com', 'password123', 'Administrator', 'IT Director', 'Active'),
('PB-USR-107', 'Robert Chen', 'rchen@pinnaclebay.com', 'password123', 'Operations', 'Housekeeping Lead', 'Active'),
('PB-USR-108', 'Sofia Martinez', 'smartinez@pinnaclebay.com', 'password123', 'Accountant', 'Senior Accountant', 'Active'),
('PB-USR-109', 'Thomas Mueller', 'tmueller@pinnaclebay.com', 'password123', 'Receptionist', 'Front Desk Associate', 'Active'),
('PB-USR-110', 'Emily Watson', 'ewatson@pinnaclebay.com', 'password123', 'Operations', 'Housekeeper', 'Active'),
('PB-USR-111', 'James Fletcher', 'jfletcher@pinnaclebay.com', 'password123', 'Accountant', 'Junior Accountant', 'Active'),
('PB-USR-112', 'Lisa Sterling', 'lsterling@pinnaclebay.com', 'password123', 'Receptionist', 'Concierge', 'Active'),
('PB-USR-113', 'Victor Hugo', 'vhugo@pinnaclebay.com', 'password123', 'Operations', 'Maintenance Technician', 'Active'),
('PB-USR-114', 'Nina Simone', 'nsimone@pinnaclebay.com', 'password123', 'Accountant', 'Payroll Specialist', 'Active'),
('PB-USR-115', 'Alan Turing', 'aturing@pinnaclebay.com', 'password123', 'Administrator', 'Systems Analyst', 'Active'),
('PB-USR-116', 'Grace Hopper', 'ghopper@pinnaclebay.com', 'password123', 'Administrator', 'Security Engineer', 'Active'),
('PB-USR-117', 'Donald Knuth', 'dknuth@pinnaclebay.com', 'password123', 'Operations', 'Facilities Lead', 'Active'),
('PB-USR-118', 'Ada Lovelace', 'alovelace@pinnaclebay.com', 'password123', 'Accountant', 'Financial Auditor', 'Active'),
('PB-USR-119', 'Richard Feynman', 'rfeynman@pinnaclebay.com', 'password123', 'Operations', 'Maintenance Tech', 'Suspended'),
('PB-USR-120', 'Marie Curie', 'mcurie@pinnaclebay.com', 'password123', 'Accountant', 'Billing Clerk', 'Inactive'),
('PB-USR-121', 'Nikola Tesla', 'ntesla@pinnaclebay.com', 'password123', 'Operations', 'Electrician', 'Inactive'),
('PB-USR-122', 'Albert Einstein', 'aeinstein@pinnaclebay.com', 'password123', 'Receptionist', 'Front Desk Clerk', 'Suspended'),
('PB-USR-123', 'Katherine Johnson', 'kjohnson@pinnaclebay.com', 'password123', 'Administrator', 'Compliance Officer', 'Inactive'),
('PB-USR-124', 'Stephen Hawking', 'shawking@pinnaclebay.com', 'password123', 'Accountant', 'Tax Specialist', 'Suspended');
GO

-- Create Rooms Table
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Rooms]') AND type in (N'U'))
BEGIN
    CREATE TABLE Rooms (
        id INT IDENTITY(1,1) PRIMARY KEY,
        room_number NVARCHAR(20) UNIQUE NOT NULL,
        category NVARCHAR(50) NOT NULL CHECK (category IN ('Single Room', 'Couple Room', 'Family Room')),
        ac_type NVARCHAR(20) NOT NULL,
        type NVARCHAR(100) NULL,
        price_per_night DECIMAL(10,2) NOT NULL,
        status NVARCHAR(30) DEFAULT 'Available',
        image_url NVARCHAR(MAX) NULL
    );

    INSERT INTO Rooms (room_number, category, ac_type, type, price_per_night, status, image_url) VALUES
    ('101', 'Single Room', 'Non-A/C', 'Single Room', 20.00, 'Available', 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?auto=format&fit=crop&w=800&q=80'),
    ('102', 'Single Room', 'A/C', 'Single Room', 30.00, 'Available', 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=80'),
    ('103', 'Couple Room', 'A/C', 'Couple Room', 45.00, 'Available', 'https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=800&q=80'),
    ('104', 'Couple Room', 'A/C', 'Couple Room', 45.00, 'Available', 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=800&q=80'),
    ('201', 'Family Room', 'Non-A/C', 'Family Room', 55.00, 'Available', 'https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf?auto=format&fit=crop&w=800&q=80'),
    ('202', 'Family Room', 'A/C', 'Family Room', 75.00, 'Available', 'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?auto=format&fit=crop&w=800&q=80');
END
ELSE
BEGIN
    IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Rooms' AND COLUMN_NAME = 'image_url')
    BEGIN
        ALTER TABLE dbo.Rooms ADD image_url NVARCHAR(MAX) NULL;
    END
    ELSE
    BEGIN
        ALTER TABLE dbo.Rooms ALTER COLUMN image_url NVARCHAR(MAX);
    END;

    UPDATE dbo.Rooms 
    SET image_url = 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=80'
    WHERE image_url IS NULL OR image_url = '' OR image_url LIKE 'assets/%';
END
GO

-- Standardize Room Types Migration Query Snippet
IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Rooms]') AND type in (N'U'))
BEGIN
    -- Update category column
    IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Rooms' AND COLUMN_NAME = 'category')
    BEGIN
        UPDATE Rooms SET category = 'Single Room' WHERE category IN ('Standard Room', 'Single') OR room_number IN ('101', '102');
        UPDATE Rooms SET category = 'Couple Room' WHERE category IN ('Deluxe Double', 'Double') OR room_number IN ('103', '104');
        UPDATE Rooms SET category = 'Family Room' WHERE category IN ('Ocean Suite', 'Penthouse Suite', 'Suite', 'Sea View Suite') OR room_number IN ('201', '202');
    END;

    -- Update type column
    IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Rooms' AND COLUMN_NAME = 'type')
    BEGIN
        UPDATE Rooms SET type = 'Single Room' WHERE type LIKE '%Standard%' OR type LIKE '%Single%' OR room_number IN ('101', '102');
        UPDATE Rooms SET type = 'Couple Room' WHERE type LIKE '%Deluxe%' OR type LIKE '%Double%' OR room_number IN ('103', '104');
        UPDATE Rooms SET type = 'Family Room' WHERE type LIKE '%Suite%' OR type LIKE '%Family%' OR room_number IN ('201', '202');
    END;

    -- Update room_type column if it exists in legacy schemas
    IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Rooms' AND COLUMN_NAME = 'room_type')
    BEGIN
        EXEC('
            UPDATE Rooms SET room_type = ''Single Room'' WHERE room_type IN (''Standard Room'', ''Single'') OR room_number IN (''101'', ''102'');
            UPDATE Rooms SET room_type = ''Couple Room'' WHERE room_type IN (''Deluxe Double'', ''Double'') OR room_number IN (''103'', ''104'');
            UPDATE Rooms SET room_type = ''Family Room'' WHERE room_type IN (''Ocean Suite'', ''Penthouse Suite'', ''Suite'', ''Sea View Suite'') OR room_number IN (''201'', ''202'');
        ');
    END;
END
GO

-- Create Bookings Table
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Bookings]') AND type in (N'U'))
BEGIN
    CREATE TABLE Bookings (
        id INT IDENTITY(1,1) PRIMARY KEY,
        booking_id VARCHAR(50) UNIQUE NOT NULL,
        guest_name VARCHAR(100) NOT NULL,
        email NVARCHAR(100) NULL,
        guest_email NVARCHAR(100) NULL,
        phone NVARCHAR(20) NOT NULL,
        guest_phone NVARCHAR(30) NULL,
        room_number VARCHAR(10) NOT NULL,
        check_in DATE NOT NULL,
        check_out DATE NOT NULL,
        total_amount DECIMAL(10,2) NOT NULL,
        advance_paid DECIMAL(10,2) DEFAULT 0.00,
        status VARCHAR(30) DEFAULT 'CONFIRMED',
        payment_status VARCHAR(30) DEFAULT 'Pending',
        payment_method NVARCHAR(50) DEFAULT 'Pay at Reception',
        transaction_ref NVARCHAR(100) NULL,
        card_last4 NVARCHAR(10) NULL,
        id_passport VARCHAR(50) NULL,
        guest_nic NVARCHAR(50) NULL,
        guest_type NVARCHAR(50) DEFAULT 'Local',
        created_at DATETIME DEFAULT GETDATE()
    );
END
ELSE
BEGIN
    IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Bookings' AND COLUMN_NAME = 'email')
    BEGIN
        ALTER TABLE dbo.Bookings ADD email NVARCHAR(100) NULL;
    END;
    IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Bookings' AND COLUMN_NAME = 'guest_email')
    BEGIN
        ALTER TABLE dbo.Bookings ADD guest_email NVARCHAR(100) NULL;
    END;
    IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Bookings' AND COLUMN_NAME = 'phone')
    BEGIN
        ALTER TABLE dbo.Bookings ADD phone NVARCHAR(20) NULL;
    END;
    IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Bookings' AND COLUMN_NAME = 'payment_method')
    BEGIN
        ALTER TABLE dbo.Bookings ADD payment_method NVARCHAR(50) DEFAULT 'Pay at Reception';
    END;
    IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Bookings' AND COLUMN_NAME = 'transaction_ref')
    BEGIN
        ALTER TABLE dbo.Bookings ADD transaction_ref NVARCHAR(100) NULL;
    END;
    IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Bookings' AND COLUMN_NAME = 'card_last4')
    BEGIN
        ALTER TABLE dbo.Bookings ADD card_last4 NVARCHAR(10) NULL;
    END;
    IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Bookings' AND COLUMN_NAME = 'guest_nic')
    BEGIN
        ALTER TABLE dbo.Bookings ADD guest_nic NVARCHAR(50) NULL;
    END;
    IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Bookings' AND COLUMN_NAME = 'guest_type')
    BEGIN
        ALTER TABLE dbo.Bookings ADD guest_type NVARCHAR(50) DEFAULT 'Local';
    END;
END
GO

-- Create Housekeeping Table
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Housekeeping]') AND type in (N'U'))
BEGIN
    CREATE TABLE Housekeeping (
        id INT IDENTITY(1,1) PRIMARY KEY,
        room_number VARCHAR(10) UNIQUE NOT NULL,
        cleaning_status VARCHAR(20) DEFAULT 'Clean',
        assigned_staff VARCHAR(100),
        last_cleaned DATETIME DEFAULT GETDATE()
    );
END
GO

-- Create Maintenance Table
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Maintenance]') AND type in (N'U'))
BEGIN
    CREATE TABLE Maintenance (
        id INT IDENTITY(1,1) PRIMARY KEY,
        task_id VARCHAR(50) UNIQUE NOT NULL,
        room_number VARCHAR(10) NOT NULL,
        issue VARCHAR(255) NOT NULL,
        priority VARCHAR(20) DEFAULT 'Medium',
        status VARCHAR(20) DEFAULT 'Pending',
        reported_at DATETIME DEFAULT GETDATE()
    );
END
GO

-- Create Packages Table
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Packages' AND xtype='U')
BEGIN
    CREATE TABLE Packages (
        package_id INT IDENTITY(1,1) PRIMARY KEY,
        package_name NVARCHAR(100) NOT NULL,
        category NVARCHAR(50),
        price DECIMAL(10,2) NOT NULL,
        description NVARCHAR(MAX),
        included_items NVARCHAR(MAX),
        created_at DATETIME DEFAULT GETDATE()
    );
END
GO

-- Create Invoices Table
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Invoices]') AND type in (N'U'))
BEGIN
    CREATE TABLE Invoices (
        id INT IDENTITY(1,1) PRIMARY KEY,
        invoice_id VARCHAR(50) UNIQUE NOT NULL,
        booking_id VARCHAR(50),
        guest_name VARCHAR(100) NOT NULL,
        room_number VARCHAR(10),
        total_amount DECIMAL(10,2) NOT NULL,
        amount DECIMAL(10,2) NULL,
        paid_amount DECIMAL(10,2) DEFAULT 0.00,
        status VARCHAR(20) DEFAULT 'Pending',
        payment_status NVARCHAR(50) DEFAULT 'Pending',
        payment_method VARCHAR(50) DEFAULT 'Unpaid',
        transaction_ref NVARCHAR(100) NULL,
        issue_date DATETIME NULL,
        created_at DATETIME DEFAULT GETDATE()
    );
END
ELSE
BEGIN
    IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Invoices' AND COLUMN_NAME = 'amount')
    BEGIN
        ALTER TABLE dbo.Invoices ADD amount DECIMAL(10,2) NULL;
    END;
    IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Invoices' AND COLUMN_NAME = 'payment_status')
    BEGIN
        ALTER TABLE dbo.Invoices ADD payment_status NVARCHAR(50) NULL;
    END;
    IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Invoices' AND COLUMN_NAME = 'transaction_ref')
    BEGIN
        ALTER TABLE dbo.Invoices ADD transaction_ref NVARCHAR(100) NULL;
    END;
    IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Invoices' AND COLUMN_NAME = 'issue_date')
    BEGIN
        ALTER TABLE dbo.Invoices ADD issue_date DATETIME NULL;
    END;
END
GO

-- Create Transactions Table
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Transactions]') AND type in (N'U'))
BEGIN
    CREATE TABLE Transactions (
        id INT IDENTITY(1,1) PRIMARY KEY,
        txn_id VARCHAR(50) UNIQUE NOT NULL,
        type VARCHAR(20) NOT NULL,
        category VARCHAR(50) NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        description VARCHAR(255),
        created_at DATETIME DEFAULT GETDATE()
    );
END
GO

-- Create Attendance Table
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Attendance]') AND type in (N'U'))
BEGIN
    CREATE TABLE Attendance (
        id INT IDENTITY(1,1) PRIMARY KEY,
        staff_id VARCHAR(50) NOT NULL,
        staff_name VARCHAR(100) NOT NULL,
        date DATE NOT NULL,
        shift_name VARCHAR(100) DEFAULT 'Morning Shift (8:00 AM - 5:00 PM)',
        status VARCHAR(20) DEFAULT 'Present',
        extra_hours DECIMAL(4,2) DEFAULT 0.00,
        ot_hours DECIMAL(4,2) DEFAULT 0.00,
        clock_in_time NVARCHAR(20) NULL,
        clock_out_time NVARCHAR(20) NULL,
        created_at DATETIME DEFAULT GETDATE()
    );
END
ELSE
BEGIN
    IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Attendance' AND COLUMN_NAME = 'ot_hours')
    BEGIN
        ALTER TABLE dbo.Attendance ADD ot_hours DECIMAL(4,2) DEFAULT 0.00;
    END;
    IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Attendance' AND COLUMN_NAME = 'clock_in_time')
    BEGIN
        ALTER TABLE dbo.Attendance ADD clock_in_time NVARCHAR(20) NULL;
    END;
    IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Attendance' AND COLUMN_NAME = 'clock_out_time')
    BEGIN
        ALTER TABLE dbo.Attendance ADD clock_out_time NVARCHAR(20) NULL;
    END;
END
GO

-- Cascade Delete relationship for Attendance when a User is deleted
IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_Attendance_Users_Cascade')
BEGIN
    IF NOT EXISTS (SELECT 1 FROM Attendance a WHERE NOT EXISTS (SELECT 1 FROM Users u WHERE u.user_id = a.staff_id))
    BEGIN
        ALTER TABLE Attendance
        ADD CONSTRAINT FK_Attendance_Users_Cascade
        FOREIGN KEY (staff_id) REFERENCES Users(user_id) ON DELETE CASCADE;
    END
END
GO

-- Create Complaints Table
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Complaints]') AND type in (N'U'))
BEGIN
    CREATE TABLE Complaints (
        complaint_id INT IDENTITY(1,1) PRIMARY KEY,
        room_number NVARCHAR(20) NOT NULL,
        guest_name NVARCHAR(150) NOT NULL,
        category NVARCHAR(50) NOT NULL,
        description NVARCHAR(500) NOT NULL,
        priority NVARCHAR(20) DEFAULT 'Medium',
        status NVARCHAR(30) DEFAULT 'Open',
        assigned_dept NVARCHAR(50) DEFAULT 'Housekeeping',
        created_at DATETIME DEFAULT GETDATE()
    );
END
GO

-- Create SpecialRequests Table
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[SpecialRequests]') AND type in (N'U'))
BEGIN
    CREATE TABLE SpecialRequests (
        request_id INT IDENTITY(1,1) PRIMARY KEY,
        room_number NVARCHAR(20) NOT NULL,
        guest_name NVARCHAR(150) NOT NULL,
        request_type NVARCHAR(100) NOT NULL,
        notes NVARCHAR(300) NULL,
        priority NVARCHAR(20) DEFAULT 'Normal',
        status NVARCHAR(30) DEFAULT 'Pending',
        created_at DATETIME DEFAULT GETDATE()
    );
END
GO

-- Create GuestRequests Table (Compatibility Alias)
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[GuestRequests]') AND type in (N'U'))
BEGIN
    CREATE TABLE GuestRequests (
        request_id INT IDENTITY(1,1) PRIMARY KEY,
        booking_id INT NULL,
        room_number NVARCHAR(20) NOT NULL,
        guest_name NVARCHAR(150) NOT NULL,
        request_type NVARCHAR(100) NOT NULL,
        notes NVARCHAR(500) NULL,
        priority NVARCHAR(20) DEFAULT 'Normal',
        status NVARCHAR(30) DEFAULT 'Pending',
        created_at DATETIME DEFAULT GETDATE()
    );
END
GO

-- ====================================================================
-- Receptionist Module CRUD Query Mappings:
-- 1. Guest Complaints & Feedback:
--    - GET /api/reception/complaints => SELECT * FROM Complaints (supports ?query= / ?category= / ?status=)
--    - POST /api/reception/complaints => INSERT INTO Complaints
--    - PUT /api/reception/complaints/:id => UPDATE Complaints (status / details)
--    - DELETE /api/reception/complaints/:id => DELETE FROM Complaints
-- 2. Special Requests:
--    - GET /api/reception/special-requests => SELECT * FROM SpecialRequests (supports ?query= / ?status= / ?room_number=)
--    - POST /api/reception/special-requests => INSERT INTO SpecialRequests
--    - PUT /api/reception/special-requests/:id/status => UPDATE SpecialRequests SET status = @status
--    - PUT /api/reception/special-requests/:id => UPDATE SpecialRequests
--    - DELETE /api/reception/special-requests/:id => DELETE FROM SpecialRequests
--    - GET /api/reception/dashboard-counters => Real-time aggregate count for badges
-- 3. Room Inventory, Grid & Walk-In Bookings:
--    - GET /api/reception/rooms/grid => SELECT r.*, b.guest_name, b.check_out FROM Rooms r LEFT JOIN Bookings b ON r.room_number = b.room_number AND b.status = 'Checked-In'
--    - GET /api/reception/rooms/available => SELECT * FROM Rooms WHERE LOWER(status) = 'available'
--    - GET /api/reception/room-types => SELECT DISTINCT room_type FROM dbo.Rooms
--    - POST /api/reception/bookings/walk-in => INSERT INTO Bookings (and update Rooms status to 'Occupied' if CHECKED-IN)
-- ====================================================================
--    - GET /api/reception/room-types => SELECT DISTINCT room_type FROM dbo.Rooms
--    - POST /api/reception/bookings/walk-in => INSERT INTO Bookings (and update Rooms status to 'Occupied' if CHECKED-IN)
-- ====================================================================

-- ====================================================================
-- Operations Module CRUD Query Mappings:
-- 1. Housekeeping:
--    - GET /api/ops/housekeeping => SELECT * FROM Housekeeping
--    - PUT /api/ops/housekeeping/:room_number/edit => UPDATE Housekeeping
--    - DELETE /api/ops/housekeeping/:room_number => DELETE FROM Housekeeping
-- 2. Maintenance:
--    - GET /api/ops/maintenance => SELECT * FROM Maintenance
--    - POST /api/ops/maintenance => INSERT INTO Maintenance
--    - PUT /api/ops/maintenance/:task_id/edit => UPDATE Maintenance
--    - DELETE /api/ops/maintenance/:task_id => DELETE FROM Maintenance
-- ====================================================================

-- Create Staff and Payroll Tables
IF OBJECT_ID('dbo.Staff', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.Staff (
    staff_id INT IDENTITY(1,1) PRIMARY KEY,
    full_name NVARCHAR(150) NOT NULL,
    role NVARCHAR(100) NOT NULL, -- Receptionist, Housekeeper, Chef, Manager
    phone NVARCHAR(50) NULL,
    basic_salary DECIMAL(10,2) NOT NULL,
    status NVARCHAR(20) DEFAULT 'ACTIVE',
    created_at DATETIME DEFAULT GETDATE()
  );

  INSERT INTO dbo.Staff (full_name, role, phone, basic_salary)
  VALUES 
    ('Sunil Perera', 'Receptionist', '+94 71 234 5678', 350.00),
    ('Kamala Silva', 'Housekeeper', '+94 77 987 6543', 250.00),
    ('Anura Kumara', 'Maintenance Tech', '+94 70 555 1234', 300.00);
END;
GO

IF OBJECT_ID('dbo.Payroll', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.Payroll (
    payroll_id INT IDENTITY(1,1) PRIMARY KEY,
    staff_id INT FOREIGN KEY REFERENCES dbo.Staff(staff_id) ON DELETE CASCADE,
    month_year NVARCHAR(50) NOT NULL, -- e.g. 'September 2026'
    basic_salary DECIMAL(10,2) NOT NULL,
    allowances DECIMAL(10,2) DEFAULT 0.00,
    deductions DECIMAL(10,2) DEFAULT 0.00,
    net_salary DECIMAL(10,2) NOT NULL,
    payment_status NVARCHAR(50) DEFAULT 'PAID',
    payment_date DATE DEFAULT CAST(GETDATE() AS DATE),
    created_at DATETIME DEFAULT GETDATE()
  );

  INSERT INTO dbo.Payroll (staff_id, month_year, basic_salary, allowances, deductions, net_salary, payment_status)
  VALUES 
    (1, 'September 2026', 350.00, 50.00, 0.00, 400.00, 'PAID'),
    (2, 'September 2026', 250.00, 30.00, 0.00, 280.00, 'PAID'),
    (3, 'September 2026', 300.00, 40.00, 0.00, 340.00, 'PAID');
END;
GO

IF OBJECT_ID('dbo.Customers', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.Customers (
    customer_id INT IDENTITY(1,1) PRIMARY KEY,
    cust_code NVARCHAR(50) UNIQUE,
    full_name NVARCHAR(150) NOT NULL,
    email NVARCHAR(150) UNIQUE NOT NULL,
    phone NVARCHAR(50) NOT NULL,
    password_hash NVARCHAR(255) NOT NULL,
    created_at DATETIME DEFAULT GETDATE()
  );
END;
GO

-- ====================================================================
-- Daily Kitchen & Meal Menu Management Table
-- ====================================================================
IF OBJECT_ID('dbo.MenuItems', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.MenuItems (
    item_id INT IDENTITY(1,1) PRIMARY KEY,
    meal_type NVARCHAR(20) NOT NULL CHECK (meal_type IN ('Breakfast', 'Lunch', 'Dinner')),
    item_name NVARCHAR(150) NOT NULL,
    description NVARCHAR(255) NULL,
    is_available BIT DEFAULT 1,
    created_at DATETIME DEFAULT GETDATE()
  );

  INSERT INTO dbo.MenuItems (meal_type, item_name, description, is_available)
  VALUES 
    ('Breakfast', 'Ceylon Continental Platter', 'Fresh tropical fruits, artisan bakery basket, buffalo curd & treacle, and Ceylon tea.', 1),
    ('Breakfast', 'Traditional Sri Lankan Egg Hoppers', 'Crispy golden hoppers served with spicy katta sambol, seeni sambol, and lunu miris.', 1),
    ('Lunch', 'Southern Seafood Rice & Curry', 'Fresh catch lagoon prawns, yellow rice, dhal, pol sambol, and spiced mango chutney.', 1),
    ('Lunch', 'Char-Grilled Beef Burger', 'Prime beef patty with smoked cheddar, caramelized onions, and hand-cut truffle fries.', 1),
    ('Dinner', 'Pinnacle Bay Lobster Thermidor', 'Oven-baked whole lobster with creamy mustard sauce, gruyere glaze, and buttered asparagus.', 1),
-- ====================================================================
-- In-Room Dining & Room Service Orders Table (Vimaya to Kitchen)
-- ====================================================================
IF OBJECT_ID('dbo.RoomServiceOrders', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.RoomServiceOrders (
    order_id INT IDENTITY(1,1) PRIMARY KEY,
    room_number NVARCHAR(20) NOT NULL,
    guest_name NVARCHAR(100) NULL,
    meal_type NVARCHAR(20) NULL CHECK (meal_type IN ('Breakfast', 'Lunch', 'Dinner')),
    item_name NVARCHAR(150) NOT NULL,
    quantity INT DEFAULT 1,
    special_instructions NVARCHAR(255) NULL,
    status NVARCHAR(30) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PREPARING', 'DELIVERED')),
    order_time DATETIME DEFAULT GETDATE()
  );

  INSERT INTO dbo.RoomServiceOrders (room_number, guest_name, meal_type, item_name, quantity, special_instructions, status, order_time)
  VALUES 
    ('103', 'Eleanor Vance', 'Breakfast', 'Ceylon Continental Platter', 2, 'Deliver by 8:00 AM, extra tea bags', 'PENDING', DATEADD(MINUTE, -25, GETDATE())),
    ('202', 'Sophia Loren', 'Lunch', 'Southern Seafood Rice & Curry', 1, 'Extra spicy katta sambol on the side', 'PREPARING', DATEADD(MINUTE, -15, GETDATE())),
    ('101', 'Arthur Pendragon', 'Dinner', 'Pinnacle Bay Lobster Thermidor', 1, 'Room delivery at 7:30 PM', 'DELIVERED', DATEADD(HOUR, -2, GETDATE()));
END;
GO

-- ====================================================================
-- System Audit Logs Table
-- ====================================================================
IF OBJECT_ID('dbo.AuditLogs', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.AuditLogs (
    log_id INT IDENTITY(1,1) PRIMARY KEY,
    action NVARCHAR(100) NOT NULL,
    performed_by NVARCHAR(100) NOT NULL,
    module NVARCHAR(50) NULL,
    details NVARCHAR(MAX) NULL,
    timestamp DATETIME DEFAULT GETDATE()
  );

  INSERT INTO dbo.AuditLogs (action, performed_by, module, details, timestamp)
  VALUES
    ('User Login', 'Bimsara', 'Auth', 'Administrator logged in from IP 192.168.1.10', DATEADD(MINUTE, -10, GETDATE())),
    ('Invoice Settlement', 'Malith', 'Finance', 'Settled invoice INV-1001 for Rs. 1,350.00', DATEADD(MINUTE, -35, GETDATE())),
    ('Room Status Update', 'Hirushan', 'Housekeeping', 'Marked Room 101 as Clean', DATEADD(MINUTE, -60, GETDATE())),
    ('New Booking Created', 'Vimaya', 'Reception', 'Created reservation BK-405 for Selina Kyle', DATEADD(MINUTE, -120, GETDATE()));
END;
GO

-- ====================================================================
-- System Settings & Configuration Table
-- ====================================================================
IF OBJECT_ID('dbo.Settings', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.Settings (
    setting_key NVARCHAR(50) PRIMARY KEY,
    setting_value NVARCHAR(255) NOT NULL,
    updated_at DATETIME DEFAULT GETDATE()
  );

  INSERT INTO dbo.Settings (setting_key, setting_value)
  VALUES
    ('tax_percentage', '12.00'),
    ('service_charge_percentage', '10.00'),
    ('ot_hourly_rate', '1500.00'),
    ('default_check_in_time', '14:00'),
    ('default_check_out_time', '11:00'),
    ('hotel_name', 'Pinnacle Bay Luxury Resort & Spa'),
    ('currency', 'LKR');
END;
GO



