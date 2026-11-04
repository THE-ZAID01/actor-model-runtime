# Objectives and scope

## Objectives

1. Provide stable string identities for a small set of virtual actor types.
2. Persist actor state and version changes in MongoDB.
3. Register worker HTTP endpoints and determine liveness with Redis heartbeats.
4. Route actor messages to an assigned live worker.
5. Serialize messages for an actor within a worker process and reject stale
   ownership generations.
6. Demonstrate count-based, manually triggered actor migration.
7. Demonstrate a Redis lease and fencing generation for one built-in scheduler.
8. Provide EJS pages and a JSON API for inspecting runtime behavior.
9. Run API and worker processes in Docker Compose or Kubernetes.
10. Use the Kubernetes API for pod inspection/logs and worker Deployment scaling.

## In scope

- `CounterActor`, `BankAccountActor`, and `GlobalSchedulerActor`.
- Single API service, one or more independent worker processes, one MongoDB
  connection, and one Redis connection.
- Direct HTTP communication from API to worker.
- Namespace-scoped Kubernetes sample resources in `k8s/`.
- A manual rebalancing endpoint and a dashboard action.

## Out of scope or not implemented

- User authentication, authorization, tenant isolation, and API keys.
- A durable inbound message queue or stream.
- General actor code/plugin registration or user-defined actor classes.
- Automatic rebalancing on worker changes or metrics-based balancing.
- Exactly-once delivery, distributed transactions, or guaranteed result-log
  atomicity with state updates.
- Durable actor activation, passivation, snapshots, or event sourcing beyond
  the current MongoDB state record.
- Multi-instance-safe shared singleton lease status metadata.
- Production hardening, autoscaling policies, backup procedures, and a
  comprehensive automated test suite.

## Assumptions

- Redis and MongoDB are reachable from both API and worker processes.
- Worker advertised URLs are reachable from the API.
- Kubernetes manifests are applied to a cluster where the `actorlab:latest`
  image is available.
- The default Kubernetes namespace and worker service DNS convention are
  `actorlab`.

Related: [problem statement](PROBLEM_STATEMENT.md),
[architecture](SYSTEM_ARCHITECTURE.md), and
[limitations](LIMITATIONS_AND_FUTURE_SCOPE.md).
