#!/usr/bin/env npx tsx
/**
 * Verify Context Provider Imports
 * Date: 2025-10-24
 * Tests that all context provider functions can be imported
 */

async function verifyImports() {
  console.log('[Verify] Testing context provider imports...\n');

  try {
    // Test context detector imports
    console.log('[Import] Testing context-detector imports...');
    const detector = await import('../lib/context/context-detector');

    if (typeof detector.detectNeededContext !== 'function') {
      throw new Error('detectNeededContext is not a function');
    }

    if (typeof detector.estimateContextTokens !== 'function') {
      throw new Error('estimateContextTokens is not a function');
    }

    console.log('  ✓ context-detector exports are valid\n');

    // Test context provider service imports
    console.log('[Import] Testing context-provider.service imports...');
    const provider = await import('../lib/context/context-provider.service');

    if (typeof provider.getUserProfileContext !== 'function') {
      throw new Error('getUserProfileContext is not a function');
    }

    if (typeof provider.getFeatureFlagsContext !== 'function') {
      throw new Error('getFeatureFlagsContext is not a function');
    }

    if (typeof provider.getRecentActivityContext !== 'function') {
      throw new Error('getRecentActivityContext is not a function');
    }

    if (typeof provider.gatherConversationContext !== 'function') {
      throw new Error('gatherConversationContext is not a function');
    }

    console.log('  ✓ context-provider.service exports are valid\n');

    // Test types imports
    console.log('[Import] Testing types imports...');
    const types = await import('../lib/context/types');

    console.log('  ✓ types exports are valid\n');

    console.log('='.repeat(60));
    console.log('[Verify] ✓ All Imports Successful!');
    console.log('[Verify] Context provider modules are properly exported');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n[Verify] ✗ Import Verification Failed!');
    console.error('[Verify] Error:', error);
    process.exit(1);
  }
}

verifyImports();
