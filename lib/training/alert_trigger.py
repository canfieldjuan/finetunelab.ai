"""
Alert Trigger Module
Sends alerts to the Next.js API when training events occur.
Date: 2025-12-12
"""

import os
import logging
import asyncio
from typing import Optional
from datetime import datetime

logger = logging.getLogger(__name__)

ALERT_API_URL = os.getenv('ALERT_API_URL')
INTERNAL_API_KEY = os.getenv('INTERNAL_API_KEY', os.getenv('ALERT_TRIGGER_API_KEY', ''))
ALERTS_ENABLED = os.getenv('ALERTS_ENABLED', 'true').lower() == 'true' and bool(ALERT_API_URL)


async def send_alert_async(
    alert_type: str,
    job_id: str,
    user_id: str,
    model_name: Optional[str] = None,
    base_model: Optional[str] = None,
    status: Optional[str] = None,
    progress: Optional[float] = None,
    current_step: Optional[int] = None,
    total_steps: Optional[int] = None,
    loss: Optional[float] = None,
    duration_ms: Optional[int] = None,
    error_message: Optional[str] = None,
    error_type: Optional[str] = None,
) -> bool:
    """Send alert to the Next.js API asynchronously."""
    if not ALERTS_ENABLED:
        logger.debug(f'[AlertTrigger] Alerts disabled, skipping {alert_type}')
        return False

    try:
        import aiohttp

        payload = {
            'type': alert_type,
            'job_id': job_id,
            'user_id': user_id,
            'model_name': model_name,
            'base_model': base_model,
            'status': status or alert_type.replace('job_', ''),
            'progress': progress,
            'current_step': current_step,
            'total_steps': total_steps,
            'loss': loss,
            'duration': duration_ms,
            'error_message': error_message,
            'error_type': error_type,
        }

        headers = {'Content-Type': 'application/json'}
        if INTERNAL_API_KEY:
            headers['X-API-Key'] = INTERNAL_API_KEY

        timeout = aiohttp.ClientTimeout(total=10)

        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.post(ALERT_API_URL, json=payload, headers=headers) as response:
                if response.status == 200:
                    logger.info(f'[AlertTrigger] Alert sent: {alert_type} for job {job_id[:8]}...')
                    return True
                else:
                    text = await response.text()
                    logger.warning(f'[AlertTrigger] Alert failed: {response.status} - {text[:200]}')
                    return False

    except ImportError:
        logger.warning('[AlertTrigger] aiohttp not installed, using sync fallback')
        return send_alert_sync(
            alert_type, job_id, user_id, model_name, base_model, status,
            progress, current_step, total_steps, loss, duration_ms,
            error_message, error_type
        )
    except Exception as e:
        logger.error(f'[AlertTrigger] Error sending alert: {e}')
        return False


def send_alert_sync(
    alert_type: str,
    job_id: str,
    user_id: str,
    model_name: Optional[str] = None,
    base_model: Optional[str] = None,
    status: Optional[str] = None,
    progress: Optional[float] = None,
    current_step: Optional[int] = None,
    total_steps: Optional[int] = None,
    loss: Optional[float] = None,
    duration_ms: Optional[int] = None,
    error_message: Optional[str] = None,
    error_type: Optional[str] = None,
) -> bool:
    """Send alert synchronously using requests."""
    if not ALERTS_ENABLED:
        return False

    try:
        import requests

        payload = {
            'type': alert_type,
            'job_id': job_id,
            'user_id': user_id,
            'model_name': model_name,
            'base_model': base_model,
            'status': status or alert_type.replace('job_', ''),
            'progress': progress,
            'current_step': current_step,
            'total_steps': total_steps,
            'loss': loss,
            'duration': duration_ms,
            'error_message': error_message,
            'error_type': error_type,
        }

        headers = {'Content-Type': 'application/json'}
        if INTERNAL_API_KEY:
            headers['X-API-Key'] = INTERNAL_API_KEY

        response = requests.post(ALERT_API_URL, json=payload, headers=headers, timeout=10)

        if response.status_code == 200:
            logger.info(f'[AlertTrigger] Alert sent: {alert_type} for job {job_id[:8]}...')
            return True
        else:
            logger.warning(f'[AlertTrigger] Alert failed: {response.status_code}')
            return False

    except Exception as e:
        logger.error(f'[AlertTrigger] Error sending alert: {e}')
        return False


def trigger_alert(
    alert_type: str,
    job_id: str,
    user_id: str,
    **kwargs
) -> None:
    """
    Fire-and-forget alert trigger.
    Runs async if in event loop, otherwise sync.
    """
    try:
        loop = asyncio.get_running_loop()
        asyncio.create_task(send_alert_async(alert_type, job_id, user_id, **kwargs))
    except RuntimeError:
        send_alert_sync(alert_type, job_id, user_id, **kwargs)


def trigger_job_started(job_id: str, user_id: str, model_name: str = None, base_model: str = None):
    """Trigger job started alert."""
    trigger_alert('job_started', job_id, user_id, model_name=model_name, base_model=base_model)


def trigger_job_completed(
    job_id: str,
    user_id: str,
    model_name: str = None,
    loss: float = None,
    current_step: int = None,
    total_steps: int = None,
    started_at: datetime = None,
):
    """Trigger job completed alert."""
    duration = None
    if started_at:
        duration = int((datetime.now() - started_at).total_seconds() * 1000)

    trigger_alert(
        'job_completed',
        job_id,
        user_id,
        model_name=model_name,
        loss=loss,
        current_step=current_step,
        total_steps=total_steps,
        duration_ms=duration,
        progress=100.0,
    )


def trigger_job_failed(
    job_id: str,
    user_id: str,
    model_name: str = None,
    error_message: str = None,
    error_type: str = None,
    started_at: datetime = None,
):
    """Trigger job failed alert."""
    duration = None
    if started_at:
        duration = int((datetime.now() - started_at).total_seconds() * 1000)

    trigger_alert(
        'job_failed',
        job_id,
        user_id,
        model_name=model_name,
        error_message=error_message,
        error_type=error_type,
        duration_ms=duration,
    )


def trigger_job_cancelled(job_id: str, user_id: str, model_name: str = None):
    """Trigger job cancelled alert."""
    trigger_alert('job_cancelled', job_id, user_id, model_name=model_name)


def trigger_gpu_oom(job_id: str, user_id: str, model_name: str = None, error_message: str = None):
    """Trigger GPU OOM alert."""
    trigger_alert(
        'gpu_oom',
        job_id,
        user_id,
        model_name=model_name,
        error_message=error_message,
        error_type='CUDA_OOM',
    )


def trigger_timeout_warning(job_id: str, user_id: str, model_name: str = None, minutes_stale: int = None):
    """Trigger timeout warning alert."""
    trigger_alert(
        'timeout_warning',
        job_id,
        user_id,
        model_name=model_name,
        error_message=f'No progress for {minutes_stale} minutes' if minutes_stale else None,
    )
