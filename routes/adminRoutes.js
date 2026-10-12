const express = require('express');
const router = express.Router();
const AdminController = require('../controllers/adminController');

// Staff & User CRUD
router.get('/staff', AdminController.getStaff);
router.post('/staff', AdminController.createStaff);
router.put('/staff/:id', AdminController.updateStaff);
router.delete('/staff/:id', AdminController.deleteStaff);
router.get('/users', AdminController.getUsers);
router.post('/users', AdminController.createStaff);
router.put('/users/:id', AdminController.updateStaff);
router.delete('/users/:id', AdminController.deleteStaff);

// Attendance Tracking
router.get('/attendance', AdminController.getAttendance);
router.get('/attendance/monthly-summary', AdminController.getMonthlyAttendanceSummary);
router.post('/attendance', AdminController.recordAttendance);
router.put('/attendance/clock-out/:id', AdminController.clockOutAttendance);
router.put('/attendance/:id', AdminController.updateAttendance);
router.delete('/attendance/:id', AdminController.deleteAttendance);

// System Reports & Analytics
router.get('/reports/summary', AdminController.getReportsSummary);
router.get('/reports/details', AdminController.getReportsDetails);
router.get('/reports/reservations', AdminController.getReservationLogs);
router.get('/reports/housekeeping', AdminController.getHousekeepingLogs);
router.get('/reports/payroll', AdminController.getPayrollLogs);
router.get('/reports/shift-audit', AdminController.getShiftAuditReport);
router.get('/shift-audit', AdminController.getShiftAuditReport);
router.get('/reports/reservations/audit', AdminController.getShiftAuditReport);
router.get('/reports/logs', AdminController.getReportLogs);
router.get('/logs', AdminController.getReportLogs);

// Overview Metrics & Audit Logs
router.get('/metrics', AdminController.getMetrics);
router.get('/audit-logs', AdminController.getAuditLogs);

module.exports = router;
