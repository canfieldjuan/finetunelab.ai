"""
Predictions Generator

Generates model predictions on sample prompts during training.
Handles batching for efficiency.
"""
import torch
import time
from predictions_scorer import PredictionsScorer


class PredictionsGenerator:
    """Generates predictions using current model state"""

    def __init__(self, max_length=None):
        """
        Initialize generator

        Args:
            max_length: Maximum generation length (from env if None)
        """
        import os
        self.max_length = max_length or int(
            os.getenv('PREDICTIONS_MAX_LENGTH', '256')
        )
        self.scorer = PredictionsScorer()

    def generate_predictions(
        self,
        model,
        tokenizer,
        samples,
        epoch,
        step
    ):
        """
        Generate predictions for samples

        Args:
            model: The model to use for generation
            tokenizer: Tokenizer for encoding/decoding
            samples: List of sample dicts with 'prompt' key
            epoch: Current training epoch
            step: Current training step

        Returns:
            list: Prediction dicts ready for database
        """
        predictions = []
        device = next(model.parameters()).device

        # Import validator once (not inside loop)
        validate_prediction_output = None
        try:
            from lib.training.predictions_validators import validate_prediction_output
        except ImportError:
            pass  # Validator not available

        # Save original training state to restore after predictions
        was_training = model.training

        model.eval()
        try:
            with torch.no_grad():
                for sample in samples:
                    try:
                        prediction_text, gen_meta = self._generate_single(
                            model,
                            tokenizer,
                            sample,
                            device
                        )

                        # Optional validators (off by default)
                        validation_pass = None
                        validation_kind = None
                        validation_errors = None
                        if validate_prediction_output is not None:
                            try:
                                vres = validate_prediction_output(
                                    prediction_text,
                                    sample.get('predictions_config')
                                )
                                if vres.kind is not None:
                                    validation_pass = bool(vres.passed)
                                    validation_kind = vres.kind
                                    validation_errors = vres.errors
                            except Exception:
                                # Never fail training due to validator issues
                                pass

                        pred_dict = {
                            'epoch': epoch,
                            'step': step,
                            'sample_index': sample['index'],
                            'source_index': sample.get('source_index'),
                            'prompt_id': sample.get('prompt_id'),
                            'sample_source': sample.get('sample_source', 'dataset'),
                            'sample_source_id': sample.get('sample_source_id'),
                            'prompt': sample['prompt'],
                            'ground_truth': sample.get('ground_truth'),
                            'prediction': prediction_text,

                            # Generation metadata (optional)
                            'prompt_tokens': gen_meta.get('prompt_tokens'),
                            'completion_tokens': gen_meta.get('completion_tokens'),
                            'total_tokens': gen_meta.get('total_tokens'),
                            'latency_ms': gen_meta.get('latency_ms'),
                            'max_new_tokens': gen_meta.get('max_new_tokens'),
                            'do_sample': gen_meta.get('do_sample'),

                            # Validation results (optional)
                            'validation_pass': validation_pass,
                            'validation_kind': validation_kind,
                            'validation_errors': validation_errors
                        }

                        if sample.get('ground_truth'):
                            scores = self.scorer.score_prediction(
                                prediction_text,
                                sample['ground_truth']
                            )
                            pred_dict['scores'] = scores

                        predictions.append(pred_dict)
                    except Exception as e:
                        print(f'Generation error for sample {sample["index"]}: {e}')
                        continue
        finally:
            # CRITICAL: Restore original training state after predictions
            # Without this, training continues in eval mode which breaks dropout/batchnorm
            if was_training:
                model.train()

            # Clean up GPU memory to prevent fragmentation
            if torch.cuda.is_available():
                torch.cuda.empty_cache()

        return predictions

    def _generate_single(self, model, tokenizer, sample, device):
        """Generate prediction for single prompt"""
        if sample.get('messages') and hasattr(tokenizer, 'apply_chat_template'):
            user_messages = [msg for msg in sample['messages'] if msg.get('role') != 'assistant']

            # Build template kwargs - tools required for function-calling models
            template_kwargs = {
                'tokenize': True,
                'add_generation_prompt': True,
                'return_tensors': 'pt',
                'return_dict': True
            }

            # Include tools if present (required for FunctionGemma and similar models)
            tools = sample.get('tools')
            if tools:
                template_kwargs['tools'] = tools

            inputs = tokenizer.apply_chat_template(
                user_messages,
                **template_kwargs
            )
        else:
            prompt = sample.get('prompt', '')
            inputs = tokenizer(
                prompt,
                return_tensors='pt',
                truncation=True
            )

        # Move inputs to device and ensure dtype compatibility
        input_ids = inputs['input_ids'].to(device)
        attention_mask = inputs.get('attention_mask')
        if attention_mask is not None:
            attention_mask = attention_mask.to(device)

        # Get model's dtype for compatibility
        model_dtype = next(model.parameters()).dtype

        # Prepare generate kwargs
        gen_kwargs = {
            'input_ids': input_ids,
            'max_new_tokens': self.max_length,
            'do_sample': False,
            'pad_token_id': tokenizer.eos_token_id
        }

        if attention_mask is not None:
            gen_kwargs['attention_mask'] = attention_mask

        # Use autocast with the model's dtype for consistent precision
        # This prevents "expected scalar type Float but found BFloat16" errors
        # when the model is trained with bf16/fp16 mixed precision
        start_t = time.perf_counter()
        if model_dtype in (torch.bfloat16, torch.float16):
            with torch.amp.autocast(device_type='cuda', dtype=model_dtype):
                outputs = model.generate(**gen_kwargs)
        else:
            # For float32 models, no autocast needed
            outputs = model.generate(**gen_kwargs)
        latency_ms = int((time.perf_counter() - start_t) * 1000)

        generated_ids = outputs[0][input_ids.shape[1]:]
        prediction = tokenizer.decode(
            generated_ids,
            skip_special_tokens=True
        )

        # Token/latency metadata
        try:
            prompt_tokens = int(input_ids.shape[1])
        except Exception:
            prompt_tokens = None
        try:
            completion_tokens = int(generated_ids.shape[0])
        except Exception:
            completion_tokens = None

        total_tokens = None
        if isinstance(prompt_tokens, int) and isinstance(completion_tokens, int):
            total_tokens = prompt_tokens + completion_tokens

        meta = {
            'prompt_tokens': prompt_tokens,
            'completion_tokens': completion_tokens,
            'total_tokens': total_tokens,
            'latency_ms': latency_ms,
            'max_new_tokens': int(self.max_length) if self.max_length is not None else None,
            'do_sample': bool(gen_kwargs.get('do_sample', False))
        }

        return prediction.strip(), meta
