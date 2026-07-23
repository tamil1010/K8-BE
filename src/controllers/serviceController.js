import { k8sService } from '../services/k8sService.js';

/**
 * List all services (supports optional ?namespace query param)
 * GET /api/services
 */
export const listServices = async (req, res, next) => {
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

/**
 * Get Service Detail & Endpoints
 * GET /api/services/:name or GET /api/services/:namespace/:name
 */
export const getServiceDetail = async (req, res, next) => {
  try {
    const { name, namespace: paramNs } = req.params;
    const namespace = paramNs || req.query.namespace || 'default';
    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Service name is required.'
      });
    }

    const data = await k8sService.getServiceDetail(namespace, name);
    return res.status(200).json({
      success: true,
      data
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get Service YAML manifest
 * GET /api/services/:name/yaml or GET /api/services/:namespace/:name/yaml
 */
export const getServiceYaml = async (req, res, next) => {
  try {
    const { name, namespace: paramNs } = req.params;
    const namespace = paramNs || req.query.namespace || 'default';
    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Service name is required.'
      });
    }

    const data = await k8sService.getServiceYaml(namespace, name);
    return res.status(200).json({
      success: true,
      data
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Create a new Service
 * POST /api/services
 */
export const createService = async (req, res, next) => {
  try {
    const { namespace, body: serviceBody, ...directFields } = req.body;
    const targetNs = namespace || directFields.namespace || serviceBody?.metadata?.namespace || 'default';
    const payload = serviceBody || directFields;

    if (!payload.name && !payload.metadata?.name) {
      return res.status(400).json({
        success: false,
        message: 'Service name is required.'
      });
    }

    const data = await k8sService.createService(targetNs, payload);
    return res.status(201).json({
      success: true,
      message: 'Service created successfully.',
      data
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Update an existing Service (Labels, Selector, Ports)
 * PUT /api/services/:name or PUT /api/services/:namespace/:name
 */
export const updateService = async (req, res, next) => {
  try {
    const { name, namespace: paramNs } = req.params;
    const namespace = paramNs || req.query.namespace || req.body.namespace || 'default';
    const updateData = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Service name is required.'
      });
    }

    const data = await k8sService.updateService(namespace, name, updateData);
    return res.status(200).json({
      success: true,
      message: `Service "${name}" updated successfully.`,
      data
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Delete Service
 * DELETE /api/services/:name or DELETE /api/services/:namespace/:name
 */
export const deleteService = async (req, res, next) => {
  try {
    const { name, namespace: paramNs } = req.params;
    const namespace = paramNs || req.query.namespace || 'default';

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Service name is required.'
      });
    }

    await k8sService.deleteService(namespace, name);
    return res.status(200).json({
      success: true,
      message: `Service "${name}" in namespace "${namespace}" deleted successfully.`
    });
  } catch (err) {
    next(err);
  }
};
