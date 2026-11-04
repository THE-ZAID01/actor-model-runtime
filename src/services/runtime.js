import crypto from 'node:crypto';
import Actor from '../models/Actor.js';
import Message from '../models/Message.js';
import RuntimeEvent from '../models/RuntimeEvent.js';
import { redis } from '../config/redis.js';

const OWNER_KEY = 'actorlab:owners';
const WORKER_KEY = 'actorlab:workers';
const QUEUE_KEY = 'actorlab:worker-queue';
const LEASE_KEY = 'actorlab:singleton:global-scheduler';
const leaseScript = `if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('pexpire', KEYS[1], ARGV[2]) else return 0 end`;

export const initialState = (type) =>
  type === 'CounterActor'
    ? { count: 0 }
    : type === 'BankAccountActor'
      ? { balance: 0 }
      : { jobs: [], ticks: 0 };
export const recordEvent = (type, message, details = {}) =>
  RuntimeEvent.create({ type, message, details }).catch((error) => {
    console.error('Runtime event could not be saved:', error.message);
    return null;
  });

export async function listWorkers() {
  const workers = await redis.hGetAll(WORKER_KEY);
  const now = Date.now();
  const live = [];
  for (const [workerId, raw] of Object.entries(workers)) {
    try {
      const worker = JSON.parse(raw);
      if (
        now - new Date(worker.lastHeartbeat).getTime() <=
        Number(process.env.WORKER_TIMEOUT_MS || 15000)
      )
        live.push(worker);
      else await redis.hDel(WORKER_KEY, workerId);
    } catch {
      await redis.hDel(WORKER_KEY, workerId);
    }
  }
  return live.sort((a, b) => a.workerId.localeCompare(b.workerId));
}

export async function registerWorker(worker) {
  const value = { ...worker, lastHeartbeat: new Date().toISOString() };
  await redis.hSet(WORKER_KEY, worker.workerId, JSON.stringify(value));
  await recordEvent(
    'worker.registered',
    `Worker ${worker.workerId} registered`,
    { workerId: worker.workerId },
  );
  return value;
}

export async function heartbeat(worker) {
  const raw = await redis.hGet(WORKER_KEY, worker.workerId);
  if (!raw) {
    const error = new Error('Worker registration expired');
    error.status = 404;
    throw error;
  }
  const previous = JSON.parse(raw);
  await redis.hSet(
    WORKER_KEY,
    worker.workerId,
    JSON.stringify({
      ...previous,
      ...worker,
      lastHeartbeat: new Date().toISOString(),
    }),
  );
  return { ok: true };
}

async function chooseWorker() {
  const workers = await listWorkers();
  if (!workers.length) {
    const error = new Error(
      'No live workers are registered. Start a worker process and retry.',
    );
    error.status = 503;
    throw error;
  }
  const counts = await Actor.aggregate([
    { $match: { workerId: { $in: workers.map((w) => w.workerId) } } },
    { $group: { _id: '$workerId', count: { $sum: 1 } } },
  ]);
  const countMap = new Map(counts.map((item) => [item._id, item.count]));
  return workers.sort(
    (a, b) => (countMap.get(a.workerId) || 0) - (countMap.get(b.workerId) || 0),
  )[0];
}

