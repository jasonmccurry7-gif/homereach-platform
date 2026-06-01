import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { loadGovContractBidWorkspace } from "@/lib/gov-contracts/execution";
import { BidCommandCenter } from "../../_components/BidCommandCenter";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Gov Contract Bid Command Center - HomeReach Admin" };

interface PageProps {
  params: Promise<{ opportunityId: string }>;
}

export default async function GovContractBidRoomPage({ params }: PageProps) {
  const { opportunityId } = await params;
  const { opportunity, workspace } = await loadGovContractBidWorkspace(decodeURIComponent(opportunityId));
  if (!opportunity || !workspace) notFound();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link href={`/admin/gov-contracts/${encodeURIComponent(opportunity.id)}`} className="text-sm font-bold text-blue-700 hover:text-blue-900">
          Back to opportunity review
        </Link>
        <Link href="/admin/gov-contracts" className="text-sm font-bold text-slate-600 hover:text-slate-900">
          Gov Contracts dashboard
        </Link>
      </div>

      {!workspace.persisted ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <p className="font-black">Planning preview</p>
          <p className="mt-1 leading-6">
            This bid workspace is generated from the opportunity record. Click Start Bid from the opportunity actions to persist
            requirements, pricing, compliance, subcontractor, submission, and post-award records.
          </p>
        </section>
      ) : null}

      <BidCommandCenter opportunity={opportunity} workspace={workspace} />
    </div>
  );
}
