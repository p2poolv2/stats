import 'dotenv/config';
import 'reflect-metadata';
import * as fs from 'fs';
import { getDb } from '../lib/db';
import { User } from '../lib/entities/User';
import { UserStats } from '../lib/entities/UserStats';
import { Worker } from '../lib/entities/Worker';
import { WorkerStats } from '../lib/entities/WorkerStats';
import { convertHashrate } from '../utils/helpers';

const BATCH_SIZE = 10;

interface ComputedHashRate {
  hashrate_1m?: number;
  hashrate_5m?: number;
  hashrate_1hr?: number;
  hashrate_1d?: number;
  hashrate_7d?: number;
}

interface P2PoolWorker {
  computed_hash_rate?: ComputedHashRate;
  lastshare?: number;
  shares?: string;
  bestshare?: string;
  bestever?: string;
}

interface P2PoolUser {
  computed_hash_rate?: ComputedHashRate;
  workers?: Record<string, P2PoolWorker>;
  shares?: string;
  bestshare?: string;
  bestever?: string;
  authorised?: number;
}

interface P2PoolJson {
  users?: Record<string, P2PoolUser>;
  lastupdate?: number;
}

async function updateUsersFromJson(): Promise<void> {
  const statsFile = process.env.POOL_STATS_FILE || './pool_stats.json';

  console.log('Reading P2Pool stats from:', statsFile);
  const raw = fs.readFileSync(statsFile, 'utf-8');
  const json: P2PoolJson = JSON.parse(raw);

  const db = await getDb();
  try {
    const userEntries = Object.entries(json.users || {});
    console.log(`Found ${userEntries.length} users in JSON`);

    // Process in batches
    for (let i = 0; i < userEntries.length; i += BATCH_SIZE) {
      const batch = userEntries.slice(i, i + BATCH_SIZE);
      console.log(`Processing batch ${i / BATCH_SIZE + 1}`);

      await Promise.all(
        batch.map(async ([address, user]) => {
          await db.transaction(async (manager) => {
            const userRepository = manager.getRepository(User);
            const userStatsRepository = manager.getRepository(UserStats);
            const workerRepository = manager.getRepository(Worker);
            const workerStatsRepository = manager.getRepository(WorkerStats);

            // Upsert user
            let dbUser = await userRepository.findOne({ where: { address } });
            if (!dbUser) {
              dbUser = userRepository.create({
                address,
                authorised: String(user.authorised || 0),
                isActive: true,
              });
            } else {
              dbUser.isActive = true;
              dbUser.authorised = String(user.authorised || 0);
            }
            await userRepository.save(dbUser);

            // Insert user stats
            const hashrate = user.computed_hash_rate || {};
            const userStats = userStatsRepository.create({
              userAddress: address,
              hashrate1m: convertHashrate((hashrate.hashrate_1m || 0).toString()).toString(),
              hashrate5m: convertHashrate((hashrate.hashrate_5m || 0).toString()).toString(),
              hashrate1hr: convertHashrate((hashrate.hashrate_1hr || 0).toString()).toString(),
              hashrate1d: convertHashrate((hashrate.hashrate_1d || 0).toString()).toString(),
              hashrate7d: convertHashrate((hashrate.hashrate_7d || 0).toString()).toString(),
              shares: String(user.shares || 0),
              bestShare: parseFloat(user.bestshare || '0'),
              bestEver: String(user.bestever || 0),
              workerCount: Object.keys(user.workers || {}).length,
              lastShare: String(user.workers ? Math.max(...Object.values(user.workers).map(w => w.lastshare || 0)) : 0),
            });
            await userStatsRepository.save(userStats);

            // Workers
            for (const [workerName, worker] of Object.entries(user.workers || {})) {
              const wHashrate = worker.computed_hash_rate || {};
              let dbWorker = await workerRepository.findOne({
                where: { userAddress: address, name: workerName },
              });

              const workerValues = {
                hashrate1m: convertHashrate((wHashrate.hashrate_1m || 0).toString()).toString(),
                hashrate5m: convertHashrate((wHashrate.hashrate_5m || 0).toString()).toString(),
                hashrate1hr: convertHashrate((wHashrate.hashrate_1hr || 0).toString()).toString(),
                hashrate1d: convertHashrate((wHashrate.hashrate_1d || 0).toString()).toString(),
                hashrate7d: convertHashrate((wHashrate.hashrate_7d || 0).toString()).toString(),
                shares: String(worker.shares || 0),
                bestShare: parseFloat(worker.bestshare || '0'),
                bestEver: String(worker.bestever || 0),
                lastUpdate: new Date((worker.lastshare || 0) * 1000),
              };

              if (dbWorker) {
                Object.assign(dbWorker, workerValues);
              } else {
                dbWorker = workerRepository.create({
                  userAddress: address,
                  name: workerName,
                  ...workerValues,
                });
              }
              const savedWorker = await workerRepository.save(dbWorker);

              // WorkerStats snapshot
              const workerStats = workerStatsRepository.create({
                workerId: savedWorker.id,
                ...workerValues,
              });
              await workerStatsRepository.save(workerStats);
            }
          });
        })
      );
    }
  } finally {
    await db.destroy();
  }
}


updateUsersFromJson().catch(console.error);
