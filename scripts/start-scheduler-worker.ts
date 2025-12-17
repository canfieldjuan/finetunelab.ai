#!/usr/bin/env tsx
/**
 * Evaluation Scheduler Worker - Startup Script
 * Created: 2025-12-16
 * Purpose: Entry point for standalone background worker
 * Deployment: Render background worker
 */

// Load environment variables from .env.local
import { config } from 'dotenv';
import { resolve } from 'path';

// Try to load .env.local first (development), fallback to .env
const envPath = resolve(process.cwd(), '.env.local');
config({ path: envPath });

import { EvaluationSchedulerWorker } from '../lib/evaluation/scheduler-worker';

// Load environment variables
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const NODE_ENV = process.env.NODE_ENV || 'development';

console.log('='.repeat(60));
console.log('Starting Evaluation Scheduler Worker...');
console.log('='.repeat(60));
console.log('Environment:', NODE_ENV);
console.log('App URL:', APP_URL);
console.log('Supabase URL:', SUPABASE_URL ? 'configured' : 'MISSING');
console.log('Service Key:', SUPABASE_SERVICE_KEY ? 'configured' : 'MISSING');
console.log('='.repeat(60));

// Validate environment
if (!SUPABASE_URL) {
  console.error('ERROR: NEXT_PUBLIC_SUPABASE_URL is not configured');
  process.exit(1);
}

if (!SUPABASE_SERVICE_KEY) {
  console.error('ERROR: SUPABASE_SERVICE_ROLE_KEY is not configured');
  process.exit(1);
}

// Create worker instance
let worker: EvaluationSchedulerWorker;

try {
  worker = new EvaluationSchedulerWorker(
    SUPABASE_URL,
    SUPABASE_SERVICE_KEY,
    APP_URL
  );
} catch (error) {
  console.error('FATAL: Failed to create worker instance:', error);
  process.exit(1);
}

// Graceful shutdown handler
function shutdown(signal: string) {
  console.log('');
  console.log(`Received ${signal}, shutting down gracefully...`);

  if (worker) {
    worker.stop();
  }

  console.log('Shutdown complete');
  process.exit(0);
}

// Register shutdown handlers
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('UNCAUGHT EXCEPTION:', error);
  shutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('UNHANDLED REJECTION at:', promise, 'reason:', reason);
  // Don't exit on unhandled rejection, just log
});

// Start the worker
try {
  worker.start();
  console.log('Worker started successfully');
  console.log('Press Ctrl+C to stop');
  console.log('='.repeat(60));
} catch (error) {
  console.error('FATAL: Failed to start worker:', error);
  process.exit(1);
}

// Keep process alive
setInterval(() => {
  const status = worker.getStatus();
  if (!status.isRunning) {
    console.warn('WARNING: Worker stopped unexpectedly');
  }
}, 60000); // Check every minute
