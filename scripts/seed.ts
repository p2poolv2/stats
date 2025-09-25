import 'dotenv/config';
import * as fs from 'fs';
import { getDb } from '../lib/db';
import { PoolStats } from '../lib/entities/PoolStats';
import { User } from '../lib/entities/User';
import { UserStats } from '../lib/entities/UserStats';


interface ComputedHashRate {
  hashrate_1m?: number;
  hashrate_5m?: number;
  hashrate_15m?: number;
  hashrate_1hr?: number;
  hashrate_6hr?: number;
  hashrate_1d?: number;
  hashrate_7d?: number;
}

interface P2PoolWorker {
  computed_hash_rate?: ComputedHashRate;
}

interface P2PoolUser {
  computed_hash_rate?: ComputedHashRate;
  workers?: Record<string, P2PoolWorker>;
}

interface P2PoolJson {
  start_time?: number;
  lastupdate?: number;
  num_users?: number;
  num_workers?: number;
  num_idle_users?: number;
  accepted?: number;
  rejected?: number;
  bestshare?: number;
  difficulty?: number;
  users?: Record<string, P2PoolUser>;
  computed_hashrate?: ComputedHashRate;
  computed_share_rate?: {
    shares_per_second_1m?: number | null;
    shares_per_second_5m?: number | null;
    shares_per_second_15m?: number | null;
    shares_per_second_1h?: number | null;
  };
}

interface PoolStatsData {
  runtime: number;
  users: number;
  workers: number;
  idle: number;
  disconnected: number;
  hashrate1m: string;
  hashrate5m: string;
  hashrate15m: string;
  hashrate1hr: string;
  hashrate6hr: string;
  hashrate1d: string;
  hashrate7d: string;
  diff: number;
  accepted: string;
  rejected: string;
  bestshare: string;
  SPS1m: number;
  SPS5m: number;
  SPS15m: number;
  SPS1h: number;
  timestamp: Date;
}


const filePath = process.env.POOL_STATS_DIR + '/pool_stats.json';
const HASHRATE_FACTOR = Math.pow(2, 32);

function readP2PoolJson(): P2PoolJson {
  const data = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(data);
}

function scaleHashrate(value?: number | null): string {
  return BigInt(Math.round(Number(value || 0) * HASHRATE_FACTOR)).toString();
}

function p2poolToCkpool(p2pool: P2PoolJson): PoolStatsData {
  const usersList = Object.values(p2pool.users || {});
  let hashrateFields = p2pool.computed_hashrate;

  if (!hashrateFields && usersList.length > 0) {
    hashrateFields = usersList[0].computed_hash_rate;
  }

  if (!hashrateFields && usersList.length > 0) {
    const workers = Object.values(usersList[0].workers || {});
    if (workers.length > 0 && workers[0].computed_hash_rate) {
      hashrateFields = workers[0].computed_hash_rate;
    }
  }

  if (!hashrateFields) hashrateFields = {};

  return {
    runtime: p2pool.start_time ?? 0,
    users: p2pool.num_users ?? 0,
    workers: p2pool.num_workers ?? 0,
    idle: p2pool.num_idle_users ?? 0,
    disconnected: 0,
    hashrate1m: scaleHashrate(hashrateFields.hashrate_1m),
    hashrate5m: scaleHashrate(hashrateFields.hashrate_5m),
    hashrate15m: scaleHashrate(hashrateFields.hashrate_15m),
    hashrate1hr: scaleHashrate(hashrateFields.hashrate_1hr),
    hashrate6hr: scaleHashrate(hashrateFields.hashrate_6hr),
    hashrate1d: scaleHashrate(hashrateFields.hashrate_1d),
    hashrate7d: scaleHashrate(hashrateFields.hashrate_7d),
    diff: p2pool.difficulty ?? 0,
    accepted: String(p2pool.accepted ?? 0),
    rejected: String(p2pool.rejected ?? 0),
    bestshare: String(p2pool.bestshare ?? 0),
    SPS1m: p2pool.computed_share_rate?.shares_per_second_1m ?? 0,
    SPS5m: p2pool.computed_share_rate?.shares_per_second_5m ?? 0,
    SPS15m: p2pool.computed_share_rate?.shares_per_second_15m ?? 0,
    SPS1h: p2pool.computed_share_rate?.shares_per_second_1h ?? 0,
    timestamp: new Date(
      ((p2pool.lastupdate ?? Math.floor(Date.now() / 1000)) * 1000)
    ),
  };
}

// Seed
async function seed() {
  let db: any;
  try {
    console.log('Reading pool stats from disk...');
    const p2poolJson = readP2PoolJson();
    const stats = p2poolToCkpool(p2poolJson);

    db = await getDb();
    const poolRepo = db.getRepository(PoolStats);
    const userRepo = db.getRepository(User);
    const userStatsRepo = db.getRepository(UserStats);

    // Save pool stats
    const poolStats = poolRepo.create({
      ...stats,
      hashrate1m: BigInt(stats.hashrate1m),
      hashrate5m: BigInt(stats.hashrate5m),
      hashrate15m: BigInt(stats.hashrate15m),
      hashrate1hr: BigInt(stats.hashrate1hr),
      hashrate6hr: BigInt(stats.hashrate6hr),
      hashrate1d: BigInt(stats.hashrate1d),
      hashrate7d: BigInt(stats.hashrate7d),
    });
    await poolRepo.save(poolStats);

    // Top 10 users by 1-day hashrate
    const usersArray = Object.entries(p2poolJson.users || {});
    const topUsers = usersArray
      .map(([address, user]) => ({
        address,
        hashrate: user.computed_hash_rate?.hashrate_1d ?? 0,
        raw: user,
      }))
      .sort((a, b) => b.hashrate - a.hashrate)
      .slice(0, 10);

    for (const u of topUsers) {
      
      const userEntity = userRepo.create({
        address: u.address, 
      });
      await userRepo.save(userEntity);

      const userStatsEntity = userStatsRepo.create({
        userAddress: u.address,
        hashrate1d: BigInt(u.hashrate),
        timestamp: stats.timestamp,
      });
      await userStatsRepo.save(userStatsEntity);
    }

    console.log('Database seeded successfully');
  } catch (error) {
    console.error('Error seeding database:', error);
  } finally {
    if (db) await db.destroy();
  }
}

(async () => {
  await seed();
  console.log('Seeding completed successfully.');
})();
