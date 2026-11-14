import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';

export default function NotFound() {
  return (
    <main className="min-h-screen bg-background text-foreground font-sans flex items-center justify-center p-4">
      <div className="max-w-md w-full rounded-lg border border-border bg-background p-6 shadow-sm text-center">
        <h1 className="text-xl font-semibold mb-2">Item not found</h1>
        <p className="text-base text-muted-foreground mb-6">
          We could not find this item.
        </p>
        <Link href="/" className={buttonVariants({ variant: 'default' })}>
          Go to home
        </Link>
      </div>
    </main>
  );
}
