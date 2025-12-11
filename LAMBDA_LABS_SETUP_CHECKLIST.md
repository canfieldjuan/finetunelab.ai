# Lambda Labs Integration - Setup Checklist

**Date:** 2025-11-26
**Status:** Backend Complete - Ready for Testing

---

## Quick Start Checklist

### ✅ Step 1: Environment Variable (DONE)
- [x] Added `LAMBDA_SSH_KEY_PATH=/home/juan-canfield/.ssh/id_rsa` to `.env.local`

### ⬜ Step 2: Lambda Labs Account Setup
- [ ] Create account at https://cloud.lambdalabs.com
- [ ] Generate API key at https://cloud.lambdalabs.com/api-keys
- [ ] Upload SSH public key at https://cloud.lambdalabs.com/ssh-keys

### ⬜ Step 3: Add Lambda API Key to Secrets Vault
- [ ] Go to your web UI Settings → Secrets Vault (or wherever you manage secrets)
- [ ] Add new secret:
  - **Provider**: `lambda`
  - **API Key**: Paste your Lambda Labs API token

### ⬜ Step 4: Verify SSH Key Exists
```bash
# Check if SSH key exists
ls -la ~/.ssh/id_rsa

# If not, generate one:
ssh-keygen -t rsa -b 4096 -C "your_email@example.com"

# Get public key to upload to Lambda Labs:
cat ~/.ssh/id_rsa.pub
```

### ⬜ Step 5: Test Backend API
```bash
# 1. Export your auth token
export SUPABASE_AUTH_TOKEN='<your-token-from-env.local>'

# 2. Edit test script with your training config ID
nano test-lambda-api.sh
# Update: TRAINING_CONFIG_ID="<your-actual-config-id>"

# 3. Run test
./test-lambda-api.sh
```

---

## What's Already Done

### ✅ Backend Implementation (100%)
- [x] `lib/training/lambda-service.ts` - Full REST API client
- [x] `app/api/training/deploy/lambda/route.ts` - POST/GET/DELETE endpoints
- [x] `lib/training/deployment.types.ts` - Type definitions
- [x] Secrets vault integration
- [x] SSH command execution
- [x] Status monitoring
- [x] Cost tracking
- [x] Error handling

### ⬜ UI Integration (0%)
- [ ] Update `components/training/CloudDeploymentWizard.tsx`
  - [ ] Add `'lambda'` to `CloudPlatform` type
  - [ ] Add Lambda GPU selector
  - [ ] Add Lambda region selector
  - [ ] Wire up deployment flow

---

## GPU Types Available

| Instance Type | GPU | VRAM | Price/hr | vs RunPod |
|---------------|-----|------|----------|-----------|
| `gpu_1x_a10` | A10 | 24GB | **$0.60** | 24% cheaper |
| `gpu_1x_rtx6000` | RTX 6000 | 48GB | **$0.50** | 44% cheaper |
| `gpu_1x_a100` | A100 40GB | 40GB | **$1.29** | **42% cheaper** ✨ |
| `gpu_1x_a100_sxm4` | A100 80GB | 80GB | **$1.79** | 38% cheaper |
| `gpu_8x_a100` | 8x A100 | 640GB | **$14.32** | - |
| `gpu_1x_h100_pcie` | H100 | 80GB | **$1.85** | 44% cheaper |
| `gpu_8x_h100_sxm5` | 8x H100 | 640GB | **$23.92** | - |

---

## Regions Available

- `us-west-1` (California)
- `us-west-2` (Oregon)
- `us-east-1` (Virginia)
- `us-south-1` (Texas)
- `us-midwest-1` (Illinois)
- `europe-central-1` (Germany)
- `asia-south-1` (India)
- `me-west-1` (Israel)
- `asia-northeast-1` (Japan)
- `asia-northeast-2` (South Korea)

---

## Testing the Backend API

### Prerequisites
1. ✅ `.env.local` has `LAMBDA_SSH_KEY_PATH`
2. ⬜ Lambda API key in secrets vault (provider='lambda')
3. ⬜ SSH public key registered on Lambda Labs
4. ⬜ Training config created in your database

