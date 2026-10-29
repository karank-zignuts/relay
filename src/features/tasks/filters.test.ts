import { describe, expect, it } from "vitest";
import { activeFilterCount, EMPTY_FILTERS, filterTasks, sortTasks, UNASSIGNED } from "./filters";
import type { Task } from "./types";

function task(overrides: Partial<Task>): Task {
  return {
    id: "id",
    task_number: 1,
    title: "Fix login",
    description: "",
    task_date: "2026-10-20T10:00:00Z",
    module: null,
    status: "to_do",
    priority: "medium",
    parent_task_id: null,
    tags: [],
    environments: [],
    changes_in: [],
    slack_channel_id: null,
    slack_thread_ts: null,
    slack_url: null,
    last_client_message_at: null,
    last_team_reply_at: null,
    reply_dismissed_at: null,
    jira_key: null,
    jira_url: null,
    jira_status: null,
    human_edited_fields: [],
    raw_slack: null,
    created_by: null,
    created_at: "2026-10-20T10:00:00Z",
    updated_at: "2026-10-20T10:00:00Z",
    deleted_at: null,
    task_assignees: [],
    parent: null,
    task_comments: [],
    ...overrides,
  };
}

const tasks = [
  task({ id: "a", task_number: 1, title: "Fix login", module: "Auth", status: "in_progress", priority: "high", task_assignees: [{ user_id: "u1" }], environments: ["staging"], changes_in: ["fe"] }),
  task({ id: "b", task_number: 2, title: "Invoice PDF", module: "Billing", status: "done", priority: "low", jira_key: "ABC-1", tags: ["bug"] }),
  task({ id: "c", task_number: 3, title: "Add export", module: "Billing", parent_task_id: "b", task_date: "2026-10-25T10:00:00Z", changes_in: ["be"] }),
];

const ids = (list: Task[]) => list.map((item) => item.id);

describe("filterTasks", () => {
  it("returns everything with empty filters", () => {
    expect(ids(filterTasks(tasks, EMPTY_FILTERS))).toEqual(["a", "b", "c"]);
  });

  it("searches title, number, module and jira key", () => {
    expect(ids(filterTasks(tasks, { ...EMPTY_FILTERS, search: "invoice" }))).toEqual(["b"]);
    expect(ids(filterTasks(tasks, { ...EMPTY_FILTERS, search: "#3" }))).toEqual(["c"]);
    expect(ids(filterTasks(tasks, { ...EMPTY_FILTERS, search: "abc-1" }))).toEqual(["b"]);
  });

  it("combines filters with AND and values within a filter with OR", () => {
    expect(ids(filterTasks(tasks, { ...EMPTY_FILTERS, module: ["Billing"], status: ["done", "to_do"] }))).toEqual(["b", "c"]);
    expect(ids(filterTasks(tasks, { ...EMPTY_FILTERS, area: ["fe", "be"] }))).toEqual(["a", "c"]);
  });

  it("filters by assignee including unassigned", () => {
    expect(ids(filterTasks(tasks, { ...EMPTY_FILTERS, assignee: ["u1"] }))).toEqual(["a"]);
    expect(ids(filterTasks(tasks, { ...EMPTY_FILTERS, assignee: [UNASSIGNED] }))).toEqual(["b", "c"]);
    expect(ids(filterTasks(tasks, { ...EMPTY_FILTERS, assignee: [UNASSIGNED, "u1"] }))).toEqual(["a", "b", "c"]);
  });

  it("filters by jira presence, level and hide done", () => {
    expect(ids(filterTasks(tasks, { ...EMPTY_FILTERS, jira: "yes" }))).toEqual(["b"]);
    expect(ids(filterTasks(tasks, { ...EMPTY_FILTERS, jira: "no" }))).toEqual(["a", "c"]);
    expect(ids(filterTasks(tasks, { ...EMPTY_FILTERS, level: "subtasks" }))).toEqual(["c"]);
    expect(ids(filterTasks(tasks, { ...EMPTY_FILTERS, level: "parents" }))).toEqual(["a", "b"]);
    expect(ids(filterTasks(tasks, { ...EMPTY_FILTERS, hideDone: true }))).toEqual(["a", "c"]);
  });

  it("filters by an inclusive date range", () => {
    expect(ids(filterTasks(tasks, { ...EMPTY_FILTERS, from: "2026-10-25" }))).toEqual(["c"]);
    expect(ids(filterTasks(tasks, { ...EMPTY_FILTERS, to: "2026-10-20" }))).toEqual(["a", "b"]);
  });
});

describe("sortTasks", () => {
  it("sorts by priority urgency", () => {
    expect(ids(sortTasks(tasks, "priority", "asc"))).toEqual(["a", "c", "b"]);
  });

  it("sorts by date descending without mutating the input", () => {
    const copy = [...tasks];
    expect(ids(sortTasks(tasks, "task_date", "desc"))[0]).toBe("c");
    expect(tasks).toEqual(copy);
  });
});

describe("activeFilterCount", () => {
  it("counts only filters that are set", () => {
    expect(activeFilterCount(EMPTY_FILTERS)).toBe(0);
    expect(activeFilterCount({ ...EMPTY_FILTERS, search: "x", status: ["done"], hideDone: true })).toBe(3);
  });
});
