# Limitations and future scope

This section distinguishes observed implementation behavior from possible
follow-up work. Suggestions below are not implemented features.

## Current limitations

| Area                    | Current behavior / constraint                                                                                                                                                                                                                                       |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Delivery                | Messages use synchronous HTTP requests. There is no durable queue for requests while all workers are unavailable.                                                                                                                                                   |
| Delivery guarantee      | The API may time out after a worker committed state; retrying with the same `messageId` can return a cached result, but there is no end-to-end exactly-once guarantee.                                                                                              |
| Idempotency             | Actor documents retain only the latest 256 processed IDs/results. Older retries may be applied again if the message log is missing. `Message.messageId` is globally unique, but an existing ID is returned without checking that it belongs to the requested actor. |
| Result logging          | The actor state update commits before `Message.create`. A non-duplicate log failure is logged and does not roll back state.                                                                                                                                         |
| Ordering                | A worker serializes requests for an actor only inside that worker process. MongoDB version/ownership predicates detect conflicting writes; they are not a distributed mailbox.                                                                                      |
| Placement               | New actors use least actor count among live workers. This does not account for CPU, memory, throughput, or actor cost.                                                                                                                                              |
| Rebalancing             | Manual only. It moves count imbalances greater than one or assignments to workers no longer listed as live. Singleton actors are excluded. There is no background controller.                                                                                       |
| Failure recovery        | Ownership is repaired when an actor next routes, or by manual rebalancing. A request to an unreachable owner returns an error; no durable queue retains it.                                                                                                         |
| Activation              | `active`/`idle` is a persisted status flag. The worker does not maintain a persistent in-memory actor instance, and setting `idle` does not prevent later message processing.                                                                                       |
| Singleton               | Lease key uses Redis TTL and token-checked renewal. The accompanying status hash is updated separately and is not itself atomically fenced with the lease. Redis must be available and suitably configured.                                                         |
| Kubernetes client       | Connection/configuration failure is cached by the client factory. Kubernetes operations are limited to one namespace and the configured worker Deployment.                                                                                                          |
| Cluster replica display | Cluster status keeps only the Deployment `spec`; the EJS page reads `readyReplicas` from that spec and falls back to `0`. It does not display the Deployment's actual ready count.                                                                                  |
| Security                | Public API and internal worker coordination routes have no authentication. Sample databases are unauthenticated. No TLS/network policy is configured.                                                                                                               |
| Availability            | Sample manifests run one MongoDB and one Redis replica; Redis has no PVC in the manifest. No replica-safe datastore or backup strategy is provided.                                                                                                                 |
| Observability           | Basic console logging, runtime events, worker heartbeat metadata, and dashboard counters only; no metrics/tracing integration.                                                                                                                                      |
| Validation              | No test suite or test script is checked in. Manual test procedures are in [Testing and validation](TESTING_AND_VALIDATION.md).                                                                                                                                      |

## Possible future work

- Add authenticated service-to-service and client APIs, TLS, and namespace
  network policies.
- Introduce a durable queue/stream with explicit retry and dead-letter policy.
- Persist inbox/outbox records transactionally or use a datastore-supported
  atomic protocol for state and result records.
- Keep processed-message deduplication durable and define an explicit
  idempotency-key scope.
- Add a distributed mailbox or stronger fencing/locking across concurrent API
  instances and worker processes.
- Add monitored, policy-driven rebalancing with CPU, memory, queue depth, and
  drain time constraints.
- Make singleton metadata atomic with lease ownership and test Redis failover.
- Add automated integration and failure-injection tests.
- Harden Kubernetes storage, probes, resource requests/limits, secrets, and
  multi-replica service design.

## Discrepancies to keep in mind

The dashboard and in-app guide are explanatory presentations. For precise
behavior, source code is authoritative. In particular, "activation" does not
instantiate a long-lived actor object, and expired worker records do not trigger
an autonomous rebalancing loop. See
[Actor lifecycle](ACTOR_LIFECYCLE.md) and
[Worker management](WORKER_MANAGEMENT.md).
