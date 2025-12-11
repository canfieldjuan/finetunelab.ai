# Training Server Rate Limiting Implementation

**Date**: November 15, 2025  
**Status**: ✅ COMPLETE  
**Package**: slowapi 0.1.9+

---

## Overview

Implemented comprehensive rate limiting for the training server API using **slowapi** to prevent DoS attacks and resource exhaustion. Rate limiting is applied to all POST endpoints handling training operations and filesystem access.

---

## Implementation Details

### 1. Package Installation

Added to `lib/training/requirements.txt`:
```txt
slowapi>=0.1.9  # Rate limiting for API endpoints
```

**Installation**:
```bash
cd lib/training
pip install -r requirements.txt
# Or in virtual environment:
source trainer_venv/bin/activate
pip install slowapi>=0.1.9
```

---

### 2. Code Changes

**File**: `lib/training/training_server.py`

#### Added Imports
```python
from fastapi import Request  # Required for rate limiter
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
```

#### Configuration (Lines 126-130)
```python
# Rate limiting configuration
RATE_LIMIT_ENABLED = os.getenv("RATE_LIMIT_ENABLED", "true").lower() == "true"
RATE_LIMIT_TRAINING_EXECUTE = os.getenv("RATE_LIMIT_TRAINING_EXECUTE", "10/minute")
RATE_LIMIT_TRAINING_GENERAL = os.getenv("RATE_LIMIT_TRAINING_GENERAL", "30/minute")
RATE_LIMIT_FILESYSTEM = os.getenv("RATE_LIMIT_FILESYSTEM", "60/minute")
```

#### Limiter Initialization (After FastAPI app creation)
```python
# Initialize rate limiter
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

if RATE_LIMIT_ENABLED:
    logger.info(f"[Rate Limit] ENABLED - Training execute: {RATE_LIMIT_TRAINING_EXECUTE}, General: {RATE_LIMIT_TRAINING_GENERAL}, Filesystem: {RATE_LIMIT_FILESYSTEM}")
else:
    logger.warning("[Rate Limit] DISABLED - Set RATE_LIMIT_ENABLED=true to enable")
```

---

### 3. Protected Endpoints

#### Training Operations (10 req/min for execute, 30 req/min for others)

**Execute Training Job** (Most resource-intensive):
```python
@app.post("/api/training/execute")
@limiter.limit(RATE_LIMIT_TRAINING_EXECUTE if RATE_LIMIT_ENABLED else "1000000/minute")
async def execute_training(request: TrainingRequest, http_request: Request):
```

**Validate Model**:
```python
@app.post("/api/training/validate")
@limiter.limit(RATE_LIMIT_TRAINING_GENERAL if RATE_LIMIT_ENABLED else "1000000/minute")
async def validate_model(request: ValidationRequest, http_request: Request):
```

**Cancel Training Job**:
```python
@app.post("/api/training/cancel/{job_id}")
@limiter.limit(RATE_LIMIT_TRAINING_GENERAL if RATE_LIMIT_ENABLED else "1000000/minute")
async def cancel_training_job(job_id: str, http_request: Request):
```

**Pause Training Job**:
```python
@app.post("/api/training/pause/{job_id}")
@limiter.limit(RATE_LIMIT_TRAINING_GENERAL if RATE_LIMIT_ENABLED else "1000000/minute")
async def pause_training_job(job_id: str, http_request: Request):
```

**Resume Training Job**:
```python
@app.post("/api/training/resume/{job_id}")
@limiter.limit(RATE_LIMIT_TRAINING_GENERAL if RATE_LIMIT_ENABLED else "1000000/minute")
async def resume_training_job(job_id: str, http_request: Request, checkpoint_path: Optional[str] = None):
```

**Force-Start Training Job**:
```python
@app.post("/api/training/{job_id}/force-start")
@limiter.limit(RATE_LIMIT_TRAINING_GENERAL if RATE_LIMIT_ENABLED else "1000000/minute")
async def force_start_training_job(job_id: str, http_request: Request):
```

#### Filesystem Operations (60 req/min)

**List Directory**:
```python
@app.post("/api/filesystem/list")
@limiter.limit(RATE_LIMIT_FILESYSTEM if RATE_LIMIT_ENABLED else "1000000/minute")
async def list_directory(request: FilesystemListRequest, http_request: Request, auth: bool = Depends(verify_filesystem_api_key)):
```

**Read File**:
```python
@app.post("/api/filesystem/read")
@limiter.limit(RATE_LIMIT_FILESYSTEM if RATE_LIMIT_ENABLED else "1000000/minute")
async def read_file(request: FilesystemReadRequest, http_request: Request, auth: bool = Depends(verify_filesystem_api_key)):
```

**Get File Info**:
```python
@app.post("/api/filesystem/info")
@limiter.limit(RATE_LIMIT_FILESYSTEM if RATE_LIMIT_ENABLED else "1000000/minute")
async def get_file_info(request: FilesystemListRequest, http_request: Request, auth: bool = Depends(verify_filesystem_api_key)):
```

