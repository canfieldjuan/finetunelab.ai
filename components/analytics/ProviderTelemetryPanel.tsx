"use client";

import React, { useEffect, useState } from 'react';

type Row = {
  provider: string;
  hour: string;
  total: number;
  success_rate: number;
  p50: number;
  p95: number;
};

export function ProviderTelemetryPanel({ hours = 24 }: { hours?: number }) {
  const [data, setData] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/telemetry/web-search/aggregate?hours=${hours}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || 'Failed to load telemetry');
        if (mounted) setData(json.rows || []);
      } catch (e) {
        if (mounted) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (mounted) setLoading(false);
      }
    };
    run();
    return () => { mounted = false; };
  }, [hours]);

  return (
    <div className="rounded-lg border border-muted-foreground/20 bg-card">
      <div className="px-4 py-3 border-b border-muted-foreground/10">
        <div className="text-sm font-medium text-foreground">Web Search Provider Telemetry (last {hours}h)</div>
        <div className="text-xs text-muted-foreground">Latency percentiles and success rates per hour</div>
      </div>
      <div className="p-4">
        {loading && <div className="text-sm text-muted-foreground">Loading…</div>}
        {error && <div className="text-sm text-red-500">{error}</div>}
        {!loading && !error && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="py-2 pr-4">Hour</th>
                  <th className="py-2 pr-4">Provider</th>
                  <th className="py-2 pr-4">Count</th>
                  <th className="py-2 pr-4">Success</th>
                  <th className="py-2 pr-4">p50 (ms)</th>
                  <th className="py-2 pr-4">p95 (ms)</th>
                </tr>
              </thead>
              <tbody>
                {data.length === 0 && (
                  <tr><td colSpan={6} className="py-4 text-muted-foreground">No telemetry available for this window.</td></tr>
                )}
                {data.map((r, idx) => (
                  <tr key={idx} className="border-t border-muted-foreground/10">
                    <td className="py-2 pr-4 text-muted-foreground">{new Date(r.hour).toLocaleString()}</td>
                    <td className="py-2 pr-4 font-medium">{r.provider}</td>
                    <td className="py-2 pr-4">{r.total}</td>
                    <td className="py-2 pr-4">{(r.success_rate * 100).toFixed(0)}%</td>
                    <td className="py-2 pr-4">{r.p50}</td>
                    <td className="py-2 pr-4">{r.p95}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

