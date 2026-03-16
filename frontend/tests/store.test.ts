/**
 * Tests for store.ts — LocalStorage persistence layer.
 *
 * These tests verify that loadState/saveState correctly interact with
 * localStorage, and that addIssue/closeIssue/listIssues correctly thread
 * state through the WASM module and persist it.
 *
 * The WASM module is mocked so that these tests focus purely on the
 * localStorage integration, not the WASM logic (which is covered by tracker.test.ts).
 */
// @vitest-environment happy-dom

import { describe, it, expect, vi, beforeEach } from "vitest";

// Must be declared before importing store.ts so vitest can hoist it.
vi.mock("issue-tracker-wasm", () => ({
  add_issue: vi.fn(),
  close_issue: vi.fn(),
  list_issues: vi.fn(),
}));

import { addIssue, closeIssue, listIssues } from "../src/store";
import * as wasmMock from "issue-tracker-wasm";

const STORAGE_KEY = "issue_tracker_state";

// Convenience cast to access mock functions
const mocked = wasmMock as {
  add_issue: ReturnType<typeof vi.fn>;
  close_issue: ReturnType<typeof vi.fn>;
  list_issues: ReturnType<typeof vi.fn>;
};

const makeIssue = (id: number, title: string, status: "open" | "closed" = "open") => ({
  id,
  title,
  status,
  created_at: "2026-01-01T00:00:00Z",
  closed_at: status === "closed" ? "2026-01-02T00:00:00Z" : null,
});

describe("store.ts — LocalStorage persistence", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe("listIssues", () => {
    it("passes empty string to WASM when localStorage is empty", async () => {
      mocked.list_issues.mockReturnValue([]);

      await listIssues();

      expect(mocked.list_issues).toHaveBeenCalledWith("", undefined);
    });

    it("passes persisted state from localStorage to WASM", async () => {
      const persistedState = "serialized-state-abc";
      localStorage.setItem(STORAGE_KEY, persistedState);
      mocked.list_issues.mockReturnValue([]);

      await listIssues("open");

      expect(mocked.list_issues).toHaveBeenCalledWith(persistedState, "open");
    });

    it("passes status filter argument through to WASM", async () => {
      mocked.list_issues.mockReturnValue([]);

      await listIssues("closed");

      expect(mocked.list_issues).toHaveBeenCalledWith("", "closed");
    });

    it("does not modify localStorage", async () => {
      localStorage.setItem(STORAGE_KEY, "unchanged");
      mocked.list_issues.mockReturnValue([]);

      await listIssues();

      expect(localStorage.getItem(STORAGE_KEY)).toBe("unchanged");
    });
  });

  describe("addIssue", () => {
    it("saves new_state to localStorage after adding", async () => {
      const newState = "state-after-add";
      mocked.add_issue.mockReturnValue({ issue: makeIssue(1, "Test"), new_state: newState });

      await addIssue("Test");

      expect(localStorage.getItem(STORAGE_KEY)).toBe(newState);
    });

    it("returns the added issue", async () => {
      const issue = makeIssue(1, "My Issue");
      mocked.add_issue.mockReturnValue({ issue, new_state: "s1" });

      const result = await addIssue("My Issue");

      expect(result).toEqual(issue);
    });

    it("reads current state from localStorage before calling WASM", async () => {
      const existingState = "existing-state";
      localStorage.setItem(STORAGE_KEY, existingState);
      mocked.add_issue.mockReturnValue({ issue: makeIssue(2, "New"), new_state: "s2" });

      await addIssue("New");

      expect(mocked.add_issue).toHaveBeenCalledWith(existingState, "New");
    });

    it("state chains correctly across multiple adds", async () => {
      const state1 = "state-1";
      const state2 = "state-2";
      mocked.add_issue
        .mockReturnValueOnce({ issue: makeIssue(1, "First"), new_state: state1 })
        .mockReturnValueOnce({ issue: makeIssue(2, "Second"), new_state: state2 });

      await addIssue("First");
      // Second add must read state1 (saved by the first add) from localStorage
      await addIssue("Second");

      expect(mocked.add_issue).toHaveBeenNthCalledWith(2, state1, "Second");
      expect(localStorage.getItem(STORAGE_KEY)).toBe(state2);
    });
  });

  describe("closeIssue", () => {
    it("saves new_state to localStorage after closing", async () => {
      const newState = "state-after-close";
      mocked.close_issue.mockReturnValue({ issue: makeIssue(1, "Done", "closed"), new_state: newState });

      await closeIssue(1);

      expect(localStorage.getItem(STORAGE_KEY)).toBe(newState);
    });

    it("returns the closed issue", async () => {
      const issue = makeIssue(1, "Done", "closed");
      mocked.close_issue.mockReturnValue({ issue, new_state: "s1" });

      const result = await closeIssue(1);

      expect(result).toEqual(issue);
    });

    it("reads current state from localStorage before calling WASM", async () => {
      const existingState = "before-close";
      localStorage.setItem(STORAGE_KEY, existingState);
      mocked.close_issue.mockReturnValue({ issue: makeIssue(5, "X", "closed"), new_state: "after" });

      await closeIssue(5);

      expect(mocked.close_issue).toHaveBeenCalledWith(existingState, 5);
    });
  });

  describe("end-to-end persistence (WASM mocked)", () => {
    it("add then list reads back through localStorage", async () => {
      const stateAfterAdd = "state-after-add";
      mocked.add_issue.mockReturnValue({ issue: makeIssue(1, "Persistent"), new_state: stateAfterAdd });
      mocked.list_issues.mockReturnValue([makeIssue(1, "Persistent")]);

      await addIssue("Persistent");
      await listIssues();

      // listIssues must use the state that addIssue saved
      expect(mocked.list_issues).toHaveBeenCalledWith(stateAfterAdd, undefined);
    });

    it("add then close uses updated state", async () => {
      const stateAfterAdd = "state-with-open-issue";
      const stateAfterClose = "state-with-closed-issue";
      mocked.add_issue.mockReturnValue({ issue: makeIssue(1, "ToClose"), new_state: stateAfterAdd });
      mocked.close_issue.mockReturnValue({ issue: makeIssue(1, "ToClose", "closed"), new_state: stateAfterClose });

      await addIssue("ToClose");
      await closeIssue(1);

      expect(mocked.close_issue).toHaveBeenCalledWith(stateAfterAdd, 1);
      expect(localStorage.getItem(STORAGE_KEY)).toBe(stateAfterClose);
    });
  });
});
