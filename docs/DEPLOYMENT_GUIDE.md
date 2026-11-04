# Deployment guide

## Prerequisites

- Node.js 20+ and npm for local execution.
- MongoDB and Redis endpoints reachable by both API and worker.
- Docker for Compose and image builds.
- `kubectl` and a reachable Kubernetes cluster for the Kubernetes setup.

## Local Node processes

```powershell
npm install
Copy-Item .env.example .env
docker compose up -d mongodb redis
npm start
```

In another PowerShell terminal:

```powershell
npm run worker
```

The API listens on port 3000 by default; the worker listens on 3101. Configure
`.env` using [Configuration](CONFIGURATION.md). For multiple workers, assign
unique IDs/ports and set a host that the API can reach.

## Docker Compose

```powershell
docker compose up --build
```

Compose starts `mongodb`, `redis`, `api`, and one `worker`. The API is published
on host port 3000; worker port 3101 is exposed only inside the Compose network.
MongoDB and Redis use named data volumes. `docker compose down` stops services
but preserves those volumes.

The Compose file does not configure MongoDB or Redis authentication. It is
development configuration only.

## Build and run containers separately

The repository's Dockerfile builds `actorlab:latest`, installs production
dependencies, and defaults to `npm start`. The worker image uses a command
override, as Compose and Kubernetes do:

```powershell
docker build -t actorlab:latest .
```

Container configuration must provide reachable `MONGODB_URI` and `REDIS_URL`.
The image exposes ports 3000 and 3101.

## Minikube / Kubernetes

The checked-in manifests define namespace `actorlab`, a sample connection
Secret, app ConfigMap, MongoDB and Redis Deployments/Services, API RBAC, API
Deployment/NodePort Service, and a two-replica worker Deployment/headless
Service.

For Minikube:

```powershell
minikube start
docker build -t actorlab:latest .
minikube image load actorlab:latest
kubectl apply -f k8s/
kubectl -n actorlab get deployments,pods,services
kubectl -n actorlab port-forward service/actorlab-api 3000:3000
```

Open <http://localhost:3000>. If using a different cluster, ensure the
`actorlab:latest` image is available to its nodes (push it to an accessible
registry and update manifests as appropriate). The supplied Secret uses
unauthenticated service URLs; replace it with an appropriate secret-management
process before any shared cluster deployment.

Scale from Kubernetes:

```powershell
kubectl -n actorlab scale deployment/actor-worker --replicas=3
kubectl -n actorlab get pods -l app=actor-worker -o wide
```

The application Cluster page can also request 0–50 replicas. Replica changes
do not automatically invoke ActorLab rebalancing.

## Cleanup

Stop Compose without removing data:

```powershell
docker compose down
```

Remove the sample Kubernetes resources:

```powershell
kubectl delete -f k8s/
```

Kubernetes deletion can remove the MongoDB PVC/resource depending on the
cluster's reclaim behavior. Confirm whether data must be retained before
cleanup. The commands above are setup guidance; they do not imply a deployment
was run or verified in a user's cluster.
