// Local Training Package Generator
// Generates downloadable zip packages for local LLM training
// Date: 2025-10-22

import { TrainingConfig } from './training-config.types';
import { normalizeForBackend } from './config-builder';
import fs from 'fs/promises';
import path from 'path';
import { createHash } from 'crypto';

console.log('[LocalPackageGenerator] Module loaded');

export interface PackageGenerationOptions {
  configId: string;
  configName: string;
  configJson: TrainingConfig;
  datasetPaths: string[];
  outputDir: string;
  normalizeForBackend?: boolean; // when true, write normalized config.json (top-level lora, etc.)
}

export interface PackageGenerationResult {
  success: boolean;
  packagePath?: string;
  checksum?: string;
  error?: string;
}

console.log('[LocalPackageGenerator] Types defined');

/**
 * Generate SHA-256 checksum for a file
 * @param filePath Path to the file
 * @returns Hexadecimal checksum string
 */
async function generateChecksum(filePath: string): Promise<string> {
  console.log(`[LocalPackageGenerator] Generating checksum for: ${filePath}`);

  try {
    const fileBuffer = await fs.readFile(filePath);
    const hashSum = createHash('sha256');
    hashSum.update(fileBuffer);
    const hex = hashSum.digest('hex');

    console.log(`[LocalPackageGenerator] Checksum generated: ${hex.substring(0, 16)}...`);
    return hex;
  } catch (error) {
    console.error(`[LocalPackageGenerator] Error generating checksum: ${error}`);
    throw error;
  }
}

console.log('[LocalPackageGenerator] Checksum function defined');

/**
 * Copy training module files to package directory
 * Copies standalone_trainer.py, requirements.txt, and README
 * @param packageDir Target package directory
 */
async function copyTrainingFiles(packageDir: string): Promise<void> {
  console.log(`[LocalPackageGenerator] Copying training files to: ${packageDir}`);

  const trainingLibPath = path.join(process.cwd(), 'lib', 'training');
  const filesToCopy = [
    'standalone_trainer.py',
    'requirements.txt',
    'README_TRAINING.md'
  ];

  for (const fileName of filesToCopy) {
    const sourcePath = path.join(trainingLibPath, fileName);
    const destPath = path.join(packageDir, fileName);

    console.log(`[LocalPackageGenerator] Copying: ${fileName}`);
    await fs.copyFile(sourcePath, destPath);
  }

  console.log('[LocalPackageGenerator] Training files copied successfully');
}

console.log('[LocalPackageGenerator] Copy files function defined');

/**
 * Generate train.py entry point script
 * Creates a Python script that loads config and datasets, then runs training
 * @param packageDir Target package directory
 * @param hasDatasets Whether datasets are included in the package
 */
async function generateTrainScript(
  packageDir: string,
  hasDatasets: boolean
): Promise<void> {
  console.log(`[LocalPackageGenerator] Generating train.py script (datasets: ${hasDatasets})`);

  const trainScript = `#!/usr/bin/env python3
"""
FineTune Lab - Local Training Entry Point
Auto-generated training script for local LLM fine-tuning.
"""

import json
import logging
from pathlib import Path
from datasets import Dataset

from standalone_trainer import ToolTrainer

logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] [%(levelname)s] %(message)s'
)
logger = logging.getLogger(__name__)

def load_dataset(dataset_path: str) -> Dataset:
    """Load dataset from JSONL file."""
    logger.info(f"Loading dataset from: {dataset_path}")
    return Dataset.from_json(dataset_path)

def main():
    logger.info("=" * 80)
    logger.info("FineTune Lab - Local Training")
    logger.info("=" * 80)

    # Load configuration
    config_path = Path("config.json")
    logger.info(f"Loading configuration from: {config_path}")

    with open(config_path, "r") as f:
        config = json.load(f)

    logger.info(f"Training method: {config['training']['method']}")
    logger.info(f"Model: {config['model']['name']}")

    # Load datasets
${hasDatasets ? `    train_dataset = load_dataset("train_dataset.jsonl")
    eval_dataset = load_dataset("eval_dataset.jsonl")
    logger.info(f"Train dataset size: {len(train_dataset)}")
    logger.info(f"Eval dataset size: {len(eval_dataset)}")
` : `    # Dataset paths not included - update these paths
    train_dataset = load_dataset("path/to/your/train_dataset.jsonl")
    eval_dataset = load_dataset("path/to/your/eval_dataset.jsonl")
`}
    # Initialize trainer
    output_dir = Path("./output")
    trainer = ToolTrainer(
        config=config,
        train_dataset=train_dataset,
        eval_dataset=eval_dataset,
        output_dir=output_dir
    )

    # Run training
    trainer.train()

    logger.info("=" * 80)
    logger.info("Training complete!")
    logger.info(f"Model saved to: {output_dir}")
    logger.info("=" * 80)

if __name__ == "__main__":
    main()
`;

  const scriptPath = path.join(packageDir, 'train.py');
  await fs.writeFile(scriptPath, trainScript, 'utf-8');

  console.log('[LocalPackageGenerator] train.py script generated successfully');
}

console.log('[LocalPackageGenerator] Train script generator defined');

/**
 * Generate local training package
 * Creates a complete package directory with all necessary files
 * @param options Package generation options
 * @returns Package generation result
 */
export async function generateLocalPackage(
  options: PackageGenerationOptions
): Promise<PackageGenerationResult> {
  console.log('[LocalPackageGenerator] Starting package generation');
  console.log(`[LocalPackageGenerator] Config: ${options.configName}`);
  console.log(`[LocalPackageGenerator] Output dir: ${options.outputDir}`);
  console.log('[LocalPackageGenerator] normalizeForBackend:', Boolean(options.normalizeForBackend));

  try {
    // Create package directory
    const packageName = `finetune-lab-${options.configName.replace(/\s+/g, '-').toLowerCase()}`;
    const packageDir = path.join(options.outputDir, packageName);

    console.log(`[LocalPackageGenerator] Creating package directory: ${packageDir}`);
    await fs.mkdir(packageDir, { recursive: true });

    // Write config.json (optionally normalized for backend expectations)
    const configPath = path.join(packageDir, 'config.json');
    console.log('[LocalPackageGenerator] Writing config.json');
    const configToWrite = options.normalizeForBackend
      ? normalizeForBackend(options.configJson)
      : options.configJson;
    await fs.writeFile(configPath, JSON.stringify(configToWrite, null, 2), 'utf-8');

    // Copy training module files
    await copyTrainingFiles(packageDir);

    // Generate train.py entry point
    const hasDatasets = options.datasetPaths.length > 0;
    await generateTrainScript(packageDir, hasDatasets);

    // Copy datasets if provided
    if (hasDatasets) {
      console.log(`[LocalPackageGenerator] Copying ${options.datasetPaths.length} datasets`);

      for (let i = 0; i < options.datasetPaths.length; i++) {
        const datasetPath = options.datasetPaths[i];
        const destName = i === 0 ? 'train_dataset.jsonl' : 'eval_dataset.jsonl';
        const destPath = path.join(packageDir, destName);

        console.log(`[LocalPackageGenerator] Copying dataset: ${datasetPath} -> ${destName}`);
        await fs.copyFile(datasetPath, destPath);
      }
    }

    console.log('[LocalPackageGenerator] Package generation complete');
    console.log(`[LocalPackageGenerator] Package location: ${packageDir}`);

    return {
      success: true,
      packagePath: packageDir,
    };
  } catch (error) {
    console.error('[LocalPackageGenerator] Error generating package:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

console.log('[LocalPackageGenerator] Main generation function defined');
