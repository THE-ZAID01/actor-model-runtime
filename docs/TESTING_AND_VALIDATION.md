# Testing and validation

## Automated checks in the repository

The `package.json` defines `start`, `dev`, `worker`, and `format`; it does not
define a test command, and there is no checked-in automated test suite. Do not
report the scenarios below as executed unless you actually run them and retain
evidence. The expected results are derived from the implementation, not test
results.

## Manual scenarios

Start MongoDB and Redis (`docker compose up -d mongodb redis`), the API
(`npm start`), and at least one worker (`npm run worker`) before testing actor
features. HTTP examples use PowerShell's `Invoke-RestMethod`.

### 1. Application startup

- **Objective:** Confirm API and worker listeners start.
- **Steps:** Start dependencies, then run `npm start` and `npm run worker` in
  separate terminals.
- **Expected:** API logs its listening URL; worker logs its worker ID and port.

### 2. MongoDB and Redis connectivity

- **Objective:** Check database-backed and coordination-backed access.
- **Steps:** Call `GET http://localhost:3000/api/health`, then
  `GET http://localhost:3000/api/workers`.
- **Expected:** Health returns `{"ok":true,"service":"actorlab-api"}`; worker
  listing returns a JSON array once the worker has registered.

### 3. Actor creation

- **Objective:** Register a logical actor.
- **Steps:**

  ```powershell
  Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/actors `
    -ContentType 'application/json' `
    -Body '{"actorId":"counter-demo","actorType":"CounterActor"}'
  ```

- **Expected:** HTTP 201 and a created actor record, initially with
  `{ "count": 0 }`, an assigned worker, `idle` status, version 0, and ownership
  generation 1.

### 4. Message processing and 5. state persistence

- **Objective:** Apply an operation, read the result, and verify state in the
  actor record.
- **Steps:**

  ```powershell
  Invoke-RestMethod -Method Post `
    -Uri http://localhost:3000/api/actors/counter-demo/messages `
    -ContentType 'application/json' `
    -Body '{"operation":"increment","payload":{"amount":2},"messageId":"demo-1"}'
  Invoke-RestMethod -Uri http://localhost:3000/api/actors/counter-demo
  ```

- **Expected:** The message result and persisted state report count 2; actor
  version increments. Restarting a worker should not erase the MongoDB state.

### 6. Multiple worker registration

- **Objective:** Confirm distinct workers appear in Redis-backed registry.
- **Steps:** Start additional workers with unique `WORKER_ID` and
  `WORKER_PORT`, then call `GET /api/workers`.
- **Expected:** Each live registration appears with a recent heartbeat.

### 7. Message routing

- **Objective:** Confirm an actor request reaches its currently assigned
  worker.
- **Steps:** Inspect the actor's `workerId` in `GET /api/actors/:id`; submit a
  message and inspect worker/API logs and actor version.
- **Expected:** The worker's HTTP endpoint processes the request and its
  ownership/version checks allow the current assignment.

### 8. Worker failure recovery

- **Objective:** Observe behavior when a worker disappears.
- **Steps:** Stop a worker, wait past the configured timeout, then inspect
  `GET /api/workers`. Send a request to an actor assigned to it.
- **Expected:** Expired registration is pruned when workers are listed. A
  subsequent ownership resolution may assign the actor to a live worker, but
  the first request can fail if it reaches an unreachable endpoint. There is
  no durable pending-message queue.

### 9. Actor rebalancing

- **Objective:** Verify manual migration between two live workers.
- **Steps:** Start two workers, create several actors, inspect
  `/api/dashboard`, then call `POST /api/rebalance`.
- **Expected:** Response includes `moved` and a distribution map. Actor state
  remains stored in MongoDB; the affected assignment generation increases.
  Small count differences (one or less) may not move.

### 10. Singleton ownership and 11. failover

- **Objective:** Observe scheduler lease acquisition and expiry.
- **Steps:** Create a `GlobalSchedulerActor` (or use `/singletons`), inspect
  `GET /api/singletons`, stop the current lease-holding worker, and wait longer
  than `SINGLETON_LEASE_MS`.
- **Expected:** One worker reports the active lease at a time; a live worker
  can acquire a lease after expiry. Lease acquisition increments the fencing
  generation. Timing and Redis availability affect the observation.

### 12. Kubernetes scaling

- **Objective:** Confirm the API can discover pods and patch worker replicas.
- **Steps:** Deploy the sample manifests, check `GET /api/cluster`, then use
  `POST /api/cluster/scale` with `{"replicas":3}` or the Cluster page.
- **Expected:** Kubernetes reports worker pods and the Deployment's desired
  replica count changes. This does not itself guarantee actor rebalancing.

### 13. Dashboard updates

- **Objective:** Confirm the EJS console reflects persisted runtime data.
- **Steps:** Open `/`, `/actors`, `/workers`, `/rebalancing`,
  `/singletons`, and `/cluster` after performing the relevant operations.
- **Expected:** Pages render current database/Redis/Kubernetes observations;
  cluster data is absent when Kubernetes is not reachable.

## Recording real results

For a report, record date, software versions, configuration, commands, actual
HTTP responses, logs, screenshots, and failures. The repository does not contain
pre-recorded results. See the [project report guide](PROJECT_REPORT_GUIDE.md).
