import type { Metadata } from "next";
import Link from "next/link";
import { db, orders, bundles, businesses } from "@homereach/db";
import { eq } from "drizzle-orm";

export const metadata: Metadata = {
  title: "Checkout Received - HomeReach",
};
export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ order?: string }>;
}

export default async function CheckoutSuccessPage({ searchParams }: Props) {
  const { order: orderId } = await searchParams;

  // Load order details if available
  let orderDetails: {
    businessName: string;
    bundleName: string;
    city: string;
  } | null = null;

  if (orderId) {
    const [orderRow] = await db
      .select({
        bundleId: orders.bundleId,
        businessId: orders.businessId,
      })
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (orderRow) {
      const [biz, bundle] = await Promise.all([
        db.select({ name: businesses.name }).from(businesses).where(eq(businesses.id, orderRow.businessId)).limit(1),
        orderRow.bundleId
          ? db.select({ name: bundles.name }).from(bundles).where(eq(bundles.id, orderRow.bundleId)).limit(1)
          : Promise.resolve([]),
      ]);

      orderDetails = {
        businessName: biz[0]?.name ?? "your business",
        bundleName: (bundle as { name: string }[])[0]?.name ?? "your campaign",
        city: "",
      };
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-blue-50 to-white px-4 py-16">
      <div className="w-full max-w-lg text-center">

        {/* Success animation */}
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-100 ring-8 ring-green-50">
          <svg
            className="h-10 w-10 text-green-600"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>

        <h1 className="text-3xl font-bold text-gray-900">
          {orderDetails?.businessName
            ? `${orderDetails.businessName} checkout was received`
            : "Checkout received"}
        </h1>
        <p className="mt-3 text-lg text-gray-500">
          {orderDetails?.bundleName
            ? `HomeReach will confirm your ${orderDetails.bundleName} payment event and inventory status before fulfillment begins.`
            : "HomeReach will confirm the payment event and inventory status before fulfillment begins."}
        </p>

        {/* What happens next */}
        <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-6 text-left shadow-sm">
          <h2 className="mb-4 font-bold text-gray-900">What happens next</h2>
          <ol className="space-y-4">
            {[
              {
                step: "1",
                title: "We confirm payment and inventory",
                body: "Stripe sends the payment event to HomeReach. If anything needs review, we will contact you before fulfillment starts.",
                timing: "Right now",
              },
              {
                step: "2",
                title: "Our team designs your ad",
                body: "We'll create your ad and send it for your approval before anything goes to print.",
                timing: "Within 2-3 business days",
              },
              {
                step: "3",
                title: "Postcards move to print and mail",
                body: "Once your proof, payment, and mail window are approved, we coordinate printing and mailing.",
                timing: "10-14 business days",
              },
              {
                step: "4",
                title: "Track results in your dashboard",
                body: "Log into your HomeReach dashboard to see campaign status, known response signals, notes, and next steps.",
                timing: "Ongoing",
              },
            ].map((item) => (
              <li key={item.step} className="flex gap-4">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                  {item.step}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-gray-900 text-sm">{item.title}</p>
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                      {item.timing}
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm text-gray-500">{item.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/dashboard"
            className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white shadow-sm hover:bg-blue-700"
          >
            Go to my dashboard
          </Link>
          <Link
            href="/"
            className="rounded-xl border border-gray-300 bg-white px-6 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Back to home
          </Link>
        </div>

        <p className="mt-6 text-xs text-gray-400">
          Questions? Email us at{" "}
          <a href="mailto:hello@home-reach.com" className="underline hover:text-gray-600">
            hello@home-reach.com
          </a>
        </p>
      </div>
    </div>
  );
}