export async function ensureActorOwner(actor) {
  const deadline =
    Date.now() + Number(process.env.WORKER_REQUEST_TIMEOUT_MS || 5000);
  let currentActor = await Actor.findOne({ actorId: actor.actorId });
  while (currentActor?.status === 'migrating' && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 40));
    currentActor = await Actor.findOne({ actorId: actor.actorId });
  }
  if (!currentActor) {
    const e = new Error('Actor not found');
    e.status = 404;
    throw e;
  }
  if (currentActor.status === 'migrating') {
    const e = new Error('Actor is still migrating; retry shortly');
    e.status = 503;
    throw e;
  }
  const workers = await listWorkers();
  const existingRaw = await redis.hGet(OWNER_KEY, actor.actorId);
  let existing;
  try {
    existing = existingRaw ? JSON.parse(existingRaw) : null;
  } catch {
    existing = null;
  }
  let owner;
  let singletonGeneration;
  if (currentActor.actorType === 'GlobalSchedulerActor') {
    const lease = await singletonStatus();
    owner = workers.find((worker) => worker.workerId === lease.owner);
    if (!owner || !lease.active) {
      const e = new Error('GlobalSchedulerActor has no active singleton lease');
      e.status = 503;
      throw e;
    }
    singletonGeneration = Number(lease.generation);
  } else {
    owner =
      workers.find((worker) => worker.workerId === existing?.workerId) ||
      workers.find((worker) => worker.workerId === currentActor.workerId) ||
      (await chooseWorker());
  }
  const generation =
    existing?.workerId === owner.workerId
      ? existing.generation
      : (existing?.generation || currentActor.ownerGeneration || 0) + 1;
  const assignment =
    existing?.workerId === owner.workerId
      ? existing
      : {
          workerId: owner.workerId,
          generation,
          changedAt: new Date().toISOString(),
        };
  if (
    currentActor.workerId !== assignment.workerId ||
    currentActor.ownerGeneration !== assignment.generation
  ) {
    currentActor.workerId = assignment.workerId;
    currentActor.ownerGeneration = assignment.generation;
    await currentActor.save();
  }
  if (existingRaw !== JSON.stringify(assignment)) {
    const swapped = await redis.eval(
      `local current = redis.call('hget', KEYS[1], ARGV[1]); if (current or '') == ARGV[2] then redis.call('hset', KEYS[1], ARGV[1], ARGV[3]); return 1 else return 0 end`,
      {
        keys: [OWNER_KEY],
        arguments: [
          actor.actorId,
          existingRaw || '',
          JSON.stringify(assignment),
        ],
      },
    );
    if (Number(swapped) !== 1) {
      const latest = await Actor.findOne({ actorId: actor.actorId });
      const latestRaw = await redis.hGet(OWNER_KEY, actor.actorId);
      if (latestRaw) {
        const mapped = JSON.parse(latestRaw);
        await Actor.updateOne(
          { actorId: actor.actorId, status: { $ne: 'migrating' } },
          {
            $set: {
              workerId: mapped.workerId,
              ownerGeneration: mapped.generation,
            },
          },
        );
      }
      return ensureActorOwner(latest || actor);
    }
  }
  return { worker: owner, assignment, singletonGeneration };
}

export async function createActor({ actorId, actorType }) {
  const worker = await chooseWorker();
  const actor = await Actor.create({
    actorId,
    actorType,
    state: initialState(actorType),
    workerId: worker.workerId,
    ownerGeneration: 1,
  });
  const assignment = {
    workerId: worker.workerId,
    generation: 1,
    changedAt: new Date().toISOString(),
  };
  await redis.hSet(OWNER_KEY, actorId, JSON.stringify(assignment));
  await recordEvent('actor.created', `${actorType} ${actorId} created`, {
    actorId,
    workerId: worker.workerId,
  });
  return actor;
}

export async function sendMessage(actorId, body) {
  if (
    !body ||
    typeof body !== 'object' ||
    typeof body.operation !== 'string' ||
    body.operation.length > 80
  ) {
    const e = new Error('A valid operation is required');
    e.status = 400;
    throw e;
  }
  if (
    body.payload !== undefined &&
    (!body.payload ||
      typeof body.payload !== 'object' ||
      Array.isArray(body.payload))
  ) {
    const e = new Error('payload must be an object');
    e.status = 400;
    throw e;
  }
  if (
    body.messageId !== undefined &&
    (typeof body.messageId !== 'string' || body.messageId.length > 120)
  ) {
    const e = new Error('messageId must be a string of at most 120 characters');
    e.status = 400;
    throw e;
  }
  let actor = await Actor.findOne({ actorId });
  if (!actor) {
    const e = new Error(`Actor ${actorId} was not found`);
    e.status = 404;
    throw e;
  }
  if (actor.status === 'migrating') {
    const deadline =
      Date.now() + Number(process.env.WORKER_REQUEST_TIMEOUT_MS || 5000);
    while (actor?.status === 'migrating' && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 50));
      actor = await Actor.findOne({ actorId });
    }
    if (actor?.status === 'migrating') {
      const e = new Error('Actor is still migrating; retry shortly');
      e.status = 503;
      throw e;
    }
  }
  const messageId = String(body.messageId || crypto.randomUUID());
  const previous = await Message.findOne({ messageId });
  if (previous)
    return {
      actor: await Actor.findOne({ actorId }),
      result: previous.result,
      messageId,
      duplicate: true,
    };
  const { worker, assignment, singletonGeneration } =
    await ensureActorOwner(actor);
  const timeout = AbortSignal.timeout(
    Number(process.env.WORKER_REQUEST_TIMEOUT_MS || 5000),
  );
  let response;
  try {
    response = await fetch(
      `${worker.url}/internal/actors/${encodeURIComponent(actorId)}/message`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ...body,
          messageId,
          generation: assignment.generation,
          singletonGeneration,
        }),
        signal: timeout,
      },
    );
  } catch (error) {
    const e = new Error(
      `Worker ${worker.workerId} is unreachable: ${error.message}`,
    );
    e.status = 503;
    throw e;
  }
  const result = await response.json();
  if (!response.ok) {
    const e = new Error(result.error || 'Worker rejected message');
    e.status = response.status;
    throw e;
  }
  return { ...result, messageId, duplicate: Boolean(result.duplicate) };
}

