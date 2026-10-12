const express = require('express');
const router = express.Router();
const ReceptionController = require('../controllers/receptionController');

// ====================================================================
// 1. RESERVATIONS & BOOKINGS CRUD
// ====================================================================
router.get('/bookings', ReceptionController.getBookings);
router.post('/bookings', ReceptionController.createBooking);
router.post('/reservations', ReceptionController.createBooking);
router.put('/bookings/:id', ReceptionController.updateBooking);
router.post('/bookings/:id', ReceptionController.updateBooking);
router.delete('/bookings/:id', ReceptionController.deleteBooking);

// Booking Status Lifecycle Transitions
router.put('/bookings/:id/checkin', ReceptionController.checkIn);
router.post('/bookings/:id/checkin', ReceptionController.checkIn);
router.put('/bookings/:id/checkout', ReceptionController.checkOut);
router.post('/bookings/:id/checkout', ReceptionController.checkOut);
router.put('/bookings/:id/cancel', ReceptionController.cancelBooking);
router.post('/bookings/:id/cancel', ReceptionController.cancelBooking);

// ====================================================================
// 2. ROOM INVENTORY, STATUS & ALLOCATION
// ====================================================================
router.get('/rooms', ReceptionController.getRooms);
router.get('/rooms/grid', ReceptionController.getRooms);
router.get('/rooms/available', ReceptionController.getAvailableRooms);
router.post('/assign-room', ReceptionController.assignRoom);
router.put('/assign-room', ReceptionController.assignRoom);
router.post('/allocate-room', ReceptionController.assignRoom);
router.put('/allocate-room', ReceptionController.assignRoom);

// ====================================================================
// 3. GUEST COMPLAINTS & FEEDBACK CRUD
// ====================================================================
router.get('/complaints', ReceptionController.getComplaints);
router.post('/complaints', ReceptionController.createComplaint);
router.put('/complaints/:id/status', ReceptionController.updateComplaint);
router.put('/complaints/:id', ReceptionController.updateComplaint);
router.post('/complaints/:id', ReceptionController.updateComplaint);
router.delete('/complaints/:id', ReceptionController.deleteComplaint);

// ====================================================================
// 4. GUEST SPECIAL REQUESTS CRUD
// ====================================================================
router.get('/requests', ReceptionController.getRequests);
router.get('/special-requests', ReceptionController.getRequests);
router.post('/requests', ReceptionController.createRequest);
router.post('/special-requests', ReceptionController.createRequest);
router.put('/special-requests/:id/status', ReceptionController.updateRequestStatus);
router.put('/requests/:id/status', ReceptionController.updateRequestStatus);
router.put('/special-requests/:id', ReceptionController.updateRequest);
router.put('/requests/:id', ReceptionController.updateRequest);
router.post('/special-requests/:id', ReceptionController.updateRequest);
router.delete('/special-requests/:id', ReceptionController.deleteRequest);
router.delete('/requests/:id', ReceptionController.deleteRequest);

// ====================================================================
// 5. DASHBOARD COUNTERS & SHIFT AUDIT REPORTS
// ====================================================================
router.get('/dashboard-counters', ReceptionController.getDashboardCounters);
router.get('/reports/summary', ReceptionController.getReportsSummary);
router.get('/reports/shift-audit', ReceptionController.getShiftAuditReport);
router.get('/shift-audit', ReceptionController.getShiftAuditReport);
router.get('/reports/reservations/audit', ReceptionController.getShiftAuditReport);

module.exports = router;
