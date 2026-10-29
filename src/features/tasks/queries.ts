"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import * as api from "./api";
import type { Task } from "./types";

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

function useTaskMutation<TVariables>(mutationFn: (variables: TVariables) => Promise<void>, success?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      if (success) toast.success(success);
      return queryClient.invalidateQueries({ queryKey: taskKeys.all });
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export const useCreateTask = () => useTaskMutation(({ input, userId }: { input: api.NewTask; userId: string }) => api.createTask(input, userId), "Task created");
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
export const useDeleteTask = () => useTaskMutation((id: string) => api.deleteTask(id), "Task deleted");
export const useSetAssignees = () =>
  useTaskMutation(({ taskId, current, next }: { taskId: string; current: string[]; next: string[] }) => api.setAssignees(taskId, current, next));
export const useDismissReply = () => useTaskMutation(({ taskId, dismissed }: { taskId: string; dismissed: boolean }) => api.setReplyDismissed(taskId, dismissed));

export function useAddComment(taskId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ authorId, body }: { authorId: string; body: string }) => api.addComment(taskId, authorId, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: taskKeys.comments(taskId) });
      void queryClient.invalidateQueries({ queryKey: taskKeys.all });
    },
    onError: (error: Error) => toast.error(error.message),
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
