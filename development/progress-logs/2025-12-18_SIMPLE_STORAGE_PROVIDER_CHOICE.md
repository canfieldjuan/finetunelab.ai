# Simple Storage Provider Choice - Implementation Plan
**Date:** 2025-12-18
**Status:** PLANNING - AWAITING APPROVAL
**Approach:** User-Driven Storage Selection (MUCH SIMPLER)

---

## User's Insight: Simpler Approach ✅

Instead of complex parallel uploads and migrations:

1. **Dataset Manager**: Add storage provider dropdown (Supabase or AWS S3)
2. **User Chooses**: Where to upload EACH dataset
3. **Training Config**: Filter datasets by matching provider
   - RunPod training → Show only Supabase datasets
   - SageMaker training → Show only AWS S3 datasets

**This is parallel implementation** - both storage providers coexist, user decides per-dataset.

---

## Advantages Over Complex Plan

✅ **No Parallel Uploads**: One upload location per dataset
✅ **No Migration**: Users upload new datasets where they want
✅ **No Breaking Changes**: Existing datasets stay on Supabase
✅ **User Control**: Explicit choice, not automatic
✅ **Clean Separation**: RunPod datasets separate from SageMaker datasets
✅ **Zero Data Loss Risk**: No copying/moving data
✅ **Faster Implementation**: 2 days instead of 5

---

## Database Schema Change

### Current Schema (training_datasets table):
```sql
storage_path TEXT NOT NULL  -- e.g., "user_id/private/dataset_id.jsonl.gz"
metadata JSONB              -- Contains format info, stats, etc.
```

### Add One Field:
```sql
storage_provider TEXT NOT NULL DEFAULT 'supabase'
```

**Possible values**: `'supabase'` | `'s3'`

**Migration**:
```sql
-- Existing datasets default to Supabase
ALTER TABLE training_datasets
ADD COLUMN storage_provider TEXT NOT NULL DEFAULT 'supabase';
```

---

## Implementation Plan

### PHASE 1: Add Storage Provider Selection (1 day)

#### 1.1 Database Migration

**File**: `supabase/migrations/20251218_add_storage_provider.sql` (NEW)

```sql
-- Add storage_provider column to training_datasets
ALTER TABLE training_datasets
ADD COLUMN storage_provider TEXT NOT NULL DEFAULT 'supabase';

-- Create index for faster filtering
CREATE INDEX idx_training_datasets_storage_provider
ON training_datasets(user_id, storage_provider);

-- Add constraint to ensure valid values
ALTER TABLE training_datasets
ADD CONSTRAINT check_storage_provider
CHECK (storage_provider IN ('supabase', 's3'));

-- Update existing records to be explicit
UPDATE training_datasets
SET storage_provider = 'supabase'
WHERE storage_provider IS NULL;
```

#### 1.2 Update TypeScript Types

**File**: `lib/training/dataset.types.ts`

**Find**: `TrainingDatasetRecord` interface (need to verify exact location)

**Add**:
```typescript
export type StorageProvider = 'supabase' | 's3';

export interface TrainingDatasetRecord {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  format: DatasetFormat;
  storage_provider: StorageProvider;  // ADD THIS
  storage_path: string;
  file_size_bytes: number;
  total_examples: number;
  avg_input_length: number;
  avg_output_length: number;
  metadata: DatasetMetadata | null;
  created_at: string;
  updated_at: string;
}
```

#### 1.3 Update Dataset Manager UI

**File**: `components/training/DatasetManager.tsx`

**Current upload form has** (around line 40-47):
- file, name, description, format state variables

**Add new state variable** (after line 43):
```typescript
const [storageProvider, setStorageProvider] = useState<'supabase' | 's3'>('supabase');
```

**Add storage provider selector** (in the upload form, before format selector):

**Insertion point**: After line 43 (where format is defined), in the JSX around line 200-250

