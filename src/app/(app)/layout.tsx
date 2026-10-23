import { BottomNav } from "@/components/layout/BottomNav";
import { TopNav } from "@/components/layout/TopNav";

/**
 * Shell for every customer surface. Auth screens live outside this group so
 * they render without navigation.
 *
 * Responsive by design: phones get the mockups' single column with a bottom tab
 * bar; from md up a sticky top nav takes over and pages lay out in a centred
 * 7xl column with multi-column grids.
 */
export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="app-shell min-h-screen">
      <TopNav />
      <main className="mx-auto w-full max-w-7xl md:px-6 md:pb-16">{children}</main>
      <BottomNav />
    </div>
  );
}
