import { createPool, type Pool } from "mysql2/promise";

export type MysqlPool = Pool;

type CreateMysqlPoolOptions = {
  uri: string;
  connectionLimit?: number;
};

export function createMysqlPool(options: CreateMysqlPoolOptions): MysqlPool {
  return createPool({
    uri: options.uri,
    connectionLimit: options.connectionLimit,
  });
}

export async function closeMysqlPool(pool: MysqlPool): Promise<void> {
  await pool.end();
}
