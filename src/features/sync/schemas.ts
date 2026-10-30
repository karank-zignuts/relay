import { z } from "zod";
import { CHANGE_AREAS, ENVIRONMENTS, PRIORITIES, STATUSES } from "@/features/tasks/constants";

const isoDate = z.iso.datetime({ offset: true });
const slackTs = z.string().regex(/^\d{9,12}\.\d{3,8}$/, "Use a Slack message ts such as 1730000000.123456");

export const syncItemSchema = z.object({
  thread_ts: slackTs,
  channel_id: z.string().trim().min(1).max(40),
  title: z.string().trim().min(1).max(300),
  description: z.string().max(20_000).default(""),
  task_date: isoDate.optional(),
  slack_url: z.url().optional(),
  module: z.string().trim().min(1).max(100).optional(),
  tags: z.array(z.string().trim().toLowerCase().min(1).max(40)).max(10).optional(),
  // Only used when the task is first created. Humans own these afterwards.
  status: z.enum(STATUSES as [string, ...string[]]).optional(),
  priority: z.enum(PRIORITIES as [string, ...string[]]).optional(),
  environments: z.array(z.enum(ENVIRONMENTS as [string, ...string[]])).max(4).optional(),
  changes_in: z.array(z.enum(CHANGE_AREAS as [string, ...string[]])).max(6).optional(),
  assignee_slack_ids: z.array(z.string().regex(/^[UW][A-Z0-9]{2,}$/)).max(10).optional(),
  last_client_message_at: isoDate.nullable().optional(),
  last_team_reply_at: isoDate.nullable().optional(),
  jira_key: z.string().trim().max(40).optional(),
  jira_url: z.url().optional(),
  jira_status: z.string().trim().max(60).optional(),
  parent_thread_ts: slackTs.optional(),
  raw: z.record(z.string(), z.unknown()).optional(),
});

export const syncRequestSchema = z.object({
  items: z.array(syncItemSchema).min(1, "Send at least one thread").max(200, "Send at most 200 threads per request"),
});

export type SyncItem = z.infer<typeof syncItemSchema>;

const attachmentSchema = z
  .object({
    file_name: z.string().trim().min(1).max(200),
    mime_type: z.string().trim().max(100).optional(),
    size_bytes: z.number().int().nonnegative().optional(),
    /** A link to the file, for example its Slack permalink. Shown as a link when the file itself is not uploaded. */
    url: z.url().optional(),
    /** The file itself, base64 encoded (up to about 3 MB per request). Stored privately in Supabase Storage. */
    content_base64: z.string().max(4_500_000).optional(),
  })
  .refine((file) => file.url || file.content_base64, "Send a url, content_base64, or both");

export const attachmentsRequestSchema = z.object({
  thread_ts: slackTs,
  files: z.array(attachmentSchema).min(1).max(10),
});
