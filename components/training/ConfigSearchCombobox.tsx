// Config Search Combobox Component
// Purpose: Searchable dropdown for selecting training configurations
// Date: 2025-10-30

'use client';

import { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Search, Check } from 'lucide-react';
import type { TrainingConfigRecord } from '@/lib/training/training-config.types';
import type { TrainingDatasetRecord } from '@/lib/training/dataset.types';

console.log('[ConfigSearchCombobox] Component loaded');

interface ConfigSearchComboboxProps {
  configs: TrainingConfigRecord[];
  datasets: TrainingDatasetRecord[];
  value: string | null;
  onChange: (configId: string) => void;
  placeholder?: string;
}

export function ConfigSearchCombobox({
  configs,
  datasets,
  value,
  onChange,
  placeholder = "Search or select config...",
}: ConfigSearchComboboxProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  console.log('[ConfigSearchCombobox] Rendered with', configs.length, 'configs');

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Get dataset count for a config
  const getDatasetCount = (configId: string): number => {
    return datasets.filter(d => d.config_id === configId).length;
  };

  // Format template name for display
  const formatTemplateName = (templateKey: string): string => {
    return templateKey
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Format date for display
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Get short ID (first 6 characters of UUID)
  const getShortId = (id: string): string => {
    return id.substring(0, 6);
  };

  // Get selected config
  const selectedConfig = configs.find(c => c.id === value);

  // Filter configs based on search query
  const filteredConfigs = configs.filter(config => {
    if (!searchQuery.trim()) return true;

    const query = searchQuery.toLowerCase();
    const name = config.name.toLowerCase();
    const templateType = config.template_type.toLowerCase();

    return name.includes(query) || templateType.includes(query);
  });

  const handleSelect = (configId: string) => {
    onChange(configId);
    setOpen(false);
    setSearchQuery('');
  };

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 border rounded-md bg-background hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
      >
        <span className={selectedConfig ? 'text-foreground' : 'text-muted-foreground'}>
          {selectedConfig
            ? `${selectedConfig.name.replace(/_/g, ' ')} (${formatTemplateName(selectedConfig.template_type)})`
            : placeholder
          }
        </span>
        <Search className="h-4 w-4 text-muted-foreground flex-shrink-0 ml-2" />
      </button>

      {/* Dropdown Content */}
      {open && (
        <div className="absolute z-50 w-full mt-2 bg-popover border rounded-md shadow-md">
          {/* Search Input */}
          <div className="p-2 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name or template..."
                className="pl-9 h-9"
                autoFocus
              />
            </div>
          </div>

          {/* Config List */}
          <div className="max-h-[400px] overflow-y-auto p-1">
            {filteredConfigs.length === 0 ? (
              <div className="px-3 py-8 text-center text-sm text-muted-foreground">
                {`No configs found matching "${searchQuery}"`}
              </div>
            ) : (
              filteredConfigs.map(config => {
                const datasetCount = getDatasetCount(config.id);
                const isSelected = config.id === value;

                return (
                  <button
                    key={config.id}
                    type="button"
                    onClick={() => handleSelect(config.id)}
                    className={`
                      w-full px-3 py-2 text-left rounded-sm hover:bg-accent transition-colors
                      ${isSelected ? 'bg-accent' : ''}
                    `}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        {/* Line 1: Name + Date */}
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm truncate">
                            {config.name.replace(/_/g, ' ')}
                          </span>
                          <span className="text-xs text-muted-foreground flex-shrink-0">
                            {formatDate(config.created_at)}
                          </span>
                        </div>

                        {/* Line 2: Template + Dataset Count + Config ID */}
                        <div className="text-xs text-muted-foreground mt-0.5">
                          <span>{formatTemplateName(config.template_type)}</span>
                          {datasetCount > 0 && (
                            <span> • {datasetCount} dataset{datasetCount > 1 ? 's' : ''}</span>
                          )}
                          <span className="font-mono"> • ID: {getShortId(config.id)}</span>
                        </div>
                      </div>

                      {/* Checkmark for selected */}
                      {isSelected && (
                        <Check className="h-4 w-4 text-primary flex-shrink-0" />
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

console.log('[ConfigSearchCombobox] Component defined');
