import { TasksWorkspace } from "@/features/tasks/components/tasks-workspace";

// One workspace for Table and Board: switching view keeps the header, filters and sort, and only the content swaps.
export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return <TasksWorkspace>{children}</TasksWorkspace>;
}
