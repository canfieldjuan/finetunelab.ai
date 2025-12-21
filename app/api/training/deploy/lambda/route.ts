/**
 * Lambda Labs Deployment API Route - DEPRECATED
 * Purpose: This endpoint has been deprecated in favor of AWS SageMaker
 * Date: 2025-12-18 - Deprecated and replaced with SageMaker
 * Migration: Use /api/training/deploy/sagemaker instead
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const DEPRECATION_MESSAGE = `
Lambda Labs cloud deployment has been deprecated and replaced with AWS SageMaker.

Why the change?
- SageMaker offers 70% cost savings with spot instances
- Better integration with AWS S3 storage
- More reliable GPU availability
- Enterprise-grade monitoring with CloudWatch

Migration Steps:
1. Add your AWS credentials in Settings → Secrets
2. Upload your datasets to S3 storage
3. Use the SageMaker deployment option instead

For more information, see the documentation at /docs/cloud-deployment
`.trim();

/**
 * POST - Deploy to Lambda Labs (DEPRECATED)
 * Returns 410 Gone with migration instructions
 */
export async function POST(_request: NextRequest) {
  console.log('[Lambda API - DEPRECATED] Received POST request - returning 410 Gone');

  return NextResponse.json(
    {
      error: 'Lambda Labs deployment is no longer supported',
      message: DEPRECATION_MESSAGE,
      deprecated_at: '2025-12-18',
      replacement: {
        endpoint: '/api/training/deploy/sagemaker',
        method: 'POST',
        documentation: '/docs/cloud-deployment/sagemaker'
      }
    },
    {
      status: 410,
      headers: {
        'X-Deprecated-At': '2025-12-18',
        'X-Replacement-Endpoint': '/api/training/deploy/sagemaker'
      }
    }
  );
}

/**
 * GET - Check Lambda Labs job status (DEPRECATED)
 * Returns 410 Gone with migration instructions
 */
export async function GET(_request: NextRequest) {
  console.log('[Lambda API - DEPRECATED] Received GET request - returning 410 Gone');

  return NextResponse.json(
    {
      error: 'Lambda Labs deployment is no longer supported',
      message: DEPRECATION_MESSAGE,
      deprecated_at: '2025-12-18',
      replacement: {
        endpoint: '/api/training/deploy/sagemaker',
        method: 'GET',
        documentation: '/docs/cloud-deployment/sagemaker'
      }
    },
    {
      status: 410,
      headers: {
        'X-Deprecated-At': '2025-12-18',
        'X-Replacement-Endpoint': '/api/training/deploy/sagemaker'
      }
    }
  );
}

/**
 * DELETE - Stop Lambda Labs job (DEPRECATED)
 * Returns 410 Gone with migration instructions
 */
export async function DELETE(_request: NextRequest) {
  console.log('[Lambda API - DEPRECATED] Received DELETE request - returning 410 Gone');

  return NextResponse.json(
    {
      error: 'Lambda Labs deployment is no longer supported',
      message: DEPRECATION_MESSAGE,
      deprecated_at: '2025-12-18',
      replacement: {
        endpoint: '/api/training/deploy/sagemaker',
        method: 'DELETE',
        documentation: '/docs/cloud-deployment/sagemaker'
      }
    },
    {
      status: 410,
      headers: {
        'X-Deprecated-At': '2025-12-18',
        'X-Replacement-Endpoint': '/api/training/deploy/sagemaker'
      }
    }
  );
}
