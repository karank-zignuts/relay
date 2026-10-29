import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function apiError(code: string, message: string, status: number, details: unknown = {}) {
  return NextResponse.json({ error: { code, message, details } }, { status });
}

export function validationError(error: ZodError) {
  return apiError("VALIDATION_ERROR", "The request is invalid.", 422, error.flatten());
}

/** Supabase's built-in mailer allows only a few emails an hour. Say so plainly instead of a generic failure. */
export function emailError(context: string, error: { status?: number; code?: string; message: string }) {
  if (error.status === 429 || error.code === "over_email_send_rate_limit") {
    return apiError("EMAIL_RATE_LIMIT", "Too many emails were sent recently. Wait a few minutes, or connect Resend as the email provider.", 429);
  }
  return internalError(context, error);
}

export function internalError(context: string, error: unknown) {
  // Log the detail server-side only. Never return it to the client.
  console.error(`[${context}]`, error instanceof Error ? error.message : error);
  return apiError("INTERNAL_ERROR", "Something went wrong. Please try again.", 500);
}
