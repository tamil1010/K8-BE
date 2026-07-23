import { nodeService } from '../services/nodeService.js';

export const listNodes = async (req, res, next) => {
  try {
    const data = await nodeService.getNodes();
    return res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const getNode = async (req, res, next) => {
  try {
    const { name } = req.params;
    if (!name) {
      return res.status(400).json({ success: false, message: 'Node name is required.' });
    }
    const data = await nodeService.getNode(name);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const getNodePods = async (req, res, next) => {
  try {
    const { name } = req.params;
    if (!name) {
      return res.status(400).json({ success: false, message: 'Node name is required.' });
    }
    const data = await nodeService.getNodePods(name);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const getNodeYaml = async (req, res, next) => {
  try {
    const { name } = req.params;
    if (!name) {
      return res.status(400).json({ success: false, message: 'Node name is required.' });
    }
    const data = await nodeService.getNodeYaml(name);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const getNodeEvents = async (req, res, next) => {
  try {
    const { name } = req.params;
    if (!name) {
      return res.status(400).json({ success: false, message: 'Node name is required.' });
    }
    const data = await nodeService.getNodeEvents(name);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const describeNode = async (req, res, next) => {
  try {
    const { name } = req.params;
    if (!name) {
      return res.status(400).json({ success: false, message: 'Node name is required.' });
    }
    const data = await nodeService.describeNode(name);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const getNodeMetrics = async (req, res, next) => {
  try {
    const { name } = req.params;
    if (!name) {
      return res.status(400).json({ success: false, message: 'Node name is required.' });
    }
    const data = await nodeService.getNodeMetrics(name);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const cordonNode = async (req, res, next) => {
  try {
    const { name } = req.params;
    if (!name) {
      return res.status(400).json({ success: false, message: 'Node name is required.' });
    }
    const data = await nodeService.cordonNode(name);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const uncordonNode = async (req, res, next) => {
  try {
    const { name } = req.params;
    if (!name) {
      return res.status(400).json({ success: false, message: 'Node name is required.' });
    }
    const data = await nodeService.uncordonNode(name);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const drainNode = async (req, res, next) => {
  try {
    const { name } = req.params;
    if (!name) {
      return res.status(400).json({ success: false, message: 'Node name is required.' });
    }
    const data = await nodeService.drainNode(name);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const deleteNode = async (req, res, next) => {
  try {
    const { name } = req.params;
    if (!name) {
      return res.status(400).json({ success: false, message: 'Node name is required.' });
    }
    const data = await nodeService.deleteNode(name);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};
