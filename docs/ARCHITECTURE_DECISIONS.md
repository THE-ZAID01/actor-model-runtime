# Architecture decisions

This note records design choices visible in the repository. It does not claim
that alternatives were benchmarked or that the choices are production
recommendations.

| Decision                 | Implemented choice                                                     | Reason it fits this demonstration                      | Trade-off / caveat                                             |
| ------------------------ | ---------------------------------------------------------------------- | ------------------------------------------------------ | -------------------------------------------------------------- |
| Actor addressing         | Stable actor ID, separate worker ID                                    | Lets requests survive placement changes                | Requires registry/ownership coordination                       |
| Actor state              | MongoDB current-state document                                         | Easy to inspect and reload after worker restart        | State and message result are not one transaction               |
| Coordination             | Redis hashes and a TTL lease                                           | Simple shared membership/placement/lease primitives    | Redis unavailability interrupts coordination; no durable queue |
| Worker message transport | Direct HTTP from API to worker                                         | Simple synchronous request/response                    | Unreachable worker yields an error; no queued delivery         |
| Worker execution         | Local promise-tail queue by actor ID                                   | Serializes operations for one actor within one process | Queue is volatile and process-local                            |
| Ownership fencing        | Incrementing assignment generation plus conditional MongoDB predicates | Rejects stale owner requests and conflicting writes    | Not a substitute for distributed transactions                  |
| Runtime interface        | Express REST and EJS                                                   | One server supports programmatic and human inspection  | No separate frontend/API security boundary                     |
| Orchestration            | Kubernetes Deployments and Services                                    | Demonstrates replicas, pod discovery and API scaling   | Sample manifests are minimal and single-datastore              |
| Rebalancing              | Manual actor-count algorithm                                           | Easy to observe and trigger in a demo                  | Not automatic and not resource-aware                           |

## Alternatives not implemented

The code does not use a message broker, Redis Streams, event sourcing,
distributed actor framework, durable mailbox, transactional outbox, Kubernetes
operator, or HPA. These may be future directions, but should not be described
as existing features.

Related: [System architecture](SYSTEM_ARCHITECTURE.md),
[message processing](MESSAGE_PROCESSING.md), and
[Limitations](LIMITATIONS_AND_FUTURE_SCOPE.md).
