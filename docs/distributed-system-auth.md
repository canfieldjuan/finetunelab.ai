# Distributed Worker Authentication

**Date:** December 18, 2025  
**Status:** Production Ready  
**Security Level:** HMAC-SHA256 with Replay Protection

---

## Overview

The distributed worker authentication system secures all distributed control plane endpoints using HMAC-SHA256 signatures with timestamp-based replay protection. This prevents unauthorized access to worker registration, job execution, and queue management operations.

## Authentication Method

**Type:** HMAC (Hash-based Message Authentication Code)  
**Algorithm:** SHA-256  
**Replay Protection:** 5-minute timestamp window  
**Comparison:** Constant-time (timing attack resistant)

---

## Environment Setup

### Required Environment Variables

```bash
# Generate a strong secret key
DISTRIBUTED_WORKER_SECRET="<your-64-character-hex-string>"
```

### Generate Secret Key

```bash
openssl rand -hex 32
```

**Example output:**

```
a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2
```

Add this to your `.env.local` file:

```bash
DISTRIBUTED_WORKER_SECRET="a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2"
```

---

## Worker Implementation

### Required Headers

All distributed API requests must include these headers:

| Header | Description | Example |
|--------|-------------|---------|
| `x-worker-id` | Unique worker identifier | `worker-123` |
| `x-worker-timestamp` | Unix timestamp in milliseconds | `1734556800000` |
| `x-worker-signature` | HMAC-SHA256 signature | `abc123...` |

### Signature Generation

**Algorithm:**

```
message = workerId + ":" + timestamp
signature = HMAC-SHA256(message, DISTRIBUTED_WORKER_SECRET)
```

### Example Implementation (Node.js)

```typescript
import { createHmac } from 'crypto';

function generateWorkerSignature(
  workerId: string,
  timestamp: number,
  secret: string
): string {
  const message = `${workerId}:${timestamp}`;
  const hmac = createHmac('sha256', secret);
  hmac.update(message);
  return hmac.digest('hex');
}

function createAuthHeaders(workerId: string) {
  const timestamp = Date.now();
  const signature = generateWorkerSignature(
    workerId,
    timestamp,
    process.env.DISTRIBUTED_WORKER_SECRET!
  );

  return {
    'x-worker-id': workerId,
    'x-worker-timestamp': timestamp.toString(),
    'x-worker-signature': signature,
    'Content-Type': 'application/json',
  };
}
```

### Example Implementation (Python)

```python
import hmac
import hashlib
import time

def generate_worker_signature(worker_id: str, timestamp: int, secret: str) -> str:
    message = f"{worker_id}:{timestamp}"
    signature = hmac.new(
        secret.encode('utf-8'),
        message.encode('utf-8'),
        hashlib.sha256
    )
    return signature.hexdigest()

def create_auth_headers(worker_id: str, secret: str) -> dict:
    timestamp = int(time.time() * 1000)
    signature = generate_worker_signature(worker_id, timestamp, secret)
    
    return {
        'x-worker-id': worker_id,
        'x-worker-timestamp': str(timestamp),
        'x-worker-signature': signature,
        'Content-Type': 'application/json',
    }
```

---

## Protected Endpoints

All 10 distributed control plane endpoints require authentication:

### Worker Management

- `POST /api/distributed/workers/register` - Register worker
- `DELETE /api/distributed/workers/[workerId]` - Deregister worker
- `POST /api/distributed/workers/[workerId]/heartbeat` - Send heartbeat
- `GET /api/distributed/workers` - List all workers

### Job Execution

- `POST /api/distributed/execute` - Start execution
- `GET /api/distributed/execute/[executionId]` - Get status

### Queue Management

- `POST /api/distributed/queue/pause` - Pause queue
- `POST /api/distributed/queue/resume` - Resume queue
- `GET /api/distributed/queue/stats` - Get statistics

### Health Monitoring

- `GET /api/distributed/health` - System health check

---

## Example Usage

### Register a Worker

```typescript
const headers = createAuthHeaders('worker-1');

const response = await fetch('http://localhost:3000/api/distributed/workers/register', {
  method: 'POST',
  headers,
  body: JSON.stringify({
    workerId: 'worker-1',
    hostname: 'worker-node-1.local',
    capabilities: ['training', 'inference'],
    maxConcurrency: 4,
    metadata: {
      cpuCores: 8,
      memoryGB: 32,
      gpuCount: 2,
      version: '1.0.0',
      platform: 'linux',
    },
  }),
});

const result = await response.json();
console.log(result);
```

### Send Heartbeat

```typescript
const headers = createAuthHeaders('worker-1');

const response = await fetch('http://localhost:3000/api/distributed/workers/worker-1/heartbeat', {
  method: 'POST',
  headers,
  body: JSON.stringify({
    currentLoad: 2,
  }),
});

const result = await response.json();
console.log(result);
```

---

## Security Features

### 1. Replay Attack Prevention

- Timestamps must be within 5 minutes of server time
- Prevents signature reuse from intercepted requests
- Both past and future timestamps rejected

