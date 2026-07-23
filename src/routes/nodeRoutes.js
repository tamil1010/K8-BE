import express from 'express';
import { authenticateJWT, authorizeRBAC } from '../middleware/authMiddleware.js';
import {
  listNodes,
  getNode,
  getNodePods,
  getNodeYaml,
  getNodeEvents,
  describeNode,
  getNodeMetrics,
  cordonNode,
  uncordonNode,
  drainNode,
  deleteNode
} from '../controllers/nodeController.js';

const router = express.Router();

const readRoles  = ['Admin', 'Developer', 'Viewer'];
const writeRoles = ['Admin', 'Developer'];

// GET /api/nodes routes
router.get('/nodes', authenticateJWT, authorizeRBAC(readRoles), listNodes);
router.get('/nodes/:name', authenticateJWT, authorizeRBAC(readRoles), getNode);
router.get('/nodes/:name/pods', authenticateJWT, authorizeRBAC(readRoles), getNodePods);
router.get('/nodes/:name/events', authenticateJWT, authorizeRBAC(readRoles), getNodeEvents);
router.get('/nodes/:name/yaml', authenticateJWT, authorizeRBAC(readRoles), getNodeYaml);
router.get('/nodes/:name/describe', authenticateJWT, authorizeRBAC(readRoles), describeNode);
router.get('/nodes/:name/metrics', authenticateJWT, authorizeRBAC(readRoles), getNodeMetrics);

// Mutating node actions
router.put('/nodes/:name/cordon', authenticateJWT, authorizeRBAC(writeRoles), cordonNode);
router.put('/nodes/:name/uncordon', authenticateJWT, authorizeRBAC(writeRoles), uncordonNode);
router.post('/nodes/:name/drain', authenticateJWT, authorizeRBAC(writeRoles), drainNode);
router.delete('/nodes/:name', authenticateJWT, authorizeRBAC(writeRoles), deleteNode);

// Legacy node-mgmt paths
router.get('/node-mgmt/nodes', authenticateJWT, authorizeRBAC(readRoles), listNodes);
router.get('/node-mgmt/nodes/:name', authenticateJWT, authorizeRBAC(readRoles), getNode);
router.get('/node-mgmt/nodes/:name/pods', authenticateJWT, authorizeRBAC(readRoles), getNodePods);

export default router;
