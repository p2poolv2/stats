import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { PoolStats } from './entities/PoolStats';
import { User } from './entities/User';
import { UserStats } from './entities/UserStats';
import { Worker } from './entities/Worker';
import { WorkerStats } from './entities/WorkerStats';
import * as url from 'url';

const databaseUrl = process.env.DATABASE_URL!;
const params = new url.URL(databaseUrl);

const AppDataSource = new DataSource({
  type: 'postgres',
  host: params.hostname,
  port: parseInt(params.port || '5432'),
  username: params.username,
  password: params.password,
  database: params.pathname.slice(1),
  entities: [PoolStats, User, UserStats, Worker, WorkerStats],
  logging: process.env.NODE_ENV === 'development',
  ssl: {
    rejectUnauthorized: params.searchParams.get('sslmode') === 'require',
  },
  extra: {
    max: 10,
    min: 2,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  },
});

let connectionPromise: Promise<DataSource> | null = null;

export async function getDb() {
  if (!connectionPromise) {
    connectionPromise = AppDataSource.initialize().catch((error) => {
      console.error('Database connection error:', error);
      connectionPromise = null;
      throw error;
    });
  }
  return connectionPromise;
}

export default AppDataSource;
