const express = require('express');
const router = express.Router();
const OpsController = require('../controllers/opsController');

// ====================================================================
// 1. ROOM INVENTORY & STATUS MANAGEMENT
// ====================================================================
router.get('/rooms', OpsController.getHousekeepingRooms);
router.post('/rooms', OpsController.createRoom);
router.put('/rooms/:roomNo', OpsController.updateRoom);
router.put('/rooms/:roomNo/status', OpsController.updateRoomStatus);
router.put('/rooms/:roomNo/photo', OpsController.updateRoomPhoto);
router.delete('/rooms/:roomNo', OpsController.deleteRoom);

// ====================================================================
// 2. HOUSEKEEPING & CLEANING GRID
// ====================================================================
router.get('/housekeeping', OpsController.getHousekeepingRooms);
router.put('/housekeeping/:room_number', OpsController.updateHousekeeping);

// ====================================================================
// 3. HOUSEKEEPING SETUP PACKAGES
// ====================================================================
router.get('/packages', OpsController.getHousekeepingPackages);
router.get('/housekeeping/packages', OpsController.getHousekeepingPackages);
router.post('/packages', OpsController.createHousekeepingPackage);
router.post('/housekeeping/packages', OpsController.createHousekeepingPackage);
router.put('/packages/:id', OpsController.updateHousekeepingPackage);
router.put('/housekeeping/packages/:id', OpsController.updateHousekeepingPackage);
router.delete('/packages/:id', OpsController.deleteHousekeepingPackage);
router.delete('/housekeeping/packages/:id', OpsController.deleteHousekeepingPackage);

// ====================================================================
// 4. HOUSEKEEPING ASSIGNMENTS (RoomPackageAssignments)
// ====================================================================
router.get('/assignments', OpsController.getHousekeepingAssignments);
router.get('/housekeeping/assignments', OpsController.getHousekeepingAssignments);
router.post('/assignments', OpsController.createHousekeepingAssignment);
router.post('/housekeeping/assignments', OpsController.createHousekeepingAssignment);
router.put('/assignments/:id', OpsController.updateHousekeepingAssignment);
router.put('/housekeeping/assignments/:id', OpsController.updateHousekeepingAssignment);
router.delete('/assignments/:id', OpsController.deleteHousekeepingAssignment);
router.delete('/housekeeping/assignments/:id', OpsController.deleteHousekeepingAssignment);

// ====================================================================
// 5. OPERATIONS & HOUSEKEEPING REQUESTS & LIVE SUMMARY
// ====================================================================
router.get('/requests', OpsController.getOpsRequests);
router.get('/housekeeping/requests', OpsController.getOpsRequests);
router.put('/requests/:id/complete', OpsController.completeRequest);
router.put('/housekeeping/requests/:id/complete', OpsController.completeRequest);
router.get('/summary', OpsController.getOpsSummary);

// ====================================================================
// 6. MAINTENANCE TASKS CRUD
// ====================================================================
router.get('/maintenance', OpsController.getMaintenanceTasks);
router.post('/maintenance', OpsController.createMaintenanceTask);
router.put('/maintenance/:id', OpsController.updateMaintenanceTask);
router.put('/maintenance/:id/edit', OpsController.updateMaintenanceTask);
router.delete('/maintenance/:id', OpsController.deleteMaintenanceTask);

// ====================================================================
// 7. IN-ROOM DINING & KITCHEN ORDERS (RoomServiceOrders)
// ====================================================================
router.get('/dining/orders', OpsController.getDiningOrders);
router.post('/dining/orders', OpsController.createDiningOrder);
router.get('/orders/room-service', OpsController.getDiningOrders);
router.post('/orders/room-service', OpsController.createDiningOrder);
router.put('/dining/orders/:id/status', OpsController.updateDiningOrderStatus);
router.put('/orders/room-service/:id/status', OpsController.updateDiningOrderStatus);

// ====================================================================
// 8. KITCHEN MENU MASTER CRUD
// ====================================================================
router.get('/menu', OpsController.getMenuItems);
router.post('/menu', OpsController.createMenuItem);
router.put('/menu/:id', OpsController.updateMenuItem);
router.put('/menu/:id/toggle', OpsController.toggleMenuItem);
router.delete('/menu/:id', OpsController.deleteMenuItem);

router.get('/meal-pax', OpsController.getMealPaxCount);
router.get('/kitchen/headcount', OpsController.getMealPaxCount);

module.exports = router;
