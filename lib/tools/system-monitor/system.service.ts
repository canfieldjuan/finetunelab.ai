// System Monitor Tool - System Information Service
// Date: October 21, 2025

import si from 'systeminformation';
import type {
  SystemInfo,
  CpuInfo,
  MemoryInfo,
  DiskInfo,
  FileSystemInfo,
} from './types';

/**
 * Service for gathering OS-level system information
 */
export class SystemInformationService {
  private logger = console;

  /**
   * Get comprehensive system information including CPU, Memory, and Disk
   */
  async getSystemInfo(): Promise<SystemInfo> {
    this.logger.debug('[SystemInfo] Fetching system information...');

    try {
      const [cpuInfo, memoryInfo, diskInfo] = await Promise.all([
        this.getCpuInfo(),
        this.getMemoryInfo(),
        this.getDiskInfo(),
      ]);

      this.logger.debug('[SystemInfo] System information fetch complete.');

      return {
        cpu: cpuInfo,
        memory: memoryInfo,
        disk: diskInfo,
        timestamp: new Date().toISOString(),
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error('[SystemInfo] Error fetching system info:', errorMessage);
      throw error;
    }
  }

  /**
   * Get CPU information
   */
  private async getCpuInfo(): Promise<CpuInfo> {
    this.logger.debug('[SystemInfo] Fetching CPU information...');

    try {
      const [cpuData, currentLoad, cpuTemp] = await Promise.all([
        si.cpu(),
        si.currentLoad(),
        si.cpuTemperature().catch(() => ({ main: -1 })),
      ]);

      const cpuInfo: CpuInfo = {
        manufacturer: cpuData.manufacturer || 'Unknown',
        brand: cpuData.brand || 'Unknown',
        cores: cpuData.cores || 0,
        physicalCores: cpuData.physicalCores || 0,
        speed: cpuData.speed || 0,
        currentLoad: Math.round(currentLoad.currentLoad || 0),
        temperature: cpuTemp.main > 0 ? cpuTemp.main : undefined,
      };

      this.logger.debug(
        `[SystemInfo] CPU: ${cpuInfo.brand}, Load: ${cpuInfo.currentLoad}%`
      );

      return cpuInfo;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error('[SystemInfo] Error fetching CPU info:', errorMessage);
      throw error;
    }
  }

  /**
   * Get memory information
   */
  private async getMemoryInfo(): Promise<MemoryInfo> {
    this.logger.debug('[SystemInfo] Fetching memory information...');

    try {
      const memData = await si.mem();

      const memoryInfo: MemoryInfo = {
        total: memData.total || 0,
        used: memData.used || 0,
        free: memData.free || 0,
        usagePercent: Math.round(
          ((memData.used || 0) / (memData.total || 1)) * 100
        ),
        swapTotal: memData.swaptotal || 0,
        swapUsed: memData.swapused || 0,
        swapFree: memData.swapfree || 0,
      };

      this.logger.debug(
        `[SystemInfo] Memory: ${memoryInfo.usagePercent}% used (${this.formatBytes(memoryInfo.used)} / ${this.formatBytes(memoryInfo.total)})`
      );

      return memoryInfo;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error('[SystemInfo] Error fetching memory info:', errorMessage);
      throw error;
    }
  }

  /**
   * Format bytes into human-readable string
   */
  private formatBytes(bytes: number, decimals = 2): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  /**
   * Get disk information
   */
  private async getDiskInfo(): Promise<DiskInfo> {
    this.logger.debug('[SystemInfo] Fetching disk information...');

    try {
      const fsSize = await si.fsSize();

      let totalSize = 0;
      let totalUsed = 0;
      let totalAvailable = 0;

      const filesystems: FileSystemInfo[] = fsSize.map((fs) => {
        totalSize += fs.size || 0;
        totalUsed += fs.used || 0;
        totalAvailable += fs.available || 0;

        return {
          mount: fs.mount || 'Unknown',
          type: fs.type || 'Unknown',
          size: fs.size || 0,
          used: fs.used || 0,
          available: fs.available || 0,
          usePercent: Math.round(fs.use || 0),
        };
      });

      const diskInfo: DiskInfo = {
        total: totalSize,
        used: totalUsed,
        free: totalAvailable,
        usagePercent: Math.round((totalUsed / (totalSize || 1)) * 100),
        filesystems,
      };

      this.logger.debug(
        `[SystemInfo] Disk: ${diskInfo.usagePercent}% used (${this.formatBytes(diskInfo.used)} / ${this.formatBytes(diskInfo.total)})`
      );

      return diskInfo;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error('[SystemInfo] Error fetching disk info:', errorMessage);
      throw error;
    }
  }
}
