/**
 * Cookie Inspection Endpoint - TEMPORARY FOR RESEARCH
 * POST /api/training/inspect-cookies
 *
 * Purpose: Understand what cookies are available in Next.js API routes
 * This is a research endpoint to verify cookie access before implementing
 * the actual refresh token logic.
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  console.log('[CookieInspect] === Cookie Inspection Start ===');

  // Get all cookies from the request
  const cookies = request.cookies;

  // Log all available cookies
  const allCookies: Record<string, string> = {};

  cookies.getAll().forEach((cookie) => {
    allCookies[cookie.name] = cookie.value;
    console.log(`[CookieInspect] Cookie: ${cookie.name}`);
    console.log(`[CookieInspect] Value preview: ${cookie.value.substring(0, 20)}...`);
  });

  // Look for Supabase-specific cookies
  const supabaseCookies = cookies.getAll().filter(
    (cookie) => cookie.name.includes('sb-') || cookie.name.includes('supabase')
  );

  console.log(`[CookieInspect] Total cookies: ${cookies.getAll().length}`);
  console.log(`[CookieInspect] Supabase cookies: ${supabaseCookies.length}`);

  return NextResponse.json({
    totalCookies: cookies.getAll().length,
    supabaseCookies: supabaseCookies.length,
    cookieNames: cookies.getAll().map(c => c.name),
    supabaseCookieNames: supabaseCookies.map(c => c.name),
    message: 'Check server logs for full cookie details'
  }, { status: 200 });
}
