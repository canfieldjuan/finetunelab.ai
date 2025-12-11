/**
 * Test TrainingPackageWizard Tab Integration
 * Run with: node test-wizard-tab-integration.js
 *
 * Verifies that:
 * 1. Training page imports TrainingPackageWizard
 * 2. New "training-packages" tab trigger exists
 * 3. TabsContent renders TrainingPackageWizard component
 * 4. Proper props are passed to wizard
 * 5. Backward compatibility maintained (all existing tabs still there)
 */

const fs = require('fs');
const path = require('path');

console.log('Testing TrainingPackageWizard Tab Integration...\n');

let hasErrors = false;

try {
  // Test 1: Verify training page file exists
  console.log('1. Checking training page exists...');
  const trainingPagePath = path.join(__dirname, 'app', 'training', 'page.tsx');
  if (!fs.existsSync(trainingPagePath)) {
    throw new Error('Training page not found');
  }
  const pageContent = fs.readFileSync(trainingPagePath, 'utf8');
  console.log('✓ Training page exists\n');

  // Test 2: Verify TrainingPackageWizard import
  console.log('2. Verifying TrainingPackageWizard import...');
  if (!pageContent.includes(`import { TrainingPackageWizard } from '@/components/training/workflow/TrainingPackageWizard'`)) {
    throw new Error('TrainingPackageWizard not imported');
  }
  console.log('✓ TrainingPackageWizard imported correctly\n');

  // Test 3: Verify new tab trigger exists
  console.log('3. Checking for new tab trigger...');
  if (!pageContent.includes('value="training-packages"')) {
    throw new Error('training-packages tab trigger not found');
  }
  if (!pageContent.includes('Training Package Wizard')) {
    throw new Error('Tab label "Training Package Wizard" not found');
  }
  console.log('✓ New tab trigger added\n');

  // Test 4: Verify TabsContent for training-packages
  console.log('4. Verifying TabsContent for training-packages...');
  if (!pageContent.includes('<TabsContent value="training-packages"')) {
    throw new Error('TabsContent for training-packages not found');
  }
  if (!pageContent.includes('<TrainingPackageWizard')) {
    throw new Error('TrainingPackageWizard component not rendered in TabsContent');
  }
  console.log('✓ TabsContent properly configured\n');

  // Test 5: Verify required props are passed
  console.log('5. Checking TrainingPackageWizard props...');
  const requiredProps = [
    'sessionToken={session?.access_token}',
    'onComplete=',
    'onCancel=',
    'onAutoSave='
  ];

  requiredProps.forEach(prop => {
    if (!pageContent.includes(prop)) {
      throw new Error(`Missing required prop: ${prop}`);
    }
  });
  console.log('✓ All required props passed\n');

  // Test 6: Verify backward compatibility - all existing tabs still there
  console.log('6. Verifying backward compatibility...');
  const existingTabs = [
    'value="configs"',
    'value="public-packages"',
    'value="datasets"',
    'value="batch-testing"',
    'value="regression-gates"'
  ];

  existingTabs.forEach(tab => {
    if (!pageContent.includes(tab)) {
      throw new Error(`Existing tab removed: ${tab}`);
    }
  });
  console.log('✓ All existing tabs maintained\n');

  // Test 7: Verify tab order
  console.log('7. Checking tab order...');
  const configsIndex = pageContent.indexOf('value="configs"');
  const wizardIndex = pageContent.indexOf('value="training-packages"');
  const publicIndex = pageContent.indexOf('value="public-packages"');

  if (wizardIndex < configsIndex) {
    throw new Error('Wizard tab should come after configs tab');
  }
  if (wizardIndex > publicIndex) {
    throw new Error('Wizard tab should come before public-packages tab');
  }
  console.log('✓ Tab order is correct (configs → wizard → public-packages)\n');

  // Test 8: Verify no duplicate tabs
  console.log('8. Checking for duplicate tabs...');
  const tabMatches = pageContent.match(/value="training-packages"/g);
  if (tabMatches && tabMatches.length !== 2) {
    throw new Error(`Expected 2 occurrences of training-packages (TabsTrigger + TabsContent), found ${tabMatches?.length || 0}`);
  }
  console.log('✓ No duplicate tabs (1 trigger + 1 content)\n');

  // Test 9: Verify TrainingPackageWizard component file exists
  console.log('9. Verifying TrainingPackageWizard component exists...');
  const wizardPath = path.join(__dirname, 'components', 'training', 'workflow', 'TrainingPackageWizard.tsx');
  if (!fs.existsSync(wizardPath)) {
    throw new Error('TrainingPackageWizard.tsx not found');
  }
  const wizardContent = fs.readFileSync(wizardPath, 'utf8');
  if (!wizardContent.includes('export function TrainingPackageWizard')) {
    throw new Error('TrainingPackageWizard component not exported');
  }
  console.log('✓ TrainingPackageWizard component exists and is exported\n');

  // Test 10: Verify Step1ModelSelection integration
  console.log('10. Verifying Step1ModelSelection integration...');
  if (!wizardContent.includes('Step1ModelSelection')) {
    throw new Error('Step1ModelSelection not imported in wizard');
  }
  if (!wizardContent.includes('<Step1ModelSelection')) {
    throw new Error('Step1ModelSelection not rendered in wizard');
  }
  console.log('✓ Step1ModelSelection properly integrated\n');

  console.log('✅ All integration tests passed!');
  console.log('\nIntegration Summary:');
  console.log('- TrainingPackageWizard imported in training page ✓');
  console.log('- New "Training Package Wizard" tab added ✓');
  console.log('- Tab positioned between "Training Configs" and "Public Packages" ✓');
  console.log('- All required props passed to wizard ✓');
  console.log('- Backward compatibility maintained ✓');
  console.log('- Step1ModelSelection integrated in wizard ✓');
  console.log('\nNext Steps:');
  console.log('1. Start Next.js dev server: npm run dev');
  console.log('2. Navigate to: http://localhost:3000/training');
  console.log('3. Click on "Training Package Wizard" tab');
  console.log('4. Verify model selection interface appears');
  console.log('5. Test model selection functionality');

} catch (error) {
  console.error('❌ Test failed:', error.message);
  if (error.stack) {
    console.error(error.stack);
  }
  process.exit(1);
}
