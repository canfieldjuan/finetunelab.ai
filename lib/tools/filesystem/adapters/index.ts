// Filesystem Adapters - Export and Factory
// Phase 2: Web App Support

export * from './types';
export * from './localAdapter';
export * from './remoteAdapter';

import { FilesystemAdapter, FilesystemMode } from './types';
import { LocalAdapter } from './localAdapter';
import { RemoteAdapter, RemoteAdapterConfig } from './remoteAdapter';

export interface AdapterFactoryConfig {
  mode?: FilesystemMode;
  remoteConfig?: RemoteAdapterConfig;
}

export function createFilesystemAdapter(
  config: AdapterFactoryConfig = {}
): FilesystemAdapter {
  const mode = config.mode || detectMode();

  console.log(`[AdapterFactory] Creating ${mode} adapter`);

  if (mode === 'remote') {
    if (!config.remoteConfig) {
      throw new Error(
        'Remote mode requires remoteConfig with baseUrl'
      );
    }
    return new RemoteAdapter(config.remoteConfig);
  }

  return new LocalAdapter();
}

function detectMode(): FilesystemMode {
  const envMode = process.env.FILESYSTEM_MODE;

  if (envMode === 'remote' || envMode === 'local') {
    console.log(`[AdapterFactory] Mode from env: ${envMode}`);
    return envMode;
  }

  if (typeof window !== 'undefined') {
    console.log('[AdapterFactory] Browser env detected - using remote mode');
    return 'remote';
  }

  console.log('[AdapterFactory] Node env detected - using local mode');
  return 'local';
}

export const defaultAdapter = createFilesystemAdapter({
  mode: detectMode(),
  remoteConfig: {
    baseUrl: process.env.FILESYSTEM_API_URL || 'http://localhost:8000',
    apiKey: process.env.FILESYSTEM_API_KEY
  }
});
