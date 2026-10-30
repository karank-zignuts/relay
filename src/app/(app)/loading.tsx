import { WorkspaceSkeleton } from "@/components/page-skeletons";

// Shown the instant a page is chosen, while the server renders it. Each page has its own that copies its layout.
export default function Loading() {
  return <WorkspaceSkeleton />;
}
