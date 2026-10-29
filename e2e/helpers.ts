import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { APIRequestContext } from "@playwright/test";
import { ROLES, type Role } from "./roles";

export const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** A Supabase client signed in as one of the test accounts. Goes straight at RLS, bypassing the UI. */
export async function clientAs(role: Role): Promise<{ supabase: SupabaseClient; userId: string }> {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.signInWithPassword({ email: process.env[ROLES[role]]!, password: process.env.E2E_PASSWORD! });
  if (error || !data.user) throw new Error(`Could not sign in as ${role}: ${error?.message}`);
  return { supabase, userId: data.user.id };
}

/** Creates an API key through the settings API. Needs a request context that holds a Super Admin session. */
export async function createApiKey(request: APIRequestContext, name = `e2e-${uid()}`) {
  const response = await request.post("/api/api-keys", { data: { name } });
  if (!response.ok()) throw new Error(`Could not create API key: ${response.status()}`);
  const { id, key } = (await response.json()) as { id: string; key: string };
  return { id, key, revoke: () => request.delete(`/api/api-keys/${id}`) };
}

let tsCounter = 0;
/** A unique, valid Slack-style ts for one test thread. */
export function slackTs() {
  tsCounter += 1;
  return `${Math.floor(Date.now() / 1000)}.${String(100000 + tsCounter).padStart(6, "0")}`;
}

export function syncItem(overrides: Record<string, unknown> = {}) {
  const thread_ts = slackTs();
  return {
    thread_ts,
    channel_id: "C0E2ETEST",
    title: `E2E thread ${uid()}`,
    description: "Client asked for a change.",
    slack_url: `https://example.slack.com/archives/C0E2ETEST/p${thread_ts.replace(".", "")}`,
    ...overrides,
  };
}

export const bearer = (key: string) => ({ Authorization: `Bearer ${key}` });
