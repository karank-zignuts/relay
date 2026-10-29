"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setPasswordSchema } from "@/features/auth/schemas";
import { createClient } from "@/lib/supabase/client";

type Phase = "checking" | "confirm" | "ready" | "used";
type OtpType = "invite" | "recovery";

const SESSION_EVENTS = ["SIGNED_IN", "PASSWORD_RECOVERY", "INITIAL_SESSION", "TOKEN_REFRESHED"];

// Landing page for invitation and reset links. Three link styles are supported:
//  1. ?token_hash=…&type=invite|recovery  (preferred): nothing is consumed until the person presses
//     "Continue", so email scanners that open the link in advance cannot use it up.
//  2. ?code=…  (PKCE, from "Forgot password" on the sign-in page)
//  3. #access_token=… in the hash (Supabase's default email link)
export default function SetPasswordPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("checking");
  const [otp, setOtp] = useState<{ tokenHash: string; type: OtpType } | null>(null);
  const [kind, setKind] = useState<OtpType>("invite");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    const query = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    let cancelled = false;

    if (hash.get("error") || hash.get("error_code")) {
      // The link was already opened (often by an email scanner) or has expired.
      queueMicrotask(() => setPhase("used"));
      return;
    }

    const tokenHash = query.get("token_hash");
    const type = query.get("type");
    if (tokenHash && (type === "invite" || type === "recovery")) {
      queueMicrotask(() => {
        setOtp({ tokenHash, type });
        setKind(type);
        setPhase("confirm");
      });
      return;
    }

    queueMicrotask(() => setKind(hash.get("type") === "recovery" || query.get("code") ? "recovery" : "invite"));

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && SESSION_EVENTS.includes(event) && !cancelled) setPhase("ready");
    });

    (async () => {
      const code = query.get("code");
      if (code) await supabase.auth.exchangeCodeForSession(code);
      // Tokens in the hash are turned into a session in the background. Give that up to ~6 seconds.
      for (let attempt = 0; attempt < 15 && !cancelled; attempt++) {
        const { data: current } = await supabase.auth.getSession();
        if (current.session) return setPhase("ready");
        await new Promise((resolve) => setTimeout(resolve, 400));
      }
      if (!cancelled) setPhase((previous) => (previous === "ready" ? previous : "used"));
    })();

    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, []);

  async function confirmLink() {
    if (!otp) return;
    setPending(true);
    setError(null);
    const { error: verifyError } = await createClient().auth.verifyOtp({ token_hash: otp.tokenHash, type: otp.type });
    setPending(false);
    if (verifyError) return setPhase("used");
    setPhase("ready");
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = setPasswordSchema.safeParse({ password, confirm });
    if (!parsed.success) return setError(parsed.error.issues[0].message);
    setError(null);
    setPending(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setPending(false);
      return setError(updateError.message);
    }
    // Sign out so the next step is a normal sign-in with the new password.
    await supabase.auth.signOut();
    router.replace(`/login?notice=${kind === "invite" ? "welcome" : "password-reset"}`);
    router.refresh();
  }

  if (phase === "checking") return <p className="text-sm text-muted-foreground">Checking your link…</p>;

  if (phase === "confirm") {
    return (
      <>
        <h1 className="mb-2 text-[32px] leading-[1.13] font-light tracking-[-0.02em]">{kind === "invite" ? "Accept your invitation" : "Reset your password"}</h1>
        <p className="mb-8 text-sm text-muted-foreground">Press continue to {kind === "invite" ? "set up your account" : "choose a new password"}.</p>
        <Button size="lg" className="w-full" onClick={confirmLink} disabled={pending}>
          {pending ? "Checking…" : "Continue"}
        </Button>
      </>
    );
  }

  if (phase === "used") {
    return (
      <>
        <h1 className="mb-2 text-[32px] leading-[1.13] font-light tracking-[-0.02em]">This link was already used</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Invitation and reset links work once, and some email programs open them automatically. If you already set a password, sign in. Otherwise ask your admin to resend the invitation, or use “Forgot password”.
        </p>
        <div className="space-y-3">
          <Link href="/login" className={buttonVariants({ size: "lg", className: "w-full" })}>
            Go to sign in
          </Link>
          <Link href="/forgot-password" className={buttonVariants({ size: "lg", variant: "outline", className: "w-full" })}>
            Forgot password
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <h1 className="mb-2 text-[32px] leading-[1.13] font-light tracking-[-0.02em]">Set your password</h1>
      <p className="mb-8 text-sm text-muted-foreground">Choose a password. You will sign in with it next.</p>
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
