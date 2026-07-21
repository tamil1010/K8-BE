import express from 'express';
import { authenticateJWT, authorizeRBAC } from '../middleware/authMiddleware.js';
import {
  listPods,
  listNamespaces,
  getPodDetails,
  getPodLogs,
  describePod,
  deletePod,
  restartPod,
  getPodMetrics
} from '../controllers/podController.js';

const router = express.Router();

// Role definitions
const readRoles  = ['Admin', 'Developer', 'Viewer'];
const writeRoles = ['Admin', 'Developer'];

// ─────────────────────────────────────────────────────────────────────────────
// All pod-management routes are mounted under /pod-mgmt to avoid conflicting
// with the existing k8sRoutes which already registers GET /pods.
// The frontend podApi.js calls /pod-mgmt/* for all pod-specific operations.
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/pod-mgmt/pods                        — list all pods (optional ?namespace=)
router.get('/pod-mgmt/pods',              authenticateJWT, authorizeRBAC(readRoles), listPods);

// GET /api/pod-mgmt/namespaces                  — list all cluster namespaces
router.get('/pod-mgmt/namespaces',        authenticateJWT, authorizeRBAC(readRoles), listNamespaces);

// GET /api/pod-mgmt/metrics                     — pod-level metrics from Metrics Server
router.get('/pod-mgmt/metrics',           authenticateJWT, authorizeRBAC(readRoles), getPodMetrics);

// GET /api/pod-mgmt/:namespace/:name/details    — full pod detail object
router.get('/pod-mgmt/:namespace/:name/details',  authenticateJWT, authorizeRBAC(readRoles), getPodDetails);

// GET /api/pod-mgmt/:namespace/:name/logs       — kubectl logs equivalent
router.get('/pod-mgmt/:namespace/:name/logs',     authenticateJWT, authorizeRBAC(readRoles), getPodLogs);

// GET /api/pod-mgmt/:namespace/:name/describe   — kubectl describe equivalent
router.get('/pod-mgmt/:namespace/:name/describe', authenticateJWT, authorizeRBAC(readRoles), describePod);

// DELETE /api/pod-mgmt/:namespace/:name         — delete pod
router.delete('/pod-mgmt/:namespace/:name',          authenticateJWT, authorizeRBAC(writeRoles), deletePod);

// POST /api/pod-mgmt/:namespace/:name/restart   — restart pod (controller-owned only)
router.post('/pod-mgmt/:namespace/:name/restart',    authenticateJWT, authorizeRBAC(writeRoles), restartPod);

export default router;

