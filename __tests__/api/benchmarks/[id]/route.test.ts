/**
 * Benchmark Update/Delete API Route Tests
 * Tests: /api/benchmarks/[id] endpoint (PATCH, DELETE)
 * Coverage: Authentication, ownership validation, update/delete operations
 */

import { NextRequest } from 'next/server';
import { PATCH, DELETE } from '@/app/api/benchmarks/[id]/route';

// Mock Supabase
const mockUpdate = jest.fn();
const mockSingle = jest.fn();
const mockEq = jest.fn();

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    auth: {
      getUser: jest.fn(),
    },
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: mockSingle,
        })),
      })),
      update: jest.fn(() => ({
        eq: jest.fn(() => mockUpdate()),
      })),
      delete: jest.fn(() => ({
        eq: mockEq,
      })),
    })),
  })),
}));

describe('/api/benchmarks/[id]', () => {
  const mockUser = { id: 'user_123' };
  const mockBenchmark = {
    id: 'bench_123',
    name: 'Test Benchmark',
    description: 'Test description',
    task_type: 'qa',
    pass_criteria: {
      min_score: 80,
      required_validators: ['must_cite_if_claims'],
      custom_rules: {},
    },
    created_by: 'user_123',
    is_public: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default auth mock (authenticated user)
    createClient.mockReturnValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: mockUser },
          error: null,
        }),
      },
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: mockSingle,
          })),
        })),
        update: jest.fn(() => ({
          eq: jest.fn(() => mockUpdate()),
        })),
        delete: jest.fn(() => ({
          eq: mockEq,
        })),
      })),
    });
  });

  describe('PATCH - Update Benchmark', () => {
    it('should reject unauthenticated requests', async () => {
      createClient.mockReturnValueOnce({
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: null },
            error: new Error('Unauthorized'),
          }),
        },
      });

      const request = new NextRequest('http://localhost:3000/api/benchmarks/bench_123', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Updated Name' }),
      });

      const response = await PATCH(request, { params: Promise.resolve({ id: 'bench_123' }) });
      expect(response.status).toBe(401);
    });

    it('should return 404 if benchmark not found', async () => {
      mockSingle.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116' },
      });

      const request = new NextRequest('http://localhost:3000/api/benchmarks/bench_999', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid_token',
        },
        body: JSON.stringify({ name: 'Updated Name' }),
      });

      const response = await PATCH(request, { params: Promise.resolve({ id: 'bench_999' }) });
      expect(response.status).toBe(404);
      
      const data = await response.json();
      expect(data.error).toBe('Benchmark not found');
    });

    it('should return 403 if user does not own benchmark', async () => {
      mockSingle.mockResolvedValueOnce({
        data: { ...mockBenchmark, created_by: 'other_user' },
        error: null,
      });

      const request = new NextRequest('http://localhost:3000/api/benchmarks/bench_123', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid_token',
        },
        body: JSON.stringify({ name: 'Updated Name' }),
      });

      const response = await PATCH(request, { params: Promise.resolve({ id: 'bench_123' }) });
      expect(response.status).toBe(403);
      
      const data = await response.json();
      expect(data.error).toBe('You do not have permission to update this benchmark');
    });

    it('should successfully update benchmark name', async () => {
      mockSingle.mockResolvedValueOnce({
        data: mockBenchmark,
        error: null,
      });

      const updatedBenchmark = { ...mockBenchmark, name: 'Updated Benchmark' };
      mockUpdate.mockResolvedValueOnce({
        data: updatedBenchmark,
        error: null,
      });

      const request = new NextRequest('http://localhost:3000/api/benchmarks/bench_123', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid_token',
        },
        body: JSON.stringify({ name: 'Updated Benchmark' }),
      });

      const response = await PATCH(request, { params: Promise.resolve({ id: 'bench_123' }) });
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.benchmark.name).toBe('Updated Benchmark');
    });

    it('should successfully update pass_criteria', async () => {
      mockSingle.mockResolvedValueOnce({
        data: mockBenchmark,
        error: null,
      });

      const updatedCriteria = {
        min_score: 90,
        required_validators: ['must_cite_if_claims', 'format_ok'],
        custom_rules: { max_length: 500 },
      };

      const updatedBenchmark = {
        ...mockBenchmark,
        pass_criteria: updatedCriteria,
      };

      mockUpdate.mockResolvedValueOnce({
        data: updatedBenchmark,
        error: null,
      });

      const request = new NextRequest('http://localhost:3000/api/benchmarks/bench_123', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid_token',
        },
        body: JSON.stringify({ pass_criteria: updatedCriteria }),
      });

      const response = await PATCH(request, { params: Promise.resolve({ id: 'bench_123' }) });
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.benchmark.pass_criteria.min_score).toBe(90);
      expect(data.benchmark.pass_criteria.required_validators).toHaveLength(2);
    });

    it('should successfully update is_public flag', async () => {
      mockSingle.mockResolvedValueOnce({
        data: mockBenchmark,
        error: null,
      });

      const updatedBenchmark = { ...mockBenchmark, is_public: true };
      mockUpdate.mockResolvedValueOnce({
        data: updatedBenchmark,
        error: null,
      });

      const request = new NextRequest('http://localhost:3000/api/benchmarks/bench_123', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid_token',
        },
        body: JSON.stringify({ is_public: true }),
      });

      const response = await PATCH(request, { params: Promise.resolve({ id: 'bench_123' }) });
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.benchmark.is_public).toBe(true);
    });
  });

  describe('DELETE - Delete Benchmark', () => {
    it('should reject unauthenticated requests', async () => {
      createClient.mockReturnValueOnce({
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: null },
            error: new Error('Unauthorized'),
          }),
        },
      });

      const request = new NextRequest('http://localhost:3000/api/benchmarks/bench_123', {
        method: 'DELETE',
        headers: { 'Authorization': 'Bearer invalid_token' },
      });

      const response = await DELETE(request, { params: Promise.resolve({ id: 'bench_123' }) });
      expect(response.status).toBe(401);
    });

    it('should return 404 if benchmark not found', async () => {
      mockSingle.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116' },
      });

      const request = new NextRequest('http://localhost:3000/api/benchmarks/bench_999', {
        method: 'DELETE',
        headers: { 'Authorization': 'Bearer valid_token' },
      });

      const response = await DELETE(request, { params: Promise.resolve({ id: 'bench_999' }) });
      expect(response.status).toBe(404);
    });

    it('should return 403 if user does not own benchmark', async () => {
      mockSingle.mockResolvedValueOnce({
        data: { ...mockBenchmark, created_by: 'other_user' },
        error: null,
      });

      const request = new NextRequest('http://localhost:3000/api/benchmarks/bench_123', {
        method: 'DELETE',
        headers: { 'Authorization': 'Bearer valid_token' },
      });

      const response = await DELETE(request, { params: Promise.resolve({ id: 'bench_123' }) });
      expect(response.status).toBe(403);
      
      const data = await response.json();
      expect(data.error).toBe('You do not have permission to delete this benchmark');
    });

    it('should successfully delete benchmark', async () => {
      mockSingle.mockResolvedValueOnce({
        data: mockBenchmark,
        error: null,
      });

      mockEq.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      const request = new NextRequest('http://localhost:3000/api/benchmarks/bench_123', {
        method: 'DELETE',
        headers: { 'Authorization': 'Bearer valid_token' },
      });

      const response = await DELETE(request, { params: Promise.resolve({ id: 'bench_123' }) });
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.message).toContain('deleted');
    });

    it('should handle database errors during deletion', async () => {
      mockSingle.mockResolvedValueOnce({
        data: mockBenchmark,
        error: null,
      });

      mockEq.mockResolvedValueOnce({
        data: null,
        error: new Error('Database connection failed'),
      });

      const request = new NextRequest('http://localhost:3000/api/benchmarks/bench_123', {
        method: 'DELETE',
        headers: { 'Authorization': 'Bearer valid_token' },
      });

      const response = await DELETE(request, { params: Promise.resolve({ id: 'bench_123' }) });
      expect(response.status).toBe(500);
    });
  });
});
