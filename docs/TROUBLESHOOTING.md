# Troubleshooting

## API starts, but actor operations fail

The API logs initial MongoDB/Redis connection failures and still opens its HTTP
listener. Actor and coordination endpoints need the corresponding services.
Check the `.env` URLs, then inspect the containers:

```powershell
docker compose ps
docker compose logs mongodb redis api worker
```

For an API or worker launched directly with Node, use
`mongodb://127.0.0.1:27017/actorlab` and `redis://127.0.0.1:6379`; the Compose
services publish those ports on localhost. A process running inside the Compose
network must instead use `mongodb` and `redis` as the hostnames. The API and
worker in the Compose file are already configured with those service names.

The API retries failed initial MongoDB/Redis connections every five seconds.
Workers, in contrast, must connect to both before opening their HTTP server.

## "No live workers are registered"

Start a worker with `npm run worker`. Check that it can reach
`COORDINATOR_URL`, MongoDB, and Redis. The worker's advertised URL must be
reachable from the API; for local workers, set a unique `WORKER_ID` and
`WORKER_PORT` for each process. Worker heartbeats default to every 4 seconds
and are considered expired after 15 seconds. The registry prunes expired
entries while listing workers.

## Worker is registered but message requests time out

Confirm the advertised URL is correct from the API container/pod. In
Kubernetes, inspect `POD_IP`, `POD_NAME`, and the headless service
`actor-worker-headless`. Check `/health` on the worker and inspect its logs.
The default worker HTTP request timeout is 5 seconds.

## Stale ownership or migration errors

`409` responses can indicate a stale ownership generation, a conflicting
MongoDB version update, or a singleton fencing mismatch. Retry a transient
message conflict with the _same_ message ID. If an actor remains marked
`migrating`, check Redis and MongoDB availability and inspect worker/API logs.
The API waits briefly for migration to finish; it may return `503` if it does
not.

## Kubernetes page reports Local Development Mode

The Kubernetes client uses in-cluster configuration when both
`KUBERNETES_SERVICE_HOST` and `KUBERNETES_SERVICE_PORT` are set; otherwise, it
loads the default local kubeconfig. Verify `kubectl config current-context`,
the API pod's service account, and `k8s/05-rbac.yaml`. The API Role is limited
to the `actorlab` namespace, pod reads/logs, and `get`/`patch` on
`actor-worker`. Kubernetes API operations use a 3-second default timeout.

Local and Docker Compose runs need a usable default kubeconfig for Kubernetes
operations; the Compose setup does not provide Kubernetes credentials.

## Worker replica count changes, but actor routing does not

Scaling a Deployment changes Kubernetes replicas; it does not itself move
actor assignments. Wait for worker registration/heartbeats, then manually
trigger the application rebalancer. It uses actor counts, not pod CPU or
memory. It also excludes `GlobalSchedulerActor`.

## Dashboard error messages

Form submissions redirect back to the page with a query-string message.
`/cluster` shows Kubernetes connection details; `/workers` shows registry and
pod information. For API error response shapes and status codes, see the
[API reference](API_REFERENCE.md).

## Stop local services

`docker compose down` stops Compose services and preserves named volumes. Do
not remove volumes if you need the local MongoDB/Redis data.
