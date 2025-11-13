import type { Metadata } from "next";
import "../styles/globals.css";
import { AuthProvider } from "../contexts/AuthContext";
// import { LoggerInit } from "../components/LoggerInit"; // Temporarily disabled

export const metadata: Metadata = {
  title: "MVP Portal",
  description: "Bare Minimum MVP Portal with Next.js, Supabase, Shadcn/ui",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full overflow-hidden" suppressHydrationWarning>
      <head>
        <link
          rel="preconnect"
          href="https://fonts.googleapis.com"
        />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="h-full overflow-hidden" suppressHydrationWarning>
        {/* <LoggerInit /> */}
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
