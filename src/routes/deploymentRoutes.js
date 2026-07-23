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
  deleteDeployment,
  getDeploymentEvents,
  getDeploymentPodsList,
  getDeploymentReplicaSetsList,
  describeDeploymentDetail
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

// Enterprise endpoints requested: GET/POST /api/deployments/:name/...
router.get('/deployments', authenticateJWT, authorizeRBAC(readRoles), listDeployments);
router.get('/deployments/:name', authenticateJWT, authorizeRBAC(readRoles), getDeployment);
router.get('/deployments/:name/yaml', authenticateJWT, authorizeRBAC(readRoles), getDeploymentYaml);
router.get('/deployments/:name/events', authenticateJWT, authorizeRBAC(readRoles), getDeploymentEvents);
router.get('/deployments/:name/describe', authenticateJWT, authorizeRBAC(readRoles), describeDeploymentDetail);
router.get('/deployments/:name/pods', authenticateJWT, authorizeRBAC(readRoles), getDeploymentPodsList);
router.get('/deployments/:name/replicasets', authenticateJWT, authorizeRBAC(readRoles), getDeploymentReplicaSetsList);
router.get('/deployments/:name/history', authenticateJWT, authorizeRBAC(readRoles), getDeploymentHistory);
router.post('/deployments/:name/restart', authenticateJWT, authorizeRBAC(writeRoles), restartDeployment);
router.post('/deployments/:name/rollback', authenticateJWT, authorizeRBAC(writeRoles), rollbackDeployment);
router.post('/deployments/:name/scale', authenticateJWT, authorizeRBAC(writeRoles), scaleDeployment);

export default router;
