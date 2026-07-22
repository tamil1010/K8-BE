import k8s from '@kubernetes/client-node';
import dotenv from 'dotenv';

dotenv.config();

// Initialize KubeConfig
let kc = new k8s.KubeConfig();
let isClusterHealthy = false;

// Create API Client instances
let k8sApi = null;
let appsApi = null;
let rbacApi = null;
let customObjectsApi = null;

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

export const reinitializeK8sConfig = () => {
  try {
    const newKc = new k8s.KubeConfig();
    if (process.env.KUBECONFIG) {
      newKc.loadFromFile(process.env.KUBECONFIG);
    } else {
      newKc.loadFromDefault();
    }
    kc = newKc;
    k8sApi = kc.makeApiClient(k8s.CoreV1Api);
    appsApi = kc.makeApiClient(k8s.AppsV1Api);
    rbacApi = kc.makeApiClient(k8s.RbacAuthorizationV1Api);
    customObjectsApi = kc.makeApiClient(k8s.CustomObjectsApi);
    
    updateSimNodesForContext(kc.getCurrentContext());
    checkClusterHealth();
    return true;
  } catch (err) {
    console.error('[K8sService] Reinitialize failed:', err.message);
    isClusterHealthy = false;
    return false;
  }
};

try {
  if (process.env.KUBECONFIG) {
    kc.loadFromFile(process.env.KUBECONFIG);
  } else {
    kc.loadFromDefault();
  }

  k8sApi = kc.makeApiClient(k8s.CoreV1Api);
  appsApi = kc.makeApiClient(k8s.AppsV1Api);
  rbacApi = kc.makeApiClient(k8s.RbacAuthorizationV1Api);
  customObjectsApi = kc.makeApiClient(k8s.CustomObjectsApi);
  
  updateSimNodesForContext(kc.getCurrentContext());
} catch (err) {
  console.warn('⚠️  Kubeconfig initialization failed. Defaulting to SIMULATOR mode.', err.message);
}

// Function to check if the Kubernetes API is reachable with a fast timeout
const checkClusterHealth = async () => {
  if (!k8sApi) {
    isClusterHealthy = false;
    return;
  }
  try {
    // Ping API by listing pods in default with a 1.5s timeout
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('K8s Connection Timeout')), 1500)
    );
    await Promise.race([
      k8sApi.listNamespacedPod('default'),
      timeoutPromise
    ]);
    
    if (!isClusterHealthy) {
      console.log('✅ Connected successfully to active Kubernetes cluster (e.g. Minikube).');
    }
    isClusterHealthy = true;
  } catch (err) {
    if (isClusterHealthy || isClusterHealthy === false) {
      // Print warning on first check or status shift
      console.warn(`⚠️  Could not connect to live Kubernetes cluster: ${err.message}. Operating in SIMULATOR fallback mode.`);
    }
    isClusterHealthy = false;
  }
};

// Check health immediately and check periodically
checkClusterHealth();
setInterval(checkClusterHealth, 15000);

// ============================================================================
// SIMULATION DATA STORAGE & LIFECYCLE (for offline fallback)
// ============================================================================

let simEvents = [
  { id: 1, time: new Date(Date.now() - 300000).toISOString(), resource: 'pod/frontend-v3-8f2ba', type: 'Normal', reason: 'Created', message: 'Created container frontend', namespace: 'default' },
  { id: 2, time: new Date(Date.now() - 280000).toISOString(), resource: 'pod/frontend-v3-8f2ba', type: 'Normal', reason: 'Started', message: 'Started container frontend', namespace: 'default' },
  { id: 3, time: new Date(Date.now() - 150000).toISOString(), resource: 'deployment/backend-api', type: 'Warning', reason: 'ScalingReplicaSet', message: 'Scaled replica set backend-api-5c7d8b from 2 to 3', namespace: 'production' },
  { id: 4, time: new Date(Date.now() - 60000).toISOString(), resource: 'node/worker-3', type: 'Warning', reason: 'KubeletNotReady', message: 'Container runtime network not ready', namespace: 'kube-system' },
];

