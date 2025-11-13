
import { useState, useEffect } from 'react';
import { getEnabledTools } from '../../lib/tools/toolManager';
import { log } from '../../lib/utils/logger';


/**
 * A hook for fetching the available tools.
 * @returns The available tools.
 */
export function useTools() {
  const [tools, setTools] = useState<
    Array<{
      type: string;
      function: { name: string; description: string; parameters: unknown };
    }>
  >([]);

  useEffect(() => {
    const loadTools = async () => {
      const { data, error: toolsError } = await getEnabledTools();
      if (toolsError) {
        log.error('useTools', 'Error loading tools', { error: toolsError });
        return;
      }
      const apiTools = data.map((tool) => ({
        type: "function",
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters
        }
      }));
      setTools(apiTools);
      log.debug('useTools', 'Loaded tools', { count: apiTools.length });
    };
    loadTools();
  }, []);

  return { tools };
}
