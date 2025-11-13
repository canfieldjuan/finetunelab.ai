import { searchService } from '../search.service';

describe('Deep Search Integration Test', () => {
  it('should perform a normal search without deep search', async () => {
    console.log('[Test] Running normal search without deep search');
    
    const result = await searchService.search(
      'artificial intelligence',
      3,
      { deepSearch: false }
    );
    
    console.log('[Test] Normal search complete:', {
      resultCount: result.results.length,
      firstResultSnippetLength: result.results[0]?.snippet.length,
    });
    
    // Verify normal search behavior
    expect(result.results.length).toBeGreaterThan(0);
    expect(result.results[0].snippet.length).toBeLessThan(1000); // Snippets are short
    expect(result.metadata.provider).toBeTruthy();
  }, 30000);

  it('should perform a deep search and fetch full content', async () => {
    console.log('[Test] Running deep search with full content fetching');
    
    const result = await searchService.search(
      'artificial intelligence',
      3,
      { deepSearch: true }
    );
    
    console.log('[Test] Deep search complete:', {
      resultCount: result.results.length,
      firstResultSnippetLength: result.results[0]?.snippet.length,
      hasSummary: !!result.results[0]?.summary,
    });
    
    // Verify deep search behavior
    expect(result.results.length).toBeGreaterThan(0);
    
    // At least one result should have significantly more content than a snippet
    const hasLongContent = result.results.some(r => r.snippet.length > 5000);
    expect(hasLongContent).toBe(true);
    
    // Deep search should automatically enable summarization
    expect(result.results[0]?.summary).toBeTruthy();
  }, 60000); // Longer timeout for deep search
});
