require('dotenv').config(); 
const fs = require('fs');
const path = require('path');
const { getDb } = require('../lib/db');
const { User } = require('../lib/entities/User');
const { UserStats } = require('../lib/entities/UserStats');
const { Worker } = require('../lib/entities/Worker');
const { WorkerStats } = require('../lib/entities/WorkerStats');

const HASHRATE_FACTOR = Math.pow(2, 32);

function scaleHashrate(value) {
  return BigInt(Math.round(Number(value || 0) * HASHRATE_FACTOR));
}

async function updateUsersFromJson() {
  const filePath = path.join(process.env.LOGS_DIR || path.resolve(__dirname, '..'), 'pool_stats.json');

  let db;
  try {
    const data = fs.readFileSync(filePath, 'utf-8');
    const json = JSON.parse(data);

    const usersArray = Object.entries(json.users || {});
    console.log(`Found ${usersArray.length} users in pool_stats.json`);

    db = await getDb();
    const userRepo = db.getRepository(User);
    const userStatsRepo = db.getRepository(UserStats);
    const workerRepo = db.getRepository(Worker);
    const workerStatsRepo = db.getRepository(WorkerStats);

    for (const [address, user] of usersArray) {
      const userEntity = userRepo.create({ address });
      await userRepo.save(userEntity);

      const userStatsEntity = userStatsRepo.create({
        userAddress: address,
        hashrate1m: scaleHashrate(user.computed_hash_rate?.hashrate_1m),
        hashrate5m: scaleHashrate(user.computed_hash_rate?.hashrate_5m),
        hashrate1hr: scaleHashrate(user.computed_hash_rate?.hashrate_1hr),
        hashrate1d: scaleHashrate(user.computed_hash_rate?.hashrate_1d),
        hashrate7d: scaleHashrate(user.computed_hash_rate?.hashrate_7d),
        timestamp: new Date(((json.lastupdate ?? Math.floor(Date.now() / 1000)) * 1000)),
      });
      await userStatsRepo.save(userStatsEntity);

      const workers = Object.entries(user.workers || {});
      for (const [workerName, workerData] of workers) {
        const workerEntity = workerRepo.create({
          userAddress: address,
          name: workerName,
          hashrate1m: scaleHashrate(workerData.computed_hash_rate?.hashrate_1m),
          hashrate5m: scaleHashrate(workerData.computed_hash_rate?.hashrate_5m),
          hashrate1hr: scaleHashrate(workerData.computed_hash_rate?.hashrate_1hr),
          hashrate1d: scaleHashrate(workerData.computed_hash_rate?.hashrate_1d),
          hashrate7d: scaleHashrate(workerData.computed_hash_rate?.hashrate_7d),
        });
        await workerRepo.save(workerEntity);

        const workerStatsEntity = workerStatsRepo.create({
          workerId: workerEntity.id,
          hashrate1m: scaleHashrate(workerData.computed_hash_rate?.hashrate_1m),
          hashrate5m: scaleHashrate(workerData.computed_hash_rate?.hashrate_5m),
          hashrate1hr: scaleHashrate(workerData.computed_hash_rate?.hashrate_1hr),
          hashrate1d: scaleHashrate(workerData.computed_hash_rate?.hashrate_1d),
          hashrate7d: scaleHashrate(workerData.computed_hash_rate?.hashrate_7d),
          timestamp: new Date(((json.lastupdate ?? Math.floor(Date.now() / 1000)) * 1000)),
        });
        await workerStatsRepo.save(workerStatsEntity);
      }

      console.log(`Updated user and workers for: ${address}`);
    }

    console.log('All users and workers updated successfully (JSON updated)');
  } catch (err) {
    console.error('Error updating users:', err);
  } finally {
    if (db) await db.destroy();
  }
}

(async () => {
  await updateUsersFromJson();
})();
