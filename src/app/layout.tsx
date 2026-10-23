import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Gharr — materials + labour in one app",
    template: "%s · Gharr",
  },
  description:
    "Build, repair and maintain your home. Buy construction materials from verified vendors and hire skilled local workers — in one app.",
  applicationName: "Gharr",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#0c2657",
  width: "device-width",
  initialScale: 1,
  // Installable-PWA behaviour: the shell should sit under the status bar on a
  // phone rather than being letterboxed.
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // Browser extensions (password managers, Grammarly, etc.) inject attributes
    // onto <html>/<body> before hydration; suppress the resulting attribute-only
    // mismatch warnings. This only applies one level deep, not to children.
    <html lang="en-IN" suppressHydrationWarning>
      <body className="min-h-screen antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
