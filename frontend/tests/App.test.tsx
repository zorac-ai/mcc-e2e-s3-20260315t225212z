/**
 * React component tests for App.tsx.
 *
 * These tests verify the UI rendering and user interaction flows using
 * @testing-library/react with a mocked store module.
 * Running in happy-dom environment provides a virtual DOM without a browser.
 */
// @vitest-environment happy-dom

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act, cleanup } from "@testing-library/react";
import React from "react";

// Mock store.ts before importing App
vi.mock("../src/store", () => ({
  listIssues: vi.fn(),
  addIssue: vi.fn(),
  closeIssue: vi.fn(),
}));

import App from "../src/App";
import * as store from "../src/store";

const mockedStore = store as {
  listIssues: ReturnType<typeof vi.fn>;
  addIssue: ReturnType<typeof vi.fn>;
  closeIssue: ReturnType<typeof vi.fn>;
};

const makeIssue = (id: number, title: string, status: "open" | "closed" = "open") => ({
  id,
  title,
  status,
  created_at: "2026-01-01T00:00:00Z",
  closed_at: status === "closed" ? "2026-01-02T00:00:00Z" : null,
});

describe("App コンポーネント", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("初期表示: Issueがない場合は空メッセージを表示する", async () => {
    mockedStore.listIssues.mockResolvedValue([]);

    await act(async () => {
      render(<App />);
    });

    expect(screen.getByText("Issueはありません")).toBeTruthy();
  });

  it("初期表示: フィルターボタンが3つ表示される（すべて・オープン・クローズ済み）", async () => {
    mockedStore.listIssues.mockResolvedValue([]);

    await act(async () => {
      render(<App />);
    });

    expect(screen.getByText("すべて")).toBeTruthy();
    expect(screen.getByText("オープン")).toBeTruthy();
    expect(screen.getByText("クローズ済み")).toBeTruthy();
  });

  it("初期表示: 取得したIssueリストを表示する", async () => {
    const issues = [makeIssue(1, "バグ修正"), makeIssue(2, "新機能")];
    mockedStore.listIssues.mockResolvedValue(issues);

    await act(async () => {
      render(<App />);
    });

    await waitFor(() => {
      expect(screen.getByText("バグ修正")).toBeTruthy();
      expect(screen.getByText("新機能")).toBeTruthy();
    });
  });

  it("Issue追加: タイトルを入力して送信するとaddIssueが呼ばれる", async () => {
    mockedStore.listIssues.mockResolvedValue([]);
    mockedStore.addIssue.mockResolvedValue(makeIssue(1, "新Issue"));

    await act(async () => {
      render(<App />);
    });

    const input = screen.getByPlaceholderText("新しいIssueのタイトル");
    const button = screen.getByText("追加");

    await act(async () => {
      fireEvent.change(input, { target: { value: "新Issue" } });
      fireEvent.click(button);
    });

    await waitFor(() => {
      expect(mockedStore.addIssue).toHaveBeenCalledWith("新Issue");
    });
  });

  it("Issue追加: 空タイトルの場合はエラーメッセージを表示してaddIssueを呼ばない", async () => {
    mockedStore.listIssues.mockResolvedValue([]);

    await act(async () => {
      render(<App />);
    });

    const button = screen.getByText("追加");

    await act(async () => {
      fireEvent.click(button);
    });

    expect(screen.getByText("タイトルは必須です")).toBeTruthy();
    expect(mockedStore.addIssue).not.toHaveBeenCalled();
  });

  it("Issueクローズ: クローズボタンを押すとcloseIssueが呼ばれる", async () => {
    const issues = [makeIssue(1, "オープンIssue")];
    mockedStore.listIssues.mockResolvedValue(issues);
    mockedStore.closeIssue.mockResolvedValue(makeIssue(1, "オープンIssue", "closed"));

    await act(async () => {
      render(<App />);
    });

    await waitFor(() => {
      expect(screen.getByText("クローズ")).toBeTruthy();
    });

    await act(async () => {
      fireEvent.click(screen.getByText("クローズ"));
    });

    await waitFor(() => {
      expect(mockedStore.closeIssue).toHaveBeenCalledWith(1);
    });
  });

  it("フィルタリング: 「オープン」ボタンを押すとlistIssues('open')が呼ばれる", async () => {
    mockedStore.listIssues.mockResolvedValue([]);

    await act(async () => {
      render(<App />);
    });

    await act(async () => {
      fireEvent.click(screen.getByText("オープン"));
    });

    await waitFor(() => {
      expect(mockedStore.listIssues).toHaveBeenCalledWith("open");
    });
  });

  it("フィルタリング: 「クローズ済み」ボタンを押すとlistIssues('closed')が呼ばれる", async () => {
    mockedStore.listIssues.mockResolvedValue([]);

    await act(async () => {
      render(<App />);
    });

    await act(async () => {
      fireEvent.click(screen.getByText("クローズ済み"));
    });

    await waitFor(() => {
      expect(mockedStore.listIssues).toHaveBeenCalledWith("closed");
    });
  });

  it("クローズ済みIssueにはクローズボタンが表示されない", async () => {
    const issues = [makeIssue(1, "完了済みIssue", "closed")];
    mockedStore.listIssues.mockResolvedValue(issues);

    await act(async () => {
      render(<App />);
    });

    await waitFor(() => {
      expect(screen.getByText("完了済みIssue")).toBeTruthy();
    });

    expect(screen.queryByText("クローズ")).toBeNull();
  });

  it("Issueステータスバッジが表示される", async () => {
    const issues = [makeIssue(1, "オープンIssue", "open"), makeIssue(2, "クローズIssue", "closed")];
    mockedStore.listIssues.mockResolvedValue(issues);

    await act(async () => {
      render(<App />);
    });

    await waitFor(() => {
      const badges = screen.getAllByText("open");
      expect(badges.length).toBeGreaterThanOrEqual(1);
      const closedBadges = screen.getAllByText("closed");
      expect(closedBadges.length).toBeGreaterThanOrEqual(1);
    });
  });
});
