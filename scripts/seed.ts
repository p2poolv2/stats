import 'dotenv/config';
import * as fs from 'fs';
import { getDb } from '../lib/db';
import { PoolStats } from '../lib/entities/PoolStats';

// CKPool-compatible stats interface
interface PoolStatsData {
  runtime: string;
  users: string;
  workers: string;
  idle: string;
  disconnected: string;
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
}

//  Read P2Pool JSON from disk 
const filePath = process.env.POOL_STATS_FILE || './pool_stats.json';

async function readP2PoolJson(): Promise<any> {
  try {
    const data = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    throw new Error(`Failed to read P2Pool JSON file: ${error.message}`);
  }
}

//  Transform to CKPool format 
function p2poolToCkpool(p2pool: any): Partial<PoolStatsData> {
  return {
    runtime: String(p2pool.start_time ?? 0),
    users: String(p2pool.num_users ?? 0),
    workers: String(p2pool.num_workers ?? 0),
    idle: String(p2pool.num_idle_users ?? 0),
    disconnected: "0", 
    hashrate1m: String(p2pool.hashrate_1m ?? 0),
    hashrate5m: String(p2pool.hashrate_5m ?? 0),
    hashrate15m: String(p2pool.hashrate_15m ?? 0),
    hashrate1hr: String(p2pool.hashrate_1hr ?? 0),
    hashrate6hr: String(p2pool.hashrate_6hr ?? 0),
    hashrate1d: String(p2pool.hashrate_1d ?? 0),
    hashrate7d: String(p2pool.hashrate_7d ?? 0),
    diff: String(p2pool.difficulty ?? 0),
    accepted: String(p2pool.accepted ?? 0),
    rejected: String(p2pool.rejected ?? 0),
    bestshare: String(p2pool.bestshare ?? 0),
    SPS1m: String(p2pool.shares_per_second_1m ?? 0),
    SPS5m: String(p2pool.shares_per_second_5m ?? 0),
    SPS15m: String(p2pool.shares_per_second_15m ?? 0),
    SPS1h: String(p2pool.shares_per_second_1h ?? 0)
    // Optionally, handle timestamp as 
    // timestamp: new Date((p2pool.lastupdate ?? Date.now()) * 1000),
  };
}

//Step 3: Unified fetch logic 
async function fetchPoolStats(): Promise<Partial<PoolStatsData>> {
  const p2poolJson = await readP2PoolJson();
  return p2poolToCkpool(p2poolJson);
}

//  Step 4: Seed db using CKPool format 
async function seed() {
  try {
    console.log('Reading pool stats from disk...');
    const stats = await fetchPoolStats();
    
    console.log('Saving pool stats to database...');
    const db = await getDb();
    const poolStatsRepository = db.getRepository(PoolStats);

    const poolStats = poolStatsRepository.create({
      runtime: parseInt(stats.runtime ?? '0'),
      users: parseInt(stats.users ?? '0'),
      workers: parseInt(stats.workers ?? '0'),
      idle: parseInt(stats.idle ?? '0'),
      disconnected: stats.disconnected ? parseInt(stats.disconnected) : 0,
      hashrate1m: BigInt(stats.hashrate1m ?? '0'),
      hashrate5m: BigInt(stats.hashrate5m ?? '0'),
      hashrate15m: BigInt(stats.hashrate15m ?? '0'),
      hashrate1hr: BigInt(stats.hashrate1hr ?? '0'),
      hashrate6hr: BigInt(stats.hashrate6hr ?? '0'),
      hashrate1d: BigInt(stats.hashrate1d ?? '0'),
      hashrate7d: BigInt(stats.hashrate7d ?? '0'),
      diff: stats.diff,
      accepted: stats.accepted,
      rejected: stats.rejected,
      bestshare: stats.bestshare,
      SPS1m: stats.SPS1m,
      SPS5m: stats.SPS5m,
      SPS15m: stats.SPS15m,
      SPS1h: stats.SPS1h,
      timestamp: new Date(),
    } as Partial<PoolStats>);

    await poolStatsRepository.save(poolStats);
    console.log('Database seeded successfully');
  } catch (error) {
    console.error('Error seeding database:', error);
  } finally {
    const db = await getDb();
    await db.destroy();
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
