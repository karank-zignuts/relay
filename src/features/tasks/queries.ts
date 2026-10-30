"use client";

import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData, type QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import * as api from "./api";
import type { TaskStatus } from "./constants";
import { toRpcArgs, type SortState, type TaskFilters } from "./filters";
import type { Attachment, Comment, Task, TaskPage } from "./types";

export const BOARD_PAGE_SIZE = 20;

export const taskKeys = {
  all: ["tasks"] as const,
  page: (args: ReturnType<typeof toRpcArgs>) => ["tasks", "page", args] as const,
  board: (status: TaskStatus, filters: TaskFilters, sort: SortState) => ["tasks", "board", status, filters, sort] as const,
  one: (id: string) => ["tasks", "one", id] as const,
  lite: ["tasks", "lite"] as const,
  attention: ["tasks", "attention"] as const,
  team: ["team"] as const,
  modules: ["modules"] as const,
  tags: ["tags"] as const,
  comments: (taskId: string) => ["comments", taskId] as const,
  reads: (taskId: string) => ["comment-reads", taskId] as const,
  attachments: (taskId: string) => ["attachments", taskId] as const,
  settings: ["settings"] as const,
};

/* ------------------------------------------------------------------ reads */

/** One page of the table. The previous page stays on screen while the next one loads, so nothing jumps. */
export const useTaskPage = (args: ReturnType<typeof toRpcArgs>, enabled = true) =>
  useQuery({ queryKey: taskKeys.page(args), queryFn: () => api.listTasksPage(args), placeholderData: keepPreviousData, enabled });

/** One board column, loaded 20 cards at a time as the column scrolls. */
export function useBoardColumn(status: TaskStatus, filters: TaskFilters, sort: SortState, enabled = true) {
  return useInfiniteQuery({
    queryKey: taskKeys.board(status, filters, sort),
    enabled,
    initialPageParam: 0,
    queryFn: ({ pageParam }) => api.listTasksPage(toRpcArgs(filters, sort, { limit: BOARD_PAGE_SIZE, offset: pageParam }, { manualOrder: true, status: [status] })),
    getNextPageParam: (last, all) => {
      const loaded = all.reduce((sum, page) => sum + page.rows.length, 0);
      return loaded < last.total ? loaded : undefined;
    },
    placeholderData: keepPreviousData,
  });
}

/** The open task, read from whichever list already holds it and refreshed on its own. */
export function useTask(id: string | null) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: taskKeys.one(id ?? "none"),
    enabled: id !== null,
    queryFn: async () => (await api.getTask(id!)) ?? null,
    initialData: () => (id ? findCachedTask(queryClient, id) : undefined),
  });
}

export const useTaskCounts = () => useQuery({ queryKey: ["tasks", "counts"] as const, queryFn: api.getTaskCounts, placeholderData: keepPreviousData });
export const useTaskLite = () => useQuery({ queryKey: taskKeys.lite, queryFn: api.listTaskLite, staleTime: 60_000 });
export const useAttention = () => useQuery({ queryKey: taskKeys.attention, queryFn: api.listAttentionCandidates });
export const useTeam = () => useQuery({ queryKey: taskKeys.team, queryFn: api.listTeam, staleTime: 5 * 60_000 });
export const useModules = () => useQuery({ queryKey: taskKeys.modules, queryFn: api.listModules, staleTime: 60_000 });
export const useTags = () => useQuery({ queryKey: taskKeys.tags, queryFn: api.listTags, staleTime: 60_000 });
export const useComments = (taskId: string) => useQuery({ queryKey: taskKeys.comments(taskId), queryFn: () => api.listComments(taskId) });
export const useCommentReads = (taskId: string) => useQuery({ queryKey: taskKeys.reads(taskId), queryFn: () => api.listCommentReads(taskId) });
export const useAttachments = (taskId: string) => useQuery({ queryKey: taskKeys.attachments(taskId), queryFn: () => api.listAttachments(taskId) });

/* ------------------------------------------------------------------ cache helpers */

type Snapshot = [readonly unknown[], unknown][];

const isTaskList = (key: readonly unknown[]) => key[0] === "tasks" && key[1] !== "lite";
const isPageData = (data: unknown): data is TaskPage => typeof data === "object" && data !== null && "rows" in data;
const isInfinite = (data: unknown): data is InfiniteData<TaskPage> => typeof data === "object" && data !== null && "pages" in data;
const isTask = (data: unknown): data is Task => typeof data === "object" && data !== null && "task_number" in data && "title" in data;

