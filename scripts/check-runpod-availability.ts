#!/usr/bin/env npx tsx

/**
 * Check RunPod GPU availability
 */

import { RunPodService } from '../lib/training/runpod-service';

const runpodApiKey = process.env.RUNPOD_API_KEY;

if (!runpodApiKey) {
  console.error('❌ RUNPOD_API_KEY not found in environment');
  process.exit(1);
}

async function checkAvailability() {
  console.log('🔍 Checking RunPod GPU availability...\n');

  try {
    const service = new RunPodService(runpodApiKey);

    // Query available GPUs
    const query = `
      query GetGPUTypes {
        gpuTypes {
          id
          displayName
          memoryInGb
          secureCloud
          communityCloud
          lowestPrice {
            minimumBidPrice
            uninterruptablePrice
          }
          communityPrice
          securePrice
        }
      }
    `;

    const response = await fetch('https://api.runpod.io/graphql?api_key=' + runpodApiKey, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    });

    const result = await response.json();

    if (result.errors) {
      console.error('❌ GraphQL errors:', result.errors);
      process.exit(1);
    }

    const gpuTypes = result.data.gpuTypes;

    console.log('Available GPUs:\n');
    console.log('┌─────────────────────────┬──────────┬────────────┬──────────────┐');
    console.log('│ GPU Type                │ VRAM     │ Secure $/hr│ Community $/hr│');
    console.log('├─────────────────────────┼──────────┼────────────┼──────────────┤');

    gpuTypes.forEach((gpu: any) => {
      const name = gpu.displayName.padEnd(23);
      const vram = `${gpu.memoryInGb}GB`.padEnd(8);
      const securePrice = gpu.securePrice ? `$${gpu.securePrice}`.padEnd(10) : 'N/A'.padEnd(10);
      const communityPrice = gpu.communityPrice ? `$${gpu.communityPrice}`.padEnd(12) : 'N/A'.padEnd(12);

      console.log(`│ ${name} │ ${vram} │ ${securePrice} │ ${communityPrice} │`);
    });

    console.log('└─────────────────────────┴──────────┴────────────┴──────────────┘');

    console.log('\n💡 Tip: If secure cloud GPUs are unavailable, try:');
    console.log('   1. Different GPU type (e.g., RTX 4090 instead of A100)');
    console.log('   2. Community cloud (cheaper but may be slower)');
    console.log('   3. Lambda Labs (simpler and often cheaper)');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkAvailability();
