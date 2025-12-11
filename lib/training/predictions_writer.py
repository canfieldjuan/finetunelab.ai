"""
Predictions Database Writer

Writes predictions to Supabase database (cloud) or via HTTP API (local).
Handles batch inserts and error handling without interrupting training.
"""
import os
import json
import asyncio
from pathlib import Path


class PredictionsWriter:
    """Handles async writing of predictions to database or API"""

    def __init__(self, supabase_url=None, supabase_key=None):
        """
        Initialize writer

        Args:
            supabase_url: Supabase URL (from env if None)
            supabase_key: Supabase service role key (from env if None) - only for cloud
        """
        self.is_cloud = os.getenv('IS_CLOUD', 'false').lower() == 'true'

        # Cloud mode: Direct database access (RunPod/Lambda)
        if self.is_cloud:
            self.mode = 'cloud'
            self.supabase_url = supabase_url or os.getenv('NEXT_PUBLIC_SUPABASE_URL')
            self.supabase_key = supabase_key or os.getenv('SUPABASE_SERVICE_ROLE_KEY')

            if not self.supabase_url or not self.supabase_key:
                raise ValueError('Supabase credentials not configured for cloud mode')

            from supabase import create_client
            self.client = create_client(self.supabase_url, self.supabase_key)
            print('[PredictionsWriter] Cloud mode: writing to Supabase')
        else:
            # Local mode: Write via HTTP API
            self.mode = 'local'
            self.client = None
            metrics_api_url = os.getenv('METRICS_API_URL', '')
            self.api_url = metrics_api_url.replace('/metrics', '/predictions')
            self.job_token = os.getenv('JOB_TOKEN')
            self.local_ready = bool(self.api_url and self.job_token)

            print(f'[PredictionsWriter] === LOCAL MODE DEBUG ===')
            print(f'[PredictionsWriter] METRICS_API_URL env: {metrics_api_url or "NOT SET"}')
            print(f'[PredictionsWriter] Derived predictions API URL: {self.api_url or "EMPTY"}')
            print(f'[PredictionsWriter] JOB_TOKEN: {"SET" if self.job_token else "NOT SET"}')
            print(f'[PredictionsWriter] ========================')

            if not self.local_ready:
                print('[PredictionsWriter] WARNING: Local mode but missing API_URL or JOB_TOKEN - predictions will NOT be written!')
            else:
                print(f'[PredictionsWriter] Local mode initialized: writing to {self.api_url}')

    def write_predictions(self, predictions, job_id, user_id):
        """
        Write predictions to database (cloud) or via HTTP API (local)

        Args:
            predictions: List of prediction dicts
            job_id: Training job ID
            user_id: User ID

        Returns:
            tuple: (success_count, error_count)
        """
        if not predictions:
            return 0, 0

        records = self._prepare_records(predictions, job_id, user_id)

        # Local mode: POST to HTTP API
        if self.mode == 'local':
            if not self.local_ready:
                print('[PredictionsWriter] WARNING: Skipping prediction write - METRICS_API_URL or JOB_TOKEN not set')
                return 0, len(records)
            try:
                import requests

                payload = {
                    'job_id': job_id,
                    'predictions': records
                }

                response = requests.post(
                    self.api_url,
                    json=payload,
                    headers={'Authorization': f'Bearer {self.job_token}'},
                    timeout=10
                )

                if response.status_code == 200:
                    print(f'[PredictionsWriter] Wrote {len(records)} predictions via API')
                    return len(records), 0
                else:
                    print(f'[PredictionsWriter] API error {response.status_code}: {response.text}')
                    return 0, len(records)

            except Exception as e:
                print(f'[PredictionsWriter] API write error: {e}')
                return 0, len(records)

        # Cloud mode: write directly to Supabase
        try:
            result = self.client.table('training_predictions').insert(
                records
            ).execute()

            success_count = len(result.data) if result.data else 0
            error_count = len(records) - success_count

            return success_count, error_count

        except Exception as e:
            print(f'[PredictionsWriter] Database write error: {e}')
            return 0, len(records)

    def _prepare_records(self, predictions, job_id, user_id):
        """Prepare records for database insertion"""
        records = []

        for pred in predictions:
            record = {
                'job_id': job_id,
                'user_id': user_id,
                'epoch': pred['epoch'],
                'step': pred['step'],
                'sample_index': pred['sample_index'],
                'prompt': pred['prompt'],
                'prediction': pred['prediction']
            }

            if pred.get('ground_truth'):
                record['ground_truth'] = pred['ground_truth']

            if pred.get('scores'):
                scores = pred['scores']
                record['exact_match'] = scores.get('exact_match')
                record['char_error_rate'] = scores.get('char_error_rate')
                record['length_ratio'] = scores.get('length_ratio')
                record['word_overlap'] = scores.get('word_overlap')

            records.append(record)

        return records

    async def write_predictions_async(
        self,
        predictions,
        job_id,
        user_id
    ):
        """
        Async wrapper for write_predictions

        Args:
            predictions: List of prediction dicts
            job_id: Training job ID
            user_id: User ID

        Returns:
            tuple: (success_count, error_count)
        """
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None,
            self.write_predictions,
            predictions,
            job_id,
            user_id
        )
