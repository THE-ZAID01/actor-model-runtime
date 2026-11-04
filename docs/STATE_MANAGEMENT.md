# State management

## MongoDB is the actor-state store

Each actor has one `Actor` document with identity, type, mixed `state`,
assignment, status, version, last-active time, a bounded processed-message
history, and Mongoose timestamps. The worker loads that record when handling a
message, applies the operation, and updates it with a conditional filter on
the old version, worker ID, owner generation, and absence of the message ID.

This compare-and-update is an optimistic concurrency/fencing check. A failed
conditional write is reported as a `409` unless the processed-message history
shows the same request already committed.

## Message and event history

Successful message processing attempts a separate `Message` insert after the
actor write. Runtime operations also create `RuntimeEvent` records on a
best-effort basis. Runtime event documents have a MongoDB TTL index based on
`createdAt` with a 30-day expiration duration.

## Redis coordination data

Redis holds:

- `actorlab:workers`: hash keyed by worker ID with JSON registration,
  heartbeat, URL, and metadata.
- `actorlab:owners`: hash keyed by actor ID with JSON worker ID, generation,
  and assignment timestamp.
- `actorlab:singleton:global-scheduler`: expiring singleton lease string.
- `actorlab:singleton:generation`: monotonically incremented lease generation.
- `actorlab:singleton:status`: hash of latest lease holder/token/generation and
  expiry metadata.

No Redis Stream or durable message queue is used.

## Recovery implications

After a worker restart, actor state can be read from MongoDB. The worker's
in-memory mailbox queue is lost. A request that was in-flight may have
committed state even if the client did not receive a response; retrying with
the same message ID can be deduplicated while the ID remains in the actor's
rolling history, or if the Message record was created. Those records are
separate writes and the history is bounded, so this is not a permanent
exactly-once guarantee.

Schema and key details are tabulated in [Database design](DATABASE_DESIGN.md).
