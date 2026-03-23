import type {
  RelationshipSummary,
  TableDescription,
  TableSummary,
} from "../db/schema";
import type {
  ExplainQueryResult,
  ReadonlyQueryResult,
} from "../query-runner";

export type DatabaseDialect = {
  name: string;
  listTables(): Promise<TableSummary[]>;
  describeTable(name: string, schema?: string): Promise<TableDescription | null>;
  listRelationships(): Promise<RelationshipSummary[]>;
  runReadonlyQuery(sql: string): Promise<ReadonlyQueryResult>;
  explainReadonlyQuery(sql: string): Promise<ExplainQueryResult>;
  sampleRows(
    name: string,
    schema?: string,
    limit?: number,
    columns?: string[],
  ): Promise<ReadonlyQueryResult>;
};
