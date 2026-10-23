import { LegalPage } from "@/components/layout/LegalPage";

export const metadata = { title: "Privacy policy" };

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy policy"
      updated="September 2026"
      sections={[
        {
          heading: "What we collect",
          body: [
            "Your mobile number (to sign you in), your name and optional email, the delivery and job-site addresses you save, your orders, bookings and estimates, and basic technical logs. IP addresses used for abuse protection are stored only as one-way hashes.",
          ],
        },
        {
          heading: "How we use it",
          body: [
            "To deliver materials, schedule workers, take payment, send order and booking updates, and prevent fraud. Vendors and workers receive only what they need to fulfil your order or booking — typically the contact name, phone number and address for that job.",
          ],
        },
        {
          heading: "What we don't do",
          body: [
            "We do not sell your personal data. Your location from “Use my current location” is used on your device to pick the nearest city and is not sent to our servers.",
          ],
        },
        {
          heading: "Your choices",
          body: [
            "You can edit or delete saved addresses and update your name and email at any time from your profile. To close your account or request a copy of your data, contact Help & support.",
          ],
        },
      ]}
    />
  );
}
