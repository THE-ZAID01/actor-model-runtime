# Project overview

ActorLab is a small, single-project virtual actor runtime and operations
dashboard. A caller addresses a logical actor by a stable string ID; the API
looks up or repairs placement and forwards each operation to an independent
worker process. MongoDB persists actor state. Redis stores worker heartbeat
records, actor ownership assignments, and the lease used by the built-in
singleton actor.

## Why this project exists

The repository is a learning and demonstration environment for studying actor
identity, state persistence, worker registration, routing, migration, singleton
leases, and Kubernetes orchestration together. The implementation is intended
to make these mechanisms inspectable in code and through a server-rendered
dashboard. It does not claim to be a general-purpose framework or a production
cluster manager.

## Main capabilities

| Capability              | Implemented behavior                                                                                        |
| ----------------------- | ----------------------------------------------------------------------------------------------------------- |
| Actor types             | Counter, bank account, and global scheduler examples                                                        |
| Persistent state        | Mongoose actor document with version and worker assignment                                                  |
| Worker discovery        | Redis hash with heartbeat timestamps; expired records are pruned on lookup                                  |
| Message routing         | API forwards a request to the selected worker's HTTP endpoint                                               |
| Per-actor serialization | Worker maintains an in-process promise tail per actor ID                                                    |
| Duplicate handling      | Message IDs, a unique MongoDB message index, and the most recent 256 actor-level results                    |
| Migration               | Manual count-based routine that marks migrating, asks the old worker to drain, and changes owner generation |
| Singleton               | Redis expiring lease with token comparison on renewal and increasing generation on acquisition              |
| Cluster console         | Kubernetes pod listing, pod logs, and patching worker replica count                                         |

Details and constraints are linked from the [README](../README.md).

## Runtime shape

The same Node application image runs in two modes:

- `npm start` starts the Express API/page server. It attempts MongoDB and Redis
  connections, logs a failed initial connection, and retries those connections
  every five seconds.
- `npm run worker` starts a worker HTTP server. A worker connects to MongoDB
  and Redis before listening, registers with the API, and periodically sends
  heartbeats and renews/attempts its singleton lease.

The Dockerfile copies `src/` and `public/`; Compose and Kubernetes select the
mode using the container command. The API's Kubernetes client uses the
in-cluster configuration where possible, then local kubeconfig as fallback.

## Important distinction

An actor is a durable logical record, not a long-lived JavaScript object pinned
to a pod. The worker queue is in memory and serializes same-process requests;
the actor's state is reloaded from MongoDB for each worker operation. A worker
process is an operating-system/container process. A Kubernetes pod is the
scheduling and restart unit that runs a worker container. These identities are
not interchangeable.

## Further reading

- [System architecture](SYSTEM_ARCHITECTURE.md)
- [Actor model and lifecycle](ACTOR_MODEL.md), [lifecycle](ACTOR_LIFECYCLE.md)
- [Message processing](MESSAGE_PROCESSING.md) and [state](STATE_MANAGEMENT.md)
- [Deployment guide](DEPLOYMENT_GUIDE.md)
