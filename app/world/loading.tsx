export default function Loading() {
  return (
    <div role="status" aria-label="Loading" className="space-y-5">
      <div className="h-10 w-2/3 animate-pulse rounded-2xl bg-cream" />
      <div className="h-64 animate-pulse rounded-[1.5rem] bg-cream" />
      <div className="grid gap-5 sm:grid-cols-2"><div className="h-40 animate-pulse rounded-[1.5rem] bg-cream" /><div className="h-40 animate-pulse rounded-[1.5rem] bg-cream" /></div>
    </div>
  );
}
