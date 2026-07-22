import { execSync } from 'child_process';
import { reinitializeK8sConfig } from '../services/k8sService.js';
import { reinitializeNodeConfig } from '../services/nodeService.js';
import { reinitializeDeploymentConfig } from '../services/deploymentService.js';
import { reinitializePodConfig } from '../services/podService.js';
import * as k8s from '@kubernetes/client-node';

// Fallbacks for simulator/offline mode
let mockCurrentContext = 'docker-desktop';
const mockContexts = ['docker-desktop', 'kind-k8-dashboard', 'minikube'];

// Helper to run shell commands safely
const runCommand = (cmd) => {
  try {
    return execSync(cmd, { encoding: 'utf8' }).trim();
  } catch (err) {
    return null;
  }
};

export const getClusters = async (req, res, next) => {
  try {
    let contexts = [];
    let current = '';

    const currentRes = runCommand('kubectl config current-context');
    const contextsRes = runCommand('kubectl config get-contexts -o name');

    if (currentRes && contextsRes) {
      current = currentRes;
      contexts = contextsRes.split('\n').map(c => c.trim()).filter(Boolean);
    } else {
      // Simulator mode / fallback
      current = mockCurrentContext;
      contexts = mockContexts;
    }

    const data = contexts.map(name => ({
      name,
      isCurrent: name === current
    }));

    return res.status(200).json({
      success: true,
      data
    });
  } catch (err) {
    next(err);
  }
};

export const getCurrentCluster = async (req, res, next) => {
  try {
    let current = '';
    const currentRes = runCommand('kubectl config current-context');

    if (currentRes) {
      current = currentRes;
    } else {
      current = mockCurrentContext;
    }

    // Try to get Kubernetes Version
    let k8sVersion = 'v1.28.2'; // default fallback
    try {
      const kc = new k8s.KubeConfig();
      if (process.env.KUBECONFIG) {
        kc.loadFromFile(process.env.KUBECONFIG);
      } else {
        kc.loadFromDefault();
      }
      const versionApi = kc.makeApiClient(k8s.VersionApi);
      const versionRes = await versionApi.getCode();
      k8sVersion = versionRes.body.gitVersion || 'v1.28.2';
    } catch (_) {
      // Keep fallback version
    }

    // Nodes stats for overview
    let nodesCount = 0;
    let controlPlaneCount = 0;
    let workerCount = 0;
    let status = 'Connected';

    try {
      const kc = new k8s.KubeConfig();
      if (process.env.KUBECONFIG) {
        kc.loadFromFile(process.env.KUBECONFIG);
      } else {
        kc.loadFromDefault();
      }
      const coreApi = kc.makeApiClient(k8s.CoreV1Api);
      const nodesRes = await coreApi.listNode();
      const nodes = nodesRes.body.items || [];
      nodesCount = nodes.length;
      
      nodes.forEach(node => {
        const labels = node.metadata?.labels || {};
        if ('node-role.kubernetes.io/control-plane' in labels || 'node-role.kubernetes.io/master' in labels) {
          controlPlaneCount++;
        } else {
          workerCount++;
        }
      });
    } catch (_) {
      // Simulator stats mapping based on current context
      status = 'Simulated';
      if (current === 'docker-desktop') {
        nodesCount = 1;
        controlPlaneCount = 1;
        workerCount = 0;
        k8sVersion = 'v1.30.1';
      } else if (current === 'kind-k8-dashboard') {
        nodesCount = 3;
        controlPlaneCount = 1;
        workerCount = 2;
        k8sVersion = 'v1.30.1';
      } else if (current === 'minikube') {
        nodesCount = 1;
        controlPlaneCount = 1;
        workerCount = 0;
        k8sVersion = 'v1.28.3';
      } else {
        nodesCount = 4;
        controlPlaneCount = 1;
        workerCount = 3;
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        name: current,
        context: current,
        version: k8sVersion,
        status,
        nodesCount,
        controlPlaneCount,
        workerCount
      }
    });
  } catch (err) {
    next(err);
  }
};

export const switchCluster = async (req, res, next) => {
  try {
    const { context } = req.body;
    if (!context) {
      return res.status(400).json({
        success: false,
        message: 'Context name parameter is required.'
      });
    }

    // Switch context
    let switched = false;
    const switchRes = runCommand(`kubectl config use-context ${context}`);
    if (switchRes) {
      switched = true;
    } else {
      // Simulator mode / fallback
      if (mockContexts.includes(context)) {
        mockCurrentContext = context;
        switched = true;
      }
    }

    if (switched) {
      // Reinitialize K8s configurations in all services
      reinitializeK8sConfig();
      reinitializeNodeConfig();
      reinitializeDeploymentConfig();
      reinitializePodConfig();

      return res.status(200).json({
        success: true,
        message: `Successfully switched context to "${context}"`
      });
    } else {
      return res.status(500).json({
        success: false,
        message: `Failed to switch context to "${context}"`
      });
    }
  } catch (err) {
    next(err);
  }
};
