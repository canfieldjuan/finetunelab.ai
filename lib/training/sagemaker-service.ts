/**
 * AWS SageMaker Service
 * Purpose: AWS SDK wrapper for SageMaker training operations
 * Date: 2025-12-18
 */

import {
  SageMakerClient,
  CreateTrainingJobCommand,
  CreateTrainingJobCommandInput,
  DescribeTrainingJobCommand,
  StopTrainingJobCommand,
} from '@aws-sdk/client-sagemaker';
import {
  CloudWatchLogsClient,
  GetLogEventsCommand,
  DescribeLogStreamsCommand,
} from '@aws-sdk/client-cloudwatch-logs';
import type {
  SageMakerDeploymentRequest,
  SageMakerDeploymentResponse,
  SageMakerDeploymentStatus,
  SageMakerInstanceType,
  DeploymentStatus,
} from './deployment.types';

export interface SageMakerConfig {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  roleArn: string;
}

export class SageMakerService {
  private client: SageMakerClient;
  private logsClient: CloudWatchLogsClient;
  private roleArn: string;
  private region: string;

  constructor(config: SageMakerConfig) {
    this.client = new SageMakerClient({
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });

    this.logsClient = new CloudWatchLogsClient({
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });

    this.roleArn = config.roleArn;
    this.region = config.region;
  }

  async createTrainingJob(
    request: SageMakerDeploymentRequest,
    s3DatasetPath: string,
    s3OutputPath: string,
    hyperparameters: Record<string, string>
  ): Promise<SageMakerDeploymentResponse> {
    const jobName = `finetune-lab-${Date.now()}`;
    const trainingImageUri =
      request.training_image_uri ||
      process.env.SAGEMAKER_TRAINING_IMAGE_URI ||
      '763104351884.dkr.ecr.us-east-1.amazonaws.com/pytorch-training:2.0.0-gpu-py310-cu118-ubuntu20.04-sagemaker';

    const input: CreateTrainingJobCommandInput = {
      TrainingJobName: jobName,
      RoleArn: this.roleArn,
      AlgorithmSpecification: {
        TrainingImage: trainingImageUri,
        TrainingInputMode: 'File',
      },
      InputDataConfig: [
        {
          ChannelName: 'training',
          DataSource: {
            S3DataSource: {
              S3DataType: 'S3Prefix',
              S3Uri: s3DatasetPath,
              S3DataDistributionType: 'FullyReplicated',
            },
          },
          ContentType: 'application/x-gzip',
          CompressionType: 'Gzip',
        },
      ],
      OutputDataConfig: {
        S3OutputPath: s3OutputPath,
      },
      ResourceConfig: {
        InstanceType: request.instance_type,
        InstanceCount: request.instance_count || 1,
        VolumeSizeInGB: request.volume_size_gb || 30,
      },
      StoppingCondition: {
        MaxRuntimeInSeconds: request.max_runtime_seconds || 86400,
      },
      HyperParameters: hyperparameters,
    };

    if (request.use_spot_instances) {
      input.EnableManagedSpotTraining = true;
      input.StoppingCondition = {
        MaxRuntimeInSeconds: request.max_runtime_seconds || 86400,
        MaxWaitTimeInSeconds: request.max_wait_seconds || 3600,
      };
    }

    const command = new CreateTrainingJobCommand(input);
    const response = await this.client.send(command);

    const estimatedCost = SageMakerService.estimateCost(
      request.instance_type,
      request.max_runtime_seconds || 86400,
      request.use_spot_instances || false
    );

    return {
      deployment_id: jobName,
      training_job_name: jobName,
      training_job_arn: response.TrainingJobArn || '',
      status: 'creating',
      instance_type: request.instance_type,
      instance_count: request.instance_count || 1,
      use_spot_instances: request.use_spot_instances || false,
      cost: {
        estimated_cost: estimatedCost,
        currency: 'USD',
      },
      s3_output_path: s3OutputPath,
      cloudwatch_log_group: '/aws/sagemaker/TrainingJobs',
      created_at: new Date().toISOString(),
    };
  }

