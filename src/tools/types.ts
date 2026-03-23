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

export type ToolResponse<T> = {
  content: ToolTextContent[];
  structuredContent: T;
};

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

export type ListTablesResult = TableSummary[];
export type DescribeTableResult = TableDescription;
export type ListRelationshipsResult = RelationshipSummary[];
export type RunReadonlyQueryResult = ReadonlyQueryResult;
export type ExplainQueryResultPayload = ExplainQueryResult;
export type SampleRowsResult = ReadonlyQueryResult;
