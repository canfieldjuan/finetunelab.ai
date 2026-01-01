"use client";

import React from "react";
import Chat from "@/components/Chat";

export function Demo() {
  console.log("[Demo] Component mounted");

  return (
    <section id="demo-chat-widget" className="py-16 px-6 bg-gradient-to-b from-white to-gray-50 dark:from-slate-900 dark:to-slate-800">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Talk to Our AI Assistant
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-300">
            Try our chat interface right now. Ask questions about Fine Tune Lab, model training,
            or anything else. This is powered by the same technology you&apos;ll use in production.
          </p>
        </div>

        <div className="rounded-2xl shadow-2xl overflow-hidden bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700">
          <div className="h-[525px] overflow-hidden">
            <Chat demoMode={true} />
          </div>
        </div>
      </div>
    </section>
  );
}
