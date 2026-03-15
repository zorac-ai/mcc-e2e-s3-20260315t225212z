import { useState, useEffect, useCallback } from "react";
import { listIssues, addIssue, closeIssue } from "./store";
import type { Issue, StatusFilter } from "./types";

const styles = {
  container: { maxWidth: 700, margin: "2rem auto", padding: "0 1rem" },
  header: { marginBottom: "1.5rem" },
  h1: { fontSize: "1.8rem", fontWeight: 700, color: "#222" },
  form: { display: "flex", gap: "0.5rem", marginBottom: "1.5rem" },
  input: {
    flex: 1,
    padding: "0.5rem 0.75rem",
    border: "1px solid #ccc",
    borderRadius: 4,
    fontSize: "1rem",
  },
  btn: {
    padding: "0.5rem 1rem",
    border: "none",
    borderRadius: 4,
    cursor: "pointer",
    fontSize: "1rem",
    background: "#0070f3",
    color: "#fff",
  },
  filters: { display: "flex", gap: "0.5rem", marginBottom: "1rem" },
  filterBtn: (active: boolean) => ({
    padding: "0.3rem 0.8rem",
    border: "1px solid #ccc",
    borderRadius: 4,
    cursor: "pointer",
    background: active ? "#0070f3" : "#fff",
    color: active ? "#fff" : "#333",
    fontSize: "0.9rem",
  }),
  list: { listStyle: "none" },
  listItem: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0.75rem",
    background: "#fff",
    borderRadius: 4,
    marginBottom: "0.5rem",
    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
  },
  badge: (status: string) => ({
    padding: "0.15rem 0.5rem",
    borderRadius: 12,
    fontSize: "0.75rem",
    fontWeight: 600,
    background: status === "open" ? "#e0f2fe" : "#f0fdf4",
    color: status === "open" ? "#0369a1" : "#166534",
  }),
  closeBtn: {
    padding: "0.25rem 0.6rem",
    border: "1px solid #d1d5db",
    borderRadius: 4,
    cursor: "pointer",
    background: "#fff",
    fontSize: "0.8rem",
    color: "#555",
  },
  empty: { color: "#888", textAlign: "center" as const, padding: "2rem" },
  error: {
    color: "#dc2626",
    fontSize: "0.9rem",
    marginBottom: "0.5rem",
  },
};

export default function App() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    const status = filter === "all" ? undefined : filter;
    const data = await listIssues(status);
    setIssues(data);
  }, [filter]);

  useEffect(() => {
    let cancelled = false;
    const status = filter === "all" ? undefined : filter;
    listIssues(status).then((data) => {
      if (!cancelled) setIssues(data);
    });
    return () => {
      cancelled = true;
    };
  }, [filter]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!title.trim()) {
      setError("タイトルは必須です");
      return;
    }
    setLoading(true);
    try {
      await addIssue(title.trim());
      setTitle("");
      await refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleClose(id: number) {
    setLoading(true);
    try {
      await closeIssue(id);
      await refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.h1}>Issue Tracker</h1>
      </div>

      <form style={styles.form} onSubmit={handleAdd}>
        <input
          style={styles.input}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="新しいIssueのタイトル"
          disabled={loading}
        />
        <button style={styles.btn} type="submit" disabled={loading}>
          追加
        </button>
      </form>

      {error && <p style={styles.error}>{error}</p>}

      <div style={styles.filters}>
        {(["all", "open", "closed"] as StatusFilter[]).map((f) => (
          <button
            key={f}
            style={styles.filterBtn(filter === f)}
            onClick={() => setFilter(f)}
          >
            {f === "all" ? "すべて" : f === "open" ? "オープン" : "クローズ済み"}
          </button>
        ))}
      </div>

      {issues.length === 0 ? (
        <p style={styles.empty}>Issueはありません</p>
      ) : (
        <ul style={styles.list}>
          {issues.map((issue) => (
            <li key={issue.id} style={styles.listItem}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <span style={{ fontWeight: 600, color: "#666", minWidth: 28 }}>
                  #{issue.id}
                </span>
                <span>{issue.title}</span>
                <span style={styles.badge(issue.status)}>{issue.status}</span>
              </div>
              {issue.status === "open" && (
                <button
                  style={styles.closeBtn}
                  onClick={() => handleClose(issue.id)}
                  disabled={loading}
                >
                  クローズ
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
