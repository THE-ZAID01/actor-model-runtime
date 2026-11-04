# Database and data design

## MongoDB collections

Mongoose derives collection names from the model names (`Actor`, `Message`,
`RuntimeEvent`).

### Actor

| Field                    | Type / behavior                                                                                                                    |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| `actorId`                | Required, unique, trimmed string; max 120 characters                                                                               |
| `actorType`              | Required enum: `CounterActor`, `BankAccountActor`, `GlobalSchedulerActor`                                                          |
| `state`                  | Required `Mixed` value with actor-specific shape                                                                                   |
| `processedMessages`      | Array of `{ messageId, result }`, default empty, excluded from normal selections; worker updates it with a 256-entry rolling slice |
| `status`                 | `active`, `idle`, or `migrating`; defaults to `idle`                                                                               |
| `workerId`               | String, defaults to `null`                                                                                                         |
| `ownerGeneration`        | Number, defaults to 1                                                                                                              |
| `version`                | Number, defaults to 0; incremented on successful state update                                                                      |
| `lastActiveAt`           | Date, defaults to creation time                                                                                                    |
| `createdAt`, `updatedAt` | Mongoose timestamps                                                                                                                |

There is an index on `{ workerId: 1, status: 1 }`.

### Message

`messageId` is required and unique; `actorId` is required and indexed.
`operation` is a string; `payload` and `result` are Mixed values; `processedAt`
defaults to now; Mongoose timestamps are enabled. The message record is
attempted after the actor state update.

### RuntimeEvent

Fields are required `type`, required `message`, optional Mixed `details`, and
`createdAt` (default now). `createdAt` has a TTL expiration of 30 days.

## State examples

```json
{
  "actorId": "counter-orders",
  "actorType": "CounterActor",
  "state": { "count": 2 },
  "status": "active",
  "workerId": "worker-local-1",
  "ownerGeneration": 1,
  "version": 1
}
```

This is an illustrative subset; Mongoose adds `_id`, timestamps, and other
schema fields. Initial state is `{ "count": 0 }`, `{ "balance": 0 }`, or
`{ "jobs": [], "ticks": 0 }`, depending on type.

## Redis keys and structures

| Key                                   | Type            | Stored information                                                                        |
| ------------------------------------- | --------------- | ----------------------------------------------------------------------------------------- |
| `actorlab:workers`                    | Hash            | Field per worker ID; JSON registration/heartbeat, URL, host, mode, and active actor count |
| `actorlab:owners`                     | Hash            | Field per actor ID; JSON `{ workerId, generation, changedAt }`                            |
| `actorlab:singleton:global-scheduler` | String with TTL | JSON `{ workerId, token }`; acquired with NX/PX                                           |
| `actorlab:singleton:generation`       | Integer counter | Incremented on successful lease acquisition                                               |
| `actorlab:singleton:status`           | Hash            | Latest holder, token, generation, and expiry timestamp                                    |

Redis worker records have no individual TTL. `listWorkers` compares their
`lastHeartbeat` with `WORKER_TIMEOUT_MS` and deletes expired/malformed entries
when called. The owner map is updated explicitly during creation, ownership
resolution, and rebalancing.

## Consistency and lifecycle

Actor state is durable in MongoDB and is loaded per message. Worker membership
and owner mapping live in Redis. Message-result records and actor state are not
written in a transaction. Runtime events are best effort and expire after the
TTL period. Redis persistence/replication depends on deployment configuration;
the included Kubernetes Redis manifest has append-only mode but no PVC.

Related: [State management](STATE_MANAGEMENT.md),
[Message processing](MESSAGE_PROCESSING.md), and
[Singleton actors](SINGLETON_ACTORS.md).
