import { CircleCheck } from "lucide-react";
import { LoginForm } from "./login-form";

const NOTICES: Record<string, string> = {
  welcome: "Your password is set. Sign in to get started.",
  "password-reset": "Your password was changed. Sign in with the new one.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const { notice } = await searchParams;
  const message = notice ? NOTICES[notice] : undefined;

  return (
    <>
      <h1 className="text-[32px] leading-[1.13] font-light tracking-[-0.02em]">Sign in</h1>
      <p className="mt-2 mb-8 text-sm text-muted-foreground">Use the account your admin invited you with.</p>
      {message ? (
        <p role="status" data-testid="login-notice" className="mb-6 flex items-center gap-2 rounded-[12px] bg-secondary p-3.5 text-sm animate-pop">
          <CircleCheck className="size-4 shrink-0" aria-hidden /> {message}
        </p>
      ) : null}
      <LoginForm />
    </>
  );
}
