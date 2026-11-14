// Purpose: the loading skeleton for the two auth forms: a title, two fields and a button.
// Rules: standards/ui.md (skeleton shaped like content, motion-safe pulse).
export function FormSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      data-testid="form-skeleton"
      className="flex w-full flex-col gap-4 rounded-lg border border-border bg-background p-6 md:w-96"
    >
      <span className="sr-only">Loading</span>
      <div aria-hidden="true" className="h-8 w-1/2 rounded-sm bg-muted motion-safe:animate-pulse" />
      <div aria-hidden="true" className="h-10 w-full rounded-sm bg-muted motion-safe:animate-pulse" />
      <div aria-hidden="true" className="h-10 w-full rounded-sm bg-muted motion-safe:animate-pulse" />
      <div aria-hidden="true" className="h-10 w-full rounded-md bg-muted motion-safe:animate-pulse md:w-32" />
    </div>
  );
}
