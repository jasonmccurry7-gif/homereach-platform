export function HowItWorksBlockView() {
  return (
    <section>
      <h2 className="text-2xl font-bold text-white mb-6">How HomeReach works</h2>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
          <div className="text-sm font-bold text-blue-400">1</div>
          <p className="mt-2 font-semibold text-white">Claim your slot</p>
          <p className="mt-1 text-sm text-gray-400">
            One business per category per city. First-come, first-served.
          </p>
        </div>
        <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
          <div className="text-sm font-bold text-blue-400">2</div>
          <p className="mt-2 font-semibold text-white">We mail every month</p>
          <p className="mt-1 text-sm text-gray-400">
            Your business appears on monthly postcards to thousands of local homeowners.
          </p>
        </div>
        <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
          <div className="text-sm font-bold text-blue-400">3</div>
          <p className="mt-2 font-semibold text-white">Homeowners call you</p>
          <p className="mt-1 text-sm text-gray-400">
            When they need your service, they remember the name they&apos;ve been seeing.
          </p>
        </div>
      </div>
    </section>
  );
}
