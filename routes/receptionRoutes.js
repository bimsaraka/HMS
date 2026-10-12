const express = require('express');
const router = express.Router();
const ReceptionController = require('../controllers/receptionController');
const { verifyToken, authorizeRoles } = require('../middleware/authMiddleware');

const receptionAuth = [verifyToken, authorizeRoles('admin', 'receptionist')];

// ====================================================================
// 1. RESERVATIONS & BOOKINGS CRUD
// ====================================================================
router.get('/bookings', ...receptionAuth, ReceptionController.getBookings);
router.post('/bookings', ReceptionController.createBooking);
router.post('/reservations', ReceptionController.createBooking);

// Booking Updates & Modifications
router.put('/bookings/:id', ...receptionAuth, ReceptionController.updateBooking);
router.post('/bookings/:id', ...receptionAuth, ReceptionController.updateBooking);
router.delete('/bookings/:id', ...receptionAuth, ReceptionController.deleteBooking);

// Booking Status Lifecycle Transitions
router.put('/bookings/:id/checkin', ...receptionAuth, ReceptionController.checkIn);
router.post('/bookings/:id/checkin', ...receptionAuth, ReceptionController.checkIn);
router.put('/bookings/:id/checkout', ...receptionAuth, ReceptionController.checkOut);
router.post('/bookings/:id/checkout', ...receptionAuth, ReceptionController.checkOut);
router.put('/bookings/:id/cancel', ...receptionAuth, ReceptionController.cancelBooking);
router.post('/bookings/:id/cancel', ...receptionAuth, ReceptionController.cancelBooking);

// ====================================================================
// 2. ROOM INVENTORY, STATUS & ALLOCATION (Public Room List open)
// ====================================================================
router.get('/rooms', ReceptionController.getRooms);
router.get('/rooms/grid', ReceptionController.getRooms);
router.get('/rooms/available', ReceptionController.getAvailableRooms);
router.post('/assign-room', ...receptionAuth, ReceptionController.assignRoom);
router.put('/assign-room', ...receptionAuth, ReceptionController.assignRoom);
router.post('/allocate-room', ...receptionAuth, ReceptionController.assignRoom);
router.put('/allocate-room', ...receptionAuth, ReceptionController.assignRoom);

// ====================================================================
// 3. GUEST COMPLAINTS & FEEDBACK CRUD
// ====================================================================
router.get('/complaints', ...receptionAuth, ReceptionController.getComplaints);
router.post('/complaints', ReceptionController.createComplaint);
router.put('/complaints/:id/status', ...receptionAuth, ReceptionController.updateComplaint);
router.put('/complaints/:id', ...receptionAuth, ReceptionController.updateComplaint);
router.post('/complaints/:id', ...receptionAuth, ReceptionController.updateComplaint);
router.delete('/complaints/:id', ...receptionAuth, ReceptionController.deleteComplaint);

// ====================================================================
// 4. GUEST SPECIAL REQUESTS CRUD
// ====================================================================
router.get('/requests', ...receptionAuth, ReceptionController.getRequests);
router.get('/special-requests', ...receptionAuth, ReceptionController.getRequests);
router.post('/requests', ReceptionController.createRequest);
router.post('/special-requests', ReceptionController.createRequest);
router.put('/special-requests/:id/status', ...receptionAuth, ReceptionController.updateRequestStatus);
router.put('/requests/:id/status', ...receptionAuth, ReceptionController.updateRequestStatus);
router.put('/special-requests/:id', ...receptionAuth, ReceptionController.updateRequest);
router.put('/requests/:id', ...receptionAuth, ReceptionController.updateRequest);
router.post('/special-requests/:id', ...receptionAuth, ReceptionController.updateRequest);
router.delete('/special-requests/:id', ...receptionAuth, ReceptionController.deleteRequest);
router.delete('/requests/:id', ...receptionAuth, ReceptionController.deleteRequest);

// ====================================================================
// 5. DASHBOARD COUNTERS & SHIFT AUDIT REPORTS
// ====================================================================
router.get('/dashboard-counters', ...receptionAuth, ReceptionController.getDashboardCounters);
router.get('/reports/summary', ...receptionAuth, ReceptionController.getReportsSummary);
router.get('/reports/shift-audit', ...receptionAuth, ReceptionController.getShiftAuditReport);
router.get('/shift-audit', ...receptionAuth, ReceptionController.getShiftAuditReport);
router.get('/reports/reservations/audit', ...receptionAuth, ReceptionController.getShiftAuditReport);

module.exports = router;
