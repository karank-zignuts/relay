"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { emailSchema } from "@/features/auth/schemas";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) return setError("Enter a valid email.");
    setError(null);
    setPending(true);
    await createClient().auth.resetPasswordForEmail(parsed.data, {
      redirectTo: `${window.location.origin}/set-password`,
    });
    setPending(false);
    // Same message whether or not the account exists, so emails cannot be probed.
    setSent(true);
  }

  return (
    <>
      <h1 className="mb-2 text-[32px] leading-[1.13] font-light tracking-[-0.02em]">Forgot password</h1>
      {sent ? (
        <p className="mt-4 text-sm text-muted-foreground" role="status">
          If an account exists for that email, a reset link is on its way.
        </p>
      ) : (
        <>
          <p className="mb-8 text-sm text-muted-foreground">We will email you a link to set a new password.</p>
          <form onSubmit={onSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
            </div>
            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}
            <Button type="submit" size="lg" className="w-full" disabled={pending}>
              {pending ? "Sending…" : "Send reset link"}
            </Button>
          </form>
        </>
      )}
      <p className="mt-6 text-center text-sm">
        <Link href="/login" className="text-muted-foreground underline-offset-4 hover:underline">
          Back to sign in
        </Link>
      </p>
    </>
  );
}
