import { z } from "zod";
import { USER_ROLES } from "@/lib/auth/roles";

const slackUserIdSchema = z
  .string()
  .trim()
  .regex(/^[UW][A-Z0-9]{2,}$/, "Use a Slack member ID such as U01ABC23DEF");

export const inviteUserSchema = z.object({
  email: z.email().transform((value) => value.trim().toLowerCase()),
  fullName: z.string().trim().min(1, "Enter a name").max(100),
  role: z.enum(USER_ROLES),
  slackUserId: z.union([slackUserIdSchema, z.literal("")]).optional(),
});

export const updateUserSchema = z
  .object({
    fullName: z.string().trim().min(1).max(100).optional(),
    role: z.enum(USER_ROLES).optional(),
    slackUserId: z.union([slackUserIdSchema, z.literal(""), z.null()]).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "Nothing to update");

export type InviteUserInput = z.infer<typeof inviteUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
