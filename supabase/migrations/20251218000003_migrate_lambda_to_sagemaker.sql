-- Migrate Lambda Labs platform to AWS SageMaker
-- Date: 2025-12-18
-- Purpose: Replace deprecated Lambda Labs with AWS SageMaker for cloud training

-- Step 1: Drop existing platform constraint if it exists
ALTER TABLE cloud_deployments
DROP CONSTRAINT IF EXISTS cloud_deployments_platform_check;

-- Step 2: Update all Lambda Labs deployments to SageMaker
-- This updates both 'lambda' and 'lambda-labs' platform values
UPDATE cloud_deployments
SET platform = 'sagemaker'
WHERE platform IN ('lambda', 'lambda-labs');

-- Step 3: Add CHECK constraint for valid platform values
-- This ensures only supported platforms can be stored
ALTER TABLE cloud_deployments
ADD CONSTRAINT cloud_deployments_platform_check
CHECK (platform IN ('kaggle', 'runpod', 'sagemaker', 'huggingface-spaces', 'local-vllm', 'google-colab'));

-- Step 4: Add comment to document the change
COMMENT ON CONSTRAINT cloud_deployments_platform_check ON cloud_deployments IS 'Valid deployment platforms: kaggle, runpod, sagemaker, huggingface-spaces, local-vllm, google-colab';
COMMENT ON COLUMN cloud_deployments.platform IS 'Deployment platform: kaggle, runpod, sagemaker, huggingface-spaces, local-vllm, or google-colab';
