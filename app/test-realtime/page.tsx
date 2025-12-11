'use client';

/**
 * Test page to verify Supabase Realtime is working
 * Visit: http://localhost:3000/test-realtime
 */

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export default function TestRealtimePage() {
  const [status, setStatus] = useState<string>('Initializing...');
  const [updates, setUpdates] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    setStatus('Creating channel...');

    const channel = supabase
      .channel(`test-${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all events
          schema: 'public',
          table: 'local_training_jobs',
        },
        (payload) => {
          console.log('📡 Realtime update received:', payload);
          setUpdates((prev) => [...prev, {
            time: new Date().toLocaleTimeString(),
            event: payload.eventType,
            data: payload.new || payload.old
          }]);
        }
      )
      .subscribe((status, err) => {
        console.log('Subscription status:', status, err);
        setStatus(status);

        if (status === 'SUBSCRIBED') {
          setStatus('✅ SUBSCRIBED - Realtime is working!');
          setError(null);
        } else if (status === 'CHANNEL_ERROR') {
          setStatus('❌ CHANNEL_ERROR');
          setError(err?.message || 'Unknown error');
        } else if (status === 'TIMED_OUT') {
          setStatus('❌ TIMED_OUT');
          setError('Realtime connection timed out. Check database publication settings.');
        } else if (status === 'CLOSED') {
          setStatus('CLOSED');
        }
      });

    return () => {
      console.log('Cleaning up subscription');
      channel.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div style={{ padding: '40px', fontFamily: 'monospace' }}>
      <h1>Supabase Realtime Test</h1>
      <p style={{ fontSize: '14px', color: '#666' }}>
        Testing realtime connection to <code>local_training_jobs</code> table
      </p>

      <div style={{ marginTop: '30px' }}>
        <h2>Connection Status</h2>
        <div style={{
          padding: '20px',
          background: status.includes('✅') ? '#d4edda' : status.includes('❌') ? '#f8d7da' : '#d1ecf1',
          border: '1px solid',
          borderColor: status.includes('✅') ? '#c3e6cb' : status.includes('❌') ? '#f5c6cb' : '#bee5eb',
          borderRadius: '4px'
        }}>
          <strong>Status:</strong> {status}
          {error && (
            <div style={{ marginTop: '10px', color: '#721c24' }}>
              <strong>Error:</strong> {error}
            </div>
          )}
        </div>
      </div>

      <div style={{ marginTop: '30px' }}>
        <h2>Realtime Updates ({updates.length})</h2>
        {updates.length === 0 ? (
          <p style={{ color: '#666' }}>No updates yet. Try updating a training job in another tab.</p>
        ) : (
          <div style={{ maxHeight: '400px', overflow: 'auto' }}>
            {updates.map((update, i) => (
              <div
                key={i}
                style={{
                  padding: '10px',
                  marginBottom: '10px',
                  background: '#f8f9fa',
                  border: '1px solid #dee2e6',
                  borderRadius: '4px'
                }}
              >
                <div><strong>Time:</strong> {update.time}</div>
                <div><strong>Event:</strong> {update.event}</div>
                <div><strong>Data:</strong> <pre>{JSON.stringify(update.data, null, 2)}</pre></div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ marginTop: '30px', padding: '20px', background: '#f8f9fa', borderRadius: '4px' }}>
        <h3>Troubleshooting</h3>
        <ul style={{ lineHeight: '1.8' }}>
          <li>✅ Status should show "SUBSCRIBED" if realtime is working</li>
          <li>❌ "TIMED_OUT" means tables aren't in supabase_realtime publication</li>
          <li>❌ "CHANNEL_ERROR" means RLS policy or permissions issue</li>
          <li>📊 Updates will appear when training jobs are modified</li>
        </ul>
      </div>
    </div>
  );
}
