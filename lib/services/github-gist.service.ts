// GitHub Gist Service
// Purpose: Create anonymous GitHub Gists for Colab integration
// Date: 2025-10-20

import { generateTrainingNotebook, getNotebookFilename } from '../utils/notebook-generator';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface GistFile {
  content: string;
}

interface GistResponse {
  id: string;
  html_url: string;
  files: Record<string, { filename: string; raw_url: string }>;
}

interface CreateGistResult {
  success: boolean;
  gistId?: string;
  gistUrl?: string;
  colabUrl?: string;
  error?: string;
}

/**
 * Create a GitHub Gist with training notebook
 * @param publicId - Public training configuration ID
 * @param trainingMethod - Training method (sft/dpo/rlhf/orpo/cpt)
 * @param userGithubToken - Optional user's GitHub OAuth token (preferred over server token)
 */
export async function createTrainingGist(
  publicId: string,
  trainingMethod: 'sft' | 'dpo' | 'rlhf' | 'orpo' | 'cpt',
  userGithubToken?: string
): Promise<CreateGistResult> {
  console.log(`[GistService] Creating Gist for ${trainingMethod} training: ${publicId}`);

  try {
    const notebookContent = generateTrainingNotebook(publicId, trainingMethod);
    const filename = getNotebookFilename(trainingMethod);

    const gistPayload = {
      description: `FineTune Lab - ${trainingMethod.toUpperCase()} Training (${publicId})`,
      public: true,
      files: {
        [filename]: {
          content: notebookContent
        }
      }
    };

    console.log(`[GistService] Sending request to GitHub API`);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'FineTune-Lab'
    };

    // Prefer user's OAuth token over server token
    const githubToken = userGithubToken || process.env.GITHUB_TOKEN;

    if (githubToken) {
      headers['Authorization'] = `token ${githubToken}`;
      const tokenSource = userGithubToken ? 'user OAuth token' : 'server token';
      console.log(`[GistService] Using authenticated request with ${tokenSource}`);
    } else {
      console.warn(`[GistService] No GitHub token available - Gist creation will fail`);
      console.warn(`[GistService] User needs to sign in with GitHub or server needs GITHUB_TOKEN`);
    }

    const response = await fetch('https://api.github.com/gists', {
      method: 'POST',
      headers,
      body: JSON.stringify(gistPayload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[GistService] GitHub API error: ${response.status} - ${errorText}`);
      throw new Error(`GitHub API returned ${response.status}: ${errorText}`);
    }

    const gistData: GistResponse = await response.json();

    console.log(`[GistService] Gist created successfully: ${gistData.id}`);

    const colabUrl = buildColabUrl(gistData.id, filename);

    return {
      success: true,
      gistId: gistData.id,
      gistUrl: gistData.html_url,
      colabUrl
    };
  } catch (error) {
    console.error(`[GistService] Failed to create Gist:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error creating Gist'
    };
  }
}

/**
 * Build Colab URL for anonymous Gist
 */
function buildColabUrl(gistId: string, filename: string): string {
  const colabUrl = `https://colab.research.google.com/gist/${gistId}/${filename}`;
  console.log(`[GistService] Colab URL: ${colabUrl}`);
  return colabUrl;
}

/**
 * Create Gists for multiple training methods
 * @param publicId - Public training configuration ID
 * @param methods - Array of training methods to create Gists for
 * @param userGithubToken - Optional user's GitHub OAuth token
 */
export async function createTrainingGists(
  publicId: string,
  methods: Array<'sft' | 'dpo' | 'rlhf' | 'orpo' | 'cpt'>,
  userGithubToken?: string
): Promise<Record<string, CreateGistResult>> {
  console.log(`[GistService] Creating ${methods.length} Gists for: ${publicId}`);

  const results: Record<string, CreateGistResult> = {};

  for (const method of methods) {
    const result = await createTrainingGist(publicId, method, userGithubToken);
    results[method] = result;

    if (!result.success) {
      console.warn(`[GistService] Failed to create Gist for ${method}`);
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log(`[GistService] Created ${Object.keys(results).length} Gists`);
  return results;
}

console.log('[GistService] GitHub Gist service loaded');
