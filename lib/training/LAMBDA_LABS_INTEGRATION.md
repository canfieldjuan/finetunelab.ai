# Lambda Labs Cloud GPU Integration Plan

**Date:** 2025-11-25
**Status:** Research Complete - Ready for Implementation

---

## Overview

Lambda Labs is a simpler alternative to RunPod for cloud GPU training. Unlike RunPod's GraphQL API, Lambda uses standard REST endpoints, making integration significantly easier.

---

## API Details

### Authentication
- **Method:** Bearer Token (HTTP Header)
- **Format:** `Authorization: Bearer <token>`
- **Storage:** Token cached in `~/.cache/lambda/token` (for CLI) or environment variable

### Base URL
```
https://cloud.lambdalabs.com/api/v1
```

### Key Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/instance-operations/launch` | Create new instance |
| `GET` | `/instances` | List all instances |
| `GET` | `/instances/{id}` | Get specific instance details |
| `POST` | `/instance-operations/terminate` | Stop instance |
| `POST` | `/instance-operations/restart` | Restart instance |
| `GET` | `/instance-types` | List available GPU types |
| `POST` | `/ssh-keys` | Add SSH key |
| `GET` | `/ssh-keys` | List SSH keys |
| `DELETE` | `/ssh-keys/{id}` | Remove SSH key |

---

## Instance Launch

### Request Format
```json
POST /instance-operations/launch

{
  "region_name": "us-west-1",
  "instance_type_name": "gpu_1x_a100_sxm4",
  "ssh_key_names": ["my-ssh-key"],
  "file_system_names": [],
  "quantity": 1
}
```

### Response
```json
{
  "data": {
    "instance_ids": ["0920582c7ff041399e34823a0be62549"]
  }
}
```

### Curl Example
```bash
curl -u $API_KEY: https://cloud.lambdalabs.com/api/v1/instance-operations/launch \
  -d '{"region_name":"us-west-1","instance_type_name":"gpu_1x_a10","ssh_key_names":["my-key"],"quantity":1}' \
  -H "Content-Type: application/json"
```

Note: The colon (`:`) after API key is required for basic auth format.

---

## Available Instance Types

### Common GPU Types
| Instance Type Name | GPU | VRAM | Price/hr |
|--------------------|-----|------|----------|
| `gpu_1x_a10` | A10 | 24GB | ~$0.60 |
| `gpu_1x_rtx6000` | RTX 6000 Ada | 48GB | ~$0.50 |
| `gpu_1x_a100` | A100 40GB | 40GB | $1.29 |
| `gpu_1x_a100_sxm4` | A100 80GB SXM4 | 80GB | $1.79 |
| `gpu_8x_a100` | 8x A100 80GB | 640GB | $14.32 |
| `gpu_1x_h100_pcie` | H100 PCIe | 80GB | $1.85 |
| `gpu_8x_h100_sxm5` | 8x H100 SXM5 | 640GB | $23.92 |

### Pricing Notes
- Billed **per minute** (not per second like RunPod)
- No egress fees for AI/ML workloads
- Storage: $0.20/GB/month
- Cheaper than RunPod for A100s ($1.29 vs $2.21 for 40GB)

---

## Python Client Options

### Option 1: `lambdacloud` (Recommended - Simpler)
```bash
pip install lambdacloud
```

```python
from lambdacloud import login, create_instance, list_instances, delete_instance

# Authenticate
login(token="<your-token>")

# Launch instance
instance_id = create_instance("gpu_1x_a100_sxm4", ssh_key_names="my-key")

# List instances
instances = list_instances()

# Terminate
delete_instance(instance_id[0])
```

### Option 2: `lambda-cloud-client` (Official - More Features)
```bash
pip install lambda-cloud-client
```