### 2. Timing Attack Resistance

- Uses `crypto.timingSafeEqual()` for signature comparison
- Prevents attackers from inferring signature validity through timing analysis

### 3. Signature Verification

- HMAC-SHA256 provides cryptographic integrity
- Cannot be forged without secret key
- Message includes both worker ID and timestamp

### 4. Environment-Based Secrets

- Secret key stored in environment variables
- Never committed to source control
- Can be rotated without code changes

---

## Error Responses

### 401 Unauthorized

**Missing Headers:**

```json
{
  "error": "Missing worker ID"
}
```

**Invalid Signature:**

```json
{
  "error": "Invalid signature"
}
```

**Expired Timestamp:**

```json
{
  "error": "Timestamp expired or too far in future"
}
```

### 500 Server Error

**Missing Configuration:**

```json
{
  "error": "Server configuration error"
}
```

---

## Testing

### Run Integration Tests

```bash
npm test __tests__/integration/distributed-auth.test.ts
```

### Test Coverage

The integration test suite covers:

- ✅ Rejection of requests without auth headers
- ✅ Rejection of requests with invalid signatures
- ✅ Rejection of requests with expired timestamps
- ✅ Acceptance of requests with valid authentication
- ✅ All 10 protected endpoints
- ✅ Replay attack prevention

---

## Deployment Checklist

### Pre-Deployment

- [ ] Generate strong secret key: `openssl rand -hex 32`
- [ ] Set `DISTRIBUTED_WORKER_SECRET` in production environment
- [ ] Set `DISTRIBUTED_WORKER_SECRET` in staging environment
- [ ] Update worker scripts with signature generation
- [ ] Test in staging environment

### Deployment

- [ ] Deploy API changes to production
- [ ] Update all worker nodes with new authentication
- [ ] Monitor auth failure logs for 24 hours
- [ ] Verify no unauthorized access attempts

### Post-Deployment

- [ ] Run integration tests against production
- [ ] Check CloudWatch/logs for auth errors
- [ ] Verify legitimate workers connecting successfully
- [ ] Document any issues for future reference

---

## Troubleshooting

### Worker Registration Failing

**Symptom:** 401 errors on registration  
**Common Causes:**

1. Missing `DISTRIBUTED_WORKER_SECRET` environment variable
2. Worker using wrong secret key
3. Clock skew between worker and server (> 5 minutes)
4. Invalid signature generation logic

**Solution:**

1. Verify secret matches on both sides
2. Check server and worker system clocks
3. Review signature generation code
4. Check logs for specific error message

### Timestamp Expired Errors

**Symptom:** "Timestamp expired or too far in future"  
**Cause:** Clock skew between worker and server

**Solution:**

```bash
# Sync system clock on worker
sudo ntpdate -s time.nist.gov

# Or use chrony
sudo chronyc -a makestep
```

### Invalid Signature Errors

**Symptom:** "Invalid signature" consistently  
**Possible Causes:**

1. Secret key mismatch
2. Incorrect message format
3. Encoding issues (UTF-8 vs ASCII)

**Debug Steps:**

1. Log the message being signed on worker
2. Log the signature being generated
3. Verify secret key is identical
4. Check for extra whitespace or newlines

---

## Security Best Practices

### Secret Key Management

1. **Never commit secrets to source control**

   ```bash
   # .gitignore
   .env.local
   .env.production
   ```

2. **Use different secrets per environment**
   - Development: `DISTRIBUTED_WORKER_SECRET_DEV`
   - Staging: `DISTRIBUTED_WORKER_SECRET_STAGING`
   - Production: `DISTRIBUTED_WORKER_SECRET_PROD`

3. **Rotate secrets periodically**
   - Recommended: Every 90 days
   - After security incidents: Immediately
   - After team member departure: Within 24 hours

4. **Use secure secret storage**
   - AWS Secrets Manager
   - HashiCorp Vault
   - Azure Key Vault
   - Environment variables (minimum)

### Network Security

1. **Use HTTPS in production**
   - Prevents signature interception
   - Encrypts all communication

2. **Implement rate limiting**
   - Prevents brute force attacks
   - Protects against DoS

3. **Monitor authentication failures**
   - Alert on repeated 401 errors
   - Investigate suspicious patterns

---

## API Reference

See `lib/auth/worker-auth.ts` for implementation details:

```typescript
export async function authenticateWorker(req: NextRequest): Promise<WorkerAuthResult>
export function generateWorkerSignature(workerId: string, timestamp: number, secret: string): string
export function validateWorkerSignature(workerId: string, timestamp: number, signature: string, secret: string): boolean
```

---

## Support

For issues or questions:

1. Check logs: `/var/log/distributed-worker-auth.log`
2. Review error responses for specific issues
3. Run integration tests to verify configuration
4. Contact DevOps team for production issues

---

**Last Updated:** December 18, 2025  
**Maintained By:** Engineering Team  
**Review Cycle:** Quarterly
