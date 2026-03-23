import type {
  RelationshipSummary,
  TableDescription,
  TableSummary,
} from "../db/schema";
import type {
  ExplainQueryResult,
  ReadonlyQueryResult,
} from "../query-runner";

export type ToolTextContent = {
  type: "text";
  text: string;
};

export type ToolResponse<T> = {
  content: ToolTextContent[];
  structuredContent: T;
};

export type DescribeTableArgs = {
  name: string;
  schema?: string;
};

export type RunReadonlyQueryArgs = {
  sql: string;
};

export type ExplainQueryArgs = {
  sql: string;
};

export type SampleRowsArgs = {
  name: string;
  schema?: string;
  limit?: number;
  columns?: string[];
};

export type ListTablesResult = TableSummary[];
export type DescribeTableResult = TableDescription;
export type ListRelationshipsResult = RelationshipSummary[];
export type RunReadonlyQueryResult = ReadonlyQueryResult;
export type ExplainQueryResultPayload = ExplainQueryResult;
export type SampleRowsResult = ReadonlyQueryResult;
