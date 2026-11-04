# Actor model in ActorLab

## Concept

An actor is a logical entity addressed by an ID. It has state and accepts
operations that update or read that state. In ActorLab, the actor record is
durable in MongoDB, while a worker process temporarily handles operations.
The actor ID is independent from the worker or Kubernetes pod that handles it.

## Actor identity and state

`actorId` is a trimmed string with a maximum length of 120 characters and a
restricted character set. MongoDB enforces uniqueness. `actorType` is restricted
to `CounterActor`, `BankAccountActor`, and `GlobalSchedulerActor`; `state` is a
mixed Mongoose value whose shape depends on type:

| Type                   | Initial state                | Operations                          |
| ---------------------- | ---------------------------- | ----------------------------------- |
| `CounterActor`         | `{ "count": 0 }`             | `increment`, `decrement`, `get`     |
| `BankAccountActor`     | `{ "balance": 0 }`           | `deposit`, `withdraw`, `getBalance` |
| `GlobalSchedulerActor` | `{ "jobs": [], "ticks": 0 }` | `tick`, `addJob`, `get`             |

Amounts must be positive finite numbers for counter and bank operations.
Withdrawals that would make a balance negative return a conflict.

## Identity, owner, and process are different

- **Logical actor:** MongoDB identity/state plus Redis owner assignment.
- **Worker process:** Node.js HTTP server with a volatile per-actor queue.
- **Kubernetes pod:** container runtime/scheduling unit that may host a worker.

ActorLab does not retain one JavaScript actor instance in memory between
messages. The worker loads the actor's current document, applies an operation,
and saves it. Setting status to `active` or `idle` updates a persisted label;
it is not equivalent to constructing or destroying an actor object.

## Message serialization

Requests for the same actor are chained by the receiving worker's local
promise-tail map. This serializes requests routed to that one process. A
MongoDB compare-and-update on version, worker ID, generation, and message ID
guards against stale/conflicting updates if processes overlap or race.

## Example

```json
{
  "actorId": "counter-orders",
  "actorType": "CounterActor",
  "state": { "count": 0 },
  "status": "idle",
  "workerId": "worker-local-1",
  "ownerGeneration": 1,
  "version": 0
}
```

The fields and their full lifecycle are described in
[Actor lifecycle](ACTOR_LIFECYCLE.md) and
[Database design](DATABASE_DESIGN.md).
