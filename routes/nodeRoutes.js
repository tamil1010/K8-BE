import express from 'express';
import { authenticateJWT, authorizeRBAC } from '../middleware/authMiddleware.js';
import {
  listNodes,
  getNode,
  getNodePods,
  getNodeYaml,
  getNodeEvents,
  describeNode,
  getNodeMetrics
} from '../controllers/nodeController.js';

const router = express.Router();

const readRoles = ['Admin', 'Developer', 'Viewer'];

// GET /api/node-mgmt/nodes
router.get('/node-mgmt/nodes', authenticateJWT, authorizeRBAC(readRoles), listNodes);

// GET /api/node-mgmt/nodes/:name
router.get('/node-mgmt/nodes/:name', authenticateJWT, authorizeRBAC(readRoles), getNode);

// GET /api/node-mgmt/nodes/:name/pods
router.get('/node-mgmt/nodes/:name/pods', authenticateJWT, authorizeRBAC(readRoles), getNodePods);

// GET /api/nodes/:name routes
router.get('/nodes/:name', authenticateJWT, authorizeRBAC(readRoles), getNode);
router.get('/nodes/:name/yaml', authenticateJWT, authorizeRBAC(readRoles), getNodeYaml);
router.get('/nodes/:name/events', authenticateJWT, authorizeRBAC(readRoles), getNodeEvents);
router.get('/nodes/:name/describe', authenticateJWT, authorizeRBAC(readRoles), describeNode);
router.get('/nodes/:name/metrics', authenticateJWT, authorizeRBAC(readRoles), getNodeMetrics);

export default router;
