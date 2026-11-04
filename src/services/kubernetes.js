import { getKubeClients } from '../config/kubernetes.js';
const namespace = process.env.K8S_NAMESPACE || 'actorlab';
const deploymentName = process.env.WORKER_DEPLOYMENT || 'actor-worker';

export async function getClusterStatus() {
  const { clients, error } = getKubeClients();
  if (!clients)
    return {
      connected: false,
      mode: 'Local Development Mode',
      message: error?.message || 'Kubernetes client is not configured',
    };
  try {
    const query = async () => {
      const pods = await clients.core.listNamespacedPod({
        namespace,
        labelSelector: 'app=actor-worker',
      });
      let deployment = null;
      try {
        deployment = (
          await clients.apps.readNamespacedDeployment({
            name: deploymentName,
            namespace,
          })
        ).spec;
      } catch {}
      return {
        connected: true,
        mode: 'Kubernetes',
        message: deployment
          ? 'Connected to Kubernetes'
          : `Cluster reachable; ${deploymentName} Deployment was not found in ${namespace}`,
        pods: pods.items,
        deployment,
      };
    };
    let timer;
    return await Promise.race([
      query(),
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error('Kubernetes API request timed out')),
          Number(process.env.K8S_REQUEST_TIMEOUT_MS || 3000),
        );
      }),
    ]).finally(() => clearTimeout(timer));
  } catch (cause) {
    return {
      connected: false,
      mode: 'Local Development Mode',
      message: cause.message,
      pods: [],
    };
  }
}
export async function getPods() {
  const status = await getClusterStatus();
  return status.connected ? status.pods : [];
}
export async function getWorkers() {
  return (await getPods()).map((pod) => ({
    name: pod.metadata?.name,
    status: pod.status?.phase,
    ip: pod.status?.podIP,
    node: pod.spec?.nodeName,
  }));
}
export async function scaleWorkers(replicas) {
  const { clients } = getKubeClients();
  if (!clients)
    throw Object.assign(new Error('Kubernetes is unavailable'), {
      status: 503,
    });
  await clients.apps.patchNamespacedDeployment({
    name: deploymentName,
    namespace,
    body: [{ op: 'add', path: '/spec/replicas', value: replicas }],
  });
}
export async function getPodLogs(podName) {
  const { clients } = getKubeClients();
  if (!clients)
    throw Object.assign(new Error('Kubernetes is unavailable'), {
      status: 503,
    });
  const timeout = new Promise((_, reject) =>
    setTimeout(
      () =>
        reject(
          Object.assign(new Error('Kubernetes API request timed out'), {
            status: 504,
          }),
        ),
      Number(process.env.K8S_REQUEST_TIMEOUT_MS || 3000),
    ),
  );
  return Promise.race([
    clients.core.readNamespacedPodLog({
      name: podName,
      namespace,
      tailLines: 100,
    }),
    timeout,
  ]);
}
