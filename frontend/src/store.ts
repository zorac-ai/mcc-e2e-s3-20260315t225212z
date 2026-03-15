/**
 * Wrapper around the WASM issue-tracker module.
 * All state is persisted in localStorage under STORAGE_KEY.
 */
import type { Issue, AddResult, CloseResult } from "./types";

const STORAGE_KEY = "issue_tracker_state";

function loadState(): string {
  return localStorage.getItem(STORAGE_KEY) ?? "";
}

function saveState(state: string): void {
  localStorage.setItem(STORAGE_KEY, state);
}

export async function getWasm() {
  // Dynamic import so vite can handle the WASM module
  const wasm = await import("issue-tracker-wasm");
  return wasm;
}

export async function listIssues(status?: "open" | "closed"): Promise<Issue[]> {
  const wasm = await getWasm();
  const state = loadState();
  return wasm.list_issues(state, status) as Issue[];
}

export async function addIssue(title: string): Promise<Issue> {
  const wasm = await getWasm();
  const state = loadState();
  const result = wasm.add_issue(state, title) as AddResult;
  saveState(result.new_state);
  return result.issue;
}

export async function closeIssue(id: number): Promise<Issue> {
  const wasm = await getWasm();
  const state = loadState();
  const result = wasm.close_issue(state, id) as CloseResult;
  saveState(result.new_state);
  return result.issue;
}
