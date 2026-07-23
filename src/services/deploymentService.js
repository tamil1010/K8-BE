import * as k8s from '@kubernetes/client-node';
import dotenv from 'dotenv';

dotenv.config();

let kc = new k8s.KubeConfig();
let coreApi = null;
let appsApi = null;
let customObjectsApi = null;
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
    customObjectsApi = kc.makeApiClient(k8s.CustomObjectsApi);
    isReady = true;
    return true;
  } catch (err) {
    console.warn(JSON.stringify({
      level: 'warn',
      service: 'DeploymentService',
      message: `Re-init failed: ${err.message}`
    }));
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
  customObjectsApi = kc.makeApiClient(k8s.CustomObjectsApi);
  isReady = true;
} catch (err) {
  console.warn(JSON.stringify({
    level: 'warn',
    service: 'DeploymentService',
    message: `KubeConfig init failed: ${err.message}`
  }));
}

// Parsing Helpers
const parseCpuToCores = (val) => {
  if (!val) return 0;
  if (val.endsWith('m')) return parseFloat(val) / 1000;
  if (val.endsWith('n')) return parseFloat(val) / 1000000000;
  if (val.endsWith('u')) return parseFloat(val) / 1000000;
  return parseFloat(val);
};

const parseMemoryToMiB = (val) => {
  if (!val) return 0;
  let num = parseFloat(val);
  if (val.endsWith('Ki') || val.endsWith('ki')) return num / 1024;
  if (val.endsWith('Mi') || val.endsWith('mi')) return num;
  if (val.endsWith('Gi') || val.endsWith('gi')) return num * 1024;
  if (val.endsWith('Ti') || val.endsWith('ti')) return num * 1024 * 1024;
  if (val.endsWith('k')) return num / 1000;
  if (val.endsWith('m')) return num / 1000000;
  return num / (1024 * 1024);
};

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
      // Simulator Fallback
      return {
        name,
        namespace,
        uid: "d34b22ce-1234-5678-abcd-ef1234567890",
        labels: { app: name, environment: "production" },
        annotations: { "deployment.kubernetes.io/revision": "1" },
        containerImage: "nginx:latest",
        imagePullPolicy: "Always",
        ports: ["80/TCP"],
        env: ["PORT=80", "DB_HOST=mysql"],
        resources: { limits: { cpu: "500m", memory: "256Mi" }, requests: { cpu: "100m", memory: "128Mi" } },
        replicas: 3,
        desiredReplicas: 3,
        availableReplicas: 3,
        readyReplicas: 3,
        unavailableReplicas: 0,
        updatedReplicas: 3,
        strategy: "RollingUpdate",
        strategyDetails: { type: "RollingUpdate", rollingUpdate: { maxSurge: "25%", maxUnavailable: "25%" } },
        selectors: { app: name },
        conditions: [
          { type: "Available", status: "True", reason: "MinimumReplicasAvailable", message: "Deployment has minimum availability." },
          { type: "Progressing", status: "True", reason: "NewReplicaSetAvailable", message: "ReplicaSet \"nginx-5c7d8b\" has successfully progressed." }
        ],
        creationTimestamp: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
        age: "4d",
        nodeSelector: { "kubernetes.io/os": "linux" },
        tolerations: [{ key: "node-role.kubernetes.io/control-plane", effect: "NoSchedule" }],
        affinity: {},
        volumes: [{ name: "config-volume", configMap: { name: "app-config" } }],
        cpuUsage: "0.045 Cores",
        memUsage: "98.2 MiB",
        netUsage: "Metrics Not Available",
        events: [
          { type: "Normal", reason: "ScalingReplicaSet", message: "Scaled up replica set to 3", age: "4d" }
        ]
      };
    }

    const deployRes = await appsApi.readNamespacedDeployment(name, namespace);
    const deploy = deployRes.body;

    const selectors = Object.entries(deploy.spec?.selector?.matchLabels || {})
      .map(([k, v]) => `${k}=${v}`)
      .join(',');

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

    // Resource usage calculations
    let cpuUsage = 'Metrics Not Available';
    let memUsage = 'Metrics Not Available';
    if (customObjectsApi) {
      try {
        const podsRes = await coreApi.listNamespacedPod(namespace, undefined, undefined, undefined, undefined, selectors);
        const pods = podsRes.body?.items || [];
        const podNames = pods.map(p => p.metadata?.name);
        
        const metricsRes = await customObjectsApi.listNamespacedCustomObject('metrics.k8s.io', 'v1beta1', namespace, 'pods');
        const podMetrics = (metricsRes.body?.items || []).filter(m => podNames.includes(m.metadata?.name));
        
        let totalCpu = 0;
        let totalMem = 0;
        podMetrics.forEach(pm => {
          (pm.containers || []).forEach(c => {
            totalCpu += parseCpuToCores(c.usage?.cpu);
            totalMem += parseMemoryToMiB(c.usage?.memory);
          });
        });

        if (totalCpu > 0) cpuUsage = `${totalCpu.toFixed(3)} Cores`;
        if (totalMem > 0) memUsage = `${totalMem.toFixed(1)} MiB`;
      } catch (_) {}
    }

    return {
      name: deploy.metadata?.name,
      namespace: deploy.metadata?.namespace,
      uid: deploy.metadata?.uid,
      labels: deploy.metadata?.labels || {},
      annotations: deploy.metadata?.annotations || {},
      containerImage: deploy.spec?.template?.spec?.containers?.[0]?.image || 'N/A',
      imagePullPolicy: deploy.spec?.template?.spec?.containers?.[0]?.imagePullPolicy || 'IfNotPresent',
      ports: (deploy.spec?.template?.spec?.containers?.[0]?.ports || []).map(p => `${p.containerPort}/${p.protocol || 'TCP'}`),
      env: (deploy.spec?.template?.spec?.containers?.[0]?.env || []).map(e => `${e.name}=${e.value || (e.valueFrom ? '<valueFrom>' : '')}`),
      resources: deploy.spec?.template?.spec?.containers?.[0]?.resources || {},
      replicas: deploy.spec?.replicas ?? 0,
      desiredReplicas: deploy.spec?.replicas ?? 0,
      availableReplicas: deploy.status?.availableReplicas ?? 0,
      readyReplicas: deploy.status?.readyReplicas ?? 0,
      unavailableReplicas: deploy.status?.unavailableReplicas ?? 0,
      updatedReplicas: deploy.status?.updatedReplicas ?? 0,
      strategy: deploy.spec?.strategy?.type || 'RollingUpdate',
      strategyDetails: deploy.spec?.strategy || { type: 'RollingUpdate' },
      selectors: deploy.spec?.selector?.matchLabels || {},
      conditions: (deploy.status?.conditions || []).map(c => ({
        type: c.type,
        status: c.status,
        reason: c.reason,
        message: c.message,
        lastUpdateTime: c.lastUpdateTime
      })),
      creationTimestamp: deploy.metadata?.creationTimestamp,
      age: getAge(deploy.metadata?.creationTimestamp),
      nodeSelector: deploy.spec?.template?.spec?.nodeSelector || {},
      tolerations: deploy.spec?.template?.spec?.tolerations || [],
      affinity: deploy.spec?.template?.spec?.affinity || {},
      volumes: deploy.spec?.template?.spec?.volumes || [],
      cpuUsage,
      memUsage,
      netUsage: 'Metrics Not Available',
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
      return [
        { revision: 1, name: `${name}-5c7d8b`, creationTimestamp: new Date().toISOString(), containerImage: 'nginx:latest', replicas: 3 }
      ];
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

  getDeploymentEvents: async (namespace, name) => {
    if (isReady && coreApi) {
      const eventsRes = await coreApi.listNamespacedEvent(namespace, undefined, undefined, undefined, `involvedObject.name=${name}`);
      return (eventsRes.body?.items || [])
        .sort((a, b) => new Date(b.lastTimestamp || b.metadata?.creationTimestamp || 0) - new Date(a.lastTimestamp || a.metadata?.creationTimestamp || 0))
        .map(e => ({
          type: e.type || 'Normal',
          reason: e.reason || 'N/A',
          message: e.message || 'N/A',
          count: e.count || 1,
          lastSeen: getAge(e.lastTimestamp || e.metadata?.creationTimestamp)
        }));
    }
    return [
      { type: 'Normal', reason: 'ScalingReplicaSet', message: 'Scaled up replica set to 3', count: 1, lastSeen: '4d' }
    ];
  },

  getDeploymentPods: async (namespace, name) => {
    if (!isReady || !appsApi || !coreApi) {
      // Simulator Fallback
      return [
        { name: `${name}-5c7d8b-1a2b3`, status: 'Running', node: 'minikube', restarts: 0, cpu: '0.015 Cores', memory: '48.0 MiB', age: '2d' },
        { name: `${name}-5c7d8b-4c5d6`, status: 'Running', node: 'minikube', restarts: 1, cpu: '0.022 Cores', memory: '52.0 MiB', age: '2d' }
      ];
    }
    
    const deployRes = await appsApi.readNamespacedDeployment(name, namespace);
    const deploy = deployRes.body;
    const selectors = Object.entries(deploy.spec?.selector?.matchLabels || {})
      .map(([k, v]) => `${k}=${v}`)
      .join(',');

    const [podsRes, metricsRes] = await Promise.all([
      coreApi.listNamespacedPod(namespace, undefined, undefined, undefined, undefined, selectors),
      (async () => {
        try {
          if (customObjectsApi) {
            return await customObjectsApi.listNamespacedCustomObject('metrics.k8s.io', 'v1beta1', namespace, 'pods');
          }
        } catch (_) {}
        return null;
      })()
    ]);

    const pods = podsRes.body?.items || [];
    const metricsMap = new Map();
    if (metricsRes?.body?.items) {
      metricsRes.body.items.forEach(p => {
        metricsMap.set(p.metadata?.name, p.containers || []);
      });
    }

    const getRestarts = (pod) => {
      return (pod.status?.containerStatuses || []).reduce((acc, c) => acc + (c.restartCount || 0), 0);
    };

    return pods.map(pod => {
      const pName = pod.metadata?.name || '';
      const podMetrics = metricsMap.get(pName) || [];
      
      let cpuTotal = 0;
      let memTotal = 0;
      podMetrics.forEach(c => {
        cpuTotal += parseCpuToCores(c.usage?.cpu);
        memTotal += parseMemoryToMiB(c.usage?.memory);
      });

      return {
        name: pName,
        status: pod.status?.phase || 'Unknown',
        node: pod.spec?.nodeName || 'N/A',
        restarts: getRestarts(pod),
        cpu: cpuTotal > 0 ? `${cpuTotal.toFixed(3)} Cores` : 'Metrics Not Available',
        memory: memTotal > 0 ? `${memTotal.toFixed(1)} MiB` : 'Metrics Not Available',
        age: getAge(pod.metadata?.creationTimestamp)
      };
    });
  },

  getDeploymentReplicaSets: async (namespace, name) => {
    if (!isReady || !appsApi) {
      return [
        { name: `${name}-5c7d8b`, desired: 3, current: 3, ready: 3, age: '4d' }
      ];
    }
    const deployRes = await appsApi.readNamespacedDeployment(name, namespace);
    const deploy = deployRes.body;
    const selectors = Object.entries(deploy.spec?.selector?.matchLabels || {})
      .map(([k, v]) => `${k}=${v}`)
      .join(',');

    const rsRes = await appsApi.listNamespacedReplicaSet(namespace, undefined, undefined, undefined, undefined, selectors);
    const ownedRS = (rsRes.body?.items || []).filter(rs => {
      return rs.metadata?.ownerReferences?.some(o => o.kind === 'Deployment' && o.name === name);
    });

    return ownedRS.map(rs => ({
      name: rs.metadata?.name || '',
      desired: rs.spec?.replicas ?? 0,
      current: rs.status?.replicas ?? 0,
      ready: rs.status?.readyReplicas ?? 0,
      age: getAge(rs.metadata?.creationTimestamp)
    }));
  },

  describeDeployment: async (namespace, name) => {
    if (!isReady || !appsApi) {
      return `Name:                   ${name}
Namespace:              ${namespace}
CreationTimestamp:      ${new Date().toISOString()}
Labels:                 app=${name}
Selector:               app=${name}
Replicas:               3 desired | 3 updated | 3 total | 3 available | 0 unavailable
StrategyType:           RollingUpdate
MinReadySeconds:        0
RollingUpdateStrategy:  25% max unavailable, 25% max surge
`;
    }

    const deployRes = await appsApi.readNamespacedDeployment(name, namespace);
    const deploy = deployRes.body;

    const selectors = Object.entries(deploy.spec?.selector?.matchLabels || {})
      .map(([k, v]) => `${k}=${v}`)
      .join(',');

    return `Name:                   ${deploy.metadata?.name}
Namespace:              ${deploy.metadata?.namespace}
CreationTimestamp:      ${deploy.metadata?.creationTimestamp}
Labels:                 ${Object.entries(deploy.metadata?.labels || {}).map(([k, v]) => `${k}=${v}`).join('\n                        ')}
Annotations:            ${Object.entries(deploy.metadata?.annotations || {}).map(([k, v]) => `${k}=${v}`).join('\n                        ')}
Selector:               ${selectors}
Replicas:               ${deploy.spec?.replicas || 0} desired | ${deploy.status?.updatedReplicas || 0} updated | ${deploy.status?.replicas || 0} total | ${deploy.status?.availableReplicas || 0} available | ${deploy.status?.unavailableReplicas || 0} unavailable
StrategyType:           ${deploy.spec?.strategy?.type || 'RollingUpdate'}
RollingUpdateStrategy:  ${deploy.spec?.strategy?.rollingUpdate?.maxUnavailable || '25%'} max unavailable, ${deploy.spec?.strategy?.rollingUpdate?.maxSurge || '25%'} max surge
Pod Template:
  Labels:  ${selectors}
  Containers:
   ${(deploy.spec?.template?.spec?.containers || []).map(c => `
    Image:      ${c.image}
    Port:       ${(c.ports || []).map(p => `${p.containerPort}/${p.protocol || 'TCP'}`).join(', ') || '<none>'}
    Limits:     ${JSON.stringify(c.resources?.limits || {})}
    Requests:   ${JSON.stringify(c.resources?.requests || {})}
    Environment: ${(c.env || []).map(e => `\n      ${e.name}: ${e.value || ''}`).join('') || '<none>'}
   `).join('\n')}
`;
  },

  deleteDeployment: async (namespace, name) => {
    if (!isReady || !appsApi) {
      throw new Error('Kubernetes API client is not initialized.');
    }
    await appsApi.deleteNamespacedDeployment(name, namespace);
    return true;
  }
};
