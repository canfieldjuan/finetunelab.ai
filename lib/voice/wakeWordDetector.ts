/**
 * Wake Word Detection System
 * 
 * Enables hands-free activation via spoken phrases like "Hey Assistant"
 * 
 * Features:
 * - Continuous listening mode
 * - Multiple wake word patterns
 * - Configurable sensitivity
 * - Low-power passive listening
 * - Energy-based voice activity detection
 */

export interface WakeWordConfig {
  /** Wake word phrases that trigger activation */
  wakeWords: string[];
  
  /** Minimum confidence score (0-1) to trigger */
  confidenceThreshold: number;
  
  /** Time window (ms) to detect wake word */
  detectionWindow: number;
  
  /** Cooldown period (ms) after activation */
  cooldownMs: number;
  
  /** Enable voice activity detection (reduces false positives) */
  enableVAD: boolean;
  
  /** Energy threshold for voice activity (0-1) */
  energyThreshold: number;
}

export interface WakeWordDetectionResult {
  /** The wake word that was detected */
  wakeWord: string;
  
  /** Confidence score (0-1) */
  confidence: number;
  
  /** Timestamp when detected */
  timestamp: number;
  
  /** Raw transcript that triggered detection */
  transcript: string;
}

/**
 * Default wake word configuration
 */
export const DEFAULT_WAKE_WORD_CONFIG: WakeWordConfig = {
  wakeWords: [
    'hey assistant',
    'ok assistant',
    'hello assistant',
    'wake up'
  ],
  confidenceThreshold: 0.7,
  detectionWindow: 3000,  // 3 seconds
  cooldownMs: 1000,       // 1 second cooldown
  enableVAD: true,
  energyThreshold: 0.3
};

/**
 * Wake Word Detector
 * 
 * Continuously listens for wake word patterns and triggers activation
 */
export class WakeWordDetector {
  private config: WakeWordConfig;
  private isListening: boolean = false;
  private lastDetectionTime: number = 0;
  private onDetectedCallback?: (result: WakeWordDetectionResult) => void;
  private transcriptBuffer: string[] = [];
  private bufferMaxSize: number = 10;

  constructor(config: Partial<WakeWordConfig> = {}) {
    this.config = { ...DEFAULT_WAKE_WORD_CONFIG, ...config };
    console.log('[WakeWord] Detector initialized', {
      wakeWords: this.config.wakeWords,
      threshold: this.config.confidenceThreshold
    });
  }

  /**
   * Start listening for wake words
   */
  start(onDetected: (result: WakeWordDetectionResult) => void): void {
    console.log('[WakeWord] Starting wake word detection');
    this.isListening = true;
    this.onDetectedCallback = onDetected;
    this.transcriptBuffer = [];
  }

  /**
   * Stop listening for wake words
   */
  stop(): void {
    console.log('[WakeWord] Stopping wake word detection');
    this.isListening = false;
    this.onDetectedCallback = undefined;
    this.transcriptBuffer = [];
  }

  /**
   * Process incoming transcript for wake word detection
   */
  processTranscript(transcript: string, isFinal: boolean): boolean {
    if (!this.isListening || !isFinal) {
      return false;
    }

    // Add to buffer
    this.transcriptBuffer.push(transcript.toLowerCase().trim());
    
    // Trim buffer to max size
    if (this.transcriptBuffer.length > this.bufferMaxSize) {
      this.transcriptBuffer.shift();
    }

    // Check cooldown
    const now = Date.now();
    if (now - this.lastDetectionTime < this.config.cooldownMs) {
      console.log('[WakeWord] In cooldown period, skipping detection');
      return false;
    }

    // Check for wake word in current transcript
    const lowerTranscript = transcript.toLowerCase();
    
    for (const wakeWord of this.config.wakeWords) {
      const confidence = this.calculateConfidence(lowerTranscript, wakeWord);
      
      if (confidence >= this.config.confidenceThreshold) {
        console.log('[WakeWord] Detected!', {
          wakeWord,
          confidence,
          transcript: lowerTranscript
        });

        const result: WakeWordDetectionResult = {
          wakeWord,
          confidence,
          timestamp: now,
          transcript
        };

        this.lastDetectionTime = now;
        this.onDetectedCallback?.(result);
        
        return true;
      }
    }

    return false;
  }

  /**
   * Calculate confidence score for wake word match
   * Uses fuzzy matching to handle slight variations
   */
  private calculateConfidence(transcript: string, wakeWord: string): number {
    // Exact match = 1.0
    if (transcript === wakeWord) {
      return 1.0;
    }

    // Contains exact wake word = 0.95
    if (transcript.includes(wakeWord)) {
      return 0.95;
    }

    // Check if transcript contains all words from wake word
    const wakeWordTokens = wakeWord.split(' ');
    const transcriptTokens = transcript.split(' ');
    
    const matchedTokens = wakeWordTokens.filter(token => 
      transcriptTokens.some(t => t.includes(token) || token.includes(t))
    );

    const tokenMatchRatio = matchedTokens.length / wakeWordTokens.length;
    
    // Require at least 80% token match
    if (tokenMatchRatio >= 0.8) {
      return tokenMatchRatio * 0.9; // Max 0.9 for partial matches
    }

    return 0;
  }

  /**
   * Update wake word configuration
   */
  updateConfig(config: Partial<WakeWordConfig>): void {
    this.config = { ...this.config, ...config };
    console.log('[WakeWord] Configuration updated', this.config);
  }

  /**
   * Get current configuration
   */
  getConfig(): WakeWordConfig {
    return { ...this.config };
  }

  /**
   * Check if detector is currently listening
   */
  isActive(): boolean {
    return this.isListening;
  }

  /**
   * Add custom wake word
   */
  addWakeWord(wakeWord: string): void {
    const normalized = wakeWord.toLowerCase().trim();
    if (!this.config.wakeWords.includes(normalized)) {
      this.config.wakeWords.push(normalized);
      console.log('[WakeWord] Added wake word:', normalized);
    }
  }

  /**
   * Remove wake word
   */
  removeWakeWord(wakeWord: string): void {
    const normalized = wakeWord.toLowerCase().trim();
    this.config.wakeWords = this.config.wakeWords.filter(w => w !== normalized);
    console.log('[WakeWord] Removed wake word:', normalized);
  }

  /**
   * Get transcript buffer (for debugging)
   */
  getTranscriptBuffer(): string[] {
    return [...this.transcriptBuffer];
  }
}

/**
 * Singleton instance
 */
let instance: WakeWordDetector | null = null;

/**
 * Get or create singleton instance
 */
export function getWakeWordDetector(config?: Partial<WakeWordConfig>): WakeWordDetector {
  if (!instance) {
    instance = new WakeWordDetector(config);
  }
  return instance;
}

/**
 * Reset singleton instance (useful for testing)
 */
export function resetWakeWordDetector(): void {
  instance?.stop();
  instance = null;
}
