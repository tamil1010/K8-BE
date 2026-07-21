import { podService } from '../services/podService.js';

// ============================================================================
// GET /api/pods — List all pods (optional ?namespace= query param)
// ============================================================================
export const listPods = async (req, res, next) => {
  try {
    const namespace = req.query.namespace === 'All Namespaces'
      ? ''
      : (req.query.namespace || '');
    const data = await podService.getPods(namespace);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// ============================================================================
// GET /api/pods/namespaces — List all cluster namespaces
// ============================================================================
export const listNamespaces = async (req, res, next) => {
  try {
    const data = await podService.getNamespaces();
    return res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// ============================================================================
// GET /api/pods/:namespace/:name/details — Full pod detail object
// ============================================================================
export const getPodDetails = async (req, res, next) => {
  try {
    const { namespace, name } = req.params;
    if (!namespace || !name) {
      return res.status(400).json({
        success: false,
        message: 'Both namespace and pod name are required.'
      });
    }
    const data = await podService.getPodDetails(namespace, name);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// ============================================================================
// GET /api/pods/:namespace/:name/logs — Pod logs (kubectl logs equivalent)
// ============================================================================
export const getPodLogs = async (req, res, next) => {
  try {
    const { namespace, name } = req.params;
    const container = req.query.container || '';
    const tailLines = parseInt(req.query.tail || '200', 10);

    if (!namespace || !name) {
      return res.status(400).json({
        success: false,
        message: 'Both namespace and pod name are required.'
      });
    }

    const logs = await podService.getPodLogs(namespace, name, container, tailLines);
    return res.status(200).json({ success: true, data: { logs } });
  } catch (err) {
    next(err);
  }
};

// ============================================================================
// GET /api/pods/:namespace/:name/describe — Describe pod (kubectl describe)
// ============================================================================
export const describePod = async (req, res, next) => {
  try {
    const { namespace, name } = req.params;
    if (!namespace || !name) {
      return res.status(400).json({
        success: false,
        message: 'Both namespace and pod name are required.'
      });
    }
    const data = await podService.describePod(namespace, name);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// ============================================================================
// DELETE /api/pods/:namespace/:name — Delete a pod
// ============================================================================
export const deletePod = async (req, res, next) => {
  try {
    const { namespace, name } = req.params;
    if (!namespace || !name) {
      return res.status(400).json({
        success: false,
        message: 'Both namespace and pod name are required.'
      });
    }
    await podService.deletePod(namespace, name);
    return res.status(200).json({
      success: true,
      message: `Pod "${name}" in namespace "${namespace}" was deleted successfully.`
    });
  } catch (err) {
    next(err);
  }
};

// ============================================================================
// POST /api/pods/:namespace/:name/restart — Restart a pod (owned by controller)
// ============================================================================
export const restartPod = async (req, res, next) => {
  try {
    const { namespace, name } = req.params;
    if (!namespace || !name) {
      return res.status(400).json({
        success: false,
        message: 'Both namespace and pod name are required.'
      });
    }
    const result = await podService.restartPod(namespace, name);
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    // 400 if pod is not managed by a controller
    if (err.message && err.message.includes('not managed')) {
      return res.status(400).json({ success: false, message: err.message });
    }
    next(err);
  }
};

// ============================================================================
// GET /api/pods/metrics — Pod-level CPU/Memory metrics from Metrics Server
// ============================================================================
export const getPodMetrics = async (req, res, next) => {
  try {
    const namespace = req.query.namespace === 'All Namespaces'
      ? ''
      : (req.query.namespace || '');
    const data = await podService.getPodMetrics(namespace);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};