### Test Commands

#### Manual curl test:
```bash
# 1. Set auth token
export AUTH_TOKEN="<your-supabase-auth-token>"

# 2. Deploy
curl -X POST http://localhost:3000/api/training/deploy/lambda \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -d '{
    "training_config_id": "<your-config-id>",
    "instance_type": "gpu_1x_a10",
    "region": "us-west-1",
    "budget_limit": 5.00
  }'

# 3. Check status (use deployment_id from response)
curl -X GET "http://localhost:3000/api/training/deploy/lambda?deployment_id=<deployment-id>" \
  -H "Authorization: Bearer $AUTH_TOKEN"

# 4. Terminate (cleanup)
curl -X DELETE "http://localhost:3000/api/training/deploy/lambda?deployment_id=<deployment-id>" \
  -H "Authorization: Bearer $AUTH_TOKEN"
```

#### Using test script:
```bash
./test-lambda-api.sh
```

---

## Troubleshooting

### Error: "Lambda Labs API key not configured"
**Fix:** Add your Lambda API key to secrets vault with `provider='lambda'`

### Error: "No SSH keys found in Lambda Labs account"
**Fix:** Upload your public SSH key at https://cloud.lambdalabs.com/ssh-keys

### Error: "SSH execution failed"
**Fix:**
1. Verify `LAMBDA_SSH_KEY_PATH` points to correct private key
2. Check key permissions: `chmod 600 ~/.ssh/id_rsa`
3. Ensure public key matches what's registered on Lambda Labs

### Error: "Training config not found"
**Fix:** Create a training config in your UI first, then use its ID

### Error: "Instance did not become active"
**Fix:**
1. Check Lambda Labs console for instance status
2. Try different GPU type or region
3. Verify your Lambda account has capacity

---

## Next Steps

### Immediate (When Ready to Test)
1. [ ] Get Lambda Labs account + API key
2. [ ] Add API key to secrets vault
3. [ ] Upload SSH public key to Lambda
4. [ ] Run `./test-lambda-api.sh`
5. [ ] Verify instance launches successfully
6. [ ] Check metrics are reported to Supabase
7. [ ] Verify cleanup/termination works

### Short Term (UI Integration)
1. [ ] Update `CloudDeploymentWizard.tsx`
2. [ ] Add Lambda to provider dropdown
3. [ ] Create GPU selector component
4. [ ] Add region selector
5. [ ] Test end-to-end from UI

### Long Term (Enhancements)
1. [ ] Multi-GPU instance support
2. [ ] Spot instances (even cheaper!)
3. [ ] Auto-region selection (lowest latency)
4. [ ] Training resumption from checkpoints
5. [ ] Model export to HuggingFace Hub

---

## Files Modified

### New Files (3)
1. `lib/training/lambda-service.ts` - Lambda Labs service
2. `app/api/training/deploy/lambda/route.ts` - API endpoints
3. `test-lambda-api.sh` - Backend test script

### Modified Files (2)
1. `lib/training/deployment.types.ts` - Added Lambda types
2. `.env.local` - Added `LAMBDA_SSH_KEY_PATH`

### Unchanged (Everything else still works)
- All RunPod functionality preserved
- All existing training flows unaffected
- Zero breaking changes

---

## Cost Savings Example

**Training a model for 10 hours on A100 40GB:**
- **Lambda Labs**: $1.29/hr × 10 = **$12.90**
- **RunPod**: $2.21/hr × 10 = **$22.10**
- **Savings**: **$9.20 (42%)**

---

## Resources

- **Lambda Console**: https://cloud.lambdalabs.com
- **API Keys**: https://cloud.lambdalabs.com/api-keys
- **SSH Keys**: https://cloud.lambdalabs.com/ssh-keys
- **API Docs**: https://docs.lambda.ai/api/cloud
- **Pricing**: https://lambda.ai/pricing
- **Instance Types**: https://lambda.ai/instances

---

**Ready to test!** Complete the checklist above, then run `./test-lambda-api.sh`
