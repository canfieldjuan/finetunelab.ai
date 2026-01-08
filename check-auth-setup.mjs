#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://tkizlemssfmrfluychsn.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRraXpsZW1zc2ZtcmZsdXljaHNuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjA1NzQyNiwiZXhwIjoyMDcxNjMzNDI2fQ.1jCq40o2wsbHrKuinv3s4Ny9kwJ5mcvcBAggU5oKH74';

async function checkAuth() {
  console.log('🔍 Checking authentication setup...\n');

  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  try {
    // List existing users
    console.log('1️⃣ Listing existing users...');
    const { data: usersData, error: usersError } = await adminClient.auth.admin.listUsers();

    if (usersError) {
      console.error(`❌ Error: ${usersError.message}`);
    } else {
      console.log(`✅ Found ${usersData.users.length} users:\n`);
      usersData.users.forEach((user, idx) => {
        console.log(`   ${idx + 1}. ${user.email || 'No email'}`);
        console.log(`      ID: ${user.id}`);
        console.log(`      Created: ${new Date(user.created_at).toLocaleString()}`);
        console.log(`      Last sign in: ${user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString() : 'Never'}`);
        console.log(`      Confirmed: ${user.email_confirmed_at ? 'Yes' : 'No'}`);
        console.log('');
      });
    }

    // Check traces table to find user with data
    console.log('2️⃣ Finding users with trace data...');
    const { data: traceUsers, error: traceError } = await adminClient
      .from('llm_traces')
      .select('user_id', { count: 'exact' })
      .limit(1000);

    if (traceError) {
      console.error(`❌ Error: ${traceError.message}`);
    } else {
      const userCounts = {};
      traceUsers.forEach(t => {
        userCounts[t.user_id] = (userCounts[t.user_id] || 0) + 1;
      });

      console.log(`✅ Users with traces:\n`);
      Object.entries(userCounts).forEach(([userId, count]) => {
        console.log(`   • ${userId}: ${count} traces`);
      });
      console.log('');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkAuth();
