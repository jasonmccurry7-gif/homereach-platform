export default function LoadingAgentMiniApps() {
  return (
    <main className="min-h-screen bg-[#07111f] p-4 text-white sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="h-7 w-56 animate-pulse rounded-md bg-white/10" />
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="h-24 animate-pulse rounded-lg border border-white/10 bg-white/[0.04]" />
          ))}
        </div>
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-64 animate-pulse rounded-lg border border-white/10 bg-white/[0.04]" />
          ))}
        </div>
      </div>
    </main>
  );
}
