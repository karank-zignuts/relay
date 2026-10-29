"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { changePasswordSchema } from "@/features/auth/schemas";
import { createClient } from "@/lib/supabase/client";

export function ChangePasswordForm({ email }: { email: string }) {
  const [values, setValues] = useState({ current: "", password: "", confirm: "" });
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const set = (key: keyof typeof values) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setValues((previous) => ({ ...previous, [key]: event.target.value }));

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = changePasswordSchema.safeParse(values);
    if (!parsed.success) return setError(parsed.error.issues[0].message);
    setError(null);
    setPending(true);

    const supabase = createClient();
    const { error: verifyError } = await supabase.auth.signInWithPassword({ email, password: values.current });
    if (verifyError) {
      setPending(false);
      return setError("Your current password is incorrect.");
    }
    const { error: updateError } = await supabase.auth.updateUser({ password: values.password });
    setPending(false);
    if (updateError) return setError(updateError.message);

    setValues({ current: "", password: "", confirm: "" });
    toast.success("Password changed");
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="current">Current password</Label>
        <Input id="current" type="password" autoComplete="current-password" value={values.current} onChange={set("current")} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">New password</Label>
        <Input id="password" type="password" autoComplete="new-password" value={values.password} onChange={set("password")} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="confirm">Confirm new password</Label>
        <Input id="confirm" type="password" autoComplete="new-password" value={values.confirm} onChange={set("confirm")} required />
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Change password"}
      </Button>
    </form>
  );
}