function findCachedTask(queryClient: QueryClient, id: string): Task | undefined {
  for (const [key, data] of queryClient.getQueriesData({ queryKey: taskKeys.all })) {
    if (!isTaskList(key)) continue;
    if (isPageData(data)) {
      const found = data.rows.flatMap((task) => [task, ...(task.children ?? [])]).find((task) => task.id === id);
      if (found) return found;
    } else if (isInfinite(data)) {
      for (const page of data.pages) {
        const found = page.rows.find((task) => task.id === id);
        if (found) return found;
      }
    } else if (Array.isArray(data)) {
      const found = (data as Task[]).find((task) => task.id === id);
      if (found) return found;
    } else if (isTask(data) && data.id === id) return data;
  }
  return undefined;
}

function mapPage(page: TaskPage, fn: (task: Task) => Task | null): TaskPage {
  const rows = page.rows.flatMap((task) => {
    const next = fn(task);
    if (!next) return [];
    return [next.children?.length ? { ...next, children: next.children.flatMap((child) => fn(child) ?? []) } : next];
  });
  return { ...page, rows, total: Math.max(0, page.total - (page.rows.length - rows.length)) };
}

/** Applies `fn` to every cached copy of every task list (table pages, board columns, the open task). Returning null removes the task. */
function patchTaskCaches(queryClient: QueryClient, fn: (task: Task) => Task | null) {
  queryClient.setQueriesData({ queryKey: taskKeys.all, predicate: (query) => isTaskList(query.queryKey) }, (data: unknown) => {
    if (isPageData(data)) return mapPage(data, fn);
    if (isInfinite(data)) return { ...data, pages: data.pages.map((page) => mapPage(page, fn)) };
    if (Array.isArray(data)) return (data as Task[]).flatMap((task) => fn(task) ?? []);
    if (isTask(data)) return fn(data) ?? data;
    return data;
  });
}

function snapshot(queryClient: QueryClient): Snapshot {
  return queryClient.getQueriesData({ queryKey: taskKeys.all, predicate: (query) => isTaskList(query.queryKey) });
}

function restore(queryClient: QueryClient, saved: Snapshot | undefined) {
  saved?.forEach(([key, data]) => queryClient.setQueryData(key, data));
}

const refreshTasks = (queryClient: QueryClient) => queryClient.invalidateQueries({ queryKey: taskKeys.all });

/**
 * Optimistic mutation: every cached list changes the moment the action happens, the server call follows,
 * and the change rolls back with a message if the server refuses it.
 */
function useOptimisticTaskMutation<TVariables>(mutationFn: (variables: TVariables) => Promise<void>, apply: (task: Task, variables: TVariables) => Task | null, success?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onMutate: async (variables: TVariables) => {
      await queryClient.cancelQueries({ queryKey: taskKeys.all });
      const previous = snapshot(queryClient);
      patchTaskCaches(queryClient, (task) => apply(task, variables));
      return { previous };
    },
    onError: (error: Error, _variables, context) => {
      restore(queryClient, context?.previous);
      toast.error(error.message);
    },
    onSuccess: () => {
      if (success) toast.success(success);
    },
    onSettled: () => refreshTasks(queryClient),
  });
}

/** Puts a task at `index` of one board column, keeping the cached page sizes. */
function placeInColumn(data: InfiniteData<TaskPage>, task: Task, index: number): InfiniteData<TaskPage> {
  const had = data.pages.some((page) => page.rows.some((row) => row.id === task.id));
  const flat = data.pages.flatMap((page) => page.rows).filter((row) => row.id !== task.id);
  flat.splice(Math.min(Math.max(index, 0), flat.length), 0, task);
  const total = data.pages[0].total + (had ? 0 : 1);
  let cursor = 0;
  const pages = data.pages.map((page, position) => {
    const size = position === data.pages.length - 1 ? flat.length - cursor : page.rows.length;
    const rows = flat.slice(cursor, cursor + size);
    cursor += size;
    return { ...page, total, rows };
  });
  return { ...data, pages };
}

function moveInBoardCaches(queryClient: QueryClient, task: Task, status: TaskStatus, index: number, rank: number) {
  const moved: Task = { ...task, status, board_rank: rank };
  for (const [key, data] of queryClient.getQueriesData<InfiniteData<TaskPage>>({ queryKey: ["tasks", "board"] })) {
    if (!data || !isInfinite(data)) continue;
    const column = key[2] as TaskStatus;
    if (column === status) queryClient.setQueryData(key, placeInColumn(data, moved, index));
    else if (column === task.status) queryClient.setQueryData(key, { ...data, pages: data.pages.map((page) => mapPage(page, (row) => (row.id === task.id ? null : row))) });
  }
  patchTaskCaches(queryClient, (row) => (row.id === task.id ? moved : row));
}

