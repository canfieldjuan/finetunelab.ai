import type { Metadata } from "next";
import "../styles/globals.css";
import { AuthProvider } from "../contexts/AuthContext";
import { WorkspaceProvider } from "../contexts/WorkspaceContext";
import { Inter } from "next/font/google";
// import { LoggerInit } from "../components/LoggerInit"; // Temporarily disabled

export const metadata: Metadata = {
  title: "Fine Tune Lab",
  description: "Model Training and Assessment Portal - Fine Tune Lab",
};

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <body className={`${inter.className} h-full`} suppressHydrationWarning>
        {/* <LoggerInit /> */}
        <AuthProvider>
          <WorkspaceProvider>
            {children}
          </WorkspaceProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
