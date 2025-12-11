/**
 * Template Library Component
 *
 * Browse and manage DAG templates
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TemplateCard } from './TemplateCard';
import { Template, TemplateListResponse } from './types';
import { RefreshCw, Plus } from 'lucide-react';

interface TemplateLibraryProps {
  onLoadTemplate: (template: Template) => void;
  onExecuteTemplate: (template: Template) => void;
  onCreateNew: () => void;
}

export function TemplateLibrary({
  onLoadTemplate,
  onExecuteTemplate,
  onCreateNew
}: TemplateLibraryProps) {
  console.log('[TemplateLibrary] Rendering component');

  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const fetchTemplates = async () => {
    console.log('[TemplateLibrary] Fetching templates');
    setLoading(true);

    try {
      const response = await fetch('/api/training/dag/templates');
      const data: TemplateListResponse = await response.json();

      if (data.success) {
        console.log('[TemplateLibrary] Loaded', data.templates.length, 'templates');
        setTemplates(data.templates);
      }
    } catch (error) {
      console.error('[TemplateLibrary] Error fetching templates:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const categories = ['all', ...Array.from(new Set(
    templates.map(t => t.category).filter(Boolean) as string[]
  ))];

  const filteredTemplates = categoryFilter === 'all'
    ? templates
    : templates.filter(t => t.category === categoryFilter);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-lg font-semibold">Template Library</CardTitle>
          <div className="flex items-center gap-2">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="text-xs border rounded px-2 py-1"
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>
                  {cat === 'all' ? 'All Categories' : cat}
                </option>
              ))}
            </select>
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchTemplates}
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={onCreateNew}
            >
              <Plus className="w-4 h-4 mr-1" />
              New
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="text-center text-gray-500 dark:text-gray-400 py-8">
              Loading templates...
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div className="text-center text-gray-500 dark:text-gray-400 py-8">
              <p>No templates found</p>
              <Button
                variant="outline"
                size="sm"
                onClick={onCreateNew}
                className="mt-4"
              >
                Create your first template
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTemplates.map(template => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  onLoad={onLoadTemplate}
                  onExecute={onExecuteTemplate}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
