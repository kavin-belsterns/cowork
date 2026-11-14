// Purpose: the own-password page. Success redirects from the action to the role home.
// Rules: spec S01 section 2. The `version` field carries the user row version so a stale form is refused.
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { PasswordForm } from '@/components/auth/password-form';
import { PageShell } from '@/components/shell/page-shell';
import { getSession } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'Set a new password' };

export default async function PasswordPage() {
  const session = await getSession();
  if (session === null) redirect('/sign-in?reason=expired&returnTo=%2Faccount%2Fpassword');
  return (
    <PageShell session={session}>
      <section aria-labelledby="password-title" className="flex w-full max-w-md flex-col gap-4">
        <h1 id="password-title" className="text-xl font-semibold">
          Set a new password
        </h1>
        {session.mustChangePassword ? (
          <p className="text-base text-muted-foreground">Your admin reset your password. Set a new one to continue.</p>
        ) : null}
        <PasswordForm version={session.version} />
      </section>
    </PageShell>
  );
}
