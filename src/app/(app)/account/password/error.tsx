'use client';
// Purpose: the error state for /account/password. Shows the `internal` copy with a reference id and a retry button.
import { RouteError } from '@/components/auth/route-error';

export default function PasswordError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <RouteError error={error} retry={retry} as="main" />;
}
