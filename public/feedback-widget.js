/**
 * Feedback Widget
 * B2B SaaS Widget Feedback Collection System
 * Date: 2025-10-17
 * 
 * Usage:
 * <script src="https://your-domain.com/feedback-widget.js"></script>
 * <script>
 *   FeedbackWidget.init({
 *     apiKey: 'wak_your_api_key_here',
 *     apiUrl: 'https://your-domain.com/api/feedback/collect',
 *     position: 'bottom-right', // 'bottom-right', 'bottom-left', 'top-right', 'top-left'
 *     theme: 'light', // 'light' or 'dark'
 *     primaryColor: '#3b82f6',
 *     triggerText: '💬 Feedback',
 *   });
 * </script>
 */

(function(window) {
  'use strict';

  // ============================================================================
  // CONFIGURATION & STATE
  // ============================================================================

  const FeedbackWidget = {
    config: {
      apiKey: null,
      apiUrl: null,
      position: 'bottom-right',
      theme: 'light',
      primaryColor: '#3b82f6',
      triggerText: '💬 Feedback',
    },
    state: {
      isOpen: false,
      isSubmitting: false,
      currentRating: 0,
      currentSentiment: null, // 'positive' or 'negative'
      selectedTags: [],
    },
    elements: {},
  };

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  FeedbackWidget.init = function(options) {
    // Validate required options
    if (!options || !options.apiKey) {
      console.error('[FeedbackWidget] API key is required');
      return;
    }

    if (!options.apiUrl) {
      console.error('[FeedbackWidget] API URL is required');
      return;
    }

    // Merge options with defaults
    Object.assign(this.config, options);

    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.render());
    } else {
      this.render();
    }

    console.log('[FeedbackWidget] Initialized with config:', {
      position: this.config.position,
      theme: this.config.theme,
      apiUrl: this.config.apiUrl,
    });
  };

  // ============================================================================
  // RENDER UI
  // ============================================================================

  FeedbackWidget.render = function() {
    // Inject styles
    this.injectStyles();

    // Create trigger button
    this.createTriggerButton();

    // Create modal (hidden by default)
    this.createModal();

    console.log('[FeedbackWidget] UI rendered');
  };

  FeedbackWidget.injectStyles = function() {
    const styleId = 'feedback-widget-styles';
    if (document.getElementById(styleId)) return;

    const styles = `
      /* Widget Trigger Button */
      .feedback-widget-trigger {
        position: fixed;
        z-index: 999998;
        padding: 12px 20px;
        background: ${this.config.primaryColor};
        color: white;
        border: none;
        border-radius: 24px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .feedback-widget-trigger:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
      }

      .feedback-widget-trigger.bottom-right {
        bottom: 20px;
        right: 20px;
      }

      .feedback-widget-trigger.bottom-left {
        bottom: 20px;
        left: 20px;
      }

      .feedback-widget-trigger.top-right {
        top: 20px;
        right: 20px;
      }

      .feedback-widget-trigger.top-left {
        top: 20px;
        left: 20px;
      }

      /* Modal Overlay */
      .feedback-widget-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        z-index: 999999;
        display: none;
        align-items: center;
        justify-content: center;
        padding: 20px;
        animation: fadeIn 0.2s ease;
      }

      .feedback-widget-overlay.open {
        display: flex;
      }

      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }

      /* Modal Content */
      .feedback-widget-modal {
        background: ${this.config.theme === 'dark' ? '#1f2937' : '#ffffff'};
        color: ${this.config.theme === 'dark' ? '#f9fafb' : '#1f2937'};
        border-radius: 16px;
        max-width: 500px;
        width: 100%;
        max-height: 90vh;
        overflow-y: auto;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        animation: slideUp 0.3s ease;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      }

      @keyframes slideUp {
        from {
          transform: translateY(20px);
          opacity: 0;
        }
        to {
          transform: translateY(0);
          opacity: 1;
        }
      }

      /* Modal Header */
      .feedback-widget-header {
        padding: 24px 24px 16px;
        border-bottom: 1px solid ${this.config.theme === 'dark' ? '#374151' : '#e5e7eb'};
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .feedback-widget-title {
        font-size: 20px;
        font-weight: 700;
        margin: 0;
      }

      .feedback-widget-close {
        background: none;
        border: none;
        font-size: 24px;
        color: ${this.config.theme === 'dark' ? '#9ca3af' : '#6b7280'};
        cursor: pointer;
        padding: 0;
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 8px;
        transition: all 0.2s ease;
      }

      .feedback-widget-close:hover {
        background: ${this.config.theme === 'dark' ? '#374151' : '#f3f4f6'};
        color: ${this.config.theme === 'dark' ? '#f9fafb' : '#1f2937'};
      }

      /* Modal Body */
      .feedback-widget-body {
        padding: 24px;
      }

      .feedback-widget-section {
        margin-bottom: 24px;
      }

      .feedback-widget-section:last-child {
        margin-bottom: 0;
      }

      .feedback-widget-label {
        display: block;
        font-size: 14px;
        font-weight: 600;
        margin-bottom: 12px;
        color: ${this.config.theme === 'dark' ? '#f9fafb' : '#1f2937'};
      }

      /* Star Rating */
      .feedback-widget-stars {
        display: flex;
        gap: 8px;
        margin-bottom: 8px;
      }

      .feedback-widget-star {
        font-size: 32px;
        cursor: pointer;
        transition: all 0.2s ease;
        user-select: none;
      }

      .feedback-widget-star.empty {
        color: ${this.config.theme === 'dark' ? '#4b5563' : '#d1d5db'};
      }

      .feedback-widget-star.filled {
        color: #fbbf24;
      }

      .feedback-widget-star:hover {
        transform: scale(1.1);
      }

      /* Sentiment Buttons */
      .feedback-widget-sentiment {
        display: flex;
        gap: 12px;
      }

      .feedback-widget-sentiment-btn {
        flex: 1;
        padding: 12px 16px;
        border: 2px solid ${this.config.theme === 'dark' ? '#374151' : '#e5e7eb'};
        background: ${this.config.theme === 'dark' ? '#1f2937' : '#ffffff'};
        color: ${this.config.theme === 'dark' ? '#f9fafb' : '#1f2937'};
        border-radius: 12px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
      }

      .feedback-widget-sentiment-btn:hover {
        border-color: ${this.config.primaryColor};
        background: ${this.config.primaryColor}10;
      }

      .feedback-widget-sentiment-btn.active {
        border-color: ${this.config.primaryColor};
        background: ${this.config.primaryColor};
        color: white;
      }

      /* Tags */
      .feedback-widget-tags {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .feedback-widget-tag {
        padding: 8px 16px;
        border: 2px solid ${this.config.theme === 'dark' ? '#374151' : '#e5e7eb'};
        background: ${this.config.theme === 'dark' ? '#1f2937' : '#ffffff'};
        color: ${this.config.theme === 'dark' ? '#f9fafb' : '#1f2937'};
        border-radius: 20px;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
        user-select: none;
      }

      .feedback-widget-tag:hover {
        border-color: ${this.config.primaryColor};
        background: ${this.config.primaryColor}10;
      }

      .feedback-widget-tag.active {
        border-color: ${this.config.primaryColor};
        background: ${this.config.primaryColor};
        color: white;
      }

      /* Text Input */
      .feedback-widget-textarea {
        width: 100%;
        min-height: 100px;
        padding: 12px;
        border: 2px solid ${this.config.theme === 'dark' ? '#374151' : '#e5e7eb'};
        background: ${this.config.theme === 'dark' ? '#111827' : '#ffffff'};
        color: ${this.config.theme === 'dark' ? '#f9fafb' : '#1f2937'};
        border-radius: 12px;
        font-size: 14px;
        font-family: inherit;
        resize: vertical;
        transition: all 0.2s ease;
      }

      .feedback-widget-textarea:focus {
        outline: none;
        border-color: ${this.config.primaryColor};
        box-shadow: 0 0 0 3px ${this.config.primaryColor}20;
      }

      .feedback-widget-textarea::placeholder {
        color: ${this.config.theme === 'dark' ? '#6b7280' : '#9ca3af'};
      }

      /* Submit Button */
      .feedback-widget-submit {
        width: 100%;
        padding: 14px 24px;
        background: ${this.config.primaryColor};
        color: white;
        border: none;
        border-radius: 12px;
        font-size: 16px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
        margin-top: 24px;
      }

      .feedback-widget-submit:hover:not(:disabled) {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px ${this.config.primaryColor}40;
      }

      .feedback-widget-submit:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      /* Success Message */
      .feedback-widget-success {
        text-align: center;
        padding: 40px 24px;
      }

      .feedback-widget-success-icon {
        font-size: 64px;
        margin-bottom: 16px;
      }

      .feedback-widget-success-title {
        font-size: 20px;
        font-weight: 700;
        margin-bottom: 8px;
      }

      .feedback-widget-success-message {
        font-size: 14px;
        color: ${this.config.theme === 'dark' ? '#9ca3af' : '#6b7280'};
        margin-bottom: 24px;
      }

      /* Error Message */
      .feedback-widget-error {
        padding: 12px 16px;
        background: #fee;
        border: 1px solid #fcc;
        border-radius: 8px;
        color: #c00;
        font-size: 14px;
        margin-bottom: 16px;
      }

      /* Mobile Responsive */
      @media (max-width: 640px) {
        .feedback-widget-modal {
          max-width: 100%;
          border-radius: 16px 16px 0 0;
          max-height: 95vh;
        }

        .feedback-widget-trigger {
          bottom: 16px;
          right: 16px;
          left: auto;
        }

        .feedback-widget-trigger.bottom-left {
          left: 16px;
        }

        .feedback-widget-stars {
          justify-content: center;
        }

        .feedback-widget-star {
          font-size: 28px;
        }
      }

      /* Loading Spinner */
      .feedback-widget-spinner {
        display: inline-block;
        width: 16px;
        height: 16px;
        border: 2px solid rgba(255, 255, 255, 0.3);
        border-top-color: white;
        border-radius: 50%;
        animation: spin 0.6s linear infinite;
      }

      @keyframes spin {
        to { transform: rotate(360deg); }
      }
    `;

    const styleElement = document.createElement('style');
    styleElement.id = styleId;
    styleElement.textContent = styles;
    document.head.appendChild(styleElement);
  };

  FeedbackWidget.createTriggerButton = function() {
    const button = document.createElement('button');
    button.className = `feedback-widget-trigger ${this.config.position}`;
    button.innerHTML = this.config.triggerText;
    button.onclick = () => this.open();
    
    document.body.appendChild(button);
    this.elements.trigger = button;
  };

  FeedbackWidget.createModal = function() {
    const overlay = document.createElement('div');
    overlay.className = 'feedback-widget-overlay';
    overlay.onclick = (e) => {
      if (e.target === overlay) this.close();
    };

    const modal = document.createElement('div');
    modal.className = 'feedback-widget-modal';
    modal.onclick = (e) => e.stopPropagation();

    modal.innerHTML = this.getModalContent();

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    this.elements.overlay = overlay;
    this.elements.modal = modal;

    // Attach event listeners
    this.attachEventListeners();
  };

  FeedbackWidget.getModalContent = function() {
    return `
      <div class="feedback-widget-header">
        <h2 class="feedback-widget-title">Share Your Feedback</h2>
        <button class="feedback-widget-close" data-action="close">×</button>
      </div>
      <div class="feedback-widget-body">
        <div id="feedback-widget-form">
          <!-- Star Rating -->
          <div class="feedback-widget-section">
            <label class="feedback-widget-label">How would you rate your experience?</label>
            <div class="feedback-widget-stars" data-rating="0">
              ${[1, 2, 3, 4, 5].map(i => `<span class="feedback-widget-star empty" data-star="${i}">★</span>`).join('')}
            </div>
          </div>

          <!-- Sentiment -->
          <div class="feedback-widget-section">
            <label class="feedback-widget-label">Overall feeling</label>
            <div class="feedback-widget-sentiment">
              <button class="feedback-widget-sentiment-btn" data-sentiment="positive">
                <span>👍</span>
                <span>Positive</span>
              </button>
              <button class="feedback-widget-sentiment-btn" data-sentiment="negative">
                <span>👎</span>
                <span>Negative</span>
              </button>
            </div>
          </div>

          <!-- Tags -->
          <div class="feedback-widget-section">
            <label class="feedback-widget-label">What's this about? (Optional)</label>
            <div class="feedback-widget-tags">
              <button class="feedback-widget-tag" data-tag="Bug">🐛 Bug</button>
              <button class="feedback-widget-tag" data-tag="Feature Request">✨ Feature</button>
              <button class="feedback-widget-tag" data-tag="UI/UX">🎨 Design</button>
              <button class="feedback-widget-tag" data-tag="Performance">⚡ Speed</button>
              <button class="feedback-widget-tag" data-tag="Documentation">📖 Docs</button>
              <button class="feedback-widget-tag" data-tag="Other">💬 Other</button>
            </div>
          </div>

          <!-- Comment -->
          <div class="feedback-widget-section">
            <label class="feedback-widget-label">Tell us more (Optional)</label>
            <textarea 
              class="feedback-widget-textarea" 
              data-field="comment"
              placeholder="Share your thoughts, suggestions, or report an issue..."
              maxlength="1000"
            ></textarea>
          </div>

          <!-- Error Display -->
          <div id="feedback-widget-error" style="display: none;"></div>

          <!-- Submit Button -->
          <button class="feedback-widget-submit" data-action="submit">
            Send Feedback
          </button>
        </div>

        <!-- Success State (Hidden Initially) -->
        <div id="feedback-widget-success" class="feedback-widget-success" style="display: none;">
          <div class="feedback-widget-success-icon">🎉</div>
          <h3 class="feedback-widget-success-title">Thank You!</h3>
          <p class="feedback-widget-success-message">
            Your feedback has been received and will help us improve.
          </p>
          <button class="feedback-widget-submit" data-action="close">
            Close
          </button>
        </div>
      </div>
    `;
  };

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  FeedbackWidget.attachEventListeners = function() {
    const modal = this.elements.modal;

    // Close button
    modal.querySelectorAll('[data-action="close"]').forEach(btn => {
      btn.onclick = () => this.close();
    });

    // Star rating
    const starsContainer = modal.querySelector('.feedback-widget-stars');
    const stars = modal.querySelectorAll('.feedback-widget-star');
    
    stars.forEach(star => {
      star.onclick = () => {
        const rating = parseInt(star.dataset.star);
        this.state.currentRating = rating;
        this.updateStars(rating);
      };

      star.onmouseenter = () => {
        const rating = parseInt(star.dataset.star);
        this.updateStars(rating);
      };
    });

    starsContainer.onmouseleave = () => {
      this.updateStars(this.state.currentRating);
    };

    // Sentiment buttons
    modal.querySelectorAll('[data-sentiment]').forEach(btn => {
      btn.onclick = () => {
        const sentiment = btn.dataset.sentiment;
        this.state.currentSentiment = sentiment;
        
        modal.querySelectorAll('[data-sentiment]').forEach(b => {
          b.classList.toggle('active', b === btn);
        });
      };
    });

    // Tag buttons
    modal.querySelectorAll('[data-tag]').forEach(btn => {
      btn.onclick = () => {
        const tag = btn.dataset.tag;
        const index = this.state.selectedTags.indexOf(tag);
        
        if (index > -1) {
          this.state.selectedTags.splice(index, 1);
          btn.classList.remove('active');
        } else {
          this.state.selectedTags.push(tag);
          btn.classList.add('active');
        }
      };
    });

    // Submit button
    modal.querySelector('[data-action="submit"]').onclick = () => {
      this.submit();
    };
  };

  FeedbackWidget.updateStars = function(rating) {
    const stars = this.elements.modal.querySelectorAll('.feedback-widget-star');
    
    stars.forEach((star, index) => {
      const starValue = index + 1;
      if (starValue <= rating) {
        star.classList.remove('empty');
        star.classList.add('filled');
      } else {
        star.classList.remove('filled');
        star.classList.add('empty');
      }
    });
  };

  // ============================================================================
  // MODAL CONTROLS
  // ============================================================================

  FeedbackWidget.open = function() {
    this.state.isOpen = true;
    this.elements.overlay.classList.add('open');
    this.resetForm();
    console.log('[FeedbackWidget] Modal opened');
  };

  FeedbackWidget.close = function() {
    this.state.isOpen = false;
    this.elements.overlay.classList.remove('open');
    console.log('[FeedbackWidget] Modal closed');
  };

  FeedbackWidget.resetForm = function() {
    // Reset state
    this.state.currentRating = 0;
    this.state.currentSentiment = null;
    this.state.selectedTags = [];

    // Reset UI
    this.updateStars(0);
    
    this.elements.modal.querySelectorAll('[data-sentiment]').forEach(btn => {
      btn.classList.remove('active');
    });

    this.elements.modal.querySelectorAll('[data-tag]').forEach(btn => {
      btn.classList.remove('active');
    });

    this.elements.modal.querySelector('[data-field="comment"]').value = '';

    // Hide success, show form
    document.getElementById('feedback-widget-success').style.display = 'none';
    document.getElementById('feedback-widget-form').style.display = 'block';
    
    // Hide error
    this.hideError();
  };

  // ============================================================================
  // FORM SUBMISSION
  // ============================================================================

  FeedbackWidget.submit = function() {
    if (this.state.isSubmitting) return;

    // Validate
    if (this.state.currentRating === 0 && this.state.currentSentiment === null) {
      this.showError('Please provide a rating or sentiment');
      return;
    }

    const comment = this.elements.modal.querySelector('[data-field="comment"]').value.trim();

    // Prepare payload
    const payload = {
      rating: this.state.currentRating || null,
      sentiment: this.state.currentSentiment,
      comment: comment || null,
      tags: this.state.selectedTags.length > 0 ? this.state.selectedTags : null,
      page_url: window.location.href,
      user_agent: navigator.userAgent,
    };

    console.log('[FeedbackWidget] Submitting feedback:', payload);

    this.state.isSubmitting = true;
    this.updateSubmitButton(true);
    this.hideError();

    // Make API request
    fetch(this.config.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.config.apiKey,
      },
      body: JSON.stringify(payload),
    })
      .then(response => {
        if (!response.ok) {
          return response.json().then(data => {
            throw new Error(data.error || `HTTP ${response.status}`);
          });
        }
        return response.json();
      })
      .then(data => {
        console.log('[FeedbackWidget] Feedback submitted successfully:', data);
        this.showSuccess();
      })
      .catch(error => {
        console.error('[FeedbackWidget] Submission failed:', error);
        this.showError(error.message || 'Failed to submit feedback. Please try again.');
      })
      .finally(() => {
        this.state.isSubmitting = false;
        this.updateSubmitButton(false);
      });
  };

  FeedbackWidget.updateSubmitButton = function(isLoading) {
    const button = this.elements.modal.querySelector('[data-action="submit"]');
    
    if (isLoading) {
      button.disabled = true;
      button.innerHTML = '<span class="feedback-widget-spinner"></span> Sending...';
    } else {
      button.disabled = false;
      button.innerHTML = 'Send Feedback';
    }
  };

  FeedbackWidget.showSuccess = function() {
    document.getElementById('feedback-widget-form').style.display = 'none';
    document.getElementById('feedback-widget-success').style.display = 'block';
  };

  FeedbackWidget.showError = function(message) {
    const errorEl = document.getElementById('feedback-widget-error');
    errorEl.className = 'feedback-widget-error';
    errorEl.textContent = message;
    errorEl.style.display = 'block';
  };

  FeedbackWidget.hideError = function() {
    const errorEl = document.getElementById('feedback-widget-error');
    errorEl.style.display = 'none';
  };

  // ============================================================================
  // EXPORT
  // ============================================================================

  window.FeedbackWidget = FeedbackWidget;

  console.log('[FeedbackWidget] Script loaded. Call FeedbackWidget.init() to initialize.');

})(window);