let simPods = [
  { name: 'frontend-v3-8f2ba', namespace: 'default', status: 'Running', restarts: 0, cpu: '45m', memory: '128Mi', node: 'worker-1', creationTimestamp: new Date(Date.now() - 900000) },
  { name: 'frontend-v3-9a3cb', namespace: 'default', status: 'Running', restarts: 1, cpu: '48m', memory: '130Mi', node: 'worker-2', creationTimestamp: new Date(Date.now() - 900000) },
  { name: 'auth-service-7f89d-11', namespace: 'default', status: 'Running', restarts: 0, cpu: '12m', memory: '64Mi', node: 'worker-1', creationTimestamp: new Date(Date.now() - 200000000) },
  { name: 'auth-service-7f89d-22', namespace: 'default', status: 'Pending', restarts: 0, cpu: '0m', memory: '0Mi', node: 'worker-3', creationTimestamp: new Date(Date.now() - 12000) },
  
  { name: 'backend-api-5c7d8b-1', namespace: 'production', status: 'Running', restarts: 0, cpu: '115m', memory: '256Mi', node: 'worker-2', creationTimestamp: new Date(Date.now() - 18000000) },
  { name: 'backend-api-5c7d8b-2', namespace: 'production', status: 'Running', restarts: 2, cpu: '110m', memory: '240Mi', node: 'worker-3', creationTimestamp: new Date(Date.now() - 18000000) },
  { name: 'payment-svc-9f1aa', namespace: 'production', status: 'CrashLoopBackOff', restarts: 8, cpu: '15m', memory: '85Mi', node: 'worker-1', creationTimestamp: new Date(Date.now() - 5000000) },
  { name: 'db-postgres-0', namespace: 'production', status: 'Running', restarts: 0, cpu: '85m', memory: '512Mi', node: 'worker-3', creationTimestamp: new Date(Date.now() - 900000000) },
  
  { name: 'cache-redis-0', namespace: 'staging', status: 'Running', restarts: 0, cpu: '20m', memory: '96Mi', node: 'worker-1', creationTimestamp: new Date(Date.now() - 300000000) },
  { name: 'staging-api-bb77', namespace: 'staging', status: 'Completed', restarts: 0, cpu: '0m', memory: '16Mi', node: 'worker-2', creationTimestamp: new Date(Date.now() - 36000000) },
  
  { name: 'kube-apiserver-master', namespace: 'kube-system', status: 'Running', restarts: 0, cpu: '90m', memory: '340Mi', node: 'master-node', creationTimestamp: new Date(Date.now() - 1000000000) },
  { name: 'kube-proxy-w1', namespace: 'kube-system', status: 'Running', restarts: 0, cpu: '15m', memory: '48Mi', node: 'worker-1', creationTimestamp: new Date(Date.now() - 1000000000) },
  { name: 'coredns-78fcc-aa', namespace: 'kube-system', status: 'Running', restarts: 1, cpu: '8m', memory: '32Mi', node: 'master-node', creationTimestamp: new Date(Date.now() - 1000000000) }
];

let simDeployments = [
  { name: 'frontend-v3', namespace: 'default', replicasDesired: 2, replicasAvailable: 2, replicasUpdated: 2, creationTimestamp: new Date(Date.now() - 900000), health: 'Healthy' },
  { name: 'auth-service', namespace: 'default', replicasDesired: 2, replicasAvailable: 1, replicasUpdated: 2, creationTimestamp: new Date(Date.now() - 200000000), health: 'Degraded' },
  { name: 'backend-api', namespace: 'production', replicasDesired: 2, replicasAvailable: 2, replicasUpdated: 2, creationTimestamp: new Date(Date.now() - 18000000), health: 'Healthy' },
  { name: 'payment-svc', namespace: 'production', replicasDesired: 1, replicasAvailable: 0, replicasUpdated: 1, creationTimestamp: new Date(Date.now() - 5000000), health: 'Unhealthy' },
  { name: 'staging-api', namespace: 'staging', replicasDesired: 1, replicasAvailable: 1, replicasUpdated: 1, creationTimestamp: new Date(Date.now() - 36000000), health: 'Healthy' },
  { name: 'coredns', namespace: 'kube-system', replicasDesired: 2, replicasAvailable: 2, replicasUpdated: 2, creationTimestamp: new Date(Date.now() - 1000000000), health: 'Healthy' }
];