```tsx
{/* Storage Provider Selection */}
<div className="space-y-2">
  <Label htmlFor="storage-provider">Storage Provider</Label>
  <Select
    value={storageProvider}
    onValueChange={(value: 'supabase' | 's3') => setStorageProvider(value)}
  >
    <SelectTrigger id="storage-provider">
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="supabase">
        <div className="flex items-center gap-2">
          <span>Supabase Storage</span>
          <span className="text-xs text-muted-foreground">(RunPod, Lambda)</span>
        </div>
      </SelectItem>
      <SelectItem value="s3">
        <div className="flex items-center gap-2">
          <span>AWS S3</span>
          <span className="text-xs text-muted-foreground">(SageMaker)</span>
        </div>
      </SelectItem>
    </SelectContent>
  </Select>
  <p className="text-xs text-muted-foreground">
    {storageProvider === 'supabase'
      ? 'Upload to Supabase Storage (for RunPod, Lambda training)'
      : 'Upload to AWS S3 (required for SageMaker training)'}
  </p>
</div>
```

**Update upload function** to include storage_provider:

**Find**: `handleUpload` function (around line 150-200)

**Modify**: FormData append section to add storage_provider:

```typescript
const handleUpload = async () => {
  // ... existing validation ...

  const formData = new FormData();
  formData.append('file', file);
  formData.append('name', name);
  formData.append('description', description);
  formData.append('format', format);
  formData.append('storage_provider', storageProvider);  // ADD THIS
  // ... rest of upload logic ...
};
```

---

### PHASE 2: Update Upload Endpoint (1 day)

#### 2.1 Create S3 Storage Service

**File**: `lib/storage/s3-storage-service.ts` (NEW)

```typescript
/**
 * S3 Storage Service
 * Handles dataset upload to AWS S3
 */

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { GetObjectCommand } from '@aws-sdk/client-s3';

export interface S3Config {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  bucketName: string;
}

export class S3StorageService {
  private s3Client: S3Client;
  private bucketName: string;

  constructor(config: S3Config) {
    this.s3Client = new S3Client({
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey
      }
    });
    this.bucketName = config.bucketName;
  }

  /**
   * Upload dataset to S3
   * @returns S3 key (storage path)
   */
  async uploadDataset(
    file: Blob,
    userId: string,
    datasetId: string
  ): Promise<string> {
    const key = `${userId}/datasets/${datasetId}.jsonl.gz`;

    console.log('[S3Storage] Uploading to S3:', {
      bucket: this.bucketName,
      key,
      size: file.size
    });

    const buffer = Buffer.from(await file.arrayBuffer());

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: buffer,
      ContentType: 'application/gzip',
      Metadata: {
        'uploaded-by': 'finetunelab',
        'user-id': userId,
        'dataset-id': datasetId
      }
    });

    await this.s3Client.send(command);

    console.log('[S3Storage] Upload complete:', key);
    return key;
  }

  /**
   * Generate presigned URL for dataset download
   * @param key S3 key (storage path)
   * @param expiresInSeconds URL expiry (max 604800 = 7 days)
   * @returns Presigned URL
   */
  async generatePresignedUrl(
    key: string,
    expiresInSeconds: number = 7200
  ): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key
    });

    return await getSignedUrl(this.s3Client, command, {
      expiresIn: expiresInSeconds
    });
  }
}
```

#### 2.2 Update Upload Endpoint

**File**: `app/api/training/dataset/route.ts`

**Current flow** (line 200-283):
1. Get file, name, description, format from formData
2. Validate & normalize
3. Compress
4. Upload to Supabase
5. Save to database

**Changes needed**:

**Step 1**: Extract storage_provider from formData (after line 205)

```typescript
const file = formData.get('file') as File;
const name = formData.get('name') as string;
const description = formData.get('description') as string | null;
const format = formData.get('format') as DatasetFormat;
const configId = formData.get('config_id') as string | null;
const storageProvider = (formData.get('storage_provider') as 'supabase' | 's3') || 'supabase';  // ADD THIS

console.log('[DatasetAPI] Storage provider:', storageProvider);
```

**Step 2**: Replace upload section (lines 285-400) with conditional upload:

