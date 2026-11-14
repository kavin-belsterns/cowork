'use client';
// Purpose: the error state for /sign-in. Shows the `internal` copy with a reference id and a retry button.
import { RouteError } from '@/components/auth/route-error';

export default function SignInError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <RouteError error={error} retry={retry} />;
}
