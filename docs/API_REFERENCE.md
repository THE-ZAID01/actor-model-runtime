# API reference

The public JSON routes are mounted at `/api`, coordinator routes at
`/internal`, and browser pages at `/`. Worker-process routes use the worker
port (3101 by default). No route in these groups performs authentication.
Unless specified as text, JSON errors use `{ "error": "message" }`.

## Public JSON API

### Health and dashboard

| Method / path        | Purpose                                               | Success                                                                                                   |
| -------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `GET /api/health`    | API process health only; does not check MongoDB/Redis | `200` `{ "ok": true, "service": "actorlab-api" }`                                                         |
| `GET /api/dashboard` | Dashboard data from MongoDB and Redis                 | `200` JSON object with actor/message counts, workers, coordination availability, events, and actor counts |
| `GET /api/events`    | Recent runtime events                                 | `200` JSON array, newest first (default max 30)                                                           |

### Actors

| Method / path                   | Request                                                                                | Success                                                          | Errors                                                                                                                                                       |
| ------------------------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET /api/actors`               | None                                                                                   | `200` actor array, newest first                                  | Service/database errors                                                                                                                                      |
| `POST /api/actors`              | `{ "actorId": "counter-orders", "actorType": "CounterActor" }`                         | `201` created actor document                                     | `400` invalid ID/type; `503` no live worker; `409` duplicate actor ID                                                                                        |
| `GET /api/actors/:id`           | ID path parameter                                                                      | `200` actor document                                             | `404` actor not found                                                                                                                                        |
| `PATCH /api/actors/:id`         | `{ "status": "active" }` or `{ "status": "idle" }`                                     | `200` updated actor document                                     | `400` invalid status; `404` not found                                                                                                                        |
| `POST /api/actors/:id/messages` | `{ "operation": "increment", "payload": { "amount": 1 }, "messageId": "optional-id" }` | `200` worker response including actor/result/messageId/duplicate | `400` invalid request/operation; `404` actor missing; `409` business, ownership, or version conflict; `503` no worker, unreachable worker, or migration wait |
| `GET /api/actors/:id/messages`  | ID path parameter                                                                      | `200` latest 100 message records, newest first                   | Service/database errors                                                                                                                                      |

Actor creation supports the three types and operations listed in
[Actor model](ACTOR_MODEL.md). A successful message response has the shape:

```json
{
  "actor": { "actorId": "counter-orders", "state": { "count": 1 } },
  "result": { "count": 1 },
  "messageId": "request-0001",
  "duplicate": false
}
```

This example shows selected fields; the actual `actor` is a Mongoose document
serialization and includes schema fields. Message ID may be generated if
omitted. Reuse an ID only when retrying the same logical operation.

### Workers and rebalancing

| Method / path                 | Request                                                              | Success                                                             | Errors                                                      |
| ----------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------- |
| `GET /api/workers`            | None                                                                 | `200` live worker array                                             | Redis/service errors                                        |
| `POST /api/workers/register`  | Worker JSON with `workerId` and `url` (optional additional metadata) | `201` registration with `lastHeartbeat`                             | `400` invalid ID or URL                                     |
| `POST /api/workers/heartbeat` | `{ "workerId": "...", ... }`                                         | `200` `{ "ok": true }`                                              | `404` worker not registered                                 |
| `POST /api/rebalance`         | Empty body                                                           | `200` `{ "moved": number, "distribution": { "worker-id": count } }` | `409` fewer than two live workers; coordination/data errors |

`workerId` is 1–100 word/dot/hyphen characters; registration URL must match
the route's simple `http(s)://host[:port]` validation. Worker registration is
also available through the unauthenticated `/internal` endpoints.

### Singleton actors

| Method / path         | Purpose              | Success                                                                           |
| --------------------- | -------------------- | --------------------------------------------------------------------------------- |
| `GET /api/singletons` | Current lease status | `200` object with registered/owner/active/expiry/generation (or unavailable flag) |

Lease acquisition/renewal occurs through the internal worker endpoints below.
The UI's actor registration action is `POST /singletons/register`.

### Kubernetes / cluster

| Method / path                      | Request                                          | Success                                               | Errors                                                                             |
| ---------------------------------- | ------------------------------------------------ | ----------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `GET /api/cluster`                 | None                                             | `200` cluster status plus simplified worker-pod array | Cluster unavailability is represented in the status, not necessarily an HTTP error |
| `POST /api/cluster/scale`          | `{ "replicas": 0 }` through `{ "replicas": 50 }` | `200` `{ "ok": true, "replicas": number }`            | `400` invalid count; `503` Kubernetes unavailable; Kubernetes API errors           |
| `GET /api/cluster/pods/:name/logs` | Pod name path parameter                          | `200` plain text, up to 100 lines                     | `503` unavailable; `504` Kubernetes API timeout; Kubernetes API errors             |

### Events

`GET /api/events` returns the 30 most recent `RuntimeEvent` documents by
default. Page routes can request a smaller limit from the shared service.

## Coordinator internal API

These endpoints are called by worker processes and are not authenticated.
Restrict network exposure to trusted application components.

| Method / path                       | Example body                                                          | Response                                         |
| ----------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------ |
| `POST /internal/workers/register`   | `{ "workerId": "worker-1", "url": "http://worker-1:3101" }`           | `201` registration with heartbeat timestamp      |
| `POST /internal/workers/heartbeat`  | Worker ID and updated metadata                                        | `200` `{ "ok": true }`; `404` if no registration |
| `POST /internal/singletons/acquire` | `{ "workerId": "worker-1" }`                                          | `200` `{ "lease": leaseOrNull }`                 |
| `POST /internal/singletons/renew`   | `{ "lease": { "workerId": "...", "token": "...", "generation": 1 } }` | `200` `{ "lease": renewedLeaseOrNull }`          |

## Worker HTTP routes

The worker listens on `WORKER_PORT` (default 3101):

| Method / path                       | Caller                   | Behavior                                                                                     |
| ----------------------------------- | ------------------------ | -------------------------------------------------------------------------------------------- |
| `GET /health`                       | Coordinator/health probe | Returns `{ ok, workerId, activeActors }`; `activeActors` is the current local queue-map size |
| `POST /internal/actors/:id/message` | API                      | Queues and executes an actor request; returns JSON result or common error                    |
| `POST /internal/actors/:id/drain`   | Rebalancer               | Waits for that actor's current local queue tail; returns `{ "drained": true }`               |

## Browser routes

| Method / path               | Purpose                                                   |
| --------------------------- | --------------------------------------------------------- |
| `GET /`                     | Dashboard                                                 |
| `GET /project`              | In-app architecture guide                                 |
| `GET /actors`               | Actor list/create form                                    |
| `GET /actors/:id`           | Actor details, message history and forms                  |
| `POST /actors/create`       | Create actor; redirects to its page or back with an error |
| `POST /actors/:id/message`  | Submit a message; redirects with result/status query      |
| `POST /actors/:id/status`   | Set actor status to `active`/`idle`                       |
| `GET /workers`              | Worker registry, placement, pod information               |
| `GET /rebalancing`          | Distribution and recent events                            |
| `POST /rebalancing/trigger` | Run rebalancing and redirect with result                  |
| `GET /singletons`           | Singleton state/history                                   |
| `POST /singletons/register` | Create `global-scheduler` actor                           |
| `GET /cluster`              | Cluster status                                            |
| `POST /cluster/scale`       | Scale worker Deployment via form; redirects               |
| `GET /cluster/logs/:pod`    | Render cluster page with pod logs                         |

Express also serves static browser assets under `/assets`. Unknown routes
render the not-found page.