simNodes = [
  { name: 'master-node', status: 'Ready', cpuPercent: 32, memoryPercent: 64, version: 'v1.28.2', podsCount: 4 },
  { name: 'worker-1', status: 'Ready', cpuPercent: 68, memoryPercent: 78, version: 'v1.28.2', podsCount: 5 },
  { name: 'worker-2', status: 'Ready', cpuPercent: 42, memoryPercent: 55, version: 'v1.28.2', podsCount: 4 },
  { name: 'worker-3', status: 'Not Ready', cpuPercent: 0, memoryPercent: 0, version: 'v1.28.2', podsCount: 3 }
];

let simServices = [
  { name: 'kubernetes', namespace: 'default', type: 'ClusterIP', clusterIP: '10.96.0.1', externalIP: 'None', ports: '443/TCP', creationTimestamp: new Date(Date.now() - 1000000000) },
  { name: 'frontend-svc', namespace: 'default', type: 'NodePort', clusterIP: '10.96.12.80', externalIP: 'None', ports: '80:31080/TCP', creationTimestamp: new Date(Date.now() - 900000) },
  { name: 'backend-api-svc', namespace: 'production', type: 'ClusterIP', clusterIP: '10.96.45.101', externalIP: 'None', ports: '8080/TCP', creationTimestamp: new Date(Date.now() - 18000000) },
  { name: 'payment-lb', namespace: 'production', type: 'LoadBalancer', clusterIP: '10.96.50.200', externalIP: '34.120.45.89', ports: '80:32001/TCP', creationTimestamp: new Date(Date.now() - 5000000) },
  { name: 'redis-svc', namespace: 'staging', type: 'ClusterIP', clusterIP: '10.96.220.10', externalIP: 'None', ports: '6379/TCP', creationTimestamp: new Date(Date.now() - 300000000) },
  { name: 'kube-dns', namespace: 'kube-system', type: 'ClusterIP', clusterIP: '10.96.0.10', externalIP: 'None', ports: '53/UDP, 53/TCP', creationTimestamp: new Date(Date.now() - 1000000000) }
];

let simRbac = {
  roles: [
    { name: 'pod-reader', namespace: 'default', createdDate: '2026-06-01T08:00:00Z', permissions: 'pods (get, list, watch)' },
    { name: 'deployment-manager', namespace: 'production', createdDate: '2026-07-02T10:30:00Z', permissions: 'deployments, replicasets (create, update, patch, get, list)' },
    { name: 'cluster-admin', namespace: 'kube-system', createdDate: '2026-05-10T12:00:00Z', permissions: '* (*)' }
  ],
  bindings: [
    { name: 'read-pods-binding', namespace: 'default', createdDate: '2026-06-01T08:15:00Z', permissions: 'RoleRef: pod-reader, Subject: User(john)' },
    { name: 'prod-deploy-binding', namespace: 'production', createdDate: '2026-07-02T10:45:00Z', permissions: 'RoleRef: deployment-manager, Subject: Group(dev-team)' },
    { name: 'admin-binding', namespace: 'kube-system', createdDate: '2026-05-10T12:05:00Z', permissions: 'RoleRef: cluster-admin, Subject: ServiceAccount(admin-user)' }
  ],
  serviceAccounts: [
    { name: 'default', namespace: 'default', createdDate: '2026-05-01T00:00:00Z', permissions: 'Secrets: [default-token-xxxxx]' },
    { name: 'admin-user', namespace: 'kube-system', createdDate: '2026-05-10T11:55:00Z', permissions: 'Secrets: [admin-token-yyyyy]' },
    { name: 'api-service-sa', namespace: 'production', createdDate: '2026-07-15T09:20:00Z', permissions: 'Secrets: [api-sa-token-zzzzz]' }
  ]
};

