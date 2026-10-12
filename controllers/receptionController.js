const { sql, poolPromise, fallbackDb } = require('../config/db');
const { sendBookingConfirmation } = require('../utils/emailService');

class ReceptionController {
  // ====================================================================
  // 1. BOOKINGS & RESERVATIONS
  // ====================================================================
  static async getBookings(req, res) {
    try {
      const pool = await poolPromise;
      if (pool) {
        const result = await pool.request().query(`
          SELECT * FROM Bookings ORDER BY check_in DESC
        `);
        return res.status(200).json(result.recordset);
      }
      return res.status(200).json(fallbackDb.bookings);
    } catch (err) {
      console.error('Reception getBookings error:', err);
      return res.status(200).json(fallbackDb.bookings);
    }
  }

  static async createBooking(req, res) {
    try {
      // PCI-DSS Compliance: Strip and discard any raw credit card numbers or CVV/CVC codes immediately
      delete req.body.card_number;
      delete req.body.cardNumber;
      delete req.body.cvv;
      delete req.body.cvc;
      delete req.body.security_code;
      delete req.body.raw_card;

      const {
        guest_name,
        guest_email,
        email,
        phone,
        guest_phone,
        room_number,
        room_type,
        meal_package,
        package_name,
        assigned_package,
        check_in,
        check_in_date,
        check_out,
        check_out_date,
        total_amount,
        advance_paid,
        advance_amount,
        status,
        payment_status,
        payment_method,
        transaction_ref,
        card_last4
      } = req.body;

      const booking_id = `BK-${Math.floor(1000 + Math.random() * 9000)}`;
      const bookingId = booking_id;
      const gEmail = (guest_email || email || '').trim();
      const gPhone = (phone || guest_phone || '').trim();
      const rType = room_type || req.body.roomType || null;
      const mPkg = meal_package || req.body.mealPackage || null;
      const pkg = package_name || assigned_package || mPkg || null;
      const bStatus = status || 'Confirmed';
      const cIn = check_in || check_in_date || new Date().toISOString().split('T')[0];
      const cOut = check_out || check_out_date || new Date().toISOString().split('T')[0];

      // Payment Method & Status Normalization
      const rawMethod = String(payment_method || 'Pay at Reception').trim();
      const isCreditCard = rawMethod.toLowerCase().includes('credit');
      const pMethod = isCreditCard ? 'Credit Card' : rawMethod;

      let pStatus = payment_status;
      if (isCreditCard) {
        pStatus = 'Paid';
      } else if (!pStatus) {
        pStatus = (parseFloat(advance_paid || advance_amount || 0) > 0) ? 'Partially Paid' : 'Pending';
      }

      const total = parseFloat(total_amount || 0);
      let adv = parseFloat(advance_paid || advance_amount || 0);
      if (isCreditCard && adv === 0 && total > 0) {
        adv = total; // Full payment captured via Credit Card (Pay Now)
      }

      const txnRef = transaction_ref || (isCreditCard ? `TXN-CC-${Date.now()}` : null);
      // Strictly retain only last 4 digits for PCI-DSS compliance
      const maskedCard = card_last4 ? String(card_last4).replace(/\D/g, '').slice(-4) : null;

      let assignedRoom = room_number || '';
      const pool = await poolPromise;

      if (pool) {
        // If room_number was not supplied but room_type was, find an available room
        if (!assignedRoom && rType) {
          try {
            const availRes = await pool.request()
              .input('rtype', sql.NVarChar, `%${rType}%`)
              .query(`SELECT TOP 1 room_number FROM Rooms WHERE (category LIKE @rtype OR type LIKE @rtype) AND status = 'Available' ORDER BY room_number ASC`);
            if (availRes.recordset && availRes.recordset.length > 0) {
              assignedRoom = availRes.recordset[0].room_number;
            }
          } catch (e) {}
        }

        let hasTxnRef = false;
        let hasCardLast4 = false;
        let hasRoomType = false;
        let hasMealPkg = false;
        let hasEmail = false;
        let hasGuestEmail = false;
        let hasPhone = false;
        let hasGuestPhone = false;
        let hasIdPassport = false;
        let hasGuestNic = false;
        let hasGuestType = false;

        try {
          const colRes = await pool.request().query(`
            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Bookings'
          `);
          const cols = (colRes.recordset || []).map(c => c.COLUMN_NAME.toLowerCase());
          hasTxnRef = cols.includes('transaction_ref');
          hasCardLast4 = cols.includes('card_last4');
          hasRoomType = cols.includes('room_type');
          hasMealPkg = cols.includes('meal_package');
          hasEmail = cols.includes('email');
          hasGuestEmail = cols.includes('guest_email');
          hasPhone = cols.includes('phone');
          hasGuestPhone = cols.includes('guest_phone');
          hasIdPassport = cols.includes('id_passport');
          hasGuestNic = cols.includes('guest_nic');
          hasGuestType = cols.includes('guest_type');
        } catch (colErr) {
          console.warn('Column lookup warning in createBooking:', colErr.message);
        }

        const reqObj = pool.request()
          .input('booking_id', sql.VarChar, booking_id)
          .input('guest_name', sql.VarChar, guest_name || 'Guest')
          .input('room_number', sql.VarChar, assignedRoom || '')
          .input('check_in', sql.VarChar, cIn)
          .input('check_out', sql.VarChar, cOut)
          .input('total_amount', sql.Decimal(14, 2), total)
          .input('advance_paid', sql.Decimal(14, 2), adv)
          .input('status', sql.VarChar, bStatus)
          .input('payment_status', sql.NVarChar, pStatus)
          .input('payment_method', sql.NVarChar, pMethod)
          .input('package_name', sql.NVarChar, pkg);

        const colNames = ['booking_id', 'guest_name', 'room_number', 'check_in', 'check_out', 'total_amount', 'advance_paid', 'status', 'payment_status', 'payment_method', 'package_name'];
        const colParams = ['@booking_id', '@guest_name', '@room_number', '@check_in', '@check_out', '@total_amount', '@advance_paid', '@status', '@payment_status', '@payment_method', '@package_name'];

        if (hasEmail) {
          reqObj.input('email', sql.NVarChar, gEmail);
          colNames.push('email');
          colParams.push('@email');
        }
        if (hasGuestEmail) {
          reqObj.input('guest_email', sql.NVarChar, gEmail);
          colNames.push('guest_email');
          colParams.push('@guest_email');
        }
        if (hasPhone) {
          reqObj.input('phone', sql.NVarChar, gPhone);
          colNames.push('phone');
          colParams.push('@phone');
        }
        if (hasGuestPhone) {
          reqObj.input('guest_phone', sql.NVarChar, gPhone);
          colNames.push('guest_phone');
          colParams.push('@guest_phone');
        }
        if (hasIdPassport) {
          reqObj.input('id_passport', sql.NVarChar, req.body.id_passport || req.body.identity_number || 'ONLINE-GUEST');
          colNames.push('id_passport');
          colParams.push('@id_passport');
        }
        if (hasGuestNic) {
          reqObj.input('guest_nic', sql.NVarChar, req.body.guest_nic || null);
          colNames.push('guest_nic');
          colParams.push('@guest_nic');
        }
        if (hasGuestType) {
          reqObj.input('guest_type', sql.NVarChar, req.body.guest_type || 'Local');
          colNames.push('guest_type');
          colParams.push('@guest_type');
        }
        if (hasTxnRef) {
          reqObj.input('transaction_ref', sql.NVarChar, txnRef);
          colNames.push('transaction_ref');
          colParams.push('@transaction_ref');
        }
        if (hasCardLast4) {
          reqObj.input('card_last4', sql.NVarChar, maskedCard);
          colNames.push('card_last4');
          colParams.push('@card_last4');
        }
        if (hasRoomType && rType) {
          reqObj.input('room_type', sql.NVarChar, rType);
          colNames.push('room_type');
          colParams.push('@room_type');
        }
        if (hasMealPkg && mPkg) {
          reqObj.input('meal_package', sql.NVarChar, mPkg);
          colNames.push('meal_package');
          colParams.push('@meal_package');
        }

        await reqObj.query(`
          INSERT INTO Bookings (${colNames.join(', ')})
          VALUES (${colParams.join(', ')})
        `);

        // Trigger confirmation email asynchronously after database insertion
        const customerEmail = req.body.guest_email || req.body.email;
        if (customerEmail) {
          sendBookingConfirmation({
            booking_id: bookingId,
            guest_name: req.body.guest_name,
            guest_email: customerEmail,
            room_number: assignedRoom || req.body.room_number || 'To be allocated on arrival',
            room_type: rType || req.body.room_type,
            meal_package: mPkg || req.body.meal_package,
            check_in: cIn || req.body.check_in,
            check_out: cOut || req.body.check_out,
            total_amount: total || req.body.total_amount,
            payment_status: pStatus || req.body.payment_status || 'Pending',
            payment_method: pMethod || req.body.payment_method
          }).catch(err => {
            console.error('[EmailService] Error dispatching booking email:', err.message);
          });
        }

        // If booking is confirmed with a physical room assigned, mark room as Occupied
        if (assignedRoom && (bStatus.toLowerCase() === 'checked-in' || bStatus.toLowerCase() === 'confirmed')) {
          await pool.request()
            .input('rnum', sql.VarChar, assignedRoom)
            .query(`UPDATE Rooms SET status = 'Occupied' WHERE room_number = @rnum`);
        }

        // Auto-create Finance Invoice and Transaction record for paid Credit Card bookings
        if (isCreditCard && pStatus.toLowerCase() === 'paid') {
          const autoInvoiceId = `INV-${Math.floor(100000 + Math.random() * 900000)}-${Math.floor(100 + Math.random() * 900)}`;
          try {
            await pool.request()
              .input('invoice_id', sql.VarChar, autoInvoiceId)
              .input('booking_id', sql.VarChar, booking_id)
              .input('guest_name', sql.VarChar, guest_name || 'Guest')
              .input('room_number', sql.VarChar, assignedRoom || '')
              .input('total_amount', sql.Decimal(10, 2), total)
              .input('amount', sql.Decimal(10, 2), total)
              .input('paid_amount', sql.Decimal(10, 2), total)
              .input('payment_method', sql.VarChar, 'Credit Card')
              .input('status', sql.VarChar, 'Paid')
              .input('payment_status', sql.NVarChar, 'Paid')
              .input('transaction_ref', sql.NVarChar, txnRef)
              .query(`
                INSERT INTO Invoices (
                  invoice_id, booking_id, guest_name, room_number, total_amount, 
                  amount, paid_amount, payment_method, status, payment_status, 
                  transaction_ref, issue_date, created_at
                )
                VALUES (
                  @invoice_id, @booking_id, @guest_name, @room_number, @total_amount, 
                  @amount, @paid_amount, 'Credit Card', 'Paid', 'Paid', 
                  @transaction_ref, GETDATE(), GETDATE()
                )
              `);
          } catch (invErr) {
            console.warn('Auto-create Invoice error:', invErr.message);
          }

          try {
            await pool.request()
              .input('txn_id', sql.VarChar, txnRef)
              .input('type', sql.VarChar, 'Income')
              .input('category', sql.VarChar, 'Room Booking')
              .input('amount', sql.Decimal(10, 2), total)
              .input('description', sql.VarChar, `Online Credit Card payment for ${guest_name || 'Guest'} (${booking_id})`)
              .query(`
                INSERT INTO Transactions (txn_id, type, category, amount, description, created_at)
                VALUES (@txn_id, @type, @category, @amount, @description, GETDATE())
              `);
          } catch (txnErr) {
            console.warn('Auto-create Transaction error:', txnErr.message);
          }
        }
      }

      // If assigned room wasn't found in DB, check fallbackDb
      if (!assignedRoom && rType && fallbackDb.rooms) {
        const availRm = fallbackDb.rooms.find(r => 
          (r.status || '').toLowerCase() === 'available' && 
          ((r.category || '').toLowerCase().includes(rType.toLowerCase()) || (r.type || '').toLowerCase().includes(rType.toLowerCase()))
        );
        if (availRm) assignedRoom = availRm.room_number;
      }

      const newBooking = {
        booking_id,
        guest_name: guest_name || 'Guest',
        guest_type: req.body.guest_type || 'Local',
        id_passport: req.body.id_passport || req.body.identity_number || 'ONLINE-GUEST',
        guest_nic: req.body.guest_nic || null,
        guest_email: gEmail,
        email: gEmail,
        phone: gPhone,
        guest_phone: gPhone,
        room_number: assignedRoom || '',
        room_type: rType || '',
        meal_package: mPkg || 'Room Only',
        package_name: pkg,
        check_in: cIn,
        check_out: cOut,
        total_amount: total,
        advance_paid: adv,
        status: bStatus,
        payment_status: pStatus,
        payment_method: pMethod,
        transaction_ref: txnRef,
        card_last4: maskedCard
      };
      fallbackDb.bookings.unshift(newBooking);

      if (!pool) {
        const customerEmail = req.body.guest_email || req.body.email;
        if (customerEmail) {
          sendBookingConfirmation({
            booking_id: bookingId,
            guest_name: req.body.guest_name,
            guest_email: customerEmail,
            room_number: assignedRoom || req.body.room_number || 'To be allocated on arrival',
            room_type: rType || req.body.room_type,
            meal_package: mPkg || req.body.meal_package,
            check_in: cIn || req.body.check_in,
            check_out: cOut || req.body.check_out,
            total_amount: total || req.body.total_amount,
            payment_status: pStatus || req.body.payment_status || 'Pending',
            payment_method: pMethod || req.body.payment_method
          }).catch(err => {
            console.error('[EmailService] Error dispatching booking email:', err.message);
          });
        }
      }

      if (assignedRoom) {
        const rm = fallbackDb.rooms.find(r => r.room_number === assignedRoom);
        if (rm && (bStatus.toLowerCase() === 'checked-in' || bStatus.toLowerCase() === 'confirmed')) {
          rm.status = 'Occupied';
        }
      }

      // Sync Invoice and Transaction in fallbackDb
      if (isCreditCard && pStatus.toLowerCase() === 'paid') {
        const fallbackInvId = `INV-${Math.floor(100000 + Math.random() * 900000)}-${Math.floor(100 + Math.random() * 900)}`;
        const fallbackInv = {
          id: fallbackInvId,
          invoice_id: fallbackInvId,
          booking_id: booking_id,
          guest_name: guest_name || 'Guest',
          guest: guest_name || 'Guest',
          room_number: assignedRoom || '',
          room: assignedRoom || '',
          total_amount: total,
          amount: total,
          paid_amount: total,
          payment_method: 'Credit Card',
          method: 'Credit Card',
          status: 'Paid',
          payment_status: 'Paid',
          transaction_ref: txnRef,
          issue_date: new Date().toISOString(),
          created_at: new Date().toISOString(),
          date: new Date().toISOString().split('T')[0]
        };
        if (!fallbackDb.invoices) fallbackDb.invoices = [];
        fallbackDb.invoices.unshift(fallbackInv);

        const fallbackTxn = {
          id: (fallbackDb.transactions ? fallbackDb.transactions.length : 0) + 1,
          txn_id: txnRef,
          type: 'Income',
          category: 'Room Booking',
          amount: total,
          description: `Online Credit Card payment for ${guest_name || 'Guest'} (${booking_id})`,
          date: new Date().toISOString().split('T')[0],
          created_at: new Date().toISOString()
        };
        if (!fallbackDb.transactions) fallbackDb.transactions = [];
        fallbackDb.transactions.unshift(fallbackTxn);
      }

      return res.status(201).json({
        success: true,
        message: isCreditCard ? 'Reservation confirmed and credit card payment processed successfully' : 'Reservation created successfully',
        booking: newBooking,
        booking_id: booking_id,
        guest_type: req.body.guest_type || 'Local',
        id_passport: req.body.id_passport || req.body.identity_number || 'ONLINE-GUEST',
        guest_nic: req.body.guest_nic || null,
        room_number: assignedRoom || 'Unassigned',
        total_amount: total,
        payment_status: pStatus,
        payment_method: pMethod,
        transaction_ref: txnRef
      });
    } catch (err) {
      console.error('Reception createBooking error:', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  static async updateBooking(req, res) {
    try {
      const { id } = req.params;
      const {
        guest_name,
        guest_email,
        email,
        phone,
        guest_phone,
        room_number,
        package_name,
        assigned_package,
        check_in,
        check_out,
        total_amount,
        advance_paid,
        status,
        payment_status,
        payment_method
      } = req.body;

      const gEmail = guest_email || email;
      const gPhone = phone || guest_phone;
      const pkg = package_name !== undefined ? package_name : assigned_package;
      const total = total_amount !== undefined ? parseFloat(total_amount) : null;
      const adv = advance_paid !== undefined ? parseFloat(advance_paid) : null;

      const pool = await poolPromise;
      if (pool) {
        // Query current booking to inspect room changes
        const curr = await pool.request()
          .input('id', sql.VarChar, id)
          .query(`SELECT * FROM Bookings WHERE booking_id = @id OR CAST(id AS VARCHAR) = @id`);

        const oldBooking = curr.recordset[0];
        const oldRoom = oldBooking ? oldBooking.room_number : null;

        await pool.request()
          .input('id', sql.VarChar, id)
          .input('guest_name', sql.VarChar, guest_name || null)
          .input('guest_email', sql.VarChar, gEmail || null)
          .input('phone', sql.VarChar, gPhone || null)
          .input('room_number', sql.VarChar, room_number || null)
          .input('package_name', sql.NVarChar, pkg || null)
          .input('check_in', sql.VarChar, check_in || null)
          .input('check_out', sql.VarChar, check_out || null)
          .input('total_amount', sql.Decimal(14, 2), total)
          .input('advance_paid', sql.Decimal(14, 2), adv)
          .input('status', sql.VarChar, status || null)
          .input('payment_status', sql.NVarChar, payment_status || null)
          .input('payment_method', sql.NVarChar, payment_method || null)
          .query(`
            UPDATE Bookings SET
              guest_name = COALESCE(@guest_name, guest_name),
              guest_email = COALESCE(@guest_email, guest_email),
              phone = COALESCE(@phone, phone),
              room_number = COALESCE(@room_number, room_number),
              package_name = COALESCE(@package_name, package_name),
              check_in = COALESCE(@check_in, check_in),
              check_out = COALESCE(@check_out, check_out),
              total_amount = COALESCE(@total_amount, total_amount),
              advance_paid = COALESCE(@advance_paid, advance_paid),
              status = COALESCE(@status, status),
              payment_status = COALESCE(@payment_status, payment_status),
              payment_method = COALESCE(@payment_method, payment_method)
            WHERE booking_id = @id OR CAST(id AS VARCHAR) = @id
          `);

        // Handle room status sync
        const finalRoom = room_number || oldRoom;
        const finalStatus = status || (oldBooking ? oldBooking.status : 'Confirmed');

        if (oldRoom && room_number && oldRoom !== room_number) {
          // Old room freed
          await pool.request().input('rnum', sql.VarChar, oldRoom).query(`UPDATE Rooms SET status = 'Available' WHERE room_number = @rnum`);
        }

        if (finalRoom) {
          if (finalStatus.toLowerCase() === 'checked-out') {
            await pool.request().input('rnum', sql.VarChar, finalRoom).query(`UPDATE Rooms SET status = 'Dirty' WHERE room_number = @rnum`);
          } else if (finalStatus.toLowerCase() === 'cancelled') {
            await pool.request().input('rnum', sql.VarChar, finalRoom).query(`UPDATE Rooms SET status = 'Available' WHERE room_number = @rnum`);
          } else if (finalStatus.toLowerCase() === 'checked-in' || finalStatus.toLowerCase() === 'confirmed') {
            await pool.request().input('rnum', sql.VarChar, finalRoom).query(`UPDATE Rooms SET status = 'Occupied' WHERE room_number = @rnum`);
          }
        }
      }

      const b = fallbackDb.bookings.find(bk => bk.booking_id === id || String(bk.id) === String(id));
      if (b) {
        if (guest_name) b.guest_name = guest_name;
        if (gEmail) b.guest_email = gEmail;
        if (gPhone) b.phone = gPhone;
        if (room_number) b.room_number = room_number;
        if (pkg !== undefined) b.package_name = pkg;
        if (check_in) b.check_in = check_in;
        if (check_out) b.check_out = check_out;
        if (total !== null) b.total_amount = total;
        if (adv !== null) b.advance_paid = adv;
        if (status) b.status = status;
        if (payment_status) b.payment_status = payment_status;
        if (payment_method) b.payment_method = payment_method;
      }

      return res.status(200).json({
        success: true,
        message: `Booking ${id} updated successfully`
      });
    } catch (err) {
      console.error('Reception updateBooking error:', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  static async deleteBooking(req, res) {
    try {
      const { id } = req.params;
      const pool = await poolPromise;
      if (pool) {
        // Free up assigned room if occupied
        const bRes = await pool.request()
          .input('id', sql.VarChar, id)
          .query(`SELECT room_number FROM Bookings WHERE booking_id = @id OR CAST(id AS VARCHAR) = @id`);

        if (bRes.recordset.length > 0 && bRes.recordset[0].room_number) {
          await pool.request()
            .input('rnum', sql.VarChar, bRes.recordset[0].room_number)
            .query(`UPDATE Rooms SET status = 'Available' WHERE room_number = @rnum`);
        }

        // Delete associated records if necessary (e.g. Invoices)
        await pool.request()
          .input('id', sql.VarChar, id)
          .query(`DELETE FROM Invoices WHERE booking_id = @id`);

        // Delete booking
        await pool.request()
          .input('id', sql.VarChar, id)
          .query(`DELETE FROM Bookings WHERE booking_id = @id OR CAST(id AS VARCHAR) = @id`);
      }

      const idx = fallbackDb.bookings.findIndex(b => b.booking_id === id || String(b.id) === String(id));
      if (idx !== -1) {
        const removed = fallbackDb.bookings.splice(idx, 1)[0];
        if (removed && removed.room_number) {
          const rm = fallbackDb.rooms.find(r => r.room_number === removed.room_number);
          if (rm) rm.status = 'Available';
        }
      }

      return res.status(200).json({ success: true, message: `Booking ${id} permanently deleted.` });
    } catch (err) {
      console.error('Reception deleteBooking error:', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  static async checkIn(req, res) {
    try {
      const { id } = req.params;
      const pool = await poolPromise;
      if (pool) {
        const bRes = await pool.request()
          .input('id', sql.VarChar, id)
          .query(`SELECT room_number FROM Bookings WHERE booking_id = @id OR CAST(id AS VARCHAR) = @id`);

        await pool.request()
          .input('id', sql.VarChar, id)
          .query(`UPDATE Bookings SET status = 'Checked-In' WHERE booking_id = @id OR CAST(id AS VARCHAR) = @id`);

        if (bRes.recordset.length > 0 && bRes.recordset[0].room_number) {
          await pool.request()
            .input('rnum', sql.VarChar, bRes.recordset[0].room_number)
            .query(`UPDATE Rooms SET status = 'Occupied' WHERE room_number = @rnum`);
        }
      }

      const b = fallbackDb.bookings.find(item => item.booking_id === id || String(item.id) === String(id));
      if (b) {
        b.status = 'Checked-In';
        if (b.room_number) {
          const rm = fallbackDb.rooms.find(r => r.room_number === b.room_number);
          if (rm) rm.status = 'Occupied';
        }
      }

      return res.status(200).json({ success: true, message: 'Guest checked in successfully' });
    } catch (err) {
      console.error('Reception checkIn error:', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  static async checkOut(req, res) {
    try {
      const { id } = req.params;
      let roomNo = null;

      const pool = await poolPromise;
      if (pool) {
        const bRes = await pool.request()
          .input('id', sql.VarChar, id)
          .query(`SELECT room_number FROM Bookings WHERE booking_id = @id OR CAST(id AS VARCHAR) = @id`);
        
        if (bRes.recordset.length > 0) {
          roomNo = bRes.recordset[0].room_number;
        }

        await pool.request()
          .input('id', sql.VarChar, id)
          .query(`UPDATE Bookings SET status = 'Checked-Out' WHERE booking_id = @id OR CAST(id AS VARCHAR) = @id`);

        if (roomNo) {
          await pool.request()
            .input('room_number', sql.VarChar, roomNo)
            .query(`UPDATE Rooms SET status = 'Dirty' WHERE room_number = @room_number`);
        }
      }

      const b = fallbackDb.bookings.find(item => item.booking_id === id || String(item.id) === String(id));
      if (b) {
        b.status = 'Checked-Out';
        const r = fallbackDb.rooms.find(room => room.room_number === b.room_number);
        if (r) r.status = 'Dirty';
      }

      return res.status(200).json({ success: true, message: 'Guest checked out successfully' });
    } catch (err) {
      console.error('Reception checkOut error:', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  static async cancelBooking(req, res) {
    try {
      const { id } = req.params;
      const pool = await poolPromise;
      if (pool) {
        const bRes = await pool.request()
          .input('id', sql.VarChar, id)
          .query(`SELECT room_number FROM Bookings WHERE booking_id = @id OR CAST(id AS VARCHAR) = @id`);

        await pool.request()
          .input('id', sql.VarChar, id)
          .query(`UPDATE Bookings SET status = 'Cancelled' WHERE booking_id = @id OR CAST(id AS VARCHAR) = @id`);

        if (bRes.recordset.length > 0 && bRes.recordset[0].room_number) {
          await pool.request()
            .input('rnum', sql.VarChar, bRes.recordset[0].room_number)
            .query(`UPDATE Rooms SET status = 'Available' WHERE room_number = @rnum`);
        }
      }

      const b = fallbackDb.bookings.find(item => item.booking_id === id || String(item.id) === String(id));
      if (b) {
        b.status = 'Cancelled';
        if (b.room_number) {
          const rm = fallbackDb.rooms.find(r => r.room_number === b.room_number);
          if (rm) rm.status = 'Available';
        }
      }

      return res.status(200).json({ success: true, message: 'Reservation cancelled successfully' });
    } catch (err) {
      console.error('Reception cancelBooking error:', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  // ====================================================================
  // 2. ROOMS MANAGEMENT
  // ====================================================================
  static async getRooms(req, res) {
    try {
      const pool = await poolPromise;
      if (pool) {
        const result = await pool.request().query(`
          SELECT 
            id,
            room_number AS room_no,
            room_number,
            ISNULL(type, ISNULL(category, 'Single Room')) AS room_type,
            ISNULL(category, ISNULL(type, 'Single Room')) AS category,
            type,
            ISNULL(price_per_night, 45.00) AS rate_per_night,
            ISNULL(price_per_night, 45.00) AS price_per_night,
            ISNULL(ac_type, 'A/C') AS ac_type,
            image_url,
            ISNULL(status, 'Available') AS status
          FROM Rooms 
          ORDER BY TRY_CAST(room_number AS INT) ASC, room_number ASC
        `);
        return res.status(200).json(result.recordset);
      }
      return res.status(200).json(fallbackDb.rooms.map(r => ({
        id: r.id || r.room_number,
        room_no: r.room_number || r.room_no,
        room_number: r.room_number || r.room_no,
        room_type: r.room_type || r.type || r.category || 'Single Room',
        category: r.category || r.room_type || r.type || 'Single Room',
        type: r.type || r.room_type || r.category || 'Single Room',
        rate_per_night: r.rate_per_night || r.price_per_night || r.price || 45.00,
        price_per_night: r.price_per_night || r.rate_per_night || r.price || 45.00,
        ac_type: r.ac_type || 'A/C',
        image_url: r.image_url || '',
        status: r.status || 'Available'
      })));
    } catch (err) {
      console.error('Reception getRooms error:', err);
      return res.status(200).json(fallbackDb.rooms);
    }
  }

  static async getAvailableRooms(req, res) {
    try {
      const { category } = req.query;
      const pool = await poolPromise;
      if (pool) {
        let q = `
          SELECT 
            id,
            room_number AS room_no,
            room_number,
            ISNULL(type, ISNULL(category, 'Single Room')) AS room_type,
            ISNULL(category, ISNULL(type, 'Single Room')) AS category,
            type,
            ISNULL(price_per_night, 45.00) AS rate_per_night,
            ISNULL(price_per_night, 45.00) AS price_per_night,
            ISNULL(ac_type, 'A/C') AS ac_type,
            image_url,
            ISNULL(status, 'Available') AS status
          FROM Rooms 
          WHERE LOWER(status) = 'available'
        `;
        if (category) {
          q += ` AND (LOWER(category) = LOWER(@cat) OR LOWER(type) = LOWER(@cat))`;
          const r = await pool.request().input('cat', sql.VarChar, category).query(q + ` ORDER BY TRY_CAST(room_number AS INT) ASC, room_number ASC`);
          return res.status(200).json(r.recordset);
        } else {
          const r = await pool.request().query(q + ` ORDER BY TRY_CAST(room_number AS INT) ASC, room_number ASC`);
          return res.status(200).json(r.recordset);
        }
      } else {
        let rooms = fallbackDb.rooms.filter(r => (r.status || '').toLowerCase() === 'available');
        if (category) {
          rooms = rooms.filter(r => (r.category || '').toLowerCase() === category.toLowerCase() || (r.type || '').toLowerCase() === category.toLowerCase());
        }
        return res.status(200).json(rooms.map(r => ({
          id: r.id || r.room_number,
          room_no: r.room_number || r.room_no,
          room_number: r.room_number || r.room_no,
          room_type: r.room_type || r.type || r.category || 'Single Room',
          category: r.category || r.room_type || r.type || 'Single Room',
          type: r.type || r.room_type || r.category || 'Single Room',
          rate_per_night: r.rate_per_night || r.price_per_night || r.price || 45.00,
          price_per_night: r.price_per_night || r.rate_per_night || r.price || 45.00,
          ac_type: r.ac_type || 'A/C',
          image_url: r.image_url || '',
          status: r.status || 'Available'
        })));
      }
    } catch (err) {
      console.error('Reception getAvailableRooms error:', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  static async assignRoom(req, res) {
    try {
      const { booking_id, room_number } = req.body;
      const pool = await poolPromise;
      if (pool) {
        await pool.request()
          .input('bid', sql.VarChar, booking_id)
          .input('rnum', sql.VarChar, room_number)
          .query(`
            UPDATE Bookings 
            SET room_number = @rnum,
                booking_type = CASE WHEN booking_type IS NULL OR LOWER(booking_type) NOT LIKE '%walk%' THEN 'Online' ELSE booking_type END,
                source = CASE WHEN source IS NULL OR LOWER(source) NOT LIKE '%walk%' THEN 'Online' ELSE source END
            WHERE booking_id = @bid OR CAST(id AS VARCHAR) = @bid
          `);
        await pool.request()
          .input('rnum', sql.VarChar, room_number)
          .query(`UPDATE Rooms SET status = 'Occupied' WHERE room_number = @rnum`);
      }
      const b = fallbackDb.bookings.find(bk => bk.booking_id === booking_id || String(bk.id) === String(booking_id));
      if (b) {
        b.room_number = room_number;
        if (!b.booking_type || !b.booking_type.toLowerCase().includes('walk')) b.booking_type = 'Online';
        if (!b.source || !b.source.toLowerCase().includes('walk')) b.source = 'Online';
      }
      const rm = fallbackDb.rooms.find(r => r.room_number === room_number);
      if (rm) rm.status = 'Occupied';

      return res.status(200).json({ success: true, message: `Room ${room_number} assigned to booking ${booking_id}` });
    } catch (err) {
      console.error('Reception assignRoom error:', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  // ====================================================================
  // 3. GUEST COMPLAINTS & FEEDBACK (Table: Complaints)
  // ====================================================================
  static async getComplaints(req, res) {
    try {
      const pool = await poolPromise;
      if (pool) {
        const result = await pool.request().query(`
          SELECT * FROM Complaints ORDER BY complaint_id DESC
        `);
        return res.status(200).json(result.recordset);
      }
      return res.status(200).json(fallbackDb.complaints);
    } catch (err) {
      console.error('Reception getComplaints error:', err);
      return res.status(200).json(fallbackDb.complaints);
    }
  }

  static async createComplaint(req, res) {
    try {
      const { room_number, guest_name, category, description, priority, status } = req.body;
      const cStatus = status || 'Open';
      const cPriority = priority || 'Medium';
      const cCat = category || 'General';

      const pool = await poolPromise;
      let complaintId = null;
      if (pool) {
        const insertRes = await pool.request()
          .input('room_number', sql.NVarChar, room_number || '101')
          .input('guest_name', sql.NVarChar, guest_name || 'Guest')
          .input('category', sql.NVarChar, cCat)
          .input('description', sql.NVarChar, description || '')
          .input('priority', sql.NVarChar, cPriority)
          .input('status', sql.NVarChar, cStatus)
          .query(`
            INSERT INTO Complaints (room_number, guest_name, category, description, priority, status)
            OUTPUT INSERTED.complaint_id
            VALUES (@room_number, @guest_name, @category, @description, @priority, @status)
          `);
        complaintId = insertRes.recordset[0]?.complaint_id;
      }

      const newComplaint = {
        complaint_id: complaintId || fallbackDb.complaints.length + 1,
        room_number: room_number || '101',
        guest_name: guest_name || 'Guest',
        category: cCat,
        description: description || '',
        priority: cPriority,
        status: cStatus,
        created_at: new Date()
      };
      fallbackDb.complaints.unshift(newComplaint);

      return res.status(201).json({
        success: true,
        message: 'Complaint registered successfully',
        complaint: newComplaint
      });
    } catch (err) {
      console.error('Reception createComplaint error:', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  static async updateComplaint(req, res) {
    try {
      const { id } = req.params;
      const { room_number, guest_name, category, description, priority, status } = req.body;

      const pool = await poolPromise;
      if (pool) {
        await pool.request()
          .input('id', sql.Int, parseInt(id, 10))
          .input('room_number', sql.NVarChar, room_number || null)
          .input('guest_name', sql.NVarChar, guest_name || null)
          .input('category', sql.NVarChar, category || null)
          .input('description', sql.NVarChar, description || null)
          .input('priority', sql.NVarChar, priority || null)
          .input('status', sql.NVarChar, status || null)
          .query(`
            UPDATE Complaints SET
              room_number = COALESCE(@room_number, room_number),
              guest_name = COALESCE(@guest_name, guest_name),
              category = COALESCE(@category, category),
              description = COALESCE(@description, description),
              priority = COALESCE(@priority, priority),
              status = COALESCE(@status, status)
            WHERE complaint_id = @id
          `);
      }

      const comp = fallbackDb.complaints.find(c => c.complaint_id === parseInt(id, 10));
      if (comp) {
        if (room_number) comp.room_number = room_number;
        if (guest_name) comp.guest_name = guest_name;
        if (category) comp.category = category;
        if (description) comp.description = description;
        if (priority) comp.priority = priority;
        if (status) comp.status = status;
      }

      return res.status(200).json({ success: true, message: `Complaint #${id} updated successfully.` });
    } catch (err) {
      console.error('Reception updateComplaint error:', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  static async deleteComplaint(req, res) {
    try {
      const { id } = req.params;
      const pool = await poolPromise;
      if (pool) {
        await pool.request()
          .input('id', sql.Int, parseInt(id, 10))
          .query(`DELETE FROM Complaints WHERE complaint_id = @id`);
      }

      const idx = fallbackDb.complaints.findIndex(c => c.complaint_id === parseInt(id, 10));
      if (idx !== -1) fallbackDb.complaints.splice(idx, 1);

      return res.status(200).json({ success: true, message: `Complaint #${id} deleted successfully.` });
    } catch (err) {
      console.error('Reception deleteComplaint error:', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  // ====================================================================
  // 4. GUEST SPECIAL REQUESTS (Tables: SpecialRequests / GuestRequests)
  // ====================================================================
  static async getRequests(req, res) {
    try {
      const pool = await poolPromise;
      if (pool) {
        try {
          const result = await pool.request().query(`
            SELECT * FROM SpecialRequests ORDER BY request_id DESC
          `);
          if (result.recordset.length > 0) {
            return res.status(200).json(result.recordset);
          }
        } catch (e) {}

        const altResult = await pool.request().query(`
          SELECT * FROM GuestRequests ORDER BY request_id DESC
        `);
        return res.status(200).json(altResult.recordset);
      }
      return res.status(200).json(fallbackDb.guestRequests);
    } catch (err) {
      console.error('Reception getRequests error:', err);
      return res.status(200).json(fallbackDb.guestRequests);
    }
  }

  static async createRequest(req, res) {
    try {
      const { room_number, guest_name, request_type, notes, description, priority, status } = req.body;
      const rNotes = notes || description || '';
      const rPriority = priority || 'Normal';
      const rStatus = status || 'Pending';
      const rType = request_type || 'General';

      const pool = await poolPromise;
      let reqId = null;
      if (pool) {
        try {
          const insertRes = await pool.request()
            .input('room_number', sql.NVarChar, room_number || '101')
            .input('guest_name', sql.NVarChar, guest_name || 'Guest')
            .input('request_type', sql.NVarChar, rType)
            .input('notes', sql.NVarChar, rNotes)
            .input('priority', sql.NVarChar, rPriority)
            .input('status', sql.NVarChar, rStatus)
            .query(`
              INSERT INTO SpecialRequests (room_number, guest_name, request_type, notes, priority, status)
              OUTPUT INSERTED.request_id
              VALUES (@room_number, @guest_name, @request_type, @notes, @priority, @status)
            `);
          reqId = insertRes.recordset[0]?.request_id;
        } catch (e) {
          const altRes = await pool.request()
            .input('room_number', sql.NVarChar, room_number || '101')
            .input('guest_name', sql.NVarChar, guest_name || 'Guest')
            .input('request_type', sql.NVarChar, rType)
            .input('notes', sql.NVarChar, rNotes)
            .input('priority', sql.NVarChar, rPriority)
            .input('status', sql.NVarChar, rStatus)
            .query(`
              INSERT INTO GuestRequests (room_number, guest_name, request_type, notes, priority, status)
              OUTPUT INSERTED.request_id
              VALUES (@room_number, @guest_name, @request_type, @notes, @priority, @status)
            `);
          reqId = altRes.recordset[0]?.request_id;
        }
      }

      const newReq = {
        request_id: reqId || fallbackDb.guestRequests.length + 1,
        booking_id: 1,
        room_number: room_number || '101',
        guest_name: guest_name || 'Guest',
        request_type: rType,
        notes: rNotes,
        description: rNotes,
        priority: rPriority,
        status: rStatus,
        created_at: new Date()
      };
      fallbackDb.guestRequests.unshift(newReq);

      return res.status(201).json({
        success: true,
        message: 'Guest request submitted successfully',
        request: newReq
      });
    } catch (err) {
      console.error('Reception createRequest error:', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  static async updateRequestStatus(req, res) {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const rStatus = status || 'Completed';

      const pool = await poolPromise;
      if (pool) {
        try {
          await pool.request()
            .input('id', sql.Int, parseInt(id, 10))
            .input('status', sql.NVarChar, rStatus)
            .query(`UPDATE SpecialRequests SET status = @status WHERE request_id = @id`);
        } catch (e) {}

        try {
          await pool.request()
            .input('id', sql.Int, parseInt(id, 10))
            .input('status', sql.NVarChar, rStatus)
            .query(`UPDATE GuestRequests SET status = @status WHERE request_id = @id`);
        } catch (e) {}
      }

      const reqObj = fallbackDb.guestRequests.find(r => r.request_id === parseInt(id, 10));
      if (reqObj) reqObj.status = rStatus;

      return res.status(200).json({ success: true, message: `Request #${id} marked as ${rStatus}` });
    } catch (err) {
      console.error('Reception updateRequestStatus error:', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  static async updateRequest(req, res) {
    try {
      const { id } = req.params;
      const { room_number, guest_name, request_type, notes, description, priority, status } = req.body;
      const rNotes = notes || description || null;

      const pool = await poolPromise;
      if (pool) {
        try {
          await pool.request()
            .input('id', sql.Int, parseInt(id, 10))
            .input('room_number', sql.NVarChar, room_number || null)
            .input('guest_name', sql.NVarChar, guest_name || null)
            .input('request_type', sql.NVarChar, request_type || null)
            .input('notes', sql.NVarChar, rNotes)
            .input('priority', sql.NVarChar, priority || null)
            .input('status', sql.NVarChar, status || null)
            .query(`
              UPDATE SpecialRequests SET
                room_number = COALESCE(@room_number, room_number),
                guest_name = COALESCE(@guest_name, guest_name),
                request_type = COALESCE(@request_type, request_type),
                notes = COALESCE(@notes, notes),
                priority = COALESCE(@priority, priority),
                status = COALESCE(@status, status)
              WHERE request_id = @id
            `);
        } catch (e) {}

        try {
          await pool.request()
            .input('id', sql.Int, parseInt(id, 10))
            .input('room_number', sql.NVarChar, room_number || null)
            .input('guest_name', sql.NVarChar, guest_name || null)
            .input('request_type', sql.NVarChar, request_type || null)
            .input('notes', sql.NVarChar, rNotes)
            .input('priority', sql.NVarChar, priority || null)
            .input('status', sql.NVarChar, status || null)
            .query(`
              UPDATE GuestRequests SET
                room_number = COALESCE(@room_number, room_number),
                guest_name = COALESCE(@guest_name, guest_name),
                request_type = COALESCE(@request_type, request_type),
                notes = COALESCE(@notes, notes),
                priority = COALESCE(@priority, priority),
                status = COALESCE(@status, status)
              WHERE request_id = @id
            `);
        } catch (e) {}
      }

      const reqObj = fallbackDb.guestRequests.find(r => r.request_id === parseInt(id, 10));
      if (reqObj) {
        if (room_number) reqObj.room_number = room_number;
        if (guest_name) reqObj.guest_name = guest_name;
        if (request_type) reqObj.request_type = request_type;
        if (rNotes) { reqObj.notes = rNotes; reqObj.description = rNotes; }
        if (priority) reqObj.priority = priority;
        if (status) reqObj.status = status;
      }

      return res.status(200).json({ success: true, message: `Special request #${id} updated successfully.` });
    } catch (err) {
      console.error('Reception updateRequest error:', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  static async deleteRequest(req, res) {
    try {
      const { id } = req.params;
      const pool = await poolPromise;
      if (pool) {
        try {
          await pool.request().input('id', sql.Int, parseInt(id, 10)).query(`DELETE FROM SpecialRequests WHERE request_id = @id`);
        } catch (e) {}
        try {
          await pool.request().input('id', sql.Int, parseInt(id, 10)).query(`DELETE FROM GuestRequests WHERE request_id = @id`);
        } catch (e) {}
      }

      const idx = fallbackDb.guestRequests.findIndex(r => r.request_id === parseInt(id, 10));
      if (idx !== -1) fallbackDb.guestRequests.splice(idx, 1);

      return res.status(200).json({ success: true, message: `Special request #${id} deleted successfully.` });
    } catch (err) {
      console.error('Reception deleteRequest error:', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  // ====================================================================
  // 5. DASHBOARD COUNTERS & METRICS
  // ====================================================================
  static async getDashboardCounters(req, res) {
    try {
      let activeGuests = 0;
      let availableRooms = 0;
      let pendingRequests = 0;
      let openComplaints = 0;

      const pool = await poolPromise;
      if (pool) {
        try {
          const r1 = await pool.request().query(`SELECT COUNT(*) AS cnt FROM Bookings WHERE LOWER(status) IN ('checked-in', 'confirmed')`);
          const r2 = await pool.request().query(`SELECT COUNT(*) AS cnt FROM Rooms WHERE LOWER(status) = 'available'`);
          
          let r3 = { recordset: [{ cnt: 0 }] };
          try {
            r3 = await pool.request().query(`SELECT COUNT(*) AS cnt FROM SpecialRequests WHERE LOWER(status) = 'pending'`);
          } catch (e) {
            r3 = await pool.request().query(`SELECT COUNT(*) AS cnt FROM GuestRequests WHERE LOWER(status) = 'pending'`);
          }

          const r4 = await pool.request().query(`SELECT COUNT(*) AS cnt FROM Complaints WHERE LOWER(status) = 'open'`);

          activeGuests = r1.recordset[0]?.cnt || 0;
          availableRooms = r2.recordset[0]?.cnt || 0;
          pendingRequests = r3.recordset[0]?.cnt || 0;
          openComplaints = r4.recordset[0]?.cnt || 0;
        } catch (e) {
          console.error('Error querying dashboard counter counts:', e);
        }
      } else {
        activeGuests = fallbackDb.bookings.filter(b => b.status === 'Confirmed' || b.status === 'Checked-In').length;
        availableRooms = fallbackDb.rooms.filter(r => r.status === 'Available').length;
        pendingRequests = fallbackDb.guestRequests.filter(r => r.status === 'Pending').length;
        openComplaints = fallbackDb.complaints.filter(c => c.status === 'Open').length;
      }

      return res.status(200).json({
        success: true,
        activeGuests,
        availableRooms,
        pendingRequests,
        openComplaints
      });
    } catch (err) {
      console.error('Reception getDashboardCounters error:', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  // ====================================================================
  // 6. SHIFT AUDIT & REPORTS
  // ====================================================================
  static async getReportsSummary(req, res) {
    try {
      const startDate = req.query.startDate || req.query.start_date;
      const endDate = req.query.endDate || req.query.end_date;
      const category = req.query.category;
      const paymentStatus = req.query.paymentStatus || req.query.payment_status;

      const pool = await poolPromise;
      if (!pool) {
        return res.status(200).json({
          success: true,
          summary: { total_bookings: 0, total_checkins: 0, total_checkouts: 0, total_revenue: 0, unresolved_complaints: 0 },
          bookings: []
        });
      }

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
      const bookings = result.recordset || [];

      const totalRevenue = bookings.reduce((sum, r) => sum + (parseFloat(r.total_amount) || 0), 0);
      const checkIns = bookings.filter(r => (r.status || '').toLowerCase() === 'checked-in').length;
      const checkOuts = bookings.filter(r => (r.status || '').toLowerCase() === 'checked-out').length;

      let openComplaints = 0;
      try {
        const compRes = await pool.request().query(`SELECT COUNT(*) AS cnt FROM Complaints WHERE LOWER(status) NOT IN ('resolved', 'closed')`);
        openComplaints = compRes.recordset[0]?.cnt || 0;
      } catch (e) {}

      return res.status(200).json({
        success: true,
        summary: {
          total_bookings: bookings.length,
          total_checkins: checkIns,
          total_checkouts: checkOuts,
          total_revenue: totalRevenue,
          unresolved_complaints: openComplaints
        },
        bookings
      });
    } catch (err) {
      console.error('Reception getReportsSummary error:', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  static async getShiftAuditReport(req, res) {
    return ReceptionController.getReportsSummary(req, res);
  }
}

module.exports = ReceptionController;
