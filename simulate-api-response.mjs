#!/usr/bin/env node

/**
 * Simulate what /api/billing/usage-history would return
 * Using the actual data from usage_meters table
 */

const usageHistory = [
  {
    period_month: 12,
    period_year: 2025,
    root_traces_count: 263,
    compressed_payload_bytes: 524288,
  },
  {
    period_month: 1,
    period_year: 2026,
    root_traces_count: 17,
    compressed_payload_bytes: 0,
  },
];

const commitment = {
  tier: 'starter',
  minimum_monthly_usd: '0',
  included_traces: 100000,
  price_per_thousand_traces: '0.5',
  included_kb_per_trace: 100,
  overage_price_per_gb: '0.1',
};

console.log('🔄 Simulating API transformation logic...\n');

const history = usageHistory.map((record) => {
  const payloadGb = record.compressed_payload_bytes / 1_073_741_824;

  let estimatedCost = commitment ? parseFloat(commitment.minimum_monthly_usd) : 0;

  if (commitment) {
    const tracesOver = Math.max(0, record.root_traces_count - commitment.included_traces);
    const traceCost = (tracesOver / 1000) * parseFloat(commitment.price_per_thousand_traces);

    const includedPayloadGb = (record.root_traces_count * commitment.included_kb_per_trace) / 1_048_576;
    const payloadOver = Math.max(0, payloadGb - includedPayloadGb);
    const payloadCost = payloadOver * parseFloat(commitment.overage_price_per_gb);

    estimatedCost += traceCost + payloadCost;
  }

  const monthName = new Date(record.period_year, record.period_month - 1).toLocaleString('en-US', { month: 'long' });

  return {
    month: monthName,
    year: record.period_year,
    rootTraces: record.root_traces_count,
    payloadGb: parseFloat(payloadGb.toFixed(4)),
    cost: parseFloat(estimatedCost.toFixed(2)),
  };
});

console.log('✅ API would return:');
console.log(JSON.stringify({ history }, null, 2));

console.log('\n📊 Chart would receive this data:');
history.forEach((month, index) => {
  console.log(`\n${index + 1}. ${month.month} ${month.year}`);
  console.log(`   Root Traces: ${month.rootTraces}`);
  console.log(`   Payload: ${month.payloadGb} GB`);
  console.log(`   Cost: $${month.cost}`);
});

console.log('\n✅ This data should render 2 bars in the chart');
console.log('   - December 2025: 263 traces');
console.log('   - January 2026: 17 traces');