```python
import lambda_cloud_client
from lambda_cloud_client.rest import ApiException

configuration = lambda_cloud_client.Configuration(
    access_token = os.environ["BEARER_TOKEN"]
)

with lambda_cloud_client.ApiClient(configuration) as api_client:
    api_instance = lambda_cloud_client.DefaultApi(api_client)

    # Launch instance
    request = {
        "region_name": "us-west-1",
        "instance_type_name": "gpu_1x_a100_sxm4",
        "ssh_key_names": ["my-key"],
        "quantity": 1
    }
    response = api_instance.launch_instance(request)
```

---

## Implementation Plan

### Files to Create

#### 1. `/lib/training/lambda-service.ts`
Service layer for Lambda Labs API interactions.

**Key Methods:**
```typescript
class LambdaLabsService {
  // Launch instance
  async createInstance(request: {
    instance_type: string,
    region: string,
    ssh_key_name: string
  }): Promise<string> // returns instance_id

  // Get instance details
  async getInstance(instanceId: string): Promise<InstanceDetails>

  // Terminate instance
  async terminateInstance(instanceId: string): Promise<void>

  // SSH and run command
  async executeCommand(instanceId: string, command: string): Promise<void>
}
```

#### 2. `/app/api/training/deploy/lambda/route.ts`
API endpoint for Lambda Labs deployments.

**Flow:**
1. Get user's Lambda API token from database
2. Create SSH key if needed
3. Launch instance via Lambda API
4. Wait for instance to be `active`
5. SSH into instance
6. Run training script (same script we use for RunPod)
7. Save deployment info to `cloud_deployments` table

#### 3. `/lib/training/deployment.types.ts` (UPDATE)
Add Lambda-specific types.

```typescript
export type CloudProvider = 'runpod' | 'lambda' | 'kaggle' | 'colab';

export interface LambdaDeploymentRequest {
  training_config_id: string;
  instance_type: string;  // 'gpu_1x_a100_sxm4'
  region: string;         // 'us-west-1'
  ssh_key_name?: string;
}
```

#### 4. `/components/training/CloudDeploymentWizard.tsx` (UPDATE)
Add Lambda as provider option.

**Changes:**
- Add "Lambda Labs" to provider dropdown
- Show Lambda instance types when selected
- Map GPU selection to Lambda instance type names

### GPU Mapping

```typescript
const LAMBDA_GPU_MAP = {
  'A100_40GB': 'gpu_1x_a100',
  'A100_80GB': 'gpu_1x_a100_sxm4',
  'H100_80GB': 'gpu_1x_h100_pcie',
  'A10': 'gpu_1x_a10',
  'RTX_6000': 'gpu_1x_rtx6000',
};
```

---

## Key Differences from RunPod

| Feature | RunPod | Lambda Labs |
|---------|--------|-------------|
| **API Type** | GraphQL | REST |
| **Auth** | API Key (header) | Bearer Token (header) |
| **Complexity** | High (schema changes) | Low (simple JSON) |
| **Startup Method** | dockerArgs in mutation | SSH after launch |
| **Script Execution** | Docker CMD override | Direct bash via SSH |
| **Quote Escaping** | Nightmarish (heredocs) | Normal (SSH commands) |
| **Instance Control** | Pod lifecycle | VM lifecycle |
| **Cost (A100 40GB)** | $2.21/hr | $1.29/hr |
| **Billing** | Per second | Per minute |
| **Support** | Community + paid | Email support |

---

## Training Script Execution

### Approach
Unlike RunPod's `dockerArgs`, Lambda requires SSH execution after instance is running.

```typescript
// 1. Launch instance
const instanceId = await lambdaService.createInstance({...});

// 2. Wait for instance to be active
await lambdaService.waitForActive(instanceId);

// 3. Get instance IP
const instance = await lambdaService.getInstance(instanceId);
const ip = instance.ip;

// 4. SSH and run setup
await ssh.exec(ip, `
  # Install dependencies
  pip install transformers datasets accelerate peft bitsandbytes trl supabase

  # Download dataset from Supabase
  wget -O dataset.jsonl.gz "$DATASET_URL"
  zcat dataset.jsonl.gz > dataset.jsonl

  # Run training script
  python train.py
