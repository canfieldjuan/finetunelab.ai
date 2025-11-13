# Cloud Deployment Wizard - Testing Guide

**Date:** 2025-11-01  
**Component:** CloudDeploymentWizard.tsx  
**Status:** Implementation Complete - Ready for Testing

---

## 🧪 Test Environment Setup

### Prerequisites:
1. Web UI running on development server
2. Supabase authentication configured
3. API credentials in Secrets Vault:
   - Kaggle API key
   - RunPod API token
   - HuggingFace token
4. Test training configuration created
5. Browser: Chrome/Edge/Firefox (latest)

### Quick Start:
```bash
# Navigate to web UI directory
cd C:\Users\Juan\Desktop\Dev_Ops\web-ui

# Start development server
npm run dev

# Open browser to http://localhost:3000/training
```

---

## ✅ Test Cases

### Test Suite 1: Basic Navigation

#### TC1.1: Access Cloud Wizard
**Steps:**
1. Navigate to Training page
2. Go to "Training Configs" tab
3. Select an existing training configuration
4. Click "Cloud Training" tab

**Expected:**
- Cloud Deployment Wizard displays
- Step indicator shows "1. Platform"
- Three platform options visible (Kaggle, HuggingFace, RunPod)

**Status:** ⬜ Not Tested

---

#### TC1.2: Platform Selection
**Steps:**
1. Complete TC1.1
2. Click on "Kaggle Notebooks" option

**Expected:**
- Step indicator advances to "2. Configure"
- Kaggle configuration form appears
- "Notebook Title" input field visible
- Alert about free T4 GPU limits displayed

**Status:** ⬜ Not Tested

---

#### TC1.3: Back Navigation
**Steps:**
1. Complete TC1.2
2. Click "Back" button

**Expected:**
- Returns to Step 1 (Platform Selection)
- Step indicator shows "1. Platform"
- Platform selection cards visible again

**Status:** ⬜ Not Tested

---

### Test Suite 2: Kaggle Deployment

#### TC2.1: Kaggle Configuration - Default Values
**Steps:**
1. Select Kaggle platform
2. Leave "Notebook Title" empty
3. Click "Continue to Review"

**Expected:**
- Step advances to "3. Review & Deploy"
- TimeEstimationCard displays
- Configuration summary shows "Notebook: Auto-generated"

**Status:** ⬜ Not Tested

---

#### TC2.2: Kaggle Configuration - Custom Title
**Steps:**
1. Select Kaggle platform
2. Enter "Test Training Notebook" in "Notebook Title"
3. Click "Continue to Review"

**Expected:**
- Configuration summary shows "Notebook: Test Training Notebook"

**Status:** ⬜ Not Tested

---

#### TC2.3: Kaggle Deployment Success
**Steps:**
1. Complete TC2.2
2. Click "Deploy Now" button

**Expected:**
- Step changes to deploying state
- Loading spinner with "Deploying to Kaggle Notebooks..."
- After 1-2 minutes: Success state appears
- Green checkmark icon
- "Open Training Dashboard" button visible
- Deployment ID displayed

**Status:** ⬜ Not Tested

---

#### TC2.4: Open Kaggle Notebook
**Steps:**
1. Complete TC2.3
2. Click "Open Training Dashboard" button

**Expected:**
- New browser tab opens
- Kaggle notebook URL loads
- Notebook contains training code

**Status:** ⬜ Not Tested

---

### Test Suite 3: RunPod Deployment

#### TC3.1: RunPod Configuration - GPU Selection
**Steps:**
1. Select RunPod platform
2. Click GPU Type dropdown
3. Select "NVIDIA A100 PCIe (40GB) - $1.89/hr"

**Expected:**
- GPU type updates to A100_PCIE
- Dropdown shows selected GPU

**Status:** ⬜ Not Tested

---

