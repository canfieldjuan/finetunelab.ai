import React from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { FineTuneLabFullLogoV2 } from '@/components/branding';

interface ContentPageHeaderProps {
  backHref?: string;
  backLabel?: string;
  showBack?: boolean;
}

export function ContentPageHeader({ 
  backHref, 
  backLabel = 'Back',
  showBack = false 
}: ContentPageHeaderProps) {
  return (
    <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center gap-4">
            {showBack && backHref ? (
              <Link 
                href={backHref} 
                className="flex items-center text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                {backLabel}
              </Link>
            ) : (
              <Link href="/">
                <FineTuneLabFullLogoV2 width={150} height={45} />
              </Link>
            )}
          </div>
          <div className="flex items-center gap-4">
            <Link href="/" className="text-sm font-medium hover:text-primary transition-colors">
              Home
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
