import k8s from '@kubernetes/client-node';
import dotenv from 'dotenv';

dotenv.config();

// ============================================================================
// KUBERNETES CLIENT INITIALIZATION
// ============================================================================

let kc = new k8s.KubeConfig();
let coreApi = null;
let appsApi = null;
let customObjectsApi = null;
let isReady = false;

export const reinitializePodConfig = () => {
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
    console.warn('[PodService] Re-init failed:', err.message);
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
  console.warn('[PodService] KubeConfig init failed:', err.message);
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Convert Kubernetes timestamp to a human-readable age string (e.g. "3d", "2h", "5m")
 */
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

/**
 * Parse a Kubernetes CPU string (e.g. "250n", "100u", "500m", "2") into millicores.
 */
const parseCpuToMillicores = (raw = '0') => {
  if (!raw) return 0;
  if (raw.endsWith('n')) return parseInt(raw) / 1_000_000;
  if (raw.endsWith('u')) return parseInt(raw) / 1_000;
  if (raw.endsWith('m')) return parseInt(raw);
  return parseInt(raw) * 1000;
};

/**
 * Parse a Kubernetes memory string (e.g. "512Ki", "256Mi", "1Gi") into Mi.
 */
const parseMemoryToMi = (raw = '0') => {
  if (!raw) return 0;
  if (raw.endsWith('Ki')) return parseInt(raw) / 1024;
  if (raw.endsWith('Mi')) return parseInt(raw);
  if (raw.endsWith('Gi')) return parseInt(raw) * 1024;
  if (raw.endsWith('Ti')) return parseInt(raw) * 1024 * 1024;
  return parseInt(raw) / (1024 * 1024); // bytes → Mi
};

/**
 * Format millicores to a display string (e.g. "245m", "1.2 cores")
 */
const formatCpu = (mc) => {
  if (mc === null || mc === undefined) return 'N/A';
  if (mc < 1000) return `${Math.round(mc)}m`;
  return `${(mc / 1000).toFixed(2)} cores`;
};

/**
 * Format memory in Mi to a display string (e.g. "128 Mi", "1.5 Gi")
 */
const formatMemory = (mi) => {
  if (mi === null || mi === undefined) return 'N/A';
  if (mi < 1024) return `${Math.round(mi)} Mi`;
  return `${(mi / 1024).toFixed(2)} Gi`;
};

/**
 * Determine the effective pod status, including CrashLoopBackOff detection.
 */
const getPodStatus = (pod) => {
  const phase = pod.status?.phase || 'Unknown';
  // Detect container-level wait reasons
  const containerStatuses = pod.status?.containerStatuses || [];
  for (const cs of containerStatuses) {
    const reason = cs.state?.waiting?.reason;
    if (reason === 'CrashLoopBackOff') return 'CrashLoopBackOff';
    if (reason === 'OOMKilled') return 'OOMKilled';
    if (reason === 'ImagePullBackOff') return 'ImagePullBackOff';
    if (reason === 'ErrImagePull') return 'ErrImagePull';
  }
  // Map Succeeded → Completed for display consistency
  if (phase === 'Succeeded') return 'Succeeded';
  return phase;
};

/**
 * Sum restart counts across all containers in a pod.
 */
const getTotalRestarts = (pod) => {
  const cs = pod.status?.containerStatuses || [];
  return cs.reduce((acc, c) => acc + (c.restartCount || 0), 0);
};

// ============================================================================
// METRICS SERVER HELPER
// ============================================================================

/**
 * Fetch per-pod metrics from the Metrics Server API.
 * Returns a Map<"namespace/name", { cpu: string, memory: string }> or null if unavailable.
 */
const fetchPodMetricsMap = async (namespace = '') => {
  if (!isReady || !customObjectsApi) return null;
  try {
    let res;
    if (namespace) {
      res = await customObjectsApi.listNamespacedCustomObject(
        'metrics.k8s.io', 'v1beta1', namespace, 'pods'
      );
    } else {
      res = await customObjectsApi.listClusterCustomObject(
        'metrics.k8s.io', 'v1beta1', 'pods'
      );
    }
    const items = res.body?.items || [];
    const map = new Map();
    for (const item of items) {
      const ns = item.metadata?.namespace;
      const name = item.metadata?.name;
      const key = `${ns}/${name}`;
      const cpuMc = item.containers?.reduce(
        (acc, c) => acc + parseCpuToMillicores(c.usage?.cpu), 0
      ) ?? 0;
      const memMi = item.containers?.reduce(
        (acc, c) => acc + parseMemoryToMi(c.usage?.memory), 0
      ) ?? 0;
      map.set(key, {
        cpu: formatCpu(cpuMc),
        memory: formatMemory(memMi)
      });
    }
    return map;
  } catch (_err) {
    // Metrics Server not installed or unavailable
    return null;
  }
};

// ============================================================================
// POD SERVICE EXPORTS
// ============================================================================

export const podService = {

  // --------------------------------------------------------------------------
  // GET ALL PODS (optionally filtered by namespace)
  // Returns pods with live CPU/Memory from Metrics Server (or "N/A")
  // --------------------------------------------------------------------------
  getPods: async (namespace = '') => {
    if (!isReady || !coreApi) {
      throw new Error('Kubernetes API client is not initialized.');
    }

    const [podsRes, metricsMap] = await Promise.all([
      namespace
        ? coreApi.listNamespacedPod(namespace)
        : coreApi.listPodForAllNamespaces(),
      fetchPodMetricsMap(namespace)
    ]);

    const items = podsRes.body?.items || [];

    return items.map((pod) => {
      const ns = pod.metadata?.namespace || '';
      const name = pod.metadata?.name || '';
      const key = `${ns}/${name}`;
      const metrics = metricsMap?.get(key);

      return {
        name,
        namespace: ns,
        status: getPodStatus(pod),
        node: pod.spec?.nodeName || 'none',
        restarts: getTotalRestarts(pod),
        cpu: metrics?.cpu ?? 'N/A',
        memory: metrics?.memory ?? 'N/A',
        age: getAge(pod.metadata?.creationTimestamp),
        // Extra field to determine restart eligibility
        ownerKind: pod.metadata?.ownerReferences?.[0]?.kind || 'None'
      };
    });
  },

  // --------------------------------------------------------------------------
  // GET ALL NAMESPACES
  // --------------------------------------------------------------------------
  getNamespaces: async () => {
    if (!isReady || !coreApi) {
      throw new Error('Kubernetes API client is not initialized.');
    }
    const res = await coreApi.listNamespace();
    const defaults = ['All Namespaces', 'default', 'kube-system', 'kube-public', 'kube-node-lease'];
    const fromCluster = (res.body?.items || []).map(ns => ns.metadata?.name).filter(Boolean);
    // Merge defaults + cluster namespaces, deduplicate, preserve order
    const merged = ['All Namespaces', ...new Set([...fromCluster, ...defaults.slice(1)])];
    return merged;
  },

  // --------------------------------------------------------------------------
  // GET POD DETAILS (full object)
  // --------------------------------------------------------------------------
  getPodDetails: async (namespace, name) => {
    if (!isReady || !coreApi) {
      throw new Error('Kubernetes API client is not initialized.');
    }
    const res = await coreApi.readNamespacedPod(name, namespace);
    const pod = res.body;

    const containerStatuses = pod.status?.containerStatuses || [];
    const totalRestarts = containerStatuses.reduce((acc, c) => acc + (c.restartCount || 0), 0);

    return {
      name: pod.metadata?.name || '',
      namespace: pod.metadata?.namespace || '',
      node: pod.spec?.nodeName || 'N/A',
      podIP: pod.status?.podIP || 'N/A',
      hostIP: pod.status?.hostIP || 'N/A',
      labels: pod.metadata?.labels || {},
      containerImages: (pod.spec?.containers || []).map(c => ({
        name: c.name,
        image: c.image,
        resources: c.resources || {}
      })),
      initContainerImages: (pod.spec?.initContainers || []).map(c => ({
        name: c.name,
        image: c.image
      })),
      creationTimestamp: pod.metadata?.creationTimestamp || null,
      status: getPodStatus(pod),
      phase: pod.status?.phase || 'Unknown',
      restarts: totalRestarts,
      qosClass: pod.status?.qosClass || 'BestEffort',
      conditions: (pod.status?.conditions || []).map(c => ({
        type: c.type,
        status: c.status,
        reason: c.reason || '',
        message: c.message || '',
        lastTransitionTime: c.lastTransitionTime || null
      })),
      ownerReferences: pod.metadata?.ownerReferences || [],
      volumes: (pod.spec?.volumes || []).map(v => v.name),
      serviceAccountName: pod.spec?.serviceAccountName || 'default',
      age: getAge(pod.metadata?.creationTimestamp)
    };
  },

  // --------------------------------------------------------------------------
  // GET POD LOGS
  // --------------------------------------------------------------------------
  getPodLogs: async (namespace, name, container = '', tailLines = 200) => {
    if (!isReady || !coreApi) {
      throw new Error('Kubernetes API client is not initialized.');
    }

    const opts = {
      tailLines,
      timestamps: true
    };
    if (container) opts.container = container;

    const res = await coreApi.readNamespacedPodLog(
      name, namespace,
      opts.container,
      false,      // follow
      false,      // insecureSkipTLSVerifyBackend
      undefined,  // limitBytes
      undefined,  // pretty
      false,      // previous
      undefined,  // sinceSeconds
      undefined,  // sinceTime
      opts.tailLines,
      opts.timestamps
    );

    return typeof res.body === 'string' ? res.body : (res.body || '');
  },

  // --------------------------------------------------------------------------
  // DESCRIBE POD (kubectl describe pod equivalent)
  // --------------------------------------------------------------------------
  describePod: async (namespace, name) => {
    if (!isReady || !coreApi) {
      throw new Error('Kubernetes API client is not initialized.');
    }

    const [podRes, eventsRes] = await Promise.all([
      coreApi.readNamespacedPod(name, namespace),
      coreApi.listNamespacedEvent(namespace, undefined, undefined, undefined,
        `involvedObject.name=${name}`)
    ]);

    const pod = podRes.body;
    const events = (eventsRes.body?.items || [])
      .sort((a, b) => new Date(b.lastTimestamp || 0) - new Date(a.lastTimestamp || 0))
      .slice(0, 20)
      .map(e => ({
        type: e.type || 'Normal',
        reason: e.reason || '',
        age: getAge(e.lastTimestamp || e.metadata?.creationTimestamp),
        from: e.source?.component || '',
        message: e.message || ''
      }));

    const containerStatuses = pod.status?.containerStatuses || [];
    const totalRestarts = containerStatuses.reduce((acc, c) => acc + (c.restartCount || 0), 0);

    return {
      // Metadata
      name: pod.metadata?.name,
      namespace: pod.metadata?.namespace,
      priority: pod.spec?.priority ?? 0,
      node: pod.spec?.nodeName || '<none>',
      startTime: pod.status?.startTime || null,
      labels: pod.metadata?.labels || {},
      annotations: pod.metadata?.annotations || {},
      status: getPodStatus(pod),
      podIP: pod.status?.podIP || '<none>',
      hostIP: pod.status?.hostIP || '<none>',
      qosClass: pod.status?.qosClass || 'BestEffort',
      serviceAccountName: pod.spec?.serviceAccountName || 'default',

      // Containers
      containers: (pod.spec?.containers || []).map(c => {
        const cs = containerStatuses.find(s => s.name === c.name) || {};
        return {
          name: c.name,
          image: c.image,
          imagePullPolicy: c.imagePullPolicy || 'IfNotPresent',
          ports: (c.ports || []).map(p => `${p.containerPort}/${p.protocol || 'TCP'}`),
          env: (c.env || []).map(e => `${e.name}=${e.value || '<valueFrom>'}`),
          volumeMounts: (c.volumeMounts || []).map(v => v.name),
          resources: {
            requests: c.resources?.requests || {},
            limits: c.resources?.limits || {}
          },
          ready: cs.ready ?? false,
          restartCount: cs.restartCount ?? 0,
          state: cs.state
            ? Object.keys(cs.state)[0]
            : 'unknown',
          stateReason: cs.state?.waiting?.reason || cs.state?.terminated?.reason || ''
        };
      }),

      // Conditions
      conditions: (pod.status?.conditions || []).map(c => ({
        type: c.type,
        status: c.status,
        lastTransitionTime: c.lastTransitionTime,
        reason: c.reason || '',
        message: c.message || ''
      })),

      // Volumes
      volumes: (pod.spec?.volumes || []).map(v => ({
        name: v.name,
        type: Object.keys(v).filter(k => k !== 'name')[0] || 'unknown'
      })),

      // Tolerations
      tolerations: (pod.spec?.tolerations || []).map(t =>
        `${t.key || '*'}:${t.operator || 'Equal'}${t.value ? '=' + t.value : ''}${t.effect ? ' ' + t.effect : ''}`
      ),

      // Events
      events,

      // Owner
      ownerReferences: pod.metadata?.ownerReferences || [],

      age: getAge(pod.metadata?.creationTimestamp),
      creationTimestamp: pod.metadata?.creationTimestamp
    };
  },

  // --------------------------------------------------------------------------
  // DELETE POD
  // --------------------------------------------------------------------------
  deletePod: async (namespace, name) => {
    if (!isReady || !coreApi) {
      throw new Error('Kubernetes API client is not initialized.');
    }
    await coreApi.deleteNamespacedPod(name, namespace);
    return true;
  },

  // --------------------------------------------------------------------------
  // RESTART POD
  // Checks if pod is managed by a Deployment (via ReplicaSet ownerRef).
  // Only then allows deletion (K8s recreates it automatically).
  // --------------------------------------------------------------------------
  restartPod: async (namespace, name) => {
    if (!isReady || !coreApi) {
      throw new Error('Kubernetes API client is not initialized.');
    }

    const podRes = await coreApi.readNamespacedPod(name, namespace);
    const pod = podRes.body;
    const ownerRefs = pod.metadata?.ownerReferences || [];

    // Check ownership chain: Pod → ReplicaSet → Deployment
    const rsOwner = ownerRefs.find(r => r.kind === 'ReplicaSet');
    if (!rsOwner) {
      // Also allow StatefulSet pods (kind='StatefulSet')
      const ssOwner = ownerRefs.find(r => r.kind === 'StatefulSet');
      if (!ssOwner) {
        throw new Error(
          `Pod "${name}" is not managed by a Deployment or StatefulSet. ` +
          `Restart is only supported for pods owned by a controller.`
        );
      }
    }

    await coreApi.deleteNamespacedPod(name, namespace);
    return { restarted: true, message: `Pod "${name}" deleted; controller will recreate it.` };
  },

  // --------------------------------------------------------------------------
  // GET POD METRICS (all pods or per-namespace)
  // Returns N/A values if Metrics Server unavailable
  // --------------------------------------------------------------------------
  getPodMetrics: async (namespace = '') => {
    const metricsMap = await fetchPodMetricsMap(namespace);
    if (!metricsMap) {
      return { available: false, metrics: [] };
    }
    const metrics = [];
    for (const [key, val] of metricsMap.entries()) {
      const [ns, ...rest] = key.split('/');
      metrics.push({ namespace: ns, name: rest.join('/'), ...val });
    }
    return { available: true, metrics };
  },

  // --------------------------------------------------------------------------
  // CREATE POD
  // --------------------------------------------------------------------------
  createPod: async (namespace, podManifest) => {
    if (!isReady || !coreApi) {
      throw new Error('Kubernetes API client is not initialized.');
    }
    const res = await coreApi.createNamespacedPod(namespace, podManifest);
    return res.body;
  }
};