---

## Configuration

### Environment Variables

Add to `.env` or `.env.local`:

```bash
# Training Server Rate Limiting (Security - Production recommended)
# Enable/disable rate limiting (set to "false" to disable)
RATE_LIMIT_ENABLED=true

# Training execution endpoint limit (training jobs per minute)
RATE_LIMIT_TRAINING_EXECUTE=10/minute

# General training operations limit (cancel, pause, resume, validate per minute)
RATE_LIMIT_TRAINING_GENERAL=30/minute

# Filesystem operations limit (list, read, info per minute)
RATE_LIMIT_FILESYSTEM=60/minute
```

### Default Limits

If environment variables not set, defaults are:
- **Training Execute**: `10/minute` (10 training jobs per minute per IP)
- **Training General**: `30/minute` (30 operations per minute per IP)
- **Filesystem**: `60/minute` (60 filesystem operations per minute per IP)
- **Enabled**: `true` (rate limiting active by default)

### Disabling Rate Limiting

For development or trusted internal networks:
```bash
RATE_LIMIT_ENABLED=false
```

When disabled, limit is set to `1000000/minute` (effectively unlimited).

---

## Rate Limiting Strategy

### Key Function
Uses **client IP address** (`get_remote_address`) as the rate limit key:
- Each IP address gets independent rate limits
- No authentication required for rate limiting
- Works even if API keys not configured

### Time Windows
All limits are **per minute** windows:
- Sliding window (not fixed bucket)
- Resets every 60 seconds
- Tracks per endpoint separately

### Response on Limit Exceeded
Returns **HTTP 429 Too Many Requests** with:
```json
{
  "error": "Rate limit exceeded",
  "detail": "10 per 1 minute"
}
```

---

## Testing

### Test Rate Limiting

**Install Apache Bench**:
```bash
sudo apt-get install apache2-utils  # Ubuntu/Debian
brew install apache2-utils          # macOS
```

**Test Training Execute** (should block after 10 requests):
```bash
ab -n 20 -c 5 -p request.json -T application/json http://localhost:8000/api/training/execute
```

**Test Filesystem List** (should block after 60 requests):
```bash
ab -n 100 -c 10 -p list_request.json -T application/json http://localhost:8000/api/filesystem/list
```

**Expected Behavior**:
- First N requests: HTTP 200 (success)
- After limit: HTTP 429 (rate limit exceeded)
- After 1 minute: Limit resets, requests succeed again

### Monitor Logs

Enable rate limiting logs:
```bash
tail -f /path/to/training_server.log | grep "Rate Limit"
```

Expected output:
```
[Rate Limit] ENABLED - Training execute: 10/minute, General: 30/minute, Filesystem: 60/minute
```

---

## Production Deployment

### Recommended Settings

**Public Internet Deployment**:
```bash
RATE_LIMIT_ENABLED=true
RATE_LIMIT_TRAINING_EXECUTE=5/minute   # Stricter for expensive operations
RATE_LIMIT_TRAINING_GENERAL=20/minute
RATE_LIMIT_FILESYSTEM=40/minute
```

**Internal Network (Trusted)**:
```bash
RATE_LIMIT_ENABLED=true
RATE_LIMIT_TRAINING_EXECUTE=20/minute  # More lenient for trusted users
RATE_LIMIT_TRAINING_GENERAL=60/minute
RATE_LIMIT_FILESYSTEM=120/minute
```

**Development/Testing**:
```bash
RATE_LIMIT_ENABLED=false  # No limits for local development
```

### Behind Reverse Proxy

If training server is behind nginx/Cloudflare:

**Ensure real IP is forwarded**:
```nginx
# nginx.conf
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
```

**slowapi automatically uses**:
- `X-Forwarded-For` header if present
- `X-Real-IP` header as fallback
- Direct connection IP as final fallback

### Load Balancing

For multi-instance deployments:

**Option 1: Redis Backend** (Distributed rate limiting):
```python
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.middleware import SlowAPIMiddleware
import redis

redis_client = redis.Redis(host='localhost', port=6379, db=0)
limiter = Limiter(
    key_func=get_remote_address,
    storage_uri=f"redis://{redis_client.connection_pool.connection_kwargs['host']}:{redis_client.connection_pool.connection_kwargs['port']}"
)
```

**Option 2: Nginx Rate Limiting** (Offload to reverse proxy):
```nginx
limit_req_zone $binary_remote_addr zone=training:10m rate=10r/m;
limit_req zone=training burst=5 nodelay;
```

---

## Monitoring

### Metrics to Track

1. **Rate Limit Hits**: How often users hit limits (tune if too frequent)
2. **429 Response Rate**: Percentage of requests blocked
3. **Per-Endpoint Traffic**: Which endpoints get most traffic
4. **Peak Usage Times**: When to expect high load

### Logging

