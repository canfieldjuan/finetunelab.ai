/**
 * Template Card Component
 *
 * Displays a DAG template with preview and actions
 */

'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Template } from './types';
import { FileText, Play } from 'lucide-react';

interface TemplateCardProps {
  template: Template;
  onLoad: (template: Template) => void;
  onExecute: (template: Template) => void;
}

export function TemplateCard({ template, onLoad, onExecute }: TemplateCardProps) {
  console.log('[TemplateCard] Rendering template:', template.name);

  const jobCount = template.config.jobs.length;

  const handleLoad = () => {
    console.log('[TemplateCard] Load template clicked:', template.id);
    onLoad(template);
  };

  const handleExecute = () => {
    console.log('[TemplateCard] Execute template clicked:', template.id);
    onExecute(template);
  };

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <FileText className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              {template.name}
            </CardTitle>
            {template.category && (
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {template.category}
              </div>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {template.description && (
          <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
            {template.description}
          </p>
        )}

        <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
          <div>
            <span className="font-medium">{jobCount}</span> jobs
          </div>
          <div>
            Created {new Date(template.created_at).toLocaleDateString()}
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleLoad}
            className="flex-1"
          >
            <FileText className="w-3 h-3 mr-1" />
            Load
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={handleExecute}
            className="flex-1"
          >
            <Play className="w-3 h-3 mr-1" />
            Execute
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
