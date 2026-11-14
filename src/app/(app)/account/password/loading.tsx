// Purpose: the loading state for /account/password. A skeleton shaped like the form.
import { FormSkeleton } from '@/components/auth/form-skeleton';

export default function Loading() {
  return (
    <main id="main" className="p-4 md:p-6 lg:p-8">
      <FormSkeleton />
    </main>
  );
}