// Periodic shifts to mock data for visualization
setInterval(() => {
  if (isClusterHealthy) return; // Only simulate shifts if offline
  
  // Oscillate node loads
  simNodes.forEach(node => {
    if (node.status === 'Ready') {
      node.cpuPercent = Math.max(10, Math.min(95, node.cpuPercent + (Math.floor(Math.random() * 9) - 4)));
      node.memoryPercent = Math.max(20, Math.min(98, node.memoryPercent + (Math.floor(Math.random() * 5) - 2)));
    }
  });

  // Randomly restart a simulator pod (10% chance)
  if (Math.random() < 0.10) {
    const running = simPods.filter(p => p.status === 'Running');
    if (running.length > 0) {
      const p = running[Math.floor(Math.random() * running.length)];
      p.restarts += 1;
      
      const newEvent = {
        id: Date.now(),
        time: new Date().toISOString(),
        resource: `pod/${p.name}`,
        type: 'Warning',
        reason: 'Restarted',
        message: `Container of Pod ${p.name} was restarted (restart count: ${p.restarts})`,
        namespace: p.namespace
      };
      simEvents.unshift(newEvent);
      if (simEvents.length > 15) simEvents.pop();
    }
  }
}, 5000);

// Helper to format Kubernetes age string
const getAge = (timestamp) => {
  if (!timestamp) return 'unknown';
  const start = new Date(timestamp);
  const diffMs = Date.now() - start.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHr / 24);

  if (diffDays > 0) return `${diffDays}d`;
  if (diffHr > 0) return `${diffHr}h`;
  if (diffMin > 0) return `${diffMin}m`;
  return `${diffSec}s`;
};

// ============================================================================
// CORE SERVICE FUNCTIONS
// ============================================================================

