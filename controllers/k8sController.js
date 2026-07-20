import { k8sService } from '../services/k8sService.js';

export const getOverview = async (req, res, next) => {
  try {
    const data = await k8sService.getOverview();
    return res.status(200).json({
      success: true,
      data
    });
  } catch (err) {
    next(err);
  }
};

export const getPods = async (req, res, next) => {
  try {
    const namespace = req.query.namespace === 'All Namespaces' ? '' : (req.query.namespace || '');
    const data = await k8sService.getPods(namespace);
    return res.status(200).json({
      success: true,
      data
    });
  } catch (err) {
    next(err);
  }
};

export const restartPod = async (req, res, next) => {
  try {
    const { namespace, name } = req.params;
    if (!namespace || !name) {
      return res.status(400).json({
        success: false,
        message: 'Namespace and pod name parameters are required.'
      });
    }

    await k8sService.restartPod(namespace, name);
    return res.status(200).json({
      success: true,
      message: `Pod "${name}" in namespace "${namespace}" was restarted successfully.`
    });
  } catch (err) {
    next(err);
  }
};

export const getDeployments = async (req, res, next) => {
  try {
    const namespace = req.query.namespace === 'All Namespaces' ? '' : (req.query.namespace || '');
    const data = await k8sService.getDeployments(namespace);
    return res.status(200).json({
      success: true,
      data
    });
  } catch (err) {
    next(err);
  }
};

export const getNodes = async (req, res, next) => {
  try {
    const data = await k8sService.getNodes();
    return res.status(200).json({
      success: true,
      data
    });
  } catch (err) {
    next(err);
  }
};

export const getServices = async (req, res, next) => {
  try {
    const namespace = req.query.namespace === 'All Namespaces' ? '' : (req.query.namespace || '');
    const data = await k8sService.getServices(namespace);
    return res.status(200).json({
      success: true,
      data
    });
  } catch (err) {
    next(err);
  }
};

export const getRbacRoles = async (req, res, next) => {
  try {
    const data = await k8sService.getRoles();
    return res.status(200).json({
      success: true,
      data
    });
  } catch (err) {
    next(err);
  }
};

export const getRbacRoleBindings = async (req, res, next) => {
  try {
    const data = await k8sService.getRoleBindings();
    return res.status(200).json({
      success: true,
      data
    });
  } catch (err) {
    next(err);
  }
};

export const getRbacServiceAccounts = async (req, res, next) => {
  try {
    const data = await k8sService.getServiceAccounts();
    return res.status(200).json({
      success: true,
      data
    });
  } catch (err) {
    next(err);
  }
};

export const getCPUUsage = async (req, res, next) => {
  try {
    const data = await k8sService.getCPUUsage();
    return res.status(200).json({
      success: true,
      data
    });
  } catch (err) {
    next(err);
  }
};

export const getMemoryUsage = async (req, res, next) => {
  try {
    const data = await k8sService.getMemoryUsage();
    return res.status(200).json({
      success: true,
      data
    });
  } catch (err) {
    next(err);
  }
};

export const getEvents = async (req, res, next) => {
  try {
    const data = await k8sService.getEvents();
    return res.status(200).json({
      success: true,
      data
    });
  } catch (err) {
    next(err);
  }
};
