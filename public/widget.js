// Simple embeddable chat widget for GraphRAG UI
// Usage: <script src="https://yourdomain.com/widget.js"></script>
// This will inject a floating chat button and iframe overlay
(function () {
  if (window.GraphRAGWidget) return; // Prevent double-inject
  window.GraphRAGWidget = true;

  // Configurable options (can be extended)
  var CHAT_URL = window.GRAPHRAG_WIDGET_URL || 'https://yourdomain.com'; // Set to your deployed UI
  var BUTTON_TEXT = window.GRAPHRAG_WIDGET_BUTTON_TEXT || 'Chat';
  var IFRAME_WIDTH = 400;
  var IFRAME_HEIGHT = 600;

  // Create floating button
  var btn = document.createElement('button');
  btn.innerText = BUTTON_TEXT;
  btn.style.position = 'fixed';
  btn.style.bottom = '24px';
  btn.style.right = '24px';
  btn.style.zIndex = 99999;
  btn.style.background = '#2d3748';
  btn.style.color = '#fff';
  btn.style.border = 'none';
  btn.style.borderRadius = '24px';
  btn.style.padding = '12px 24px';
  btn.style.fontSize = '16px';
  btn.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
  btn.style.cursor = 'pointer';

  // Create iframe overlay (hidden by default)
  var iframe = document.createElement('iframe');
  iframe.src = CHAT_URL;
  iframe.style.position = 'fixed';
  iframe.style.bottom = '80px';
  iframe.style.right = '24px';
  iframe.style.width = IFRAME_WIDTH + 'px';
  iframe.style.height = IFRAME_HEIGHT + 'px';
  iframe.style.border = '1px solid #ccc';
  iframe.style.borderRadius = '12px';
  iframe.style.boxShadow = '0 4px 24px rgba(0,0,0,0.18)';
  iframe.style.zIndex = 99999;
  iframe.style.display = 'none';
  iframe.allow = 'clipboard-write; microphone; camera;';

  // Toggle iframe on button click
  btn.onclick = function () {
    iframe.style.display = iframe.style.display === 'none' ? 'block' : 'none';
  };

  // Hide iframe if user clicks outside
  document.addEventListener('mousedown', function (e) {
    if (iframe.style.display === 'block' && !iframe.contains(e.target) && e.target !== btn) {
      iframe.style.display = 'none';
    }
  });

  // Add to DOM
  document.body.appendChild(btn);
  document.body.appendChild(iframe);
})();

// ============================================================================
// MODEL TESTING WIDGET - Configuration System
// ============================================================================

/**
 * ModelTestingWidget namespace for model testing configuration
 * Enables companies to embed chat UI to test their production models
 */
