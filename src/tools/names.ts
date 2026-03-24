export const TOOL_NAMES = {
  serverInfo: "server_info",
  listTables: "list_tables",
  describeTable: "describe_table",
  listRelationships: "list_relationships",
  searchSchema: "search_schema",
  runReadonlyQuery: "run_readonly_query",
  explainQuery: "explain_query",
  sampleRows: "sample_rows",
} as const;

export const TOOL_NAME_LIST = [
  TOOL_NAMES.serverInfo,
  TOOL_NAMES.listTables,
  TOOL_NAMES.describeTable,
  TOOL_NAMES.listRelationships,
  TOOL_NAMES.searchSchema,
  TOOL_NAMES.runReadonlyQuery,
  TOOL_NAMES.explainQuery,
  TOOL_NAMES.sampleRows,
] as const;

export type ToolName = (typeof TOOL_NAME_LIST)[number];
