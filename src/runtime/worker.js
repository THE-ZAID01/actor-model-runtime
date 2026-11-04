import express from 'express';
import os from 'node:os';
import { connectDatabase } from '../config/database.js';
import { connectRedis, redis } from '../config/redis.js';
import {
  workerProcess,
  acquireSingleton,
  renewSingleton,
} from '../services/runtime.js';
import { errorHandler } from '../middleware/errors.js';

const app = express();
app.use(express.json({ limit: '32kb' }));
const workerId = process.env.WORKER_ID || `${os.hostname()}-${process.pid}`;
const port = Number(process.env.WORKER_PORT || 3101);
const coordinator = process.env.COORDINATOR_URL || 'http://localhost:3000';
const advertisedHost =
  process.env.WORKER_ADVERTISE_HOST ||
  process.env.POD_IP ||
  (process.env.POD_NAME
    ? `${process.env.POD_NAME}.actor-worker-headless.actorlab.svc.cluster.local`
    : '127.0.0.1');
const tails = new Map();
function enqueue(actorId, task) {
  const previous = tails.get(actorId) || Promise.resolve();
  const next = previous.then(task, task);
  const tracked = next.finally(() => {
    if (tails.get(actorId) === tracked) tails.delete(actorId);
  });
  tails.set(actorId, tracked);
  return tracked;
}

app.get('/health', (_req, res) =>
  res.json({ ok: true, workerId, activeActors: tails.size }),
);
app.post('/internal/actors/:id/message', (req, res, next) =>
  enqueue(req.params.id, () => workerProcess(workerId, req.params.id, req.body))
    .then((data) => res.json(data))
    .catch(next),
);
app.post('/internal/actors/:id/drain', async (req, res) => {
  await (tails.get(req.params.id) || Promise.resolve());
  res.json({ drained: true });
});
app.use(errorHandler);

let lease;
async function post(path, body) {
  const response = await fetch(`${coordinator}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(3000),
  });
  if (!response.ok)
    throw Object.assign(new Error(`Coordinator returned ${response.status}`), {
      status: response.status,
    });
  return response.json();
}
async function heartbeat() {
  const health = await fetch(`http://127.0.0.1:${port}/health`, {
    signal: AbortSignal.timeout(1000),
  }).then((r) => r.json());
  const info = {
    workerId,
    url: `http://${advertisedHost}:${port}`,
    activeActors: health.activeActors,
    host: os.hostname(),
    mode: process.env.RUNTIME_MODE || 'local',
  };
  try {
    await post('/internal/workers/heartbeat', info);
  } catch (error) {
    if (error.status !== 404) throw error;
    await post('/internal/workers/register', info);
  }
  if (!lease)
    lease = await post('/internal/singletons/acquire', { workerId }).then(
      (r) => r.lease,
    );
  else
    lease = await post('/internal/singletons/renew', { lease }).then(
      (r) => r.lease,
    );
}

export async function startWorker() {
  await connectDatabase();
  await connectRedis();
  const server = app.listen(port, async () => {
    console.log(`Worker ${workerId} listening on ${port}`);
    try {
      await post('/internal/workers/register', {
        workerId,
        url: `http://${advertisedHost}:${port}`,
        host: os.hostname(),
        mode: process.env.RUNTIME_MODE || 'local',
      });
    } catch (error) {
      console.error('Worker registration failed:', error.message);
    }
  });
  const timer = setInterval(
    () =>
      heartbeat().catch((error) =>
        console.error('Worker heartbeat failed:', error.message),
      ),
    Number(process.env.HEARTBEAT_INTERVAL_MS || 4000),
  );
  const shutdown = async () => {
    clearInterval(timer);
    await Promise.allSettled([...tails.values()]);
    server.close();
    if (lease?.token)
      await redis
        .eval(
          `if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end`,
          {
            keys: ['actorlab:singleton:global-scheduler'],
            arguments: [JSON.stringify({ workerId, token: lease.token })],
          },
        )
        .catch(() => {});
    await redis.quit().catch(() => {});
    process.exit(0);
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
}
