import { deploymentService } from '../services/deploymentService.js';

export const listDeployments = async (req, res, next) => {
  try {
    const namespace = req.query.namespace === 'All Namespaces' ? '' : (req.query.namespace || '');
    const data = await deploymentService.getDeployments(namespace);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const getDeployment = async (req, res, next) => {
  try {
    const { namespace, name } = req.params;
    if (!namespace || !name) {
      return res.status(400).json({ success: false, message: 'Namespace and Deployment name are required.' });
    }
    const data = await deploymentService.getDeployment(namespace, name);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const createDeployment = async (req, res, next) => {
  try {
    const { namespace, body } = req.body;
    if (!namespace || !body) {
      return res.status(400).json({ success: false, message: 'Namespace and Deployment body manifest are required.' });
    }
    const data = await deploymentService.createDeployment(namespace, body);
    return res.status(201).json({ success: true, message: 'Deployment created successfully.', data });
  } catch (err) {
    next(err);
  }
};

export const scaleDeployment = async (req, res, next) => {
  try {
    const { namespace, name } = req.params;
    const { replicas } = req.body;
    if (!namespace || !name || replicas === undefined) {
      return res.status(400).json({ success: false, message: 'Namespace, Deployment name, and Replicas count are required.' });
    }
    const data = await deploymentService.scaleDeployment(namespace, name, replicas);
    return res.status(200).json({ success: true, message: `Deployment scaled to ${replicas} replicas.`, data });
  } catch (err) {
    next(err);
  }
};

export const restartDeployment = async (req, res, next) => {
  try {
    const { namespace, name } = req.params;
    if (!namespace || !name) {
      return res.status(400).json({ success: false, message: 'Namespace and Deployment name are required.' });
    }
    const data = await deploymentService.restartDeployment(namespace, name);
    return res.status(200).json({ success: true, message: 'Rolling restart triggered successfully.', data });
  } catch (err) {
    next(err);
  }
};

export const rollbackDeployment = async (req, res, next) => {
  try {
    const { namespace, name } = req.params;
    const { revision } = req.body;
    if (!namespace || !name || revision === undefined) {
      return res.status(400).json({ success: false, message: 'Namespace, Deployment name, and Revision number are required.' });
    }
    const data = await deploymentService.rollbackDeployment(namespace, name, revision);
    return res.status(200).json({ success: true, message: `Deployment rolled back to revision ${revision}.`, data });
  } catch (err) {
    next(err);
  }
};

export const getDeploymentHistory = async (req, res, next) => {
  try {
    const { namespace, name } = req.params;
    if (!namespace || !name) {
      return res.status(400).json({ success: false, message: 'Namespace and Deployment name are required.' });
    }
    const data = await deploymentService.getDeploymentHistory(namespace, name);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const getDeploymentLogs = async (req, res, next) => {
  try {
    const { namespace, name } = req.params;
    if (!namespace || !name) {
      return res.status(400).json({ success: false, message: 'Namespace and Deployment name are required.' });
    }
    const logs = await deploymentService.getDeploymentLogs(namespace, name);
    return res.status(200).json({ success: true, data: { logs } });
  } catch (err) {
    next(err);
  }
};

export const getDeploymentYaml = async (req, res, next) => {
  try {
    const { namespace, name } = req.params;
    if (!namespace || !name) {
      return res.status(400).json({ success: false, message: 'Namespace and Deployment name are required.' });
    }
    const data = await deploymentService.getDeploymentYaml(namespace, name);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const deleteDeployment = async (req, res, next) => {
  try {
    const { namespace, name } = req.params;
    if (!namespace || !name) {
      return res.status(400).json({ success: false, message: 'Namespace and Deployment name are required.' });
    }
    await deploymentService.deleteDeployment(namespace, name);
    return res.status(200).json({ success: true, message: `Deployment "${name}" deleted successfully.` });
  } catch (err) {
    next(err);
  }
};
