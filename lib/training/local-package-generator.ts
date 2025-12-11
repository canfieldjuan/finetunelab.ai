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
// eslint-disable-next-line @typescript-eslint/no-unused-vars
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
    'README_TRAINING.md',
    // Predictions tracking files (W&B-style)
    'predictions_callback.py',
    'predictions_generator.py',
    'predictions_sampler.py',
    'predictions_writer.py',
    'predictions_config.py'
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
import os
import uuid
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

def create_local_job(config):
    """
    Create a local training job in the database for metrics/predictions tracking.

    Requires environment variables:
    - FINETUNE_LAB_API_URL: Base URL of FineTune Lab instance (e.g., http://localhost:3000)
    - FINETUNE_LAB_USER_TOKEN: User authentication token from the UI
    """
    import requests

    api_url = os.getenv('FINETUNE_LAB_API_URL')
    user_token = os.getenv('FINETUNE_LAB_USER_TOKEN')

    if not api_url or not user_token:
        logger.warning("=" * 80)
        logger.warning("PREDICTIONS/METRICS DISABLED")
        logger.warning("To enable predictions and metrics tracking in the UI:")
        logger.warning("1. Set FINETUNE_LAB_API_URL=<your-finetune-lab-url>")
        logger.warning("2. Set FINETUNE_LAB_USER_TOKEN=<your-auth-token>")
        logger.warning("Get your token from: Profile -> API Tokens in the UI")
        logger.warning("=" * 80)
        return None, None, None

    try:
        # Generate IDs locally
        local_job_id = str(uuid.uuid4())
        local_job_token = str(uuid.uuid4())

        # Create job in database
        response = requests.post(
            f"{api_url}/api/training/local/jobs",
            json={
                "job_id": local_job_id,
                "name": f"Local Training - {config.get('model', {}).get('name', 'Unknown')}",
                "status": "running",
                "config": config,
                "job_token": local_job_token
            },
            headers={"Authorization": f"Bearer {user_token}"},
            timeout=10
        )

        if response.status_code in [200, 201, 202]:
            job_data = response.json()
            # Use returned ID/token if present, else fallback to local
            job_id = job_data.get('job_id') or job_data.get('id') or local_job_id
            job_token = job_data.get('job_token') or local_job_token
            user_id = job_data.get('user_id')
            
            logger.info(f"Created training job in database: {job_id}")
            return job_id, job_token, user_id
        else:
            logger.warning(f"Failed to create job: {response.status_code} - {response.text}")
            return None, None, None

    except Exception as e:
        logger.warning(f"Failed to create job in database: {e}")
        return None, None, None

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

    # Create job in database (for predictions/metrics tracking)
    job_id, job_token, user_id = create_local_job(config)

    if job_id and job_token:
        os.environ['JOB_ID'] = job_id
        os.environ['JOB_TOKEN'] = job_token
        os.environ['JOB_USER_ID'] = user_id or "local-user"
        os.environ['METRICS_API_URL'] = f"{os.getenv('FINETUNE_LAB_API_URL')}/api/training/local/metrics"
        os.environ['IS_CLOUD'] = 'false'
        logger.info("Predictions and metrics tracking ENABLED")
    else:
        logger.info("Training will run without predictions/metrics tracking")

    # Load datasets
${hasDatasets ? `    train_dataset = load_dataset("train_dataset.jsonl")
    logger.info(f"Train dataset size: {len(train_dataset)}")

    # Load eval dataset if it exists
    eval_dataset_path = Path("eval_dataset.jsonl")
    if eval_dataset_path.exists():
        eval_dataset = load_dataset("eval_dataset.jsonl")
        logger.info(f"Eval dataset size: {len(eval_dataset)}")
    else:
        logger.info("No eval dataset provided - disabling evaluation")
        eval_dataset = None
        # Disable evaluation in config if no eval dataset
        if "training" in config and "eval_strategy" in config["training"]:
            config["training"]["eval_strategy"] = "no"
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

    # Check if resuming from checkpoint
    resume_checkpoint = config.get('resume_from_checkpoint')
    if resume_checkpoint:
        logger.info(f"Resuming training from checkpoint: {resume_checkpoint}")
    else:
        logger.info("Starting training from scratch...")

    # Run training with optional checkpoint resume
    trainer.train(resume_from_checkpoint=resume_checkpoint)

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
    console.log('[LocalPackageGenerator] PREDICTIONS CHECK - Input config:', {
      hasPredictions: !!options.configJson.predictions,
      predictionsEnabled: options.configJson.predictions?.enabled,
      predictionsConfig: options.configJson.predictions
    });
    const configToWrite = options.normalizeForBackend
      ? normalizeForBackend(options.configJson)
      : options.configJson;
    console.log('[LocalPackageGenerator] PREDICTIONS CHECK - Output config:', {
      hasPredictions: !!(configToWrite as Record<string, unknown>).predictions,
      predictionsEnabled: ((configToWrite as Record<string, unknown>).predictions as Record<string, unknown> | undefined)?.enabled,
      predictionsConfig: (configToWrite as Record<string, unknown>).predictions
    });
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
