import * as k8s from '@kubernetes/client-node';
import dotenv from 'dotenv';

dotenv.config();

let kc = new k8s.KubeConfig();
let coreApi = null;
let customObjectsApi = null;
let isReady = false;
let simNodes = [];

const updateSimNodesForContext = (context) => {
  if (context === 'docker-desktop') {
    simNodes = [
      { name: 'desktop-control-plane', status: 'Ready', cpuPercent: 28, memoryPercent: 55, version: 'v1.30.1', podsCount: 3 }
    ];
  } else if (context === 'kind-k8-dashboard') {
    simNodes = [
      { name: 'k8-dashboard-control-plane', status: 'Ready', cpuPercent: 15, memoryPercent: 40, version: 'v1.30.1', podsCount: 2 },
      { name: 'k8-dashboard-worker', status: 'Ready', cpuPercent: 45, memoryPercent: 60, version: 'v1.30.1', podsCount: 6 },
      { name: 'k8-dashboard-worker2', status: 'Ready', cpuPercent: 35, memoryPercent: 50, version: 'v1.30.1', podsCount: 5 }
    ];
  } else if (context === 'minikube') {
    simNodes = [
      { name: 'minikube', status: 'Ready', cpuPercent: 22, memoryPercent: 48, version: 'v1.28.3', podsCount: 4 }
    ];
  } else {
    simNodes = [
      { name: 'master-node', status: 'Ready', cpuPercent: 32, memoryPercent: 64, version: 'v1.28.2', podsCount: 4 },
      { name: 'worker-1', status: 'Ready', cpuPercent: 68, memoryPercent: 78, version: 'v1.28.2', podsCount: 5 },
      { name: 'worker-2', status: 'Ready', cpuPercent: 42, memoryPercent: 55, version: 'v1.28.2', podsCount: 4 },
      { name: 'worker-3', status: 'Not Ready', cpuPercent: 0, memoryPercent: 0, version: 'v1.28.2', podsCount: 3 }
    ];
  }
};

