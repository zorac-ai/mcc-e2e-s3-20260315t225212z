export interface Issue {
  id: number;
  title: string;
  status: "open" | "closed";
  created_at: string;
  closed_at: string | null;
}

export interface AddResult {
  issue: Issue;
  new_state: string;
}

export interface CloseResult {
  issue: Issue;
  new_state: string;
}

export type StatusFilter = "all" | "open" | "closed";
