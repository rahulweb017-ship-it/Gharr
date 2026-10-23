import { redirect } from "next/navigation";

/** The fulfilment console moved into the supplier portal. */
export default function VendorOpsPage() {
  redirect("/supplier/orders");
}
