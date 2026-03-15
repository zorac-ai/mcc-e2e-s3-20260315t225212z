/**
 * Tests porting the original Python CLI tests to use the WASM module directly.
 *
 * Each test corresponds to a test case in tests/test_cli.py:
 *   - test_create_and_list_open_issues
 *   - test_list_includes_created_issue
 *   - test_close_issue_and_filter_closed
 *   - test_missing_issue_returns_non_zero
 *
 * Additional tests cover WASM-specific and boundary conditions.
 */
import { describe, it, expect } from "vitest";
// CJS module: use createRequire to import from Node.js compatible WASM build
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { add_issue, close_issue, list_issues } =
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require("../../issue-tracker-wasm/pkg-node/issue_tracker_wasm.js") as {
    add_issue: (state: string, title: string) => unknown;
    close_issue: (state: string, id: number) => unknown;
    list_issues: (state: string, status: string | undefined) => unknown;
  };

/** Helper: parse WASM result objects from serde_wasm_bindgen (plain JS objects) */
function emptyState(): string {
  return "";
}

describe("issue tracker WASM — ported from Python CLI tests", () => {
  // test_create_and_list_open_issues
  it("creates an issue and lists it as open", () => {
    let state = emptyState();

    const added = add_issue(state, "Ship the CLI") as {
      issue: { id: number; status: string; title: string };
      new_state: string;
    };
    expect(added.issue.id).toBe(1);
    expect(added.issue.status).toBe("open");
    state = added.new_state;

    const issues = list_issues(state, undefined) as Array<{
      title: string;
      id: number;
    }>;
    expect(issues).toHaveLength(1);
    expect(issues[0].title).toBe("Ship the CLI");
  });

  // test_list_includes_created_issue
  it("lists include the created issue with the same id and title", () => {
    let state = emptyState();

    const added = add_issue(state, "Document the commands") as {
      issue: { id: number; title: string };
      new_state: string;
    };
    state = added.new_state;

    const issues = list_issues(state, undefined) as Array<{
      id: number;
      title: string;
    }>;
    expect(issues[0].id).toBe(added.issue.id);
    expect(issues[0].title).toBe("Document the commands");
  });

  // test_close_issue_and_filter_closed
  it("closes an issue and filter by closed returns it", () => {
    let state = emptyState();

    const r1 = add_issue(state, "Close me") as { new_state: string };
    state = r1.new_state;

    const r2 = close_issue(state, 1) as {
      issue: { status: string; closed_at: string | null };
      new_state: string;
    };
    expect(r2.issue.status).toBe("closed");
    expect(r2.issue.closed_at).not.toBeNull();
    state = r2.new_state;

    const closed = list_issues(state, "closed") as Array<{ id: number }>;
    expect(closed).toHaveLength(1);
    expect(closed[0].id).toBe(1);
  });

  // test_missing_issue_returns_non_zero (adapted: WASM throws instead of returning non-zero exit)
  it("closing a missing issue throws an error containing the issue id", () => {
    const state = emptyState();
    expect(() => close_issue(state, 999)).toThrow(/issue 999 not found/);
  });
});

describe("additional WASM boundary tests", () => {
  it("rejects empty title", () => {
    const state = emptyState();
    expect(() => add_issue(state, "")).toThrow(/title must not be empty/);
    expect(() => add_issue(state, "   ")).toThrow(/title must not be empty/);
  });

  it("trims whitespace from title", () => {
    let state = emptyState();
    const r = add_issue(state, "  trimmed  ") as {
      issue: { title: string };
      new_state: string;
    };
    expect(r.issue.title).toBe("trimmed");
  });

  it("ids increment across multiple adds", () => {
    let state = emptyState();
    const r1 = add_issue(state, "First") as { issue: { id: number }; new_state: string };
    state = r1.new_state;
    const r2 = add_issue(state, "Second") as { issue: { id: number }; new_state: string };
    expect(r1.issue.id).toBe(1);
    expect(r2.issue.id).toBe(2);
  });

  it("filter by open excludes closed issues", () => {
    let state = emptyState();
    const r1 = add_issue(state, "A") as { new_state: string };
    state = r1.new_state;
    const r2 = add_issue(state, "B") as { new_state: string };
    state = r2.new_state;
    const r3 = close_issue(state, 1) as { new_state: string };
    state = r3.new_state;

    const open = list_issues(state, "open") as Array<{ id: number }>;
    expect(open).toHaveLength(1);
    expect(open[0].id).toBe(2);
  });

  it("closing an already-closed issue is idempotent", () => {
    let state = emptyState();
    const r1 = add_issue(state, "Idempotent") as { new_state: string };
    state = r1.new_state;
    const r2 = close_issue(state, 1) as { issue: { status: string }; new_state: string };
    state = r2.new_state;
    const r3 = close_issue(state, 1) as { issue: { status: string }; new_state: string };
    expect(r3.issue.status).toBe("closed");
  });

  it("empty state produces empty list", () => {
    const issues = list_issues("", undefined) as unknown[];
    expect(issues).toHaveLength(0);
  });
});
