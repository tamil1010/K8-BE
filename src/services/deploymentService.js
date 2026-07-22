import * as k8s from '@kubernetes/client-node';
import dotenv from 'dotenv';

dotenv.config();

let kc = new k8s.KubeConfig();
let coreApi = null;
let appsApi = null;
let isReady = false;

export const reinitializeDeploymentConfig = () => {
  try {
    const newKc = new k8s.KubeConfig();
    if (process.env.KUBECONFIG) {
      newKc.loadFromFile(process.env.KUBECONFIG);
    } else {
      newKc.loadFromDefault();
    }
    kc = newKc;
    coreApi = kc.makeApiClient(k8s.CoreV1Api);
    appsApi = kc.makeApiClient(k8s.AppsV1Api);
    isReady = true;
    return true;
  } catch (err) {
    console.warn('[DeploymentService] Re-init failed:', err.message);
    isReady = false;
    return false;
  }
};

try {
  if (process.env.KUBECONFIG) {
    kc.loadFromFile(process.env.KUBECONFIG);
  } else {
    kc.loadFromDefault();
  }
  coreApi = kc.makeApiClient(k8s.CoreV1Api);
  appsApi = kc.makeApiClient(k8s.AppsV1Api);
  isReady = true;
} catch (err) {
  console.warn('[DeploymentService] KubeConfig init failed:', err.message);
}

