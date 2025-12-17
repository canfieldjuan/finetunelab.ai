// Scheduled Evaluation Manager Component
// Purpose: Wrapper component to manage scheduled evaluations UI state
// Date: 2025-12-16

'use client';

import { useState } from 'react';
import { ScheduledEvaluationList } from './ScheduledEvaluationList';
import { ScheduledEvaluationForm } from './ScheduledEvaluationForm';
import { ScheduleRunHistory } from './ScheduleRunHistory';
import type { ScheduledEvaluation } from '@/lib/batch-testing/types';

export function ScheduledEvaluationManager() {
  const [formOpen, setFormOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [scheduleToEdit, setScheduleToEdit] = useState<ScheduledEvaluation | null>(null);
  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(null);
  const [selectedScheduleName, setSelectedScheduleName] = useState<string | undefined>(undefined);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleCreateNew = () => {
    setScheduleToEdit(null);
    setFormOpen(true);
  };

  const handleEdit = (schedule: ScheduledEvaluation) => {
    setScheduleToEdit(schedule);
    setFormOpen(true);
  };

  const handleViewHistory = (scheduleId: string, scheduleName?: string) => {
    setSelectedScheduleId(scheduleId);
    setSelectedScheduleName(scheduleName);
    setHistoryOpen(true);
  };

  const handleFormSaved = () => {
    setRefreshKey(prev => prev + 1); // Trigger list refresh
  };

  return (
    <>
      <ScheduledEvaluationList
        key={refreshKey}
        onCreateNew={handleCreateNew}
        onEdit={handleEdit}
        onViewHistory={(id) => {
          // Find schedule name
          handleViewHistory(id);
        }}
      />

      <ScheduledEvaluationForm
        open={formOpen}
        onOpenChange={setFormOpen}
        scheduleToEdit={scheduleToEdit}
        onSaved={handleFormSaved}
      />

      <ScheduleRunHistory
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        scheduleId={selectedScheduleId}
        scheduleName={selectedScheduleName}
      />
    </>
  );
}
