"use client";

import React from "react";
import { useAuth } from "../../contexts/AuthContext";
import { Button } from "../../components/ui/button";

export default function AccountPage() {
  const { user, signOut } = useAuth();

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded shadow-md w-full max-w-md text-center">
        <h1 className="text-2xl font-bold mb-4">Account</h1>
        <div className="mb-4">
          <span className="font-semibold">Email:</span>
          <div className="text-gray-700">{user?.email || "Not logged in"}</div>
        </div>
        <Button onClick={signOut} className="w-full mb-2">Logout</Button>
        <Button
          className="w-full bg-red-600 hover:bg-red-700 mt-2"
          onClick={async () => {
            if (!user) return;
            // Delete user from Supabase Auth
            const res = await fetch("/api/delete-account", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ user_id: user.id }),
            });
            if (res.ok) {
              signOut();
            } else {
              alert("Failed to delete account.");
            }
          }}
        >
          Delete Account
        </Button>
      </div>
    </main>
  );
}
