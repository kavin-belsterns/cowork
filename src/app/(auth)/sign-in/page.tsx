// Purpose: the sign-in page. Success redirects from the action, so this page only shows the form.
// Rules: spec S01 section 2. `returnTo` is checked here as well as in the action. An unsafe value is dropped.
import type { Metadata } from 'next';
import { SignInForm } from '@/components/auth/sign-in-form';
import { checkedReturnTo } from '@/lib/auth/return-to';

export const metadata: Metadata = { title: 'Sign in' };

type SearchParams = Promise<{ returnTo?: string | string[]; reason?: string | string[] }>;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export default async function SignInPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const returnTo = checkedReturnTo(first(params.returnTo));
  const expired = first(params.reason) === 'expired';
  return (
    <section aria-labelledby="sign-in-title" className="flex w-full flex-col gap-4 rounded-lg border border-border bg-background p-6 md:w-96">
      <h1 id="sign-in-title" className="text-xl font-semibold">
        Sign in
      </h1>
      <SignInForm returnTo={returnTo} expired={expired} />
    </section>
  );
}