#### TC3.2: RunPod Configuration - Budget Limit
**Steps:**
1. Complete TC3.1
2. Enter "25.00" in Budget Limit field
3. Click "Continue to Review"

**Expected:**
- Configuration summary shows "GPU: A100_PCIE"
- Configuration summary shows "Budget Limit: $25.00"
- TimeEstimationCard displays

**Status:** ⬜ Not Tested

---

#### TC3.3: RunPod Deployment Success
**Steps:**
1. Complete TC3.2
2. Click "Deploy Now"

**Expected:**
- Deploying state shows
- Success state appears after deployment
- Pod URL available
- Deployment ID (pod_id) displayed

**Status:** ⬜ Not Tested

---

### Test Suite 4: HuggingFace Deployment

#### TC4.1: HuggingFace Configuration - All Fields
**Steps:**
1. Select HuggingFace Spaces platform
2. Enter "my-training-space-test" in Space Name
3. Select "A10G Small - $3.15/hr" in GPU Tier
4. Enter "15.00" in Budget Limit
5. Click "Continue to Review"

**Expected:**
- Configuration summary shows all values:
  * Space: my-training-space-test
  * GPU Tier: a10g-small
  * Budget Limit: $15.00

**Status:** ⬜ Not Tested

---

#### TC4.2: HuggingFace Configuration - Default Space Name
**Steps:**
1. Select HuggingFace platform
2. Leave Space Name empty
3. Select GPU tier and budget
4. Click "Continue to Review"

**Expected:**
- Configuration summary shows "Space: Auto-generated"

**Status:** ⬜ Not Tested

---

#### TC4.3: HuggingFace Deployment Success
**Steps:**
1. Complete TC4.1
2. Click "Deploy Now"

**Expected:**
- Deployment succeeds
- Space URL displayed
- Can open HuggingFace Space in new tab

**Status:** ⬜ Not Tested

---

### Test Suite 5: Error Handling

#### TC5.1: Authentication Error
**Steps:**
1. Log out from Supabase
2. Attempt to deploy to any platform

**Expected:**
- Error state appears
- Error message: "Please log in to deploy to cloud platforms"
- "Go Back" and "Try Again" buttons visible

**Status:** ⬜ Not Tested

---

#### TC5.2: Missing API Credentials
**Steps:**
1. Remove Kaggle API key from Secrets Vault
2. Attempt Kaggle deployment

**Expected:**
- Error state appears
- Error message indicates missing credentials
- Can retry after adding credentials

**Status:** ⬜ Not Tested

---

#### TC5.3: Network Error
**Steps:**
1. Disconnect internet
2. Attempt deployment

**Expected:**
- Error state appears
- Helpful error message
- Can retry after reconnecting

**Status:** ⬜ Not Tested

---

#### TC5.4: Error Recovery - Retry
**Steps:**
1. Trigger any error (e.g., TC5.1)
2. Fix the issue (log in)
3. Click "Try Again" button

**Expected:**
- Deployment re-attempts
- Success state appears if issue resolved

**Status:** ⬜ Not Tested

---

#### TC5.5: Error Recovery - Back Navigation
**Steps:**
1. Trigger any error
2. Click "Go Back" button

**Expected:**
- Returns to review step
- Error clears
- Can modify configuration

**Status:** ⬜ Not Tested

---

### Test Suite 6: Time Estimation Card Integration

#### TC6.1: Cost Estimation Display
**Steps:**
1. Select any platform
2. Configure settings
3. Proceed to review step

**Expected:**
- TimeEstimationCard visible
- Shows GPU selection dropdown
- Shows estimated training time
- Shows estimated cost
- Shows budget warnings if applicable

**Status:** ⬜ Not Tested

---

#### TC6.2: Budget Exceeded Warning
**Steps:**
1. Select RunPod with A100 GPU
2. Set budget limit to $5.00
3. Proceed to review with large dataset

