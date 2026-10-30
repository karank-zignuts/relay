"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import * as api from "./api";
import type { Comment, Task } from "./types";

export const taskKeys = {
  all: ["tasks"] as const,
  team: ["team"] as const,
  comments: (taskId: string) => ["comments", taskId] as const,
  settings: ["settings"] as const,
};

export const useTasks = () => useQuery({ queryKey: taskKeys.all, queryFn: api.listTasks });
export const useTeam = () => useQuery({ queryKey: taskKeys.team, queryFn: api.listTeam, staleTime: 5 * 60_000 });
export const useComments = (taskId: string) => useQuery({ queryKey: taskKeys.comments(taskId), queryFn: () => api.listComments(taskId) });

/** Keeps every open view live: any change to tasks, assignees or comments refetches the affected queries. */
export function useTasksRealtime() {
  const queryClient = useQueryClient();
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("tasks-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, () => queryClient.invalidateQueries({ queryKey: taskKeys.all }))
      .on("postgres_changes", { event: "*", schema: "public", table: "task_assignees" }, () => queryClient.invalidateQueries({ queryKey: taskKeys.all }))
      .on("postgres_changes", { event: "*", schema: "public", table: "task_comments" }, () => {
        void queryClient.invalidateQueries({ queryKey: taskKeys.all });
        void queryClient.invalidateQueries({ queryKey: ["comments"] });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);
}

/**
 * Optimistic mutation: the cache changes the moment the action happens, the server call follows,
 * and the change rolls back with a message if the server refuses it.
 */
function useOptimisticTaskMutation<TVariables>(mutationFn: (variables: TVariables) => Promise<void>, apply: (tasks: Task[], variables: TVariables) => Task[], success?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onMutate: async (variables: TVariables) => {
      await queryClient.cancelQueries({ queryKey: taskKeys.all });
      const previous = queryClient.getQueryData<Task[]>(taskKeys.all);
      queryClient.setQueryData<Task[]>(taskKeys.all, (tasks) => (tasks ? apply(tasks, variables) : tasks));
      return { previous };
    },
    onError: (error: Error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(taskKeys.all, context.previous);
      toast.error(error.message);
    },
    onSuccess: () => {
      if (success) toast.success(success);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: taskKeys.all });
    },
  });
}

function pendingTask(input: api.NewTask, userId: string, tasks: Task[]): Task {
  const now = new Date().toISOString();
  return {
    id: `pending-${now}`,
    task_number: tasks.reduce((highest, task) => Math.max(highest, task.task_number), 0) + 1,
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
    created_by: userId,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    task_assignees: [],
    parent: null,
    task_comments: [],
  };
}

export const useCreateTask = () =>
  useOptimisticTaskMutation(
    ({ input, userId }: { input: api.NewTask; userId: string }) => api.createTask(input, userId),
    (tasks, { input, userId }) => [pendingTask(input, userId, tasks), ...tasks],
    "Task created",
  );

type UpdateVariables = { id: string; patch: Parameters<typeof api.updateTask>[1] };

/** Optimistic: the table and board reflect the change instantly and roll back if the server refuses it. */
export function useUpdateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: UpdateVariables) => api.updateTask(id, patch),
    onMutate: async ({ id, patch }) => {
      await queryClient.cancelQueries({ queryKey: taskKeys.all });
      const previous = queryClient.getQueryData<Task[]>(taskKeys.all);
      queryClient.setQueryData<Task[]>(taskKeys.all, (tasks) => tasks?.map((task) => (task.id === id ? ({ ...task, ...patch } as Task) : task)));
      return { previous };
    },
    onError: (error: Error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(taskKeys.all, context.previous);
      toast.error(error.message);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: taskKeys.all }),
  });
}
export const useDeleteTask = () =>
  useOptimisticTaskMutation(
    (id: string) => api.deleteTask(id),
    (tasks, id) => tasks.filter((task) => task.id !== id && task.parent_task_id !== id),
    "Task deleted",
  );
export const useSetAssignees = () =>
  useOptimisticTaskMutation(
    ({ taskId, current, next }: { taskId: string; current: string[]; next: string[] }) => api.setAssignees(taskId, current, next),
    (tasks, { taskId, next }) => tasks.map((task) => (task.id === taskId ? { ...task, task_assignees: next.map((user_id) => ({ user_id })) } : task)),
  );
export const useDismissReply = () =>
  useOptimisticTaskMutation(
    ({ taskId, dismissed }: { taskId: string; dismissed: boolean }) => api.setReplyDismissed(taskId, dismissed),
    (tasks, { taskId, dismissed }) => tasks.map((task) => (task.id === taskId ? { ...task, reply_dismissed_at: dismissed ? new Date().toISOString() : null } : task)),
  );

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
      const pending: Comment = { id: `pending-${now}`, task_id: taskId, author_id: authorId, body: body.trim(), created_at: now, updated_at: now, deleted_at: null, author };
      queryClient.setQueryData<Comment[]>(key, (comments) => [...(comments ?? []), pending]);
      return { previous };
    },
    onError: (error: Error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
      toast.error(error.message);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: key });
      void queryClient.invalidateQueries({ queryKey: taskKeys.all });
    },
  });
}

export function useDeleteComment(taskId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (commentId: string) => api.deleteComment(commentId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: taskKeys.comments(taskId) });
      void queryClient.invalidateQueries({ queryKey: taskKeys.all });
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

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
