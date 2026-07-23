import express from 'express';
import { authenticateJWT, authorizeRBAC } from '../middleware/authMiddleware.js';
import {
  getRoles,
  getRoleDetail,
  getRoleYaml,
  createRole,
  updateRole,
  deleteRole,
  getRoleBindings,
  getRoleBindingDetail,
  getRoleBindingYaml,
  createRoleBinding,
  updateRoleBinding,
  deleteRoleBinding,
  getServiceAccounts,
  getServiceAccountDetail,
  getServiceAccountYaml,
  createServiceAccount,
  updateServiceAccount,
  deleteServiceAccount
} from '../controllers/rbacController.js';

const router = express.Router();

const readRoles = ['Admin', 'Developer', 'Viewer'];
const writeRoles = ['Admin', 'Developer'];

router.use(authenticateJWT);

// ==========================================
// ROLES ROUTES
// ==========================================
router.get('/rbac/roles', authorizeRBAC(readRoles), getRoles);
router.post('/rbac/roles', authorizeRBAC(writeRoles), createRole);

router.get('/rbac/roles/:name/yaml', authorizeRBAC(readRoles), getRoleYaml);
router.get('/rbac/roles/:namespace/:name/yaml', authorizeRBAC(readRoles), getRoleYaml);

router.get('/rbac/roles/:name', authorizeRBAC(readRoles), getRoleDetail);
router.get('/rbac/roles/:namespace/:name', authorizeRBAC(readRoles), getRoleDetail);

router.put('/rbac/roles/:name', authorizeRBAC(writeRoles), updateRole);
router.put('/rbac/roles/:namespace/:name', authorizeRBAC(writeRoles), updateRole);

router.delete('/rbac/roles/:name', authorizeRBAC(writeRoles), deleteRole);
router.delete('/rbac/roles/:namespace/:name', authorizeRBAC(writeRoles), deleteRole);

// ==========================================
// ROLE BINDINGS ROUTES
// ==========================================
router.get('/rbac/rolebindings', authorizeRBAC(readRoles), getRoleBindings);
router.post('/rbac/rolebindings', authorizeRBAC(writeRoles), createRoleBinding);

router.get('/rbac/rolebindings/:name/yaml', authorizeRBAC(readRoles), getRoleBindingYaml);
router.get('/rbac/rolebindings/:namespace/:name/yaml', authorizeRBAC(readRoles), getRoleBindingYaml);

router.get('/rbac/rolebindings/:name', authorizeRBAC(readRoles), getRoleBindingDetail);
router.get('/rbac/rolebindings/:namespace/:name', authorizeRBAC(readRoles), getRoleBindingDetail);

router.put('/rbac/rolebindings/:name', authorizeRBAC(writeRoles), updateRoleBinding);
router.put('/rbac/rolebindings/:namespace/:name', authorizeRBAC(writeRoles), updateRoleBinding);

router.delete('/rbac/rolebindings/:name', authorizeRBAC(writeRoles), deleteRoleBinding);
router.delete('/rbac/rolebindings/:namespace/:name', authorizeRBAC(writeRoles), deleteRoleBinding);

// ==========================================
// SERVICE ACCOUNTS ROUTES
// ==========================================
router.get('/rbac/serviceaccounts', authorizeRBAC(readRoles), getServiceAccounts);
router.post('/rbac/serviceaccounts', authorizeRBAC(writeRoles), createServiceAccount);

router.get('/rbac/serviceaccounts/:name/yaml', authorizeRBAC(readRoles), getServiceAccountYaml);
router.get('/rbac/serviceaccounts/:namespace/:name/yaml', authorizeRBAC(readRoles), getServiceAccountYaml);

router.get('/rbac/serviceaccounts/:name', authorizeRBAC(readRoles), getServiceAccountDetail);
router.get('/rbac/serviceaccounts/:namespace/:name', authorizeRBAC(readRoles), getServiceAccountDetail);

router.put('/rbac/serviceaccounts/:name', authorizeRBAC(writeRoles), updateServiceAccount);
router.put('/rbac/serviceaccounts/:namespace/:name', authorizeRBAC(writeRoles), updateServiceAccount);

router.delete('/rbac/serviceaccounts/:name', authorizeRBAC(writeRoles), deleteServiceAccount);
router.delete('/rbac/serviceaccounts/:namespace/:name', authorizeRBAC(writeRoles), deleteServiceAccount);

export default router;
