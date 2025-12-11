// Timeout Utility for Tool Execution
// Prevents tools from hanging the server indefinitely
// Date: 2025-10-23

/**
 * Executes a promise with a timeout
 * If the promise doesn't resolve/reject within timeoutMs, it throws a timeout error
 *
 * @param promise - The promise to execute
 * @param timeoutMs - Timeout in milliseconds (default: 30000ms = 30s)
 * @param operationName - Name of operation for error messages
 * @returns Promise result or throws timeout error
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number = 30000,
  operationName: string = 'Operation'
): Promise<T> {
  let timeoutId: NodeJS.Timeout;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(
        `[Timeout] ${operationName} exceeded timeout of ${timeoutMs}ms`
      ));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutId!);
    return result;
  } catch (error) {
    clearTimeout(timeoutId!);
    throw error;
  }
}

/**
 * Configuration for tool execution timeout
 */
export const TOOL_TIMEOUT_MS = parseInt(
  process.env.TOOL_TIMEOUT_MS || '30000'
); // 30 seconds default

console.log(`[Timeout] Tool execution timeout set to ${TOOL_TIMEOUT_MS}ms`);
