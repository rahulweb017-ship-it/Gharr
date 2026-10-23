import { LegalPage } from "@/components/layout/LegalPage";

export const metadata = { title: "Terms & conditions" };

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms & conditions"
      updated="September 2026"
      sections={[
        {
          heading: "Who we are",
          body: [
            "Gharr is a marketplace. Construction materials are sold by independent, verified vendors, and labour services are provided by independent workers. Gharr facilitates discovery, ordering, booking and payment, and is not the seller of materials or the employer of workers.",
          ],
        },
        {
          heading: "Estimates",
          body: [
            "Estimates are indicative. They are calculated from published construction norms and local prices at the time you create them, and every line shows its quantity and unit price. Actual quantities and costs depend on your design, site conditions and final material choices, and should be verified by a qualified professional before you commit to a budget.",
          ],
        },
        {
          heading: "Orders and delivery",
          body: [
            "Prices are shown inclusive of GST, with delivery charges shown before you pay. An order is confirmed once the vendor accepts it. Scheduled deliveries for heavy materials such as cement, steel and sand arrive in the slot you choose; please ensure site access and someone to receive the goods.",
            "You may cancel an order before it is dispatched. Refunds for prepaid orders are returned to the original payment method.",
          ],
        },
        {
          heading: "Labour bookings",
          body: [
            "Workers set their own rates. A booking is a request until the worker accepts it. Cancellation fees may apply close to the scheduled start, as shown when you book. Please report any safety concern or dispute through Help & support.",
          ],
        },
        {
          heading: "Your account",
          body: [
            "You sign in with a one-time code sent to your mobile number. Keep your phone secure; you are responsible for activity on your account.",
          ],
        },
      ]}
    />
  );
}
