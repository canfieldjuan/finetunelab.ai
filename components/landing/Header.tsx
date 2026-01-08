"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";

export function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <Image
              src="/finetune-lab-full-logo.svg"
              alt="FineTune Lab"
              width={240}
              height={50}
              className="h-12 w-auto dark:hidden"
              priority
            />
            <Image
              src="/finetune-lab-full-logo-white.svg"
              alt="FineTune Lab"
              width={240}
              height={50}
              className="h-12 w-auto hidden dark:block"
              priority
            />
          </Link>

          {/* Navigation */}
          <nav className="flex items-center gap-4">
            <Link href="/demo/test-model">
              <Button variant="ghost" size="sm">
                Try Demo
              </Button>
            </Link>
            <Link href="/login">
              <Button size="sm" className="bg-gradient-to-r from-orange-600 to-pink-600 hover:from-orange-700 hover:to-pink-700 text-white">
                Sign Up
              </Button>
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}