`);
```

### Training Script
**Reuse the same Python training script from RunPod!** The training logic is identical:
- Load model from HuggingFace
- Load dataset from local file
- Use appropriate trainer (SFT/DPO/ORPO)
- Write metrics to Supabase
- Save model when done

---

## Advantages Over RunPod

### 1. **Simpler API**
- REST instead of GraphQL
- No schema version issues
- Standard HTTP requests

### 2. **Cheaper for A100s**
- A100 40GB: $1.29/hr vs $2.21/hr (42% cheaper)
- A100 80GB: $1.79/hr vs $2.89/hr (38% cheaper)

### 3. **Better Documentation**
- Clear API docs
- Multiple Python clients
- Active community examples

### 4. **No Container Complexity**
- Direct VM access
- Standard SSH
- Normal bash scripting (no quote escaping hell)

### 5. **Faster Iteration**
- SSH and debug easily
- No pod restart loops
- Direct file access

---

## Implementation Effort Estimate

### RunPod Integration (Actual)
- **Time Spent:** ~2 days
- **Issues:** GraphQL schema, dockerArgs escaping, GPU mapping, pod lifecycle
- **Complexity:** High

### Lambda Labs Integration (Estimated)
- **Expected Time:** 4-6 hours
- **Complexity:** Low
- **Reason:** Simple REST API + SSH is much easier than GraphQL + containers

### Breakdown
1. **Lambda Service (`lambda-service.ts`)** - 2 hours
   - API client setup
   - Instance launch/terminate
   - SSH command execution

2. **Deploy API Route (`deploy/lambda/route.ts`)** - 1.5 hours
   - Token validation
   - Instance creation flow
   - Database updates

3. **UI Updates (`CloudDeploymentWizard.tsx`)** - 1 hour
   - Add Lambda provider option
   - Instance type dropdown
   - Pricing display

4. **Testing** - 1.5 hours
   - End-to-end deployment
   - Metrics validation
   - Error handling

---

## Dependencies Needed

### NPM Packages
```json
{
  "node-ssh": "^13.1.0"  // For SSH execution
}
```

### Python Packages (in training script)
Already installed:
- transformers
- datasets
- accelerate
- peft
- bitsandbytes
- trl
- supabase

---

## Database Changes

### Add to `cloud_providers` table
```sql
INSERT INTO cloud_providers (name, type, is_active)
VALUES ('lambda_labs', 'cloud', true);
```

### Add to `user_cloud_credentials` table
User needs to store Lambda API token:
```sql
-- User adds their Lambda token via settings
INSERT INTO user_cloud_credentials (user_id, provider, credentials)
VALUES (
  '<user_id>',
  'lambda_labs',
  '{"api_token": "encrypted-token-here"}'
);
```

---

## Next Steps (When Ready)

1. **Create Lambda service file** - REST API client
2. **Create deploy endpoint** - `/api/training/deploy/lambda/route.ts`
3. **Update UI** - Add Lambda to provider dropdown
4. **Add SSH execution** - Install `node-ssh` package
5. **Test end-to-end** - Launch → Train → Metrics → Terminate
6. **Add to docs** - User guide for Lambda integration

---

## Resources

- **API Docs:** https://docs.lambda.ai/api/cloud
- **Python Client:** https://github.com/nateraw/lambdacloud
- **Official Client:** https://pypi.org/project/lambda-cloud-client/
- **Pricing:** https://lambda.ai/pricing
- **Instance Types:** https://lambda.ai/instances

---

## Notes

- Lambda requires SSH key to be registered before launching instances
- Instances have public IPs by default (easier than RunPod's pod URLs)
- No container layer means easier debugging (just SSH in)
- Billing is per minute (round up) vs RunPod's per second
- Better for shorter jobs due to cheaper pricing
- All training code can be reused from RunPod implementation

---

**Status:** Ready to implement when needed. Estimated to be significantly easier than RunPod integration.
