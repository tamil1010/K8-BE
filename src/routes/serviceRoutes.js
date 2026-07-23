import express from 'express';
import { authenticateJWT, authorizeRBAC } from '../middleware/authMiddleware.js';
import {
  listServices,
  getServiceDetail,
  getServiceYaml,
  createService,
  updateService,
  deleteService
} from '../controllers/serviceController.js';

const router = express.Router();

const readRoles = ['Admin', 'Developer', 'Viewer'];
const writeRoles = ['Admin', 'Developer'];

// Apply JWT authentication
router.use(authenticateJWT);

// GET /api/services
router.get('/services', authorizeRBAC(readRoles), listServices);

// POST /api/services
router.post('/services', authorizeRBAC(writeRoles), createService);

// GET /api/services/:name/yaml & GET /api/services/:namespace/:name/yaml
router.get('/services/:name/yaml', authorizeRBAC(readRoles), getServiceYaml);
router.get('/services/:namespace/:name/yaml', authorizeRBAC(readRoles), getServiceYaml);

// GET /api/services/:name & GET /api/services/:namespace/:name
router.get('/services/:name', authorizeRBAC(readRoles), getServiceDetail);
router.get('/services/:namespace/:name', authorizeRBAC(readRoles), getServiceDetail);

// PUT /api/services/:name & PUT /api/services/:namespace/:name
router.put('/services/:name', authorizeRBAC(writeRoles), updateService);
router.put('/services/:namespace/:name', authorizeRBAC(writeRoles), updateService);

// DELETE /api/services/:name & DELETE /api/services/:namespace/:name
router.delete('/services/:name', authorizeRBAC(writeRoles), deleteService);
router.delete('/services/:namespace/:name', authorizeRBAC(writeRoles), deleteService);

export default router;
