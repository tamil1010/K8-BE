import express from 'express';
import { authenticateJWT, authorizeRBAC } from '../middleware/authMiddleware.js';
import {
  getOverview,
  getPods,
  restartPod,
  getDeployments,
  getNodes,
  getServices,
  getRbacRoles,
  getRbacRoleBindings,
  getRbacServiceAccounts,
  getCPUUsage,
  getMemoryUsage,
  getEvents
} from '../controllers/k8sController.js';
import {
  getClusters,
  getCurrentCluster,
  switchCluster
} from '../controllers/clusterController.js';

const router = express.Router();

// Apply JWT authentication to all cluster resource routes
router.use(authenticateJWT);

// READ permissions (allowed for Admin, Developer, and Viewer roles)
const readRoles = ['Admin', 'Developer', 'Viewer'];

router.get('/dashboard/overview', authorizeRBAC(readRoles), getOverview);
router.get('/pods', authorizeRBAC(readRoles), getPods);
router.get('/deployments', authorizeRBAC(readRoles), getDeployments);
router.get('/nodes', authorizeRBAC(readRoles), getNodes);
router.get('/services', authorizeRBAC(readRoles), getServices);

// RBAC mappings
router.get('/rbac/roles', authorizeRBAC(readRoles), getRbacRoles);
router.get('/rbac/rolebindings', authorizeRBAC(readRoles), getRbacRoleBindings);
router.get('/rbac/serviceaccounts', authorizeRBAC(readRoles), getRbacServiceAccounts);

// Metrics endpoints
router.get('/metrics/cpu', authorizeRBAC(readRoles), getCPUUsage);
router.get('/metrics/memory', authorizeRBAC(readRoles), getMemoryUsage);

// System events
router.get('/events', authorizeRBAC(readRoles), getEvents);

// Cluster switcher endpoints
router.get('/clusters', authorizeRBAC(readRoles), getClusters);
router.get('/clusters/current', authorizeRBAC(readRoles), getCurrentCluster);
router.post('/clusters/switch', authorizeRBAC(readRoles), switchCluster);

// WRITE/MODIFY permissions (allowed for Admin and Developer roles only)
router.post('/pods/:namespace/:name/restart', authorizeRBAC(['Admin', 'Developer']), restartPod);

export default router;
