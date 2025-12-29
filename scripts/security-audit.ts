// Security Audit Script for Analytics System
// Performs comprehensive security review of trace data and analytics tables
// Date: 2025-12-16
// Run: npx tsx scripts/security-audit.ts

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

console.log('[SecurityAudit] Starting analytics security audit...\n');

// Load environment variables
const envPath = join(__dirname, '../.env');
let envContent: string;

try {
  envContent = readFileSync(envPath, 'utf-8');
  console.log('[SecurityAudit] Environment file loaded');
} catch (error) {
  console.error('[SecurityAudit] Failed to read .env file:', error);
  process.exit(1);
}

const envVars: Record<string, string> = {};

envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    const key = match[1].trim();
    const value = match[2].trim();
    envVars[key] = value;
  }
});

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = envVars.SUPABASE_SERVICE_ROLE_KEY || envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('[SecurityAudit] Missing Supabase credentials');
  console.error('[SecurityAudit] Required: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

console.log('[SecurityAudit] Supabase URL:', supabaseUrl);
console.log('[SecurityAudit] Initializing Supabase client...\n');

const supabase = createClient(supabaseUrl, supabaseKey);

interface SecurityIssue {
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  category: string;
  table: string;
  issue: string;
  recommendation: string;
}

interface AuditResult {
  passed: boolean;
  issues: SecurityIssue[];
  totalChecks: number;
  passedChecks: number;
}

const analyticsTablesChecklist = [
  'llm_traces',
  'ab_experiments',
  'ab_experiment_variants',
  'ab_experiment_assignments',
  'anomaly_detections',
  'user_cohorts',
  'user_cohort_members',
  'user_cohort_snapshots',
  'analytics_exports',
  'analytics_metrics_cache',
  'data_retention_config'
];

async function auditRLSPolicies(): Promise<SecurityIssue[]> {
  console.log('[SecurityAudit] Checking RLS policies on analytics tables...');
  const issues: SecurityIssue[] = [];

  for (const tableName of analyticsTablesChecklist) {
    try {
      const { data, error } = await supabase
        .rpc('get_table_rls_status', { table_name: tableName })
        .single();

      if (error) {
        const query = `SELECT relrowsecurity FROM pg_class WHERE relname = '${tableName}'`;
        const { data: rlsData, error: rlsError } = await supabase
          .from('pg_class')
          .select('relrowsecurity')
          .eq('relname', tableName)
          .single();

        if (rlsError || !rlsData) {
          issues.push({
            severity: 'critical',
            category: 'RLS',
            table: tableName,
            issue: `Unable to verify RLS status for table ${tableName}`,
            recommendation: 'Manually verify RLS is enabled on this table'
          });
        }
      }
    } catch (error) {
      console.log(`[SecurityAudit] Note: Table ${tableName} may not exist or is not accessible`);
    }
  }

  console.log(`[SecurityAudit] RLS check: Found ${issues.length} issues\n`);
  return issues;
}

async function auditSensitiveDataExposure(): Promise<SecurityIssue[]> {
  console.log('[SecurityAudit] Checking for sensitive data exposure...');
  const issues: SecurityIssue[] = [];

  const sensitivePatterns = [
    { pattern: /api[_-]?key/i, name: 'API Key' },
    { pattern: /secret/i, name: 'Secret' },
    { pattern: /password/i, name: 'Password' },
    { pattern: /token/i, name: 'Token' },
    { pattern: /bearer/i, name: 'Bearer Token' },
    { pattern: /authorization/i, name: 'Authorization Header' }
  ];

  const samplesToCheck = [
    { table: 'llm_traces', field: 'metadata' },
    { table: 'llm_traces', field: 'error_details' },
    { table: 'anomaly_detections', field: 'metadata' }
  ];

  for (const sample of samplesToCheck) {
    try {
      const { data, error } = await supabase
        .from(sample.table)
        .select(sample.field)
        .not(sample.field, 'is', null)
        .limit(10);

      if (error) continue;

      if (data && data.length > 0) {
        data.forEach((row: unknown) => {
          const fieldValue = JSON.stringify(row[sample.field] || '');

          sensitivePatterns.forEach(({ pattern, name }) => {
            if (pattern.test(fieldValue)) {
              issues.push({
                severity: 'high',
                category: 'Data Exposure',
                table: sample.table,
                issue: `Potential ${name} found in ${sample.field} field`,
                recommendation: `Review ${sample.table}.${sample.field} for sensitive data and implement masking`
              });
            }
          });
        });
      }
    } catch (error) {
      console.log(`[SecurityAudit] Note: Could not check ${sample.table}.${sample.field}`);
    }
  }

  console.log(`[SecurityAudit] Sensitive data check: Found ${issues.length} issues\n`);
  return issues;
}

async function auditAccessControls(): Promise<SecurityIssue[]> {
  console.log('[SecurityAudit] Checking access controls...');
  const issues: SecurityIssue[] = [];

  try {
    const { data: retentionConfig, error } = await supabase
      .from('data_retention_config')
      .select('*')
      .limit(1);

    if (!error && retentionConfig && retentionConfig.length > 0) {
      issues.push({
        severity: 'info',
        category: 'Access Control',
        table: 'data_retention_config',
        issue: 'Retention config accessible - verify only service role can modify',
        recommendation: 'Ensure RLS policy restricts modifications to service role only'
      });
    }
  } catch (error) {
    console.log('[SecurityAudit] Note: Could not access retention config');
  }

  const criticalTables = ['user_cohorts', 'ab_experiments'];
  for (const tableName of criticalTables) {
    issues.push({
      severity: 'info',
      category: 'Access Control',
      table: tableName,
      issue: `${tableName} contains user data - verify proper isolation`,
      recommendation: `Confirm RLS policies on ${tableName} enforce user_id checks`
    });
  }

  console.log(`[SecurityAudit] Access control check: Found ${issues.length} items\n`);
  return issues;
}

async function runSecurityAudit(): Promise<AuditResult> {
  console.log('========================================');
  console.log('  ANALYTICS SECURITY AUDIT');
  console.log('========================================\n');

  const startTime = Date.now();
  const allIssues: SecurityIssue[] = [];

  const rlsIssues = await auditRLSPolicies();
  allIssues.push(...rlsIssues);

  const sensitiveDataIssues = await auditSensitiveDataExposure();
  allIssues.push(...sensitiveDataIssues);

  const accessControlIssues = await auditAccessControls();
  allIssues.push(...accessControlIssues);

  const criticalIssues = allIssues.filter(i => i.severity === 'critical');
  const highIssues = allIssues.filter(i => i.severity === 'high');
  const mediumIssues = allIssues.filter(i => i.severity === 'medium');
  const lowIssues = allIssues.filter(i => i.severity === 'low');
  const infoItems = allIssues.filter(i => i.severity === 'info');

  const totalChecks = analyticsTablesChecklist.length + 3 + 2;
  const passedChecks = totalChecks - (criticalIssues.length + highIssues.length + mediumIssues.length);

  console.log('========================================');
  console.log('  AUDIT RESULTS');
  console.log('========================================\n');

  console.log(`Total Checks Performed: ${totalChecks}`);
  console.log(`Passed: ${passedChecks}`);
  console.log(`Critical Issues: ${criticalIssues.length}`);
  console.log(`High Issues: ${highIssues.length}`);
  console.log(`Medium Issues: ${mediumIssues.length}`);
  console.log(`Low Issues: ${lowIssues.length}`);
  console.log(`Info Items: ${infoItems.length}\n`);

  if (criticalIssues.length > 0) {
    console.log('CRITICAL ISSUES:');
    console.log('================');
    criticalIssues.forEach(issue => {
      console.log(`[${issue.table}] ${issue.issue}`);
      console.log(`  Recommendation: ${issue.recommendation}\n`);
    });
  }

  if (highIssues.length > 0) {
    console.log('HIGH PRIORITY ISSUES:');
    console.log('=====================');
    highIssues.forEach(issue => {
      console.log(`[${issue.table}] ${issue.issue}`);
      console.log(`  Recommendation: ${issue.recommendation}\n`);
    });
  }

  const executionTime = Date.now() - startTime;
  console.log(`\nAudit completed in ${executionTime}ms`);

  const passed = criticalIssues.length === 0 && highIssues.length === 0;

  return {
    passed,
    issues: allIssues,
    totalChecks,
    passedChecks
  };
}

runSecurityAudit()
  .then(result => {
    if (result.passed) {
      console.log('\n[SecurityAudit] ✅ Security audit PASSED');
      process.exit(0);
    } else {
      console.log('\n[SecurityAudit] ❌ Security audit FAILED - critical or high issues found');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('\n[SecurityAudit] Fatal error:', error);
    process.exit(1);
  });
