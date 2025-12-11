// Temporary validation script for Task 1.1
// Date: October 20, 2025

import { SystemMonitorService } from './monitor.service.js';
import type { DatabaseStats } from './types.js';

const validate = async () => {
  console.log('--- Validating getDatabaseStats ---');

  const monitor = new SystemMonitorService();

  try {
    // Accessing a private method for validation purposes.
    const stats = await (monitor as unknown as { getDatabaseStats: () => Promise<DatabaseStats> }).getDatabaseStats();

    console.log('Validation successful. Received stats:');
    console.log(JSON.stringify(stats, null, 2));

    if (stats.totalSize === 'Error' || stats.tableStats.length === 0) {
      console.error('Validation failed: Received an error state or empty table stats.');
      return;
    }

    if (stats.totalSize === '0 Bytes') {
       console.warn('Warning: Total database size is 0 Bytes. This might be unexpected.');
    }

    console.log('\n--- Verification Checklist ---');
    console.log(`[${stats.totalSize !== 'N/A' && stats.totalSize !== 'Error' ? 'x' : ' '}] Total DB size is calculated.`);
    console.log(`[${stats.tableStats.length > 0 ? 'x' : ' '}] Table stats are being returned.`);
    if (stats.tableStats.length > 0) {
      const firstTable = stats.tableStats[0];
      console.log(`[${firstTable.size !== 'N/A' && firstTable.size !== 'Error' ? 'x' : ' '}] Individual table size is calculated.`);
      console.log(`[${firstTable.indexSize !== 'N/A' && firstTable.indexSize !== 'Error' ? 'x' : ' '}] Individual index size is calculated.`);
      console.log(`[${typeof firstTable.rowCount === 'number' ? 'x' : ' '}] Row count is a number.`);
    }
    console.log('--------------------------');


  } catch (error) {
    console.error('Validation script failed with an exception:', error);
  }
};

validate();