/* ------------------------------------------------------------------ task mutations */

function pendingTask(input: api.NewTask, userId: string): Task {
  const now = new Date().toISOString();
  return {
    id: `pending-${now}`,
    task_number: 0,
    title: input.title,
    description: input.description,
    task_date: now,
    module: input.module,
    status: input.status,
    priority: input.priority,
    parent_task_id: input.parent_task_id ?? null,
    tags: [],
    environments: input.environments ?? [],
    changes_in: input.changes_in ?? [],
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
    board_rank: -Date.now() / 1000,
    created_by: userId,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    task_assignees: [],
    parent: null,
    task_comments: [],
  };
}

export function useCreateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ input, userId }: { input: api.NewTask; userId: string }) => api.createTask(input, userId),
    onMutate: async ({ input, userId }) => {
      await queryClient.cancelQueries({ queryKey: taskKeys.all });
      const previous = snapshot(queryClient);
      const pending = pendingTask(input, userId);
      for (const [key, data] of previous) {
        if (key[1] === "page" && isPageData(data) && (key[2] as { p_offset: number }).p_offset === 0) {
          queryClient.setQueryData(key, { ...data, total: data.total + 1, all_count: data.all_count + 1, open_count: data.open_count + (input.status === "done" ? 0 : 1), rows: [pending, ...data.rows] });
        } else if (key[1] === "board" && isInfinite(data) && key[2] === input.status) {
          queryClient.setQueryData(key, placeInColumn(data, pending, 0));
        }
      }
      return { previous };
    },
    onError: (error: Error, _variables, context) => {
      restore(queryClient, context?.previous);
      toast.error(error.message);
    },
    onSuccess: () => toast.success("Task created"),
    onSettled: () => {
      void refreshTasks(queryClient);
      void queryClient.invalidateQueries({ queryKey: taskKeys.modules });
    },
  });
}

type UpdateVariables = { id: string; patch: Parameters<typeof api.updateTask>[1] };

/** Optimistic: the table and board reflect the change instantly and roll back if the server refuses it. */
export function useUpdateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: UpdateVariables) => api.updateTask(id, patch),
    onMutate: async ({ id, patch }) => {
      await queryClient.cancelQueries({ queryKey: taskKeys.all });
      const previous = snapshot(queryClient);
      const current = findCachedTask(queryClient, id);
      if (current && patch.status && patch.status !== current.status) moveInBoardCaches(queryClient, current, patch.status, 0, current.board_rank);
      patchTaskCaches(queryClient, (task) => (task.id === id ? ({ ...task, ...patch } as Task) : task));
      return { previous };
    },
    onError: (error: Error, _variables, context) => {
      restore(queryClient, context?.previous);
      toast.error(error.message);
    },
    onSettled: (_data, _error, { patch }) => {
      void refreshTasks(queryClient);
      if (patch.module !== undefined) void queryClient.invalidateQueries({ queryKey: taskKeys.modules });
      if (patch.tags !== undefined) void queryClient.invalidateQueries({ queryKey: taskKeys.tags });
    },
  });
}

/** Drag and drop on the board: new column, and a place in it. */
export function useMoveTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ task, status, rank }: { task: Task; status: TaskStatus; index: number; rank: number }) => api.moveTask(task.id, status, rank),
    onMutate: async ({ task, status, index, rank }) => {
      await queryClient.cancelQueries({ queryKey: taskKeys.all });
      const previous = snapshot(queryClient);
      moveInBoardCaches(queryClient, task, status, index, rank);
      return { previous };
    },
    onError: (error: Error, _variables, context) => {
      restore(queryClient, context?.previous);
      toast.error(error.message);
    },
    onSettled: () => refreshTasks(queryClient),
  });
}

export const useDeleteTask = () =>
  useOptimisticTaskMutation(
    (id: string) => api.deleteTask(id),
    (task, id) => (task.id === id || task.parent_task_id === id ? null : task),
    "Task deleted",
  );
export const useSetAssignees = () =>
  useOptimisticTaskMutation(
    ({ taskId, current, next }: { taskId: string; current: string[]; next: string[] }) => api.setAssignees(taskId, current, next),
    (task, { taskId, next }) => (task.id === taskId ? { ...task, task_assignees: next.map((user_id) => ({ user_id })) } : task),
  );
