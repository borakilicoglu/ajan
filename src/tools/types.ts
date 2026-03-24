import { z } from "zod";

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

export type ToolErrorCode =
  | "INVALID_QUERY"
  | "NOT_FOUND"
  | "INVALID_INPUT"
  | "RESULT_LIMIT_EXCEEDED"
  | "RESULT_TOO_LARGE"
  | "INTERNAL_ERROR";

export type ToolError = {
  code: ToolErrorCode;
  message: string;
};

export type ToolResponse<T> = {
  content: ToolTextContent[];
  structuredContent: T;
};

export type ErrorToolResponse = ToolResponse<{
  ok: false;
  error: ToolError;
}>;

export const serverInfoInput = z.object({});
export const serverInfoSchema = serverInfoInput.shape;

export const describeTableInput = z.object({
  name: z.string().min(1),
  schema: z.string().min(1).optional(),
});

export const describeTableSchema = describeTableInput.shape;
export type DescribeTableArgs = z.infer<typeof describeTableInput>;

export const runReadonlyQueryInput = z.object({
  sql: z.string().min(1),
});

export const runReadonlyQuerySchema = runReadonlyQueryInput.shape;
export type RunReadonlyQueryArgs = z.infer<typeof runReadonlyQueryInput>;

export const explainQueryInput = z.object({
  sql: z.string().min(1),
});

export const explainQuerySchema = explainQueryInput.shape;
export type ExplainQueryArgs = z.infer<typeof explainQueryInput>;

export const sampleRowsInput = z.object({
  name: z.string().min(1),
  schema: z.string().min(1).optional(),
  limit: z.number().int().positive().max(100).optional(),
  columns: z.array(z.string().min(1)).optional(),
});

export const sampleRowsSchema = sampleRowsInput.shape;
export type SampleRowsArgs = z.infer<typeof sampleRowsInput>;

export const searchSchemaInput = z.object({
  query: z.string().min(1),
  schema: z.string().min(1).optional(),
  limit: z.number().int().positive().max(50).optional(),
});

export const searchSchemaSchema = searchSchemaInput.shape;
export type SearchSchemaArgs = z.infer<typeof searchSchemaInput>;

export type ServerInfoResult = {
  name: string;
  version: string;
  dialect: string;
  tools: string[];
  resources: string[];
  readonly: {
    defaultLimit: number;
    maxLimit: number;
    timeoutMs: number;
    maxResultBytes: number;
  };
};

export type SearchSchemaMatch = {
  schema: string;
  table: string;
  column: string | null;
  dataType: string | null;
  matchType: "table" | "column";
};

export type SearchSchemaResult = {
  query: string;
  schema: string | null;
  totalMatches: number;
  matches: SearchSchemaMatch[];
};

export type ListTablesResult = TableSummary[];
export type DescribeTableResult = TableDescription;
export type ListRelationshipsResult = RelationshipSummary[];
export type ServerInfoResultPayload = ServerInfoResult;
export type SearchSchemaResultPayload = SearchSchemaResult;
export type RunReadonlyQueryResult = ReadonlyQueryResult;
export type ExplainQueryResultPayload = ExplainQueryResult;
export type SampleRowsResult = ReadonlyQueryResult;
