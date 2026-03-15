use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

#[cfg(target_arch = "wasm32")]
use js_sys::Date;

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct Issue {
    pub id: u32,
    pub title: String,
    pub status: String,
    pub created_at: String,
    pub closed_at: Option<String>,
}

/// Result returned from add_issue and close_issue WASM functions.
#[derive(Serialize)]
pub struct MutationResult {
    pub issue: Issue,
    pub new_state: String,
}

#[derive(Serialize, Deserialize, Debug, Default)]
pub struct Store {
    pub next_id: u32,
    pub issues: Vec<Issue>,
}

impl Store {
    pub fn new() -> Self {
        Store {
            next_id: 1,
            issues: vec![],
        }
    }

    pub fn from_json(json: &str) -> Self {
        if json.is_empty() {
            return Self::new();
        }
        serde_json::from_str(json).unwrap_or_else(|_| Self::new())
    }

    pub fn to_json(&self) -> String {
        serde_json::to_string_pretty(self).unwrap_or_else(|_| "{}".to_string())
    }

    pub fn list(&self, status: Option<&str>) -> Vec<Issue> {
        self.issues
            .iter()
            .filter(|i| status.map_or(true, |s| i.status == s))
            .cloned()
            .collect()
    }

    pub fn add(&mut self, title: &str) -> Result<Issue, String> {
        let cleaned = title.trim();
        if cleaned.is_empty() {
            return Err("title must not be empty".to_string());
        }
        let now = now_iso();
        let issue = Issue {
            id: self.next_id,
            title: cleaned.to_string(),
            status: "open".to_string(),
            created_at: now,
            closed_at: None,
        };
        self.next_id += 1;
        self.issues.push(issue.clone());
        Ok(issue)
    }

    pub fn close(&mut self, issue_id: u32) -> Result<Issue, String> {
        match self.issues.iter_mut().find(|i| i.id == issue_id) {
            None => Err(format!("issue {} not found", issue_id)),
            Some(issue) => {
                if issue.status != "closed" {
                    issue.status = "closed".to_string();
                    issue.closed_at = Some(now_iso());
                }
                Ok(issue.clone())
            }
        }
    }
}

#[cfg(target_arch = "wasm32")]
fn now_iso() -> String {
    let d = Date::new_0();
    d.to_iso_string().as_string().unwrap_or_default()
}

#[cfg(not(target_arch = "wasm32"))]
fn now_iso() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    // Format as a minimal ISO-8601 UTC string: YYYY-MM-DDTHH:MM:SSZ
    let s = secs;
    let sec = s % 60;
    let min = (s / 60) % 60;
    let hour = (s / 3600) % 24;
    let days = s / 86400;
    // Compute date from days since epoch (1970-01-01)
    let (year, month, day) = days_to_ymd(days);
    format!(
        "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}Z",
        year, month, day, hour, min, sec
    )
}