export const k8sService = {
  // Check if server is running in live or simulator mode
  isLive: () => isClusterHealthy,

  // Cluster Overview Stats
  getOverview: async () => {
    if (isClusterHealthy) {
      const [podsList, deplList, nodesList, svcsList] = await Promise.all([
        k8sApi.listPodForAllNamespaces(),
        appsApi.listDeploymentForAllNamespaces(),
        k8sApi.listNode(),
        k8sApi.listServiceForAllNamespaces()
      ]);

      const pods = podsList.body.items;
      const depls = deplList.body.items;
      const nodes = nodesList.body.items;
      const svcs = svcsList.body.items;

      return {
        pods: {
          running: pods.filter(p => p.status?.phase === 'Running').length,
          pending: pods.filter(p => p.status?.phase === 'Pending').length,
          failed: pods.filter(p => p.status?.phase === 'Failed' || p.status?.phase === 'CrashLoopBackOff').length,
          completed: pods.filter(p => p.status?.phase === 'Succeeded').length
        },
        deployments: {
          available: depls.filter(d => d.status?.conditions?.some(c => c.type === 'Available' && c.status === 'True')).length,
          unavailable: depls.filter(d => !d.status?.conditions?.some(c => c.type === 'Available' && c.status === 'True')).length
        },
        nodes: {
          ready: nodes.filter(n => n.status?.conditions?.some(c => c.type === 'Ready' && c.status === 'True')).length,
          notReady: nodes.filter(n => !n.status?.conditions?.some(c => c.type === 'Ready' && c.status === 'True')).length
        },
        services: {
          clusterIP: svcs.filter(s => s.spec?.type === 'ClusterIP').length,
          nodePort: svcs.filter(s => s.spec?.type === 'NodePort').length,
          loadBalancer: svcs.filter(s => s.spec?.type === 'LoadBalancer').length
        }
      };
    }

    // Simulator Fallback
    return {
      pods: {
        running: simPods.filter(p => p.status === 'Running').length,
        pending: simPods.filter(p => p.status === 'Pending').length,
        failed: simPods.filter(p => p.status === 'CrashLoopBackOff').length,
        completed: simPods.filter(p => p.status === 'Completed').length
      },
      deployments: {
        available: simDeployments.filter(d => d.health === 'Healthy').length,
        unavailable: simDeployments.filter(d => d.health !== 'Healthy').length
      },
      nodes: {
        ready: simNodes.filter(n => n.status === 'Ready').length,
        notReady: simNodes.filter(n => n.status !== 'Ready').length
      },
      services: {
        clusterIP: simServices.filter(s => s.type === 'ClusterIP').length,
        nodePort: simServices.filter(s => s.type === 'NodePort').length,
        loadBalancer: simServices.filter(s => s.type === 'LoadBalancer').length
      }
    };
  },

  // Pods resource fetching
  getPods: async (namespace = '') => {
    if (isClusterHealthy) {
      const res = namespace 
        ? await k8sApi.listNamespacedPod(namespace)
        : await k8sApi.listPodForAllNamespaces();

      const items = res.body.items;
      return items.map(p => {
        const containerStatuses = p.status?.containerStatuses || [];
        const restarts = containerStatuses.reduce((acc, c) => acc + c.restartCount, 0);
        
        // Compute CPU / Memory usage estimations or query Metrics
        return {
          name: p.metadata?.name || '',
          namespace: p.metadata?.namespace || '',
          status: p.status?.phase || 'Unknown',
          restarts,
          cpu: '10m', // default low placeholder if metrics missing
          memory: '45Mi',
          node: p.spec?.nodeName || 'none',
          age: getAge(p.metadata?.creationTimestamp)
        };
      });
    }

    // Simulator Fallback
    let list = [...simPods];
    if (namespace) list = list.filter(p => p.namespace === namespace);
    return list.map(p => ({
      name: p.name,
      namespace: p.namespace,
      status: p.status,
      restarts: p.restarts,
      cpu: p.cpu,
      memory: p.memory,
      node: p.node,
      age: getAge(p.creationTimestamp)
    }));
  },

  // Pod restart via direct deletion (Kubernetes recreates standard replica pods automatically)
  restartPod: async (namespace, name) => {
    if (isClusterHealthy) {
      await k8sApi.deleteNamespacedPod(name, namespace);
      return true;
    }

    // Simulator Fallback
    const podIdx = simPods.findIndex(p => p.name === name && p.namespace === namespace);
    if (podIdx !== -1) {
      simPods[podIdx].restarts += 1;
      simPods[podIdx].creationTimestamp = new Date();
      
      const newEvent = {
        id: Date.now(),
        time: new Date().toISOString(),
        resource: `pod/${name}`,
        type: 'Normal',
        reason: 'Restarted',
        message: `Admin/Developer requested manual restart of pod "${name}"`,
        namespace
      };
      simEvents.unshift(newEvent);
      return true;
    }
    throw new Error(`Pod "${name}" in namespace "${namespace}" not found.`);
  },

  // Deployments resource fetching
  getDeployments: async (namespace = '') => {
    if (isClusterHealthy) {
      const res = namespace 
        ? await appsApi.listNamespacedDeployment(namespace)
        : await appsApi.listDeploymentForAllNamespaces();

      return res.body.items.map(d => ({
        name: d.metadata?.name || '',
        namespace: d.metadata?.namespace || '',
        replicas: `${d.status?.availableReplicas || 0}/${d.status?.replicas || 0}`,
        available: d.status?.availableReplicas || 0,
        updated: d.status?.updatedReplicas || 0,
        age: getAge(d.metadata?.creationTimestamp)
      }));
    }

    // Simulator Fallback
    let list = [...simDeployments];
    if (namespace) list = list.filter(d => d.namespace === namespace);
    return list.map(d => ({
      name: d.name,
      namespace: d.namespace,
      replicas: `${d.replicasAvailable}/${d.replicasDesired}`,
      available: d.replicasAvailable,
      updated: d.replicasUpdated,
      age: getAge(d.creationTimestamp)
    }));
  },

  // Nodes resource fetching
  getNodes: async () => {
    if (isClusterHealthy) {
      const res = await k8sApi.listNode();
      return res.body.items.map(n => {
        const isReady = n.status?.conditions?.some(c => c.type === 'Ready' && c.status === 'True');
        return {
          name: n.metadata?.name || '',
          status: isReady ? 'Ready' : 'Not Ready',
          cpuPercent: 35, // fallback load metrics
          memoryPercent: 62,
          podsCount: 5,
          version: n.status?.nodeInfo?.kubeletVersion || 'unknown'
        };
      });
    }

    // Simulator Fallback
    return simNodes.map(n => ({
      name: n.name,
      status: n.status,
      cpuPercent: n.cpuPercent,
      memoryPercent: n.memoryPercent,
      podsCount: n.podsCount,
      version: n.version
    }));
  },

  // Services resource fetching
  getServices: async (namespace = '') => {
    if (isClusterHealthy) {
      const res = namespace
        ? await k8sApi.listNamespacedService(namespace)
        : await k8sApi.listServiceForAllNamespaces();

      return res.body.items.map(s => {
        const ports = s.spec?.ports?.map(p => `${p.port}:${p.nodePort || p.targetPort}/${p.protocol}`).join(', ') || '';
        return {
          name: s.metadata?.name || '',
          namespace: s.metadata?.namespace || '',
          type: s.spec?.type || 'ClusterIP',
          clusterIP: s.spec?.clusterIP || 'None',
          externalIP: s.status?.loadBalancer?.ingress?.[0]?.ip || 'None',
          ports
        };
      });
    }

    // Simulator Fallback
    let list = [...simServices];
    if (namespace) list = list.filter(s => s.namespace === namespace);
    return list.map(s => ({
      name: s.name,
      namespace: s.namespace,
      type: s.type,
      clusterIP: s.clusterIP,
      externalIP: s.externalIP,
      ports: s.ports
    }));
  },

  // RBAC Roles query
  getRoles: async () => {
    if (isClusterHealthy) {
      const res = await rbacApi.listClusterRole();
      return res.body.items.map(r => ({
        name: r.metadata?.name || '',
        namespace: r.metadata?.namespace || 'Cluster Scope',
        createdDate: r.metadata?.creationTimestamp || new Date(),
        permissions: r.rules?.map(rule => `${rule.resources?.join(',') || '*'} (${rule.verbs?.join(',')})`).slice(0, 2).join('; ') || ''
      }));
    }

    // Simulator Fallback
    return simRbac.roles;
  },

  // RBAC Role Bindings query
  getRoleBindings: async () => {
    if (isClusterHealthy) {
      const res = await rbacApi.listClusterRoleBinding();
      return res.body.items.map(b => ({
        name: b.metadata?.name || '',
        namespace: b.metadata?.namespace || 'Cluster Scope',
        createdDate: b.metadata?.creationTimestamp || new Date(),
        permissions: `RoleRef: ${b.roleRef?.name}, Subject: ${b.subjects?.[0]?.kind}(${b.subjects?.[0]?.name})`
      }));
    }

    // Simulator Fallback
    return simRbac.bindings;
  },

  // RBAC Service Accounts query
  getServiceAccounts: async () => {
    if (isClusterHealthy) {
      const res = await k8sApi.listServiceAccountForAllNamespaces();
      return res.body.items.map(sa => ({
        name: sa.metadata?.name || '',
        namespace: sa.metadata?.namespace || '',
        createdDate: sa.metadata?.creationTimestamp || new Date(),
        permissions: `Secrets: ${sa.secrets?.map(s => s.name).join(', ') || '[none]'}`
      }));
    }

    // Simulator Fallback
    return simRbac.serviceAccounts;
  },

  // System Event logs query
  getEvents: async () => {
    if (isClusterHealthy) {
      const res = await k8sApi.listEventForAllNamespaces();
      // Sort items by creationTimestamp or lastTimestamp
      const items = res.body.items.sort((a, b) => {
        const aTime = new Date(a.lastTimestamp || a.metadata?.creationTimestamp).getTime();
        const bTime = new Date(b.lastTimestamp || b.metadata?.creationTimestamp).getTime();
        return bTime - aTime;
      });

      return items.slice(0, 15).map(e => ({
        id: e.metadata?.uid || Math.random(),
        time: e.lastTimestamp || e.metadata?.creationTimestamp || new Date(),
        resource: `${e.involvedObject?.kind?.toLowerCase()}/${e.involvedObject?.name}`,
        type: e.type === 'Warning' ? 'Warning' : 'Normal',
        reason: e.reason || 'Unknown',
        message: e.message || '',
        namespace: e.metadata?.namespace || 'default'
      }));
    }

    // Simulator Fallback
    return simEvents;
  },

  // Metrics Server - Cluster CPU usage stats
  getCPUUsage: async () => {
    if (isClusterHealthy) {
      try {
        // Attempt query through custom APIs (metrics.k8s.io)
        const metricsRes = await customObjectsApi.listClusterCustomObject('metrics.k8s.io', 'v1beta1', 'nodes');
        const nodeMetrics = metricsRes.body.items || [];
        
        // Sum node CPU loads
        let totalUsed = 0;
        nodeMetrics.forEach(nm => {
          const rawCpu = nm.usage?.cpu || '0';
          // Convert nanocores to millicores (divide by 1,000,000)
          if (rawCpu.endsWith('n')) {
            totalUsed += parseInt(rawCpu) / 1000000;
          } else if (rawCpu.endsWith('u')) {
            totalUsed += parseInt(rawCpu) / 1000;
          } else {
            totalUsed += parseInt(rawCpu);
          }
        });

        // Sum overall capacities
        const nodesRes = await k8sApi.listNode();
        let totalCap = 0;
        nodesRes.body.items.forEach(node => {
          const cap = node.status?.capacity?.cpu || '1';
          totalCap += parseInt(cap) * 1000; // millicores
        });

        const percent = totalCap > 0 ? Math.round((totalUsed / totalCap) * 100) : 15;
        return { value: Math.max(1, Math.min(100, percent)) };
      } catch (err) {
        // Fallback calculation based on Node stats
        console.warn('Metrics Server Node API failed/uninstalled. Returning estimation.');
      }
    }

    // Simulator Fallback
    const activeNodes = simNodes.filter(n => n.status === 'Ready');
    const avgCpu = Math.round(activeNodes.reduce((acc, n) => acc + n.cpuPercent, 0) / activeNodes.length) || 12;
    return { value: avgCpu };
  },

  // Metrics Server - Cluster Memory usage stats
  getMemoryUsage: async () => {
    if (isClusterHealthy) {
      try {
        const metricsRes = await customObjectsApi.listClusterCustomObject('metrics.k8s.io', 'v1beta1', 'nodes');
        const nodeMetrics = metricsRes.body.items || [];

        let totalUsed = 0;
        nodeMetrics.forEach(nm => {
          const rawMem = nm.usage?.memory || '0';
          if (rawMem.endsWith('Ki')) {
            totalUsed += parseInt(rawMem) / 1024;
          } else if (rawMem.endsWith('Mi')) {
            totalUsed += parseInt(rawMem);
          } else if (rawMem.endsWith('Gi')) {
            totalUsed += parseInt(rawMem) * 1024;
          } else {
            totalUsed += parseInt(rawMem) / 1024 / 1024;
          }
        });

        const nodesRes = await k8sApi.listNode();
        let totalCap = 0;
        nodesRes.body.items.forEach(node => {
          const cap = node.status?.capacity?.memory || '1Ki';
          if (cap.endsWith('Ki')) {
            totalCap += parseInt(cap) / 1024;
          } else if (cap.endsWith('Mi')) {
            totalCap += parseInt(cap);
          } else if (cap.endsWith('Gi')) {
            totalCap += parseInt(cap) * 1024;
          }
        });

        const percent = totalCap > 0 ? Math.round((totalUsed / totalCap) * 100) : 48;
        return { value: Math.max(1, Math.min(100, percent)) };
      } catch (err) {
        // Fallback
      }
    }

    // Simulator Fallback
    const activeNodes = simNodes.filter(n => n.status === 'Ready');
    const avgMem = Math.round(activeNodes.reduce((acc, n) => acc + n.memoryPercent, 0) / activeNodes.length) || 45;
    return { value: avgMem };
  }
};
