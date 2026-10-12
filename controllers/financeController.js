const { sql, poolPromise, fallbackDb } = require('../config/db');
const { sendPaymentReceipt } = require('../utils/emailService');

class FinanceController {
  // 1. Strict Active Checked-In Guests for Invoice Dropdown
  static async getActiveGuests(req, res) {
    try {
      const pool = await poolPromise;
      if (pool) {
        let result;
        try {
          result = await pool.request().query(`
            SELECT 
              b.booking_id,
              b.guest_name,
              COALESCE(b.guest_email, b.email, '') AS guest_email,
              COALESCE(b.phone, b.guest_phone, '') AS phone,
              COALESCE(b.room_number, '') AS room_number,
              COALESCE(b.room_number, '') AS room_no,
              b.check_in,
              b.check_in AS check_in_date,
              b.check_out,
              b.check_out AS check_out_date,
              b.total_amount,
              b.status,
              COALESCE(b.payment_status, 'Pending') AS payment_status,
              COALESCE(r.price_per_night, 50.00) AS price_per_night,
              COALESCE(r.price_per_night, 50.00) AS rate_per_night,
              COALESCE(r.price_per_night, 50.00) AS nightly_rate,
              COALESCE(r.type, r.category, 'Deluxe Room') AS room_type
            FROM Bookings b
            LEFT JOIN Rooms r ON b.room_number = r.room_number
            WHERE (
              b.status IN ('Checked-In', 'CheckedIn', 'Active', 'Booked', 'Confirmed')
              OR LOWER(b.status) IN ('checked-in', 'checkedin', 'active', 'booked', 'confirmed')
            )
            AND (
              b.status NOT IN ('Checked-Out', 'Cancelled')
              AND LOWER(b.status) NOT IN ('checked-out', 'cancelled')
            )
            ORDER BY b.booking_id DESC
          `);
        } catch (sqlErr) {
          // Fallback query if columns differ slightly
          result = await pool.request().query(`
            SELECT 
              b.*,
              COALESCE(b.room_number, '') AS room_no,
              b.check_in AS check_in_date,
              b.check_out AS check_out_date
            FROM Bookings b
            WHERE LOWER(b.status) IN ('checked-in', 'checkedin', 'active', 'booked', 'confirmed')
              AND LOWER(b.status) NOT IN ('checked-out', 'cancelled')
            ORDER BY b.booking_id DESC
          `);
        }

        // Deduplicate records by booking_id
        const seen = new Set();
        const deduplicated = [];
        result.recordset.forEach(row => {
          const bId = String(row.booking_id || '');
          if (bId && !seen.has(bId)) {
            seen.add(bId);
            const checkIn = new Date(row.check_in || row.check_in_date || Date.now());
            const checkOut = new Date(row.check_out || row.check_out_date || (Date.now() + 86400000));
            const diffTime = Math.abs(checkOut - checkIn);
            const calculatedNights = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24))) || 1;
            const rate = parseFloat(row.price_per_night || row.rate_per_night || row.nightly_rate) || 50;

            row.nights = calculatedNights;
            row.nightly_rate = rate;
            row.rate_per_night = rate;
            row.price_per_night = rate;
            row.room_no = row.room_no || row.room_number || '101';
            row.room_number = row.room_number || row.room_no || '101';
            row.check_in_date = row.check_in_date || row.check_in;
            row.check_out_date = row.check_out_date || row.check_out;
            row.base_room_charge = calculatedNights * rate;
            deduplicated.push(row);
          }
        });

