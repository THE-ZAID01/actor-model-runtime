# Problem statement

When application state and execution are tied to one process, restarting or
adding processes can make ownership and recovery difficult to reason about.
For an actor-style application, the system must preserve a stable way to
address an actor while determining which currently available worker should
execute its next operation.

ActorLab demonstrates this problem in a compact system: how can a caller send
an operation to an actor without depending on the worker's identity, and how
can the runtime retain state and coordinate placement as workers register,
disappear, or are manually rebalanced?

## Demonstration goals

- Separate actor identity and durable state from worker process lifetime.
- Show per-actor request serialization at a worker.
- Coordinate worker discovery and actor ownership through Redis.
- Persist state and message results in MongoDB.
- Demonstrate a manual ownership transfer and a leased singleton.
- Show how Kubernetes can run, inspect, and scale worker pods.

## What is not claimed

This project does not solve general distributed queueing, exactly-once
delivery, automatic load-aware scheduling, durable failover, high availability
for MongoDB/Redis, or secure multi-tenant access. Its implementation and
limitations are described in [System architecture](SYSTEM_ARCHITECTURE.md) and
[Limitations and future scope](LIMITATIONS_AND_FUTURE_SCOPE.md).
