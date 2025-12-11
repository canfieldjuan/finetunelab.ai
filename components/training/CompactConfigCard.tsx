// Compact Config Card Component
// Purpose: Small card for displaying training configs in a grid layout
// Date: 2025-10-30

'use client';

import { memo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Database, MoreVertical, Download, Copy, Trash2, ArrowUp, Eye, Edit2 } from 'lucide-react';
import type { TrainingConfigRecord } from '@/lib/training/training-config.types';
import { ShareButton } from '@/components/workspace/ShareButton';

interface CompactConfigCardProps {
  config: TrainingConfigRecord;
  datasetCount: number;
  onDownload: (config: TrainingConfigRecord) => void;
  onClone: (config: TrainingConfigRecord) => void;
  onDelete: (config: TrainingConfigRecord) => void;
  onEdit?: (config: TrainingConfigRecord) => void;
  onLoadIntoWorkflow: (configId: string) => void;
  isCloning?: boolean;
  isDeleting?: boolean;
}

function CompactConfigCardComponent({
  config,
  datasetCount,
  onDownload,
  onClone,
  onDelete,
  onEdit,
  onLoadIntoWorkflow,
  isCloning = false,
  isDeleting = false,
}: CompactConfigCardProps) {
  const router = useRouter();

  // Format template name for display
  const formatTemplateName = (templateKey: string): string => {
    return templateKey
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Header with name and menu */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h3 
                className="font-semibold text-sm truncate cursor-pointer hover:text-primary transition-colors" 
                title={config.name.replace(/_/g, ' ')}
                onClick={() => router.push(`/training/${config.id}`)}
              >
                {config.name.replace(/_/g, ' ')}
              </h3>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 flex-shrink-0">
                  <MoreVertical className="h-4 w-4" />
                  <span className="sr-only">Open menu</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => router.push(`/training/${config.id}`)}>
                  <Eye className="mr-2 h-4 w-4" />
                  View Details
                </DropdownMenuItem>
                {onEdit && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => onEdit(config)}>
                      <Edit2 className="mr-2 h-4 w-4" />
                      Edit
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onLoadIntoWorkflow(config.id)}>
                  <ArrowUp className="mr-2 h-4 w-4" />
                  Load into Workflow
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onDownload(config)}>
                  <Download className="mr-2 h-4 w-4" />
                  Download JSON
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onClone(config)} disabled={isCloning}>
                  <Copy className="mr-2 h-4 w-4" />
                  {isCloning ? 'Cloning...' : 'Clone'}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => onDelete(config)}
                  disabled={isDeleting}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Template type */}
          <p className="text-xs text-muted-foreground truncate" title={formatTemplateName(config.template_type)}>
            {formatTemplateName(config.template_type)}
          </p>

          {/* Footer: Dataset count and date */}
          <div className="flex items-center justify-between pt-2 border-t">
            {datasetCount > 0 ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                <Database className="w-3 h-3" />
                {datasetCount}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">No datasets</span>
            )}
            <span className="text-xs text-muted-foreground">
              {new Date(config.created_at).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric'
              })}
            </span>
          </div>

          {/* Share Button */}
          <div className="pt-2 border-t">
            <ShareButton
              resourceType="training_config"
              resourceId={config.id}
              resourceName={config.name}
              variant="outline"
              size="sm"
              className="w-full"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Memoize to prevent re-renders when parent updates but props haven't changed
export const CompactConfigCard = memo(CompactConfigCardComponent, (prevProps, nextProps) => {
  // Only re-render if these specific DATA props change (not functions)
  // Return true if props are equal (don't re-render), false if different (do re-render)
  return (
    prevProps.config.id === nextProps.config.id &&
    prevProps.config.name === nextProps.config.name &&
    prevProps.config.updated_at === nextProps.config.updated_at &&
    prevProps.datasetCount === nextProps.datasetCount &&
    prevProps.isCloning === nextProps.isCloning &&
    prevProps.isDeleting === nextProps.isDeleting
    // Note: Function props (onDownload, onClone, etc.) are intentionally NOT compared
    // because they get new references on each render but their behavior is the same
  );
});
