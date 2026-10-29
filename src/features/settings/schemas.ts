import { z } from "zod";

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM");

export const settingsSchema = z
  .object({
    forgottenReplyHours: z.number().int().min(1).max(72),
    workingHoursStart: time,
    workingHoursEnd: time,
    workingHoursTimezone: z.string().refine((value) => {
      try {
        new Intl.DateTimeFormat("en", { timeZone: value });
        return true;
      } catch {
        return false;
      }
    }, "Unknown time zone"),
  })
  .refine((value) => value.workingHoursStart < value.workingHoursEnd, { message: "Working hours must end after they start", path: ["workingHoursEnd"] });

export const createApiKeySchema = z.object({ name: z.string().trim().min(1, "Name the key").max(60) });
