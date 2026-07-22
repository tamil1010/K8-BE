import express from 'express';
import { authenticateJWT, authorizeRBAC } from '../middleware/authMiddleware.js';
import {
  listDeployments,
  getDeployment,
  createDeployment,
  scaleDeployment,
  restartDeployment,
  rollbackDeployment,
  getDeploymentHistory,
  getDeploymentLogs,
  getDeploymentYaml,
  deleteDeployment
} from '../controllers/deploymentController.js';

const router = express.Router();

const readRoles = ['Admin', 'Developer', 'Viewer'];
const writeRoles = ['Admin', 'Developer'];

// GET /api/deployment-mgmt/deployments
router.get('/deployment-mgmt/deployments', authenticateJWT, authorizeRBAC(readRoles), listDeployments);

// POST /api/deployment-mgmt/deployments
router.post('/deployment-mgmt/deployments', authenticateJWT, authorizeRBAC(writeRoles), createDeployment);

// GET /api/deployment-mgmt/:namespace/:name
router.get('/deployment-mgmt/:namespace/:name', authenticateJWT, authorizeRBAC(readRoles), getDeployment);

// PATCH /api/deployment-mgmt/:namespace/:name/scale
router.patch('/deployment-mgmt/:namespace/:name/scale', authenticateJWT, authorizeRBAC(writeRoles), scaleDeployment);

// POST /api/deployment-mgmt/:namespace/:name/restart
router.post('/api/deployment-mgmt/:namespace/:name/restart', (req, res, next) => {
  // Wait, standardizing route mounts - wait, in server.js, app.use('/api', deploymentRoutes) is used, 
  // so this route should start with /deployment-mgmt... Let's fix that.
  next();
});

router.post('/deployment-mgmt/:namespace/:name/restart', authenticateJWT, authorizeRBAC(writeRoles), restartDeployment);

// POST /api/deployment-mgmt/:namespace/:name/rollback
router.post('/deployment-mgmt/:namespace/:name/rollback', authenticateJWT, authorizeRBAC(writeRoles), rollbackDeployment);

// GET /api/deployment-mgmt/:namespace/:name/history
router.get('/deployment-mgmt/:namespace/:name/history', authenticateJWT, authorizeRBAC(readRoles), getDeploymentHistory);

// GET /api/deployment-mgmt/:namespace/:name/logs
router.get('/deployment-mgmt/:namespace/:name/logs', authenticateJWT, authorizeRBAC(readRoles), getDeploymentLogs);

// GET /api/deployment-mgmt/:namespace/:name/yaml
router.get('/deployment-mgmt/:namespace/:name/yaml', authenticateJWT, authorizeRBAC(readRoles), getDeploymentYaml);

// DELETE /api/deployment-mgmt/:namespace/:name
router.delete('/deployment-mgmt/:namespace/:name', authenticateJWT, authorizeRBAC(writeRoles), deleteDeployment);

export default router;