```typescript
// After compression (line 282)
console.log('[DatasetAPI] Compressed size:', normalizedBlob.size, 'bytes');

const datasetId = crypto.randomUUID();
let storagePath: string;

// CONDITIONAL UPLOAD BASED ON PROVIDER
if (storageProvider === 's3') {
  console.log('[DatasetAPI] Uploading to AWS S3');

  // Get user's AWS credentials
  const { secretsManager } = await import('@/lib/secrets/secrets-manager.service');
  const awsSecret = await secretsManager.getSecret(user.id, 'aws', supabase);

  if (!awsSecret || !awsSecret.metadata?.aws?.s3_bucket) {
    return NextResponse.json(
      {
        error: 'AWS not configured',
        details: 'Please configure AWS credentials in Settings > Secrets to use S3 storage'
      },
      { status: 400 }
    );
  }

  // Upload to S3
  const { S3StorageService } = await import('@/lib/storage/s3-storage-service');
  const s3Service = new S3StorageService({
    accessKeyId: awsSecret.api_key,
    secretAccessKey: awsSecret.metadata.aws.secret_access_key,
    region: awsSecret.metadata.aws.region || 'us-east-1',
    bucketName: awsSecret.metadata.aws.s3_bucket
  });

  storagePath = await s3Service.uploadDataset(normalizedBlob, user.id, datasetId);
  console.log('[DatasetAPI] S3 upload complete:', storagePath);

} else {
  console.log('[DatasetAPI] Uploading to Supabase Storage');
  storagePath = `${user.id}/private/${datasetId}.jsonl.gz`;

  // Existing Supabase upload logic (lines 285-400)
  // Keep TUS upload for large files, standard upload for small files
  // ... (existing code) ...
}
```

**Step 3**: Update database insert (line 415-450) to include storage_provider:

```typescript
const { data, error } = await supabase
  .from('training_datasets')
  .insert({
    id: datasetId,
    user_id: user.id,
    config_id: configId,
    name,
    description,
    format,
    storage_provider: storageProvider,  // ADD THIS
    storage_path: storagePath,
    file_size_bytes: normalizedBlob.size,
    // ... rest of fields ...
  })
  .select()
  .single();
```

---

### PHASE 3: Filter Datasets by Provider (1 day)

#### 3.1 Create Dataset Filter Endpoint

**File**: `app/api/training/dataset/available/route.ts` (VERIFY IF EXISTS)

**If it exists**, modify the SELECT query to accept a provider filter.

**If it doesn't exist**, it might be in `/api/training/dataset/route.ts` as GET endpoint.

**Find the current GET /api/training/dataset** (line 485-522 in route.ts)

**Modify** to accept optional `provider` query parameter:

```typescript
export async function GET(request: NextRequest) {
  console.log('[DatasetAPI] GET: Fetching datasets');

  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ADD THIS: Get optional provider filter from query params
    const url = new URL(request.url);
    const providerFilter = url.searchParams.get('provider') as 'supabase' | 's3' | null;

    console.log('[DatasetAPI] Provider filter:', providerFilter);

    // MODIFY QUERY: Add conditional filter
    let query = supabase
      .from('training_datasets')
      .select('*')
      .eq('user_id', user.id);

    if (providerFilter) {
      query = query.eq('storage_provider', providerFilter);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('[DatasetAPI] Error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log('[DatasetAPI] Found', data.length, 'datasets');
    return NextResponse.json({
      datasets: data,
      count: data.length,
      provider: providerFilter || 'all'
    });
  } catch (error) {
    console.error('[DatasetAPI] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}
```

#### 3.2 Update Training Config Form

**File**: `components/training/dag/config-forms/TrainingConfigForm.tsx`

**Current**: Fetches all datasets (line 121)

**Change**: Fetch datasets filtered by training provider

**Find**: `fetchDatasets` or dataset fetch logic (around line 117-133)

**Modify**:

```typescript
// Existing code around line 109-133
useEffect(() => {
  if (sessionToken) {
    // Fetch datasets filtered by training provider
    fetchDatasetsForProvider();
  }
}, [sessionToken, config.provider]); // ADD config.provider dependency

const fetchDatasetsForProvider = async () => {
  setLoadingDatasets(true);
  try {
    const token = sessionToken || (await supabase.auth.getSession()).data.session?.access_token;

    // Map training provider to storage provider
    const storageProvider = getStorageProviderForTraining(config.provider);

    console.log('[TrainingConfigForm] Fetching datasets for provider:', config.provider, '→', storageProvider);

    const url = storageProvider
      ? `/api/training/dataset?provider=${storageProvider}`
      : '/api/training/dataset';

    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch datasets: ${response.status}`);
    }

    const data = await response.json();
    console.log('[TrainingConfigForm] Loaded', data.count, 'datasets');
    setDatasets(data.datasets || []);
  } catch (error) {
    console.error('[TrainingConfigForm] Error fetching datasets:', error);
    setDatasets([]);
  } finally {
    setLoadingDatasets(false);
  }
};

