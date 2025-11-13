/**
 * Web Search Summaries Export API
 * GET /api/search-summaries/export?format=csv|json|md&conversationId=...&savedOnly=true
 * Returns a downloadable export of the user's saved search summaries
 */

import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabaseClient';
import crypto from 'crypto';

export const runtime = 'nodejs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const signingSecret = process.env.EXPORT_SIGNING_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

async function authenticateUser(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader) return { error: 'Unauthorized - no auth header', user: null };
  const supabase = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { error: 'Unauthorized - invalid token', user: null };
  return { error: null, user };
}

function toCSV(rows: any[]): string {
  const esc = (v: any) => {
    const s = v == null ? '' : String(v);
    const needsQuotes = /[",\n]/.test(s);
    const q = s.replace(/"/g, '""');
    return needsQuotes ? `"${q}"` : q;
  };
  const header = ['query','result_title','result_url','source','published_at','summary'];
  const lines = [header.join(',')];
  for (const r of rows) {
    lines.push([
      esc(r.query),
      esc(r.result_title),
      esc(r.result_url),
      esc(r.source || ''),
      esc(r.published_at || ''),
      esc(r.summary || ''),
    ].join(','));
  }
  return lines.join('\n');
}

function toMarkdown(rows: any[]): string {
  const lines = ['# Web Search Summaries', '', `Generated: ${new Date().toISOString()}`, ''];
  rows.forEach((r, idx) => {
    lines.push(`${idx + 1}. ${r.result_title || 'Result'} (${r.result_url})`);
    if (r.source || r.published_at) {
      lines.push(`   ${r.source ? `Source: ${r.source}` : ''}${r.source && r.published_at ? ' · ' : ''}${r.published_at ? `Published: ${r.published_at}` : ''}`);
    }
    lines.push(`   Query: ${r.query}`);
    if (r.summary) lines.push(`   Summary: ${r.summary}`);
    lines.push('');
  });
  return lines.join('\n');
}

// Signed token verification (HMAC-SHA256)
function base64urlDecode(input: string): string {
  input = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = input.length % 4;
  if (pad) input += '='.repeat(4 - pad);
  return Buffer.from(input, 'base64').toString('utf-8');
}

function verifySignedToken(token: string): { uid?: string; cid?: string; savedOnly?: boolean; format?: string } | null {
  try {
    const [payloadB64, sigHex] = token.split('.');
    if (!payloadB64 || !sigHex) return null;
    const payloadJson = base64urlDecode(payloadB64);
    const payload = JSON.parse(payloadJson) as { uid?: string; cid?: string; savedOnly?: boolean; format?: string; exp: number };
    if (!payload || !payload.exp || Date.now() > payload.exp) return null;
    if (!signingSecret) return null;
    const hmac = crypto.createHmac('sha256', signingSecret).update(payloadB64).digest('hex');
    if (hmac !== sigHex) return null;
    return { uid: payload.uid, cid: payload.cid, savedOnly: payload.savedOnly, format: payload.format };
  } catch (e) {
    return null;
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const formatParam = (searchParams.get('format') || 'csv').toLowerCase();
    const conversationIdParam = searchParams.get('conversationId');
    const savedOnlyParam = searchParams.get('savedOnly');
    const sig = searchParams.get('sig');

    let effectiveUserId: string | null = null;
    let format = formatParam;
    let conversationId = conversationIdParam || undefined;
    let savedOnly = savedOnlyParam !== 'false';

    // Signed link flow (no Authorization header required)
    if (sig && supabaseAdmin) {
      const verified = verifySignedToken(sig);
      if (!verified) {
        return new Response(JSON.stringify({ error: 'Invalid or expired token' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
      }
      effectiveUserId = verified.uid || null;
      if (verified.format) format = verified.format;
      if (verified.cid) conversationId = verified.cid;
      if (typeof verified.savedOnly === 'boolean') savedOnly = verified.savedOnly;
    } else {
      // Auth header flow
      const { error, user } = await authenticateUser(req);
      if (error || !user) {
        return new Response(JSON.stringify({ error }), { status: 401, headers: { 'Content-Type': 'application/json' } });
      }
      effectiveUserId = user.id;
    }

    // Choose client: use supabaseAdmin when signed token is used; else use user-scoped client (RLS)
    const userClient = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: req.headers.get('authorization') || '' } } });
    const client = sig && supabaseAdmin ? supabaseAdmin : userClient;

    let query = client
      .from('search_summaries')
      .select('query, result_title, result_url, source, published_at, summary')
      .eq('user_id', effectiveUserId!)
      .order('created_at', { ascending: false })
      .limit(1000);
    if (conversationId) query = query.eq('conversation_id', conversationId);
    if (savedOnly) query = query.eq('is_saved', true);

    const { data, error: dbError } = await query;
    if (dbError) {
      return new Response(JSON.stringify({ error: dbError.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
    const rows = data || [];

    const dateStr = new Date().toISOString().split('T')[0];
    const baseName = `search_summaries_${dateStr}`;

    if (format === 'json') {
      const body = JSON.stringify({ generatedAt: new Date().toISOString(), count: rows.length, summaries: rows }, null, 2);
      return new Response(body, {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="${baseName}.json"`
        }
      });
    }
    if (format === 'md' || format === 'markdown') {
      const md = toMarkdown(rows);
      return new Response(md, {
        headers: {
          'Content-Type': 'text/markdown; charset=utf-8',
          'Content-Disposition': `attachment; filename="${baseName}.md"`
        }
      });
    }
    // default CSV
    const csv = toCSV(rows);
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${baseName}.csv"`
      }
    });
  } catch (e) {
    console.error('[SearchSummaries Export API] Error:', e);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
