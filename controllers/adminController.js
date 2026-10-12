const bcrypt = require('bcryptjs');
const { sql, poolPromise, fallbackDb } = require('../config/db');

class AdminController {
  // 1. Staff / User Management
  static async getStaff(req, res) {
    try {
      let list = [];
      const pool = await poolPromise;
      if (pool) {
        const result = await pool.request().query(`
          SELECT id, user_id, name, email, role, designation, status, created_at 
          FROM Users 
          ORDER BY id DESC
        `);
        list = result.recordset;
      } else {
        list = fallbackDb.users;
      }

      // If called via /api/users or ?format=wrapper, return { success: true, users: [...] }
      if (req.originalUrl && (req.originalUrl.includes('/users') || req.query.format === 'wrapper')) {
        return res.status(200).json({ success: true, users: list });
      }
      return res.status(200).json(list);
    } catch (err) {
      console.error('Admin getStaff error:', err);
      if (req.originalUrl && (req.originalUrl.includes('/users') || req.query.format === 'wrapper')) {
        return res.status(200).json({ success: true, users: fallbackDb.users });
      }
      return res.status(200).json(fallbackDb.users);
    }
  }

  static async getUsers(req, res) {
    try {
      let list = [];
      const pool = await poolPromise;
      if (pool) {
        const result = await pool.request().query(`
          SELECT id, user_id, name, email, role, designation, status, created_at 
          FROM Users 
          ORDER BY id DESC
        `);
        list = result.recordset;
      } else {
        list = fallbackDb.users;
      }
      return res.status(200).json({ success: true, users: list });
    } catch (err) {
      console.error('Admin getUsers error:', err);
      return res.status(200).json({ success: true, users: fallbackDb.users });
    }
  }

