import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <>
      <h1 className="text-[32px] leading-[1.13] font-light tracking-[-0.02em]">Sign in</h1>
      <p className="mt-2 mb-8 text-sm text-muted-foreground">Use the account your admin invited you with.</p>
      <LoginForm />
    </>
  );
}