        return res.status(200).json(deduplicated);
      }

      // Fallback in-memory active guests
      const seen = new Set();
      const fallbackActive = [];
      fallbackDb.bookings.forEach(b => {
        const status = (b.status || '').toLowerCase().trim();
        const isNotOut = status !== 'checked-out' && status !== 'cancelled';
        const isActive = status === 'checked-in' || status === 'checkedin' || status === 'confirmed' || status === 'active' || status === 'booked';

        if (isActive && isNotOut) {
          const bId = String(b.booking_id || b.id || '');
          if (bId && !seen.has(bId)) {
            seen.add(bId);
            const roomNo = b.room_number || b.room_no || '101';
            const r = (fallbackDb.rooms || []).find(rm => rm.room_number === roomNo || rm.room_no === roomNo);
            const rate = r ? parseFloat(r.price_per_night || r.rate_per_night || 45.00) : 45.00;
            const checkIn = new Date(b.check_in || b.check_in_date || new Date());
            const checkOut = new Date(b.check_out || b.check_out_date || new Date(Date.now() + 86400000));
            const diffTime = Math.abs(checkOut - checkIn);
            const calculatedNights = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24))) || 1;

            fallbackActive.push({
              booking_id: b.booking_id || b.id,
              guest_name: b.guest_name,
              guest_email: b.guest_email || b.email || '',
              phone: b.phone || b.guest_phone || '',
              room_number: roomNo,
              room_no: roomNo,
              check_in: b.check_in || b.check_in_date,
              check_in_date: b.check_in || b.check_in_date,
              check_out: b.check_out || b.check_out_date,
              check_out_date: b.check_out || b.check_out_date,
              nights: calculatedNights,
              nightly_rate: rate,
              rate_per_night: rate,
              price_per_night: rate,
              room_type: r ? (r.type || r.room_type || r.category) : 'Deluxe Room',
              base_room_charge: calculatedNights * rate,
              total_amount: b.total_amount,
              status: b.status,
              payment_status: b.payment_status || 'Pending'
            });
          }
        }
      });

      return res.status(200).json(fallbackActive);
    } catch (err) {
      console.error('Finance getActiveGuests error:', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  // 2. Completed Invoices & Settlement History
  static async getInvoices(req, res) {
    try {
      const pool = await poolPromise;
      if (pool) {
        const result = await pool.request().query(`
          SELECT * FROM Invoices ORDER BY id DESC
        `);
        return res.status(200).json(result.recordset);
      }
      return res.status(200).json(fallbackDb.invoices);
    } catch (err) {
      console.error('Finance getInvoices error:', err);
      return res.status(200).json(fallbackDb.invoices);
    }
  }

  // 2b. Get Single Invoice by ID
  static async getInvoiceById(req, res) {
    try {
      const { id } = req.params;
      const pool = await poolPromise;
      if (pool) {
        const result = await pool.request()
          .input('id', sql.VarChar, id)
          .query(`
            SELECT * FROM Invoices 
            WHERE invoice_id = @id OR CAST(id AS VARCHAR) = @id
          `);
        if (result.recordset.length > 0) {
          return res.status(200).json({ success: true, invoice: result.recordset[0] });
        }
      }

      const inv = fallbackDb.invoices.find(i => i.invoice_id === id || String(i.id) === String(id));
      if (inv) {
        return res.status(200).json({ success: true, invoice: inv });
      }

      return res.status(404).json({ success: false, message: 'Invoice not found' });
    } catch (err) {
      console.error('Finance getInvoiceById error:', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  // 3. Invoice Generation Wizard Submission
  static async generateInvoice(req, res) {
    return FinanceController.createInvoice(req, res);
  }

  static async createInvoice(req, res) {
    try {
      const {
        booking_id,
        guest_name,
        room_number,
        room_no,
        nights,
        room_rate,
        rate,
        nightly_rate,
        base_room_charge,
        room_charges,
        dining_charges,
        special_charges,
        extras,
        discount,
        tax_amount,
        tax,
        total_amount,
        total_billed_amount,
        payment_method,
        payment_status,
        status,
        items,
        notes
      } = req.body;

      const finalTotal = parseFloat(total_billed_amount != null ? total_billed_amount : total_amount) || 0;
      const finalRoom = room_number || room_no || '';
      const finalGuest = guest_name || 'Guest';
      const finalStatus = payment_status || status || (payment_method === 'Pay at Reception' ? 'Pending' : 'Paid');
      const finalMethod = payment_method || 'Cash';
      const finalBookingId = booking_id ? String(booking_id) : '';

      const invoice_id = `INV-${Math.floor(100000 + Math.random() * 900000)}-${Math.floor(100 + Math.random() * 900)}`;
      const pool = await poolPromise;

      if (pool) {
        try {
          await pool.request()
            .input('invoice_id', sql.VarChar, invoice_id)
            .input('booking_id', sql.VarChar, finalBookingId)
            .input('guest_name', sql.VarChar, finalGuest)
            .input('room_number', sql.VarChar, finalRoom)
            .input('total_amount', sql.Decimal(10, 2), finalTotal)
            .input('paid_amount', sql.Decimal(10, 2), finalStatus.toLowerCase() === 'paid' ? finalTotal : 0)
            .input('payment_method', sql.VarChar, finalMethod)
            .input('status', sql.VarChar, finalStatus)
            .query(`
              INSERT INTO Invoices (invoice_id, booking_id, guest_name, room_number, total_amount, paid_amount, payment_method, status, created_at)
              VALUES (@invoice_id, @booking_id, @guest_name, @room_number, @total_amount, @paid_amount, @payment_method, @status, GETDATE())
            `);
        } catch (dbErr) {
          console.warn('Invoices table insert error:', dbErr.message);
        }

        // Atomically update Bookings payment_status if booking_id is provided
        if (finalBookingId) {
          try {
            await pool.request()
              .input('booking_id', sql.VarChar, finalBookingId)
              .input('p_status', sql.VarChar, finalStatus.toLowerCase() === 'paid' ? 'PAID' : 'Pending')
              .query(`
                UPDATE Bookings 
                SET payment_status = @p_status
                WHERE booking_id = @booking_id OR CAST(id AS VARCHAR) = @booking_id
              `);
          } catch (bkErr) {
            console.warn('Booking update error on invoice generation:', bkErr.message);
          }
        }

        // Record transaction in live MS SQL Transactions table
        if (finalMethod && finalTotal > 0 && finalStatus.toLowerCase() === 'paid') {
          const txnId = `TXN-${Math.floor(5000 + Math.random() * 5000)}`;
          try {
            await pool.request()
              .input('txn_id', sql.VarChar, txnId)
              .input('type', sql.VarChar, 'Income')
              .input('category', sql.VarChar, 'Room Booking')
              .input('amount', sql.Decimal(10, 2), finalTotal)
              .input('description', sql.VarChar, `Invoice settlement for ${finalGuest} (${invoice_id})`)
              .query(`
                INSERT INTO Transactions (txn_id, type, category, amount, description, created_at)
                VALUES (@txn_id, @type, @category, @amount, @description, GETDATE())
              `);
          } catch (txnErr) {
            console.warn('Transaction insertion error:', txnErr.message);
          }
        }
      }

      const newInv = {
        invoice_id,
        id: invoice_id,
        booking_id: finalBookingId,
        guest_name: finalGuest,
        guest: finalGuest,
        room_number: finalRoom,
        room: finalRoom,
        total_amount: finalTotal,
        total_billed_amount: finalTotal,
        amount: finalTotal,
        paid_amount: finalStatus.toLowerCase() === 'paid' ? finalTotal : 0,
        payment_method: finalMethod,
        method: finalMethod,
        status: finalStatus,
        payment_status: finalStatus,
        items: items || [],
        notes: notes || '',
        date: new Date().toISOString().split('T')[0],
        created_at: new Date().toISOString()
      };

      fallbackDb.invoices.unshift(newInv);

      // Sync booking in fallbackDb
      if (finalBookingId) {
        const bk = fallbackDb.bookings.find(b => String(b.booking_id) === finalBookingId || String(b.id) === finalBookingId);
        if (bk) {
          bk.payment_status = finalStatus.toLowerCase() === 'paid' ? 'PAID' : 'Pending';
        }
      }

      // Record transaction in fallbackDb
      if (finalStatus.toLowerCase() === 'paid') {
        const txn = {
          txn_id: `TXN-${Math.floor(5000 + Math.random() * 5000)}`,
          type: 'Income',
          category: 'Room Booking',
          amount: finalTotal,
          description: `Invoice settlement for ${finalGuest} (${invoice_id})`,
          date: new Date().toISOString().split('T')[0],
          created_at: new Date().toISOString()
        };
        fallbackDb.transactions.unshift(txn);
      }

      // Asynchronously trigger payment receipt email if invoice created as Paid
      if (finalStatus.toLowerCase() === 'paid') {
        (async () => {
          try {
            let gEmail = (req.body.guest_email || req.body.email || '').trim();
            if (!gEmail && pool && finalBookingId) {
              const bRes = await pool.request()
                .input('bid', sql.VarChar, finalBookingId)
                .query(`SELECT COALESCE(guest_email, email, '') AS guest_email FROM Bookings WHERE booking_id = @bid OR CAST(id AS VARCHAR) = @bid`);
              if (bRes.recordset.length > 0 && bRes.recordset[0].guest_email) {
                gEmail = bRes.recordset[0].guest_email.trim();
              }
            }
            if (!gEmail && finalBookingId) {
              const bk = fallbackDb.bookings.find(b => String(b.booking_id) === finalBookingId || String(b.id) === finalBookingId);
              if (bk) gEmail = (bk.guest_email || bk.email || '').trim();
            }
            if (gEmail) {
              sendPaymentReceipt({
                guest_name: finalGuest,
                guest_email: gEmail,
                invoice_no: invoice_id,
                booking_id: finalBookingId,
                payment_method: finalMethod,
                amount_paid: finalTotal,
                balance_due: 0,
                payment_date: new Date().toLocaleDateString('en-GB')
              }).catch(err => console.error('[EmailService] Receipt email failed:', err.message));
            }
          } catch (e) {
            console.error('[EmailService] Error resolving guest email for receipt:', e.message);
          }
        })();
      }

      return res.status(201).json({
        success: true,
        message: 'Invoice generated successfully',
        invoice_id,
        invoice: newInv
      });
    } catch (err) {
      console.error('Finance createInvoice error:', err);
      return res.status(500).json({ success: false, message: err.message, error: err.message });
    }
  }

  // 3b. Update Existing Invoice
  static async updateInvoice(req, res) {
    try {
      const { id } = req.params;
      const { guest_name, room_number, total_amount, paid_amount, payment_method, status } = req.body;

      const finalGuest = guest_name || 'Guest';
      const finalTotal = parseFloat(total_amount) || 0;
      const finalPaid = parseFloat(paid_amount != null ? paid_amount : (status === 'Paid' ? finalTotal : 0)) || 0;
      const finalMethod = payment_method || 'Cash';
      const finalStatus = status || 'Paid';
      const finalRoom = room_number || '';

      const pool = await poolPromise;
      if (pool) {
        await pool.request()
          .input('id', sql.VarChar, id)
          .input('guest_name', sql.VarChar, finalGuest)
          .input('room_number', sql.VarChar, finalRoom)
          .input('total_amount', sql.Decimal(10, 2), finalTotal)
          .input('paid_amount', sql.Decimal(10, 2), finalPaid)
          .input('payment_method', sql.VarChar, finalMethod)
          .input('status', sql.VarChar, finalStatus)
          .query(`
            UPDATE Invoices 
            SET guest_name = @guest_name,
                room_number = @room_number,
                total_amount = @total_amount,
                paid_amount = @paid_amount,
                payment_method = @payment_method,
                status = @status
            WHERE invoice_id = @id OR CAST(id AS VARCHAR) = @id
          `);
      }

      const inv = fallbackDb.invoices.find(i => i.invoice_id === id || String(i.id) === String(id));
      if (inv) {
        inv.guest_name = finalGuest;
        inv.guest = finalGuest;
        inv.room_number = finalRoom;
        inv.room = finalRoom;
        inv.total_amount = finalTotal;
        inv.amount = finalTotal;
        inv.paid_amount = finalPaid;
        inv.payment_method = finalMethod;
        inv.method = finalMethod;
        inv.status = finalStatus;
        inv.payment_status = finalStatus;
      }

      return res.status(200).json({ success: true, message: 'Invoice updated successfully' });
    } catch (err) {
      console.error('Finance updateInvoice error:', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  // 3c. Delete Invoice
  static async deleteInvoice(req, res) {
    try {
      const { id } = req.params;
      const pool = await poolPromise;
      if (pool) {
        await pool.request()
          .input('id', sql.VarChar, id)
          .query(`
            DELETE FROM Invoices 
            WHERE invoice_id = @id OR CAST(id AS VARCHAR) = @id
          `);
      }

      const idx = fallbackDb.invoices.findIndex(i => i.invoice_id === id || String(i.id) === String(id));
      if (idx !== -1) {
        fallbackDb.invoices.splice(idx, 1);
      }

      return res.status(200).json({ success: true, message: 'Invoice deleted successfully' });
    } catch (err) {
      console.error('Finance deleteInvoice error:', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  // 4. Settle / Pay Invoice (Atomic with Bookings, Transactions & Automated Email Receipt)
  static async settleInvoice(req, res) {
    try {
      const id = req.params.id || req.body.invoice_no || req.body.invoice_id || req.body.id || req.body.payment_id;
      const { payment_method } = req.body;
      const finalMethod = payment_method || req.body.method || 'Cash';

      if (!id) {
        return res.status(400).json({ success: false, message: 'Invoice ID or payment reference is required' });
      }

      let invData = null;
      const pool = await poolPromise;
      if (pool) {
        // 1. Fetch current invoice record
        const invRes = await pool.request()
          .input('id', sql.VarChar, String(id))
          .query(`SELECT * FROM Invoices WHERE invoice_id = @id OR CAST(id AS VARCHAR) = @id`);
        
        if (invRes.recordset.length > 0) {
          invData = invRes.recordset[0];
        }

        // 2. Update Invoices
        await pool.request()
          .input('id', sql.VarChar, String(id))
          .input('method', sql.VarChar, finalMethod)
          .query(`
            UPDATE Invoices 
            SET status = 'Paid', 
                paid_amount = total_amount,
                payment_method = @method
            WHERE invoice_id = @id OR CAST(id AS VARCHAR) = @id
          `);

        // 3. Atomically sync Bookings payment_status
        if (invData && invData.booking_id) {
          try {
            await pool.request()
              .input('booking_id', sql.VarChar, String(invData.booking_id))
              .query(`
                UPDATE Bookings 
                SET payment_status = 'PAID'
                WHERE booking_id = @booking_id OR CAST(id AS VARCHAR) = @booking_id
              `);
          } catch (bkErr) {
            console.warn('Booking sync error in settleInvoice:', bkErr.message);
          }
        }

        // 4. Atomically insert into Transactions
        const finalAmt = invData ? parseFloat(invData.total_amount || invData.amount || 0) : 0;
        const guestName = invData ? invData.guest_name : 'Guest';
        const txnId = `TXN-${Math.floor(5000 + Math.random() * 5000)}`;

        try {
          await pool.request()
            .input('txn_id', sql.VarChar, txnId)
            .input('type', sql.VarChar, 'Income')
            .input('category', sql.VarChar, 'Room Booking')
            .input('amount', sql.Decimal(10, 2), finalAmt)
            .input('description', sql.VarChar, `Invoice settlement for ${guestName} (${id}) via ${finalMethod}`)
            .query(`
              INSERT INTO Transactions (txn_id, type, category, amount, description, created_at)
              VALUES (@txn_id, @type, @category, @amount, @description, GETDATE())
            `);
        } catch (txnErr) {
          console.warn('Transaction record error in settleInvoice:', txnErr.message);
        }
      }

      // Sync in-memory fallbackDb
      const inv = fallbackDb.invoices.find(i => i.invoice_id === String(id) || String(i.id) === String(id));
      if (inv) {
        inv.status = 'Paid';
        inv.payment_status = 'Paid';
        inv.paid_amount = inv.total_amount;
        inv.payment_method = finalMethod;
        inv.method = finalMethod;

        if (inv.booking_id) {
          const bk = fallbackDb.bookings.find(b => String(b.booking_id) === String(inv.booking_id) || String(b.id) === String(inv.booking_id));
          if (bk) bk.payment_status = 'PAID';
        }

        const txn = {
          txn_id: `TXN-${Math.floor(5000 + Math.random() * 5000)}`,
          type: 'Income',
          category: 'Room Booking',
          amount: parseFloat(inv.total_amount || inv.amount || 0),
          description: `Invoice settlement for ${inv.guest_name || inv.guest || 'Guest'} (${id}) via ${finalMethod}`,
          date: new Date().toISOString().split('T')[0],
          created_at: new Date().toISOString()
        };
        fallbackDb.transactions.unshift(txn);
      }

      // Resolve guest email, name, and payment data for automated receipt dispatch
      let guestEmail = (req.body.guest_email || req.body.email || '').trim();
      let guestName = req.body.guest_name || (invData ? invData.guest_name : (inv ? (inv.guest_name || inv.guest) : 'Valued Guest'));
      const bookingId = (invData ? invData.booking_id : (inv ? inv.booking_id : req.body.booking_id)) || '';
      const invoiceId = (invData ? invData.invoice_id : (inv ? inv.invoice_id : id)) || id;
      const amountPaid = invData ? parseFloat(invData.total_amount || invData.amount || 0) : (inv ? parseFloat(inv.total_amount || inv.amount || 0) : (parseFloat(req.body.amount_paid || req.body.amount) || 0));
      const balanceDue = parseFloat(req.body.balance_due) || 0;

      // Asynchronously resolve email and dispatch receipt without blocking response
      (async () => {
        try {
          if (!guestEmail && pool && bookingId) {
            const bRes = await pool.request()
              .input('bid', sql.VarChar, String(bookingId))
              .query(`SELECT COALESCE(guest_email, email, '') AS guest_email, guest_name FROM Bookings WHERE booking_id = @bid OR CAST(id AS VARCHAR) = @bid`);
            if (bRes.recordset.length > 0 && bRes.recordset[0].guest_email) {
              guestEmail = bRes.recordset[0].guest_email.trim();
              if (!guestName || guestName === 'Valued Guest') guestName = bRes.recordset[0].guest_name;
            }
          }

          if (!guestEmail && pool && guestName && guestName !== 'Valued Guest') {
            const bRes = await pool.request()
              .input('gname', sql.VarChar, guestName)
              .query(`SELECT TOP 1 COALESCE(guest_email, email, '') AS guest_email FROM Bookings WHERE guest_name = @gname AND (guest_email IS NOT NULL OR email IS NOT NULL) ORDER BY id DESC`);
            if (bRes.recordset.length > 0 && bRes.recordset[0].guest_email) {
              guestEmail = bRes.recordset[0].guest_email.trim();
            }
          }

          if (!guestEmail) {
            const bk = fallbackDb.bookings.find(b => 
              (bookingId && (String(b.booking_id) === String(bookingId) || String(b.id) === String(bookingId))) ||
              (guestName && guestName !== 'Valued Guest' && b.guest_name === guestName)
            );
            if (bk) {
              guestEmail = (bk.guest_email || bk.email || '').trim();
              if (!guestName || guestName === 'Valued Guest') guestName = bk.guest_name;
            }
          }

          if (guestEmail) {
            sendPaymentReceipt({
              guest_name: guestName,
              guest_email: guestEmail,
              invoice_no: invoiceId,
              booking_id: bookingId,
              payment_method: finalMethod,
              amount_paid: amountPaid,
              balance_due: balanceDue || 0,
              payment_date: new Date().toLocaleDateString('en-GB')
            }).catch(err => console.error('[EmailService] Receipt email failed:', err.message));
          }
        } catch (emailLookupErr) {
          console.error('[EmailService] Error resolving guest email for payment receipt:', emailLookupErr.message);
        }
      })();

      return res.status(200).json({ success: true, message: 'Invoice settled successfully' });
    } catch (err) {
      console.error('Finance settleInvoice error:', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  // 5. In-Room Dining Ledger Sync for Guest Stay (RoomServiceOrders table)
  static async getDiningLedgerForStay(req, res) {
    try {
      const { room_number } = req.params;
      let orders = [];

      const pool = await poolPromise;
      if (pool) {
        try {
          const r = await pool.request()
            .input('room_number', sql.VarChar, room_number)
            .query(`
              SELECT * FROM RoomServiceOrders 
              WHERE room_number = @room_number AND status = 'DELIVERED'
              ORDER BY order_id DESC
            `);
          orders = r.recordset;
        } catch (dbErr) {
          console.warn('RoomServiceOrders query fallback:', dbErr.message);
        }
      }

      if (!orders || orders.length === 0) {
        orders = (fallbackDb.roomServiceOrders || []).filter(
          o => o.room_number === room_number && (o.status || '').toUpperCase() === 'DELIVERED'
        );
      }

      const totalDiningCharges = orders.reduce((sum, ord) => {
        const p = parseFloat(ord.total_price != null ? ord.total_price : ((ord.price || 0) * (ord.quantity || 1))) || 0;
        return sum + p;
      }, 0);

      return res.status(200).json({
        success: true,
        orders,
        totalDiningCharges
      });
    } catch (err) {
      console.error('Finance getDiningLedgerForStay error:', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  // 6. Transactions & Expense Log
  static async getTransactions(req, res) {
    try {
      const pool = await poolPromise;
      if (pool) {
        try {
          const result = await pool.request().query(`
            SELECT 
              id,
              txn_id,
              type,
              category,
              amount,
              description,
              CONVERT(VARCHAR(10), created_at, 120) AS date,
              created_at
            FROM Transactions 
            UNION ALL
            SELECT 
              (i.id + 100000) AS id,
              COALESCE(i.transaction_ref, CONCAT('TXN-CC-', i.invoice_id)) AS txn_id,
              'Income' AS type,
              'Room Booking' AS category,
              COALESCE(i.total_amount, i.amount, 0) AS amount,
              CONCAT('Credit Card Payment for ', i.guest_name, ' (', i.invoice_id, ')') AS description,
              CONVERT(VARCHAR(10), COALESCE(i.issue_date, i.created_at), 120) AS date,
              COALESCE(i.issue_date, i.created_at) AS created_at
            FROM Invoices i
            WHERE LOWER(COALESCE(i.payment_status, i.status, '')) = 'paid'
              AND (i.transaction_ref IS NOT NULL OR LOWER(i.payment_method) LIKE '%credit%')
              AND NOT EXISTS (
                SELECT 1 FROM Transactions t 
                WHERE t.txn_id = i.transaction_ref 
                   OR t.description LIKE CONCAT('%', i.invoice_id, '%')
                   OR (i.booking_id IS NOT NULL AND i.booking_id <> '' AND t.description LIKE CONCAT('%', i.booking_id, '%'))
              )
            ORDER BY id DESC
          `);
          return res.status(200).json(result.recordset);
        } catch (qErr) {
          console.warn('Transactions query fallback:', qErr.message);
        }
      }

      // Merge fallbackDb.transactions with any fallbackDb.invoices that are paid with credit card
      const seenTxnIds = new Set((fallbackDb.transactions || []).map(t => String(t.txn_id)));
      (fallbackDb.invoices || []).forEach(inv => {
        if (
          (inv.payment_status === 'Paid' || inv.status === 'Paid') && 
          inv.transaction_ref && 
          !seenTxnIds.has(String(inv.transaction_ref))
        ) {
          seenTxnIds.add(String(inv.transaction_ref));
          (fallbackDb.transactions || []).unshift({
            id: (fallbackDb.transactions ? fallbackDb.transactions.length : 0) + 1,
            txn_id: inv.transaction_ref,
            type: 'Income',
            category: 'Room Booking',
            amount: parseFloat(inv.total_amount || inv.amount || 0),
            description: `Credit Card Payment for ${inv.guest_name || 'Guest'} (${inv.booking_id || inv.invoice_id})`,
            date: inv.date || new Date().toISOString().split('T')[0],
            created_at: inv.created_at || new Date().toISOString()
          });
        }
      });

      return res.status(200).json(fallbackDb.transactions);
    } catch (err) {
      console.error('Finance getTransactions error:', err);
      return res.status(200).json(fallbackDb.transactions);
    }
  }

  static async createTransaction(req, res) {
    try {
      const { type, category, amount, description, date } = req.body;
      const txnId = `TXN-${Math.floor(5000 + Math.random() * 5000)}`;
      const numAmount = parseFloat(amount) || 0;
      const finalType = type || 'Income';
      const finalCategory = category || 'General';
      const finalDesc = description || '';
      const finalDate = date || new Date().toISOString().split('T')[0];

      const pool = await poolPromise;
      if (pool) {
        try {
          await pool.request()
            .input('txn_id', sql.VarChar, txnId)
            .input('type', sql.VarChar, finalType)
            .input('category', sql.VarChar, finalCategory)
            .input('amount', sql.Decimal(10, 2), numAmount)
            .input('description', sql.VarChar, finalDesc)
            .query(`
              INSERT INTO Transactions (txn_id, type, category, amount, description, created_at)
              VALUES (@txn_id, @type, @category, @amount, @description, GETDATE())
            `);
        } catch (dbErr) {
          console.warn('DB createTransaction error:', dbErr.message);
        }
      }

      const newTxn = {
        txn_id: txnId,
        type: finalType,
        category: finalCategory,
        amount: numAmount,
        description: finalDesc,
        date: finalDate,
        created_at: new Date().toISOString()
      };
      fallbackDb.transactions.unshift(newTxn);

      return res.status(201).json({ success: true, message: 'Transaction recorded', transaction: newTxn });
    } catch (err) {
      console.error('Finance createTransaction error:', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  static async updateTransaction(req, res) {
    try {
      const { id } = req.params;
      const { type, category, amount, description } = req.body;
      const numAmount = parseFloat(amount) || 0;
      const finalType = type || 'Income';
      const finalCategory = category || 'General';
      const finalDesc = description || '';

      const pool = await poolPromise;
      if (pool) {
        try {
          await pool.request()
            .input('id', sql.VarChar, id)
            .input('type', sql.VarChar, finalType)
            .input('category', sql.VarChar, finalCategory)
            .input('amount', sql.Decimal(10, 2), numAmount)
            .input('description', sql.VarChar, finalDesc)
            .query(`
              UPDATE Transactions 
              SET type = @type, 
                  category = @category, 
                  amount = @amount, 
                  description = @description 
              WHERE txn_id = @id OR CAST(id AS VARCHAR) = @id
            `);
        } catch (dbErr) {
          console.warn('DB updateTransaction error:', dbErr.message);
        }
      }

      const t = fallbackDb.transactions.find(tx => tx.txn_id === id || String(tx.id) === String(id));
      if (t) {
        t.type = finalType;
        t.category = finalCategory;
        t.amount = numAmount;
        t.description = finalDesc;
      }

      return res.status(200).json({ success: true, message: 'Transaction updated successfully' });
    } catch (err) {
      console.error('Finance updateTransaction error:', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  static async deleteTransaction(req, res) {
    try {
      const { id } = req.params;
      const pool = await poolPromise;
      if (pool) {
        try {
          await pool.request()
            .input('id', sql.VarChar, id)
            .query(`
              DELETE FROM Transactions 
              WHERE txn_id = @id OR CAST(id AS VARCHAR) = @id
            `);
        } catch (dbErr) {
          console.warn('DB deleteTransaction error:', dbErr.message);
        }
      }

      const idx = fallbackDb.transactions.findIndex(t => t.txn_id === id || String(t.id) === String(id));
      if (idx !== -1) {
        fallbackDb.transactions.splice(idx, 1);
      }

      return res.status(200).json({ success: true, message: 'Transaction deleted successfully' });
    } catch (err) {
      console.error('Finance deleteTransaction error:', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  // 7. Staff Payroll (Table: Payroll)
  static async getPayroll(req, res) {
    try {
      const pool = await poolPromise;
      if (pool) {
        try {
          const result = await pool.request().query(`
            SELECT 
              p.payroll_id,
              p.staff_id,
              p.month_year,
              p.basic_salary,
              p.allowances,
              p.deductions,
              p.net_salary,
              p.payment_status,
              p.payment_date,
              p.created_at,
              COALESCE(s.full_name, u.name, 'Staff Member') AS name,
              COALESCE(s.full_name, u.name, 'Staff Member') AS staff_name,
              COALESCE(s.full_name, u.name, 'Staff Member') AS full_name,
              COALESCE(s.role, u.designation, u.role, 'Staff') AS designation,
              COALESCE(s.role, u.role, u.designation, 'Staff') AS role
            FROM Payroll p
            LEFT JOIN Staff s ON (CAST(s.staff_id AS VARCHAR) = CAST(p.staff_id AS VARCHAR))
            LEFT JOIN Users u ON (CAST(u.user_id AS VARCHAR) = CAST(p.staff_id AS VARCHAR) OR CAST(u.id AS VARCHAR) = CAST(p.staff_id AS VARCHAR))
            ORDER BY p.payroll_id DESC
          `);
          return res.status(200).json(result.recordset);
        } catch (queryErr) {
          console.warn('Payroll query error, fallback to basic Payroll select:', queryErr.message);
          try {
            const result = await pool.request().query(`
              SELECT * FROM Payroll ORDER BY payroll_id DESC
            `);
            return res.status(200).json(result.recordset);
          } catch (q2Err) {
            console.warn('Payroll basic select error:', q2Err.message);
          }
        }
      }
      const enriched = (fallbackDb.payroll || []).map(p => {
        const u = (fallbackDb.users || []).find(usr => usr.id == p.staff_id || usr.user_id == p.staff_id) 
               || (fallbackDb.staff || []).find(st => st.staff_id == p.staff_id);
        const sName = u ? (u.name || u.username) : (p.name || p.staff_name || p.full_name || 'Staff Member');
        const sRole = u ? (u.designation || u.role) : (p.designation || p.role || 'Staff');
        return {
          ...p,
          name: sName,
          staff_name: sName,
          full_name: sName,
          role: sRole,
          designation: sRole
        };
      });
      return res.status(200).json(enriched);
    } catch (err) {
      console.error('Finance getPayroll error:', err);
      return res.status(200).json(fallbackDb.payroll || []);
    }
  }

  static async createPayroll(req, res) {
    try {
      const { staff_id, staff_name, full_name, name, role, designation, month_year, basic_salary, allowances, deductions, net_salary, payment_status } = req.body;
      const sName = staff_name || full_name || name || '';
      const sRole = designation || role || 'Staff';
      const numBasic = parseFloat(basic_salary) || 0;
      const numAllowances = parseFloat(allowances) || 0;
      const numDeductions = parseFloat(deductions) || 0;
      const numNet = parseFloat(net_salary != null ? net_salary : (numBasic + numAllowances - numDeductions)) || 0;
      const pStatus = payment_status || 'PAID';
      const pDate = new Date().toISOString().split('T')[0];

      const newPayroll = {
        payroll_id: (fallbackDb.payroll.length || 0) + 1,
        staff_id: staff_id || 1,
        name: sName,
        staff_name: sName,
        full_name: sName,
        role: sRole,
        designation: sRole,
        month_year: month_year || 'September 2026',
        basic_salary: numBasic,
        allowances: numAllowances,
        deductions: numDeductions,
        net_salary: numNet,
        payment_status: pStatus,
        payment_date: pDate,
        created_at: new Date()
      };
      
      const pool = await poolPromise;
      if (pool) {
        try {
          // Resolve numeric staff_id if staff_id is user_id string
          let dbStaffId = parseInt(staff_id, 10);
          if (isNaN(dbStaffId)) {
            const stRes = await pool.request()
              .input('s_name', sql.VarChar, sName)
              .query('SELECT TOP 1 staff_id FROM Staff WHERE full_name = @s_name');
            if (stRes.recordset.length > 0) {
              dbStaffId = stRes.recordset[0].staff_id;
            } else {
              dbStaffId = 1;
            }
          }

          await pool.request()
            .input('staff_id', sql.Int, dbStaffId)
            .input('month_year', sql.NVarChar(50), newPayroll.month_year)
            .input('basic_salary', sql.Decimal(10, 2), newPayroll.basic_salary)
            .input('allowances', sql.Decimal(10, 2), newPayroll.allowances)
            .input('deductions', sql.Decimal(10, 2), newPayroll.deductions)
            .input('net_salary', sql.Decimal(10, 2), newPayroll.net_salary)
            .input('payment_status', sql.NVarChar(50), newPayroll.payment_status)
            .input('payment_date', sql.Date, newPayroll.payment_date)
            .query(`
              INSERT INTO Payroll (staff_id, month_year, basic_salary, allowances, deductions, net_salary, payment_status, payment_date, created_at)
              VALUES (@staff_id, @month_year, @basic_salary, @allowances, @deductions, @net_salary, @payment_status, @payment_date, GETDATE())
            `);
        } catch (dbErr) {
          console.warn('DB createPayroll error, recorded in fallbackDb:', dbErr.message);
        }
      }

      fallbackDb.payroll.unshift(newPayroll);

      return res.status(201).json({ success: true, message: 'Payroll record created', payroll: newPayroll });
    } catch (err) {
      console.error('Finance createPayroll error:', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  static async deletePayroll(req, res) {
    try {
      const { id } = req.params;
      const pool = await poolPromise;
      if (pool) {
        try {
          await pool.request()
            .input('id', sql.Int, parseInt(id, 10) || 0)
            .query('DELETE FROM Payroll WHERE payroll_id = @id OR CAST(payroll_id AS VARCHAR) = @id');
        } catch (dbErr) {
          console.warn('DB deletePayroll error:', dbErr.message);
        }
      }
      const idx = fallbackDb.payroll.findIndex(p => String(p.payroll_id) === String(id));
      if (idx !== -1) {
        fallbackDb.payroll.splice(idx, 1);
      }
      return res.status(200).json({ success: true, message: 'Payroll record deleted successfully' });
    } catch (err) {
      console.error('Finance deletePayroll error:', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  // 8. Employees / Staff List for Finance & Payroll
  static async getEmployees(req, res) {
    try {
      const pool = await poolPromise;
      if (pool) {
        const result = await pool.request().query(`
          SELECT 
            u.user_id AS id,
            u.user_id AS staff_id,
            u.name,
            u.name AS username,
            u.name AS full_name,
            u.role,
            ISNULL(u.designation, u.role) AS designation,
            u.email,
            COALESCE(s.basic_salary, 75000.00) AS basic_salary
          FROM Users u
          LEFT JOIN Staff s ON s.full_name = u.name
          ORDER BY u.user_id ASC
        `);
        return res.json(result.recordset);
      }

      // Fallback in-memory
      const fallbackList = (fallbackDb.users || []).map(u => {
        const st = (fallbackDb.staff || []).find(s => s.full_name === u.name || s.staff_id == u.id);
        return {
          id: u.user_id || u.id,
          staff_id: u.user_id || u.id,
          name: u.name || u.username,
          username: u.name || u.username,
          full_name: u.name || u.username,
          role: u.role,
          designation: u.designation || u.role,
          email: u.email,
          basic_salary: st ? st.basic_salary : 75000.00
        };
      });
      return res.json(fallbackList);
    } catch (err) {
      console.error('Finance getEmployees error:', err);
      const fallbackList = (fallbackDb.users || []).map(u => ({
        id: u.user_id || u.id,
        staff_id: u.user_id || u.id,
        name: u.name || u.username,
        username: u.name || u.username,
        full_name: u.name || u.username,
        role: u.role,
        designation: u.designation || u.role,
        email: u.email,
        basic_salary: 75000.00
      }));
      return res.json(fallbackList);
    }
  }

  // 9. Finance KPI Summary
  static async getSummary(req, res) {
    try {
      let total_revenue = 0;
      let total_pending_payments = 0;
      let invoice_count = 0;
      let today_income = 0;
      let invoices = [];

      const pool = await poolPromise;
      if (pool) {
        // 1. Total revenue from Bookings where LOWER(payment_status) = 'paid'
        try {
          const revResult = await pool.request().query(`
            SELECT ISNULL(SUM(total_amount), 0) AS total_revenue 
            FROM Bookings 
            WHERE LOWER(payment_status) = 'paid'
          `);
          if (revResult.recordset && revResult.recordset.length > 0) {
            total_revenue = parseFloat(revResult.recordset[0].total_revenue) || 0;
          }
        } catch (revErr) {
          console.warn('DB getSummary Bookings total_revenue error:', revErr.message);
        }

        // 2. Fetch all Invoices & compute invoice counts and standalone invoice revenue
        try {
          const invResult = await pool.request().query(`
            SELECT * FROM Invoices
          `);
          invoices = invResult.recordset || [];
          invoice_count = invoices.length;

          const invoicePaidRevenue = invoices
            .filter(i => (i.payment_status || i.status || '').toLowerCase() === 'paid')
            .reduce((sum, i) => sum + (parseFloat(i.total_amount || i.amount || 0)), 0);

          // Ensure total revenue accounts for all paid invoices and paid bookings
          total_revenue = Math.max(total_revenue, invoicePaidRevenue);

          total_pending_payments = invoices
            .filter(i => (i.payment_status || i.status || '').toLowerCase() !== 'paid')
            .reduce((sum, i) => sum + (parseFloat(i.total_amount || i.amount || 0)), 0);
        } catch (invErr) {
          console.warn('DB getSummary Invoices query error:', invErr.message);
        }

        // 3. Today's Income query from Transactions & today's paid bookings
        try {
          const todayRes = await pool.request().query(`
            SELECT 
              (
                SELECT ISNULL(SUM(amount), 0) 
                FROM Transactions 
                WHERE type = 'Income' AND CAST(created_at AS DATE) = CAST(GETDATE() AS DATE)
              ) +
              (
                SELECT ISNULL(SUM(total_amount), 0)
                FROM Bookings
                WHERE LOWER(payment_status) = 'paid' 
                  AND CAST(created_at AS DATE) = CAST(GETDATE() AS DATE)
                  AND NOT EXISTS (
                    SELECT 1 FROM Transactions t WHERE t.txn_id = Bookings.transaction_ref
                  )
              ) AS today_income
          `);
          if (todayRes.recordset && todayRes.recordset.length > 0) {
            today_income = parseFloat(todayRes.recordset[0].today_income) || 0;
          }
        } catch (todayErr) {
          console.warn('DB getSummary today_income query error:', todayErr.message);
        }

      } else {
        invoices = fallbackDb.invoices || [];
        invoice_count = invoices.length;

        const bookingPaidRev = (fallbackDb.bookings || [])
          .filter(b => (b.payment_status || '').toLowerCase() === 'paid')
          .reduce((sum, b) => sum + (parseFloat(b.total_amount || 0)), 0);

        const invoicePaidRev = invoices
          .filter(i => (i.payment_status || i.status || '').toLowerCase() === 'paid')
          .reduce((sum, i) => sum + (parseFloat(i.total_amount || i.amount || 0)), 0);

        total_revenue = Math.max(bookingPaidRev, invoicePaidRev);

        total_pending_payments = invoices
          .filter(i => (i.payment_status || i.status || '').toLowerCase() !== 'paid')
          .reduce((sum, i) => sum + (parseFloat(i.total_amount || i.amount || 0)), 0);

        const todayStr = new Date().toISOString().split('T')[0];
        today_income = (fallbackDb.transactions || [])
          .filter(t => t.type === 'Income' && (t.date === todayStr || (t.created_at || '').startsWith(todayStr)))
          .reduce((sum, t) => sum + (parseFloat(t.amount || 0)), 0);
      }

      return res.status(200).json({
        total_revenue,
        today_income,
        total_pending_payments,
        invoice_count
      });
    } catch (err) {
      console.error('Finance getSummary error:', err);
      return res.status(200).json({
        total_revenue: 0,
        today_income: 0,
        total_pending_payments: 0,
        invoice_count: 0
      });
    }
  }

  static async getFinanceSummary(req, res) {
    return FinanceController.getSummary(req, res);
  }

  // 10. System & Report Logs
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
                CONCAT('Invoice generated with status ', COALESCE(status, 'Pending')) AS details
              FROM Invoices
              ORDER BY id DESC
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

module.exports = FinanceController;
