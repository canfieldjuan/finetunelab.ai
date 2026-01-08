/**
 * Training Agent Download Proxy
 * Fetches training-agent releases from GitHub and streams to user
 * Enables direct downloads without GitHub redirects
 * Date: 2026-01-07
 */

import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/workers/download/[platform]
 * Downloads training agent for specified platform
 * Platforms: linux, darwin, windows
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ platform: string }> }
) {
  try {
    const { platform } = await params;

    const validPlatforms = ['linux', 'darwin', 'windows'];
    if (!validPlatforms.includes(platform)) {
      return NextResponse.json(
        { error: 'Invalid platform. Must be: linux, darwin, or windows' },
        { status: 400 }
      );
    }

    const version = process.env.NEXT_PUBLIC_TRAINING_AGENT_VERSION || 'v0.2.1';
    const baseUrl = `https://github.com/FineTune-Lab/training-agent/releases/download/${version}`;

    const fileMap: Record<string, string> = {
      linux: 'training-agent-linux-amd64.tar.gz',
      darwin: 'training-agent-darwin-amd64.tar.gz',
      windows: 'training-agent-windows-amd64.zip',
    };

    const filename = fileMap[platform];
    const githubUrl = `${baseUrl}/${filename}`;

    console.log('[Training Agent Download] Fetching:', githubUrl);

    const response = await fetch(githubUrl, {
      method: 'GET',
      redirect: 'follow',
    });

    if (!response.ok) {
      console.error('[Training Agent Download] GitHub fetch failed:', response.status);
      return NextResponse.json(
        { error: 'Failed to fetch training agent from GitHub' },
        { status: response.status === 404 ? 404 : 500 }
      );
    }

    const contentType = platform === 'windows'
      ? 'application/zip'
      : 'application/gzip';

    console.log('[Training Agent Download] Streaming:', filename);

    return new NextResponse(response.body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'public, max-age=3600',
      },
    });

  } catch (error) {
    console.error('[Training Agent Download] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to download training agent',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
