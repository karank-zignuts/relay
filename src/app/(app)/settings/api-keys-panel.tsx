"use client";

import { Copy, KeyRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatRelative } from "@/lib/format";

type Key = { id: string; name: string; key_prefix: string; last_used_at: string | null; revoked_at: string | null; created_at: string };

export function ApiKeysPanel({ keys }: { keys: Key[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [created, setCreated] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    const response = await fetch("/api/api-keys", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
    setPending(false);
    if (!response.ok) return toast.error("Could not create the key.");
    const payload = (await response.json()) as { key: string };
    setCreated(payload.key);
    setName("");
    router.refresh();
  }

  async function revoke(id: string) {
    const response = await fetch(`/api/api-keys/${id}`, { method: "DELETE" });
    if (!response.ok) return toast.error("Could not revoke the key.");
    toast.success("Key revoked");
    router.refresh();
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-medium">API keys for Claude</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Claude sends one of these keys to <code className="font-mono text-xs">/api/v1</code> when syncing. A key is shown once, so copy it straight into your <code className="font-mono text-xs">.env.local</code> as <code className="font-mono text-xs">RELAY_API_KEY</code>.
        </p>
      </div>

      {created ? (
        <div role="status" className="space-y-2 rounded-[10px] border border-border bg-secondary p-4" data-testid="new-api-key">
          <p className="text-sm font-medium">Copy this key now. You will not see it again.</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 overflow-x-auto rounded-[4px] bg-background p-2 font-mono text-xs">{created}</code>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                await navigator.clipboard.writeText(created);
                toast.success("Copied");
              }}
            >
              <Copy /> Copy
            </Button>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setCreated(null)}>
            I have saved it
          </Button>
        </div>
      ) : null}

      <form onSubmit={create} className="flex items-end gap-2">
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="key-name">Key name</Label>
          <Input id="key-name" placeholder="Claude sync (Karan's laptop)" value={name} onChange={(event) => setName(event.target.value)} required />
        </div>
        <Button type="submit" disabled={pending || !name.trim()}>
          <KeyRound /> Create key
        </Button>
      </form>

      <ul className="divide-y divide-border rounded-[20px] border border-border" data-testid="api-keys">
        {keys.length === 0 ? <li className="p-4 text-sm text-muted-foreground">No keys yet.</li> : null}
        {keys.map((key) => (
          <li key={key.id} className="flex items-center gap-3 p-4 text-sm">
            <div className="min-w-0 flex-1">
              <p className="font-medium">{key.name}</p>
              <p className="text-xs text-muted-foreground">
                <span className="font-mono">{key.key_prefix}…</span> · created {formatRelative(key.created_at)} · {key.last_used_at ? `used ${formatRelative(key.last_used_at)}` : "never used"}
              </p>
            </div>
            {key.revoked_at ? (
              <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs">Revoked</span>
            ) : (
              <Button variant="outline" size="sm" onClick={() => revoke(key.id)}>
                Revoke
              </Button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
