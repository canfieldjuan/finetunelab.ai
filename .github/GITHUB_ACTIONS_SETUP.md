# GitHub Actions Self-Hosted Runner Setup

This guide shows you how to set up a self-hosted GitHub Actions runner on your local machine with Ollama.

## Why Self-Hosted?

Your setup:
- ✅ RTX 3090 with 24GB VRAM
- ✅ qwen2.5-coder:32b model already downloaded (19GB)
- ✅ Ollama running locally
- ✅ $0 cost (uses your GPU)
- ✅ 100% private (code never leaves your machine)

GitHub-hosted runners don't have GPUs, so we use your machine instead!

---

## Setup Steps

### 1. Navigate to Your Repository Settings

1. Go to your GitHub repository
2. Click **Settings** > **Actions** > **Runners**
3. Click **New self-hosted runner**
4. Select **Linux** as the operating system

### 2. Download and Configure the Runner

GitHub will show you commands like this:

```bash
# Create a folder for the runner
mkdir actions-runner && cd actions-runner

# Download the latest runner package
curl -o actions-runner-linux-x64-2.311.0.tar.gz -L https://github.com/actions/runner/releases/download/v2.311.0/actions-runner-linux-x64-2.311.0.tar.gz

# Extract the installer
tar xzf ./actions-runner-linux-x64-2.311.0.tar.gz

# Create the runner and start the configuration
./config.sh --url https://github.com/YOUR-USERNAME/YOUR-REPO --token YOUR-TOKEN
```

**Important:** Use the commands from YOUR GitHub page (they include your specific token)

### 3. Configure the Runner

When prompted:

```bash
Enter the name of the runner group: [press Enter for default]

Enter the name of runner: [press Enter for default OR type: ollama-gpu-runner]

Enter any additional labels (ex. label-1,label-2): gpu,ollama,rtx3090

Enter name of work folder: [press Enter for default: _work]
```

### 4. Start the Runner

**Option A: Run in foreground (for testing)**
```bash
./run.sh
```

**Option B: Run as a service (recommended for always-on)**
```bash
# Install as systemd service
sudo ./svc.sh install

# Start the service
sudo ./svc.sh start

# Check status
sudo ./svc.sh status

# View logs
journalctl -u actions.runner.* -f
```

### 5. Verify Setup

1. Go back to **Settings** > **Actions** > **Runners**
2. You should see your runner listed with a green "Idle" status
3. Make sure Ollama is running: `ollama serve` (or run as systemd service)

### 6. Test the Workflow

Create a pull request with some code changes:

```bash
git checkout -b test-pr-review
# Make some changes to a .ts file
git add .
git commit -m "test: trigger AI code review"
git push origin test-pr-review
```

Then create a PR on GitHub. The workflow will:
1. ✅ Run on your self-hosted runner
2. ✅ Use your local Ollama + qwen2.5-coder:32b
3. ✅ Review the changed files
4. ✅ Post results as a comment on the PR

---

## Important Notes

### Security Considerations

⚠️ **Self-hosted runners for public repositories can be risky!**

- Anyone can fork your repo and create a PR
- The PR would run on YOUR machine
- Malicious code could access your local files

**Recommendations:**
1. Only use self-hosted runners for **private repositories**
2. OR enable **"Require approval for all outside collaborators"** in Settings > Actions > General
3. Review PRs from unknown contributors before approving workflow runs

### Making Sure Ollama Runs on Startup

If you want the AI code review to always work, make sure Ollama starts automatically:

```bash
# Create systemd service for Ollama
sudo nano /etc/systemd/system/ollama.service
```

Add this content:

```ini
[Unit]
Description=Ollama Service
After=network.target

[Service]
Type=simple
User=juan-canfield
Environment="PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
ExecStart=/usr/local/bin/ollama serve
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Then enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable ollama
sudo systemctl start ollama
sudo systemctl status ollama
```

---

## Workflow Features

The `ai-code-review.yml` workflow:

✅ **Automatic Triggers**
- Runs on every PR (opened, updated, or reopened)
- Only reviews TypeScript/JavaScript files
- Skips if no code files changed

✅ **Smart Checks**
- Verifies Ollama is running
- Verifies model is available
- Gets only the changed files in the PR

✅ **PR Comments**
- Posts review results as a collapsible comment
- Shows ⚠️ for critical issues or ✅ for clean code
- Includes full review output

✅ **Cost & Privacy**
- $0 cost (local GPU)
- 100% private (never leaves your machine)
- ~5-10 second reviews

---

## Troubleshooting

### Runner shows "Offline"

```bash
# Check if runner service is running
sudo systemctl status actions.runner.*

# Restart the runner
sudo ./svc.sh stop
sudo ./svc.sh start
```

### Workflow fails with "Ollama not running"

```bash
# Check Ollama status
curl http://localhost:11434/api/tags

# Start Ollama
ollama serve

# Or if using systemd
sudo systemctl start ollama
```

### Workflow fails with "Model not found"

```bash
# List available models
ollama list

# Pull the model if missing
ollama pull qwen2.5-coder:32b
```

### Runner uses too much disk space

```bash
# Clean up old workflow runs
cd ~/actions-runner/_work/_actions
du -sh *
# Remove old cached actions if needed

# Clean up Docker images (if any)
docker system prune -a
```

---

## Alternative: GitHub-Hosted Runner with Docker

If you don't want to run a self-hosted runner, you can use GitHub-hosted runners with Ollama in Docker (but this requires a smaller model since GitHub runners don't have GPUs):

```yaml
# .github/workflows/ai-code-review-cloud.yml
runs-on: ubuntu-latest

steps:
  - name: Start Ollama in Docker
    run: |
      docker run -d -p 11434:11434 ollama/ollama
      docker exec ollama ollama pull qwen2.5-coder:7b  # Smaller model for CPU

  - name: Run code review
    run: MODEL=qwen2.5-coder:7b npx tsx scripts/ollama-code-review.ts
```

**Trade-offs:**
- ✅ No self-hosted runner needed
- ✅ Works on public repos
- ❌ Slower (CPU only, ~30-60 seconds)
- ❌ Uses GitHub Actions minutes
- ❌ Smaller model (7B instead of 32B)

---

## Uninstalling the Runner

If you want to remove the self-hosted runner:

```bash
# Stop the service
sudo ./svc.sh stop

# Uninstall the service
sudo ./svc.sh uninstall

# Remove the runner from GitHub
./config.sh remove --token YOUR-REMOVAL-TOKEN

# Delete the folder
cd ..
rm -rf actions-runner
```

Then go to GitHub Settings > Actions > Runners and confirm the runner is removed.

---

## Next Steps

Once the runner is set up:

1. ✅ Create test PRs to verify it works
2. ✅ Adjust the review thresholds in the script if needed
3. ✅ Consider adding auto-fix capabilities (ask AI to apply fixes automatically)
4. ✅ Set up VS Code integration for real-time suggestions (coming next!)

---

Questions? Check the logs:

```bash
# Runner logs
journalctl -u actions.runner.* -f

# Ollama logs
journalctl -u ollama -f

# Workflow logs
# Go to GitHub > Actions tab > Click on the workflow run
```
