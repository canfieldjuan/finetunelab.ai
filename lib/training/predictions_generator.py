"""
Predictions Generator

Generates model predictions on sample prompts during training.
Handles batching for efficiency.
"""
import torch
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

        model.eval()
        with torch.no_grad():
            for sample in samples:
                try:
                    prediction_text = self._generate_single(
                        model,
                        tokenizer,
                        sample,
                        device
                    )

                    pred_dict = {
                        'epoch': epoch,
                        'step': step,
                        'sample_index': sample['index'],
                        'prompt': sample['prompt'],
                        'ground_truth': sample.get('ground_truth'),
                        'prediction': prediction_text
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

        return predictions

    def _generate_single(self, model, tokenizer, sample, device):
        """Generate prediction for single prompt"""
        if sample.get('messages') and hasattr(tokenizer, 'apply_chat_template'):
            user_messages = [msg for msg in sample['messages'] if msg.get('role') != 'assistant']
            inputs = tokenizer.apply_chat_template(
                user_messages,
                tokenize=True,
                add_generation_prompt=True,
                return_tensors='pt',
                return_dict=True
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
        if model_dtype in (torch.bfloat16, torch.float16):
            with torch.amp.autocast(device_type='cuda', dtype=model_dtype):
                outputs = model.generate(**gen_kwargs)
        else:
            # For float32 models, no autocast needed
            outputs = model.generate(**gen_kwargs)

        generated_ids = outputs[0][input_ids.shape[1]:]
        prediction = tokenizer.decode(
            generated_ids,
            skip_special_tokens=True
        )

        return prediction.strip()
