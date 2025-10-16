'use client';
// Training Configs Page - Phase 2 MVP
// Date: 2025-10-16

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { Plus, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { TrainingConfigRecord } from '@/lib/training/training-config.types';
import { ALL_TEMPLATES } from '@/lib/training/training-templates';

export default function TrainingPage() {
  const { user, session } = useAuth();
  const router = useRouter();

  const [configs, setConfigs] = useState<TrainingConfigRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState('');

  useEffect(() => {
    if (user && session?.access_token) {
      fetchConfigs();
    }
  }, [user, session]);

  async function fetchConfigs() {
    console.log('[TrainingPage] Fetching configs');
    setLoading(true);

    try {
      const response = await fetch('/api/training', {
        headers: session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {},
      });

      if (!response.ok) throw new Error('Failed to fetch configs');

      const data = await response.json();
      console.log('[TrainingPage] Loaded', data.configs.length, 'configs');
      setConfigs(data.configs || []);
    } catch (err) {
      console.error('[TrainingPage] Fetch error:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateFromTemplate() {
    if (!selectedTemplate) return;

    console.log('[TrainingPage] Creating from template:', selectedTemplate);
    setCreating(true);

    try {
      const template = ALL_TEMPLATES[selectedTemplate];
      const response = await fetch('/api/training', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          name: `${selectedTemplate} - ${new Date().toISOString().split('T')[0]}`,
          template_type: selectedTemplate,
          config_json: template
        })
      });

      if (!response.ok) throw new Error('Failed to create config');

      const data = await response.json();
      console.log('[TrainingPage] Created:', data.config.id);
      fetchConfigs();
      setSelectedTemplate('');
    } catch (err) {
      console.error('[TrainingPage] Create error:', err);
    } finally {
      setCreating(false);
    }
  }

  function downloadConfig(config: TrainingConfigRecord) {
    console.log('[TrainingPage] Downloading:', config.name);
    const blob = new Blob([JSON.stringify(config.config_json, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${config.name.replace(/\s+/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Please log in to access training configs.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Training Configs</h1>
          <p className="text-muted-foreground mt-2">
            Build and manage training configurations for Tiny Tool Use
          </p>
        </div>

        <div className="mb-6 flex gap-4">
          <select
            value={selectedTemplate}
            onChange={(e) => setSelectedTemplate(e.target.value)}
            className="px-3 py-2 border rounded-md"
          >
            <option value="">Select template...</option>
            {Object.keys(ALL_TEMPLATES).map(key => (
              <option key={key} value={key}>{key}</option>
            ))}
          </select>
          <Button onClick={handleCreateFromTemplate} disabled={!selectedTemplate || creating}>
            <Plus className="w-4 h-4 mr-2" />
            Create from Template
          </Button>
        </div>

        {loading ? (
          <p>Loading configs...</p>
        ) : configs.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed rounded-lg">
            <p className="text-muted-foreground">No configs yet. Create one from a template!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {configs.map(config => (
              <div key={config.id} className="p-4 border rounded-lg">
                <h3 className="font-semibold">{config.name}</h3>
                <p className="text-sm text-muted-foreground mt-1">{config.template_type}</p>
                <p className="text-xs text-muted-foreground mt-2">
                  Created: {new Date(config.created_at).toLocaleDateString()}
                </p>
                <Button
                  onClick={() => downloadConfig(config)}
                  variant="outline"
                  size="sm"
                  className="mt-3 w-full"
                >
                  <Download className="w-3 h-3 mr-2" />
                  Download JSON
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
