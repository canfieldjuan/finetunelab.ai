/**
 * Cohort Criteria Builder Component
 *
 * Visual editor for building cohort membership criteria.
 * Supports multiple criterion types and logical operators.
 *
 * Phase 3.2: Cohort Analysis UI
 * Date: 2025-10-25
 */

"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Plus, X } from 'lucide-react';
import type { CohortCriteria } from '@/lib/services/cohort.service';

interface CohortCriteriaBuilderProps {
  criteria: CohortCriteria;
  onChange: (criteria: CohortCriteria) => void;
}

type CriterionType =
  | 'signup_date'
  | 'subscription_plan'
  | 'total_conversations'
  | 'activity_level'
  | 'last_active';

interface Criterion {
  id: string;
  type: CriterionType;
  config: Record<string, unknown>;
}

export default function CohortCriteriaBuilder({
  criteria,
  onChange
}: CohortCriteriaBuilderProps) {
  console.log('[CohortCriteriaBuilder] Rendering with criteria:', criteria);

  const [criterionList, setCriterionList] = useState<Criterion[]>([]);

  const criterionTypes: { value: CriterionType; label: string }[] = [
    { value: 'signup_date', label: 'Signup Date' },
    { value: 'subscription_plan', label: 'Subscription Plan' },
    { value: 'total_conversations', label: 'Total Conversations' },
    { value: 'activity_level', label: 'Activity Level' },
    { value: 'last_active', label: 'Last Active' }
  ];

  const addCriterion = () => {
    console.log('[CohortCriteriaBuilder] Adding new criterion');

    const newCriterion: Criterion = {
      id: Date.now().toString(),
      type: 'total_conversations',
      config: { gt: 0 }
    };

    setCriterionList([...criterionList, newCriterion]);
  };

  const removeCriterion = (id: string) => {
    console.log('[CohortCriteriaBuilder] Removing criterion:', id);
    const updated = criterionList.filter(c => c.id !== id);
    setCriterionList(updated);
    buildCriteria(updated);
  };

  const updateCriterion = (id: string, updates: Partial<Criterion>) => {
    console.log('[CohortCriteriaBuilder] Updating criterion:', id, updates);
    const updated = criterionList.map(c =>
      c.id === id ? { ...c, ...updates } : c
    );
    setCriterionList(updated);
    buildCriteria(updated);
  };

  const buildCriteria = (list: Criterion[]) => {
    console.log('[CohortCriteriaBuilder] Building criteria from list');

    const newCriteria: CohortCriteria = {};

    for (const criterion of list) {
      switch (criterion.type) {
        case 'signup_date':
          newCriteria.signup_date = criterion.config as CohortCriteria['signup_date'];
          break;
        case 'subscription_plan':
          newCriteria.subscription_plan = criterion.config as CohortCriteria['subscription_plan'];
          break;
        case 'total_conversations':
          newCriteria.total_conversations = criterion.config as CohortCriteria['total_conversations'];
          break;
        case 'activity_level':
          newCriteria.activity_level = (criterion.config as { level: string }).level as CohortCriteria['activity_level'];
          break;
        case 'last_active':
          newCriteria.last_active = criterion.config as CohortCriteria['last_active'];
          break;
      }
    }

    console.log('[CohortCriteriaBuilder] Built criteria:', newCriteria);
    onChange(newCriteria);
  };

  const renderCriterionConfig = (criterion: Criterion) => {
    switch (criterion.type) {
      case 'total_conversations':
        return (
          <div className="flex gap-2">
            <select
              className="border rounded px-2 py-1 text-sm"
              value={Object.keys(criterion.config)[0] || 'gt'}
              onChange={(e) => {
                const op = e.target.value;
                const value = criterion.config[Object.keys(criterion.config)[0]] || 0;
                updateCriterion(criterion.id, { config: { [op]: value } });
              }}
            >
              <option value="gt">Greater than</option>
              <option value="lt">Less than</option>
              <option value="eq">Equal to</option>
            </select>
            <input
              type="number"
              className="border rounded px-2 py-1 text-sm w-32"
              value={(criterion.config[Object.keys(criterion.config)[0]] as number) || 0}
              onChange={(e) => {
                const op = Object.keys(criterion.config)[0] || 'gt';
                updateCriterion(criterion.id, { config: { [op]: parseInt(e.target.value) } });
              }}
            />
          </div>
        );

      case 'activity_level':
        return (
          <select
            className="border rounded px-2 py-1 text-sm"
            value={((criterion.config as { level?: string })?.level) || 'medium'}
            onChange={(e) => {
              updateCriterion(criterion.id, { config: { level: e.target.value } });
            }}
          >
            <option value="low">Low (0-10 conversations)</option>
            <option value="medium">Medium (10-50 conversations)</option>
            <option value="high">High (&quot;50-200 conversations&quot;)</option>
            <option value="very_high">Very High (200+ conversations)</option>
          </select>
        );

      case 'last_active':
        return (
          <div className="flex gap-2 items-center">
            <span className="text-sm text-gray-600">Last active within</span>
            <input
              type="number"
              className="border rounded px-2 py-1 text-sm w-24"
              value={(criterion.config as { days_ago?: number })?.days_ago || 30}
              onChange={(e) => {
                updateCriterion(criterion.id, {
                  config: { days_ago: parseInt(e.target.value) }
                });
              }}
            />
            <span className="text-sm text-gray-600">days</span>
          </div>
        );

      case 'subscription_plan':
        return (
          <div className="flex gap-2">
            <input
              type="text"
              className="border rounded px-2 py-1 text-sm flex-1"
              placeholder="Enter plans (comma-separated)"
              value={((criterion.config as { in?: string[] })?.in || []).join(', ')}
              onChange={(e) => {
                const plans = e.target.value.split(',').map(p => p.trim()).filter(Boolean);
                updateCriterion(criterion.id, { config: { in: plans } });
              }}
            />
          </div>
        );

      case 'signup_date':
        return (
          <div className="flex gap-2 items-center">
            <span className="text-sm text-gray-600">Signed up after</span>
            <input
              type="date"
              className="border rounded px-2 py-1 text-sm"
              value={(criterion.config as { after?: string })?.after || ''}
              onChange={(e) => {
                updateCriterion(criterion.id, {
                  config: { ...criterion.config, after: e.target.value }
                });
              }}
            />
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Criteria Builder</CardTitle>
          <Button onClick={addCriterion} size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Add Criterion
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {criterionList.length === 0 ? (
          <div className="text-center py-8 text-gray-600">
            <p className="mb-4">No criteria defined. Click &quot;Add Criterion&quot; to get started.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {criterionList.map((criterion) => (
              <div
                key={criterion.id}
                className="border rounded-lg p-4 bg-gray-50"
              >
                <div className="flex items-start gap-4">
                  <div className="flex-1 space-y-3">
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-1 block">
                        Criterion Type
                      </label>
                      <select
                        className="border rounded px-3 py-2 text-sm w-full"
                        value={criterion.type}
                        onChange={(e) => {
                          const newType = e.target.value as CriterionType;
                          let newConfig = {};

                          switch (newType) {
                            case 'total_conversations':
                              newConfig = { gt: 0 };
                              break;
                            case 'activity_level':
                              newConfig = 'medium';
                              break;
                            case 'last_active':
                              newConfig = { days_ago: 30 };
                              break;
                            case 'subscription_plan':
                              newConfig = { in: [] };
                              break;
                            case 'signup_date':
                              newConfig = { after: '' };
                              break;
                          }

                          updateCriterion(criterion.id, {
                            type: newType,
                            config: newConfig
                          });
                        }}
                      >
                        {criterionTypes.map(({ value, label }) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-1 block">
                        Configuration
                      </label>
                      {renderCriterionConfig(criterion)}
                    </div>
                  </div>

                  <Button
                    onClick={() => removeCriterion(criterion.id)}
                    variant="outline"
                    size="sm"
                    className="mt-6"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
