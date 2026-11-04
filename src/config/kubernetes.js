import { KubeConfig, CoreV1Api, AppsV1Api } from '@kubernetes/client-node';

let clients;
let connectionError;
export function getKubeClients() {
  if (clients || connectionError) return { clients, error: connectionError };
  try {
    const config = new KubeConfig();
    try {
      config.loadFromCluster();
    } catch {
      config.loadFromDefault();
    }
    clients = {
      core: config.makeApiClient(CoreV1Api),
      apps: config.makeApiClient(AppsV1Api),
    };
  } catch (error) {
    connectionError = error;
  }
  return { clients, error: connectionError };
}