// Helpers
const getAge = (timestamp) => {
  if (!timestamp) return 'unknown';
  const diffMs = Date.now() - new Date(timestamp).getTime();
  const s = Math.floor(diffMs / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d`;
  if (h > 0) return `${h}h`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
};

const getDeploymentStatus = (deploy) => {
  const specReplicas = deploy.spec?.replicas ?? 0;
  const statusReplicas = deploy.status?.replicas ?? 0;
  const readyReplicas = deploy.status?.readyReplicas ?? 0;
  const availableReplicas = deploy.status?.availableReplicas ?? 0;
  const unavailableReplicas = deploy.status?.unavailableReplicas ?? 0;

  const conditions = deploy.status?.conditions || [];
  const replicaFailureCond = conditions.find(c => c.type === 'ReplicaFailure' && c.status === 'True');
  const progressingCond = conditions.find(c => c.type === 'Progressing');

  if (replicaFailureCond) return 'Failed';

  if (progressingCond && progressingCond.reason === 'ProgressDeadlineExceeded') {
    return 'Failed';
  }

  if (unavailableReplicas > 0) {
    return 'Progressing';
  }

  if (availableReplicas === specReplicas && readyReplicas === specReplicas) {
    return 'Healthy';
  }

  if (statusReplicas === 0 && specReplicas === 0) {
    return 'Healthy'; // scaled to 0
  }

  return 'Pending';
};

export const deploymentService = {
  getDeployments: async (namespace = '') => {
    if (!isReady || !appsApi) {
      throw new Error('Kubernetes API client is not initialized.');
    }

    const res = namespace
      ? await appsApi.listNamespacedDeployment(namespace)
      : await appsApi.listDeploymentForAllNamespaces();

    const items = res.body?.items || [];

    return items.map((deploy) => {
      const conditions = deploy.status?.conditions || [];
      const lastUpdateCond = conditions.reduce((latest, cond) => {
        if (!latest || new Date(cond.lastUpdateTime) > new Date(latest.lastUpdateTime)) {
          return cond;
        }
        return latest;
      }, null);

      return {
        name: deploy.metadata?.name || '',
        namespace: deploy.metadata?.namespace || '',
        status: getDeploymentStatus(deploy),
        desiredReplicas: deploy.spec?.replicas ?? 0,
        availableReplicas: deploy.status?.availableReplicas ?? 0,
        readyReplicas: deploy.status?.readyReplicas ?? 0,
        updatedReplicas: deploy.status?.updatedReplicas ?? 0,
        replicas: deploy.status?.replicas ?? 0,
        strategy: deploy.spec?.strategy?.type || 'RollingUpdate',
        age: getAge(deploy.metadata?.creationTimestamp),
        creationTimestamp: deploy.metadata?.creationTimestamp,
        lastUpdated: lastUpdateCond ? getAge(lastUpdateCond.lastUpdateTime) + ' ago' : 'unknown',
        containerImage: deploy.spec?.template?.spec?.containers?.[0]?.image || 'N/A'
      };
    });
  },

  getDeployment: async (namespace, name) => {
    if (!isReady || !appsApi) {
      throw new Error('Kubernetes API client is not initialized.');
    }
    const res = await appsApi.readNamespacedDeployment(name, namespace);
    const deploy = res.body;

    const eventsRes = await coreApi.listNamespacedEvent(namespace, undefined, undefined, undefined, `involvedObject.name=${name}`);
    const events = (eventsRes.body?.items || [])
      .sort((a, b) => new Date(b.lastTimestamp || b.metadata?.creationTimestamp || 0) - new Date(a.lastTimestamp || a.metadata?.creationTimestamp || 0))
      .slice(0, 15)
      .map(e => ({
        type: e.type,
        reason: e.reason,
        message: e.message,
        age: getAge(e.lastTimestamp || e.metadata?.creationTimestamp)
      }));

    return {
      name: deploy.metadata?.name,
      namespace: deploy.metadata?.namespace,
      labels: deploy.metadata?.labels || {},
      annotations: deploy.metadata?.annotations || {},
      containerImage: deploy.spec?.template?.spec?.containers?.[0]?.image || 'N/A',
      imagePullPolicy: deploy.spec?.template?.spec?.containers?.[0]?.imagePullPolicy || 'IfNotPresent',
      ports: (deploy.spec?.template?.spec?.containers?.[0]?.ports || []).map(p => `${p.containerPort}/${p.protocol || 'TCP'}`),
      env: (deploy.spec?.template?.spec?.containers?.[0]?.env || []).map(e => `${e.name}=${e.value || '<valueFrom>'}`),
      resources: deploy.spec?.template?.spec?.containers?.[0]?.resources || {},
      replicas: deploy.spec?.replicas ?? 0,
      availableReplicas: deploy.status?.availableReplicas ?? 0,
      readyReplicas: deploy.status?.readyReplicas ?? 0,
      unavailableReplicas: deploy.status?.unavailableReplicas ?? 0,
      updatedReplicas: deploy.status?.updatedReplicas ?? 0,
      strategy: deploy.spec?.strategy?.type || 'RollingUpdate',
      selectors: deploy.spec?.selector?.matchLabels || {},
      conditions: (deploy.status?.conditions || []).map(c => ({
        type: c.type,
        status: c.status,
        reason: c.reason,
        message: c.message,
        lastUpdateTime: c.lastUpdateTime
      })),
      creationTimestamp: deploy.metadata?.creationTimestamp,
      events
    };
  },

  createDeployment: async (namespace, body) => {
    if (!isReady || !appsApi) {
      throw new Error('Kubernetes API client is not initialized.');
    }
    let manifest = body;
    if (typeof body === 'string') {
      manifest = k8s.loadYaml(body);
    }
    const res = await appsApi.createNamespacedDeployment(namespace, manifest);
    return res.body;
  },

  scaleDeployment: async (namespace, name, replicas) => {
    if (!isReady || !appsApi) {
      throw new Error('Kubernetes API client is not initialized.');
    }
    
    // Patch to modify replica count
    const patch = [{
      op: 'replace',
      path: '/spec/replicas',
      value: parseInt(replicas, 10)
    }];

    const res = await appsApi.patchNamespacedDeployment(
      name,
      namespace,
      patch,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      { headers: { 'Content-Type': 'application/json-patch+json' } }
    );
    return res.body;
  },

  restartDeployment: async (namespace, name) => {
    if (!isReady || !appsApi) {
      throw new Error('Kubernetes API client is not initialized.');
    }

    const patch = {
      spec: {
        template: {
          metadata: {
            annotations: {
              'kubectl.kubernetes.io/restartedAt': new Date().toISOString()
            }
          }
        }
      }
    };

    const res = await appsApi.patchNamespacedDeployment(
      name,
      namespace,
      patch,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      { headers: { 'Content-Type': 'application/merge-patch+json' } }
    );
    return res.body;
  },

  getDeploymentHistory: async (namespace, name) => {
    if (!isReady || !appsApi) {
      throw new Error('Kubernetes API client is not initialized.');
    }

    // Get the deployment to find selector labels
    const deployRes = await appsApi.readNamespacedDeployment(name, namespace);
    const deploy = deployRes.body;
    const selectors = Object.entries(deploy.spec?.selector?.matchLabels || {})
      .map(([k, v]) => `${k}=${v}`)
      .join(',');

    // Fetch related replica sets
    const rsRes = await appsApi.listNamespacedReplicaSet(namespace, undefined, undefined, undefined, undefined, selectors);
    const replicaSets = rsRes.body?.items || [];

    // Filter to ones owned by this deployment
    const ownedRS = replicaSets.filter(rs => {
      return rs.metadata?.ownerReferences?.some(o => o.kind === 'Deployment' && o.name === name);
    });

    return ownedRS.map(rs => {
      const revision = rs.metadata?.annotations?.['deployment.kubernetes.io/revision'];
      return {
        revision: revision ? parseInt(revision, 10) : 0,
        name: rs.metadata?.name,
        creationTimestamp: rs.metadata?.creationTimestamp,
        containerImage: rs.spec?.template?.spec?.containers?.[0]?.image || 'N/A',
        replicas: rs.spec?.replicas ?? 0,
        templateSpec: rs.spec?.template?.spec
      };
    }).sort((a, b) => b.revision - a.revision);
  },

  rollbackDeployment: async (namespace, name, revision) => {
    if (!isReady || !appsApi) {
      throw new Error('Kubernetes API client is not initialized.');
    }

    const history = await deploymentService.getDeploymentHistory(namespace, name);
    const targetRS = history.find(h => h.revision === parseInt(revision, 10));

    if (!targetRS) {
      throw new Error(`Revision ${revision} not found for deployment ${name}.`);
    }

    // Rollback is performed by patching the deployment template spec with the RS template spec
    const patch = {
      spec: {
        template: {
          spec: targetRS.templateSpec
        }
      }
    };

    const res = await appsApi.patchNamespacedDeployment(
      name,
      namespace,
      patch,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      { headers: { 'Content-Type': 'application/merge-patch+json' } }
    );
    return res.body;
  },

  getDeploymentLogs: async (namespace, name) => {
    if (!isReady || !appsApi || !coreApi) {
      throw new Error('Kubernetes API client is not initialized.');
    }

    // Aggregate logs from all pods belonging to this deployment
    const deployRes = await appsApi.readNamespacedDeployment(name, namespace);
    const deploy = deployRes.body;
    const selectors = Object.entries(deploy.spec?.selector?.matchLabels || {})
      .map(([k, v]) => `${k}=${v}`)
      .join(',');

    const podsRes = await coreApi.listNamespacedPod(namespace, undefined, undefined, undefined, undefined, selectors);
    const pods = podsRes.body?.items || [];

    if (pods.length === 0) {
      return 'No active pods found for this deployment.';
    }

    let aggregatedLogs = '';
    for (const pod of pods) {
      const podName = pod.metadata?.name;
      try {
        const logRes = await coreApi.readNamespacedPodLog(podName, namespace, undefined, false, false, undefined, undefined, false, undefined, undefined, 50, true);
        aggregatedLogs += `=== Pod: ${podName} ===\n${logRes.body || 'No logs'}\n\n`;
      } catch (err) {
        aggregatedLogs += `=== Pod: ${podName} ===\nFailed to fetch logs: ${err.message}\n\n`;
      }
    }

    return aggregatedLogs;
  },

  getDeploymentYaml: async (namespace, name) => {
    if (!isReady || !appsApi) {
      throw new Error('Kubernetes API client is not initialized.');
    }
    const res = await appsApi.readNamespacedDeployment(name, namespace);
    return res.body;
  },

  deleteDeployment: async (namespace, name) => {
    if (!isReady || !appsApi) {
      throw new Error('Kubernetes API client is not initialized.');
    }
    await appsApi.deleteNamespacedDeployment(name, namespace);
    return true;
  }
};