export const reinitializeNodeConfig = () => {
  try {
    const newKc = new k8s.KubeConfig();
    if (process.env.KUBECONFIG) {
      newKc.loadFromFile(process.env.KUBECONFIG);
    } else {
      newKc.loadFromDefault();
    }
    kc = newKc;
    coreApi = kc.makeApiClient(k8s.CoreV1Api);
    customObjectsApi = kc.makeApiClient(k8s.CustomObjectsApi);
    isReady = true;
    updateSimNodesForContext(kc.getCurrentContext());
    return true;
  } catch (err) {
    console.warn(JSON.stringify({
      level: 'warn',
      service: 'NodeService',
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
  customObjectsApi = kc.makeApiClient(k8s.CustomObjectsApi);
  isReady = true;
  updateSimNodesForContext(kc.getCurrentContext());
} catch (err) {
  console.warn(JSON.stringify({
    level: 'warn',
    service: 'NodeService',
    message: `KubeConfig init failed: ${err.message}`
  }));
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

// Parse K8s CPU capacities (e.g. "4", "4000m") to cores (float)
const parseCpuToCores = (raw = '0') => {
  if (!raw) return 0;
  if (raw.endsWith('m')) return parseInt(raw) / 1000;
  if (raw.endsWith('u')) return parseInt(raw) / 1_000_000;
  if (raw.endsWith('n')) return parseInt(raw) / 1_000_000_000;
  return parseFloat(raw);
};

// Parse K8s Memory (e.g. "16382020Ki", "16Gi", "16Mi") to MiB (float)
const parseMemoryToMiB = (raw = '0') => {
  if (!raw) return 0;
  const num = parseFloat(raw);
  if (raw.endsWith('Ki')) return num / 1024;
  if (raw.endsWith('Mi')) return num;
  if (raw.endsWith('Gi')) return num * 1024;
  if (raw.endsWith('Ti')) return num * 1024 * 1024;
  return num / (1024 * 1024); // default bytes to MiB
};

const formatCpuCores = (cores) => {
  if (cores === null || cores === undefined) return 'N/A';
  return `${cores.toFixed(1)} Cores`;
};

const formatMemoryMiB = (mib) => {
  if (mib === null || mib === undefined) return 'N/A';
  if (mib < 1024) return `${Math.round(mib)} MiB`;
  return `${(mib / 1024).toFixed(1)} GiB`;
};

const getNodeRole = (node) => {
  const labels = node.metadata?.labels || {};
  if ('node-role.kubernetes.io/control-plane' in labels || 'node-role.kubernetes.io/master' in labels) {
    return 'Control Plane';
  }
  return 'Worker';
};

const getNodeStatus = (node) => {
  const conditions = node.status?.conditions || [];
  const readyCond = conditions.find(c => c.type === 'Ready');
  return readyCond && readyCond.status === 'True' ? 'Ready' : 'Not Ready';
};

// Fetch Node metrics map from metrics server
const fetchNodeMetricsMap = async () => {
  if (!isReady || !customObjectsApi) return null;
  try {
    const res = await customObjectsApi.listClusterCustomObject('metrics.k8s.io', 'v1beta1', 'nodes');
    const items = res.body?.items || [];
    const map = new Map();
    for (const item of items) {
      const name = item.metadata?.name;
      const cpuRaw = item.usage?.cpu || '0';
      const memRaw = item.usage?.memory || '0';
      map.set(name, {
        cpuCores: parseCpuToCores(cpuRaw),
        memMiB: parseMemoryToMiB(memRaw)
      });
    }
    return map;
  } catch (_err) {
    return null;
  }
};

export const nodeService = {
  getNodes: async () => {
    if (!isReady || !coreApi) {
      return simNodes.map(n => ({
        name: n.name,
        status: n.status,
        role: n.name.includes('control-plane') || n.name.includes('master') || n.name.includes('minikube') ? 'Control Plane' : 'Worker',
        version: n.version,
        os: 'Ubuntu 22.04.2 LTS',
        runtime: 'containerd://1.7.1',
        internalIP: '192.168.49.2',
        cpuCapacity: '4.0 Cores',
        cpuAllocatable: '4.0 Cores',
        cpuUsagePct: n.cpuPercent,
        memoryCapacity: '15.9 GiB',
        memoryAllocatable: '15.9 GiB',
        memUsagePct: n.memoryPercent,
        podCount: n.podsCount,
        age: '12d',
        creationTimestamp: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString()
      }));
    }

    const [nodesRes, metricsMap, podsRes] = await Promise.all([
      coreApi.listNode(),
      fetchNodeMetricsMap(),
      coreApi.listPodForAllNamespaces()
    ]);

    const nodes = nodesRes.body?.items || [];
    const pods = podsRes.body?.items || [];

    // Debugging log for raw Kubernetes nodes
    console.log("=== RAW KUBERNETES NODES ===");
    console.log(JSON.stringify(nodes, null, 2));

    // Group running/pending pods count by Node
    const podCountMap = new Map();
    pods.forEach(pod => {
      const nodeName = pod.spec?.nodeName;
      if (nodeName) {
        podCountMap.set(nodeName, (podCountMap.get(nodeName) || 0) + 1);
      }
    });

    return nodes.map((node) => {
      const name = node.metadata?.name || 'N/A';
      const status = getNodeStatus(node) || 'Unknown';
      const role = getNodeRole(node) || 'Worker';
      const version = node.status?.nodeInfo?.kubeletVersion || 'N/A';
      const os = node.status?.nodeInfo?.osImage || 'N/A';
      const runtime = node.status?.nodeInfo?.containerRuntimeVersion || 'N/A';
      
      const addresses = node.status?.addresses || [];
      const ipAddr = addresses.find(a => a.type === 'InternalIP');
      const internalIP = ipAddr ? ipAddr.address : 'N/A';

      const cpuCap = parseCpuToCores(node.status?.capacity?.cpu);
      const memCap = parseMemoryToMiB(node.status?.capacity?.memory);

      const cpuAlloc = parseCpuToCores(node.status?.allocatable?.cpu);
      const memAlloc = parseMemoryToMiB(node.status?.allocatable?.memory);

      const nodeMetrics = metricsMap?.get(name);
      
      let cpuUsagePct = 'N/A';
      let memUsagePct = 'N/A';

      if (nodeMetrics) {
        if (cpuAlloc > 0 && nodeMetrics.cpuCores !== undefined && nodeMetrics.cpuCores !== null) {
          cpuUsagePct = Math.round((nodeMetrics.cpuCores / cpuAlloc) * 100);
        }
        if (memAlloc > 0 && nodeMetrics.memMiB !== undefined && nodeMetrics.memMiB !== null) {
          memUsagePct = Math.round((nodeMetrics.memMiB / memAlloc) * 100);
        }
      }

      return {
        name,
        status,
        role,
        version,
        os,
        runtime,
        internalIP,
        cpuCapacity: formatCpuCores(cpuCap),
        cpuAllocatable: formatCpuCores(cpuAlloc),
        cpuUsagePct,
        memoryCapacity: formatMemoryMiB(memCap),
        memoryAllocatable: formatMemoryMiB(memAlloc),
        memUsagePct,
        podCount: podCountMap.get(name) || 0,
        age: getAge(node.metadata?.creationTimestamp),
        creationTimestamp: node.metadata?.creationTimestamp
      };
    });
  },

  getNode: async (name) => {
    if (!isReady || !coreApi) {
      // Simulator Fallback
      return {
        name,
        status: "Ready",
        role: name.includes("control-plane") || name.includes("master") || name.includes("minikube") ? "Control Plane" : "Worker",
        labels: {
          "kubernetes.io/arch": "amd64",
          "kubernetes.io/os": "linux",
          "kubernetes.io/hostname": name,
          "node.kubernetes.io/instance-type": "k8s-medium"
        },
        annotations: {
          "kubeadm.alpha.kubernetes.io/cri-socket": "unix:///var/run/containerd/containerd.sock",
          "node.alpha.kubernetes.io/ttl": "0"
        },
        internalIP: "192.168.49.2",
        hostname: name,
        osImage: "Ubuntu 22.04.2 LTS",
        architecture: "amd64",
        kernelVersion: "5.15.0-76-generic",
        containerRuntimeVersion: "containerd://1.7.1",
        kubeletVersion: "v1.30.1",
        kubeProxyVersion: "v1.30.1",
        creationTimestamp: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(),
        age: "12d",
        conditions: [
          { type: "Ready", status: "True", reason: "KubeletReady", message: "kubelet is posting ready status" },
          { type: "MemoryPressure", status: "False", reason: "KubeletHasNoMemoryPressure", message: "kubelet has no memory pressure" },
          { type: "DiskPressure", status: "False", reason: "KubeletHasNoDiskPressure", message: "kubelet has no disk pressure" },
          { type: "PIDPressure", status: "False", reason: "KubeletHasNoPIDPressure", message: "kubelet has no PID pressure" },
          { type: "NetworkUnavailable", status: "False", reason: "RouteCreated", message: "RouteController created a route" }
        ],
        cpuCapacity: "4.0 Cores",
        cpuAllocatable: "4.0 Cores",
        cpuUsageCores: "1.24",
        memoryCapacity: "15.9 GiB",
        memoryAllocatable: "15.9 GiB",
        memoryUsageMiB: "6240",
        ephemeralStorage: "45.2 GiB",
        maxPods: 110,
        runningPods: 12,
        cpuUsagePct: 31,
        memUsagePct: 39,
        taints: [
          { key: "node-role.kubernetes.io/control-plane", effect: "NoSchedule" }
        ],
        systemInfo: {
          machineID: "c18a5624792c4179bc8f8c2b74052601",
          bootID: "3ea4d693-1bc2-4c28-87ee-bc4f1aef2a1c",
          systemUUID: "8B4F1AEC-93BD-4456-78CD-BC4F1AEF2A1C"
        },
        events: [
          { type: "Normal", reason: "Starting", message: "Starting kubelet.", age: "12d" },
          { type: "Normal", reason: "NodeReady", message: "Node ready status is True.", age: "12d" }
        ]
      };
    }

    const [nodeRes, metricsMap, eventsRes, podsRes] = await Promise.all([
      coreApi.readNode(name),
      fetchNodeMetricsMap(),
      coreApi.listEventForAllNamespaces(undefined, undefined, undefined, `involvedObject.name=${name}`),
      coreApi.listPodForAllNamespaces(undefined, undefined, undefined, `spec.nodeName=${name}`)
    ]);

    const node = nodeRes.body;
    const nodeMetrics = metricsMap?.get(name);

    const conditions = (node.status?.conditions || []).map(c => ({
      type: c.type,
      status: c.status,
      reason: c.reason || 'N/A',
      message: c.message || 'N/A'
    }));

    const addresses = node.status?.addresses || [];
    const hostnameAddr = addresses.find(a => a.type === 'Hostname');
    const ipAddr = addresses.find(a => a.type === 'InternalIP');
    const extIpAddr = addresses.find(a => a.type === 'ExternalIP');

    const cpuCap = parseCpuToCores(node.status?.capacity?.cpu);
    const memCap = parseMemoryToMiB(node.status?.capacity?.memory);
    const cpuAlloc = parseCpuToCores(node.status?.allocatable?.cpu);
    const memAlloc = parseMemoryToMiB(node.status?.allocatable?.memory);

    const ephemeralCap = parseMemoryToMiB(node.status?.capacity?.['ephemeral-storage']);
    const ephemeralAlloc = parseMemoryToMiB(node.status?.allocatable?.['ephemeral-storage']);

    const events = (eventsRes.body?.items || [])
      .sort((a, b) => new Date(b.lastTimestamp || 0) - new Date(a.lastTimestamp || 0))
      .slice(0, 10)
      .map(e => ({
        type: e.type,
        reason: e.reason,
        message: e.message,
        age: getAge(e.lastTimestamp || e.metadata?.creationTimestamp)
      }));

    const maxPods = parseInt(node.status?.capacity?.pods) || 110;
    const runningPods = (podsRes.body?.items || []).filter(p => p.status?.phase === 'Running').length;

    let cpuUsagePct = 'N/A';
    let memUsagePct = 'N/A';
    if (nodeMetrics) {
      if (cpuAlloc > 0) cpuUsagePct = Math.round((nodeMetrics.cpuCores / cpuAlloc) * 100);
      if (memAlloc > 0) memUsagePct = Math.round((nodeMetrics.memMiB / memAlloc) * 100);
    }

    return {
      name: node.metadata?.name,
      status: getNodeStatus(node),
      role: getNodeRole(node),
      labels: node.metadata?.labels || {},
      annotations: node.metadata?.annotations || {},
      internalIP: ipAddr ? ipAddr.address : 'N/A',
      externalIP: extIpAddr ? extIpAddr.address : 'N/A',
      hostname: hostnameAddr ? hostnameAddr.address : 'N/A',
      osImage: node.status?.nodeInfo?.osImage || 'N/A',
      architecture: node.status?.nodeInfo?.architecture || 'N/A',
      kernelVersion: node.status?.nodeInfo?.kernelVersion || 'N/A',
      containerRuntimeVersion: node.status?.nodeInfo?.containerRuntimeVersion || 'N/A',
      kubeletVersion: node.status?.nodeInfo?.kubeletVersion || 'N/A',
      kubeProxyVersion: node.status?.nodeInfo?.kubeProxyVersion || 'N/A',
      creationTimestamp: node.metadata?.creationTimestamp,
      conditions,
      cpuCapacity: formatCpuCores(cpuCap),
      cpuAllocatable: formatCpuCores(cpuAlloc),
      cpuUsageCores: nodeMetrics ? nodeMetrics.cpuCores.toFixed(2) : null,
      memoryCapacity: formatMemoryMiB(memCap),
      memoryAllocatable: formatMemoryMiB(memAlloc),
      memoryUsageMiB: nodeMetrics ? nodeMetrics.memMiB : null,
      ephemeralStorage: formatMemoryMiB(ephemeralCap),
      maxPods,
      runningPods,
      cpuUsagePct,
      memUsagePct,
      taints: (node.spec?.taints || []).map(t => ({ key: t.key, value: t.value, effect: t.effect })),
      systemInfo: {
        machineID: node.status?.nodeInfo?.machineID || 'N/A',
        bootID: node.status?.nodeInfo?.bootID || 'N/A',
        systemUUID: node.status?.nodeInfo?.systemUUID || 'N/A'
      },
      events
    };
  },

  getNodeYaml: async (name) => {
    if (isReady && coreApi) {
      const res = await coreApi.readNode(name);
      return res.body;
    }
    // Simulator fallback Node YAML JSON
    return {
      apiVersion: "v1",
      kind: "Node",
      metadata: {
        name,
        creationTimestamp: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(),
        labels: {
          "kubernetes.io/arch": "amd64",
          "kubernetes.io/os": "linux",
          "kubernetes.io/hostname": name
        }
      },
      spec: {
        podCIDR: "10.244.0.0/24",
        podCIDRs: ["10.244.0.0/24"]
      },
      status: {
        nodeInfo: {
          machineID: "c18a5624792c4179bc8f8c2b74052601",
          bootID: "3ea4d693-1bc2-4c28-87ee-bc4f1aef2a1c",
          kernelVersion: "5.15.0-76-generic",
          osImage: "Ubuntu 22.04.2 LTS",
          containerRuntimeVersion: "containerd://1.7.1",
          kubeletVersion: "v1.30.1"
        }
      }
    };
  },

  getNodeEvents: async (name) => {
    if (isReady && coreApi) {
      const eventsRes = await coreApi.listEventForAllNamespaces(undefined, undefined, undefined, `involvedObject.name=${name}`);
      return (eventsRes.body?.items || [])
        .sort((a, b) => new Date(b.lastTimestamp || 0) - new Date(a.lastTimestamp || 0))
        .map(e => ({
          type: e.type || 'Normal',
          reason: e.reason || 'N/A',
          message: e.message || 'N/A',
          count: e.count || 1,
          lastSeen: getAge(e.lastTimestamp || e.metadata?.creationTimestamp)
        }));
    }
    return [
      { type: "Normal", reason: "Starting", message: "Starting kubelet.", count: 1, lastSeen: "12d" },
      { type: "Normal", reason: "NodeReady", message: "Node ready status is True.", count: 1, lastSeen: "12d" }
    ];
  },

  describeNode: async (name) => {
    const details = await nodeService.getNode(name);
    return `Name:               ${details.name}
Roles:              ${details.role}
Labels:             ${Object.entries(details.labels || {}).map(([k, v]) => `${k}=${v}`).join('\n                    ')}
Annotations:        ${Object.entries(details.annotations || {}).map(([k, v]) => `${k}=${v}`).join('\n                    ')}
CreationTimestamp:  ${details.creationTimestamp}
Taints:             ${(details.taints || []).map(t => `${t.key}:${t.effect}`).join(', ') || '<none>'}
Unschedulable:      false
Conditions:
  Type             Status  LastHeartbeatTime                 LastTransitionTime                Reason                     Message
  ----             ------  -----------------                 ------------------                ------                     -------
${(details.conditions || []).map(c => `  ${c.type.padEnd(16)} ${c.status.padEnd(7)} ${new Date().toISOString()}  ${new Date().toISOString()}  ${c.reason.padEnd(26)} ${c.message}`).join('\n')}
Addresses:
  InternalIP:      ${details.internalIP}
  Hostname:        ${details.hostname}
Capacity:
  cpu:             ${details.cpuCapacity}
  memory:          ${details.memoryCapacity}
  pods:            ${details.maxPods || 110}
Allocatable:
  cpu:             ${details.cpuAllocatable}
  memory:          ${details.memoryAllocatable}
  pods:            ${details.maxPods || 110}
System Info:
  Machine ID:                 ${details.systemInfo?.machineID || 'N/A'}
  Boot ID:                    ${details.systemInfo?.bootID || 'N/A'}
  System UUID:                ${details.systemInfo?.systemUUID || 'N/A'}
  Kernel Version:             ${details.kernelVersion}
  OS Image:                   ${details.osImage}
  Container Runtime Version:  ${details.containerRuntimeVersion}
  Kubelet Version:            ${details.kubeletVersion}
  Kube-Proxy Version:         ${details.kubeProxyVersion}
Non-terminated Pods:
  Total Running Pods:         ${details.runningPods || 0}
Events:
  Type    Reason  Age   From font  Message
  ----    ------  ---   ---------  -------
${(details.events || []).map(e => `  ${(e.type || 'Normal').padEnd(7)} ${(e.reason || 'N/A').padEnd(7)} ${(e.age || 'N/A').padEnd(5)} kubelet    ${e.message}`).join('\n')}
`;
  },

  getNodeMetrics: async (name) => {
    if (isReady && customObjectsApi) {
      try {
        const metricsRes = await customObjectsApi.listClusterCustomObject('metrics.k8s.io', 'v1beta1', 'nodes');
        const item = (metricsRes.body.items || []).find(n => n.metadata?.name === name);
        if (item) {
          const cpuRaw = item.usage?.cpu || '0';
          const memRaw = item.usage?.memory || '0';
          return {
            cpuCores: parseCpuToCores(cpuRaw),
            memMiB: parseMemoryToMiB(memRaw)
          };
        }
      } catch (_) {
        // Fall through
      }
    }
    // Simulator/missing fallback
    return null;
  },

  getNodePods: async (name) => {
    if (!isReady || !coreApi) {
      // Simulator Fallback
      return [
        { name: "frontend-v3-8f2ba", namespace: "default", status: "Running", restarts: 0, age: "4h" },
        { name: "backend-api-5c7d8b-1", namespace: "production", status: "Running", restarts: 2, age: "12d" }
      ];
    }

    // Filter pods executing on this node
    const res = await coreApi.listPodForAllNamespaces(undefined, undefined, undefined, `spec.nodeName=${name}`);
    const items = res.body?.items || [];

    const getTotalRestarts = (pod) => {
      const cs = pod.status?.containerStatuses || [];
      return cs.reduce((acc, c) => acc + (c.restartCount || 0), 0);
    };

    return items.map(pod => ({
      name: pod.metadata?.name || '',
      namespace: pod.metadata?.namespace || '',
      status: pod.status?.phase || 'Unknown',
      restarts: getTotalRestarts(pod),
      age: getAge(pod.metadata?.creationTimestamp)
    }));
  },

  cordonNode: async (name) => {
    if (!isReady || !coreApi) {
      const node = simNodes.find(n => n.name === name);
      if (node) node.status = 'Not Ready';
      return { success: true, message: `Node ${name} cordoned (simulated).` };
    }
    const patch = [{ op: 'replace', path: '/spec/unschedulable', value: true }];
    const options = { headers: { 'Content-Type': 'application/json-patch+json' } };
    await coreApi.patchNode(name, patch, undefined, undefined, undefined, undefined, options);
    return { success: true };
  },

  uncordonNode: async (name) => {
    if (!isReady || !coreApi) {
      const node = simNodes.find(n => n.name === name);
      if (node) node.status = 'Ready';
      return { success: true, message: `Node ${name} uncordoned (simulated).` };
    }
    const patch = [{ op: 'replace', path: '/spec/unschedulable', value: false }];
    const options = { headers: { 'Content-Type': 'application/json-patch+json' } };
    await coreApi.patchNode(name, patch, undefined, undefined, undefined, undefined, options);
    return { success: true };
  },

  drainNode: async (name) => {
    if (!isReady || !coreApi) {
      const node = simNodes.find(n => n.name === name);
      if (node) {
        node.status = 'Not Ready';
        node.podsCount = 0;
      }
      return { success: true, message: `Node ${name} drained (simulated).` };
    }
    const patch = [{ op: 'replace', path: '/spec/unschedulable', value: true }];
    const options = { headers: { 'Content-Type': 'application/json-patch+json' } };
    await coreApi.patchNode(name, patch, undefined, undefined, undefined, undefined, options);

    const podsRes = await coreApi.listPodForAllNamespaces(undefined, undefined, undefined, `spec.nodeName=${name}`);
    const pods = podsRes.body?.items || [];

    for (const pod of pods) {
      const isMirrorPod = pod.metadata?.annotations?.['kubernetes.io/config.mirror'] !== undefined;
      const isDaemonSet = pod.metadata?.ownerReferences?.some(ref => ref.kind === 'DaemonSet');
      
      if (!isMirrorPod && !isDaemonSet) {
        const podName = pod.metadata?.name;
        const namespace = pod.metadata?.namespace;
        if (podName && namespace) {
          await coreApi.deleteNamespacedPod(podName, namespace);
        }
      }
    }
    return { success: true };
  },

  deleteNode: async (name) => {
    if (!isReady || !coreApi) {
      simNodes = simNodes.filter(n => n.name !== name);
      return { success: true, message: `Node ${name} deleted (simulated).` };
    }
    await coreApi.deleteNode(name);
    return { success: true };
  }
};