// Helper function to map training provider → storage provider
function getStorageProviderForTraining(trainingProvider: string): 'supabase' | 's3' | null {
  switch (trainingProvider) {
    case 'runpod':
    case 'lambda':
    case 'local':
    case 'colab':
    case 'huggingface':
      return 'supabase';

    case 'sagemaker':
    case 'aws':
      return 's3';

    default:
      return null; // Show all datasets
  }
}
```

**Add visual indicator** in dataset selector:

Around line 363 (dataset select value display), add storage provider badge:

```tsx
<SelectValue placeholder="Select a dataset...">
  {config.datasetId && (
    <div className="flex items-center gap-2">
      <span>{getDatasetName(config.datasetId)}</span>
      <span className="text-xs px-1.5 py-0.5 rounded bg-muted">
        {getDatasetStorageProvider(config.datasetId)}
      </span>
    </div>
  )}
</SelectValue>
```

---

### PHASE 4: Update URL Service (1 day)

**File**: `lib/training/dataset-url-service.ts`

**Current**: Only handles Supabase signed URLs

**Change**: Check storage_provider field, route accordingly

**Replace**: `generateDownloadUrl` method (lines 26-58)

```typescript
async generateDownloadUrl(
  datasetId: string,  // CHANGE: Accept dataset ID instead of storage path
  userId: string,
  supabase: SupabaseClient,
  expiryHours: number = 2
): Promise<DatasetDownloadUrl> {
  console.log('[DatasetUrlService] Generating download URL for dataset:', datasetId);

  // Fetch dataset metadata to determine storage provider
  const { data: dataset, error: dbError } = await supabase
    .from('training_datasets')
    .select('storage_provider, storage_path, metadata')
    .eq('id', datasetId)
    .eq('user_id', userId)
    .single();

  if (dbError || !dataset) {
    throw new Error(`Dataset not found: ${dbError?.message || 'No data'}`);
  }

  const expirySeconds = Math.min(expiryHours * 3600, 7200);
  const expiresAt = new Date(Date.now() + expirySeconds * 1000);

  // ROUTE BASED ON STORAGE PROVIDER
  if (dataset.storage_provider === 's3') {
    console.log('[DatasetUrlService] Generating S3 presigned URL');

    // Get AWS credentials
    const { secretsManager } = await import('@/lib/secrets/secrets-manager.service');
    const awsSecret = await secretsManager.getSecret(userId, 'aws', supabase);

    if (!awsSecret?.metadata?.aws?.s3_bucket) {
      throw new Error('AWS credentials not found');
    }

    // Generate S3 presigned URL
    const { S3StorageService } = await import('@/lib/storage/s3-storage-service');
    const s3Service = new S3StorageService({
      accessKeyId: awsSecret.api_key,
      secretAccessKey: awsSecret.metadata.aws.secret_access_key,
      region: awsSecret.metadata.aws.region || 'us-east-1',
      bucketName: awsSecret.metadata.aws.s3_bucket
    });

    const presignedUrl = await s3Service.generatePresignedUrl(
      dataset.storage_path,
      expirySeconds
    );

    console.log('[DatasetUrlService] ✓ S3 presigned URL created');

    return {
      url: presignedUrl,
      token: 's3-presigned',
      expires_at: expiresAt.toISOString()
    };

  } else {
    // SUPABASE (existing code)
    console.log('[DatasetUrlService] Generating Supabase signed URL');

    const { data, error } = await supabase.storage
      .from('training-datasets')
      .createSignedUrl(dataset.storage_path, expirySeconds);

    if (error || !data) {
      throw new Error(`Failed to create signed URL: ${error?.message || 'No data'}`);
    }

    console.log('[DatasetUrlService] ✓ Supabase signed URL created');

    return {
      url: data.signedUrl,
      token: 'supabase-signed',
      expires_at: expiresAt.toISOString()
    };
  }
}
```

**IMPORTANT**: All callers of this method need to pass `datasetId` instead of `storage_path`.

**Files that call `generateDownloadUrl`**:
1. `app/api/training/deploy/runpod/route.ts` (line ~433)
2. `app/api/training/deploy/lambda/route.ts`

**Update these calls** from:
```typescript
const downloadUrl = await datasetUrlService.generateDownloadUrl(
  dataset.storage_path,
  userId,
  supabase
);
```

To:
```typescript
const downloadUrl = await datasetUrlService.generateDownloadUrl(
  datasetId,  // Pass dataset ID instead
  userId,
  supabase
);
```

---

## Dependencies

### NPM Packages (Need to Install):
```bash
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