export async function workerProcess(workerId, actorId, body) {
  const ownershipRaw = await redis.hGet(OWNER_KEY, actorId);
  if (!ownershipRaw) {
    const e = new Error('Actor ownership is not registered');
    e.status = 409;
    throw e;
  }
  const ownership = JSON.parse(ownershipRaw);
  if (
    ownership.workerId !== workerId ||
    ownership.generation !== Number(body.generation)
  ) {
    const e = new Error('Stale worker ownership generation');
    e.status = 409;
    throw e;
  }
  const prior = await Message.findOne({ messageId: body.messageId });
  if (prior)
    return {
      actor: await Actor.findOne({ actorId }),
      result: prior.result,
      duplicate: true,
    };
  const actor = await Actor.findOne({
    actorId,
    workerId,
    ownerGeneration: Number(body.generation),
  }).select('+processedMessages');
  if (!actor) {
    const e = new Error('Actor is not assigned to this worker');
    e.status = 409;
    throw e;
  }
  const processed = actor.processedMessages.find(
    (entry) => entry.messageId === body.messageId,
  );
  if (processed)
    return {
      actor: await Actor.findOne({ actorId }),
      result: processed.result,
      duplicate: true,
    };
  if (actor.actorType === 'GlobalSchedulerActor') {
    const leaseRaw = await redis.get(LEASE_KEY);
    const leaseStatus = await redis.hGet(
      'actorlab:singleton:status',
      'generation',
    );
    let current;
    try {
      current = JSON.parse(leaseRaw);
    } catch {}
    if (
      current?.workerId !== workerId ||
      Number(leaseStatus) !== Number(body.singletonGeneration)
    ) {
      const e = new Error('Singleton lease fencing check failed');
      e.status = 409;
      throw e;
    }
  }
  const { operation, payload = {} } = body;
  let result;
  if (actor.actorType === 'CounterActor') {
    if (operation === 'increment' || operation === 'decrement') {
      const amount = Number(payload.amount ?? 1);
      if (!Number.isFinite(amount) || amount <= 0) {
        const e = new Error('Counter amount must be greater than zero');
        e.status = 400;
        throw e;
      }
      actor.state.count += operation === 'increment' ? amount : -amount;
    } else if (operation !== 'get') {
      const e = new Error('CounterActor supports increment, decrement, get');
      e.status = 400;
      throw e;
    }
    result = { count: actor.state.count };
  } else if (actor.actorType === 'BankAccountActor') {
    if (operation === 'deposit') {
      const amount = Number(payload.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        const e = new Error('Deposit amount must be greater than zero');
        e.status = 400;
        throw e;
      }
      actor.state.balance += amount;
    } else if (operation === 'withdraw') {
      const amount = Number(payload.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        const e = new Error('Withdrawal amount must be greater than zero');
        e.status = 400;
        throw e;
      }
      if (actor.state.balance - amount < 0) {
        const e = new Error('Insufficient funds');
        e.status = 409;
        throw e;
      }
      actor.state.balance -= amount;
    } else if (operation !== 'getBalance') {
      const e = new Error(
        'BankAccountActor supports deposit, withdraw, getBalance',
      );
      e.status = 400;
      throw e;
    }
    result = { balance: actor.state.balance };
  } else {
    if (operation === 'tick') actor.state.ticks += 1;
    else if (operation === 'addJob')
      actor.state.jobs.push({
        id: crypto.randomUUID(),
        name: String(payload.name || 'untitled'),
        createdAt: new Date(),
      });
    else if (operation !== 'get') {
      const e = new Error('GlobalSchedulerActor supports tick, addJob, get');
      e.status = 400;
      throw e;
    }
    result = { jobs: actor.state.jobs, ticks: actor.state.ticks };
  }
  const oldVersion = actor.version;
  actor.version += 1;
  actor.lastActiveAt = new Date();
  actor.status = 'active';
  const saved = await Actor.updateOne(
    {
      _id: actor._id,
      version: oldVersion,
      workerId,
      ownerGeneration: Number(body.generation),
      'processedMessages.messageId': { $ne: body.messageId },
    },
    {
      $set: {
        state: actor.state,
        version: actor.version,
        lastActiveAt: actor.lastActiveAt,
        status: actor.status,
      },
      $push: {
        processedMessages: {
          $each: [{ messageId: body.messageId, result }],
          $slice: -256,
        },
      },
    },
  );
  if (!saved.modifiedCount) {
    const current = await Actor.findOne({ actorId }).select(
      '+processedMessages',
    );
    const duplicate = current?.processedMessages.find(
      (entry) => entry.messageId === body.messageId,
    );
    if (duplicate)
      return {
        actor: await Actor.findOne({ actorId }),
        result: duplicate.result,
        duplicate: true,
      };
    const e = new Error(
      'Actor version changed during processing; retry with the same messageId',
    );
    e.status = 409;
    throw e;
  }
  try {
    await Message.create({
      messageId: body.messageId,
      actorId,
      operation,
      payload,
      result,
    });
  } catch (error) {
    if (error.code !== 11000)
      console.error(
        'Message result log failed after actor state commit:',
        error.message,
      );
  }
  try {
    await redis.hSet(
      WORKER_KEY,
      workerId,
      JSON.stringify({
        ...(await getWorker(workerId)),
        activeActors: await Actor.countDocuments({
          workerId,
          status: 'active',
        }),
        lastHeartbeat: new Date().toISOString(),
      }),
    );
  } catch (error) {
    console.error(
      'Worker metric update failed after actor state commit:',
      error.message,
    );
  }
  return { actor: await Actor.findOne({ actorId }), result };
}