**Expected:**
- TimeEstimationCard shows budget exceeded warning
- Warning highlights cost vs. budget
- Recommends lower GPU tier or smaller dataset

**Status:** ⬜ Not Tested

---

### Test Suite 7: UI/UX Verification

#### TC7.1: Step Indicator Accuracy
**Steps:**
1. Go through all wizard steps
2. Observe step indicator

**Expected:**
- Step 1: "Platform" highlighted
- Step 2: "Configure" highlighted
- Step 3: "Review & Deploy" highlighted
- Active step has primary color, others muted

**Status:** ⬜ Not Tested

---

#### TC7.2: Platform Badges Display
**Steps:**
1. View platform selection step

**Expected:**
- Kaggle shows "Free" badge
- HuggingFace shows "Popular" badge
- RunPod shows "Flexible" badge

**Status:** ⬜ Not Tested

---

#### TC7.3: Pricing Information
**Steps:**
1. View platform selection step

**Expected:**
- Kaggle: "$0/hour - 30 hours/week free"
- HuggingFace: "$0.60-4.13/hour depending on GPU tier"
- RunPod: "$0.59-5.49/hour with per-second billing"

**Status:** ⬜ Not Tested

---

#### TC7.4: Platform Descriptions
**Steps:**
1. View platform selection

**Expected:**
- Kaggle: "Free T4 GPUs with 30 hours/week limit. Great for learning and experimentation."
- HuggingFace: "Managed GPU infrastructure with excellent model hub integration."
- RunPod: "Pay-per-second serverless GPUs with auto-scaling and budget controls."

**Status:** ⬜ Not Tested

---

### Test Suite 8: Alternative Workflows

#### TC8.1: Colab/Gist Package Generator Still Available
**Steps:**
1. Select a config
2. Go to Cloud tab
3. Scroll down past wizard

**Expected:**
- Section titled "Alternative: Generate Colab/Gist Package"
- PackageGenerator component visible
- Can still generate traditional packages

**Status:** ⬜ Not Tested

---

#### TC8.2: Local Tab Unchanged
**Steps:**
1. Select a config
2. Click "Local Training" tab

**Expected:**
- LocalPackageDownloader component displays
- No wizard interface
- Simple download functionality works

**Status:** ⬜ Not Tested

---

### Test Suite 9: Responsive Design

#### TC9.1: Desktop View (1920x1080)
**Steps:**
1. Open wizard on desktop
2. Test all steps

**Expected:**
- Clean layout, no overflow
- Platform cards fit comfortably
- Forms are readable

**Status:** ⬜ Not Tested

---

#### TC9.2: Tablet View (768x1024)
**Steps:**
1. Resize browser to tablet size
2. Test all steps

**Expected:**
- Layout adjusts gracefully
- Buttons remain accessible
- Forms are usable

**Status:** ⬜ Not Tested

---

#### TC9.3: Mobile View (375x667)
**Steps:**
1. Resize browser to mobile size
2. Test all steps

**Expected:**
- Platform cards stack vertically
- Forms are touch-friendly
- Navigation buttons accessible

**Status:** ⬜ Not Tested

---

### Test Suite 10: Backward Compatibility

#### TC10.1: TrainingWorkflow Integration
**Steps:**
1. Go through config creation flow
2. Select config
3. Verify wizard appears

**Expected:**
- TrainingWorkflow still works
- UnifiedPackageGenerator renders correctly
- No console errors

**Status:** ⬜ Not Tested

---

#### TC10.2: Multiple Deployments
**Steps:**
1. Complete one deployment successfully
2. Click "Deploy Another Job"
3. Select different platform
4. Complete deployment

**Expected:**
- Wizard resets cleanly
- Can deploy multiple times
- No state contamination between deployments

**Status:** ⬜ Not Tested

---

## 🐛 Bug Report Template

When you find a bug, use this template:

