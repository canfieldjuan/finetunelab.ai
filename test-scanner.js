/**
 * Test scanner to debug HuggingFace model detection
 */

const fs = require('fs').promises;
const path = require('path');

const AI_MODELS_PATH = path.join(__dirname, '..', 'AI_Models', 'huggingface_models');

async function testScan() {
  console.log('Testing scanner on:', AI_MODELS_PATH);
  console.log('');

  const dirs = await fs.readdir(AI_MODELS_PATH, { withFileTypes: true });
  
  for (const dir of dirs.filter(d => d.isDirectory())) {
    const dirPath = path.join(AI_MODELS_PATH, dir.name);
    console.log(`\n=== ${dir.name} ===`);
    
    // Check root level
    const rootFiles = await fs.readdir(dirPath);
    const hasConfigRoot = rootFiles.includes('config.json');
    const hasWeightsRoot = rootFiles.some(f => f.endsWith('.safetensors') || f.endsWith('.bin'));
    console.log(`  Root: config=${hasConfigRoot}, weights=${hasWeightsRoot}`);
    
    // Check snapshots
    const snapshotsPath = path.join(dirPath, 'snapshots');
    try {
      const snapshots = await fs.readdir(snapshotsPath, { withFileTypes: true });
      const snapshotDirs = snapshots.filter(s => s.isDirectory());
      
      if (snapshotDirs.length > 0) {
        const hashDir = snapshotDirs[0].name;
        const hashPath = path.join(snapshotsPath, hashDir);
        const hashFiles = await fs.readdir(hashPath);
        const hasConfigHash = hashFiles.includes('config.json');
        const hasWeightsHash = hashFiles.some(f => f.endsWith('.safetensors') || f.endsWith('.bin'));
        console.log(`  Snapshots/${hashDir.substring(0, 8)}...: config=${hasConfigHash}, weights=${hasWeightsHash}`);
        console.log(`    Depth: huggingface_models(0) → ${dir.name}(1) → snapshots(2) → ${hashDir}(3)`);
      }
    } catch (e) {
      console.log(`  No snapshots directory`);
    }
  }
}

testScan().catch(console.error);
