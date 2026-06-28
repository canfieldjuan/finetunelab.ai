import { describe, expect, it } from 'vitest';
import {
  buildCreateModelRecord,
  buildUpdateModelRecord,
} from '../model-manager.service';

describe('modelManager payload builders', () => {
  it('includes served_model_name and is_default in create records', () => {
    const record = buildCreateModelRecord(
      {
        name: 'Local Qwen',
        provider: 'vllm',
        base_url: 'http://127.0.0.1:8002/v1',
        model_id: '/models/qwen',
        served_model_name: 'qwen-chat',
        auth_type: 'none',
        is_default: true,
      },
      'user-1'
    );

    expect(record).toEqual(expect.objectContaining({
      user_id: 'user-1',
      model_id: '/models/qwen',
      served_model_name: 'qwen-chat',
      is_global: false,
      is_default: true,
    }));
  });

  it('normalizes empty served_model_name to null on update records', () => {
    const updates = buildUpdateModelRecord({
      served_model_name: '',
      is_default: false,
    });

    expect(updates).toEqual({
      served_model_name: null,
      is_default: false,
    });
  });
});
