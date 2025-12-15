# 🎯 Quick Screenshot Capture Guide

## ⚡ Fast Track (Manual Capture)

Since you already have the app running at localhost:3000, here's the fastest way to get screenshots:

---

### 🛠️ Tools You Need

**Linux Screenshot Tools:**
```bash
# Install Flameshot (recommended - best for annotations)
sudo apt install flameshot

# Or use built-in GNOME Screenshot
# Press PrtScn key or use gnome-screenshot command
```

**Quick Keys:**
- `PrtScn` - Full screen
- `Shift + PrtScn` - Select area
- `Alt + PrtScn` - Current window

---

### 📸 Screenshot Checklist

#### 1️⃣ Training Predictions Dashboard
**URL:** `http://localhost:3000/training`

**What to capture:**
- [ ] Live training metrics (loss curve, GPU usage)
- [ ] Prediction samples table (showing actual outputs)
- [ ] Cost tracker
- [ ] Training progress bar

**Tips:**
- Show a training job in progress (or mocked data)
- Highlight the "Predictions" section
- Make sure metrics are visible

**Filename:** `1-training-predictions.png`

---

#### 2️⃣ Batch Testing Analytics
**URL:** `http://localhost:3000/testing`

**What to capture:**
- [ ] Success/failure metrics
- [ ] Category breakdown chart
- [ ] Latency distribution (p50, p95, p99)
- [ ] Test results table

**Tips:**
- Show completed test run with analytics
- Highlight comparison metrics
- Include charts/graphs

**Filename:** `2-batch-testing.png`

---

#### 3️⃣ Production Monitoring
**URL:** `http://localhost:3000/models`

**What to capture:**
- [ ] Request logs table
- [ ] Latency trend chart
- [ ] Cost per request metrics
- [ ] Model status (active/deployed)

**Tips:**
- Click into a deployed model to see monitoring
- Show real-time request data
- Include cost breakdown

**Filename:** `3-production-monitoring.png`

---

#### 4️⃣ Analytics Dashboard
**URL:** `http://localhost:3000/analytics`

**What to capture:**
- [ ] Overview metrics (total requests, models, etc)
- [ ] Performance charts
- [ ] Usage trends
- [ ] Platform statistics

**Tips:**
- Show high-level platform analytics
- Include multiple chart types
- Make data look impressive

**Filename:** `4-analytics-dashboard.png`

---

#### 5️⃣ Model Comparison (Optional)
**URL:** `http://localhost:3000/demo/comparison`

**What to capture:**
- [ ] Side-by-side comparison UI
- [ ] Model A vs Model B responses
- [ ] Performance metrics comparison
- [ ] Preference selection

**Tips:**
- Show actual comparison with different outputs
- Highlight metric differences
- Show blind testing UI

**Filename:** `5-model-comparison.png`

---

#### 6️⃣ Full Workflow Overview
**URL:** `http://localhost:3000/welcome` or home page

**What to capture:**
- [ ] Platform overview/welcome screen
- [ ] Feature highlights
- [ ] Navigation structure
- [ ] Clean, professional landing

**Tips:**
- Show the "getting started" experience
- Include value propositions
- Clean, uncluttered view

**Filename:** `6-full-workflow.png`

---

## 🎨 Post-Processing Quick Guide

### Option 1: Online Tools (Fastest)
1. **Canva.com** (Free)
   - Upload screenshot
   - Add text overlay: "Live Training Predictions" etc
   - Download as PNG

2. **TinyPNG.com** (Free)
   - Upload to compress
   - Reduces file size by 60-80%

---

### Option 2: Command Line (Linux)

**Install ImageMagick:**
```bash
sudo apt install imagemagick
```

**Add text overlay:**
```bash
convert input.png \
  -gravity south \
  -fill white \
  -stroke black \
  -strokewidth 2 \
  -pointsize 48 \
  -annotate +0+30 "Live Training Predictions" \
  output.png
```

**Compress images:**
```bash
# Create gallery directory
mkdir -p product-hunt-assets/gallery

# Compress all screenshots
mogrify -path product-hunt-assets/gallery/ \
  -resize 1920x1080 \
  -quality 85 \
  product-hunt-assets/raw/*.png
```

---

## 🎯 Hero Image Creation

**Requirements:**
- Dimensions: **1270x760px**
- Format: PNG
- Max size: 5MB

