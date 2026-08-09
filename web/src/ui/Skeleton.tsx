// Loading placeholders shaped like the real layout, instead of the word
// "Loading…". bg-input avoids the card sheen/shadow so they read as ghosts.
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-card bg-input ${className}`} aria-hidden="true" />;
}

export function ScreenSkeleton() {
  return (
    <main className="flex flex-col gap-4 p-6" aria-busy="true">
      <Skeleton className="h-4 w-24 rounded-md" />
      <Skeleton className="h-9 w-44 rounded-lg" />
      <Skeleton className="h-32" />
      <Skeleton className="h-16" />
      <Skeleton className="h-16" />
      <Skeleton className="h-16" />
    </main>
  );
}
