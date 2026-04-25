import { Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { processVoiceConfirm, VOICE_CONFIRM_RETRY } from './jobs/voice-confirm.js';

const connection = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

export const queues = {
  otp: new Queue('otp', { connection }),
  webhook: new Queue('webhook', { connection }),
  courier: new Queue('courier', { connection }),
  rto: new Queue('rto-scoring', { connection }),
  voiceConfirm: new Queue('voice-confirm', {
    connection,
    defaultJobOptions: {
      attempts: VOICE_CONFIRM_RETRY.attempts,
      backoff: VOICE_CONFIRM_RETRY.backoff,
      removeOnComplete: { count: 500 },
      removeOnFail: { count: 200 },
    },
  }),
} as const;

export type QueueName = keyof typeof queues;

function startWorker(name: QueueName): Worker {
  if (name === 'voiceConfirm') {
    return new Worker('voice-confirm', processVoiceConfirm, {
      connection,
      concurrency: 5,
    });
  }

  return new Worker(
    name,
    async (job) => {
      // eslint-disable-next-line no-console
      console.log(`[worker:${name}] processing job`, job.id, job.name, job.data);
      // TODO: dispatch to handlers under ./jobs/<name>.ts in Phase 1 PRs.
    },
    { connection },
  );
}

const workers = (Object.keys(queues) as QueueName[]).map(startWorker);

function shutdown(signal: NodeJS.Signals) {
  // eslint-disable-next-line no-console
  console.log(`[worker] received ${signal}, shutting down`);
  Promise.all(workers.map((w) => w.close()))
    .then(() => connection.quit())
    .then(() => process.exit(0))
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.error(err);
      process.exit(1);
    });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// eslint-disable-next-line no-console
console.log('[worker] online — queues:', Object.keys(queues).join(', '));
