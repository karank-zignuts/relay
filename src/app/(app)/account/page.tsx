import { ROLE_LABELS } from "@/lib/auth/roles";
import { requireUser } from "@/lib/auth/session";
import { ChangePasswordForm } from "./change-password-form";

export default async function AccountPage() {
  const user = await requireUser();

  return (
    <div className="mx-auto w-full max-w-xl space-y-8 px-4 py-10">
      <div>
        <h1 className="text-[32px] leading-[1.13] font-light tracking-[-0.02em]">Account</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {user.fullName || user.email} · {ROLE_LABELS[user.role]} · {user.email}
        </p>
      </div>
      <section className="rounded-[20px] bg-secondary p-8">
        <h2 className="mb-4 text-lg font-medium">Change password</h2>
        <ChangePasswordForm email={user.email} />
      </section>
    </div>
  );
}
