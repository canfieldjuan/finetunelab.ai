/**
 * Integration Tests: Telemetry Endpoint Authentication
 * 
 * Tests admin API key authentication for telemetry aggregation endpoint:
 * - GET /api/telemetry/web-search/aggregate
 * 
 * Security requirements:
 * - Endpoint requires x-admin-api-key header
 * - Only valid admin key grants access
 * - Invalid/missing key returns 401
 * - System-wide metrics aggregation (not user-scoped)
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || 'test_admin_key';

describe('Telemetry Endpoint Authentication', () => {
  describe('GET /api/telemetry/web-search/aggregate', () => {
    test('should require admin API key header', async () => {
      const response = await fetch(`${API_BASE_URL}/api/telemetry/web-search/aggregate`);
      expect(response.status).toBe(401);
      
      const data = await response.json();
      expect(data.error).toContain('admin API key');
    });
    
    test('should reject invalid admin key', async () => {
      const response = await fetch(`${API_BASE_URL}/api/telemetry/web-search/aggregate`, {
        headers: { 'x-admin-api-key': 'invalid_key_12345' }
      });
      expect(response.status).toBe(401);
      
      const data = await response.json();
      expect(data.error).toContain('invalid or missing');
    });
    
    test('should accept valid admin key', async () => {
      const response = await fetch(`${API_BASE_URL}/api/telemetry/web-search/aggregate`, {
        headers: { 'x-admin-api-key': ADMIN_API_KEY }
      });
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(typeof data.hours).toBe('number');
      expect(Array.isArray(data.rows)).toBe(true);
    });
    
    test('should respect hours parameter with valid auth', async () => {
      const hours = 48;
      const response = await fetch(
        `${API_BASE_URL}/api/telemetry/web-search/aggregate?hours=${hours}`,
        { headers: { 'x-admin-api-key': ADMIN_API_KEY } }
      );
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.hours).toBe(hours);
    });
    
    test('should clamp hours parameter within valid range', async () => {
      // Test maximum (168 hours = 1 week)
      const maxResponse = await fetch(
        `${API_BASE_URL}/api/telemetry/web-search/aggregate?hours=999`,
        { headers: { 'x-admin-api-key': ADMIN_API_KEY } }
      );
      const maxData = await maxResponse.json();
      expect(maxData.hours).toBe(168);
      
      // Test minimum (1 hour)
      const minResponse = await fetch(
        `${API_BASE_URL}/api/telemetry/web-search/aggregate?hours=0`,
        { headers: { 'x-admin-api-key': ADMIN_API_KEY } }
      );
      const minData = await minResponse.json();
      expect(minData.hours).toBe(1);
    });
    
    test('should return system-wide aggregated metrics', async () => {
      const response = await fetch(`${API_BASE_URL}/api/telemetry/web-search/aggregate`, {
        headers: { 'x-admin-api-key': ADMIN_API_KEY }
      });
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      
      // Verify aggregated data structure
      if (data.rows.length > 0) {
        const firstRow = data.rows[0];
        // Telemetry should contain aggregate metrics across all users
        expect(firstRow).toHaveProperty('total_searches');
        expect(typeof firstRow.total_searches).toBe('number');
      }
    });
  });

  describe('Security validation', () => {
    test('should not accept user bearer token instead of admin key', async () => {
      // Even with valid user JWT, admin endpoint should reject
      const userToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.token';
      const response = await fetch(`${API_BASE_URL}/api/telemetry/web-search/aggregate`, {
        headers: { 'Authorization': `Bearer ${userToken}` }
      });
      expect(response.status).toBe(401);
    });
    
    test('should require exact header name (case-sensitive)', async () => {
      // Test wrong header name
      const response = await fetch(`${API_BASE_URL}/api/telemetry/web-search/aggregate`, {
        headers: { 'X-Admin-API-Key': ADMIN_API_KEY } // Wrong case
      });
      expect(response.status).toBe(401);
    });
    
    test('should not leak admin key in error responses', async () => {
      const response = await fetch(`${API_BASE_URL}/api/telemetry/web-search/aggregate`, {
        headers: { 'x-admin-api-key': 'wrong_key' }
      });
      const data = await response.json();
      
      // Error message should not contain actual admin key
      expect(data.error).not.toContain(ADMIN_API_KEY);
    });
  });
});
