import { k8sService } from '../services/k8sService.js';

// ==========================================
// ROLES CONTROLLERS
// ==========================================

export const getRoles = async (req, res, next) => {
  try {
    const namespace = req.query.namespace === 'All Namespaces' ? '' : (req.query.namespace || '');
    const data = await k8sService.getRoles(namespace);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const getRoleDetail = async (req, res, next) => {
  try {
    const { name, namespace: paramNs } = req.params;
    const namespace = paramNs || req.query.namespace || '';
    const data = await k8sService.getRoleDetail(namespace, name);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const getRoleYaml = async (req, res, next) => {
  try {
    const { name, namespace: paramNs } = req.params;
    const namespace = paramNs || req.query.namespace || '';
    const data = await k8sService.getRoleYaml(namespace, name);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const createRole = async (req, res, next) => {
  try {
    const { namespace, body: roleBody, ...directFields } = req.body;
    const targetNs = namespace || directFields.namespace || roleBody?.metadata?.namespace || 'default';
    const payload = roleBody || directFields;

    if (!payload.name && !payload.metadata?.name) {
      return res.status(400).json({ success: false, message: 'Role name is required.' });
    }

    const data = await k8sService.createRole(targetNs, payload);
    return res.status(201).json({ success: true, message: 'Role created successfully.', data });
  } catch (err) {
    next(err);
  }
};

export const updateRole = async (req, res, next) => {
  try {
    const { name, namespace: paramNs } = req.params;
    const namespace = paramNs || req.query.namespace || req.body.namespace || '';
    const data = await k8sService.updateRole(namespace, name, req.body);
    return res.status(200).json({ success: true, message: `Role "${name}" updated successfully.`, data });
  } catch (err) {
    next(err);
  }
};

export const deleteRole = async (req, res, next) => {
  try {
    const { name, namespace: paramNs } = req.params;
    const namespace = paramNs || req.query.namespace || '';
    await k8sService.deleteRole(namespace, name);
    return res.status(200).json({ success: true, message: `Role "${name}" deleted successfully.` });
  } catch (err) {
    next(err);
  }
};

// ==========================================
// ROLE BINDINGS CONTROLLERS
// ==========================================

export const getRoleBindings = async (req, res, next) => {
  try {
    const namespace = req.query.namespace === 'All Namespaces' ? '' : (req.query.namespace || '');
    const data = await k8sService.getRoleBindings(namespace);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const getRoleBindingDetail = async (req, res, next) => {
  try {
    const { name, namespace: paramNs } = req.params;
    const namespace = paramNs || req.query.namespace || '';
    const data = await k8sService.getRoleBindingDetail(namespace, name);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const getRoleBindingYaml = async (req, res, next) => {
  try {
    const { name, namespace: paramNs } = req.params;
    const namespace = paramNs || req.query.namespace || '';
    const data = await k8sService.getRoleBindingYaml(namespace, name);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const createRoleBinding = async (req, res, next) => {
  try {
    const { namespace, body: bindingBody, ...directFields } = req.body;
    const targetNs = namespace || directFields.namespace || bindingBody?.metadata?.namespace || 'default';
    const payload = bindingBody || directFields;

    if (!payload.name && !payload.metadata?.name) {
      return res.status(400).json({ success: false, message: 'RoleBinding name is required.' });
    }

    const data = await k8sService.createRoleBinding(targetNs, payload);
    return res.status(201).json({ success: true, message: 'RoleBinding created successfully.', data });
  } catch (err) {
    next(err);
  }
};

export const updateRoleBinding = async (req, res, next) => {
  try {
    const { name, namespace: paramNs } = req.params;
    const namespace = paramNs || req.query.namespace || req.body.namespace || '';
    const data = await k8sService.updateRoleBinding(namespace, name, req.body);
    return res.status(200).json({ success: true, message: `RoleBinding "${name}" updated successfully.`, data });
  } catch (err) {
    next(err);
  }
};

export const deleteRoleBinding = async (req, res, next) => {
  try {
    const { name, namespace: paramNs } = req.params;
    const namespace = paramNs || req.query.namespace || '';
    await k8sService.deleteRoleBinding(namespace, name);
    return res.status(200).json({ success: true, message: `RoleBinding "${name}" deleted successfully.` });
  } catch (err) {
    next(err);
  }
};

// ==========================================
// SERVICE ACCOUNTS CONTROLLERS
// ==========================================

export const getServiceAccounts = async (req, res, next) => {
  try {
    const namespace = req.query.namespace === 'All Namespaces' ? '' : (req.query.namespace || '');
    const data = await k8sService.getServiceAccounts(namespace);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const getServiceAccountDetail = async (req, res, next) => {
  try {
    const { name, namespace: paramNs } = req.params;
    const namespace = paramNs || req.query.namespace || 'default';
    const data = await k8sService.getServiceAccountDetail(namespace, name);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const getServiceAccountYaml = async (req, res, next) => {
  try {
    const { name, namespace: paramNs } = req.params;
    const namespace = paramNs || req.query.namespace || 'default';
    const data = await k8sService.getServiceAccountYaml(namespace, name);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const createServiceAccount = async (req, res, next) => {
  try {
    const { namespace, body: saBody, ...directFields } = req.body;
    const targetNs = namespace || directFields.namespace || saBody?.metadata?.namespace || 'default';
    const payload = saBody || directFields;

    if (!payload.name && !payload.metadata?.name) {
      return res.status(400).json({ success: false, message: 'ServiceAccount name is required.' });
    }

    const data = await k8sService.createServiceAccount(targetNs, payload);
    return res.status(201).json({ success: true, message: 'ServiceAccount created successfully.', data });
  } catch (err) {
    next(err);
  }
};

export const updateServiceAccount = async (req, res, next) => {
  try {
    const { name, namespace: paramNs } = req.params;
    const namespace = paramNs || req.query.namespace || req.body.namespace || 'default';
    const data = await k8sService.updateServiceAccount(namespace, name, req.body);
    return res.status(200).json({ success: true, message: `ServiceAccount "${name}" updated successfully.`, data });
  } catch (err) {
    next(err);
  }
};

export const deleteServiceAccount = async (req, res, next) => {
  try {
    const { name, namespace: paramNs } = req.params;
    const namespace = paramNs || req.query.namespace || 'default';
    await k8sService.deleteServiceAccount(namespace, name);
    return res.status(200).json({ success: true, message: `ServiceAccount "${name}" deleted successfully.` });
  } catch (err) {
    next(err);
  }
};
