/**
 * Settings Dialog Component
 * Date: 2025-10-24
 * Modal for configuring user preferences (voice, appearance, model defaults, etc.)
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { UserSettings, UserSettingsUpdate } from '@/lib/settings/types';

interface AvailableModel {
  id: string;
  name: string;
  provider: string;
  providerName: string;
  modelId: string;
  description?: string;
}

interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  sessionToken?: string;
  onSettingsChange?: (settings: UserSettings) => void;
}

export function SettingsDialog({
  isOpen,
  onClose,
  sessionToken,
  onSettingsChange,
}: SettingsDialogProps) {
  // Local state for settings
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [ttsVoiceUri, setTtsVoiceUri] = useState<string>('__default__');
  const [ttsAutoPlay, setTtsAutoPlay] = useState(false);
  const [sttEnabled, setSttEnabled] = useState(false);
  const [defaultModelId, setDefaultModelId] = useState<string>('__none__');
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [availableModels, setAvailableModels] = useState<AvailableModel[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Embedding settings state
  const [embeddingProvider, setEmbeddingProvider] = useState<'openai' | 'runpod'>('openai');
  const [embeddingBaseUrl, setEmbeddingBaseUrl] = useState<string>('');
  const [embeddingModel, setEmbeddingModel] = useState<string>('');

  // Load available voices
  useEffect(() => {
    const loadVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      setVoices(availableVoices);
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }, []);

  const loadAvailableModels = useCallback(async () => {
    if (!sessionToken) return;

    setLoadingModels(true);
    try {
      const response = await fetch('/api/settings/available-models', {
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
        },
      });

      if (!response.ok) {
        console.error('[SettingsDialog] Failed to load available models');
        return;
      }

      const data = await response.json();
      if (data.success && data.models) {
        setAvailableModels(data.models);
      }
    } catch (err) {
      console.error('[SettingsDialog] Error loading available models:', err);
    } finally {
      setLoadingModels(false);
    }
  }, [sessionToken]);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/settings', {
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load settings');
      }

      const data = await response.json();

      // If settings exist, populate form
      if (data.settings) {
        setTtsEnabled(data.settings.ttsEnabled);
        setTtsVoiceUri(data.settings.ttsVoiceUri || '__default__');
        setTtsAutoPlay(data.settings.ttsAutoPlay);
        setSttEnabled(data.settings.sttEnabled);
        setDefaultModelId(data.settings.defaultModelId || '__none__');
        setEmbeddingProvider(data.settings.embeddingProvider || 'openai');
        setEmbeddingBaseUrl(data.settings.embeddingBaseUrl || '');
        setEmbeddingModel(data.settings.embeddingModel || '');
      }
    } catch (err) {
      console.error('[SettingsDialog] Error loading settings:', err);
      setError('Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, [sessionToken]);

  // Load settings and available models when dialog opens
  useEffect(() => {
    if (isOpen && sessionToken) {
      loadSettings();
      loadAvailableModels();
    }
  }, [isOpen, sessionToken, loadSettings, loadAvailableModels]);

  const saveSettings = async () => {
    if (!sessionToken) return;

    setSaving(true);
    setError(null);

    // Find selected model to get its provider
    const selectedModel = availableModels.find(m => m.id === defaultModelId);

    const updates: UserSettingsUpdate = {
      ttsEnabled,
      ttsVoiceUri: ttsVoiceUri === '__default__' ? null : ttsVoiceUri,
      ttsAutoPlay,
      sttEnabled,
      defaultModelId: defaultModelId === '__none__' ? null : defaultModelId,
      defaultModelProvider: selectedModel?.provider || null,
      embeddingProvider: embeddingProvider,
      embeddingBaseUrl: embeddingBaseUrl || null,
      embeddingModel: embeddingModel || null,
    };

    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error('Failed to save settings');
      }

      const data = await response.json();

      // Notify parent component
      if (onSettingsChange && data.settings) {
        onSettingsChange(data.settings);
      }

      // Close dialog after successful save
      onClose();
    } catch (err) {
      console.error('[SettingsDialog] Error saving settings:', err);
      setError('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Modal Overlay */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="bg-background border rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b">
            <h2 className="text-xl font-semibold">Settings</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-muted rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {loading ? (
              <div className="flex justify-center items-center py-8">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="space-y-6">
                {/* Error Message */}
                {error && (
                  <div className="p-4 bg-destructive/10 text-destructive rounded-lg text-sm">
                    {error}
                  </div>
                )}

                {/* Voice & Audio Section */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">Voice & Audio</h3>
                  <div className="space-y-4">
                    {/* Text-to-Speech Toggle */}
                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="tts-enabled" className="text-sm font-medium">
                          Enable Text-to-Speech
                        </Label>
                        <p className="text-xs text-muted-foreground mt-1">
                          Allow assistant to speak responses aloud
                        </p>
                      </div>
                      <Switch
                        id="tts-enabled"
                        checked={ttsEnabled}
                        onCheckedChange={setTtsEnabled}
                      />
                    </div>

                    {/* Voice Selection - only show if TTS enabled */}
                    {ttsEnabled && (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="voice-select">Voice</Label>
                          <Select
                            value={ttsVoiceUri}
                            onValueChange={setTtsVoiceUri}
                          >
                            <SelectTrigger id="voice-select">
                              <SelectValue placeholder="Default voice" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__default__">Default voice</SelectItem>
                              {voices.map((voice) => (
                                <SelectItem key={voice.voiceURI} value={voice.voiceURI}>
                                  {voice.name} ({voice.lang})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Auto-play Toggle */}
                        <div className="flex items-center justify-between">
                          <div>
                            <Label htmlFor="auto-play" className="text-sm font-medium">
                              Auto-play responses
                            </Label>
                            <p className="text-xs text-muted-foreground mt-1">
                              Automatically speak new assistant messages
                            </p>
                          </div>
                          <Switch
                            id="auto-play"
                            checked={ttsAutoPlay}
                            onCheckedChange={setTtsAutoPlay}
                          />
                        </div>
                      </>
                    )}

                    {/* Speech-to-Text Toggle */}
                    <div className="flex items-center justify-between pt-4 border-t">
                      <div>
                        <Label htmlFor="stt-enabled" className="text-sm font-medium">
                          Enable Speech-to-Text
                        </Label>
                        <p className="text-xs text-muted-foreground mt-1">
                          Show microphone button for voice input
                        </p>
                      </div>
                      <Switch
                        id="stt-enabled"
                        checked={sttEnabled}
                        onCheckedChange={setSttEnabled}
                      />
                    </div>
                  </div>
                </div>

                {/* Model Settings Section */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">Model Settings</h3>
                  <div className="space-y-4">
                    {/* Default Model Selection */}
                    <div className="space-y-2">
                      <Label htmlFor="default-model">Default Model</Label>
                      <p className="text-xs text-muted-foreground">
                        Select the model to use by default in new conversations
                      </p>
                      {loadingModels ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                          Loading available models...
                        </div>
                      ) : availableModels.length === 0 ? (
                        <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg text-sm">
                          <AlertCircle className="w-4 h-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                          <div>
                            <p className="text-muted-foreground">
                              No provider models available. Add API keys for providers like OpenAI or Anthropic to enable default model selection.
                            </p>
                          </div>
                        </div>
                      ) : (
                        <Select
                          value={defaultModelId}
                          onValueChange={setDefaultModelId}
                        >
                          <SelectTrigger id="default-model">
                            <SelectValue placeholder="Select a default model" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">No default (use model picker)</SelectItem>
                            {availableModels.map((model) => (
                              <SelectItem key={model.id} value={model.id}>
                                {model.name} ({model.providerName})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}

                      {/* GPT-5 Pro Cost Warning */}
                      {(() => {
                        const selectedModel = availableModels.find(m => m.id === defaultModelId);
                        const isGpt5Pro = selectedModel?.name === 'GPT-5 Pro' || selectedModel?.modelId?.includes('gpt-5-pro');
                        return defaultModelId !== '__none__' && isGpt5Pro ? (
                          <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-sm mt-3">
                            <AlertCircle className="w-4 h-4 mt-0.5 text-amber-600 dark:text-amber-500 flex-shrink-0" />
                            <div className="space-y-1">
                              <p className="font-semibold text-amber-900 dark:text-amber-400">
                                High-Cost Model Warning
                              </p>
                              <p className="text-amber-800 dark:text-amber-300">
                                GPT-5 Pro costs <strong>10x more</strong> than standard GPT and Anthropic models. This model uses extended reasoning for superior performance on complex tasks.
                              </p>
                              <p className="text-amber-800 dark:text-amber-300">
                                <strong>Best for:</strong> LLM judgments, complex reasoning tasks. <strong>Use with caution</strong> - costs can accumulate quickly.
                              </p>
                            </div>
                          </div>
                        ) : null;
                      })()}
                    </div>
                  </div>
                </div>

                {/* Embedding Provider Section */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">Embedding Provider</h3>
                  <p className="text-xs text-muted-foreground mb-4">
                    Configure the embedding model used for Knowledge Graph (GraphRAG) document processing and search.
                  </p>
                  <div className="space-y-4">
                    {/* Provider Selection */}
                    <div className="space-y-2">
                      <Label htmlFor="embedding-provider">Provider</Label>
                      <Select
                        value={embeddingProvider}
                        onValueChange={(value: 'openai' | 'runpod') => setEmbeddingProvider(value)}
                      >
                        <SelectTrigger id="embedding-provider">
                          <SelectValue placeholder="Select embedding provider" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="openai">OpenAI (Default)</SelectItem>
                          <SelectItem value="runpod">RunPod Serverless</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* RunPod-specific settings */}
                    {embeddingProvider === 'runpod' && (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="embedding-base-url">Endpoint URL</Label>
                          <input
                            id="embedding-base-url"
                            type="text"
                            value={embeddingBaseUrl}
                            onChange={(e) => setEmbeddingBaseUrl(e.target.value)}
                            placeholder="https://api.runpod.ai/v2/your-endpoint-id/openai/v1"
                            className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm"
                          />
                          <p className="text-xs text-muted-foreground">
                            Your RunPod serverless endpoint URL (OpenAI-compatible)
                          </p>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="embedding-model">Model Name</Label>
                          <input
                            id="embedding-model"
                            type="text"
                            value={embeddingModel}
                            onChange={(e) => setEmbeddingModel(e.target.value)}
                            placeholder="BAAI/bge-large-en-v1.5"
                            className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm"
                          />
                          <p className="text-xs text-muted-foreground">
                            HuggingFace model ID deployed on your endpoint
                          </p>
                        </div>
                      </>
                    )}

                    {/* OpenAI info */}
                    {embeddingProvider === 'openai' && (
                      <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg text-sm">
                        <AlertCircle className="w-4 h-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                        <div>
                          <p className="text-muted-foreground">
                            Using OpenAI&apos;s text-embedding-3-small model. Ensure you have an OpenAI API key configured in your secrets.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 p-6 border-t">
            <Button
              onClick={onClose}
              variant="outline"
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              onClick={saveSettings}
              disabled={saving || loading}
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