window.ModelTestingWidget = window.ModelTestingWidget || {
  /**
   * Initialize model testing widget with configuration
   * @param {Object} config - Widget configuration
   * @param {string} config.apiKey - Widget API key (wak_...)
   * @param {string} config.modelId - Custom model ID to test
   * @param {string} config.userId - Optional user identifier for tracking
   * @param {string} config.theme - Optional UI theme (light/dark)
   * @param {string} config.baseUrl - Optional base URL (default: current domain)
   */
  init: function(config) {
    console.log('[ModelTestingWidget] Initializing with config:', {
      modelId: config?.modelId,
      hasApiKey: !!config?.apiKey,
      userId: config?.userId
    });

    // Validation
    if (!config || typeof config !== 'object') {
      console.error('[ModelTestingWidget] Invalid config: must be an object');
      return false;
    }

    if (!config.apiKey || typeof config.apiKey !== 'string') {
      console.error('[ModelTestingWidget] Missing required field: apiKey (string)');
      return false;
    }

    if (!config.modelId || typeof config.modelId !== 'string') {
      console.error('[ModelTestingWidget] Missing required field: modelId (string)');
      return false;
    }

    // Generate unique widget session ID for tracking
    var sessionId = 'widget_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
    console.log('[ModelTestingWidget] Generated session ID:', sessionId);

    // Build base URL (use provided or current origin)
    var baseUrl = config.baseUrl || window.location.origin;
    if (baseUrl.endsWith('/')) {
      baseUrl = baseUrl.slice(0, -1); // Remove trailing slash
    }

    // Build URL params for widget mode
    var params = new URLSearchParams();
    params.set('widget', 'true');
    params.set('session', sessionId);
    params.set('model', config.modelId);
    params.set('key', config.apiKey);

    if (config.userId) {
      params.set('user', config.userId);
    }

    if (config.theme) {
      params.set('theme', config.theme);
    }

    var iframeUrl = baseUrl + '/chat?' + params.toString();
    console.log('[ModelTestingWidget] Widget URL constructed (key hidden)');
    console.log('[ModelTestingWidget] Session:', sessionId, 'Model:', config.modelId);

    // Create floating chat button
    var widgetBtn = document.createElement('button');
    widgetBtn.innerText = config.buttonText || 'Test Model';
    widgetBtn.id = 'model-testing-widget-btn';
    widgetBtn.style.position = 'fixed';
    widgetBtn.style.bottom = '24px';
    widgetBtn.style.right = '24px';
    widgetBtn.style.zIndex = '99999';
    widgetBtn.style.background = '#2563eb';
    widgetBtn.style.color = '#fff';
    widgetBtn.style.border = 'none';
    widgetBtn.style.borderRadius = '24px';
    widgetBtn.style.padding = '12px 24px';
    widgetBtn.style.fontSize = '16px';
    widgetBtn.style.fontWeight = '600';
    widgetBtn.style.boxShadow = '0 4px 12px rgba(37, 99, 235, 0.3)';
    widgetBtn.style.cursor = 'pointer';
    widgetBtn.style.transition = 'all 0.2s ease';

    // Hover effect
    widgetBtn.onmouseover = function() {
      this.style.transform = 'translateY(-2px)';
      this.style.boxShadow = '0 6px 16px rgba(37, 99, 235, 0.4)';
    };
    widgetBtn.onmouseout = function() {
      this.style.transform = 'translateY(0)';
      this.style.boxShadow = '0 4px 12px rgba(37, 99, 235, 0.3)';
    };

    // Create iframe for chat interface
    var widgetIframe = document.createElement('iframe');
    widgetIframe.src = iframeUrl;
    widgetIframe.id = 'model-testing-widget-iframe';
    widgetIframe.style.position = 'fixed';
    widgetIframe.style.bottom = '80px';
    widgetIframe.style.right = '24px';
    widgetIframe.style.width = '400px';
    widgetIframe.style.height = '600px';
    widgetIframe.style.maxHeight = 'calc(100vh - 120px)';
    widgetIframe.style.border = 'none';
    widgetIframe.style.borderRadius = '12px';
    widgetIframe.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.12)';
    widgetIframe.style.zIndex = '99998';
    widgetIframe.style.display = 'none';
    widgetIframe.style.transition = 'opacity 0.2s ease';
    widgetIframe.allow = 'clipboard-write';

    // Toggle iframe visibility on button click
    var isOpen = false;
    widgetBtn.onclick = function() {
      isOpen = !isOpen;
      widgetIframe.style.display = isOpen ? 'block' : 'none';
      widgetBtn.innerText = isOpen ? '✕ Close' : (config.buttonText || 'Test Model');
      console.log('[ModelTestingWidget] Widget', isOpen ? 'opened' : 'closed');
    };

    // Close widget when clicking outside
    document.addEventListener('mousedown', function(e) {
      if (isOpen &&
          !widgetIframe.contains(e.target) &&
          e.target !== widgetBtn &&
          !widgetBtn.contains(e.target)) {
        isOpen = false;
        widgetIframe.style.display = 'none';
        widgetBtn.innerText = config.buttonText || 'Test Model';
        console.log('[ModelTestingWidget] Widget closed (clicked outside)');
      }
    });

    // Inject widget into DOM
    document.body.appendChild(widgetBtn);
    document.body.appendChild(widgetIframe);

    // Send widget configuration to iframe via postMessage when loaded
    widgetIframe.onload = function() {
      console.log('[ModelTestingWidget] Iframe loaded, sending config via postMessage');

      try {
        var message = {
          type: 'WIDGET_CONFIG',
          payload: {
            sessionId: sessionId,
            modelId: config.modelId,
            userId: config.userId,
            theme: config.theme,
            timestamp: Date.now()
          }
        };

        // Send to iframe (target origin should match baseUrl)
        widgetIframe.contentWindow.postMessage(message, baseUrl);
        console.log('[ModelTestingWidget] Config sent to iframe:', message.type);
      } catch (error) {
        console.error('[ModelTestingWidget] Error sending postMessage:', error);
      }
    };

    // Listen for messages from iframe (optional - for future bidirectional communication)
    window.addEventListener('message', function(event) {
      // Verify origin matches expected baseUrl
      if (event.origin !== baseUrl) {
        console.warn('[ModelTestingWidget] Received message from unexpected origin:', event.origin);
        return;
      }

      // Handle messages from widget iframe
      if (event.data && event.data.type && event.data.type.startsWith('WIDGET_')) {
        console.log('[ModelTestingWidget] Received message from iframe:', event.data.type);

        // Handle different message types (expandable for future features)
        switch (event.data.type) {
          case 'WIDGET_READY':
            console.log('[ModelTestingWidget] Iframe reports ready');
            break;
          case 'WIDGET_ERROR':
            console.error('[ModelTestingWidget] Iframe reports error:', event.data.payload);
            break;
          default:
            console.log('[ModelTestingWidget] Unknown message type:', event.data.type);
        }
      }
    });

    console.log('[ModelTestingWidget] Widget initialized successfully');
    return {
      success: true,
      sessionId: sessionId,
      modelId: config.modelId
    };
  }
};