async function getWorker(workerId) {
  const raw = await redis.hGet(WORKER_KEY, workerId);
  return raw ? JSON.parse(raw) : { workerId };
}

export async function dashboardData() {
  const [
    totalActors,
    activeActors,
    totalMessages,
    workerResult,
    events,
    actorCounts,
  ] = await Promise.all([
    Actor.countDocuments(),
    Actor.countDocuments({ status: 'active' }),
    Message.countDocuments(),
    listWorkers()
      .then((workers) => ({ workers, available: true }))
      .catch(() => ({ workers: [], available: false })),
    RuntimeEvent.find().sort({ createdAt: -1 }).limit(8).lean(),
    Actor.aggregate([{ $group: { _id: '$workerId', count: { $sum: 1 } } }]),
  ]);
  return {
    totalActors,
    activeActors,
    totalMessages,
    workers: workerResult.workers,
    coordinationAvailable: workerResult.available,
    events,
    actorCounts,
  };
}

export async function rebalance() {
  const workers = await listWorkers();
  if (workers.length < 2) {
    const e = new Error('At least two live workers are required to rebalance');
    e.status = 409;
    throw e;
  }
  const liveIds = new Set(workers.map((worker) => worker.workerId));
  const actors = await Actor.find({
    workerId: { $ne: null },
    actorType: { $ne: 'GlobalSchedulerActor' },
  }).sort({ createdAt: 1 });
  actors.sort(
    (a, b) => Number(liveIds.has(a.workerId)) - Number(liveIds.has(b.workerId)),
  );
  const counts = new Map(workers.map((w) => [w.workerId, 0]));
  for (const actor of actors)
    if (liveIds.has(actor.workerId))
      counts.set(actor.workerId, counts.get(actor.workerId) + 1);
  let moved = 0;
  for (const actor of actors) {
    const donor = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    const receiver = [...counts.entries()].sort((a, b) => a[1] - b[1])[0];
    const failedWorker = !liveIds.has(actor.workerId);
    if (
      !donor ||
      !receiver ||
      (!failedWorker &&
        (donor[1] - receiver[1] <= 1 || donor[0] === receiver[0]))
    )
      break;
    if (!failedWorker && actor.workerId !== donor[0]) continue;
    const current = await redis.hGet(OWNER_KEY, actor.actorId);
    const oldAssignment = current
      ? JSON.parse(current)
      : { generation: actor.ownerGeneration };
    const oldWorker = workers.find((w) => w.workerId === actor.workerId);
    actor.status = 'migrating';
    await actor.save();
    if (oldWorker)
      try {
        await fetch(
          `${oldWorker.url}/internal/actors/${encodeURIComponent(actor.actorId)}/drain`,
          { method: 'POST', signal: AbortSignal.timeout(3000) },
        );
      } catch {
        /* state is durable after each message */
      }
    const next = {
      workerId: receiver[0],
      generation: oldAssignment.generation + 1,
      changedAt: new Date().toISOString(),
    };
    actor.workerId = receiver[0];
    actor.ownerGeneration = next.generation;
    await actor.save();
    let swapped;
    try {
      swapped = await redis.eval(
        `local current = redis.call('hget', KEYS[1], ARGV[1]); if (current or '') == ARGV[2] then redis.call('hset', KEYS[1], ARGV[1], ARGV[3]); return 1 else return 0 end`,
        {
          keys: [OWNER_KEY],
          arguments: [actor.actorId, current || '', JSON.stringify(next)],
        },
      );
    } catch (error) {
      actor.status = 'idle';
      await actor.save();
      throw error;
    }
    if (Number(swapped) !== 1) {
      const latestRaw = await redis.hGet(OWNER_KEY, actor.actorId);
      if (latestRaw) {
        const latest = JSON.parse(latestRaw);
        actor.workerId = latest.workerId;
        actor.ownerGeneration = latest.generation;
      }
      actor.status = 'idle';
      await actor.save();
      continue;
    }
    actor.status = 'idle';
    await actor.save();
    if (!failedWorker) counts.set(donor[0], counts.get(donor[0]) - 1);
    counts.set(receiver[0], counts.get(receiver[0]) + 1);
    moved += 1;
  }
  await recordEvent(
    'actors.rebalanced',
    `Rebalancing moved ${moved} actor(s)`,
    { moved, distribution: Object.fromEntries(counts) },
  );
  return { moved, distribution: Object.fromEntries(counts) };
}