```markdown
### Bug Report

**Test Case:** TC#.# - Test Name
**Severity:** Critical | High | Medium | Low
**Environment:** Browser, OS, Screen Size

**Steps to Reproduce:**
1. Step 1
2. Step 2
3. ...

**Expected Behavior:**
What should happen

**Actual Behavior:**
What actually happened

**Screenshots/Logs:**
Attach screenshots or console logs

**Additional Context:**
Any other relevant information
```

---

## 📊 Test Results Summary

| Test Suite | Total Tests | Passed | Failed | Skipped | Status |
|------------|-------------|---------|--------|---------|--------|
| Basic Navigation | 3 | 0 | 0 | 0 | ⬜ Not Started |
| Kaggle Deployment | 4 | 0 | 0 | 0 | ⬜ Not Started |
| RunPod Deployment | 3 | 0 | 0 | 0 | ⬜ Not Started |
| HuggingFace Deployment | 3 | 0 | 0 | 0 | ⬜ Not Started |
| Error Handling | 5 | 0 | 0 | 0 | ⬜ Not Started |
| Time Estimation | 2 | 0 | 0 | 0 | ⬜ Not Started |
| UI/UX Verification | 4 | 0 | 0 | 0 | ⬜ Not Started |
| Alternative Workflows | 2 | 0 | 0 | 0 | ⬜ Not Started |
| Responsive Design | 3 | 0 | 0 | 0 | ⬜ Not Started |
| Backward Compatibility | 2 | 0 | 0 | 0 | ⬜ Not Started |
| **TOTAL** | **31** | **0** | **0** | **0** | ⬜ Not Started |

---

## 🔍 Console Logging Verification

The wizard includes extensive logging for debugging. Check browser console for:

```
[CloudDeploymentWizard] Component loaded
[CloudDeploymentWizard] Rendered for config: <config-name>
[CloudDeploymentWizard] Platform selected: kaggle
[CloudDeploymentWizard] Starting deployment to: kaggle
[CloudDeploymentWizard] Deployment successful: {...}
[CloudDeploymentWizard] Deployment error: <error-message>
```

---

## ✅ Acceptance Criteria

Before marking implementation as complete, verify:

- [ ] All critical tests pass (TC1.1, TC2.3, TC3.3, TC4.3)
- [ ] No TypeScript errors in console
- [ ] No React warnings in console
- [ ] Error handling works for all failure scenarios
- [ ] Backward compatibility confirmed (existing flows work)
- [ ] UI is clean and uncluttered
- [ ] TimeEstimationCard only shows in review step
- [ ] DeploymentTargetSelector logic moved into wizard
- [ ] Local tab remains simple and functional
- [ ] Documentation is accurate

---

## 🚀 Testing Priorities

### Priority 1 (MUST TEST):
- TC1.1: Access Cloud Wizard
- TC2.3: Kaggle Deployment Success
- TC5.1: Authentication Error
- TC10.1: TrainingWorkflow Integration

### Priority 2 (SHOULD TEST):
- TC3.3: RunPod Deployment Success
- TC4.3: HuggingFace Deployment Success
- TC5.4: Error Recovery - Retry
- TC8.2: Local Tab Unchanged

### Priority 3 (NICE TO TEST):
- TC7.1: Step Indicator Accuracy
- TC9.1: Desktop View
- TC10.2: Multiple Deployments

---

## 📝 Notes for Tester

1. **API Credentials Required:** Make sure all platform API keys are in Secrets Vault before testing deployments
2. **Real Deployments:** Test cases 2.3, 3.3, 4.3 will create actual cloud resources (may incur costs)
3. **Network Required:** Most tests require internet connection
4. **Browser DevTools:** Keep console open to see logging and catch errors
5. **Screenshots:** Take screenshots of success/error states for documentation

---

**Next Steps:**
1. Start development server
2. Run Priority 1 tests
3. Document any bugs found
4. Fix issues and re-test
5. Run Priority 2 and 3 tests
6. Mark implementation as production-ready

