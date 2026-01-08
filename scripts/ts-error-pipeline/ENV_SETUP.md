# Environment Variable Setup (.env)

## Overview

The TypeScript error pipeline now supports `.env` files for managing sensitive configuration like API keys. This is the **recommended** way to configure your Ollama Cloud API credentials.

## Why Use .env?

**Security Benefits:**
- ✅ API keys are NOT committed to git (`.env` is in `.gitignore`)
- ✅ Separate secrets from configuration
- ✅ Easy to share config.json without exposing credentials
- ✅ Standard practice for managing secrets in development

**Convenience:**
- ✅ One file for all environment-specific settings
- ✅ Easy to switch between environments (dev/staging/prod)
- ✅ No need to edit config.json manually

## Quick Setup

### 1. Run the Interactive Setup

```bash
npm run ts:setup-cloud
```

This will:
- Create a `.env` file automatically
- Save your API key securely
- Configure cloud models
- Set execution mode

### 2. Manual Setup (Alternative)

Copy the example file:

```bash
cd scripts/ts-error-pipeline
cp .env.example .env
```

Edit `.env` and add your API key:

```env
# Your Ollama Cloud API key
OLLAMA_CLOUD_API_KEY=b9e48d640a074990b1daeafca86357ad.CID3XSGADEbDmgILwgGHBXo2

# Optional overrides
OLLAMA_CLOUD_BASE_URL=https://cloud.ollamahub.com
OLLAMA_CLOUD_TIMEOUT_MS=600000
```

## Environment Variables Reference

### Required

**`OLLAMA_CLOUD_API_KEY`**
- Your Ollama Cloud API key
- Get it from: https://cloud.ollamahub.com/api-keys
- Example: `b9e48d640a074990b1daeafca86357ad.CID3XSGADEbDmgILwgGHBXo2`

### Optional

**`OLLAMA_CLOUD_BASE_URL`**
- Cloud API endpoint
- Default: `https://cloud.ollamahub.com`
- Override for custom endpoints or testing

**`OLLAMA_CLOUD_TIMEOUT_MS`**
- Request timeout for cloud models (milliseconds)
- Default: `600000` (10 minutes)
- Increase for very large models or slow connections

**`OLLAMA_LOCAL_BASE_URL`**
- Local Ollama API endpoint
- Default: `http://localhost:11434`
- Override for custom local setups

**`OLLAMA_LOCAL_TIMEOUT_MS`**
- Request timeout for local models (milliseconds)
- Default: `300000` (5 minutes)
- Increase for large local models

## How It Works

### Priority Order

The pipeline loads configuration in this order:

1. **config.json** - Base configuration (models, thresholds, execution mode)
2. **.env file** - Environment-specific overrides (API keys, URLs, timeouts)
3. **Final merged config** - Used by all scripts

### Example

**config.json:**
```json
{
  "ollama": {
    "cloud": {
      "base_url": "https://cloud.ollamahub.com",
      "api_key": "YOUR_API_KEY_HERE",
      "timeout_ms": 600000
    }
  }
}
```

**.env:**
```env
OLLAMA_CLOUD_API_KEY=b9e48d640a074990b1daeafca86357ad.CID3XSGADEbDmgILwgGHBXo2
```

**Result (what scripts see):**
```json
{
  "ollama": {
    "cloud": {
      "base_url": "https://cloud.ollamahub.com",
      "api_key": "b9e48d640a074990b1daeafca86357ad.CID3XSGADEbDmgILwgGHBXo2",
      "timeout_ms": 600000
    }
  }
}
```

## File Locations

```
scripts/ts-error-pipeline/
├── .env                    # Your secrets (NOT committed)
├── .env.example           # Template (committed)
├── config.json            # Base config (committed)
└── lib/
    └── load-env-config.mjs # Config loader
```

## Security Best Practices

### ✅ DO

- **Use .env for API keys** - Never put credentials in config.json
- **Keep .env local** - It's already in .gitignore
- **Use .env.example** - Document required variables without exposing values
- **Rotate keys regularly** - Regenerate API keys periodically
- **Use different keys per environment** - Separate dev/staging/prod keys

### ❌ DON'T

