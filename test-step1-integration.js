/**
 * Test Step1ModelSelection integration
 * Run with: node test-step1-integration.js
 *
 * This verifies that:
 * 1. Step1ModelSelection component file exists
 * 2. TrainingPackageWizard imports Step1ModelSelection
 * 3. Component is integrated in renderStepContent
 */

const fs = require('fs');
const path = require('path');

console.log('Testing Step1ModelSelection Integration...\\n');

let hasErrors = false;

try {
  // Test 1: Verify component file exists
  console.log('1. Checking Step1ModelSelection.tsx exists...');
  const componentPath = path.join(__dirname, 'components', 'training', 'workflow', 'Step1ModelSelection.tsx');
  if (!fs.existsSync(componentPath)) {
    throw new Error('Step1ModelSelection.tsx not found');
  }
  const componentContent = fs.readFileSync(componentPath, 'utf8');
  console.log('✓ Component file exists\\n');

  // Test 2: Verify component exports
  console.log('2. Verifying component exports...');
  if (!componentContent.includes('export function Step1ModelSelection')) {
    throw new Error('Component does not export Step1ModelSelection function');
  }
  console.log('✓ Component exports Step1ModelSelection function\\n');

  // Test 3: Verify imports
  console.log('3. Checking required imports...');
  const requiredImports = [
    '@/lib/config/yaml-loader',
    '@/lib/training/model-browser',
    '@/lib/logging',
    './types',
  ];

  requiredImports.forEach(importPath => {
    if (!componentContent.includes(`from '${importPath}'`)) {
      throw new Error(`Missing import: ${importPath}`);
    }
  });
  console.log('✓ All required imports present\\n');

  // Test 4: Verify component uses services
  console.log('4. Verifying service integration...');
  if (!componentContent.includes('loadComponentConfig')) {
    throw new Error('Component does not use loadComponentConfig');
  }
  if (!componentContent.includes('getPopularModels')) {
    throw new Error('Component does not use getPopularModels');
  }
  if (!componentContent.includes('searchModels')) {
    throw new Error('Component does not use searchModels');
  }
  if (!componentContent.includes('createLogger')) {
    throw new Error('Component does not use createLogger');
  }
  console.log('✓ Component integrates with all services\\n');

  // Test 5: Verify wizard integration
  console.log('5. Checking TrainingPackageWizard integration...');
  const wizardPath = path.join(__dirname, 'components', 'training', 'workflow', 'TrainingPackageWizard.tsx');
  const wizardContent = fs.readFileSync(wizardPath, 'utf8');

  if (!wizardContent.includes(`import { Step1ModelSelection } from './Step1ModelSelection'`)) {
    throw new Error('Wizard does not import Step1ModelSelection');
  }
  console.log('✓ Wizard imports Step1ModelSelection\\n');

  // Test 6: Verify component is used in renderStepContent
  console.log('6. Verifying component usage in wizard...');
  if (!wizardContent.includes('<Step1ModelSelection')) {
    throw new Error('Wizard does not render Step1ModelSelection');
  }
  if (!wizardContent.includes('onComplete={handleStepComplete}')) {
    throw new Error('Wizard does not pass onComplete handler');
  }
  console.log('✓ Component properly integrated in wizard\\n');

  // Test 7: Verify component structure
  console.log('7. Checking component structure...');
  const componentChecks = [
    { name: 'Props interface', pattern: 'interface Step1ModelSelectionProps' },
    { name: 'State management', pattern: 'useState' },
    { name: 'Config loading effect', pattern: 'loadComponentConfig' },
    { name: 'Search effect', pattern: 'searchModels' },
    { name: 'Model selection handler', pattern: 'handleModelSelect' },
    { name: 'Model card rendering', pattern: 'renderModelCard' },
    { name: 'Error handling', pattern: 'error' },
    { name: 'Loading states', pattern: 'isLoadingPopular' },
  ];

  componentChecks.forEach(check => {
    if (!componentContent.includes(check.pattern)) {
      throw new Error(`${check.name} not found (pattern: ${check.pattern})`);
    }
  });
  console.log('✓ Component structure complete\\n');

  // Test 8: Count lines of code
  console.log('8. Code metrics...');
  const lines = componentContent.split('\\n').length;
  console.log(`   Total lines: ${lines}`);
  console.log(`   Target: ~300-400 lines`);
  if (lines < 250 || lines > 500) {
    console.warn(`   ⚠️ Component size outside expected range`);
  } else {
    console.log('✓ Component size looks good\\n');
  }

  // Test 9: Verify no hardcoded values
  console.log('9. Checking for hardcoded values...');
  const suspiciousPatterns = [
    { pattern: /timeout:\s*\d{4,}/, name: 'hardcoded timeout' },
    { pattern: /limit:\s*\d+(?!%)/, name: 'hardcoded limit (check if from config)' },
  ];

  let foundHardcoded = false;
  suspiciousPatterns.forEach(({ pattern, name }) => {
    const matches = componentContent.match(pattern);
    if (matches) {
      // Verify it's from config
      const context = componentContent.substring(
        Math.max(0, componentContent.indexOf(matches[0]) - 100),
        Math.min(componentContent.length, componentContent.indexOf(matches[0]) + 100)
      );
      if (!context.includes('config') && !context.includes('||')) {
        console.warn(`   ⚠️ Possible ${name}: ${matches[0]}`);
        foundHardcoded = true;
      }
    }
  });

  if (!foundHardcoded) {
    console.log('✓ No obvious hardcoded values found\\n');
  }

  console.log('✅ All integration tests passed!');
  console.log('\\nStep1ModelSelection is ready to use.');
  console.log('\\nNext steps:');
  console.log('- Test in browser with Next.js dev server');
  console.log('- Create unit tests for component');
  console.log('- Implement Step2ConfigSelection component');

} catch (error) {
  console.error('❌ Test failed:', error.message);
  if (error.stack) {
    console.error(error.stack);
  }
  process.exit(1);
}
