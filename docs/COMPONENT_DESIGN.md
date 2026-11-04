# Component design

## Application and process entry point

`src/server.js` loads dotenv and chooses a mode:

- Normal mode attempts MongoDB and Redis connections, starts the API listener,
  and retries initially failed dependency connections every five seconds.
- `--worker` dynamically loads `src/runtime/worker.js` and starts a worker.
  Worker startup requires successful MongoDB and Redis connections.

`src/app.js` configures EJS, static assets under `/assets`, JSON and form body
limits, query locals, API/internal/page routers, not-found handling, and the
error middleware.

## Services and persistence

`src/services/runtime.js` contains both coordinator-side operations and worker
execution logic. This is a shared module imported by the API routes and worker
process. It does not create an actor class per application actor; actor type
branches implement the three built-in behaviors.

`src/services/kubernetes.js` wraps cluster status, pod discovery, worker
Deployment patching, and pod log retrieval. The Kubernetes client itself is
created lazily in `src/config/kubernetes.js`.

Mongoose models are `Actor`, `Message`, and `RuntimeEvent`. Redis key names and
data formats are documented in [Database design](DATABASE_DESIGN.md).

## API surfaces

| Surface                  | Mount                     | Caller                            |
| ------------------------ | ------------------------- | --------------------------------- |
| Public JSON API          | `/api`                    | Browser/API clients               |
| Coordinator internal API | `/internal`               | Worker processes                  |
| Page routes              | `/`                       | Browser                           |
| Worker HTTP server       | Worker port, default 3101 | API coordinator and health checks |

Internal routes are ordinary HTTP endpoints; the code does not authenticate
them. Keep them on trusted networks.

## Worker request execution

The worker's `enqueue(actorId, task)` maintains a `Map` of promise tails. It
chains a new task after the preceding task for that actor and removes the tail
when the last tracked task settles. The map is process-local and does not
represent a durable actor activation.

`workerProcess` validates the Redis owner assignment and generation, checks
MongoDB for an existing message, checks that the actor document is assigned to
the current worker/generation, performs actor behavior, then updates state
conditionally on the old version and current assignment. It records processed
message IDs in the actor document (bounded to 256) before attempting the
separate message record write.

## Browser console

`src/routes/pages.js` assembles page data and renders `src/views/layout.ejs`
with one of the page partials. Forms submit to POST page routes, which redirect
back with query-string status messages. The page handlers and API handlers
share the runtime and Kubernetes services.

Related: [API reference](API_REFERENCE.md),
[actor lifecycle](ACTOR_LIFECYCLE.md), and
[Kubernetes integration](KUBERNETES_INTEGRATION.md).