### Already Installed:
- `boto3` (Python)
- `s3fs` (Python)

---

## Testing Plan

### Test 1: Supabase Upload (Existing Flow)
1. Choose "Supabase Storage" in Dataset Manager
2. Upload dataset
3. Verify appears in dataset list with `storage_provider: 'supabase'`
4. Start RunPod training with this dataset
5. Verify training downloads dataset successfully

### Test 2: S3 Upload (New Flow)
1. Configure AWS credentials in Settings > Secrets
2. Choose "AWS S3" in Dataset Manager
3. Upload dataset
4. Verify appears in dataset list with `storage_provider: 's3'`
5. Start SageMaker training with this dataset
6. Verify training downloads dataset successfully

### Test 3: Provider Filtering
1. Upload one dataset to Supabase
2. Upload one dataset to S3
3. Open training config for RunPod
   - Should see ONLY Supabase dataset
4. Open training config for SageMaker
   - Should see ONLY S3 dataset

### Test 4: Error Handling
1. Try to upload to S3 without AWS configured
   - Should show clear error message
2. Try to start SageMaker training with Supabase dataset
   - Should not appear in dataset list (filtered out)

---

## Files Summary

### Files to CREATE:
1. `supabase/migrations/20251218_add_storage_provider.sql` (database migration)
2. `lib/storage/s3-storage-service.ts` (S3 upload/download handler)

### Files to MODIFY:
1. `lib/training/dataset.types.ts` (add StorageProvider type)
2. `components/training/DatasetManager.tsx` (add storage provider selector)
3. `app/api/training/dataset/route.ts` (conditional upload, provider filter)
4. `components/training/dag/config-forms/TrainingConfigForm.tsx` (filter datasets)
5. `lib/training/dataset-url-service.ts` (route to S3 or Supabase)
6. `app/api/training/deploy/runpod/route.ts` (pass dataset ID not path)
7. `app/api/training/deploy/lambda/route.ts` (pass dataset ID not path)

### Files VERIFIED (no changes needed):
- Database schema compatible
- Training jobs table unchanged
- Metrics/analytics unchanged

---

## Timeline

- **Day 1**: Phase 1 (Database + UI for storage selection)
- **Day 2**: Phase 2 (Upload endpoint + S3 service)
- **Day 3**: Phase 3 & 4 (Filtering + URL service)
- **Day 4**: Testing + Bug fixes

**Total**: 4 days (vs 5+ days for complex plan)

---

## Advantages of This Approach

✅ **User Control**: Explicit choice per dataset
✅ **No Migration**: Old datasets stay on Supabase
✅ **Clean Separation**: RunPod uses Supabase, SageMaker uses S3
✅ **Zero Data Loss**: No copying/moving
✅ **Simpler Code**: No parallel uploads, no fallback logic
✅ **Faster**: 4 days vs 5+ days
✅ **No Breaking Changes**: Existing flows untouched

---

## Questions for User

1. **Is this the approach you want?**
   - User chooses storage provider per dataset
   - Training config filters by provider

2. **Should we add visual indicators?**
   - Badge showing "Supabase" or "S3" on dataset cards
   - Color coding (blue = Supabase, orange = S3)

3. **Error handling for AWS not configured?**
   - Disable S3 option if no AWS credentials?
   - Or allow selection and fail gracefully with message?

---

## Approval Status

**Created**: 2025-12-18
**Status**: ⏳ AWAITING USER APPROVAL
**Approach**: Simple user-driven storage choice

Once approved, I will:
1. Create the files listed above
2. Make the exact code changes specified
3. Test each phase
4. Update this document with progress

---

**APPROVAL REQUIRED BEFORE IMPLEMENTATION**
