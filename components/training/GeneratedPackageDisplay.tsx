// Generated Package Display Component
// Purpose: Full-width display for newly generated training packages
// Date: 2025-10-30

'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  X,
  Package,
  ExternalLink,
  Copy,
  CheckCircle2,
  Download,
  Play,
  RefreshCw,
} from 'lucide-react';

console.log('[GeneratedPackageDisplay] Component loaded');

interface GeneratedPackage {
  configId: string;
  configName: string;
  publicId?: string;
  colabUrl?: string;
  localPackageReady?: boolean;
  datasetCount?: number;
  generatedAt: Date;
  type: 'cloud' | 'local';
}

interface GeneratedPackageDisplayProps {
  package: GeneratedPackage;
  onDismiss: () => void;
  onRegenerate?: () => void;
  onRevoke?: () => void;
}

export function GeneratedPackageDisplay({
  package: pkg,
  onDismiss,
  onRegenerate,
  onRevoke,
}: GeneratedPackageDisplayProps) {
  console.log('[GeneratedPackageDisplay] Rendered for:', pkg.configName);

  const [copied, setCopied] = useState(false);

  const handleCopyPublicId = () => {
    if (pkg.publicId) {
      navigator.clipboard.writeText(pkg.publicId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCopyColabUrl = () => {
    if (pkg.colabUrl) {
      navigator.clipboard.writeText(pkg.colabUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Card className="border-2 border-primary/20 bg-primary/5">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Package className="w-5 h-5 text-primary" />
              <CardTitle>Training Package Generated</CardTitle>
              <Badge variant="outline" className="ml-2">
                {pkg.type === 'cloud' ? 'Cloud Training' : 'Local Training'}
              </Badge>
            </div>
            <CardDescription>
              {pkg.configName}
              {pkg.datasetCount ? ` • ${pkg.datasetCount} dataset${pkg.datasetCount > 1 ? 's' : ''}` : ''}
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDismiss}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Dismiss</span>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Cloud Package Info */}
        {pkg.type === 'cloud' && pkg.publicId && (
          <div className="space-y-3">
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                Your training package is ready! Use the Public ID below to train in Google Colab.
              </AlertDescription>
            </Alert>

            {/* Public ID */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Public ID</label>
              <div className="flex gap-2">
                <div className="flex-1 px-3 py-2 bg-muted rounded-md font-mono text-sm truncate">
                  {pkg.publicId}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyPublicId}
                  className="flex-shrink-0"
                >
                  {copied ? (
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>

            {/* Colab Link */}
            {pkg.colabUrl && (
              <div className="flex gap-2">
                <Button
                  variant="default"
                  className="flex-1"
                  onClick={() => window.open(pkg.colabUrl, '_blank')}
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Open in Google Colab
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyColabUrl}
                  className="flex-shrink-0"
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-2 border-t">
              {onRegenerate && (
                <Button variant="outline" size="sm" onClick={onRegenerate}>
                  <RefreshCw className="w-3 h-3 mr-2" />
                  Regenerate
                </Button>
              )}
              {onRevoke && (
                <Button variant="outline" size="sm" onClick={onRevoke} className="text-destructive">
                  Revoke Public ID
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Local Package Info */}
        {pkg.type === 'local' && (
          <div className="space-y-3">
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                Your local training package is ready! You can download it or run training immediately.
              </AlertDescription>
            </Alert>

            <div className="flex gap-2">
              <Button variant="default" className="flex-1">
                <Download className="w-4 h-4 mr-2" />
                Download Package
              </Button>
              <Button variant="default" className="flex-1">
                <Play className="w-4 h-4 mr-2" />
                Run Now
              </Button>
            </div>

            {onRegenerate && (
              <div className="pt-2 border-t">
                <Button variant="outline" size="sm" onClick={onRegenerate} className="w-full">
                  <RefreshCw className="w-3 h-3 mr-2" />
                  Regenerate Package
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Timestamp */}
        <p className="text-xs text-muted-foreground text-right">
          Generated {pkg.generatedAt.toLocaleTimeString()}
        </p>
      </CardContent>
    </Card>
  );
}

console.log('[GeneratedPackageDisplay] Component defined');
