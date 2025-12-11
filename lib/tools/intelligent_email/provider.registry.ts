// Intelligent Email Tool - Provider Registry
// Phase 3.1: Provider management and selection
// Date: October 24, 2025

import type { EmailProvider, SendEmailParams, SendEmailResult } from './types';
import { resendProvider } from './resend.provider';
import { emailConfig } from './email.config';

/**
 * Email Provider Registry
 * Manages available email providers and selects the appropriate one
 */
class EmailProviderRegistry {
  private providers: Map<string, EmailProvider> = new Map();
  private defaultProvider: string;

  constructor() {
    this.defaultProvider = emailConfig.provider;
    this.registerDefaultProviders();
  }

  /**
   * Register default providers
   */
  private registerDefaultProviders(): void {
    console.log('[EmailProviderRegistry] Registering default providers...');
    this.register(resendProvider);
    console.log('[EmailProviderRegistry] Registered:', Array.from(this.providers.keys()).join(', '));
  }

  /**
   * Register a provider
   */
  register(provider: EmailProvider): void {
    if (this.providers.has(provider.name)) {
      console.warn(`[EmailProviderRegistry] Provider ${provider.name} already registered, overwriting`);
    }
    this.providers.set(provider.name, provider);
    console.log('[EmailProviderRegistry] Registered provider:', provider.name);
  }

  /**
   * Get a provider by name
   */
  getProvider(name?: string): EmailProvider | null {
    const providerName = name || this.defaultProvider;
    const provider = this.providers.get(providerName);

    if (!provider) {
      console.error(`[EmailProviderRegistry] Provider not found: ${providerName}`);
      return null;
    }

    if (!provider.isConfigured()) {
      console.error(`[EmailProviderRegistry] Provider not configured: ${providerName}`);
      return null;
    }

    return provider;
  }

  /**
   * Get all registered providers
   */
  getAllProviders(): EmailProvider[] {
    return Array.from(this.providers.values());
  }

  /**
   * Get configured providers only
   */
  getConfiguredProviders(): EmailProvider[] {
    return this.getAllProviders().filter(p => p.isConfigured());
  }

  /**
   * Send email using specified or default provider
   */
  async sendEmail(
    params: SendEmailParams,
    providerName?: string
  ): Promise<SendEmailResult> {
    const provider = this.getProvider(providerName);

    if (!provider) {
      return {
        success: false,
        error: `Provider ${providerName || this.defaultProvider} not available or not configured`,
        provider: providerName || this.defaultProvider,
      };
    }

    console.log('[EmailProviderRegistry] Sending email via:', provider.name);
    return provider.sendEmail(params);
  }

  /**
   * Get provider capabilities
   */
  getProviderCapabilities(providerName?: string) {
    const provider = this.providers.get(providerName || this.defaultProvider);
    return provider?.getCapabilities();
  }
}

/**
 * Singleton instance
 */
export const emailProviderRegistry = new EmailProviderRegistry();