### Quick Canva Template

1. Go to Canva.com
2. Create custom size: 1270 x 760
3. Choose dark background (#0f172a)
4. Upload 2-3 best screenshots
5. Arrange in grid or overlap
6. Add text:
   - **"Finetune Lab"** (top, large)
   - **"Monitor Models From Training to Production"** (center)
   - **Icons:** 🔬 Training | 🧪 Testing | 📈 Production
7. Download as PNG

---

### Figma Template (If you prefer)

```
Frame: 1270 x 760
Background: Linear gradient (#0f172a → #1e293b)

Layout:
┌─────────────────────────────────────────────────┐
│  FINETUNE LAB                           [GitHub ⭐] │
├─────────────────────────────────────────────────┤
│                                                   │
│         Monitor Models From Training             │
│              to Production                        │
│                                                   │
│  🔬 Training  |  🧪 Testing  |  📈 Production    │
│                                                   │
│  ┌──────────────┐        ┌──────────────┐       │
│  │ Training     │        │ Production   │       │
│  │ Dashboard    │        │ Monitoring   │       │
│  │ Screenshot   │        │ Screenshot   │       │
│  └──────────────┘        └──────────────┘       │
│                                                   │
│         [Try Demo]  [GitHub →]                   │
└─────────────────────────────────────────────────┘
```

---

## ✅ Quality Checklist

Before uploading to Product Hunt:

### Image Quality
- [ ] High resolution (min 1920x1080 source)
- [ ] Clean, professional appearance
- [ ] No pixelation or blur
- [ ] Good contrast (readable text)
- [ ] No personal/sensitive data visible

### Content
- [ ] Shows key features clearly
- [ ] Data looks realistic (not empty states)
- [ ] UI is clean (no debug panels)
- [ ] Dark mode enabled (looks better)
- [ ] Consistent branding/colors

### File Specs
- [ ] Hero: 1270x760px, PNG, < 5MB
- [ ] Gallery: Any size, maintain 16:9, < 1MB each
- [ ] Filenames descriptive
- [ ] All files in organized folder

---

## 🚀 Upload Order

1. **Hero image first** - This shows in feed
2. **Gallery images** - Order matters (best first):
   - Training predictions (unique feature)
   - Batch testing (validation)
   - Production monitoring (long-term value)
   - Analytics dashboard
   - Model comparison
   - Full workflow

---

## 💡 Pro Tips

1. **Use real data** - Mock data looks fake
2. **Show activity** - Active jobs, recent logs
3. **Highlight uniqueness** - Training predictions = differentiator
4. **Dark mode** - Looks more professional for dev tools
5. **Clean browser** - Close unnecessary tabs/extensions
6. **Zoom 100%** - Avoid scaling artifacts
7. **Fullscreen (F11)** - Removes browser chrome
8. **Annotations** - Add arrows/highlights sparingly

---

## 🎬 Demo Video Alternative

If screenshots aren't impressive enough, record a quick video:

**Linux Screen Recording:**
```bash
# Install SimpleScreenRecorder
sudo apt install simplescreenrecorder

# Or use OBS Studio
sudo apt install obs-studio
```

**Video Specs:**
- Length: 30-60 seconds (max 2 minutes)
- Resolution: 1920x1080
- Format: MP4
- Show: Upload → Train (predictions) → Deploy → Monitor
- Upload to YouTube, embed link in Product Hunt

---

## 📁 File Structure

```
product-hunt-assets/
├── hero-image.png (1270x760)
├── gallery/
│   ├── 1-training-predictions.png
│   ├── 2-batch-testing.png
│   ├── 3-production-monitoring.png
│   ├── 4-analytics-dashboard.png
│   ├── 5-model-comparison.png
│   └── 6-full-workflow.png
└── raw/ (unedited originals)
    └── (backup copies)
```

---

## ⏭️ After Screenshots

1. Review `PRODUCT_HUNT_ASSETS.md` for copy
2. Create Product Hunt account (if needed)
3. Draft submission (save as draft)
4. Schedule for Thursday 12:01 AM PST
5. Prepare first comment (see PRODUCT_HUNT_ASSETS.md)

---

**Ready to capture? Open Chrome at localhost:3000 and start screenshotting! 📸**

Need help with any step? Just ask!
