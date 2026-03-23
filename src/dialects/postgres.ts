import type { DbPool } from "../db/pool";
import {
  describeTable,
  listRelationships,
  listTables,
} from "../db/schema";
import {
  explainReadonlyQuery,
  runReadonlyQuery,
  sampleRows,
} from "../query-runner";
import type { DatabaseDialect } from "./types";

export function createPostgresDialect(pool: DbPool): DatabaseDialect {
  return {
    name: "postgres",
    listTables: () => listTables(pool),
    describeTable: (name, schema) => describeTable(pool, name, schema),
    listRelationships: () => listRelationships(pool),
    runReadonlyQuery: (sql) => runReadonlyQuery(pool, sql),
    explainReadonlyQuery: (sql) => explainReadonlyQuery(pool, sql),
    sampleRows: (name, schema, limit, columns) =>
      sampleRows(pool, name, schema, limit, columns),
  };
}
