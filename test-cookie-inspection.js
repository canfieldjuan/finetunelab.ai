/**
 * Test script to inspect cookies in a Next.js API request
 *
 * This will help us understand:
 * 1. What cookies are present in the request
 * 2. How to access them via request.cookies API
 * 3. What the Supabase cookie names are
 *
 * Usage:
 * 1. Start Next.js dev server
 * 2. Login to the app (to get Supabase auth cookies)
 * 3. Run this from browser console:
 *
 * fetch('/api/training/inspect-cookies', {
 *   method: 'POST',
 *   headers: {
 *     'Authorization': `Bearer ${localStorage.getItem('sb-access-token')}`
 *   }
 * }).then(r => r.json()).then(console.log)
 */

// This file documents what we need to create next:
// app/api/training/inspect-cookies/route.ts