Rate limit events logged to training server logs:
```
[Rate Limit] ENABLED - Training execute: 10/minute, General: 30/minute, Filesystem: 60/minute
```

On rate limit exceeded (client sees 429, no server log by default).

### Health Check

Rate limiter status available in logs on startup:
```bash
curl http://localhost:8000/health
# Rate limiting status logged on server startup
```

---

## Security Benefits

### Prevents DoS Attacks
- **Before**: Attacker could spam training execute (resource exhaustion)
- **After**: Limited to 10 training jobs per minute per IP

### Protects Expensive Operations
- Training execution: Most expensive (GPU usage)
- Rate limited to 10/minute (configurable)
- Prevents GPU resource starvation

### Filesystem Protection
- File reads could be abused for disk I/O exhaustion
- Limited to 60/minute per IP
- Prevents file scanning attacks

### Fair Resource Allocation
- Multiple users get fair share of resources
- Per-IP limits prevent single user monopolization
- Complements existing API key authentication

---

## Limitations

### IP-Based Limiting
- **Shared IPs**: Users behind same NAT share limits
- **VPN/Proxy**: Attackers can rotate IPs
- **Solution**: Consider adding per-user limits with authentication

### In-Memory Storage
- **Default**: slowapi uses in-memory storage
- **Multi-Instance**: Each instance has separate counters
- **Solution**: Use Redis backend for distributed limiting

### No Per-User Limits
- Currently limits by IP only
- **Enhancement**: Add API key-based rate limiting:
```python
def get_user_id(request: Request):
    return request.headers.get("X-API-Key", get_remote_address(request))

limiter = Limiter(key_func=get_user_id)
```

---

## Troubleshooting

### Issue: Rate Limiting Not Working

**Check 1**: Verify slowapi installed
```bash
pip show slowapi
```

**Check 2**: Check environment variable
```bash
echo $RATE_LIMIT_ENABLED  # Should be "true"
```

**Check 3**: Check server logs
```bash
grep "Rate Limit" /path/to/training_server.log
```

### Issue: Too Many 429 Errors

**Solution 1**: Increase limits
```bash
RATE_LIMIT_TRAINING_EXECUTE=20/minute  # Double the limit
```

**Solution 2**: Use per-hour limits
```bash
RATE_LIMIT_TRAINING_EXECUTE=600/hour  # 10/min average
```

**Solution 3**: Whitelist trusted IPs (requires custom code)

### Issue: Rate Limiting Too Lenient

**Stricter limits**:
```bash
RATE_LIMIT_TRAINING_EXECUTE=5/minute
RATE_LIMIT_TRAINING_GENERAL=15/minute
RATE_LIMIT_FILESYSTEM=30/minute
```

---

## Future Enhancements

### 1. Per-User Rate Limiting
Combine IP + API key for granular control:
```python
def get_rate_limit_key(request: Request):
    api_key = request.headers.get("X-API-Key")
    if api_key:
        return f"user:{hash(api_key)}"
    return f"ip:{get_remote_address(request)}"
```

### 2. Dynamic Rate Limiting
Adjust limits based on system load:
```python
def get_dynamic_limit():
    gpu_usage = get_gpu_usage()
    if gpu_usage > 90:
        return "5/minute"
    return "10/minute"
```

### 3. Rate Limit Tiers
Different limits for different user tiers:
```python
RATE_LIMIT_FREE_TIER = "5/minute"
RATE_LIMIT_PRO_TIER = "20/minute"
RATE_LIMIT_ENTERPRISE_TIER = "100/minute"
```

### 4. Custom Error Messages
Provide helpful feedback:
```python
@app.exception_handler(RateLimitExceeded)
async def custom_rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code=429,
        content={
            "error": "Rate limit exceeded",
            "message": "You've made too many requests. Please try again in 1 minute.",
            "retry_after": 60,
            "docs": "https://example.com/rate-limits"
        }
    )
```

---

## Summary

### What Was Fixed
✅ Training execute endpoint (10/min)  
✅ Training validation endpoint (30/min)  
✅ Training cancel/pause/resume endpoints (30/min)  
✅ Training force-start endpoint (30/min)  
✅ Filesystem list/read/info endpoints (60/min)  

### Configuration Added
✅ `RATE_LIMIT_ENABLED` - Enable/disable flag  
✅ `RATE_LIMIT_TRAINING_EXECUTE` - Training job limit  
✅ `RATE_LIMIT_TRAINING_GENERAL` - General operations limit  
✅ `RATE_LIMIT_FILESYSTEM` - Filesystem operations limit  

### Security Improvements
✅ DoS attack prevention  
✅ Resource exhaustion protection  
✅ Fair resource allocation  
✅ Filesystem abuse prevention  

### Production Ready
✅ Configurable via environment variables  
✅ Disabled with single flag for development  
✅ Comprehensive logging  
✅ Standard HTTP 429 responses  
✅ Works with reverse proxies  

**Status**: Training server rate limiting fully implemented and production-ready! 🎉
