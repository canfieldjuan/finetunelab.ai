"use client";

import React from "react";
import { useAuth } from "../../contexts/AuthContext";
import { Button } from "../../components/ui/button";
import Link from "next/link";

export default function HomePage() {
  const { user } = useAuth();

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-background">
      <div className="bg-card border border-border p-8 rounded shadow-md w-full max-w-md text-center">
        <h1 className="text-2xl font-bold mb-4">Home</h1>
        <p className="mb-4">
          Welcome, {user?.email || "guest"}!
        </p>
        <div className="flex flex-col gap-4">
          <Link href="/chat" passHref>
            <Button>Go to Chat</Button>
          </Link>
          <Link href="/account" passHref>
            <Button variant="outline">Account</Button>
          </Link>
        </div>
      </div>
    </main>
  );
}