  async getTrainingJobStatus(jobName: string): Promise<SageMakerDeploymentStatus> {
    const command = new DescribeTrainingJobCommand({
      TrainingJobName: jobName,
    });

    const response = await this.client.send(command);

    const statusMap: Record<string, DeploymentStatus> = {
      'InProgress': 'training',
      'Completed': 'completed',
      'Failed': 'failed',
      'Stopping': 'stopping',
      'Stopped': 'stopped',
    };

    const status = statusMap[response.TrainingJobStatus || 'InProgress'] || 'queued';
    const actualCost = response.BillableTimeInSeconds
      ? SageMakerService.calculateActualCost(
          response.ResourceConfig?.InstanceType || '',
          response.BillableTimeInSeconds,
          response.EnableManagedSpotTraining || false
        )
      : undefined;

    return {
      deployment_id: jobName,
      training_job_name: jobName,
      status,
      training_job_arn: response.TrainingJobArn || '',
      s3_output_path: response.OutputDataConfig?.S3OutputPath || '',
      cost: {
        estimated_cost: 0,
        actual_cost: actualCost,
        currency: 'USD',
      },
      error_message: response.FailureReason,
      started_at: response.TrainingStartTime?.toISOString(),
      completed_at: response.TrainingEndTime?.toISOString(),
      billable_seconds: response.BillableTimeInSeconds,
      training_time_seconds: response.TrainingTimeInSeconds,
      secondary_status: response.SecondaryStatus,
    };
  }

  async stopTrainingJob(jobName: string): Promise<void> {
    const command = new StopTrainingJobCommand({
      TrainingJobName: jobName,
    });
    await this.client.send(command);
  }

  async getTrainingLogs(jobName: string, limit: number = 100): Promise<string> {
    const logGroupName = '/aws/sagemaker/TrainingJobs';

    try {
      const streamsCommand = new DescribeLogStreamsCommand({
        logGroupName,
        logStreamNamePrefix: jobName,
        orderBy: 'LastEventTime',
        descending: true,
        limit: 1,
      });

      const streamsResponse = await this.logsClient.send(streamsCommand);

      if (!streamsResponse.logStreams || streamsResponse.logStreams.length === 0) {
        return 'No logs available yet';
      }

      const logStreamName = streamsResponse.logStreams[0].logStreamName;
      if (!logStreamName) {
        return 'No log stream name found';
      }

      const logsCommand = new GetLogEventsCommand({
        logGroupName,
        logStreamName,
        limit,
        startFromHead: false,
      });

      const logsResponse = await this.logsClient.send(logsCommand);

      if (!logsResponse.events || logsResponse.events.length === 0) {
        return 'No log events available yet';
      }

      return logsResponse.events
        .map(event => `[${new Date(event.timestamp || 0).toISOString()}] ${event.message}`)
        .join('\n');
    } catch (error) {
      return `Failed to fetch logs: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  static getInstancePricing(): Record<SageMakerInstanceType, number> {
    return {
      'ml.p3.2xlarge': 3.06,
      'ml.p3.8xlarge': 12.24,
      'ml.p3.16xlarge': 24.48,
      'ml.g5.xlarge': 1.006,
      'ml.g5.2xlarge': 1.212,
      'ml.g5.12xlarge': 5.672,
      'ml.g5.48xlarge': 16.288,
      'ml.p4d.24xlarge': 32.77,
      'ml.p5.48xlarge': 98.32,
    };
  }

  static estimateCost(
    instanceType: SageMakerInstanceType,
    durationSeconds: number,
    useSpot: boolean = false
  ): number {
    const pricing = SageMakerService.getInstancePricing();
    const hourlyRate = pricing[instanceType] || 5.0;
    const hours = durationSeconds / 3600;
    const cost = hourlyRate * hours;
    return useSpot ? cost * 0.3 : cost;
  }

  static calculateActualCost(
    instanceType: string,
    billableSeconds: number,
    usedSpot: boolean = false
  ): number {
    return SageMakerService.estimateCost(
      instanceType as SageMakerInstanceType,
      billableSeconds,
      usedSpot
    );
  }
}
