"""
GPU monitoring and metrics collection
"""
import torch
from typing import Optional, Dict
from loguru import logger


class GPUMonitor:
    """Monitor GPU usage and collect metrics"""

    def __init__(self):
        self.has_cuda = torch.cuda.is_available()
        if self.has_cuda:
            self.device_count = torch.cuda.device_count()
            logger.info(f"GPU monitoring initialized. Found {self.device_count} CUDA device(s)")
        else:
            self.device_count = 0
            logger.warning("No CUDA devices found. Training will run on CPU.")

    def get_gpu_metrics(self, device: int = 0) -> Dict[str, float]:
        """
        Get current GPU metrics for specified device

        Args:
            device: CUDA device index

        Returns:
            Dictionary with GPU metrics
        """
        if not self.has_cuda or device >= self.device_count:
            return {
                "gpu_memory_allocated_gb": 0.0,
                "gpu_memory_reserved_gb": 0.0,
                "gpu_utilization_percent": 0.0,
            }

        try:
            # Memory metrics from PyTorch
            allocated = torch.cuda.memory_allocated(device) / (1024 ** 3)  # GB
            reserved = torch.cuda.memory_reserved(device) / (1024 ** 3)  # GB

            # Try to get utilization from nvidia-ml-py
            utilization = self._get_gpu_utilization(device)

            return {
                "gpu_memory_allocated_gb": round(allocated, 2),
                "gpu_memory_reserved_gb": round(reserved, 2),
                "gpu_utilization_percent": utilization,
            }

        except Exception as e:
            logger.error(f"Error collecting GPU metrics: {e}")
            return {
                "gpu_memory_allocated_gb": 0.0,
                "gpu_memory_reserved_gb": 0.0,
                "gpu_utilization_percent": 0.0,
            }

    def _get_gpu_utilization(self, device: int) -> float:
        """Get GPU utilization percentage using nvidia-ml-py"""
        try:
            import pynvml

            pynvml.nvmlInit()
            handle = pynvml.nvmlDeviceGetHandleByIndex(device)
            utilization = pynvml.nvmlDeviceGetUtilizationRates(handle)
            pynvml.nvmlShutdown()

            return float(utilization.gpu)

        except ImportError:
            logger.debug("pynvml not available, cannot get GPU utilization")
            return 0.0
        except Exception as e:
            logger.debug(f"Could not get GPU utilization: {e}")
            return 0.0

    def get_gpu_info(self, device: int = 0) -> Dict[str, any]:
        """Get general GPU information"""
        if not self.has_cuda or device >= self.device_count:
            return {
                "name": "CPU",
                "total_memory_gb": 0.0,
                "cuda_version": "N/A",
                "device_count": 0,
            }

        return {
            "name": torch.cuda.get_device_name(device),
            "total_memory_gb": round(
                torch.cuda.get_device_properties(device).total_memory / (1024 ** 3), 2
            ),
            "cuda_version": torch.version.cuda,
            "device_count": self.device_count,
        }

    def clear_cache(self):
        """Clear GPU cache to free memory"""
        if self.has_cuda:
            torch.cuda.empty_cache()
            logger.debug("GPU cache cleared")


# Global GPU monitor instance
gpu_monitor = GPUMonitor()
