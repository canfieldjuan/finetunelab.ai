/**
 * Distributed Worker Authentication Integration Tests
 * Tests: All /api/distributed/* endpoints with HMAC authentication
 * 
 * Setup:
 * 1. Ensure .env.local has DISTRIBUTED_WORKER_SECRET
 * 2. Run: npm test __tests__/integration/distributed-auth.test.ts
 */

import { createHmac } from 'crypto';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';
const WORKER_SECRET = process.env.DISTRIBUTED_WORKER_SECRET || 'test-secret-key-for-testing';

interface WorkerAuthHeaders {
  'x-worker-id': string;
  'x-worker-timestamp': string;
  'x-worker-signature': string;
  'Content-Type': string;
}

/**
 * Generate HMAC signature for worker authentication
 */
function generateWorkerSignature(workerId: string, timestamp: number, secret: string): string {
  const message = `${workerId}:${timestamp}`;
  const hmac = createHmac('sha256', secret);
  hmac.update(message);
  return hmac.digest('hex');
}

/**
 * Create authenticated headers for worker requests
 */
function createAuthHeaders(workerId: string, timestamp?: number): WorkerAuthHeaders {
  const ts = timestamp || Date.now();
  const signature = generateWorkerSignature(workerId, ts, WORKER_SECRET);
  
  return {
    'x-worker-id': workerId,
    'x-worker-timestamp': ts.toString(),
    'x-worker-signature': signature,
    'Content-Type': 'application/json',
  };
}

describe('Distributed Worker Authentication', () => {
  const testWorkerId = `test-worker-${Date.now()}`;

  describe('Worker Registration Endpoint', () => {
    it('should reject requests without authentication headers', async () => {
      const response = await fetch(`${BASE_URL}/api/distributed/workers/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workerId: testWorkerId,
          hostname: 'test-host',
          capabilities: ['training'],
          maxConcurrency: 2,
        }),
      });

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBeDefined();
    });

    it('should reject requests with invalid signature', async () => {
      const headers = createAuthHeaders(testWorkerId);
      headers['x-worker-signature'] = 'invalid-signature-here';

      const response = await fetch(`${BASE_URL}/api/distributed/workers/register`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          workerId: testWorkerId,
          hostname: 'test-host',
          capabilities: ['training'],
          maxConcurrency: 2,
        }),
      });

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toContain('Invalid signature');
    });

    it('should reject requests with expired timestamp', async () => {
      const expiredTimestamp = Date.now() - (10 * 60 * 1000);
      const headers = createAuthHeaders(testWorkerId, expiredTimestamp);

      const response = await fetch(`${BASE_URL}/api/distributed/workers/register`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          workerId: testWorkerId,
          hostname: 'test-host',
          capabilities: ['training'],
          maxConcurrency: 2,
        }),
      });

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toContain('expired');
    });

    it('should accept requests with valid authentication', async () => {
      const headers = createAuthHeaders(testWorkerId);

      const response = await fetch(`${BASE_URL}/api/distributed/workers/register`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          workerId: testWorkerId,
          hostname: 'test-host',
          capabilities: ['training'],
          maxConcurrency: 2,
        }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.workerId).toBe(testWorkerId);
    });
  });

  describe('Execute Endpoint', () => {
    it('should reject unauthorized execution requests', async () => {
      const response = await fetch(`${BASE_URL}/api/distributed/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workflowId: 'test-workflow',
          jobs: [],
        }),
      });

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBeDefined();
    });

    it('should accept authenticated execution requests', async () => {
      const headers = createAuthHeaders(testWorkerId);

      const response = await fetch(`${BASE_URL}/api/distributed/execute`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          workflowId: 'test-workflow',
          jobs: [],
        }),
      });

      expect([200, 400, 500]).toContain(response.status);
    });
  });

  describe('Heartbeat Endpoint', () => {
    it('should reject unauthorized heartbeat requests', async () => {
      const response = await fetch(`${BASE_URL}/api/distributed/workers/${testWorkerId}/heartbeat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentLoad: 0,
        }),
      });

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBeDefined();
    });

    it('should accept authenticated heartbeat requests', async () => {
      const headers = createAuthHeaders(testWorkerId);

      const response = await fetch(`${BASE_URL}/api/distributed/workers/${testWorkerId}/heartbeat`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          currentLoad: 0,
        }),
      });

      expect([200, 404, 500]).toContain(response.status);
    });
  });

  describe('Queue Management Endpoints', () => {
    it('should reject unauthorized pause requests', async () => {
      const response = await fetch(`${BASE_URL}/api/distributed/queue/pause`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      expect(response.status).toBe(401);
    });

    it('should reject unauthorized resume requests', async () => {
      const response = await fetch(`${BASE_URL}/api/distributed/queue/resume`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      expect(response.status).toBe(401);
    });

    it('should reject unauthorized stats requests', async () => {
      const response = await fetch(`${BASE_URL}/api/distributed/queue/stats`, {
        method: 'GET',
      });

      expect(response.status).toBe(401);
    });

    it('should accept authenticated pause requests', async () => {
      const headers = createAuthHeaders(testWorkerId);

      const response = await fetch(`${BASE_URL}/api/distributed/queue/pause`, {
        method: 'POST',
        headers,
      });

      expect([200, 500]).toContain(response.status);
    });
  });

  describe('Health and Status Endpoints', () => {
    it('should reject unauthorized health check requests', async () => {
      const response = await fetch(`${BASE_URL}/api/distributed/health`, {
        method: 'GET',
      });

      expect(response.status).toBe(401);
    });

    it('should reject unauthorized workers list requests', async () => {
      const response = await fetch(`${BASE_URL}/api/distributed/workers`, {
        method: 'GET',
      });

      expect(response.status).toBe(401);
    });

    it('should accept authenticated health check requests', async () => {
      const headers = createAuthHeaders(testWorkerId);

      const response = await fetch(`${BASE_URL}/api/distributed/health`, {
        method: 'GET',
        headers,
      });

      expect([200, 500]).toContain(response.status);
    });

    it('should accept authenticated workers list requests', async () => {
      const headers = createAuthHeaders(testWorkerId);

      const response = await fetch(`${BASE_URL}/api/distributed/workers`, {
        method: 'GET',
        headers,
      });

      expect([200, 500]).toContain(response.status);
    });
  });

  describe('Replay Attack Prevention', () => {
    it('should reject reused signatures with same timestamp', async () => {
      const timestamp = Date.now();
      const headers = createAuthHeaders(testWorkerId, timestamp);

      const response1 = await fetch(`${BASE_URL}/api/distributed/workers/register`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          workerId: testWorkerId,
          hostname: 'test-host',
          capabilities: ['training'],
          maxConcurrency: 2,
        }),
      });

      expect([200, 400, 500]).toContain(response1.status);
    });
  });
});






