require('dotenv').config();
const nodemailer = require('nodemailer');

/**
 * Retrieves sanitized email credentials from environment.
 */
function getEmailCredentials() {
  const user = (process.env.EMAIL_USER || '').trim();
  const pass = (process.env.EMAIL_PASS || '').replace(/\s+/g, '');
  return { user, pass };
}

/**
 * Nodemailer SMTP Transporter configured for Gmail service.
 */
function createTransporter() {
  const { user, pass } = getEmailCredentials();
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user,
      pass
    }
  });
}

const transporter = createTransporter();

/**
 * Format currency nicely for email display.
 */
function formatCurrency(amount) {
  if (amount === null || amount === undefined || isNaN(amount)) return 'N/A';
  const num = typeof amount === 'number' ? amount : parseFloat(amount);
  return 'LKR ' + num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Sends a luxury-branded booking confirmation email to the guest.
 * 
 * @param {Object} bookingData - Details of the confirmed booking.
 * @param {string} bookingData.booking_id - Booking Reference Code (e.g. BK-1024).
 * @param {string} bookingData.guest_name - Full Name of the guest.
 * @param {string} [bookingData.guest_email] - Primary guest email address.
 * @param {string} [bookingData.email] - Fallback guest email address.
 * @param {string} [bookingData.room_number] - Assigned room number.
 * @param {string} [bookingData.room_type] - Category / Room Type.
 * @param {string} [bookingData.meal_package] - Meal plan (Room Only, BB, HB, FB).
 * @param {string} [bookingData.check_in] - Check-in date (YYYY-MM-DD).
 * @param {string} [bookingData.check_out] - Check-out date (YYYY-MM-DD).
 * @param {number|string} [bookingData.total_amount] - Total booking amount.
 * @param {string} [bookingData.payment_status] - Status (Paid, Partially Paid, Pending).
 * @param {string} [bookingData.payment_method] - Method used for payment.
 * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
 */
async function sendBookingConfirmation(bookingData = {}) {
  const recipient = (bookingData.guest_email || bookingData.email || '').trim();
  const bookingId = bookingData.booking_id || 'PENDING';
  const guestName = bookingData.guest_name || 'Valued Guest';
  const roomInfo = (bookingData.room_number ? `Room ${bookingData.room_number} • ` : '') + (bookingData.room_type || bookingData.category || 'Luxury Suite');
  const mealPkg = bookingData.meal_package || bookingData.package_name || 'Room Only';
  const checkIn = bookingData.check_in || bookingData.check_in_date || 'N/A';
  const checkOut = bookingData.check_out || bookingData.check_out_date || 'N/A';
  const totalAmountStr = formatCurrency(bookingData.total_amount);
  const paymentStatus = bookingData.payment_status || 'Pending';
  const paymentMethod = bookingData.payment_method || 'Pay at Reception';

  if (!recipient) {
    console.warn(`[EmailService] Cannot send confirmation for booking ${bookingId}: No recipient email provided.`);
    return { success: false, error: 'No recipient email provided' };
  }

  // Soft check for email credentials
  const { user, pass } = getEmailCredentials();
  if (!user || !pass) {
    console.warn(`[EmailService] EMAIL_USER or EMAIL_PASS not configured in .env. Skipping SMTP dispatch for ${bookingId}.`);
    return { success: false, error: 'Email credentials not configured in .env' };
  }

  const isPaid = paymentStatus.toLowerCase() === 'paid';
  const statusBadgeBg = isPaid ? '#10b981' : '#f59e0b';

  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Booking Confirmation - Pinnacle Bay Luxury Hotel</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #0b1120;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #e2e8f0;
      line-height: 1.6;
    }
    .wrapper {
      width: 100%;
      background-color: #0b1120;
      padding: 30px 10px;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #0f172a;
      border-radius: 12px;
      overflow: hidden;
      border: 1px solid rgba(197, 168, 128, 0.25);
      box-shadow: 0 20px 40px rgba(0,0,0,0.5);
    }
    .header {
      background: linear-gradient(135deg, #070a13 0%, #1e293b 100%);
      padding: 36px 30px;
      text-align: center;
      border-bottom: 2px solid #c5a880;
    }
    .brand-title {
      margin: 0;
      font-size: 26px;
      font-weight: 800;
      letter-spacing: 2px;
      color: #c5a880;
      text-transform: uppercase;
    }
    .brand-subtitle {
      margin: 6px 0 0 0;
      font-size: 13px;
      letter-spacing: 1.5px;
      color: #94a3b8;
      text-transform: uppercase;
    }
    .content {
      padding: 32px 30px;
    }
    .greeting {
      font-size: 20px;
      font-weight: 600;
      color: #ffffff;
      margin-bottom: 12px;
    }
    .intro-text {
      font-size: 14.5px;
      color: #cbd5e1;
      margin-bottom: 24px;
    }
    .badge-card {
      background: rgba(197, 168, 128, 0.08);
      border: 1px solid rgba(197, 168, 128, 0.25);
      border-radius: 8px;
      padding: 16px 20px;
      margin-bottom: 24px;
      text-align: center;
    }
    .ref-label {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      color: #94a3b8;
      margin: 0 0 4px 0;
    }
    .ref-number {
      font-size: 22px;
      font-weight: 700;
      color: #c5a880;
      letter-spacing: 1px;
      margin: 0;
    }
    .table-details {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 26px;
    }
    .table-details td {
      padding: 12px 14px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
      font-size: 14px;
    }
    .table-details tr:last-child td {
      border-bottom: none;
    }
    .label-col {
      color: #94a3b8;
      font-weight: 500;
      width: 40%;
    }
    .value-col {
      color: #f8fafc;
      font-weight: 600;
      text-align: right;
    }
    .status-pill {
      display: inline-block;
      padding: 3px 10px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
      color: #ffffff;
      background-color: ${statusBadgeBg};
    }
    .total-highlight {
      color: #c5a880;
      font-size: 16px;
      font-weight: 700;
    }
    .note-box {
      background: rgba(15, 23, 42, 0.6);
      border-left: 3px solid #c5a880;
      padding: 14px 16px;
      border-radius: 0 6px 6px 0;
      font-size: 13px;
      color: #94a3b8;
      margin-bottom: 24px;
    }
    .footer {
      background-color: #070a13;
      padding: 24px 30px;
      text-align: center;
      border-top: 1px solid rgba(255, 255, 255, 0.06);
      font-size: 12px;
      color: #64748b;
    }
    .footer p {
      margin: 4px 0;
    }
    .footer a {
      color: #c5a880;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <!-- Header -->
      <div class="header">
        <h1 class="brand-title">Pinnacle Bay 96</h1>
        <p class="brand-subtitle">Luxury Coastal Sanctuary • Hiriketiya, Sri Lanka</p>
      </div>

      <!-- Main Content -->
      <div class="content">
        <div class="greeting">Dear ${guestName},</div>
        <p class="intro-text">
          Thank you for choosing Pinnacle Bay 96. We are delighted to confirm your upcoming reservation. Our concierge team is preparing every detail to ensure an exceptional sanctuary experience.
        </p>

        <!-- Booking Reference Banner -->
        <div class="badge-card">
          <div class="ref-label">Booking Confirmation Reference</div>
          <div class="ref-number">${bookingId}</div>
        </div>

        <!-- Reservation Details Table -->
        <table class="table-details">
          <tr>
            <td class="label-col">Guest Full Name</td>
            <td class="value-col">${guestName}</td>
          </tr>
          <tr>
            <td class="label-col">Room / Category</td>
            <td class="value-col">${roomInfo}</td>
          </tr>
          <tr>
            <td class="label-col">Meal Package</td>
            <td class="value-col">${mealPkg}</td>
          </tr>
          <tr>
            <td class="label-col">Check-in Date</td>
            <td class="value-col">${checkIn} (From 2:00 PM)</td>
          </tr>
          <tr>
            <td class="label-col">Check-out Date</td>
            <td class="value-col">${checkOut} (Until 11:00 AM)</td>
          </tr>
          <tr>
            <td class="label-col">Payment Method</td>
            <td class="value-col">${paymentMethod}</td>
          </tr>
          <tr>
            <td class="label-col">Payment Status</td>
            <td class="value-col">
              <span class="status-pill">${paymentStatus}</span>
            </td>
          </tr>
          <tr>
            <td class="label-col">Total Amount</td>
            <td class="value-col total-highlight">${totalAmountStr}</td>
          </tr>
        </table>

        <!-- Check-in Guidance -->
        <div class="note-box">
          <strong>Important Check-in Notice:</strong> Please present a valid government-issued photo ID (NIC or Passport) along with this booking reference upon arrival at reception.
        </div>
      </div>

      <!-- Footer -->
      <div class="footer">
        <p><strong>Pinnacle Bay 96 Luxury Resort & Sanctuary</strong></p>
        <p>Hiriketiya Coastal Bay, Dikwella 82400, Sri Lanka</p>
        <p>Email: <a href="mailto:reservations@pinnaclebay.com">reservations@pinnaclebay.com</a> | Tel: +94 41 228 9600</p>
        <p style="margin-top: 12px; color: #475569;">© ${new Date().getFullYear()} Pinnacle Bay 96. All rights reserved.</p>
      </div>
    </div>
  </div>
</body>
</html>
  `;

  const mailOptions = {
    from: `"Pinnacle Bay Luxury Hotel" <${user || 'reservations@pinnaclebay.com'}>`,
    to: recipient,
    subject: `Booking Confirmed! [Ref: ${bookingId}]`,
    html: htmlContent
  };

  try {
    const activeTransporter = createTransporter();
    const info = await activeTransporter.sendMail(mailOptions);
    console.log(`✔ [EmailService] Booking confirmation email dispatched to ${recipient} (Ref: ${bookingId}, ID: ${info.messageId})`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error(`✖ [EmailService] Delivery error sending booking confirmation to ${recipient} (Ref: ${bookingId}):`, err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Verifies the Gmail SMTP connection.
 */
async function verifyConnection() {
  const { user, pass } = getEmailCredentials();
  if (!user || !pass) {
    return { success: false, message: 'EMAIL_USER or EMAIL_PASS not configured in .env' };
  }
  try {
    const activeTransporter = createTransporter();
    await activeTransporter.verify();
    return { success: true, message: `SMTP connection verified successfully for ${user}` };
  } catch (err) {
    console.error('[EmailService] SMTP verification failed:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Sends a test email to verify SMTP dispatch end-to-end.
 */
async function sendTestEmail(targetEmail) {
  const { user, pass } = getEmailCredentials();
  if (!user || !pass) {
    return { success: false, error: 'EMAIL_USER or EMAIL_PASS not configured in .env' };
  }
  const recipient = (targetEmail || user).trim();
  const mailOptions = {
    from: `"Pinnacle Bay Luxury Hotel" <${user}>`,
    to: recipient,
    subject: 'Pinnacle Bay HMS - SMTP Test Verification',
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b1120; color: #e2e8f0; padding: 24px; border-radius: 8px; border: 1px solid rgba(197, 168, 128, 0.3);">
        <h2 style="color: #c5a880; margin-top: 0;">Pinnacle Bay 96 - SMTP Verification</h2>
        <p>Your Gmail SMTP integration is active and operating normally.</p>
        <p><strong>Configured Sender:</strong> ${user}</p>
        <p><strong>Status:</strong> Active &amp; Verified</p>
        <p style="color: #64748b; font-size: 12px; margin-top: 20px;">Sent from Pinnacle Bay Hotel Management System</p>
      </div>
    `
  };

  try {
    const activeTransporter = createTransporter();
    const info = await activeTransporter.sendMail(mailOptions);
    return { success: true, messageId: info.messageId, recipient };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Sends an automated, luxury-branded payment receipt email to the guest.
 * 
 * @param {Object} paymentData - Details of the settled payment / invoice.
 * @param {string} [paymentData.guest_name] - Full Name of the guest.
 * @param {string} [paymentData.guest_email] - Recipient guest email address.
 * @param {string} [paymentData.email] - Fallback guest email address.
 * @param {string} [paymentData.invoice_no] - Invoice reference number (e.g. INV-1002).
 * @param {string} [paymentData.payment_id] - Fallback payment reference ID.
 * @param {string} [paymentData.booking_id] - Associated Booking reference code (e.g. BK-1024).
 * @param {string} [paymentData.payment_method] - Method used (Cash, Card, Bank Transfer, etc.).
 * @param {number|string} [paymentData.amount_paid] - Total amount received in this payment.
 * @param {number|string} [paymentData.balance_due] - Any outstanding balance (defaults to 0).
 * @param {string} [paymentData.payment_date] - Date of payment settlement (e.g. DD/MM/YYYY).
 * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
 */
async function sendPaymentReceipt(paymentData = {}) {
  const recipient = (paymentData.guest_email || paymentData.email || '').trim();
  const invoiceRef = paymentData.invoice_no || paymentData.payment_id || paymentData.invoice_id || 'INV-PAID';
  const bookingRef = paymentData.booking_id ? String(paymentData.booking_id) : 'N/A';
  const guestName = paymentData.guest_name || paymentData.guest || 'Valued Guest';
  const paymentMethod = paymentData.payment_method || paymentData.method || 'Cash';
  const amountPaidNum = parseFloat(paymentData.amount_paid != null ? paymentData.amount_paid : paymentData.amount) || 0;
  const balanceDueNum = parseFloat(paymentData.balance_due != null ? paymentData.balance_due : 0) || 0;
  const paymentDate = paymentData.payment_date || new Date().toLocaleDateString('en-GB');

  if (!recipient) {
    console.warn(`[EmailService] Cannot send payment receipt for ${invoiceRef}: No recipient email provided.`);
    return { success: false, error: 'No recipient email provided' };
  }

  // Soft check for email credentials
  const { user, pass } = getEmailCredentials();
  if (!user || !pass) {
    console.warn(`[EmailService] EMAIL_USER or EMAIL_PASS not configured in .env. Skipping receipt dispatch for ${invoiceRef}.`);
    return { success: false, error: 'Email credentials not configured in .env' };
  }

  const amountPaidStr = formatCurrency(amountPaidNum);
  const balanceDueStr = formatCurrency(balanceDueNum);
  const isSettledInFull = balanceDueNum <= 0;
  const balanceBadgeBg = isSettledInFull ? '#10b981' : '#f59e0b';
  const balanceStatusText = isSettledInFull ? 'Fully Settled (0.00 Due)' : `${balanceDueStr} Outstanding`;

  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Receipt - Pinnacle Bay Luxury Hotel</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #0b1120;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #e2e8f0;
      line-height: 1.6;
    }
    .wrapper {
      width: 100%;
      background-color: #0b1120;
      padding: 30px 10px;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #0f172a;
      border-radius: 12px;
      overflow: hidden;
      border: 1px solid rgba(197, 168, 128, 0.25);
      box-shadow: 0 20px 40px rgba(0,0,0,0.5);
    }
    .header {
      background: linear-gradient(135deg, #070a13 0%, #1e293b 100%);
      padding: 36px 30px;
      text-align: center;
      border-bottom: 2px solid #c5a880;
    }
    .brand-title {
      margin: 0;
      font-size: 26px;
      font-weight: 800;
      letter-spacing: 2px;
      color: #c5a880;
      text-transform: uppercase;
    }
    .brand-subtitle {
      margin: 6px 0 0 0;
      font-size: 13px;
      letter-spacing: 1.5px;
      color: #94a3b8;
      text-transform: uppercase;
    }
    .content {
      padding: 32px 30px;
    }
    .greeting {
      font-size: 20px;
      font-weight: 600;
      color: #ffffff;
      margin-bottom: 10px;
    }
    .intro-text {
      font-size: 14.5px;
      color: #cbd5e1;
      margin-bottom: 24px;
    }
    .receipt-box {
      background: rgba(197, 168, 128, 0.08);
      border: 1px solid rgba(197, 168, 128, 0.3);
      border-radius: 10px;
      padding: 22px 24px;
      margin-bottom: 24px;
      text-align: center;
    }
    .receipt-title {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 2px;
      color: #94a3b8;
      margin: 0 0 4px 0;
    }
    .receipt-amount {
      font-size: 32px;
      font-weight: 800;
      color: #10b981;
      letter-spacing: 0.5px;
      margin: 6px 0 10px 0;
    }
    .receipt-badge {
      display: inline-block;
      padding: 4px 14px;
      border-radius: 20px;
      font-size: 11.5px;
      font-weight: 700;
      letter-spacing: 1px;
      text-transform: uppercase;
      color: #ffffff;
      background-color: #10b981;
    }
    .table-details {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 26px;
    }
    .table-details td {
      padding: 12px 14px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
      font-size: 14px;
    }
    .table-details tr:last-child td {
      border-bottom: none;
    }
    .label-col {
      color: #94a3b8;
      font-weight: 500;
      width: 42%;
    }
    .value-col {
      color: #f8fafc;
      font-weight: 600;
      text-align: right;
    }
    .balance-pill {
      display: inline-block;
      padding: 3px 10px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
      color: #ffffff;
      background-color: ${balanceBadgeBg};
    }
    .thank-you-box {
      background: rgba(15, 23, 42, 0.6);
      border-left: 3px solid #c5a880;
      padding: 16px 18px;
      border-radius: 0 6px 6px 0;
      font-size: 13.5px;
      color: #cbd5e1;
      margin-bottom: 24px;
    }
    .footer {
      background-color: #070a13;
      padding: 24px 30px;
      text-align: center;
      border-top: 1px solid rgba(255, 255, 255, 0.06);
      font-size: 12px;
      color: #64748b;
    }
    .footer p {
      margin: 4px 0;
    }
    .footer a {
      color: #c5a880;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <!-- Header -->
      <div class="header">
        <h1 class="brand-title">Pinnacle Bay 96</h1>
        <p class="brand-subtitle">Luxury Coastal Sanctuary • Hiriketiya, Sri Lanka</p>
      </div>

      <!-- Main Content -->
      <div class="content">
        <div class="greeting">Dear ${guestName},</div>
        <p class="intro-text">
          Thank you for your payment. Please find your official payment receipt and transaction confirmation below.
        </p>

        <!-- Receipt Highlight Box -->
        <div class="receipt-box">
          <div class="receipt-title">Amount Received</div>
          <div class="receipt-amount">${amountPaidStr}</div>
          <span class="receipt-badge">Payment Received &amp; Settled</span>
        </div>

        <!-- Transaction Details Table -->
        <table class="table-details">
          <tr>
            <td class="label-col">Guest Name</td>
            <td class="value-col">${guestName}</td>
          </tr>
          <tr>
            <td class="label-col">Invoice Reference</td>
            <td class="value-col" style="color: #c5a880; font-family: monospace; font-size: 14.5px;">#${invoiceRef}</td>
          </tr>
          ${bookingRef !== 'N/A' ? `
          <tr>
            <td class="label-col">Booking Reference</td>
            <td class="value-col" style="font-family: monospace;">${bookingRef}</td>
          </tr>` : ''}
          <tr>
            <td class="label-col">Payment Date</td>
            <td class="value-col">${paymentDate}</td>
          </tr>
          <tr>
            <td class="label-col">Payment Method</td>
            <td class="value-col">${paymentMethod}</td>
          </tr>
          <tr>
            <td class="label-col">Amount Paid</td>
            <td class="value-col" style="color: #10b981; font-weight: 700;">${amountPaidStr}</td>
          </tr>
          <tr>
            <td class="label-col">Remaining Balance</td>
            <td class="value-col">
              <span class="balance-pill">${balanceStatusText}</span>
            </td>
          </tr>
        </table>

        <!-- Thank You Note -->
        <div class="thank-you-box">
          <strong>Thank You!</strong> We sincerely appreciate your patronage and hope you enjoyed your time with us at Pinnacle Bay 96. If you have any questions regarding this receipt, please do not hesitate to contact our finance department.
        </div>
      </div>

      <!-- Footer -->
      <div class="footer">
        <p><strong>Pinnacle Bay 96 Luxury Resort & Sanctuary</strong></p>
        <p>Hiriketiya Coastal Bay, Dikwella 82400, Sri Lanka</p>
        <p>Finance: <a href="mailto:finance@pinnaclebay.com">finance@pinnaclebay.com</a> | Reception: +94 41 228 9600</p>
        <p style="margin-top: 12px; color: #475569;">© ${new Date().getFullYear()} Pinnacle Bay 96. All rights reserved.</p>
      </div>
    </div>
  </div>
</body>
</html>
  `;

  const mailOptions = {
    from: `"Pinnacle Bay Luxury Hotel" <${user}>`,
    to: recipient,
    subject: `Payment Receipt - Invoice #${paymentData.invoice_no || paymentData.payment_id || invoiceRef} [Pinnacle Bay]`,
    html: htmlContent
  };

  try {
    const activeTransporter = createTransporter();
    const info = await activeTransporter.sendMail(mailOptions);
    console.log(`✔ [EmailService] Payment receipt dispatched to ${recipient} (Invoice: #${invoiceRef}, ID: ${info.messageId})`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error(`✖ [EmailService] Delivery error sending payment receipt to ${recipient} (Invoice: #${invoiceRef}):`, err.message);
    return { success: false, error: err.message };
  }
}

module.exports = {
  transporter,
  createTransporter,
  verifyConnection,
  sendTestEmail,
  sendBookingConfirmation,
  sendPaymentReceipt
};


