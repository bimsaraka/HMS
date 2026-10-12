const express = require('express');
const router = express.Router();
const FinanceController = require('../controllers/financeController');
const AdminController = require('../controllers/adminController');

// Staff / Employee List for Finance & Payroll
router.get('/employees', FinanceController.getEmployees);
router.get('/staff', FinanceController.getEmployees);

// Active Checked-In Guests for Invoice Generation Dropdown
router.get('/active-guests', FinanceController.getActiveGuests);
router.get('/confirmed-guests', FinanceController.getActiveGuests);
router.get('/guests/active', FinanceController.getActiveGuests);
router.get('/guests/checked-in', FinanceController.getActiveGuests);


// Invoices & Folio Billing
router.get('/invoices', FinanceController.getInvoices);
router.get('/invoices/:id', FinanceController.getInvoiceById);
router.get('/summary', FinanceController.getSummary);
router.get('/finance-summary', FinanceController.getFinanceSummary);
router.get('/dashboard/summary', FinanceController.getFinanceSummary);
router.post('/invoices', FinanceController.generateInvoice);
router.post('/invoices/custom', FinanceController.generateInvoice);
router.post('/invoices/create-custom', FinanceController.generateInvoice);
router.post('/bills/generate', FinanceController.generateInvoice);
router.put('/invoices/:id/settle', FinanceController.settleInvoice);
router.post('/invoices/:id/settle', FinanceController.settleInvoice);
router.put('/invoices/:id', FinanceController.updateInvoice);
router.put('/invoices/:id/edit', FinanceController.updateInvoice);
router.delete('/invoices/:id', FinanceController.deleteInvoice);

// Room Dining Charges Sync for Guest Stay
router.get('/dining-charges/:room_number', FinanceController.getDiningLedgerForStay);

// Financial Transactions & Audit Log
router.get('/transactions', FinanceController.getTransactions);
router.post('/transactions', FinanceController.createTransaction);
router.put('/transactions/:id', FinanceController.updateTransaction);
router.put('/transactions/:id/edit', FinanceController.updateTransaction);
router.delete('/transactions/:id', FinanceController.deleteTransaction);
router.get('/reports/logs', FinanceController.getReportLogs);
router.get('/logs', FinanceController.getReportLogs);

// Staff Payroll & Disbursements
router.get('/payroll/attendance-summary', AdminController.getMonthlyAttendanceSummary);
router.get('/payroll', FinanceController.getPayroll);
router.post('/payroll', FinanceController.createPayroll);
router.delete('/payroll/:id', FinanceController.deletePayroll);

module.exports = router;

