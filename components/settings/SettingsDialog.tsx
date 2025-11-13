/**
 * Settings Dialog Component
 * Date: 2025-10-24
 * Modal for configuring user preferences (voice, appearance, etc.)
 */

'use client';

import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { UserSettings, UserSettingsUpdate } from '@/lib/settings/types';

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
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load available voices
  useEffect(() => {
    const loadVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      setVoices(availableVoices);
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }, []);

  // Load settings from API when dialog opens
  useEffect(() => {
    if (isOpen && sessionToken) {
      loadSettings();
    }
  }, [isOpen, sessionToken]);

  const loadSettings = async () => {
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
      }
    } catch (err) {
      console.error('[SettingsDialog] Error loading settings:', err);
      setError('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    if (!sessionToken) return;

    setSaving(true);
    setError(null);

    const updates: UserSettingsUpdate = {
      ttsEnabled,
      ttsVoiceUri: ttsVoiceUri === '__default__' ? null : ttsVoiceUri,
      ttsAutoPlay,
      sttEnabled,
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
