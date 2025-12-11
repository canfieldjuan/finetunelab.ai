"use client";

import React, { useEffect, useMemo, useState } from 'react';

type JobRow = { id: string; query: string; status: string; report_title?: string | null; created_at: string; updated_at: string };
type StepRow = { id: string; type: string; status: string; started_at?: string; completed_at?: string };

function StatusBadge({ status }: { status: string }) {
  const color = status === 'completed' ? 'bg-emerald-500/15 text-emerald-500 border-emerald-500/20'
    : status === 'failed' ? 'bg-red-500/15 text-red-500 border-red-500/20'
    : status === 'running' ? 'bg-amber-500/15 text-amber-500 border-amber-500/20'
    : 'bg-muted text-muted-foreground border-muted-foreground/20';
  return <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs border ${color}`}>{status}</span>;
}

export function ResearchJobsPanel({ limit = 20 }: { limit?: number }) {
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [stepsByJob, setStepsByJob] = useState<Record<string, StepRow[]>>({});
  const [reportByJob, setReportByJob] = useState<Record<string, { title?: string; summary?: string; body?: string }>>({});
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [showReportModal, setShowReportModal] = useState<string | null>(null);

  const hasData = useMemo(() => jobs.length > 0, [jobs]);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        params.set('limit', String(limit));
        if (status) params.set('status', status);
        if (query.trim()) params.set('q', query.trim());
        if (startDate) params.set('start', new Date(startDate).toISOString());
        if (endDate) params.set('end', new Date(endDate).toISOString());
        const res = await fetch(`/api/web-search/research/list?${params.toString()}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || 'Failed to load jobs');
        if (mounted) setJobs(json.jobs || []);
      } catch (e) {
        if (mounted) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (mounted) setLoading(false);
      }
    };
    run();
    return () => { mounted = false; };
  }, [limit, status, query, startDate, endDate]);

  const toggleExpand = async (jobId: string) => {
    setExpanded(prev => ({ ...prev, [jobId]: !prev[jobId] }));
    if (!stepsByJob[jobId]) {
      try {
        const res = await fetch(`/api/web-search/research/${jobId}/steps`);
        const json = await res.json();
        if (res.ok) setStepsByJob(prev => ({ ...prev, [jobId]: json.steps || [] }));
      } catch {}
    }
  };

  const loadReport = async (jobId: string) => {
    if (reportByJob[jobId]) return;
    try {
      const res = await fetch(`/api/web-search/research/${jobId}/report`);
      const json = await res.json();
      if (res.ok) setReportByJob(prev => ({ ...prev, [jobId]: json.report || {} }));
    } catch {}
  };

  return (
    <div className="rounded-lg border border-muted-foreground/20 bg-card">
      <div className="px-4 py-3 border-b border-muted-foreground/10">
        <div className="text-sm font-medium text-foreground">Deep Research Jobs</div>
        <div className="text-xs text-muted-foreground">Recent runs with status, steps, and reports</div>
      </div>
      <div className="p-4">
        {/* Filters */}
        <div className="grid md:grid-cols-4 gap-2 mb-3">
          <input
            type="text"
            placeholder="Search query…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full border rounded px-2 py-1 text-sm"
          />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full border rounded px-2 py-1 text-sm"
          >
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="running">Running</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
          </select>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full border rounded px-2 py-1 text-sm"
          />
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full border rounded px-2 py-1 text-sm"
          />
        </div>
        {loading && <div className="text-sm text-muted-foreground">Loading…</div>}
        {error && <div className="text-sm text-red-500">{error}</div>}
        {!loading && !error && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="py-2 pr-4">Query</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Created</th>
                  <th className="py-2 pr-4">Updated</th>
                  <th className="py-2 pr-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(!hasData) && (
                  <tr><td colSpan={5} className="py-4 text-muted-foreground">No research jobs.</td></tr>
                )}
                {jobs.map((j) => (
                  <React.Fragment key={j.id}>
                    <tr className="border-t border-muted-foreground/10">
                      <td className="py-2 pr-4 max-w-[480px]">
                        <div className="truncate" title={j.query}>{j.query}</div>
                        {j.report_title && (
                          <div className="text-xs text-muted-foreground truncate">{j.report_title}</div>
                        )}
                      </td>
                      <td className="py-2 pr-4"><StatusBadge status={j.status} /></td>
                      <td className="py-2 pr-4 text-muted-foreground">{new Date(j.created_at).toLocaleString()}</td>
                      <td className="py-2 pr-4 text-muted-foreground">{new Date(j.updated_at).toLocaleString()}</td>
                      <td className="py-2 pr-4">
                        <div className="flex items-center gap-2">
                          <button className="text-xs underline text-primary" onClick={() => toggleExpand(j.id)}>
                            {expanded[j.id] ? 'Hide steps' : 'Show steps'}
                          </button>
                          <button className="text-xs underline text-primary" onClick={async () => { await loadReport(j.id); setShowReportModal(j.id); }}>
                            View full report
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expanded[j.id] && (
                      <tr className="border-t border-muted-foreground/10">
                        <td colSpan={5} className="py-2 pr-4">
                          <div className="text-xs text-muted-foreground mb-1">Steps</div>
                          <ul className="space-y-1">
                            {(stepsByJob[j.id] || []).map(s => (
                              <li key={s.id} className="text-sm flex items-center gap-2">
                                <StatusBadge status={s.status} />
                                <span className="text-muted-foreground">{s.type}</span>
                                <span className="text-muted-foreground">{s.started_at ? new Date(s.started_at).toLocaleString() : ''}</span>
                              </li>
                            ))}
                            {(stepsByJob[j.id]?.length || 0) === 0 && (
                              <li className="text-sm text-muted-foreground">No steps recorded yet.</li>
                            )}
                          </ul>
                        </td>
                      </tr>
                    )}
                    {reportByJob[j.id]?.body && (
                      <tr className="border-t border-muted-foreground/10">
                        <td colSpan={5} className="py-2 pr-4">
                          <div className="text-xs text-muted-foreground mb-1">Report Preview</div>
                          <div className="prose prose-invert max-w-none whitespace-pre-wrap text-sm bg-muted/40 rounded p-3 border border-muted-foreground/10">
                            <div className="font-medium mb-1">{reportByJob[j.id]?.title || 'Report'}</div>
                            {(reportByJob[j.id]?.summary) && (
                              <div className="text-muted-foreground mb-2">{reportByJob[j.id]?.summary}</div>
                            )}
                            {(reportByJob[j.id]?.body || '').slice(0, 800)}{(reportByJob[j.id]?.body || '').length > 800 ? '…' : ''}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {/* Modal: Full Report */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowReportModal(null)}>
          <div className="bg-card border border-muted-foreground/20 rounded-lg max-w-3xl w-full max-h-[80vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="px-4 py-3 border-b border-muted-foreground/10 flex items-center justify-between">
              <div className="text-sm font-medium text-foreground">Research Report</div>
              <button className="text-sm text-muted-foreground hover:text-foreground" onClick={() => setShowReportModal(null)}>Close</button>
            </div>
            <div className="p-4">
              <div className="prose prose-invert max-w-none whitespace-pre-wrap text-sm">
                <div className="font-medium mb-2">{reportByJob[showReportModal]?.title || 'Report'}</div>
                {reportByJob[showReportModal]?.summary && (
                  <div className="text-muted-foreground mb-4">{reportByJob[showReportModal]?.summary}</div>
                )}
                {reportByJob[showReportModal]?.body || 'No report body available.'}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
