/**
 * Health Check Test
 * Quick test to verify server and test framework working
 * Date: 2025-10-17
 */

import { describe, test, expect } from '@jest/globals';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

describe('Server Health Check', () => {
  console.log('[HealthCheck] Testing server availability');

  test('should have server running on port 3000', async () => {
    console.log('[HealthCheck] Checking server at:', API_BASE_URL);

    try {
      const response = await fetch(API_BASE_URL);
      console.log('[HealthCheck] Server response status:', response.status);

      expect(response.status).toBeLessThan(500);
      console.log('[HealthCheck] ✓ Server is responding');
    } catch (error) {
      console.error('[HealthCheck] Server not reachable:', error);
      throw error;
    }
  }, 10000);

  test('should have training page accessible', async () => {
    console.log('[HealthCheck] Checking training page');

    const response = await fetch(`${API_BASE_URL}/training`);
    console.log('[HealthCheck] Training page status:', response.status);

    expect(response.status).toBe(200);

    const html = await response.text();
    expect(html).toContain('Training');

    console.log('[HealthCheck] ✓ Training page is accessible');
  }, 10000);
});

console.log('[HealthCheck] Health check test suite loaded');
