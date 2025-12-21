"use client";

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  GitBranch,
  Plus,
  CheckCircle,
  Copy,
  Clock
} from 'lucide-react';

interface PromptVersion {
  id: string;
  name: string;
  template: string;
  version: number;
  version_hash: string;
  parent_version_id: string | null;
  is_published: boolean;
  is_archived: boolean;
  change_summary: string;
  tags: string[];
  success_rate: number | null;
  avg_rating: number | null;
  created_at: string;
  updated_at: string;
}

export function PromptVersionManager({ promptName }: { promptName: string }) {
  const [versions, setVersions] = useState<PromptVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<PromptVersion | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchVersions();
  }, [promptName]);

  async function fetchVersions() {
    setLoading(true);
    try {
      const res = await fetch(`/api/prompts/versions?name=${encodeURIComponent(promptName)}`);
      const data = await res.json();
      if (data.success) {
        setVersions(data.versions);
        const published = data.versions.find((v: PromptVersion) => v.is_published);
        setSelectedVersion(published || data.versions[0] || null);
      }
    } catch (error) {
      console.error('Failed to fetch versions:', error);
    } finally {
      setLoading(false);
    }
  }

  async function publishVersion(id: string) {
    try {
      const res = await fetch('/api/prompts/versions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, is_published: true }),
      });
      if (res.ok) {
        fetchVersions();
      }
    } catch (error) {
      console.error('Failed to publish version:', error);
    }
  }

  async function createNewVersion(fromVersionId: string) {
    const version = versions.find(v => v.id === fromVersionId);
    if (!version) return;

    try {
      const res = await fetch('/api/prompts/versions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: promptName,
          template: version.template,
          use_case: 'Copied from version ' + version.version,
          copy_from_version_id: fromVersionId,
          change_summary: 'Duplicated from v' + version.version,
        }),
      });
      if (res.ok) {
        fetchVersions();
      }
    } catch (error) {
      console.error('Failed to create version:', error);
    }
  }

  if (loading) {
    return <div className="p-4">Loading versions...</div>;
  }

  return (
    <div className="grid grid-cols-12 gap-6">
      <div className="col-span-4 space-y-2">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            Versions
          </h3>
          <Button size="sm" variant="default">
            <Plus className="h-4 w-4 mr-1" />
            New
          </Button>
        </div>

        {versions.map((version) => (
          <Card
            key={version.id}
            className={`cursor-pointer transition-colors ${
              selectedVersion?.id === version.id
                ? 'border-primary bg-primary/5'
                : 'hover:bg-muted/50'
            }`}
            onClick={() => setSelectedVersion(version)}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">v{version.version}</span>
                  {version.is_published && (
                    <Badge variant="default" className="text-xs">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Published
                    </Badge>
                  )}
                </div>
              </div>

              <p className="text-sm text-muted-foreground line-clamp-2">
                {version.change_summary}
              </p>

              <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                {new Date(version.created_at).toLocaleDateString()}
              </div>

              {version.tags.length > 0 && (
                <div className="flex gap-1 mt-2 flex-wrap">
                  {version.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="col-span-8">
        {selectedVersion ? (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Version {selectedVersion.version}</CardTitle>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => createNewVersion(selectedVersion.id)}
                  >
                    <Copy className="h-4 w-4 mr-1" />
                    Duplicate
                  </Button>
                  {!selectedVersion.is_published && (
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => publishVersion(selectedVersion.id)}
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Publish
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">Change Summary</label>
                <p className="text-sm text-muted-foreground mt-1">
                  {selectedVersion.change_summary}
                </p>
              </div>

              <div>
                <label className="text-sm font-medium">Prompt Template</label>
                <pre className="mt-2 p-4 bg-muted rounded-lg text-sm overflow-auto max-h-96">
                  {selectedVersion.template}
                </pre>
              </div>

              {(selectedVersion.success_rate !== null || selectedVersion.avg_rating !== null) && (
                <div className="grid grid-cols-2 gap-4">
                  {selectedVersion.success_rate !== null && (
                    <div>
                      <label className="text-sm font-medium">Success Rate</label>
                      <p className="text-2xl font-bold mt-1">
                        {(selectedVersion.success_rate * 100).toFixed(1)}%
                      </p>
                    </div>
                  )}
                  {selectedVersion.avg_rating !== null && (
                    <div>
                      <label className="text-sm font-medium">Avg Rating</label>
                      <p className="text-2xl font-bold mt-1">
                        {selectedVersion.avg_rating.toFixed(1)} / 5
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="text-sm font-medium">Version Hash</label>
                <code className="block mt-1 p-2 bg-muted rounded text-xs">
                  {selectedVersion.version_hash}
                </code>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-12 text-center text-muted-foreground">
              <p>Select a version to view details</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