export const useDismissReply = () =>
  useOptimisticTaskMutation(
    ({ taskId, dismissed }: { taskId: string; dismissed: boolean }) => api.setReplyDismissed(taskId, dismissed),
    (task, { taskId, dismissed }) => (task.id === taskId ? { ...task, reply_dismissed_at: dismissed ? new Date().toISOString() : null } : task),
  );

/* ------------------------------------------------------------------ comments */

type NewComment = { authorId: string; body: string; author: { id: string; full_name: string; email: string } };

/** Optimistic: the comment appears the moment it is sent, then the server confirms it. */
export function useAddComment(taskId: string) {
  const queryClient = useQueryClient();
  const key = taskKeys.comments(taskId);
  return useMutation({
    mutationFn: ({ authorId, body }: NewComment) => api.addComment(taskId, authorId, body),
    onMutate: async ({ authorId, body, author }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Comment[]>(key);
      const now = new Date().toISOString();
      const pending: Comment = { id: `pending-${now}`, task_id: taskId, author_id: authorId, body: body.trim(), created_at: now, updated_at: now, edited_at: null, deleted_at: null, author };
      queryClient.setQueryData<Comment[]>(key, (comments) => [...(comments ?? []), pending]);
      return { previous };
    },
    onError: (error: Error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
      toast.error(error.message);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: key });
      void refreshTasks(queryClient);
    },
  });
}

export function useEditComment(taskId: string) {
  const queryClient = useQueryClient();
  const key = taskKeys.comments(taskId);
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: string }) => api.editComment(id, body),
    onMutate: async ({ id, body }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Comment[]>(key);
      queryClient.setQueryData<Comment[]>(key, (comments) => comments?.map((comment) => (comment.id === id ? { ...comment, body: body.trim(), edited_at: new Date().toISOString() } : comment)));
      return { previous };
    },
    onError: (error: Error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
      toast.error(error.message);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });
}

export function useDeleteComment(taskId: string) {
  const queryClient = useQueryClient();
  const key = taskKeys.comments(taskId);
  return useMutation({
    mutationFn: (commentId: string) => api.deleteComment(commentId),
    onMutate: async (commentId) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Comment[]>(key);
      queryClient.setQueryData<Comment[]>(key, (comments) => comments?.filter((comment) => comment.id !== commentId));
      return { previous };
    },
    onError: (error: Error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
      toast.error(error.message);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: key });
      void refreshTasks(queryClient);
    },
  });
}

export function useMarkCommentsRead(taskId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.markCommentsRead(taskId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: taskKeys.reads(taskId) }),
  });
}

/* ------------------------------------------------------------------ attachments */

export function useUploadAttachments(taskId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ files, userId }: { files: File[]; userId: string }) => {
      const failures: string[] = [];
      for (const file of files) {
        try {
          await api.uploadAttachment(taskId, file, userId);
          // Refresh as each file lands, so its tile turns into the real card while the others are still going.
          await queryClient.invalidateQueries({ queryKey: taskKeys.attachments(taskId) });
        } catch (error) {
          failures.push((error as Error).message);
        }
      }
      if (failures.length) throw new Error(failures.join(" "));
    },
    onError: (error: Error) => toast.error(error.message),
    // Returned so the upload only counts as settled once the real attachments are in the cache.
    onSettled: async () => {
      void refreshTasks(queryClient);
      await queryClient.invalidateQueries({ queryKey: taskKeys.attachments(taskId) });
    },
  });
}

export function useDeleteAttachment(taskId: string) {
  const queryClient = useQueryClient();
  const key = taskKeys.attachments(taskId);
  return useMutation({
    mutationFn: (id: string) => api.deleteAttachment(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Attachment[]>(key);
      queryClient.setQueryData<Attachment[]>(key, (items) => items?.filter((item) => item.id !== id));
      return { previous };
    },
    onError: (error: Error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
      toast.error(error.message);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: key });
      void refreshTasks(queryClient);
    },
  });
}

/* ------------------------------------------------------------------ settings */

export function useAppSettings() {
  return useQuery({
    queryKey: taskKeys.settings,
    queryFn: async () => {
      const { data, error } = await createClient().from("app_settings").select("*").eq("id", true).single();
      if (error) throw new Error(error.message);
      return data;
    },
    staleTime: 5 * 60_000,
  });
}
