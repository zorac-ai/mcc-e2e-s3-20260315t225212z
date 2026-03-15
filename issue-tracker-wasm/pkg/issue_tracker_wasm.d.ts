/* tslint:disable */
/* eslint-disable */

/**
 * Add an issue to the store. Returns `{ issue, new_state }`.
 */
export function add_issue(state_json: string, title: string): any;

/**
 * Close an issue in the store. Returns `{ issue, new_state }`.
 */
export function close_issue(state_json: string, issue_id: number): any;

/**
 * List issues from the given JSON state.
 * Returns a JS array of issue objects.
 * Optionally filter by status ("open" or "closed").
 */
export function list_issues(state_json: string, status?: string | null): any;
