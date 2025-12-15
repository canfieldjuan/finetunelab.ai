# 🎨 Product Hunt Assets Guide

## Required Assets

### 1. Hero Image (Required)
- **Dimensions:** 1270x760px
- **Format:** PNG or JPG
- **Max Size:** 5MB

**Design Requirements:**
- Clean, professional, high-contrast
- Show the product in action
- Include tagline/value prop
- Mobile mockup optional

**Recommended Content:**
- Split screen: Training dashboard (left) + Production monitoring (right)
- Overlay text: "Monitor Models From Training to Production"
- Subtle background: Gradient or dashboard blur

---

### 2. Gallery Images (4-6 screenshots)
**Dimensions:** Any, but maintain consistent aspect ratio (16:9 recommended)

#### Screenshot 1: Training Predictions
**Title:** "Live Training Predictions"
**Content:** Training dashboard showing:
- Real-time loss curve
- Live model predictions table (epoch by epoch)
- GPU metrics
- Cost tracker

**Overlay Text:** "See outputs WHILE training - catch problems early"

---

#### Screenshot 2: Batch Testing Analytics
**Title:** "Batch Testing & Validation"
**Content:** Analytics dashboard showing:
- Overall accuracy chart
- Category breakdown
- Latency distribution (p50, p95, p99)
- Success/failure metrics

**Overlay Text:** "Test 100+ prompts - deploy with confidence"

---

#### Screenshot 3: Production Monitoring
**Title:** "Production Request Monitoring"
**Content:** Production dashboard showing:
- Request timeline
- Latency trends
- Cost per request
- Quality metrics

**Overlay Text:** "Track every production request - detect drift early"

---

#### Screenshot 4: Model Comparison (A/B Testing)
**Title:** "A/B Model Comparison"
**Content:** Side-by-side comparison showing:
- Baseline vs fine-tuned responses
- Performance metrics comparison
- Preference tracking

**Overlay Text:** "Compare models objectively with blind testing"

---

#### Screenshot 5: Cost Tracking
**Title:** "Real-Time Cost Monitoring"
**Content:** Cost dashboard showing:
- Current spend
- Cost per hour
- Budget limit progress bar
- Auto-stop alerts

**Overlay Text:** "Never wake up to surprise bills"

---

#### Screenshot 6: Full Workflow
**Title:** "Complete MLOps Pipeline"
**Content:** Multi-panel view showing:
- Dataset upload
- Training configuration
- Live monitoring
- One-click deployment

**Overlay Text:** "From dataset to production in 10 minutes"

---

## 🎬 Creating the Assets

### Quick Method (Use Actual Product)
```bash
# 1. Start the app
npm run dev

# 2. Navigate to each feature
- /training - Get training dashboard screenshot
- /batch-testing - Get batch testing screenshot
- /models - Get production monitoring screenshot
- /analytics - Get analytics screenshot

# 3. Use browser full-screen mode (F11)
# 4. Zoom to 100%
# 5. Screenshot tool:
   - Linux: Flameshot, Shutter, GNOME Screenshot
   - Mac: Cmd+Shift+4
   - Windows: Snipping Tool

# 6. Edit screenshots
   - Add overlay text (bold, white with dark shadow)
   - Crop to focus area
   - Enhance contrast if needed
```

---

### Design Tool Method (Figma/Canva)

**Hero Image Template:**
```
Background: Dark gradient (#0f172a → #1e293b)
Main Content: 
  - Left 50%: Training dashboard mockup
  - Right 50%: Production monitoring mockup
Center Text:
  - "Finetune Lab"
  - "Monitor Models From Training to Production"
  - Icons: 🔬 Training | 🧪 Testing | 📈 Production
```

**Canva Template Structure:**
1. Use "Presentation (16:9)" template
2. Set dimensions to 1270x760
3. Import screenshots
4. Add dark overlay (opacity 20%)
5. Add white text with shadow
6. Export as PNG (high quality)

---

## 📝 Product Hunt Copy

### Title
**"Finetune Lab - MLOps with lifetime monitoring, not just deployment"**

Alternative titles:
- "Finetune Lab - Monitor models from training to production"
- "Finetune Lab - The only MLOps platform that monitors forever"

---

### Tagline (60 chars max)
**"Train once. Monitor forever. MLOps done right."**

Alternatives:
- "Fine-tuning + monitoring in one platform"
- "MLOps that actually monitors your models"

---

### Description (260 chars max - Twitter length)
**"The only MLOps platform that monitors models through their entire lifecycle: live training predictions, batch testing analytics, and production monitoring. Fine-tuning happens once. Monitoring lasts forever. Open source & self-hosted."**

---

