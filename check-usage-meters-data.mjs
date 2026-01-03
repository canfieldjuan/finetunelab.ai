#!/usr/bin/env node

/**
 * Check if usage_meters table has data
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://tkizlemssfmrfluychsn.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRraXpsZW1zc2ZtcmZsdXljaHNuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjA1NzQyNiwiZXhwIjoyMDcxNjMzNDI2fQ.1jCq40o2wsbHrKuinv3s4Ny9kwJ5mcvcBAggU5oKH74';
const USER_ID = '38c85707-1fc5-40c6-84be-c017b3b8e750'; // From the JWT token

async function checkUsageMetersData() {
  console.log('🔍 Checking usage_meters table for data...\n');

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Check all records for this user
    const { data: allRecords, error: allError } = await supabase
      .from('usage_meters')
      .select('*')
      .eq('user_id', USER_ID)
      .order('period_year', { ascending: false })
      .order('period_month', { ascending: false });

    if (allError) {
      console.error('❌ Error fetching all records:', allError);
      return;
    }

    console.log(`📊 Total records in usage_meters for user: ${allRecords?.length || 0}\n`);

    if (allRecords && allRecords.length > 0) {
      console.log('Recent records:');
      allRecords.forEach((record, index) => {
        console.log(`\n${index + 1}. Period: ${record.period_year}-${String(record.period_month).padStart(2, '0')}`);
        console.log(`   Root traces: ${record.root_traces_count}`);
        console.log(`   Compressed payload: ${(record.compressed_payload_bytes / 1_073_741_824).toFixed(4)} GB`);
        console.log(`   Created at: ${record.created_at}`);
      });
    } else {
      console.log('⚠️  NO RECORDS FOUND - This is why the chart is empty!');
      console.log('\nPossible causes:');
      console.log('1. Usage tracking not recording to usage_meters table');
      console.log('2. Migration not applied');
      console.log('3. RPC function increment_root_trace_count() not being called');
    }

    // Now check what the API query would return (last 6 months)
    const now = new Date();
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    console.log(`\n📅 Checking records from ${sixMonthsAgo.toISOString()} onwards (API query)...\n`);

    const { data: recentRecords, error: recentError } = await supabase
      .from('usage_meters')
      .select('period_month, period_year, root_traces_count, compressed_payload_bytes')
      .eq('user_id', USER_ID)
      .gte('created_at', sixMonthsAgo.toISOString())
      .order('period_year', { ascending: true })
      .order('period_month', { ascending: true });

    if (recentError) {
      console.error('❌ Error fetching recent records:', recentError);
      return;
    }

    console.log(`Found ${recentRecords?.length || 0} records in last 6 months\n`);

    if (recentRecords && recentRecords.length > 0) {
      console.log('✅ API would return data for chart:');
      recentRecords.forEach(record => {
        const monthName = new Date(record.period_year, record.period_month - 1).toLocaleString('en-US', { month: 'long' });
        console.log(`   ${monthName} ${record.period_year}: ${record.root_traces_count} traces`);
      });
    } else {
      console.log('❌ API would return EMPTY array - chart will be empty');
    }

    // Check usage_commitments table
    console.log('\n💰 Checking usage_commitments table...\n');

    const { data: commitment, error: commitmentError } = await supabase
      .from('usage_commitments')
      .select('*')
      .eq('user_id', USER_ID)
      .eq('status', 'active')
      .single();

    if (commitmentError) {
      if (commitmentError.code === 'PGRST116') {
        console.log('⚠️  No active commitment found');
      } else {
        console.error('❌ Error fetching commitment:', commitmentError);
      }
    } else {
      console.log('✅ Active commitment:', commitment.tier);
      console.log(`   Included traces: ${commitment.included_traces}`);
      console.log(`   Price per 1K traces: $${commitment.price_per_thousand_traces}`);
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
  }
}

checkUsageMetersData();
