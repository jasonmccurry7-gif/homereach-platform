import Link from "next/link";

// ─────────────────────────────────────────────────────────────────────────────
// Section "Coming soon" stub
//
// Used by the freshly-scaffolded sub-routes (leads, plans, payments,
// reporting, routes, data-sources) added in migration 068 / Phase 2a.
// Each section page renders this with a tailored title + bullet list of
// the data it WILL show, plus links to the underlying tables / docs that
// already exist. Operators can land on every nav item and see real
// context, never a blank page.
//
// As individual sections graduate to real implementations, this component
// stays useful for the "next phase" placeholder pattern.
// ─────────────────────────────────────────────────────────────────────────────

interface SectionStubProps {
  title: string;
  subtitle?: string;
  /** Bullets describing what this section will surface once implemented. */
  willShow: readonly string[];
  /** Names of the underlying SQL tables — surfaced for transparency. */
  backingTables?: readonly string[];
  /** Optional list of related operator-facing links. */
  relatedLinks?: readonly { label: string; href: string }[];
  /** Phase number from the original spec, for cross-reference. */
  phase?: string;
}

export function SectionStub(props: SectionStubProps) {
  return (
    <section className="space-y-4">
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            {props.title}
          </h1>
          <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800">
            COMING SOON
          </span>
          {props.phase && (
            <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
              {props.phase}
            </span>
          )}
        </div>
        {props.subtitle && (
          <p className="text-sm text-slate-600">{props.subtitle}</p>
        )}
      </header>

      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          What this page will show
        </h2>
        <ul className="mt-3 space-y-2">
          {props.willShow.map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />
              <span>{item}</span>
            </li>
          ))}
        </ul>

        {props.backingTables && props.backingTables.length > 0 && (
          <div className="mt-5 border-t border-slate-100 pt-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Backing tables (already migrated)
            </h3>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {props.backingTables.map((t) => (
                <code
                  key={t}
                  className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-700"
                >
                  {t}
                </code>
              ))}
            </div>
          </div>
        )}

        {props.relatedLinks && props.relatedLinks.length > 0 && (
          <div className="mt-5 border-t border-slate-100 pt-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Related
            </h3>
            <ul className="mt-2 space-y-1">
              {props.relatedLinks.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    → {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
