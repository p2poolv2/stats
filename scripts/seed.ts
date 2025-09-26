import 'dotenv/config';
import * as fs from 'fs';
import { getDb } from '../lib/db';
import { PoolStats } from '../lib/entities/PoolStats';

// CKPool-compatible stats interface
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
  diff: string;
  accepted: string;
  rejected: string;
  bestshare: string;
  SPS1m: string;
  SPS5m: string;
  SPS15m: string;
  SPS1h: string;
  timestamp: Date;
}

// Define P2Pool JSON schema
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

// Path to P2Pool JSON stats
const filePath = process.env.POOL_STATS_DIR + '/pool_stats.json';

// Reads P2Pool JSON from disk
function readP2PoolJson(): P2PoolJson {
  try {
    const data = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(data);
  } catch (error: any) {
    throw new Error(`Failed to read P2Pool JSON file: ${error.message}`);
  }
}

// Utility constant for 2^32
const HASHRATE_FACTOR = Math.pow(2, 32);

// Helper for scaling hashrate fields
function scaleHashrate(value?: number | null): string {
  return BigInt(Math.round(Number(value || 0) * HASHRATE_FACTOR)).toString();
}

// Transform P2Pool format to CKPool format
function p2poolToCkpool(p2pool: P2PoolJson): PoolStatsData {
  const userList = Object.values(p2pool.users || {});
  let hashrateFields = p2pool.computed_hashrate;

  // Pool-level
  if (!hashrateFields && userList.length > 0) {
    hashrateFields = userList[0].computed_hash_rate;
  }

  // First worker
  if (!hashrateFields && userList.length > 0) {
    const workers = Object.values(userList[0].workers || {});
    if (workers.length > 0 && workers[0].computed_hash_rate) {
      hashrateFields = workers[0].computed_hash_rate;
    }
  }

  // Fallback
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
    diff: String(p2pool.difficulty ?? '0'),
    accepted: String(p2pool.accepted ?? '0'),
    rejected: String(p2pool.rejected ?? '0'),
    bestshare: String(p2pool.bestshare ?? '0'),
    SPS1m: String(p2pool.computed_share_rate?.shares_per_second_1m ?? '0'),
    SPS5m: String(p2pool.computed_share_rate?.shares_per_second_5m ?? '0'),
    SPS15m: String(p2pool.computed_share_rate?.shares_per_second_15m ?? '0'),
    SPS1h: String(p2pool.computed_share_rate?.shares_per_second_1h ?? '0'),
    timestamp: new Date(
      ((p2pool.lastupdate ?? Math.floor(Date.now() / 1000)) * 1000)
    ),
  };
}

// Unified fetch logic
async function fetchPoolStats(): Promise<PoolStatsData> {
  const p2poolJson = readP2PoolJson();
  return p2poolToCkpool(p2poolJson);
}

// Seed db using CKPool format
async function seed() {
  let db: any;
  try {
    console.log('Reading pool stats from disk...');
    const stats = await fetchPoolStats();

    console.log('Saving pool stats to database...');
    db = await getDb();
    const poolStatsRepository = db.getRepository(PoolStats);

    const poolStats = poolStatsRepository.create({
      runtime: stats.runtime,
      users: stats.users,
      workers: stats.workers,
      idle: stats.idle,
      disconnected: stats.disconnected,
      hashrate1m: BigInt(stats.hashrate1m),
      hashrate5m: BigInt(stats.hashrate5m),
      hashrate15m: BigInt(stats.hashrate15m),
      hashrate1hr: BigInt(stats.hashrate1hr),
      hashrate6hr: BigInt(stats.hashrate6hr),
      hashrate1d: BigInt(stats.hashrate1d),
      hashrate7d: BigInt(stats.hashrate7d),
      diff: stats.diff,
      accepted: stats.accepted,
      rejected: stats.rejected,
      bestshare: stats.bestshare,
      SPS1m: stats.SPS1m,
      SPS5m: stats.SPS5m,
      SPS15m: stats.SPS15m,
      SPS1h: stats.SPS1h,
      timestamp: stats.timestamp,
    });

    await poolStatsRepository.save(poolStats);
    console.log('Database seeded successfully');
  } catch (error) {
    console.error('Error seeding database:', error);
  } finally {
    if (db) {
      await db.destroy();
    }
  }
}

(async () => {
  try {
    await seed();
    console.log('Seeding completed successfully.');
  } catch (error) {
    console.error('Error during seeding:', error);
    process.exit(1);
  }
})();