  static async createStaff(req, res) {
    try {
      const { name, email, password, role, designation, status } = req.body;
      if (!name || !email || !password) {
        return res.status(400).json({ success: false, message: 'Name, email, and password are required' });
      }

      const newUserId = `PB-USR-${Math.floor(100 + Math.random() * 900)}`;
      const hashedPassword = await bcrypt.hash(password, 10);
      const finalRole = role || 'Staff';
      const finalDesignation = designation || 'Staff Member';
      const finalStatus = status || 'Active';

      const pool = await poolPromise;

      if (pool) {
        // 1. Insert into Users table
        await pool.request()
          .input('user_id', sql.VarChar, newUserId)
          .input('name', sql.VarChar, name)
          .input('email', sql.VarChar, email)
          .input('password', sql.VarChar, hashedPassword)
          .input('role', sql.VarChar, finalRole)
          .input('designation', sql.VarChar, finalDesignation)
          .input('status', sql.VarChar, finalStatus)
          .query(`
            INSERT INTO Users (user_id, name, email, password, role, designation, status, created_at)
            VALUES (@user_id, @name, @email, @password, @role, @designation, @status, GETDATE())
          `);

        // 2. Synchronize with Staff table
        try {
          await pool.request()
            .input('full_name', sql.NVarChar(150), name)
            .input('role', sql.NVarChar(100), finalDesignation || finalRole)
            .input('phone', sql.NVarChar(50), '')
            .input('basic_salary', sql.Decimal(10, 2), 75000.00)
            .input('status', sql.NVarChar(20), finalStatus.toUpperCase())
            .query(`
              IF NOT EXISTS (SELECT 1 FROM Staff WHERE full_name = @full_name)
              BEGIN
                INSERT INTO Staff (full_name, role, phone, basic_salary, status, created_at)
                VALUES (@full_name, @role, @phone, @basic_salary, @status, GETDATE())
              END
            `);
        } catch (stErr) {
          console.warn('Staff sync warning in createStaff:', stErr.message);
        }

        // 3. Log action in AuditLogs
        try {
          await pool.request()
            .input('action', sql.NVarChar(100), 'Staff Created')
            .input('performed_by', sql.NVarChar(100), req.user?.name || 'Administrator')
            .input('module', sql.NVarChar(50), 'Governance')
            .input('details', sql.NVarChar(sql.MAX), `Created user account for ${name} (${finalRole} - ${newUserId})`)
            .query(`
              IF EXISTS (SELECT * FROM sysobjects WHERE name='AuditLogs' AND xtype='U')
              BEGIN
                INSERT INTO AuditLogs (action, performed_by, module, details, timestamp)
                VALUES (@action, @performed_by, @module, @details, GETDATE())
              END
            `);
        } catch (logErr) {}
      }

      const newStaffRecord = {
        id: (fallbackDb.users ? fallbackDb.users.length : 0) + 101,
        user_id: newUserId,
        name,
        email,
        password: hashedPassword,
        role: finalRole,
        designation: finalDesignation,
        status: finalStatus
      };
      if (fallbackDb && Array.isArray(fallbackDb.users)) {
        fallbackDb.users.unshift(newStaffRecord);
      }
      if (fallbackDb && Array.isArray(fallbackDb.staff)) {
        if (!fallbackDb.staff.some(s => s.full_name === name)) {
          fallbackDb.staff.push({
            staff_id: fallbackDb.staff.length + 1,
            full_name: name,
            role: finalDesignation || finalRole,
            phone: '',
            basic_salary: 75000.00,
            status: finalStatus.toUpperCase(),
            created_at: new Date()
          });
        }
      }

      return res.status(201).json({
        success: true,
        message: 'Staff member added successfully',
        staff: newStaffRecord,
        user: newStaffRecord
      });
    } catch (err) {
      console.error('Admin createStaff error:', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  static async updateStaff(req, res) {
    try {
      const { id } = req.params;
      const { name, email, role, designation, status, password } = req.body;

      const pool = await poolPromise;
      let oldName = '';

      if (pool) {
        // Fetch existing user to synchronize Staff table by full_name
        try {
          const userRes = await pool.request()
            .input('id', sql.VarChar, String(id))
            .query(`SELECT name FROM Users WHERE user_id = @id OR CAST(id AS VARCHAR) = @id`);
          if (userRes.recordset.length > 0) {
            oldName = userRes.recordset[0].name;
          }
        } catch (fetchErr) {}

        let updateQuery = `
          UPDATE Users 
          SET name = COALESCE(@name, name),
              email = COALESCE(@email, email),
              role = COALESCE(@role, role),
              designation = COALESCE(@designation, designation),
              status = COALESCE(@status, status)
        `;

        const request = pool.request()
          .input('id', sql.VarChar, String(id))
          .input('name', sql.VarChar, name || null)
          .input('email', sql.VarChar, email || null)
          .input('role', sql.VarChar, role || null)
          .input('designation', sql.VarChar, designation || null)
          .input('status', sql.VarChar, status || null);

        if (password) {
          const hashed = await bcrypt.hash(password, 10);
          updateQuery += `, password = @password`;
          request.input('password', sql.VarChar, hashed);
        }

        updateQuery += ` WHERE user_id = @id OR CAST(id AS VARCHAR) = @id`;
        await request.query(updateQuery);

        // Synchronize Staff table
        if (name || role || designation || status) {
          try {
            await pool.request()
              .input('newName', sql.NVarChar(150), name || oldName)
              .input('oldName', sql.NVarChar(150), oldName || name)
              .input('newRole', sql.NVarChar(100), designation || role || null)
              .input('newStatus', sql.NVarChar(20), status ? status.toUpperCase() : null)
              .query(`
                UPDATE Staff 
                SET full_name = COALESCE(@newName, full_name),
                    role = COALESCE(@newRole, role),
                    status = COALESCE(@newStatus, status)
                WHERE full_name = @oldName OR full_name = @newName
              `);
          } catch (stUpdateErr) {
            console.warn('Staff sync warning in updateStaff:', stUpdateErr.message);
          }
        }

        // Audit Log
        try {
          await pool.request()
            .input('action', sql.NVarChar(100), 'Staff Updated')
            .input('performed_by', sql.NVarChar(100), req.user?.name || 'Administrator')
            .input('module', sql.NVarChar(50), 'Governance')
            .input('details', sql.NVarChar(sql.MAX), `Updated staff account ${name || oldName || id}`)
            .query(`
              IF EXISTS (SELECT * FROM sysobjects WHERE name='AuditLogs' AND xtype='U')
              BEGIN
                INSERT INTO AuditLogs (action, performed_by, module, details, timestamp)
                VALUES (@action, @performed_by, @module, @details, GETDATE())
              END
            `);
        } catch (logErr) {}
      }

      if (fallbackDb && Array.isArray(fallbackDb.users)) {
        const idx = fallbackDb.users.findIndex(u => String(u.id) === String(id) || u.user_id === id);
        if (idx !== -1) {
          fallbackDb.users[idx] = { ...fallbackDb.users[idx], ...req.body };
          if (oldName && fallbackDb.staff) {
            const stIdx = fallbackDb.staff.findIndex(s => s.full_name === oldName);
            if (stIdx !== -1) {
              if (name) fallbackDb.staff[stIdx].full_name = name;
              if (role || designation) fallbackDb.staff[stIdx].role = designation || role;
              if (status) fallbackDb.staff[stIdx].status = status.toUpperCase();
            }
          }
        }
      }

      return res.status(200).json({ success: true, message: 'Staff member updated successfully' });
    } catch (err) {
      console.error('Admin updateStaff error:', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  static async deleteStaff(req, res) {
    try {
      const { id } = req.params;
      const pool = await poolPromise;
      let userName = '';

      if (pool) {
        try {
          const userRes = await pool.request()
            .input('id', sql.VarChar, String(id))
            .query(`SELECT name, user_id FROM Users WHERE user_id = @id OR CAST(id AS VARCHAR) = @id`);
          if (userRes.recordset.length > 0) {
            userName = userRes.recordset[0].name;
          }
        } catch (fetchErr) {}

        // Delete from Users
        await pool.request()
          .input('id', sql.VarChar, String(id))
          .query(`DELETE FROM Users WHERE user_id = @id OR CAST(id AS VARCHAR) = @id`);

        // Synchronize Staff table deletion
        if (userName) {
          try {
            await pool.request()
              .input('name', sql.NVarChar(150), userName)
              .query(`DELETE FROM Staff WHERE full_name = @name`);
          } catch (stDelErr) {
            console.warn('Staff sync delete warning:', stDelErr.message);
          }
        }

        // Audit Log
        try {
          await pool.request()
            .input('action', sql.NVarChar(100), 'Staff Deleted')
            .input('performed_by', sql.NVarChar(100), req.user?.name || 'Administrator')
            .input('module', sql.NVarChar(50), 'Governance')
            .input('details', sql.NVarChar(sql.MAX), `Removed staff account ${userName || id}`)
            .query(`
              IF EXISTS (SELECT * FROM sysobjects WHERE name='AuditLogs' AND xtype='U')
              BEGIN
                INSERT INTO AuditLogs (action, performed_by, module, details, timestamp)
                VALUES (@action, @performed_by, @module, @details, GETDATE())
              END
            `);
        } catch (logErr) {}
      }

      if (fallbackDb && Array.isArray(fallbackDb.users)) {
        fallbackDb.users = fallbackDb.users.filter(u => String(u.id) !== String(id) && u.user_id !== id);
      }
      if (userName && fallbackDb && Array.isArray(fallbackDb.staff)) {
        fallbackDb.staff = fallbackDb.staff.filter(s => s.full_name !== userName);
      }

      return res.status(200).json({ success: true, message: 'Staff member removed successfully' });
    } catch (err) {
      console.error('Admin deleteStaff error:', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  // 2. Attendance Tracking
  static async getAttendance(req, res) {
    try {
      const pool = await poolPromise;
      if (pool) {
        const result = await pool.request().query(`
          SELECT * FROM Attendance ORDER BY id DESC
        `);
        return res.status(200).json(result.recordset);
      }
      return res.status(500).json({ success: false, message: 'Database connection not available' });
    } catch (err) {
      console.error('Admin getAttendance error:', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  static async getMonthlyAttendanceSummary(req, res) {
    try {
      const { staff_id, month } = req.query;
      const targetMonth = month || new Date().toISOString().slice(0, 7);

      let records = [];
      let staffSalary = 75000.00;
      const pool = await poolPromise;

      if (pool) {
        let q = `
          SELECT * FROM Attendance 
          WHERE CONVERT(VARCHAR(7), [date], 120) = @month
        `;
        const request = pool.request().input('month', sql.VarChar, targetMonth);
        if (staff_id) {
          q += ` AND (staff_id = @staff_id OR staff_name = @staff_id)`;
          request.input('staff_id', sql.VarChar, staff_id);
        }
        q += ` ORDER BY [date] ASC, id ASC`;

        try {
          const result = await request.query(q);
          records = result.recordset || [];
        } catch (dbErr) {
          console.warn('Attendance SQL error:', dbErr.message);
        }

        if (staff_id) {
          try {
            const stRes = await pool.request()
              .input('sid', sql.VarChar, staff_id)
              .query(`
                SELECT TOP 1 basic_salary FROM Staff WHERE CAST(staff_id AS VARCHAR) = @sid OR full_name = @sid
              `);
            if (stRes.recordset.length > 0) {
              staffSalary = parseFloat(stRes.recordset[0].basic_salary) || 75000.00;
            }
          } catch (stErr) {
            console.warn('Staff salary lookup error:', stErr.message);
          }
        }
      }

      if (records.length === 0 && fallbackDb && Array.isArray(fallbackDb.attendance)) {
        records = fallbackDb.attendance.filter(r => {
          const rDate = String(r.date || '');
          const matchMonth = rDate.startsWith(targetMonth);
          const matchStaff = !staff_id || String(r.staff_id) === String(staff_id) || String(r.staff_name) === String(staff_id);
          return matchMonth && matchStaff;
        });

        if (staff_id && Array.isArray(fallbackDb.staff)) {
          const st = fallbackDb.staff.find(s => String(s.staff_id) === String(staff_id) || s.full_name === staff_id);
          if (st) staffSalary = parseFloat(st.basic_salary) || 75000.00;
        }
      }

      let presentDays = 0;
      let absentDays = 0;
      let lateDays = 0;
      let totalOtHours = 0;

      records.forEach(r => {
        const st = (r.status || '').toUpperCase();
        if (st === 'PRESENT' || st === 'HALF DAY' || st === 'HALF-DAY') {
          presentDays++;
        } else if (st === 'ABSENT' || st === 'LEAVE') {
          absentDays++;
        }
        const inTime = r.clock_in_time || '';
        if (inTime && (inTime.includes('08:3') || inTime.includes('08:4') || inTime.includes('08:5') || inTime.includes('09:') || inTime.includes('10:'))) {
          lateDays++;
        }
        const ot = parseFloat(r.ot_hours !== undefined ? r.ot_hours : (r.extra_hours !== undefined ? r.extra_hours : 0)) || 0;
        totalOtHours += ot;
      });

      const [yearStr, mStr] = targetMonth.split('-');
      const year = parseInt(yearStr, 10) || new Date().getFullYear();
      const m = parseInt(mStr, 10) || (new Date().getMonth() + 1);
      const totalDays = new Date(year, m, 0).getDate();

      return res.status(200).json({
        success: true,
        staff_id: staff_id || 'All Staff',
        month: targetMonth,
        total_days: totalDays,
        present_days: presentDays,
        absent_days: absentDays,
        late_days: lateDays,
        days_worked: presentDays,
        leave_days: absentDays,
        ot_hours: totalOtHours,
        basic_salary: staffSalary,
        records
      });
    } catch (err) {
      console.error('Admin getMonthlyAttendanceSummary error:', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  static async recordAttendance(req, res) {
    try {
      const { staff_id, staff_name, date, shift_name, status, ot_hours, extra_hours, clock_in_time, clock_out_time } = req.body;
      const otVal = parseFloat(ot_hours !== undefined ? ot_hours : extra_hours) || 0;
      const attDate = date || new Date().toISOString().split('T')[0];
      const staffName = staff_name || 'Staff Member';
      const shift = shift_name || 'Morning Shift (8:00 AM - 5:00 PM)';
      const attStatus = status || 'Present';
      const clockIn = clock_in_time || '08:00 AM';
      const clockOut = clock_out_time || null;

      const pool = await poolPromise;
      if (!pool) {
        return res.status(500).json({ success: false, message: 'Database connection not available' });
      }

      const insertResult = await pool.request()
        .input('staff_id', sql.VarChar, staff_id || 'PB-USR-101')
        .input('staff_name', sql.VarChar, staffName)
        .input('date', sql.VarChar, attDate)
        .input('shift_name', sql.VarChar, shift)
        .input('status', sql.VarChar, attStatus)
        .input('ot_hours', sql.Decimal(4, 2), otVal)
        .input('extra_hours', sql.Decimal(4, 2), otVal)
        .input('clock_in', sql.NVarChar(20), clockIn)
        .input('clock_out', sql.NVarChar(20), clockOut)
        .query(`
          INSERT INTO Attendance (staff_id, staff_name, date, shift_name, status, ot_hours, extra_hours, clock_in_time, clock_out_time, created_at)
          OUTPUT INSERTED.*
          VALUES (@staff_id, @staff_name, @date, @shift_name, @status, @ot_hours, @extra_hours, @clock_in, @clock_out, GETDATE());
        `);

      const newRec = insertResult.recordset && insertResult.recordset[0] ? insertResult.recordset[0] : {
        staff_id: staff_id || 'PB-USR-101',
        staff_name: staffName,
        date: attDate,
        shift_name: shift,
        status: attStatus,
        ot_hours: otVal,
        extra_hours: otVal,
        clock_in_time: clockIn,
        clock_out_time: clockOut
      };

      return res.status(201).json({
        success: true,
        message: 'Attendance recorded successfully',
        record: newRec
      });
    } catch (err) {
      console.error('Admin recordAttendance error:', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  static async clockOutAttendance(req, res) {
    try {
      const { id } = req.params;
      const { staff_id, clock_out_time, ot_hours, extra_hours, status } = req.body;
      const otVal = parseFloat(ot_hours !== undefined ? ot_hours : extra_hours) || 0;
      const clockOut = clock_out_time || null;
      const attStatus = status || 'Present';

      const pool = await poolPromise;
      if (!pool) {
        return res.status(500).json({ success: false, message: 'Database connection not available' });
      }

      const updateResult = await pool.request()
        .input('id', sql.VarChar, String(id || ''))
        .input('staff_id', sql.VarChar, staff_id || '')
        .input('clockOut', sql.NVarChar(20), clockOut)
        .input('ot_hours', sql.Decimal(4, 2), otVal)
        .input('extra_hours', sql.Decimal(4, 2), otVal)
        .input('status', sql.VarChar, attStatus)
        .query(`
          UPDATE Attendance 
          SET clock_out_time = @clockOut, 
              ot_hours = @ot_hours, 
              extra_hours = @extra_hours, 
              status = @status 
          OUTPUT INSERTED.*
          WHERE id = @id OR CAST(id AS VARCHAR) = @id OR (staff_id = @staff_id AND staff_id <> '' AND CAST(date AS DATE) = CAST(GETDATE() AS DATE));
        `);

      const updatedRecord = updateResult.recordset && updateResult.recordset[0] ? updateResult.recordset[0] : { id, clock_out_time: clockOut, ot_hours: otVal, status: attStatus };

      return res.status(200).json({
        success: true,
        message: 'Clock-out and overtime recorded successfully',
        record: updatedRecord
      });
    } catch (err) {
      console.error('Admin clockOutAttendance error:', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  static async updateAttendance(req, res) {
    try {
      const { id } = req.params;
      const { date, shift_name, status, extra_hours, ot_hours, clock_in_time, clock_out_time } = req.body;
      const otVal = parseFloat(ot_hours !== undefined ? ot_hours : extra_hours) || 0;

      const pool = await poolPromise;
      if (!pool) {
        return res.status(500).json({ success: false, message: 'Database connection not available' });
      }

      const updateResult = await pool.request()
        .input('id', sql.VarChar, String(id))
        .input('date', sql.VarChar, date)
        .input('shift_name', sql.VarChar, shift_name)
        .input('status', sql.VarChar, status)
        .input('ot_hours', sql.Decimal(4, 2), otVal)
        .input('extra_hours', sql.Decimal(4, 2), otVal)
        .input('clock_in', sql.NVarChar(20), clock_in_time || null)
        .input('clock_out', sql.NVarChar(20), clock_out_time || null)
        .query(`
          UPDATE Attendance
          SET date = COALESCE(@date, date),
              shift_name = COALESCE(@shift_name, shift_name),
              status = COALESCE(@status, status),
              ot_hours = @ot_hours,
              extra_hours = @extra_hours,
              clock_in_time = COALESCE(@clock_in, clock_in_time),
              clock_out_time = COALESCE(@clock_out, clock_out_time)
          OUTPUT INSERTED.*
          WHERE id = @id OR CAST(id AS VARCHAR) = @id;
        `);

      const record = updateResult.recordset && updateResult.recordset[0] ? updateResult.recordset[0] : { id, ...req.body };

      return res.status(200).json({
        success: true,
        message: 'Attendance record updated successfully',
        record
      });
    } catch (err) {
      console.error('Admin updateAttendance error:', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  static async deleteAttendance(req, res) {
    try {
      const { id } = req.params;

      const pool = await poolPromise;
      if (!pool) {
        return res.status(500).json({ success: false, message: 'Database connection not available' });
      }

      await pool.request()
        .input('id', sql.VarChar, String(id))
        .query(`DELETE FROM Attendance WHERE id = @id OR CAST(id AS VARCHAR) = @id`);

      return res.status(200).json({
        success: true,
        message: 'Attendance record deleted successfully'
      });
    } catch (err) {
      console.error('Admin deleteAttendance error:', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  // 3. System Reports
  static async getReportsSummary(req, res) {
    try {
      const pool = await poolPromise;
      if (pool) {
        const [resStats, invStats, roomStats, userStats, attStats] = await Promise.all([
          pool.request().query(`
            SELECT 
              COUNT(*) AS total_reservations, 
              SUM(CASE WHEN status IN ('Confirmed', 'Checked-In', 'CheckedIn', 'Active') THEN 1 ELSE 0 END) AS confirmed_count, 
              ISNULL(SUM(total_amount), 0) AS total_booking_revenue 
            FROM Bookings
          `),
          pool.request().query(`
            SELECT 
              ISNULL(SUM(CASE WHEN LOWER(payment_status) = 'paid' OR LOWER(status) = 'paid' THEN total_amount ELSE 0 END), 0) AS total_revenue, 
              ISNULL(SUM(CASE WHEN LOWER(payment_status) != 'paid' AND LOWER(status) != 'paid' THEN total_amount ELSE 0 END), 0) AS pending_payments 
            FROM Invoices
          `),
          pool.request().query(`
            SELECT 
              COUNT(*) AS total_rooms, 
              SUM(CASE WHEN LOWER(status) = 'available' THEN 1 ELSE 0 END) AS clean_rooms, 
              SUM(CASE WHEN LOWER(status) != 'available' THEN 1 ELSE 0 END) AS dirty_or_in_progress 
            FROM Rooms
          `),
          pool.request().query(`
            SELECT 
              COUNT(*) AS total_staff, 
              SUM(CASE WHEN LOWER(status) = 'active' THEN 1 ELSE 0 END) AS active_staff 
            FROM Users
          `),
          pool.request().query(`
            SELECT 
              ISNULL(SUM(ot_hours), 0) AS total_ot_hours, 
              SUM(CASE WHEN LOWER(status) = 'present' THEN 1 ELSE 0 END) AS present_count 
            FROM Attendance
          `)
        ]);

        const rStat = resStats.recordset[0] || {};
        const iStat = invStats.recordset[0] || {};
        const rmStat = roomStats.recordset[0] || {};
        const uStat = userStats.recordset[0] || {};
        const aStat = attStats.recordset[0] || {};

        const totalRooms = rmStat.total_rooms || fallbackDb.rooms.length;
        const dirtyOrBusy = rmStat.dirty_or_in_progress || 0;
        const occRate = totalRooms > 0 ? Math.round((dirtyOrBusy / totalRooms) * 100) : 0;

        const summary = {
          reservations: {
            total_revenue: iStat.total_revenue || rStat.total_booking_revenue || 0,
            total_reservations: rStat.total_reservations || 0,
            confirmed_count: rStat.confirmed_count || 0,
            pending_payments: iStat.pending_payments || 0
          },
          rooms_and_turnaround: {
            occupancy_rate: occRate,
            total_rooms: totalRooms,
            clean_rooms: rmStat.clean_rooms || 0,
            dirty_or_in_progress: dirtyOrBusy
          },
          staff_and_payroll: {
            total_ot_hours: aStat.total_ot_hours || 0,
            active_staff: uStat.active_staff || 0,
            present_count: aStat.present_count || 0,
            total_staff: uStat.total_staff || 0
          }
        };

        return res.status(200).json({ success: true, summary });
      }

      return res.status(200).json({
        success: true,
        summary: {
          reservations: { total_revenue: 0, total_reservations: 0, confirmed_count: 0, pending_payments: 0 },
          rooms_and_turnaround: { occupancy_rate: 0, total_rooms: 0, clean_rooms: 0, dirty_or_in_progress: 0 },
          staff_and_payroll: { total_ot_hours: 0, active_staff: 0, present_count: 0, total_staff: 0 }
        }
      });
    } catch (err) {
      console.error('Admin getReportsSummary error:', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  static async getReservationLogs(req, res) {
    try {
      const { startDate, endDate } = req.query;
      const pool = await poolPromise;
      if (!pool) return res.status(200).json([]);

      let query = `
        SELECT TOP 100 
          b.booking_id,
          b.guest_name,
          COALESCE(b.guest_email, b.email, '') AS guest_email,
          COALESCE(b.phone, b.guest_phone, '') AS phone,
          b.room_number,
          b.room_number AS room_no,
          b.room_number AS room_assigned,
          CONVERT(VARCHAR(10), b.check_in, 120) AS check_in,
          CONVERT(VARCHAR(10), b.check_in, 120) AS check_in_date,
          CONVERT(VARCHAR(10), b.check_out, 120) AS check_out,
          CONVERT(VARCHAR(10), b.check_out, 120) AS check_out_date,
          COALESCE(b.total_amount, i.total_amount, 0) AS total_amount,
          b.status
        FROM Bookings b
        LEFT JOIN Invoices i ON b.booking_id = i.booking_id
        WHERE 1=1
      `;

      const request = pool.request();
      if (startDate && startDate.trim()) {
        query += ` AND b.check_in >= @startDate`;
        request.input('startDate', sql.VarChar, startDate.trim());
      }
      if (endDate && endDate.trim()) {
        query += ` AND b.check_out <= @endDate`;
        request.input('endDate', sql.VarChar, endDate.trim());
      }

      query += ` ORDER BY b.id DESC`;

      const result = await request.query(query);
      return res.status(200).json(result.recordset || []);
    } catch (err) {
      console.error('Admin getReservationLogs error:', err);
      return res.status(200).json([]);
    }
  }

  static async getHousekeepingLogs(req, res) {
    try {
      const pool = await poolPromise;
      if (!pool) return res.status(200).json([]);

      const result = await pool.request().query(`
        SELECT 
          r.room_number,
          r.room_number AS room_no,
          COALESCE(r.type, r.category, 'Standard') AS room_type,
          COALESCE(h.cleaning_status, r.status, 'Available') AS cleaning_status,
          COALESCE(h.assigned_staff, 'Housekeeping Team') AS assigned_staff,
          COALESCE(CONVERT(VARCHAR(19), h.last_cleaned, 120), CONVERT(VARCHAR(10), GETDATE(), 120)) AS last_cleaned
        FROM Rooms r
        LEFT JOIN Housekeeping h ON r.room_number = h.room_number
        ORDER BY r.room_number ASC
      `);

      return res.status(200).json(result.recordset || []);
    } catch (err) {
      console.error('Admin getHousekeepingLogs error:', err);
      return res.status(200).json([]);
    }
  }

  static async getPayrollLogs(req, res) {
    try {
      const pool = await poolPromise;
      if (!pool) return res.status(200).json([]);

      const result = await pool.request().query(`
        SELECT 
          u.user_id,
          u.user_id AS staff_id,
          u.name AS staff_name,
          u.name AS username,
          COALESCE(u.designation, u.role, 'Staff') AS designation,
          COUNT(a.id) AS days_present,
          SUM(CASE WHEN LOWER(a.status) LIKE '%half%' THEN 1 ELSE 0 END) AS half_days,
          COALESCE(SUM(a.ot_hours), SUM(a.extra_hours), 0) AS total_ot_hours,
          COALESCE(SUM(a.ot_hours), SUM(a.extra_hours), 0) AS extra_hours,
          (COUNT(a.id) * 5000.0) AS base_pay,
          (COALESCE(SUM(a.ot_hours), SUM(a.extra_hours), 0) * 1500.0) AS ot_pay,
          ((COUNT(a.id) * 5000.0) + (COALESCE(SUM(a.ot_hours), SUM(a.extra_hours), 0) * 1500.0)) AS total_payout,
          ((COUNT(a.id) * 5000.0) + (COALESCE(SUM(a.ot_hours), SUM(a.extra_hours), 0) * 1500.0)) AS total_estimated_payout
        FROM Users u
        LEFT JOIN Attendance a ON u.user_id = a.staff_id
        GROUP BY u.user_id, u.name, u.designation, u.role
        ORDER BY u.name ASC
      `);

      return res.status(200).json(result.recordset || []);
    } catch (err) {
      console.error('Admin getPayrollLogs error:', err);
      return res.status(200).json([]);
    }
  }

  static async getReportsDetails(req, res) {
    try {
      const { startDate, endDate } = req.query;
      const pool = await poolPromise;
      if (!pool) {
        return res.status(200).json({
          success: true,
          reservations: [],
          housekeeping: [],
          payroll: []
        });
      }

      let resQuery = `
        SELECT TOP 100 
          b.booking_id,
          b.guest_name,
          COALESCE(b.guest_email, b.email, '') AS guest_email,
          COALESCE(b.phone, b.guest_phone, '') AS phone,
          b.room_number,
          b.room_number AS room_no,
          b.room_number AS room_assigned,
          CONVERT(VARCHAR(10), b.check_in, 120) AS check_in,
          CONVERT(VARCHAR(10), b.check_in, 120) AS check_in_date,
          CONVERT(VARCHAR(10), b.check_out, 120) AS check_out,
          CONVERT(VARCHAR(10), b.check_out, 120) AS check_out_date,
          COALESCE(b.total_amount, i.total_amount, 0) AS total_amount,
          b.status
        FROM Bookings b
        LEFT JOIN Invoices i ON b.booking_id = i.booking_id
        WHERE 1=1
      `;

      const request = pool.request();
      if (startDate && startDate.trim()) {
        resQuery += ` AND b.check_in >= @startDate`;
        request.input('startDate', sql.VarChar, startDate.trim());
      }
      if (endDate && endDate.trim()) {
        resQuery += ` AND b.check_out <= @endDate`;
        request.input('endDate', sql.VarChar, endDate.trim());
      }
      resQuery += ` ORDER BY b.id DESC`;

      // Housekeeping query
      let hkQuery = `
        SELECT 
          r.room_number,
          r.room_number AS room_no,
          COALESCE(r.type, r.category, 'Standard') AS room_type,
          COALESCE(h.cleaning_status, r.status, 'Available') AS cleaning_status,
          COALESCE(h.assigned_staff, 'Housekeeping Team') AS assigned_staff,
          COALESCE(CONVERT(VARCHAR(19), h.last_cleaned, 120), CONVERT(VARCHAR(10), GETDATE(), 120)) AS last_cleaned
        FROM Rooms r
        LEFT JOIN Housekeeping h ON r.room_number = h.room_number
        WHERE 1=1
      `;
      const hkRequest = pool.request();
      if (startDate && startDate.trim()) {
        hkQuery += ` AND h.last_cleaned >= @hkStart`;
        hkRequest.input('hkStart', sql.VarChar, startDate.trim());
      }
      if (endDate && endDate.trim()) {
        hkQuery += ` AND h.last_cleaned <= @hkEnd`;
        hkRequest.input('hkEnd', sql.VarChar, endDate.trim() + ' 23:59:59');
      }
      hkQuery += ` ORDER BY r.room_number ASC`;

      // Attendance / Payroll query with date range support
      let attJoinFilter = '';
      const payRequest = pool.request();
      if (startDate && startDate.trim()) {
        attJoinFilter += ` AND a.date >= @attStart`;
        payRequest.input('attStart', sql.VarChar, startDate.trim());
      }
      if (endDate && endDate.trim()) {
        attJoinFilter += ` AND a.date <= @attEnd`;
        payRequest.input('attEnd', sql.VarChar, endDate.trim());
      }

      const payQuery = `
        SELECT 
          u.user_id,
          u.user_id AS staff_id,
          u.name AS staff_name,
          u.name AS username,
          COALESCE(u.designation, u.role, 'Staff') AS designation,
          COUNT(a.id) AS days_present,
          SUM(CASE WHEN LOWER(a.status) LIKE '%half%' THEN 1 ELSE 0 END) AS half_days,
          COALESCE(SUM(a.ot_hours), SUM(a.extra_hours), 0) AS total_ot_hours,
          COALESCE(SUM(a.ot_hours), SUM(a.extra_hours), 0) AS extra_hours,
          (COUNT(a.id) * 5000.0) AS base_pay,
          (COALESCE(SUM(a.ot_hours), SUM(a.extra_hours), 0) * 1500.0) AS ot_pay,
          ((COUNT(a.id) * 5000.0) + (COALESCE(SUM(a.ot_hours), SUM(a.extra_hours), 0) * 1500.0)) AS total_payout,
          ((COUNT(a.id) * 5000.0) + (COALESCE(SUM(a.ot_hours), SUM(a.extra_hours), 0) * 1500.0)) AS total_estimated_payout
        FROM Users u
        LEFT JOIN Attendance a ON u.user_id = a.staff_id ${attJoinFilter}
        GROUP BY u.user_id, u.name, u.designation, u.role
        ORDER BY u.name ASC
      `;

      const [reservationsRes, housekeepingRes, payrollRes] = await Promise.all([
        request.query(resQuery),
        hkRequest.query(hkQuery),
        payRequest.query(payQuery)
      ]);

      return res.status(200).json({
        success: true,
        reservations: reservationsRes.recordset || [],
        housekeeping: housekeepingRes.recordset || [],
        payroll: payrollRes.recordset || []
      });
    } catch (err) {
      console.error('Admin getReportsDetails error:', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  static async getAllLogs(req, res) {
    return AdminController.getReportsDetails(req, res);
  }

  // 4. High-level Dashboard Statistics & Metrics
  static async getMetrics(req, res) {
    try {
      let totalRevenue = 14250;
      let pendingAmount = 3100;
      let totalInvoices = 32;
      let completedInvoices = 28;
      let totalRooms = fallbackDb.rooms ? fallbackDb.rooms.length : 6;
      let occupiedRooms = (fallbackDb.bookings || []).filter(b => (b.status || '').toLowerCase() === 'confirmed' || (b.status || '').toLowerCase() === 'checked-in').length;

      const pool = await poolPromise;
      if (pool) {
        try {
          const invRes = await pool.request().query(`
            SELECT 
              SUM(CASE WHEN LOWER(payment_status) = 'paid' OR LOWER(status) = 'paid' THEN total_amount ELSE 0 END) AS total_revenue,
              SUM(CASE WHEN LOWER(payment_status) != 'paid' AND LOWER(status) != 'paid' THEN total_amount ELSE 0 END) AS pending_amount,
              COUNT(invoice_id) AS total_invoices,
              SUM(CASE WHEN LOWER(payment_status) = 'paid' OR LOWER(status) = 'paid' THEN 1 ELSE 0 END) AS completed_invoices
            FROM Invoices
          `);
          if (invRes.recordset.length > 0) {
            const row = invRes.recordset[0];
            totalRevenue = row.total_revenue || totalRevenue;
            pendingAmount = row.pending_amount || pendingAmount;
            totalInvoices = row.total_invoices || totalInvoices;
            completedInvoices = row.completed_invoices || completedInvoices;
          }
        } catch (dbErr) {}
      }

      return res.status(200).json({
        success: true,
        metrics: {
          totalRevenue,
          pendingAmount,
          totalInvoices,
          completedInvoices,
          totalRooms,
          occupiedRooms,
          occupancyRate: totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0
        }
      });
    } catch (err) {
      console.error('Admin getMetrics error:', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  // 5. System Audit Logs
  static async getAuditLogs(req, res) {
    try {
      const { startDate, endDate, user, module } = req.query;
      const pool = await poolPromise;

      if (pool) {
        try {
          let q = `
            SELECT 
              log_id AS id,
              log_id,
              action,
              performed_by AS [user],
              performed_by,
              module,
              details,
              timestamp
            FROM AuditLogs
            WHERE 1=1
          `;
          const request = pool.request();
          if (startDate && startDate.trim()) {
            q += ` AND timestamp >= @startDate`;
            request.input('startDate', sql.VarChar, startDate.trim());
          }
          if (endDate && endDate.trim()) {
            q += ` AND timestamp <= @endDate`;
            request.input('endDate', sql.VarChar, endDate.trim() + ' 23:59:59');
          }
          if (user && user !== 'all') {
            q += ` AND (performed_by LIKE @user OR performed_by = @user)`;
            request.input('user', sql.VarChar, `%${user.trim()}%`);
          }
          if (module && module !== 'all') {
            q += ` AND module = @module`;
            request.input('module', sql.VarChar, module.trim());
          }
          q += ` ORDER BY log_id DESC`;
          const result = await request.query(q);
          return res.status(200).json({ success: true, logs: result.recordset || [] });
        } catch (dbErr) {
          console.warn('AuditLogs live table query error, falling back:', dbErr.message);
        }
      }

      // Fallback in-memory logs
      let logs = [
        { id: 1, log_id: 1, action: 'User Login', user: 'Bimsara', performed_by: 'Bimsara', module: 'Auth', details: 'Administrator logged in from IP 192.168.1.10', timestamp: new Date(Date.now() - 10 * 60000) },
        { id: 2, log_id: 2, action: 'Invoice Settlement', user: 'Malith', performed_by: 'Malith', module: 'Finance', details: 'Settled invoice INV-1001 for Rs. 1,350.00', timestamp: new Date(Date.now() - 35 * 60000) },
        { id: 3, log_id: 3, action: 'Room Status Update', user: 'Hirushan', performed_by: 'Hirushan', module: 'Housekeeping', details: 'Marked Room 101 as Clean', timestamp: new Date(Date.now() - 60 * 60000) },
        { id: 4, log_id: 4, action: 'New Booking Created', user: 'Vimaya', performed_by: 'Vimaya', module: 'Reception', details: 'Created reservation BK-405 for Selina Kyle', timestamp: new Date(Date.now() - 120 * 60000) }
      ];

      if (user && user !== 'all') {
        logs = logs.filter(l => (l.user || l.performed_by || '').toLowerCase().includes(user.toLowerCase()));
      }
      if (module && module !== 'all') {
        logs = logs.filter(l => (l.module || '').toLowerCase() === module.toLowerCase());
      }

      return res.status(200).json({ success: true, logs });
    } catch (err) {
      console.error('Admin getAuditLogs error:', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  // 6. Report Logs & Shift Audit
  static async getShiftAuditReport(req, res) {
    try {
      const startDate = req.query.startDate || req.query.start_date;
      const endDate = req.query.endDate || req.query.end_date;
      const category = req.query.category;
      const paymentStatus = req.query.paymentStatus || req.query.payment_status;

      const pool = await poolPromise;
      if (!pool) return res.status(200).json([]);

      let query = `
        SELECT 
          b.booking_id,
          b.room_number,
          b.room_number AS room_no,
          b.room_number AS room,
          b.guest_name,
          COALESCE(b.guest_email, b.email, '') AS guest_email,
          COALESCE(b.phone, b.guest_phone, '') AS phone,
          CONCAT(COALESCE(r.type, r.category, 'Deluxe'), ' / ', COALESCE(r.ac_type, 'A/C')) AS room_category,
          COALESCE(r.type, r.category, 'Single Room') AS category,
          COALESCE(r.ac_type, 'A/C') AS ac_type,
          CONVERT(VARCHAR(10), b.check_in, 120) AS check_in,
          CONVERT(VARCHAR(10), b.check_in, 120) AS check_in_date,
          CONVERT(VARCHAR(10), b.check_out, 120) AS check_out,
          CONVERT(VARCHAR(10), b.check_out, 120) AS check_out_date,
          COALESCE(i.total_amount, b.total_amount, r.price_per_night, 25000.00) AS amount,
          COALESCE(i.total_amount, b.total_amount, r.price_per_night, 25000.00) AS total_amount,
          COALESCE(b.status, 'Confirmed') AS status,
          COALESCE(b.payment_status, i.payment_status, 'Pending') AS payment_status
        FROM Bookings b
        LEFT JOIN Rooms r ON b.room_number = r.room_number
        LEFT JOIN Invoices i ON b.booking_id = i.booking_id
        WHERE 1=1
      `;

      const request = pool.request();
      if (startDate && startDate.trim() && endDate && endDate.trim()) {
        query += ` AND b.check_in <= @endDate AND b.check_out >= @startDate`;
        request.input('startDate', sql.VarChar, startDate.trim());
        request.input('endDate', sql.VarChar, endDate.trim());
      } else if (startDate && startDate.trim()) {
        query += ` AND b.check_out >= @startDate`;
        request.input('startDate', sql.VarChar, startDate.trim());
      } else if (endDate && endDate.trim()) {
        query += ` AND b.check_in <= @endDate`;
        request.input('endDate', sql.VarChar, endDate.trim());
      }

      if (category && category !== 'All Categories' && category !== 'All') {
        query += ` AND (r.type LIKE @cat OR r.category LIKE @cat)`;
        request.input('cat', sql.VarChar, `%${category.trim()}%`);
      }
      if (paymentStatus && paymentStatus !== 'All') {
        query += ` AND (LOWER(b.payment_status) = @pStatus OR LOWER(i.payment_status) = @pStatus OR LOWER(b.status) = @pStatus)`;
        request.input('pStatus', sql.VarChar, paymentStatus.toLowerCase().trim());
      }

      query += ` ORDER BY b.id DESC`;

      const result = await request.query(query);
      const records = result.recordset || [];

      if (req.originalUrl && (req.originalUrl.includes('/summary') || req.query.format === 'wrapper')) {
        const totalRevenue = records.reduce((sum, r) => sum + (parseFloat(r.total_amount) || 0), 0);
        const checkIns = records.filter(r => (r.status || '').toLowerCase() === 'checked-in').length;
        const checkOuts = records.filter(r => (r.status || '').toLowerCase() === 'checked-out').length;
        return res.status(200).json({
          success: true,
          summary: {
            total_bookings: records.length,
            total_checkins: checkIns,
            total_checkouts: checkOuts,
            total_revenue: totalRevenue,
            unresolved_complaints: 0
          },
          bookings: records
        });
      }

      return res.status(200).json(records);
    } catch (err) {
      console.error("Admin shift audit report error:", err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  static async getReportLogs(req, res) {
    try {
      const pool = await poolPromise;
      if (pool) {
        const result = await pool.request().query(`
          IF EXISTS (SELECT * FROM sysobjects WHERE name='AuditLogs' AND xtype='U')
          BEGIN
              SELECT TOP 50 log_id, action, performed_by, timestamp, details FROM AuditLogs ORDER BY log_id DESC
          END
          ELSE
          BEGIN
              SELECT TOP 50 
                invoice_id AS log_id,
                'Invoice Created' AS action,
                'System' AS performed_by,
                created_at AS timestamp,
                CONCAT('Invoice generated with status ', COALESCE(payment_status, status, 'Pending')) AS details
              FROM Invoices
              ORDER BY invoice_id DESC
          END
        `);
        return res.json(result.recordset || []);
      }
      return res.json([]);
    } catch (err) {
      console.error("Error fetching report logs:", err);
      return res.json([]);
    }
  }
}

module.exports = AdminController;
