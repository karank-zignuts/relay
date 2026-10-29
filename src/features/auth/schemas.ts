import { z } from "zod";

export const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters")
  .max(72, "Use at most 72 characters");

export const emailSchema = z.email("Enter a valid email").transform((value) => value.trim().toLowerCase());

export const setPasswordSchema = z
  .object({ password: passwordSchema, confirm: z.string() })
  .refine((value) => value.password === value.confirm, { message: "Passwords do not match", path: ["confirm"] });

export const changePasswordSchema = z
  .object({ current: z.string().min(1, "Enter your current password"), password: passwordSchema, confirm: z.string() })
  .refine((value) => value.password === value.confirm, { message: "Passwords do not match", path: ["confirm"] })
  .refine((value) => value.password !== value.current, { message: "Choose a different password", path: ["password"] });
