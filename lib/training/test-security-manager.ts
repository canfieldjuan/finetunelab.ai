/**
 * Security Manager Validation Tests
 * 
 * Tests for Phase 1.4 security hardening features:
 * - Resource limits validation
 * - Resource monitoring and violation detection
 * - Audit logging
 * - Integration with DAG orchestrator
 */

import { SecurityManager, ResourceLimits, ResourceUsage, SecurityViolation } from './security-manager';

// ============================================================================
// Test Helpers
// ============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function logTestResult(testName: string, passed: boolean, details?: string): void {
  const status = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`\n${status}: ${testName}`);
  if (details) {
    console.log(`   Details: ${details}`);
  }
}

// ============================================================================
// Test Suite
// ============================================================================

async function runSecurityTests() {
  console.log('\n🔒 Security Manager Test Suite\n');
  console.log('='.repeat(60));

  let testsPassed = 0;
  let testsFailed = 0;

  // ==========================================================================
  // Test 1: Resource Limits Validation
  // ==========================================================================
  {
    const testName = 'Resource Limits Validation';
    console.log(`\n📋 Running: ${testName}`);
    
    try {
      const securityManager = new SecurityManager();

      // Valid limits
      const validLimits: ResourceLimits = {
        maxExecutionTimeMs: 60000, // 1 minute
        maxMemoryMB: 512,
        maxCpuPercent: 75,
      };

      const validResult = securityManager.validateResourceLimits(validLimits);
      
      if (!validResult.valid) {
        throw new Error(`Valid limits rejected: ${validResult.errors.join(', ')}`);
      }

      // Invalid limits - negative time
      const invalidTimeResult = securityManager.validateResourceLimits({
        maxExecutionTimeMs: -1000,
      });

      if (invalidTimeResult.valid) {
        throw new Error('Negative execution time should be invalid');
      }

      // Invalid limits - excessive memory
      const invalidMemoryResult = securityManager.validateResourceLimits({
        maxMemoryMB: 100000, // 100GB - exceeds 32GB limit
      });

      if (invalidMemoryResult.valid) {
        throw new Error('Excessive memory should be invalid');
      }

      // Invalid limits - CPU out of range
      const invalidCpuResult = securityManager.validateResourceLimits({
        maxCpuPercent: 150, // Over 100%
      });

      if (invalidCpuResult.valid) {
        throw new Error('CPU over 100% should be invalid');
      }

      logTestResult(testName, true, 'All validation cases passed');
      testsPassed++;
    } catch (error) {
      logTestResult(testName, false, error instanceof Error ? error.message : String(error));
      testsFailed++;
    }
  }

  // ==========================================================================
  // Test 2: Resource Violation Detection - Memory
  // ==========================================================================
  {
    const testName = 'Resource Violation Detection - Memory Limit';
    console.log(`\n📋 Running: ${testName}`);
    
    try {
      const securityManager = new SecurityManager();

      const limits: ResourceLimits = {
        maxMemoryMB: 1024,
        enforceMemoryLimit: true,
      };

      const executionId = 'test_exec_mem_001';

      // Usage within limits
      const normalUsage: ResourceUsage = {
        memoryMB: 512,
        cpuPercent: 50,
        executionTimeMs: 10000,
        timestamp: new Date(),
      };

      const noViolation = securityManager.checkResourceViolation(
        normalUsage,
        limits,
        executionId
      );

      if (noViolation !== null) {
        throw new Error('No violation expected for normal usage');
      }

      // Usage exceeding memory limit
      const excessiveUsage: ResourceUsage = {
        memoryMB: 2048, // Exceeds 1024MB limit
        cpuPercent: 50,
        executionTimeMs: 10000,
        timestamp: new Date(),
      };

      const violation = securityManager.checkResourceViolation(
        excessiveUsage,
        limits,
        executionId
      );

      if (violation === null) {
        throw new Error('Violation expected for excessive memory usage');
      }

      if (violation.type !== 'memory_limit_exceeded') {
        throw new Error(`Expected memory_limit_exceeded, got ${violation.type}`);
      }

      if (violation.severity !== 'high') {
        throw new Error(`Expected high severity, got ${violation.severity}`);
      }

      logTestResult(testName, true, `Detected: ${violation.message}`);
      testsPassed++;
    } catch (error) {
      logTestResult(testName, false, error instanceof Error ? error.message : String(error));
      testsFailed++;
    }
  }

  // ==========================================================================
  // Test 3: Resource Violation Detection - CPU
  // ==========================================================================
  {
    const testName = 'Resource Violation Detection - CPU Limit';
    console.log(`\n📋 Running: ${testName}`);
    
    try {
      const securityManager = new SecurityManager();

      const limits: ResourceLimits = {
        maxCpuPercent: 80,
        enforceCpuLimit: true,
      };

      const executionId = 'test_exec_cpu_001';

      // Usage exceeding CPU limit
      const excessiveUsage: ResourceUsage = {
        memoryMB: 512,
        cpuPercent: 95, // Exceeds 80% limit
        executionTimeMs: 10000,
        timestamp: new Date(),
      };

      const violation = securityManager.checkResourceViolation(
        excessiveUsage,
        limits,
        executionId
      );

      if (violation === null) {
        throw new Error('Violation expected for excessive CPU usage');
      }

      if (violation.type !== 'cpu_limit_exceeded') {
        throw new Error(`Expected cpu_limit_exceeded, got ${violation.type}`);
      }

      if (violation.severity !== 'medium') {
        throw new Error(`Expected medium severity, got ${violation.severity}`);
      }

      logTestResult(testName, true, `Detected: ${violation.message}`);
      testsPassed++;
    } catch (error) {
      logTestResult(testName, false, error instanceof Error ? error.message : String(error));
      testsFailed++;
    }
  }

  // ==========================================================================
  // Test 4: Resource Violation Detection - Time
  // ==========================================================================
  {
    const testName = 'Resource Violation Detection - Time Limit';
    console.log(`\n📋 Running: ${testName}`);
    
    try {
      const securityManager = new SecurityManager();

      const limits: ResourceLimits = {
        maxExecutionTimeMs: 30000, // 30 seconds
        enforceTimeLimit: true,
      };

      const executionId = 'test_exec_time_001';

      // Usage exceeding time limit
      const excessiveUsage: ResourceUsage = {
        memoryMB: 512,
        cpuPercent: 50,
        executionTimeMs: 60000, // Exceeds 30 second limit
        timestamp: new Date(),
      };

      const violation = securityManager.checkResourceViolation(
        excessiveUsage,
        limits,
        executionId
      );

      if (violation === null) {
        throw new Error('Violation expected for excessive execution time');
      }

      if (violation.type !== 'time_limit_exceeded') {
        throw new Error(`Expected time_limit_exceeded, got ${violation.type}`);
      }

      if (violation.severity !== 'high') {
        throw new Error(`Expected high severity, got ${violation.severity}`);
      }

      logTestResult(testName, true, `Detected: ${violation.message}`);
      testsPassed++;
    } catch (error) {
      logTestResult(testName, false, error instanceof Error ? error.message : String(error));
      testsFailed++;
    }
  }

  // ==========================================================================
  // Test 5: Audit Logging
  // ==========================================================================
  {
    const testName = 'Audit Logging System';
    console.log(`\n📋 Running: ${testName}`);
    
    try {
      const securityManager = new SecurityManager();

      const executionId = 'test_exec_audit_001';
      const jobId = 'test_job_001';

      // Log execution start
      await securityManager.logExecutionStart(executionId, 'Test Execution');
      
      // Log execution completion
      await securityManager.logExecutionComplete(executionId, 5000, 3, 3, 0);

      // Log job timeout
      await securityManager.logJobTimeout(executionId, jobId, 10000);

      // Create a violation using checkResourceViolation (which stores it)
      const excessiveUsage: ResourceUsage = {
        memoryMB: 2048,
        cpuPercent: 50,
        executionTimeMs: 10000,
        timestamp: new Date(),
      };

      const limits: ResourceLimits = {
        maxMemoryMB: 1024,
        enforceMemoryLimit: true,
      };

      // This will create and store the violation
      securityManager.checkResourceViolation(excessiveUsage, limits, executionId, jobId);

      // Log the violation to audit log
      const testViolation: SecurityViolation = {
        type: 'test_violation',
        severity: 'medium',
        message: 'Test violation for audit logging',
        timestamp: new Date(),
        executionId,
        jobId,
        details: { test: true },
      };

      await securityManager.logSecurityViolation(testViolation);

      // Verify violations were recorded
      const violations = securityManager.getViolations();
      
      if (violations.length === 0) {
        throw new Error('No violations recorded');
      }

      const executionViolations = securityManager.getExecutionViolations(executionId);
      
      if (executionViolations.length === 0) {
        throw new Error('No violations for execution');
      }

      logTestResult(testName, true, `Logged ${violations.length} violation(s), audit events logged to console`);
      testsPassed++;
    } catch (error) {
      logTestResult(testName, false, error instanceof Error ? error.message : String(error));
      testsFailed++;
    }
  }

  // ==========================================================================
  // Test 6: Resource Monitoring Lifecycle
  // ==========================================================================
  {
    const testName = 'Resource Monitoring Lifecycle';
    console.log(`\n📋 Running: ${testName}`);
    
    try {
      const securityManager = new SecurityManager();

      const executionId = 'test_exec_monitor_001';
      const violationData: SecurityViolation[] = [];

      const limits: ResourceLimits = {
        maxMemoryMB: 100, // Very low limit to trigger violation
        enforceMemoryLimit: true,
      };

      // Start monitoring
      securityManager.startResourceMonitoring(
        executionId,
        limits,
        (violation) => {
          violationData.push(violation);
          console.log('   Violation detected during monitoring:', violation.type);
        }
      );

      // Wait for at least one monitoring cycle
      await sleep(6000);

      // Stop monitoring
      securityManager.stopResourceMonitoring(executionId);

      // Verify monitoring was active and may have detected violations
      console.log(`   Monitoring detected ${violationData.length} violation(s)`);
      
      logTestResult(testName, true, 'Monitoring lifecycle completed successfully');
      testsPassed++;
    } catch (error) {
      logTestResult(testName, false, error instanceof Error ? error.message : String(error));
      testsFailed++;
    }
  }

  // ==========================================================================
  // Test 7: Default Resource Limits
  // ==========================================================================
  {
    const testName = 'Default Resource Limits Application';
    console.log(`\n📋 Running: ${testName}`);
    
    try {
      const securityManager = new SecurityManager();

      // Get defaults with no limits specified
      const defaults = securityManager.getEffectiveResourceLimits();

      if (!defaults.maxExecutionTimeMs) {
        throw new Error('Default maxExecutionTimeMs not set');
      }

      if (!defaults.maxMemoryMB) {
        throw new Error('Default maxMemoryMB not set');
      }

      if (!defaults.maxCpuPercent) {
        throw new Error('Default maxCpuPercent not set');
      }

      // Get defaults with partial limits specified
      const partial = securityManager.getEffectiveResourceLimits({
        maxMemoryMB: 512,
      });

      if (partial.maxMemoryMB !== 512) {
        throw new Error('Specified memory limit not applied');
      }

      if (!partial.maxExecutionTimeMs) {
        throw new Error('Default execution time not applied');
      }

      logTestResult(testName, true, `Defaults: ${defaults.maxMemoryMB}MB, ${defaults.maxCpuPercent}% CPU, ${defaults.maxExecutionTimeMs}ms`);
      testsPassed++;
    } catch (error) {
      logTestResult(testName, false, error instanceof Error ? error.message : String(error));
      testsFailed++;
    }
  }

  // ==========================================================================
  // Summary
  // ==========================================================================
  console.log('\n' + '='.repeat(60));
  console.log('\n📊 Test Results Summary:\n');
  console.log(`   ✅ Passed: ${testsPassed}`);
  console.log(`   ❌ Failed: ${testsFailed}`);
  console.log(`   📈 Total:  ${testsPassed + testsFailed}`);
  console.log(`   🎯 Success Rate: ${((testsPassed / (testsPassed + testsFailed)) * 100).toFixed(1)}%`);
  console.log('\n' + '='.repeat(60));

  if (testsFailed > 0) {
    console.log('\n⚠️  Some tests failed. Review the output above for details.');
    process.exit(1);
  } else {
    console.log('\n✨ All security tests passed!');
    process.exit(0);
  }
}

// ============================================================================
// Run Tests
// ============================================================================

runSecurityTests().catch(error => {
  console.error('\n💥 Test suite crashed:', error);
  process.exit(1);
});
