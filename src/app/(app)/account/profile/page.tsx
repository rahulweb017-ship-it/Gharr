import { getCurrentUser } from "@/server/services/auth.service";
import { requirePageActor } from "@/server/auth/page-session";
import { PageHeader } from "@/components/layout/PageHeader";
import { ProfileForm } from "@/components/account/ProfileForm";

export const metadata = { title: "Personal information" };
export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const actor = await requirePageActor("/account/profile");
  const user = await getCurrentUser(actor.userId);

  return (
    <div className="pb-8 md:mx-auto md:max-w-xl">
      <PageHeader title="Personal information" backHref="/account" />
      <div className="px-4 md:px-0">
        <ProfileForm name={user.name ?? ""} email={user.email ?? ""} phone={user.phone} />
      </div>
    </div>
  );
}