### First Comment (Critical!)
```markdown
Hey Product Hunt! 👋

I built Finetune Lab after watching teams deploy models blindly and discover issues weeks later.

**The Problem:**
- Train for 6 hours → Model outputs garbage → Start over ($200 wasted)
- Deploy to production → Performance degrades → Discover 3 weeks later
- No way to validate models objectively before deployment

**The Solution: Monitoring at Every Stage**

🔬 **During Training**
- Live predictions (see actual outputs while training)
- Real-time metrics (loss, GPU, cost)
- Catch problems at epoch 2, not epoch 10

🧪 **Before Deployment**
- Batch testing (100+ prompts)
- Baseline vs fine-tuned comparison
- Category-level analytics
- Regression detection gates

📈 **In Production**
- Per-request logging (latency, cost, quality)
- Drift detection
- Budget alerts
- Auto-scaling metrics

**Why This Matters:**
Fine-tuning is a one-time event (hours/days).
Monitoring is continuous (weeks/months/years).

Most platforms stop at deployment.
We're just getting started.

**Tech Stack:**
Next.js 14, Supabase, Unsloth, vLLM, RunPod API
100% open source, self-hosted or cloud

**Try it:** [demo link]
**GitHub:** [repo link]
**Docs:** [docs link]

Happy to answer any questions! 🚀
```

---

### Topics/Tags (3-5 tags)
- Developer Tools
- Artificial Intelligence
- Machine Learning
- Open Source
- Analytics

---

### Links Section
- Website: https://finetunelab.ai
- GitHub: https://github.com/canfieldjuan/finetunelab.ai
- Demo: https://finetunelab.ai/demo
- Docs: https://finetunelab.ai/docs
- Twitter: https://twitter.com/finetunelab (if created)

---

## 🎯 Screenshot Capture Checklist

### Before Screenshots
- [ ] Clean browser (close unnecessary tabs)
- [ ] Full-screen mode (F11)
- [ ] Zoom at 100%
- [ ] Dark mode enabled (if applicable)
- [ ] Remove any personal/sensitive data
- [ ] Ensure dummy data looks realistic

### For Each Screenshot
- [ ] High resolution (at least 1920x1080 source)
- [ ] Focus on key feature
- [ ] No empty states (show data)
- [ ] Good color contrast
- [ ] Clear, readable text
- [ ] Professional appearance

### After Capture
- [ ] Crop to relevant area
- [ ] Add subtle shadow/border if needed
- [ ] Compress without quality loss (TinyPNG)
- [ ] Save in organized folder
- [ ] Name descriptively (training-predictions.png)

---

## 🖼️ File Organization
```
/product-hunt-assets/
  ├── hero-image.png (1270x760)
  ├── gallery/
  │   ├── 1-training-predictions.png
  │   ├── 2-batch-testing.png
  │   ├── 3-production-monitoring.png
  │   ├── 4-model-comparison.png
  │   ├── 5-cost-tracking.png
  │   └── 6-full-workflow.png
  └── demo-video.mp4 (if embedding)
```

---

## 🎬 Demo Video Script (3 minutes)

**0:00-0:15 - Hook**
"Most MLOps platforms help you deploy a model. Then they disappear. But that's when the real problems start."

**0:15-0:45 - Problem**
Show confused developer looking at TensorBoard
"You wait 6 hours for training. Model outputs gibberish. $200 wasted. No way to know what went wrong."

**0:45-1:30 - Solution: Training Predictions**
Screen recording of training dashboard
"Finetune Lab shows you predictions while training. Catch problems at epoch 2, not epoch 10."

**1:30-2:15 - Solution: Batch Testing**
Screen recording of batch testing
"Before deployment, test 100+ prompts. Compare baseline vs fine-tuned. Deploy with confidence."

**2:15-2:45 - Solution: Production Monitoring**
Screen recording of production dashboard
"In production, track every request. Latency, cost, quality. Know when models degrade."

**2:45-3:00 - CTA**
"Fine-tuning happens once. Monitoring lasts forever. Try Finetune Lab."
Show: finetunelab.ai + GitHub star button

---

## 🚀 Upload Checklist

### Product Hunt Submission
- [ ] Hero image uploaded
- [ ] Gallery screenshots uploaded (4-6)
- [ ] Demo video embedded (YouTube link)
- [ ] Title optimized
- [ ] Tagline under 60 chars
- [ ] Description under 260 chars
- [ ] First comment prepared in clipboard
- [ ] Topics/tags selected
- [ ] Links added
- [ ] Maker profile complete
- [ ] Preview looks good on mobile

### Timing
- [ ] Submit at 12:01 AM PST (3:01 AM EST)
- [ ] Set alarm for 11:45 PM PST
- [ ] Have first comment ready to paste
- [ ] Monitor in first 30 minutes for quick replies

---

## 💡 Pro Tips

1. **Hero Image:** Use actual product screenshot, not mockups
2. **Gallery:** Tell a story - show workflow progression
3. **First Comment:** Post within 30 seconds of submission
4. **Video:** Keep under 2 minutes (attention span)
5. **Response Time:** Reply within 2 minutes for first 4 hours
6. **Updates:** Post milestone comments ("100 upvotes!", "200 stars!")
7. **Authenticity:** Be genuine, avoid marketing speak
8. **Preparation:** Have 5-7 response templates ready

---

**CURRENT STATUS: Ready to create assets**
**NEXT STEP: Capture screenshots from running app**
