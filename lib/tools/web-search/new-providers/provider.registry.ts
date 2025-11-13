
import { WebSearchProvider } from '../types';

class ProviderRegistry {
  private providers = new Map<string, WebSearchProvider>();

  register(provider: WebSearchProvider): void {
    if (this.providers.has(provider.name)) {
      console.warn(`[ProviderRegistry] Provider "${provider.name}" is already registered. Overwriting.`);
    }
    this.providers.set(provider.name, provider);
  }

  get(name: string): WebSearchProvider | undefined {
    return this.providers.get(name);
  }

  list(): WebSearchProvider[] {
    return Array.from(this.providers.values());
  }
}

export const providerRegistry = new ProviderRegistry();
