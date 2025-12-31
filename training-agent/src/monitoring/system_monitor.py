"""
System metrics monitoring (CPU, memory, disk)
Collects system resource metrics for worker heartbeat reporting
"""
import psutil
from typing import Dict, Optional
from loguru import logger


class SystemMonitor:
    """Collects system resource metrics"""

    def __init__(self):
        """Initialize system monitor"""
        self.last_cpu_percent: Optional[float] = None

    def get_metrics(self) -> Dict[str, float]:
        """
        Get current system metrics

        Returns:
            Dict with:
            - cpu_percent: CPU utilization percentage (0-100)
            - memory_used_mb: Memory used in megabytes
            - memory_total_mb: Total memory in megabytes
            - disk_used_gb: Disk used in gigabytes (root partition)

        Example:
            {
                "cpu_percent": 45.2,
                "memory_used_mb": 2048.5,
                "memory_total_mb": 8192.0,
                "disk_used_gb": 120.3
            }
        """
        try:
            # CPU percentage (non-blocking)
            # Use interval=None for non-blocking call (returns last measurement)
            cpu_percent = psutil.cpu_percent(interval=0.1)

            # Memory statistics
            memory = psutil.virtual_memory()
            memory_used_mb = memory.used / (1024 * 1024)
            memory_total_mb = memory.total / (1024 * 1024)

            # Disk usage (root partition)
            disk = psutil.disk_usage('/')
            disk_used_gb = disk.used / (1024 * 1024 * 1024)

            metrics = {
                "cpu_percent": round(cpu_percent, 2),
                "memory_used_mb": round(memory_used_mb, 2),
                "memory_total_mb": round(memory_total_mb, 2),
                "disk_used_gb": round(disk_used_gb, 2),
            }

            logger.debug(f"System metrics collected: CPU={metrics['cpu_percent']}% "
                        f"Memory={metrics['memory_used_mb']}/{metrics['memory_total_mb']}MB "
                        f"Disk={metrics['disk_used_gb']}GB")

            return metrics

        except Exception as e:
            logger.error(f"Error collecting system metrics: {e}")
            # Return zero values on error
            return {
                "cpu_percent": 0.0,
                "memory_used_mb": 0.0,
                "memory_total_mb": 0.0,
                "disk_used_gb": 0.0,
            }

    def get_cpu_count(self) -> int:
        """
        Get number of CPU cores

        Returns:
            Number of logical CPU cores
        """
        try:
            return psutil.cpu_count(logical=True) or 1
        except Exception as e:
            logger.error(f"Error getting CPU count: {e}")
            return 1

    def get_memory_info(self) -> Dict[str, float]:
        """
        Get detailed memory information

        Returns:
            Dict with memory statistics in megabytes
        """
        try:
            memory = psutil.virtual_memory()
            return {
                "total_mb": round(memory.total / (1024 * 1024), 2),
                "available_mb": round(memory.available / (1024 * 1024), 2),
                "used_mb": round(memory.used / (1024 * 1024), 2),
                "percent": round(memory.percent, 2),
            }
        except Exception as e:
            logger.error(f"Error getting memory info: {e}")
            return {
                "total_mb": 0.0,
                "available_mb": 0.0,
                "used_mb": 0.0,
                "percent": 0.0,
            }

    def get_disk_info(self) -> Dict[str, float]:
        """
        Get detailed disk information

        Returns:
            Dict with disk statistics in gigabytes
        """
        try:
            disk = psutil.disk_usage('/')
            return {
                "total_gb": round(disk.total / (1024 * 1024 * 1024), 2),
                "used_gb": round(disk.used / (1024 * 1024 * 1024), 2),
                "free_gb": round(disk.free / (1024 * 1024 * 1024), 2),
                "percent": round(disk.percent, 2),
            }
        except Exception as e:
            logger.error(f"Error getting disk info: {e}")
            return {
                "total_gb": 0.0,
                "used_gb": 0.0,
                "free_gb": 0.0,
                "percent": 0.0,
            }


# Global system monitor instance
system_monitor = SystemMonitor()
