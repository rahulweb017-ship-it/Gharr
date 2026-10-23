import { notFound } from "next/navigation";
import { prisma } from "@/server/db/prisma";
import { isProduction, env } from "@/server/env";
import { MockGateway } from "@/components/shop/MockGateway";
import { formatINR } from "@/shared/money";

export const metadata = { title: "Test payment gateway" };
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ paymentId: string }>;
}

/**
 * Offline test gateway.
 *
 * Stands in for Razorpay/PhonePe while merchant onboarding is pending. Choosing
 * an outcome here posts an HMAC-signed body to the same
 * /api/v1/payments/webhook endpoint a real provider calls, so the code that
 * confirms orders in development is the code that will confirm them in
 * production — not a shortcut around it.
 *
 * Refuses to render outside development.
 */
export default async function MockPaymentPage({ params }: PageProps) {
  if (isProduction || env.PAYMENT_PROVIDER !== "mock") notFound();

  const { paymentId } = await params;

  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    select: {
      id: true,
      amountPaise: true,
      status: true,
      providerOrderId: true,
      orders: {
        select: {
          id: true,
          orderNumber: true,
          totalPaise: true,
          vendor: { select: { businessName: true } },
        },
      },
    },
  });

  if (!payment || !payment.providerOrderId) notFound();

  return (
    <div className="mx-auto min-h-screen max-w-[520px] bg-ink-50 px-4 py-10">
      <div className="rounded-(--radius-sheet) bg-white p-6 shadow-(--shadow-raised)">
        <div className="mb-5 rounded-lg bg-amber-50 px-3 py-2 text-center text-[11px] font-semibold text-amber-800">
          TEST GATEWAY — no real money moves
        </div>

        <p className="text-center text-[13px] text-ink-500">Amount payable</p>
        <p className="text-center text-3xl font-bold text-ink-900 tabular">
          {formatINR(payment.amountPaise)}
        </p>

        <ul className="mt-5 space-y-1.5 border-t border-ink-100 pt-4">
          {payment.orders.map((order) => (
            <li
              key={order.id}
              className="flex items-center justify-between gap-3 text-[12px]"
            >
              <span className="min-w-0 truncate text-ink-600">
                {order.vendor.businessName}
                <span className="ml-1.5 font-mono text-[10px] text-ink-400">
                  {order.orderNumber}
                </span>
              </span>
              <span className="shrink-0 font-semibold text-ink-900 tabular">
                {formatINR(order.totalPaise)}
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-6">
          <MockGateway
            paymentId={payment.id}
            providerOrderId={payment.providerOrderId}
            firstOrderId={payment.orders[0]?.id ?? null}
            alreadySettled={payment.status === "CAPTURED" || payment.status === "FAILED"}
          />
        </div>

        <p className="mt-5 text-center text-[11px] leading-relaxed text-ink-400">
          Each button sends a signed webhook to the real payment handler, exactly
          as a live gateway would.
        </p>
      </div>
    </div>
  );
}
