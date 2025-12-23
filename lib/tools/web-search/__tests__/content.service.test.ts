import { contentService } from '../content.service';

// This is a simple integration test.
// It requires an internet connection and may be slow.
describe('ContentService Integration Test', () => {
  it('should fetch and clean content from a live URL', async () => {
    // Using a well-known, stable page for testing
    const url = 'https://en.wikipedia.org/wiki/Artificial_intelligence';
    
    console.log(`[Test] Starting fetch and clean for: ${url}`);
    const content = await contentService.fetchAndClean(url);
    console.log(`[Test] Completed fetch and clean. Content length: ${content.length}`);

    // Verification
    expect(typeof content).toBe('string');
    expect(content.length).toBeGreaterThan(100); // Expecting a reasonable amount of text
    expect(content).toContain('Artificial intelligence'); // Key term should be present
    expect(content).not.toContain('<script>'); // Should not contain script tags
    expect(content).not.toContain('<style>'); // Should not contain style tags
    expect(content).not.toContain('Wikimedia Foundation'); // Footer content should be removed
  }, 20000); // Increase timeout to 20 seconds for network requests

  it('should handle fetch errors gracefully and return an empty string', async () => {
    const invalidUrl = 'https://invalid-url-for-testing.xyz';

    console.log(`[Test] Testing error handling for: ${invalidUrl}`);
    const content = await contentService.fetchAndClean(invalidUrl);
    console.log(`[Test] Completed error handling test. Content: "${content}"`);

    // Verification
    expect(content).toBe('');
  }, 30000); // Increase timeout to 30 seconds for network error handling
});
