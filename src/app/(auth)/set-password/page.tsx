"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setPasswordSchema } from "@/features/auth/schemas";
import { createClient } from "@/lib/supabase/client";

type Phase = "checking" | "ready" | "invalid";

// Landing page for both invitation and reset links. The link either carries a ?code= (PKCE) or
// access tokens in the URL hash, which the browser client turns into a session by itself.
export default function SetPasswordPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    async function establishSession() {
      const code = new URLSearchParams(window.location.search).get("code");
      if (code) await supabase.auth.exchangeCodeForSession(code);
      // The hash flow is processed on client creation. Give it a moment, then read the session.
      for (let attempt = 0; attempt < 10; attempt++) {
        const { data } = await supabase.auth.getSession();
        if (data.session) return !cancelled && setPhase("ready");
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
      if (!cancelled) setPhase("invalid");
    }

    void establishSession();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = setPasswordSchema.safeParse({ password, confirm });
    if (!parsed.success) return setError(parsed.error.issues[0].message);
    setError(null);
    setPending(true);
    const { error: updateError } = await createClient().auth.updateUser({ password });
    setPending(false);
    if (updateError) return setError(updateError.message);
    router.replace("/tasks");
    router.refresh();
  }

  if (phase === "checking") return <p className="text-sm text-muted-foreground">Checking your link…</p>;

  if (phase === "invalid") {
    return (
      <>
        <h1 className="mb-2 text-[32px] leading-[1.13] font-light tracking-[-0.02em]">Link expired</h1>
        <p className="text-sm text-muted-foreground">
          This link is invalid or has expired. Ask your admin to resend the invitation, or use “Forgot password” on the sign-in page.
        </p>
      </>
    );
  }

  return (
    <>
      <h1 className="mb-2 text-[32px] leading-[1.13] font-light tracking-[-0.02em]">Set your password</h1>
      <p className="mb-8 text-sm text-muted-foreground">Choose a password to finish signing in.</p>
      <form onSubmit={onSubmit} className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="password">New password</Label>
          <Input id="password" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirm">Confirm password</Label>
          <Input id="confirm" type="password" autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} required />
        </div>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? "Saving…" : "Save password"}
        </Button>
      </form>
    </>
  );
}
