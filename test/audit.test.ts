import { afterEach, describe, expect, it, vi } from "vitest";

import {
  auditQueryEvent,
  configureQueryAudit,
  getQueryAuditConfig,
} from "../src/audit";

afterEach(() => {
  configureQueryAudit({ enabled: false });
  vi.restoreAllMocks();
});

describe("query audit logging", () => {
  it("does not write audit events when disabled", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    auditQueryEvent({
      operation: "run_readonly_query",
      status: "allowed",
      sql: "select 1",
    });

    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("writes audit events to stderr when enabled", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    configureQueryAudit({ enabled: true });

    auditQueryEvent({
      operation: "run_readonly_query",
      status: "rejected",
      sql: "delete from users",
      error: "Only SELECT queries are allowed",
    });

    expect(getQueryAuditConfig()).toEqual({ enabled: true });
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy.mock.calls[0][0]).toContain("[ajan-sql:audit]");
    expect(errorSpy.mock.calls[0][0]).toContain("\"status\":\"rejected\"");
  });
});
