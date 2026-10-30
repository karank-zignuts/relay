import { RelayLoader } from "@/components/brand/relay-brand";

// Brand splash while a top-level route (sign-in, the app shell) is being rendered. Pages below it use skeletons that copy their own layout.
export default function Loading() {
  return (
    <div className="flex flex-1 items-center justify-center" role="status" aria-live="polite">
      <RelayLoader className="size-20" label="Loading Relay" />
    </div>
  );
}
