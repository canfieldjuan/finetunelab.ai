'use client';

/**
 * Training Config Detail Page
 * Created: November 13, 2025
 * Purpose: Display training config details with collaboration features
 */

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useFreshToken } from '@/hooks/useFreshToken';
import { PageWrapper } from '@/components/layout/PageWrapper';
import { PageHeader } from '@/components/layout/PageHeader';
import { LoadingState } from '@/components/ui/LoadingState';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Download, Edit2 } from 'lucide-react';
import { ShareButton } from '@/components/workspace/ShareButton';
import { CommentThread } from '@/components/workspace/CommentThread';
import type { TrainingConfigRecord } from '@/lib/training/training-config.types';

export default function TrainingConfigDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user, session, signOut } = useAuth();
  const getFreshToken = useFreshToken();
  const configId = (params?.id as string) || '';

  const [config, setConfig] = useState<TrainingConfigRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user && session?.access_token && configId) {
      fetchConfig();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, configId]);

  async function fetchConfig() {
    console.log('[TrainingConfigDetail] Fetching config:', configId);
    setLoading(true);
    setError(null);

    try {
      const token = getFreshToken();
      const response = await fetch(`/api/training/${configId}`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Training config not found');
        }
        throw new Error('Failed to fetch config');
      }

      const data = await response.json();
      console.log('[TrainingConfigDetail] Loaded config:', data.config.name);
      setConfig(data.config);
    } catch (err) {
      console.error('[TrainingConfigDetail] Fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load config');
    } finally {
      setLoading(false);
    }
  }

  function downloadConfig() {
    if (!config) return;
    
    console.log('[TrainingConfigDetail] Downloading:', config.name);
    const blob = new Blob([JSON.stringify(config.config_json, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${config.name.replace(/\s+/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function formatTemplateName(templateKey: string): string {
    return templateKey
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Please log in to view training configs.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <PageWrapper currentPage="training" user={user} signOut={signOut}>
        <LoadingState fullScreen message="Loading training config..." />
      </PageWrapper>
    );
  }

  if (error || !config) {
    return (
      <PageWrapper currentPage="training" user={user} signOut={signOut}>
        <PageHeader title="Error" description="Failed to load training config" />
        <div className="max-w-4xl mx-auto mt-8">
          <Card>
            <CardContent className="p-6">
              <div className="text-center">
                <p className="text-red-600 mb-4">{error || 'Config not found'}</p>
                <Button onClick={() => router.push('/training')} variant="outline">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Training Configs
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper currentPage="training" user={user} signOut={signOut}>
      <PageHeader
        title={config.name.replace(/_/g, ' ')}
        description={`Training configuration - ${formatTemplateName(config.template_type)}`}
      />

      <div className="max-w-5xl mx-auto space-y-6">
        {/* Back Button */}
        <div>
          <Button onClick={() => router.push('/training')} variant="outline" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Training Configs
          </Button>
        </div>

        {/* Config Details Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Configuration Details</CardTitle>
              <div className="flex gap-2">
                <ShareButton
                  resourceType="training_config"
                  resourceId={config.id}
                  resourceName={config.name}
                  variant="outline"
                  size="sm"
                />
                <Button onClick={downloadConfig} variant="outline" size="sm">
                  <Download className="mr-2 h-4 w-4" />
                  Download JSON
                </Button>
                <Button
                  onClick={() => router.push(`/training?edit=${config.id}`)}
                  variant="outline"
                  size="sm"
                >
                  <Edit2 className="mr-2 h-4 w-4" />
                  Edit
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Metadata */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Template Type:</span>
                  <p className="font-medium">{formatTemplateName(config.template_type)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Created:</span>
                  <p className="font-medium">
                    {new Date(config.created_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Last Updated:</span>
                  <p className="font-medium">
                    {new Date(config.updated_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
                {config.public_id && (
                  <div>
                    <span className="text-muted-foreground">Public ID:</span>
                    <p className="font-mono text-xs bg-muted px-2 py-1 rounded inline-block">
                      {config.public_id}
                    </p>
                  </div>
                )}
              </div>

              {/* Config JSON Preview */}
              <div className="mt-6">
                <h3 className="text-sm font-semibold mb-2">Configuration JSON</h3>
                <div className="bg-muted rounded-lg p-4 max-h-96 overflow-auto">
                  <pre className="text-xs font-mono">
                    {JSON.stringify(config.config_json, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Comments Section */}
        <Card>
          <CardHeader>
            <CardTitle>Discussion & Comments</CardTitle>
          </CardHeader>
          <CardContent>
            <CommentThread
              resourceType="training_config"
              resourceId={config.id}
              maxDepth={3}
            />
          </CardContent>
        </Card>
      </div>
    </PageWrapper>
  );
}
