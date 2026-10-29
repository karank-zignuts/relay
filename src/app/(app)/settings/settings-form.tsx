"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { settingsSchema } from "@/features/settings/schemas";
import { taskKeys } from "@/features/tasks/queries";

type Values = { forgottenReplyHours: number; workingHoursStart: string; workingHoursEnd: string; workingHoursTimezone: string };

export function SettingsForm({ initial }: { initial: Values }) {
  const queryClient = useQueryClient();
  const [values, setValues] = useState<Values>(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = settingsSchema.safeParse(values);
    if (!parsed.success) return setError(parsed.error.issues[0].message);
    setError(null);
    setPending(true);
    const response = await fetch("/api/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed.data) });
    setPending(false);
    if (!response.ok) return setError("Could not save settings.");
    await queryClient.invalidateQueries({ queryKey: taskKeys.settings });
    toast.success("Settings saved");
  }

  return (
    <section className="rounded-[20px] bg-secondary p-8">
      <h2 className="text-lg font-medium">Reply tracking</h2>
      <p className="mt-1 mb-5 text-sm text-muted-foreground">
        A thread becomes “forgotten” when the client has waited this many working hours (Monday to Friday) for a team reply.
      </p>
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="hours">Forgotten after (working hours)</Label>
          <Input id="hours" type="number" min={1} max={72} value={values.forgottenReplyHours} onChange={(event) => setValues({ ...values, forgottenReplyHours: Number(event.target.value) })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tz">Time zone</Label>
          <Input id="tz" value={values.workingHoursTimezone} onChange={(event) => setValues({ ...values, workingHoursTimezone: event.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="start">Working day starts</Label>
          <Input id="start" type="time" value={values.workingHoursStart} onChange={(event) => setValues({ ...values, workingHoursStart: event.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="end">Working day ends</Label>
          <Input id="end" type="time" value={values.workingHoursEnd} onChange={(event) => setValues({ ...values, workingHoursEnd: event.target.value })} />
        </div>
        {error ? (
          <p role="alert" className="text-sm text-destructive sm:col-span-2">
            {error}
          </p>
        ) : null}
        <div className="sm:col-span-2">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save settings"}
          </Button>
        </div>
      </form>
    </section>
  );
}
