// Validation Test for Task 1.1
// Date: October 20, 2025

import { SystemMonitorService } from '../monitor.service';
import { DatabaseStats } from '../types';

describe('SystemMonitorService - getDatabaseStats Validation', () => {
  let monitor: SystemMonitorService;

  beforeAll(() => {
    monitor = new SystemMonitorService();
  });

  it('should successfully fetch and validate database statistics', async () => {
    console.log('--- Running validation test for getDatabaseStats ---');

    // Accessing private method for this specific validation test
    const stats: DatabaseStats = await (monitor as unknown as { getDatabaseStats: () => Promise<DatabaseStats> }).getDatabaseStats();

    console.log('Received stats:', JSON.stringify(stats, null, 2));

    // 1. Verify the function did not return an error state
    expect(stats.totalSize).not.toBe('Error');
    expect(stats.totalSize).not.toBe('N/A');

    // 2. Verify the total size is a plausible string
    expect(stats.totalSize).toMatch(/\d+.*(Bytes|KB|MB|GB|TB)/);

    // 3. Verify that table statistics are returned
    expect(stats.tableStats.length).toBeGreaterThan(0);

    // 4. Verify the structure of the first table stat
    const firstTable = stats.tableStats[0];
    expect(firstTable.name).toBeDefined();
    expect(typeof firstTable.rowCount).toBe('number');
    expect(firstTable.size).toMatch(/\d+.*(Bytes|KB|MB|GB|TB)/);
    expect(firstTable.indexSize).toMatch(/\d+.*(Bytes|KB|MB|GB|TB)/);

    console.log('--- Validation Test Passed ---');
  });
});
