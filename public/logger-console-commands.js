/**
 * Browser Console Logger Diagnostics
 * 
 * Copy and paste these commands into your browser console (F12)
 * to debug infinite loops and performance issues.
 * 
 * NOTE: The __logger object is only available AFTER the page loads.
 * If you see "undefined", wait a few seconds and try again.
 */

// ============================================
// QUICK CHECK - Is Logger Ready?
// ============================================
if (typeof __logger === 'undefined') {
  console.log('⏳ Logger not loaded yet. Wait a few seconds and try again.');
  console.log('💡 Or navigate to /chat to load the logger module.');
} else {
  console.log('✅ Logger is ready! Available commands:');
  __logger.help();
}

// ============================================
// COPY-PASTE COMMANDS
// ============================================

// Show all available commands
// __logger.help()

// Check for infinite loops
// __logger.getLoopDiagnostics()

// View statistics
// __logger.getStats()

// Get error logs only
// __logger.getErrorLogs()

// Download diagnostic report
// __logger.downloadLogs('bug-report.json')

// Emergency: Show only errors
// __logger.onlyErrors()

// Clear log history
// __logger.clearHistory()

// Development mode (verbose logging)
// __logger.developmentMode()