export async function acquireSingleton(workerId) {
  const ttl = Number(process.env.SINGLETON_LEASE_MS || 12000);
  const token = crypto.randomUUID();
  const acquired = await redis.set(
    LEASE_KEY,
    JSON.stringify({ workerId, token }),
    { NX: true, PX: ttl },
  );
  if (acquired) {
    const generation = await redis.incr('actorlab:singleton:generation');
    await redis.hSet('actorlab:singleton:status', {
      workerId,
      token,
      generation: String(generation),
      expiresAt: new Date(Date.now() + ttl).toISOString(),
    });
    await recordEvent(
      'singleton.acquired',
      `GlobalSchedulerActor lease acquired by ${workerId}`,
      { workerId, generation },
    );
    return {
      workerId,
      token,
      generation,
      expiresAt: new Date(Date.now() + ttl).toISOString(),
    };
  }
  return null;
}

export async function renewSingleton(lease) {
  const ttl = Number(process.env.SINGLETON_LEASE_MS || 12000);
  const renewed = await redis.eval(leaseScript, {
    keys: [LEASE_KEY],
    arguments: [
      JSON.stringify({ workerId: lease.workerId, token: lease.token }),
      String(ttl),
    ],
  });
  if (Number(renewed)) {
    const expiresAt = new Date(Date.now() + ttl).toISOString();
    await redis.hSet('actorlab:singleton:status', {
      workerId: lease.workerId,
      token: lease.token,
      generation: String(lease.generation),
      expiresAt,
    });
    return { ...lease, expiresAt };
  }
  return null;
}

export async function singletonStatus() {
  try {
    const state = await redis.hGetAll('actorlab:singleton:status');
    const key = await redis.get(LEASE_KEY);
    if (!key)
      return {
        registered: true,
        owner: null,
        active: false,
        expiresAt: state.expiresAt || null,
        generation: state.generation || null,
      };
    let owner = {};
    try {
      owner = JSON.parse(key);
    } catch {}
    return {
      registered: true,
      owner: owner.workerId,
      active: true,
      expiresAt: state.expiresAt,
      generation: state.generation,
    };
  } catch {
    return {
      registered: false,
      owner: null,
      active: false,
      expiresAt: null,
      generation: null,
      unavailable: true,
    };
  }
}

export async function allRuntimeEvents(limit = 30) {
  return RuntimeEvent.find().sort({ createdAt: -1 }).limit(limit).lean();
}
