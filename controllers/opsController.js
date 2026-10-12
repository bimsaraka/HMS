const { sql, poolPromise, fallbackDb } = require('../config/db');

class OpsController {
  // ====================================================================
  // 1. HOUSEKEEPING & ROOM CLEANING GRID
  // ====================================================================
  static async getHousekeeping(req, res) {
    try {
      const pool = await poolPromise;
      if (pool) {
        const result = await pool.request().query(`
          SELECT * FROM Housekeeping ORDER BY room_number ASC
        `);
        return res.status(200).json(result.recordset);
      }
      return res.status(200).json(fallbackDb.housekeeping);
    } catch (err) {
      console.error('Ops getHousekeeping error:', err);
      return res.status(200).json(fallbackDb.housekeeping);
    }
  }

  static async updateHousekeeping(req, res) {
    try {
      const { room_number } = req.params;
      const { cleaning_status, assigned_staff } = req.body;
      const isClean = String(cleaning_status || '').toLowerCase() === 'clean';

      const pool = await poolPromise;
      if (pool) {
        await pool.request()
          .input('room_number', sql.VarChar, String(room_number))
          .input('cleaning_status', sql.VarChar, cleaning_status || 'Clean')
          .input('assigned_staff', sql.VarChar, assigned_staff || 'Staff')
          .query(`
            IF EXISTS (SELECT 1 FROM Housekeeping WHERE room_number = @room_number)
            BEGIN
              UPDATE Housekeeping 
              SET cleaning_status = @cleaning_status,
                  assigned_staff = @assigned_staff,
                  last_cleaned = GETDATE()
              WHERE room_number = @room_number;
            END
            ELSE
            BEGIN
              INSERT INTO Housekeeping (room_number, cleaning_status, assigned_staff, last_cleaned)
              VALUES (@room_number, @cleaning_status, @assigned_staff, GETDATE());
            END
          `);

        // Synchronize with Rooms table so Receptionist & booking views reflect live readiness
        if (isClean) {
          await pool.request()
            .input('room_number', sql.VarChar, String(room_number))
            .query(`
              UPDATE Rooms 
              SET status = 'Available' 
              WHERE room_number = @room_number AND LOWER(status) <> 'occupied'
            `);
        } else {
          await pool.request()
            .input('room_number', sql.VarChar, String(room_number))
            .query(`
              UPDATE Rooms 
              SET status = 'Dirty' 
              WHERE room_number = @room_number AND LOWER(status) <> 'occupied'
            `);
        }
      }

      const hk = fallbackDb.housekeeping.find(h => String(h.room_number) === String(room_number));
      if (hk) {
        if (cleaning_status) hk.cleaning_status = cleaning_status;
        if (assigned_staff) hk.assigned_staff = assigned_staff;
        hk.last_cleaned = new Date().toISOString().split('T')[0];
      }
      const rm = fallbackDb.rooms.find(r => String(r.room_number) === String(room_number));
      if (rm && (rm.status || '').toLowerCase() !== 'occupied') {
        rm.status = isClean ? 'Available' : 'Dirty';
      }

      return res.status(200).json({ success: true, message: `Housekeeping status updated for Room ${room_number}` });
    } catch (err) {
      console.error('Ops updateHousekeeping error:', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  // ====================================================================
  // 2. HOUSEKEEPING PACKAGES CRUD
  // ====================================================================
  static async getHousekeepingPackages(req, res) {
    try {
      const pool = await poolPromise;
      if (pool) {
        const result = await pool.request().query(`
          SELECT 
            package_id,
            package_name,
            ISNULL(category, 'Luxury') AS category,
            ISNULL(price, 0.00) AS price,
            ISNULL(description, '') AS description,
            ISNULL(included_items, '') AS included_items,
            ISNULL(included_items, '') AS items_included,
            created_at
          FROM Packages 
          ORDER BY package_id DESC
        `);

        const pkgs = result.recordset || [];
        return res.status(200).json({
          success: true,
          packages: pkgs
        });
      }
      return res.status(200).json({
        success: true,
        packages: fallbackDb.housekeepingPackages || []
      });
    } catch (err) {
      console.error('Ops getHousekeepingPackages error:', err);
      return res.status(200).json({ success: true, packages: fallbackDb.housekeepingPackages || [] });
    }
  }

  static async getPackages(req, res) {
    return OpsController.getHousekeepingPackages(req, res);
  }

  static async createPackage(req, res) {
    try {
      const { package_name, category, price, description, included_items } = req.body;
      const pkgName = package_name || req.body.name || 'New Package';
      const pkgCategory = category || 'Luxury';
      const pkgPrice = parseFloat(price) || 0.00;
      const pkgDesc = description || '';
      const pkgItems = included_items || req.body.items_included || '';

      const pool = await poolPromise;
      let insertedPackage = {
        package_name: pkgName,
        category: pkgCategory,
        price: pkgPrice,
        description: pkgDesc,
        included_items: pkgItems,
        items_included: pkgItems
      };

      if (pool) {
        try {
          const result = await pool.request()
            .input('package_name', sql.NVarChar(100), pkgName)
            .input('category', sql.NVarChar(50), pkgCategory)
            .input('price', sql.Decimal(10, 2), pkgPrice)
            .input('description', sql.NVarChar(sql.MAX), pkgDesc)
            .input('included_items', sql.NVarChar(sql.MAX), pkgItems)
            .query(`
              INSERT INTO Packages (package_name, category, price, description, included_items)
              OUTPUT INSERTED.package_id, INSERTED.package_name, INSERTED.category, INSERTED.price, INSERTED.description, INSERTED.included_items, INSERTED.created_at
              VALUES (@package_name, @category, @price, @description, @included_items)
            `);

          if (result.recordset && result.recordset.length > 0) {
            insertedPackage = result.recordset[0];
            insertedPackage.items_included = insertedPackage.included_items;
          }
        } catch (dbErr) {
          console.warn('DB createPackage error:', dbErr.message);
        }
      }

      fallbackDb.housekeepingPackages.unshift(insertedPackage);
      return res.status(201).json({
        success: true,
        message: "Package saved to DB",
        package: insertedPackage
      });
    } catch (err) {
      console.error('Ops createPackage error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  static async createHousekeepingPackage(req, res) {
    return OpsController.createPackage(req, res);
  }

  static async updateHousekeepingPackage(req, res) {
    try {
      const { id } = req.params;
      const { package_name, name, category, description, included_items, items_included, price } = req.body;
      const pkgName = package_name || name;
      const pkgItems = included_items || items_included;
      const pkgPrice = parseFloat(price) || 0;

      const pool = await poolPromise;
      if (pool) {
        try {
          await pool.request()
            .input('id', sql.Int, parseInt(id, 10))
            .input('name', sql.NVarChar, pkgName || '')
            .input('cat', sql.NVarChar, category || 'Luxury')
            .input('desc', sql.NVarChar, description || '')
            .input('items', sql.NVarChar, pkgItems || '')
            .input('price', sql.Decimal(10, 2), pkgPrice)
            .query(`
              IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Packages]') AND type in (N'U'))
              BEGIN
                UPDATE Packages 
                SET package_name = @name, category = @cat, description = @desc, included_items = @items, price = @price
                WHERE package_id = @id;
              END;
            `);
        } catch (dbErr) {
          console.warn('DB updateHousekeepingPackage error:', dbErr.message);
        }
      }

      const pkg = fallbackDb.housekeepingPackages.find(p => String(p.package_id) === String(id));
      if (pkg) {
        if (pkgName) pkg.package_name = pkgName;
        if (category) pkg.category = category;
        if (description !== undefined) pkg.description = description;
        if (pkgItems !== undefined) {
          pkg.items_included = pkgItems;
          pkg.included_items = pkgItems;
        }
        if (price !== undefined) pkg.price = pkgPrice;
      }

      return res.status(200).json({ success: true, message: 'Package updated successfully', package: pkg });
    } catch (err) {
      console.error('Ops updateHousekeepingPackage error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  static async deleteHousekeepingPackage(req, res) {
    try {
      const { id } = req.params;
      const pool = await poolPromise;
      if (pool) {
        try {
          await pool.request()
            .input('id', sql.Int, parseInt(id, 10))
            .query(`DELETE FROM Packages WHERE package_id = @id`);
        } catch (dbErr) {
          console.warn('DB deleteHousekeepingPackage error:', dbErr.message);
        }
      }

      fallbackDb.housekeepingPackages = fallbackDb.housekeepingPackages.filter(p => String(p.package_id) !== String(id));
      return res.status(200).json({ success: true, message: 'Package deleted successfully' });
    } catch (err) {
      console.error('Ops deleteHousekeepingPackage error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // ====================================================================
  // 3. HOUSEKEEPING ASSIGNMENTS (Table: RoomPackageAssignments)
  // ====================================================================
  static async getHousekeepingAssignments(req, res) {
    try {
      const pool = await poolPromise;
      if (pool) {
        const result = await pool.request().query(`
          SELECT 
            a.assignment_id,
            a.room_number,
            a.package_id,
            COALESCE(p.package_name, 'Custom Package') AS package_name,
            COALESCE(p.included_items, '') AS included_items,
            COALESCE(p.included_items, '') AS items_included,
            a.assigned_by,
            a.notes,
            a.status,
            a.assigned_date,
            a.created_at
          FROM RoomPackageAssignments a
          LEFT JOIN Packages p ON a.package_id = p.package_id
          ORDER BY a.assignment_id DESC
        `);
        return res.status(200).json({
          success: true,
          assignments: result.recordset
        });
      }
      return res.status(200).json({
        success: true,
        assignments: fallbackDb.packageAssignments || []
      });
    } catch (err) {
      console.error('Ops getHousekeepingAssignments error:', err);
      return res.status(200).json({ success: true, assignments: fallbackDb.packageAssignments || [] });
    }
  }

  static async createHousekeepingAssignment(req, res) {
    try {
      const { room_number, package_id, assigned_by, notes, status } = req.body;
      const rNum = String(room_number || '101');
      const pId = parseInt(package_id, 10) || 1;
      const by = assigned_by || 'Operations Lead';
      const n = notes || '';
      const st = status || 'Pending';

      const pool = await poolPromise;
      let newId = null;
      let pkgName = 'Custom Package';

      if (pool) {
        try {
          const pkgRes = await pool.request().input('pid', sql.Int, pId).query(`SELECT package_name FROM Packages WHERE package_id = @pid`);
          if (pkgRes.recordset.length > 0) pkgName = pkgRes.recordset[0].package_name;

          const insertRes = await pool.request()
            .input('room_number', sql.NVarChar, rNum)
            .input('package_id', sql.Int, pId)
            .input('assigned_by', sql.NVarChar, by)
            .input('notes', sql.NVarChar, n)
            .input('status', sql.NVarChar, st)
            .query(`
              INSERT INTO RoomPackageAssignments (room_number, package_id, assigned_by, notes, status, assigned_date)
              OUTPUT INSERTED.assignment_id
              VALUES (@room_number, @package_id, @assigned_by, @notes, @status, CAST(GETDATE() AS DATE))
            `);
          newId = insertRes.recordset[0]?.assignment_id;

          try {
            await pool.request()
              .input('pkgName', sql.NVarChar, pkgName)
              .input('room_number', sql.NVarChar, rNum)
              .query(`UPDATE Rooms SET assigned_package = @pkgName WHERE room_number = @room_number`);
          } catch(e) {}

        } catch (dbErr) {
          console.warn('DB createHousekeepingAssignment error:', dbErr.message);
        }
      }

      const newAssignment = {
        assignment_id: newId || ((fallbackDb.packageAssignments ? fallbackDb.packageAssignments.length : 0) + 1),
        room_number: rNum,
        package_id: pId,
        package_name: pkgName,
        assigned_by: by,
        notes: n,
        status: st,
        assigned_date: new Date().toISOString().split('T')[0],
        created_at: new Date()
      };

      if (!fallbackDb.packageAssignments) fallbackDb.packageAssignments = [];
      fallbackDb.packageAssignments.unshift(newAssignment);

      return res.status(201).json({ success: true, message: `Package assigned to Room ${rNum}`, assignment: newAssignment });
    } catch (err) {
      console.error('Ops createHousekeepingAssignment error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  static async updateHousekeepingAssignment(req, res) {
    try {
      const { id } = req.params;
      const { status, notes } = req.body;
      const numId = parseInt(String(id).replace(/\D/g, ''), 10);

      const pool = await poolPromise;
      if (pool && !isNaN(numId)) {
        try {
          await pool.request()
            .input('id', sql.Int, numId)
            .input('status', sql.NVarChar, status || null)
            .input('notes', sql.NVarChar, notes || null)
            .query(`
              UPDATE RoomPackageAssignments SET
                status = COALESCE(@status, status),
                notes = COALESCE(@notes, notes)
              WHERE assignment_id = @id
            `);
        } catch (dbErr) {
          console.warn('DB updateHousekeepingAssignment error:', dbErr.message);
        }
      }

      const a = (fallbackDb.packageAssignments || []).find(item => String(item.assignment_id || item.id) === String(id));
      if (a) {
        if (status) a.status = status;
        if (notes !== undefined) a.notes = notes;
      }

      return res.status(200).json({ success: true, message: 'Assignment status updated', assignment: a });
    } catch (err) {
      console.error('Ops updateHousekeepingAssignment error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  static async deleteHousekeepingAssignment(req, res) {
    try {
      const { id } = req.params;
      const numId = parseInt(String(id).replace(/\D/g, ''), 10);

      const pool = await poolPromise;
      if (pool && !isNaN(numId)) {
        try {
          await pool.request().input('id', sql.Int, numId).query(`DELETE FROM RoomPackageAssignments WHERE assignment_id = @id`);
        } catch (dbErr) {
          console.warn('DB deleteHousekeepingAssignment error:', dbErr.message);
        }
      }

      if (fallbackDb.packageAssignments) {
        fallbackDb.packageAssignments = fallbackDb.packageAssignments.filter(a => String(a.assignment_id || a.id) !== String(id));
      }
      return res.status(200).json({ success: true, message: 'Assignment deleted' });
    } catch (err) {
      console.error('Ops deleteHousekeepingAssignment error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // ====================================================================
  // 4. IN-ROOM DINING & KITCHEN ORDERS (Table: RoomServiceOrders)
  // ====================================================================
  static async getDiningOrders(req, res) {
    try {
      const { status, room, room_number } = req.query;
      const targetRoom = room || room_number;
      const pool = await poolPromise;

      let allOrders = [];
      let filteredOrders = [];

      if (pool) {
        try {
          let query = 'SELECT * FROM RoomServiceOrders WHERE 1=1';
          const request = pool.request();

          if (targetRoom) {
            query += ' AND (room_number = @room OR room_number = @room_no)';
            request.input('room', sql.NVarChar(20), String(targetRoom));
            request.input('room_no', sql.NVarChar(20), String(targetRoom));
          }

          if (status && status.toLowerCase() !== 'all') {
            const st = status.toLowerCase().trim();
            if (st === 'active') {
              query += " AND UPPER(status) IN ('PENDING', 'PREPARING')";
            } else if (st === 'billed' || st === 'folio' || st === 'paid') {
              query += " AND UPPER(status) IN ('BILLED', 'PAID', 'FOLIO')";
            } else {
              query += " AND LOWER(status) = @status";
              request.input('status', sql.NVarChar(50), st);
            }
          }

          query += ' ORDER BY order_id DESC';
          const result = await request.query(query);
          filteredOrders = result.recordset || [];

          // Also fetch all orders to compute accurate KPI counts
          const allRes = await pool.request().query('SELECT * FROM RoomServiceOrders');
          allOrders = allRes.recordset || [];
        } catch (dbErr) {
          console.warn('DB getDiningOrders error:', dbErr.message);
        }
      }

      if (allOrders.length === 0) {
        allOrders = fallbackDb.roomServiceOrders || [];
        filteredOrders = allOrders.filter(o => {
          let matchRoom = true;
          if (targetRoom) {
            matchRoom = String(o.room_number) === String(targetRoom);
          }
          let matchStatus = true;
          if (status && status.toLowerCase() !== 'all') {
            const st = status.toLowerCase().trim();
            const orderStatus = (o.status || '').toLowerCase().trim();
            if (st === 'active') {
              matchStatus = orderStatus === 'pending' || orderStatus === 'preparing';
            } else if (st === 'billed' || st === 'folio' || st === 'paid') {
              matchStatus = orderStatus === 'billed' || orderStatus === 'folio' || orderStatus === 'paid';
            } else {
              matchStatus = orderStatus === st;
            }
          }
          return matchRoom && matchStatus;
        });
      }

      const activeCount = allOrders.filter(o => ['PENDING', 'PREPARING'].includes((o.status || '').toUpperCase())).length;
      const pendingCount = allOrders.filter(o => (o.status || '').toUpperCase() === 'PENDING').length;
      const preparingCount = allOrders.filter(o => (o.status || '').toUpperCase() === 'PREPARING').length;
      const deliveredCount = allOrders.filter(o => (o.status || '').toUpperCase() === 'DELIVERED').length;
      const billedCount = allOrders.filter(o => ['BILLED', 'PAID', 'FOLIO'].includes((o.status || '').toUpperCase())).length;
      const dailyRevenue = allOrders.reduce((sum, o) => {
        const p = parseFloat(o.total_price != null ? o.total_price : ((parseFloat(o.price) || 20) * (parseInt(o.quantity, 10) || 1))) || 0;
        return sum + p;
      }, 0);

      const counts = {
        total: allOrders.length,
        active: activeCount,
        pending: pendingCount,
        preparing: preparingCount,
        delivered: deliveredCount,
        billed: billedCount,
        daily_revenue: dailyRevenue
      };

      // Standardize response supporting both wrapped objects and raw array formats
      return res.status(200).json({
        success: true,
        orders: filteredOrders,
        data: filteredOrders,
        counts: counts,
        daily_revenue: dailyRevenue
      });
    } catch (err) {
      console.error('Ops getDiningOrders error:', err);
      return res.status(500).json({ success: false, message: err.message, orders: [], data: [] });
    }
  }

  static async createDiningOrder(req, res) {
    try {
      const room_number = req.body.room_number || req.body.room_no || '101';
      const item_name = req.body.item_name || req.body.dish_name || 'Meal Item';
      const special_instructions = req.body.special_instructions || req.body.special_notes || '';
      const meal_type = req.body.meal_type || req.body.meal_session || 'Lunch';
      const guest_name = req.body.guest_name || 'Guest';
      const quantity = parseInt(req.body.quantity, 10) || 1;

      const newOrder = {
        order_id: fallbackDb.roomServiceOrders.length + 1,
        room_number: String(room_number),
        guest_name: guest_name,
        meal_type: meal_type,
        item_name: item_name,
        quantity: quantity,
        special_instructions: special_instructions,
        status: 'PENDING',
        order_time: new Date()
      };

      const pool = await poolPromise;
      if (pool) {
        try {
          if (guest_name === 'Guest') {
            const guestRes = await pool.request()
              .input('rn', sql.NVarChar(20), String(room_number))
              .query("SELECT TOP 1 guest_name FROM Bookings WHERE room_number = @rn AND status IN ('Checked In', 'Confirmed') ORDER BY booking_id DESC");
            if (guestRes.recordset && guestRes.recordset.length > 0 && guestRes.recordset[0].guest_name) {
              newOrder.guest_name = guestRes.recordset[0].guest_name;
            }
          }

          const insertRes = await pool.request()
            .input('room_number', sql.NVarChar, newOrder.room_number)
            .input('guest_name', sql.NVarChar, newOrder.guest_name)
            .input('meal_type', sql.NVarChar, newOrder.meal_type)
            .input('item_name', sql.NVarChar, newOrder.item_name)
            .input('quantity', sql.Int, newOrder.quantity)
            .input('special_instructions', sql.NVarChar, newOrder.special_instructions)
            .input('status', sql.NVarChar, 'PENDING')
            .query(`
              INSERT INTO RoomServiceOrders (room_number, guest_name, meal_type, item_name, quantity, special_instructions, status, order_time)
              OUTPUT INSERTED.order_id
              VALUES (@room_number, @guest_name, @meal_type, @item_name, @quantity, @special_instructions, @status, GETDATE())
            `);
          if (insertRes.recordset.length > 0) {
            newOrder.order_id = insertRes.recordset[0].order_id;
          }
        } catch (dbErr) {
          console.warn('DB createDiningOrder error:', dbErr.message);
        }
      }

      fallbackDb.roomServiceOrders.unshift(newOrder);

      return res.status(201).json({
        success: true,
        message: 'Dining order placed successfully',
        order: newOrder
      });
    } catch (err) {
      console.error('Ops createDiningOrder error:', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  static async updateDiningOrderStatus(req, res) {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const numId = parseInt(String(id).replace(/\D/g, ''), 10);

      const pool = await poolPromise;
      if (pool && !isNaN(numId)) {
        try {
          await pool.request()
            .input('id', sql.Int, numId)
            .input('status', sql.NVarChar, status)
            .query(`UPDATE RoomServiceOrders SET status = @status WHERE order_id = @id`);
        } catch (dbErr) {
          console.warn('DB updateDiningOrderStatus error:', dbErr.message);
        }
      }

      const ord = fallbackDb.roomServiceOrders.find(o => String(o.order_id) === String(id));
      if (ord) ord.status = status;

      return res.status(200).json({ success: true, message: `Order status updated to ${status}` });
    } catch (err) {
      console.error('Ops updateDiningOrderStatus error:', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  // ====================================================================
  // 5. DAILY KITCHEN MENU & PAX HEADCOUNT
  // ====================================================================
  static async getMenuItems(req, res) {
    try {
      const pool = await poolPromise;
      if (pool) {
        const result = await pool.request().query(`
          SELECT * FROM MenuItems ORDER BY item_id ASC
        `);
        return res.status(200).json(result.recordset);
      }
      return res.status(200).json(fallbackDb.menuItems);
    } catch (err) {
      console.error('Ops getMenuItems error:', err);
      return res.status(200).json(fallbackDb.menuItems);
    }
  }

  static async getMealPaxCount(req, res) {
    try {
      let activeCheckedInCount = 5;
      const pool = await poolPromise;
      if (pool) {
        try {
          const r = await pool.request().query(`
            SELECT COUNT(*) as pax_count FROM Bookings WHERE LOWER(status) = 'checked-in' OR LOWER(status) = 'confirmed'
          `);
          if (r.recordset.length > 0) activeCheckedInCount = r.recordset[0].pax_count || activeCheckedInCount;
        } catch (e) {}
      }

      const estimatedBreakfastPax = Math.max(activeCheckedInCount * 2, 4);
      const estimatedLunchPax = Math.max(Math.round(activeCheckedInCount * 1.5), 3);
      const estimatedDinnerPax = Math.max(activeCheckedInCount * 2, 5);

      return res.status(200).json({
        success: true,
        checkedInRooms: activeCheckedInCount,
        pax: {
          breakfast: estimatedBreakfastPax,
          lunch: estimatedLunchPax,
          dinner: estimatedDinnerPax,
          totalDailyForecast: estimatedBreakfastPax + estimatedLunchPax + estimatedDinnerPax
        }
      });
    } catch (err) {
      console.error('Ops getMealPaxCount error:', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  // ====================================================================
  // 6. ROOM INVENTORY & STATUS MANAGEMENT
  // ====================================================================
  static async getHousekeepingRooms(req, res) {
    try {
      const pool = await poolPromise;
      if (pool) {
        try {
          const result = await pool.request().query(`
            SELECT 
              id,
              room_number,
              room_number AS room_id,
              room_number AS room_no,
              category,
              category AS room_type,
              type,
              ac_type,
              price_per_night,
              price_per_night AS rate_per_night,
              ISNULL(status, 'Available') AS status,
              image_url,
              assigned_package,
              CASE 
                WHEN LOWER(status) = 'dirty' OR LOWER(status) = 'cleaning' THEN 'Needs Cleaning'
                WHEN LOWER(status) = 'occupied' THEN 'Occupied'
                WHEN LOWER(status) = 'maintenance' THEN 'Maintenance'
                ELSE 'Cleaned & Ready'
              END AS housekeeping_status,
              CASE
                WHEN LOWER(status) = 'dirty' OR LOWER(status) = 'cleaning' THEN 'Dirty'
                ELSE 'Clean'
              END AS cleaning_status
            FROM Rooms
            ORDER BY room_number ASC
          `);
          if (result.recordset && result.recordset.length > 0) {
            return res.status(200).json(result.recordset);
          }
        } catch (dbErr) {
          console.warn('DB getHousekeepingRooms query error, using fallback format:', dbErr.message);
        }
      }

      const mapped = fallbackDb.rooms.map(r => {
        const st = (r.status || 'Available');
        const stLower = st.toLowerCase();
        return {
          id: r.id,
          room_number: r.room_number || r.room_no,
          room_no: r.room_number || r.room_no,
          room_id: r.room_number || r.room_no,
          category: r.category || r.type || 'Single Room',
          room_type: r.category || r.type || 'Single Room',
          type: r.type || r.category || 'Single Room',
          ac_type: r.ac_type || 'A/C',
          price_per_night: r.price_per_night || 30,
          rate_per_night: r.price_per_night || 30,
          image_url: r.image_url,
          status: st,
          housekeeping_status: (stLower === 'dirty' || stLower === 'cleaning') ? 'Needs Cleaning' : (stLower === 'occupied' ? 'Occupied' : (stLower === 'maintenance' ? 'Maintenance' : 'Cleaned & Ready')),
          cleaning_status: (stLower === 'dirty' || stLower === 'cleaning') ? 'Dirty' : 'Clean'
        };
      });
      return res.status(200).json(mapped);
    } catch (err) {
      console.error('Ops getHousekeepingRooms error:', err);
      return res.status(500).json({ error: err.message, success: false });
    }
  }

  static async updateRoomStatus(req, res) {
    try {
      const { roomNo } = req.params;
      const { status, cleaning_status } = req.body;
      const finalStatus = status || (cleaning_status === 'Clean' ? 'Available' : 'Dirty');

      const pool = await poolPromise;
      if (pool) {
        try {
          await pool.request()
            .input('room_number', sql.VarChar, String(roomNo))
            .input('status', sql.VarChar, finalStatus)
            .query(`UPDATE Rooms SET status = @status WHERE room_number = @room_number OR CAST(id AS VARCHAR) = @room_number`);
        } catch (dbErr) {
          console.warn('DB updateRoomStatus error:', dbErr.message);
        }
      }

      const r = fallbackDb.rooms.find(rm => String(rm.room_number || rm.room_no) === String(roomNo));
      if (r) {
        r.status = finalStatus;
        if (cleaning_status) r.cleaning_status = cleaning_status;
      }

      return res.status(200).json({ success: true, message: `Room ${roomNo} status updated to ${finalStatus}` });
    } catch (err) {
      console.error('Ops updateRoomStatus error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  static async updateRoomPhoto(req, res) {
    try {
      const { roomNo } = req.params;
      const { image_url, imageUrl } = req.body;
      const finalUrl = image_url || imageUrl || '';

      const pool = await poolPromise;
      if (pool) {
        try {
          await pool.request()
            .input('room_number', sql.VarChar, String(roomNo))
            .input('image_url', sql.NVarChar, finalUrl)
            .query(`UPDATE Rooms SET image_url = @image_url WHERE room_number = @room_number OR CAST(id AS VARCHAR) = @room_number`);
        } catch (dbErr) {}
      }

      const r = fallbackDb.rooms.find(rm => String(rm.room_number) === String(roomNo));
      if (r) r.image_url = finalUrl;

      return res.status(200).json({ success: true, message: 'Room photo updated successfully' });
    } catch (err) {
      console.error('Ops updateRoomPhoto error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  static async createRoom(req, res) {
    try {
      const { room_number, roomNo, category, type, ac_type, acType, price_per_night, price, image_url, imageUrl } = req.body;
      const rNum = String(room_number || roomNo || '');
      const rCat = category || type || 'Single Room';
      const rType = type || category || 'Single Room';
      const rAc = ac_type || acType || 'A/C';
      const rPrice = parseFloat(price_per_night || price) || 45.00;
      const rImg = image_url || imageUrl || 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=80';

      const pool = await poolPromise;
      if (pool) {
        try {
          await pool.request()
            .input('room_number', sql.VarChar, rNum)
            .input('category', sql.VarChar, rCat)
            .input('ac_type', sql.VarChar, rAc)
            .input('type', sql.VarChar, rType)
            .input('price_per_night', sql.Decimal(10, 2), rPrice)
            .input('status', sql.VarChar, 'Available')
            .input('image_url', sql.NVarChar, rImg)
            .query(`
              INSERT INTO Rooms (room_number, category, ac_type, type, price_per_night, status, image_url)
              VALUES (@room_number, @category, @ac_type, @type, @price_per_night, @status, @image_url)
            `);
        } catch (dbErr) {
          console.warn('DB createRoom error:', dbErr.message);
        }
      }

      const newRoom = {
        id: String(fallbackDb.rooms.length + 1),
        room_number: rNum,
        category: rCat,
        type: rType,
        ac_type: rAc,
        price_per_night: rPrice,
        status: 'Available',
        image_url: rImg
      };
      fallbackDb.rooms.push(newRoom);

      return res.status(201).json({ success: true, message: 'Room created successfully', room: newRoom });
    } catch (err) {
      console.error('Ops createRoom error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  static async updateRoom(req, res) {
    try {
      const { roomNo } = req.params;
      const { category, room_category, ac_type, ac_configuration, price_per_night, price, image_url, status } = req.body;

      const rCat = category || room_category || 'Single Room';
      const rAc = ac_type || ac_configuration || 'A/C';
      const rPrice = parseFloat(price_per_night !== undefined ? price_per_night : price) || 45.00;
      const pool = await poolPromise;

      if (pool) {
        try {
          let q = `
            UPDATE Rooms 
            SET category = @category,
                type = @category,
                ac_type = @ac_type,
                price_per_night = @price_per_night
          `;
          if (image_url) q += `, image_url = @image_url`;
          if (status) q += `, status = @status`;
          q += ` WHERE room_number = @room_number OR CAST(id AS VARCHAR) = @room_number`;

          const reqObj = pool.request()
            .input('room_number', sql.VarChar, String(roomNo))
            .input('category', sql.VarChar, rCat)
            .input('ac_type', sql.VarChar, rAc)
            .input('price_per_night', sql.Decimal(10, 2), rPrice);
          if (image_url) reqObj.input('image_url', sql.NVarChar, image_url);
          if (status) reqObj.input('status', sql.VarChar, status);

          await reqObj.query(q);
        } catch (dbErr) {
          console.warn('DB updateRoom error:', dbErr.message);
        }
      }

      const r = fallbackDb.rooms.find(rm => String(rm.room_number) === String(roomNo) || String(rm.id) === String(roomNo));
      if (r) {
        r.category = rCat;
        r.type = rCat;
        r.room_type = rCat;
        r.ac_type = rAc;
        r.price_per_night = rPrice;
        if (image_url) r.image_url = image_url;
        if (status) r.status = status;
      }

      return res.status(200).json({ success: true, message: `Room ${roomNo} updated successfully`, room: r });
    } catch (err) {
      console.error('Ops updateRoom error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  static async deleteRoom(req, res) {
    try {
      const { roomNo } = req.params;
      const pool = await poolPromise;
      if (pool) {
        try {
          await pool.request()
            .input('room_number', sql.VarChar, String(roomNo))
            .query(`DELETE FROM Rooms WHERE room_number = @room_number OR CAST(id AS VARCHAR) = @room_number`);
        } catch (dbErr) {}
      }

      fallbackDb.rooms = fallbackDb.rooms.filter(r => String(r.room_number) !== String(roomNo) && String(r.id) !== String(roomNo));
      return res.status(200).json({ success: true, message: `Room ${roomNo} deleted successfully` });
    } catch (err) {
      console.error('Ops deleteRoom error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // ====================================================================
  // 7. OPERATIONS & HOUSEKEEPING REQUESTS
  // ====================================================================
  static async getOpsRequests(req, res) {
    try {
      let requests = [];
      const pool = await poolPromise;
      if (pool) {
        try {
          const mResult = await pool.request().query(`
            SELECT 
              task_id AS id, 
              task_id AS request_id,
              room_number, 
              issue AS type, 
              issue AS request_type,
              issue AS description, 
              priority, 
              status, 
              reported_at AS created_at, 
              'maintenance' AS source,
              'Maintenance' AS source_label
            FROM Maintenance
          `);
          const cResult = await pool.request().query(`
            SELECT 
              'CMP-' + CAST(complaint_id AS VARCHAR) AS id, 
              complaint_id AS request_id,
              room_number, 
              guest_name,
              category AS type, 
              category AS request_type,
              description, 
              priority, 
              status, 
              created_at, 
              'complaint' AS source,
              'Guest Complaint' AS source_label
            FROM Complaints
          `);
          const rResult = await pool.request().query(`
            SELECT 
              'REQ-' + CAST(request_id AS VARCHAR) AS id, 
              request_id,
              room_number, 
              guest_name,
              request_type AS type, 
              request_type,
              notes AS description, 
              notes,
              priority, 
              status, 
              created_at, 
              'request' AS source,
              'Guest Request' AS source_label
            FROM SpecialRequests
          `);
          requests = [...mResult.recordset, ...cResult.recordset, ...rResult.recordset];
          if (requests.length > 0) {
            return res.status(200).json({
              success: true,
              requests
            });
          }
        } catch (dbErr) {}
      }

      const mappedComplaints = (fallbackDb.complaints || []).map(c => ({
        id: `CMP-${c.complaint_id}`,
        request_id: c.complaint_id,
        room_number: c.room_number,
        guest_name: c.guest_name,
        type: c.category || 'Complaint',
        request_type: c.category || 'Complaint',
        description: c.description,
        priority: c.priority || 'Medium',
        status: c.status || 'Open',
        created_at: c.created_at || new Date(),
        source: 'complaint',
        source_label: 'Guest Complaint'
      }));

      const mappedRequests = (fallbackDb.guestRequests || []).map(g => ({
        id: `REQ-${g.request_id}`,
        request_id: g.request_id,
        room_number: g.room_number,
        guest_name: g.guest_name,
        type: g.request_type || 'Request',
        request_type: g.request_type || 'Request',
        description: g.notes || g.request_type,
        notes: g.notes,
        priority: g.priority || 'Normal',
        status: g.status || 'Pending',
        created_at: g.created_at || new Date(),
        source: 'request',
        source_label: 'Guest Request'
      }));

      const mappedMaintenance = (fallbackDb.maintenance || []).map(m => ({
        id: m.task_id || `MNT-${m.id}`,
        request_id: m.task_id || `MNT-${m.id}`,
        room_number: m.room_number,
        type: m.issue || 'Maintenance',
        request_type: m.issue || 'Maintenance',
        description: m.issue,
        priority: m.priority || 'Medium',
        status: m.status || 'Pending',
        created_at: m.reported_at || new Date(),
        source: 'maintenance',
        source_label: 'Maintenance'
      }));

      requests = [...mappedComplaints, ...mappedRequests, ...mappedMaintenance];
      return res.status(200).json({
        success: true,
        requests
      });
    } catch (err) {
      console.error('Ops getOpsRequests error:', err);
      return res.status(500).json({ error: err.message, success: false });
    }
  }

  static async completeRequest(req, res) {
    try {
      const { id } = req.params;
      const pool = await poolPromise;
      if (pool) {
        try {
          if (String(id).startsWith('CMP-')) {
            const numId = parseInt(String(id).replace(/\D/g, ''), 10);
            await pool.request().input('id', sql.Int, numId).query(`UPDATE Complaints SET status = 'Resolved' WHERE complaint_id = @id`);
          } else if (String(id).startsWith('REQ-')) {
            const numId = parseInt(String(id).replace(/\D/g, ''), 10);
            await pool.request().input('id', sql.Int, numId).query(`UPDATE SpecialRequests SET status = 'Completed' WHERE request_id = @id`);
          } else {
            await pool.request().input('id', sql.VarChar, String(id)).query(`UPDATE Maintenance SET status = 'Resolved' WHERE task_id = @id OR CAST(id AS VARCHAR) = @id`);
          }
        } catch (dbErr) {}
      }

      if (String(id).startsWith('CMP-')) {
        const numId = String(id).replace('CMP-', '');
        const c = fallbackDb.complaints.find(item => String(item.complaint_id) === String(numId));
        if (c) c.status = 'Resolved';
      } else if (String(id).startsWith('REQ-')) {
        const numId = String(id).replace('REQ-', '');
        const g = fallbackDb.guestRequests.find(item => String(item.request_id) === String(numId));
        if (g) g.status = 'Completed';
      }

      return res.status(200).json({ success: true, message: 'Task marked completed' });
    } catch (err) {
      console.error('Ops completeRequest error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // ====================================================================
  // 8. LIVE OPERATIONS SUMMARY & KPIS
  // ====================================================================
  static async getOpsSummary(req, res) {
    try {
      let totalRooms = 6;
      let dirtyCount = 0;
      let cleanCount = 6;
      let occupiedCount = 0;
      let pendingRequests = 0;

      const pool = await poolPromise;
      if (pool) {
        try {
          const rTot = await pool.request().query(`SELECT COUNT(*) AS cnt FROM Rooms`);
          const rDirty = await pool.request().query(`SELECT COUNT(*) AS cnt FROM Rooms WHERE LOWER(status) IN ('dirty', 'cleaning')`);
          const rClean = await pool.request().query(`SELECT COUNT(*) AS cnt FROM Rooms WHERE LOWER(status) = 'available'`);
          const rOcc = await pool.request().query(`SELECT COUNT(*) AS cnt FROM Rooms WHERE LOWER(status) = 'occupied'`);

          const cPending = await pool.request().query(`SELECT COUNT(*) AS cnt FROM Complaints WHERE LOWER(status) NOT IN ('resolved', 'closed')`);
          let reqPending = { recordset: [{ cnt: 0 }] };
          try {
            reqPending = await pool.request().query(`SELECT COUNT(*) AS cnt FROM SpecialRequests WHERE LOWER(status) NOT IN ('completed', 'resolved')`);
          } catch(e) {}
          let mntPending = { recordset: [{ cnt: 0 }] };
          try {
            mntPending = await pool.request().query(`SELECT COUNT(*) AS cnt FROM Maintenance WHERE LOWER(status) NOT IN ('resolved', 'closed', 'completed')`);
          } catch(e) {}

          totalRooms = rTot.recordset[0]?.cnt || 6;
          dirtyCount = rDirty.recordset[0]?.cnt || 0;
          cleanCount = rClean.recordset[0]?.cnt || 0;
          occupiedCount = rOcc.recordset[0]?.cnt || 0;
          pendingRequests = (cPending.recordset[0]?.cnt || 0) + (reqPending.recordset[0]?.cnt || 0) + (mntPending.recordset[0]?.cnt || 0);

          return res.status(200).json({
            success: true,
            summary: {
              total_rooms: totalRooms,
              cleaning_required: dirtyCount,
              cleaned_and_ready: cleanCount,
              occupied_rooms: occupiedCount,
              pending_requests: pendingRequests
            }
          });
        } catch (dbErr) {
          console.warn('DB getOpsSummary query error, falling back:', dbErr.message);
        }
      }

      const allRooms = fallbackDb.rooms;
      dirtyCount = allRooms.filter(r => (r.status || '').toLowerCase() === 'dirty' || (r.status || '').toLowerCase() === 'cleaning').length;
      occupiedCount = allRooms.filter(r => (r.status || '').toLowerCase() === 'occupied').length;
      cleanCount = allRooms.filter(r => (r.status || '').toLowerCase() === 'available').length;
      const mntPendingCount = (fallbackDb.maintenance || []).filter(m => !['resolved', 'closed', 'completed'].includes((m.status || '').toLowerCase())).length;
      const cmpPendingCount = (fallbackDb.complaints || []).filter(c => !['resolved', 'closed', 'completed'].includes((c.status || '').toLowerCase())).length;
      const reqPendingCount = (fallbackDb.guestRequests || []).filter(g => !['resolved', 'closed', 'completed'].includes((g.status || '').toLowerCase())).length;
      pendingRequests = mntPendingCount + cmpPendingCount + reqPendingCount;

      return res.status(200).json({
        success: true,
        summary: {
          total_rooms: allRooms.length,
          cleaning_required: dirtyCount,
          cleaned_and_ready: cleanCount,
          occupied_rooms: occupiedCount,
          pending_requests: pendingRequests
        }
      });
    } catch (err) {
      console.error('Ops getOpsSummary error:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  // ====================================================================
  // 9. MAINTENANCE TASKS CRUD (Table: Maintenance)
  // ====================================================================
  static async getMaintenanceTasks(req, res) {
    try {
      const pool = await poolPromise;
      if (pool) {
        const result = await pool.request().query(`
          SELECT 
            id,
            task_id,
            room_number,
            issue,
            issue AS description,
            priority,
            status,
            reported_at AS created_at
          FROM Maintenance 
          ORDER BY id DESC
        `);
        return res.status(200).json(result.recordset);
      }
      return res.status(200).json(fallbackDb.maintenance || []);
    } catch (err) {
      console.error('Ops getMaintenanceTasks error:', err);
      return res.status(200).json(fallbackDb.maintenance || []);
    }
  }

  static async createMaintenanceTask(req, res) {
    try {
      const { room_number, issue, priority, status } = req.body;
      const taskId = `MNT-${Math.floor(100 + Math.random() * 900)}`;

      const newTask = {
        id: (fallbackDb.maintenance ? fallbackDb.maintenance.length : 0) + 1,
        task_id: taskId,
        room_number: room_number || '101',
        issue: issue || 'General Maintenance',
        priority: priority || 'Medium',
        status: status || 'Pending',
        reported_at: new Date()
      };

      const pool = await poolPromise;
      if (pool) {
        try {
          await pool.request()
            .input('task_id', sql.VarChar, taskId)
            .input('room_number', sql.VarChar, newTask.room_number)
            .input('issue', sql.VarChar, newTask.issue)
            .input('priority', sql.VarChar, newTask.priority)
            .input('status', sql.VarChar, newTask.status)
            .query(`
              INSERT INTO Maintenance (task_id, room_number, issue, priority, status, reported_at)
              VALUES (@task_id, @room_number, @issue, @priority, @status, GETDATE())
            `);
        } catch (dbErr) {}
      }

      if (!fallbackDb.maintenance) fallbackDb.maintenance = [];
      fallbackDb.maintenance.unshift(newTask);

      return res.status(201).json({ success: true, message: 'Maintenance task logged successfully', task: newTask });
    } catch (err) {
      console.error('Ops createMaintenanceTask error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  static async updateMaintenanceTask(req, res) {
    try {
      const { id } = req.params;
      const { room_number, issue, priority, status, type, description } = req.body;
      const finalIssue = issue || description || type || '';

      const pool = await poolPromise;
      if (pool) {
        try {
          if (String(id).startsWith('CMP-')) {
            const numId = parseInt(String(id).replace(/\D/g, ''), 10);
            await pool.request()
              .input('id', sql.Int, numId)
              .input('room', sql.NVarChar, room_number)
              .input('desc', sql.NVarChar, finalIssue)
              .input('priority', sql.NVarChar, priority)
              .input('status', sql.NVarChar, status)
              .query(`UPDATE Complaints SET room_number = @room, description = @desc, priority = @priority, status = @status WHERE complaint_id = @id`);
          } else if (String(id).startsWith('REQ-')) {
            const numId = parseInt(String(id).replace(/\D/g, ''), 10);
            await pool.request()
              .input('id', sql.Int, numId)
              .input('room', sql.NVarChar, room_number)
              .input('desc', sql.NVarChar, finalIssue)
              .input('priority', sql.NVarChar, priority)
              .input('status', sql.NVarChar, status)
              .query(`UPDATE SpecialRequests SET room_number = @room, notes = @desc, priority = @priority, status = @status WHERE request_id = @id`);
          } else {
            await pool.request()
              .input('id', sql.VarChar, String(id))
              .input('room', sql.VarChar, room_number)
              .input('issue', sql.VarChar, finalIssue)
              .input('priority', sql.VarChar, priority)
              .input('status', sql.VarChar, status)
              .query(`UPDATE Maintenance SET room_number = @room, issue = @issue, priority = @priority, status = @status WHERE task_id = @id OR CAST(id AS VARCHAR) = @id`);
          }
        } catch (dbErr) {}
      }

      if (fallbackDb.maintenance) {
        const m = fallbackDb.maintenance.find(item => item.task_id === id || String(item.id) === String(id));
        if (m) {
          if (room_number) m.room_number = room_number;
          if (finalIssue) m.issue = finalIssue;
          if (priority) m.priority = priority;
          if (status) m.status = status;
        }
      }

      return res.status(200).json({ success: true, message: 'Maintenance record updated successfully' });
    } catch (err) {
      console.error('Ops updateMaintenanceTask error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  static async deleteMaintenanceTask(req, res) {
    try {
      const { id } = req.params;

      const pool = await poolPromise;
      if (pool) {
        try {
          if (String(id).startsWith('CMP-')) {
            const numId = parseInt(String(id).replace(/\D/g, ''), 10);
            await pool.request().input('id', sql.Int, numId).query(`DELETE FROM Complaints WHERE complaint_id = @id`);
          } else if (String(id).startsWith('REQ-')) {
            const numId = parseInt(String(id).replace(/\D/g, ''), 10);
            await pool.request().input('id', sql.Int, numId).query(`DELETE FROM SpecialRequests WHERE request_id = @id`);
          } else {
            await pool.request().input('id', sql.VarChar, String(id)).query(`DELETE FROM Maintenance WHERE task_id = @id OR CAST(id AS VARCHAR) = @id`);
          }
        } catch (dbErr) {}
      }

      if (fallbackDb.maintenance) {
        fallbackDb.maintenance = fallbackDb.maintenance.filter(item => item.task_id !== id && String(item.id) !== String(id));
      }

      return res.status(200).json({ success: true, message: 'Record deleted successfully' });
    } catch (err) {
      console.error('Ops deleteMaintenanceTask error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // ====================================================================
  // 10. KITCHEN MENU CRUD
  // ====================================================================
  static async createMenuItem(req, res) {
    try {
      const { meal_type, item_name, description, price, is_available } = req.body;
      const mType = meal_type || 'Breakfast';
      const iName = item_name || 'New Dish';
      const desc = description || '';
      const priceVal = parseFloat(price) || (mType === 'Breakfast' ? 16.00 : mType === 'Dinner' ? 32.00 : 22.00);
      const avail = is_available === undefined ? 1 : (is_available ? 1 : 0);

      const newItem = {
        item_id: fallbackDb.menuItems.length + 1,
        meal_type: mType,
        item_name: iName,
        description: desc,
        price: priceVal,
        is_available: Boolean(avail),
        created_at: new Date()
      };

      const pool = await poolPromise;
      if (pool) {
        try {
          const r = await pool.request()
            .input('meal_type', sql.NVarChar, mType)
            .input('item_name', sql.NVarChar, iName)
            .input('description', sql.NVarChar, desc)
            .input('is_available', sql.Bit, avail)
            .query(`
              INSERT INTO MenuItems (meal_type, item_name, description, is_available)
              OUTPUT INSERTED.item_id
              VALUES (@meal_type, @item_name, @description, @is_available)
            `);
          if (r.recordset && r.recordset.length > 0) {
            newItem.item_id = r.recordset[0].item_id;
          }
        } catch (dbErr) {
          console.warn('DB createMenuItem error:', dbErr.message);
        }
      }

      fallbackDb.menuItems.push(newItem);
      return res.status(201).json({ success: true, message: `Dish "${iName}" added to menu!`, item: newItem });
    } catch (err) {
      console.error('Ops createMenuItem error:', err);
      return res.status(500).json({ success: false, message: err.message, error: err.message });
    }
  }

  static async updateMenuItem(req, res) {
    try {
      const { id } = req.params;
      const { price, meal_type, item_name, description, is_available } = req.body;

      const pool = await poolPromise;
      if (pool) {
        try {
          let q = `UPDATE MenuItems SET `;
          const updates = [];
          const reqObj = pool.request().input('id', sql.Int, parseInt(id, 10));

          if (item_name !== undefined) {
            updates.push(`item_name = @item_name`);
            reqObj.input('item_name', sql.NVarChar, item_name);
          }
          if (description !== undefined) {
            updates.push(`description = @description`);
            reqObj.input('description', sql.NVarChar, description);
          }
          if (meal_type !== undefined) {
            updates.push(`meal_type = @meal_type`);
            reqObj.input('meal_type', sql.NVarChar, meal_type);
          }
          if (is_available !== undefined) {
            updates.push(`is_available = @is_available`);
            reqObj.input('is_available', sql.Bit, is_available ? 1 : 0);
          }

          if (updates.length > 0) {
            q += updates.join(', ') + ` WHERE item_id = @id`;
            await reqObj.query(q);
          }
        } catch (dbErr) {
          console.warn('DB updateMenuItem error:', dbErr.message);
        }
      }

      const item = fallbackDb.menuItems.find(m => String(m.item_id) === String(id));
      if (item) {
        if (price !== undefined) item.price = parseFloat(price);
        if (item_name !== undefined) item.item_name = item_name;
        if (description !== undefined) item.description = description;
        if (meal_type !== undefined) item.meal_type = meal_type;
        if (is_available !== undefined) item.is_available = Boolean(is_available);
      }

      return res.status(200).json({ success: true, message: 'Dish updated successfully', item });
    } catch (err) {
      console.error('Ops updateMenuItem error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  static async toggleMenuItem(req, res) {
    try {
      const { id } = req.params;
      let newAvail = true;

      const pool = await poolPromise;
      if (pool) {
        try {
          await pool.request()
            .input('id', sql.Int, parseInt(id, 10))
            .query(`UPDATE MenuItems SET is_available = CASE WHEN is_available = 1 THEN 0 ELSE 1 END WHERE item_id = @id`);
        } catch (dbErr) {
          console.warn('DB toggleMenuItem error:', dbErr.message);
        }
      }

      const item = fallbackDb.menuItems.find(m => String(m.item_id) === String(id));
      if (item) {
        item.is_available = !item.is_available;
        newAvail = item.is_available;
      }

      return res.status(200).json({ success: true, message: 'Dish availability updated', is_available: newAvail });
    } catch (err) {
      console.error('Ops toggleMenuItem error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  static async deleteMenuItem(req, res) {
    try {
      const { id } = req.params;

      const pool = await poolPromise;
      if (pool) {
        try {
          await pool.request()
            .input('id', sql.Int, parseInt(id, 10))
            .query(`DELETE FROM MenuItems WHERE item_id = @id`);
        } catch (dbErr) {
          console.warn('DB deleteMenuItem error:', dbErr.message);
        }
      }

      fallbackDb.menuItems = fallbackDb.menuItems.filter(m => String(m.item_id) !== String(id));
      return res.status(200).json({ success: true, message: 'Dish removed from menu' });
    } catch (err) {
      console.error('Ops deleteMenuItem error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }
}

module.exports = OpsController;