#[cfg(not(target_arch = "wasm32"))]
fn days_to_ymd(mut days: u64) -> (u64, u64, u64) {
    // Gregorian calendar computation
    let mut year = 1970u64;
    loop {
        let leap = year % 4 == 0 && (year % 100 != 0 || year % 400 == 0);
        let days_in_year = if leap { 366 } else { 365 };
        if days < days_in_year {
            break;
        }
        days -= days_in_year;
        year += 1;
    }
    let leap = year % 4 == 0 && (year % 100 != 0 || year % 400 == 0);
    let days_in_month = [31u64, if leap { 29 } else { 28 }, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    let mut month = 1u64;
    for &dim in &days_in_month {
        if days < dim {
            break;
        }
        days -= dim;
        month += 1;
    }
    (year, month, days + 1)
}

/// List issues from the given JSON state.
/// Returns a JS array of issue objects.
/// Optionally filter by status ("open" or "closed").
#[wasm_bindgen]
pub fn list_issues(state_json: &str, status: Option<String>) -> Result<JsValue, JsValue> {
    let store = Store::from_json(state_json);
    let issues = store.list(status.as_deref());
    serde_wasm_bindgen::to_value(&issues).map_err(|e| JsValue::from_str(&e.to_string()))
}

/// Add an issue to the store. Returns `{ issue, new_state }`.
#[wasm_bindgen]
pub fn add_issue(state_json: &str, title: &str) -> Result<JsValue, JsValue> {
    let mut store = Store::from_json(state_json);
    let issue = store.add(title).map_err(|e| JsValue::from_str(&e))?;
    let new_state = store.to_json();
    let result = MutationResult { issue, new_state };
    serde_wasm_bindgen::to_value(&result).map_err(|e| JsValue::from_str(&e.to_string()))
}

/// Close an issue in the store. Returns `{ issue, new_state }`.
#[wasm_bindgen]
pub fn close_issue(state_json: &str, issue_id: u32) -> Result<JsValue, JsValue> {
    let mut store = Store::from_json(state_json);
    let issue = store.close(issue_id).map_err(|e| JsValue::from_str(&e))?;
    let new_state = store.to_json();
    let result = MutationResult { issue, new_state };
    serde_wasm_bindgen::to_value(&result).map_err(|e| JsValue::from_str(&e.to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_add_issue() {
        let mut store = Store::new();
        let issue = store.add("Ship the CLI").unwrap();
        assert_eq!(issue.id, 1);
        assert_eq!(issue.status, "open");
        assert_eq!(issue.title, "Ship the CLI");
        assert!(issue.closed_at.is_none());
    }

    #[test]
    fn test_add_empty_title_fails() {
        let mut store = Store::new();
        assert!(store.add("").is_err());
        assert!(store.add("   ").is_err());
    }

    #[test]
    fn test_list_all() {
        let mut store = Store::new();
        store.add("Issue A").unwrap();
        store.add("Issue B").unwrap();
        assert_eq!(store.list(None).len(), 2);
    }

    #[test]
    fn test_list_filter_open() {
        let mut store = Store::new();
        store.add("Issue A").unwrap();
        store.add("Issue B").unwrap();
        store.close(1).unwrap();
        let open = store.list(Some("open"));
        assert_eq!(open.len(), 1);
        assert_eq!(open[0].id, 2);
    }

    #[test]
    fn test_list_filter_closed() {
        let mut store = Store::new();
        store.add("Close me").unwrap();
        store.close(1).unwrap();
        let closed = store.list(Some("closed"));
        assert_eq!(closed.len(), 1);
        assert_eq!(closed[0].id, 1);
        assert!(closed[0].closed_at.is_some());
    }

    #[test]
    fn test_close_issue() {
        let mut store = Store::new();
        store.add("Close me").unwrap();
        let closed = store.close(1).unwrap();
        assert_eq!(closed.status, "closed");
        assert!(closed.closed_at.is_some());
    }

    #[test]
    fn test_close_missing_issue_fails() {
        let mut store = Store::new();
        let result = store.close(999);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("issue 999 not found"));
    }

    #[test]
    fn test_close_already_closed_is_idempotent() {
        let mut store = Store::new();
        store.add("Idempotent close").unwrap();
        store.close(1).unwrap();
        let second = store.close(1).unwrap();
        assert_eq!(second.status, "closed");
    }

    #[test]
    fn test_id_increments() {
        let mut store = Store::new();
        let a = store.add("First").unwrap();
        let b = store.add("Second").unwrap();
        assert_eq!(a.id, 1);
        assert_eq!(b.id, 2);
    }

    #[test]
    fn test_json_roundtrip() {
        let mut store = Store::new();
        store.add("Persisted").unwrap();
        let json = store.to_json();
        let store2 = Store::from_json(&json);
        assert_eq!(store2.issues.len(), 1);
        assert_eq!(store2.issues[0].title, "Persisted");
        assert_eq!(store2.next_id, 2);
    }

    #[test]
    fn test_title_trimmed() {
        let mut store = Store::new();
        let issue = store.add("  trimmed  ").unwrap();
        assert_eq!(issue.title, "trimmed");
    }
}
