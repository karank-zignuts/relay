"use server";

import { redirect } from "next/navigation";
import { logActivity } from "@/lib/activity";
import { getSessionUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { emailSchema } from "@/features/auth/schemas";

export type SignInState = { error?: string };

export async function signIn(_previous: SignInState, formData: FormData): Promise<SignInState> {
  const email = emailSchema.safeParse(formData.get("email"));
  const password = formData.get("password");
  if (!email.success || typeof password !== "string" || password.length === 0) {
    return { error: "Enter your email and password." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: email.data, password });
  if (error) return { error: "Incorrect email or password." };

  const actor = await getSessionUser();
  if (!actor) {
    await supabase.auth.signOut();
    return { error: "This account is not active. Ask your admin for access." };
  }

  await logActivity({ actor, action: "auth.login", entityType: "user", entityId: actor.id, summary: `${actor.email} signed in` });
  redirect("/tasks");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