- **Don't commit .env** - It contains secrets
- **Don't share .env files** - Send .env.example instead
- **Don't put API keys in config.json** - Use .env
- **Don't hardcode secrets in code** - Always use environment variables
- **Don't use production keys in development** - Keep them separate

## Troubleshooting

### API Key Not Working

**Check .env file exists:**
```bash
ls scripts/ts-error-pipeline/.env
```

**Verify API key is loaded:**
```bash
npm run ts:test-cloud
```

**Check config source:**
```bash
npm run ts:setup-cloud
# Look for "Config source: .env file" message
```

### .env File Not Found

**Create from example:**
```bash
cd scripts/ts-error-pipeline
cp .env.example .env
# Edit .env and add your API key
```

**Or run setup:**
```bash
npm run ts:setup-cloud
```

### Still Reading from config.json

If you have an API key in **both** config.json and .env:
- .env takes precedence
- Remove API key from config.json for clarity:

```bash
# Replace API key in config.json with placeholder
sed -i 's/"api_key": "b9e48.*"/"api_key": "YOUR_API_KEY_HERE"/' scripts/ts-error-pipeline/config.json
```

### Permission Denied

**.env file permissions should be restrictive:**
```bash
chmod 600 scripts/ts-error-pipeline/.env
```

## CI/CD Integration

### GitHub Actions

```yaml
name: TypeScript Error Pipeline

on: [push]

jobs:
  fix-errors:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup environment
        run: |
          echo "OLLAMA_CLOUD_API_KEY=${{ secrets.OLLAMA_CLOUD_API_KEY }}" > scripts/ts-error-pipeline/.env

      - name: Run pipeline
        run: npm run ts:pipeline:parallel
```

**Add secret in GitHub:**
- Go to Settings → Secrets and variables → Actions
- Add `OLLAMA_CLOUD_API_KEY` with your API key

### GitLab CI

```yaml
typescript-fixes:
  script:
    - echo "OLLAMA_CLOUD_API_KEY=${OLLAMA_CLOUD_API_KEY}" > scripts/ts-error-pipeline/.env
    - npm run ts:pipeline:parallel
  variables:
    OLLAMA_CLOUD_API_KEY: $OLLAMA_CLOUD_API_KEY
```

**Add variable in GitLab:**
- Go to Settings → CI/CD → Variables
- Add `OLLAMA_CLOUD_API_KEY` (mark as masked)

## Migration from config.json

If you previously stored your API key in config.json:

### Step 1: Run Setup

```bash
npm run ts:setup-cloud
# Enter your existing API key when prompted
```

### Step 2: Clean config.json

```bash
cd scripts/ts-error-pipeline
```

Edit `config.json` and replace your API key with the placeholder:

```json
{
  "ollama": {
    "cloud": {
      "api_key": "YOUR_API_KEY_HERE"
    }
  }
}
```

### Step 3: Verify

```bash
npm run ts:test-cloud
```

You should see:
```
Current cloud configuration:
  Config source: .env file  ← Should say ".env file"
  API Key: (set)
```

### Step 4: Commit Changes

```bash
git add scripts/ts-error-pipeline/config.json
git commit -m "chore: move API key to .env file"
```

Your API key is now safely in `.env` (not committed) instead of `config.json` (committed).

## Example .env Files

### Development

```env
# Development environment
OLLAMA_CLOUD_API_KEY=dev_b9e48d640a074990b1daeafca86357ad

# Use faster timeout for development
OLLAMA_CLOUD_TIMEOUT_MS=300000
```

### Production

```env
# Production environment
OLLAMA_CLOUD_API_KEY=prod_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6

# Longer timeout for production stability
OLLAMA_CLOUD_TIMEOUT_MS=900000
```

### Testing with Local Models Only

```env
# No cloud API key needed for local-only testing
# Leave OLLAMA_CLOUD_API_KEY empty or unset

# Optional: custom local endpoint
OLLAMA_LOCAL_BASE_URL=http://192.168.1.100:11434
```

## Next Steps

1. **Setup**: Run `npm run ts:setup-cloud` to create .env
2. **Test**: Run `npm run ts:test-cloud` to verify
3. **Use**: Run `npm run ts:pipeline:parallel` with cloud models
4. **Secure**: Never commit .env to git
5. **Document**: Update .env.example when adding new variables

Your API keys are now secure! 🔒
