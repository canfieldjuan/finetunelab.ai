// Live smoke probe for OpenAI-compatible vLLM tool-call behavior.
// Run with: npm run probe:vllm-tools -- --base-url http://localhost:8000/v1 --model qwen3

import { config as loadEnv } from 'dotenv';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { OpenAIAdapter } from '../lib/llm/adapters/openai-adapter';
import type { AdapterRequest, AdapterResponse } from '../lib/llm/adapters/base-adapter';
import type { ChatMessage, ToolDefinition } from '../lib/llm/openai';
import type { ModelConfig } from '../lib/models/llm-model.types';
import calculatorTool from '../lib/tools/calculator';

loadEnv({ path: '.env.local', override: false });
loadEnv({ path: '.env', override: false });

type ProbeCase = {
  name: string;
  description: string;
  messages: ChatMessage[];
  tools: ToolDefinition[];
  expectToolCalls?: boolean;
  expectNoToolCalls?: boolean;
};

type ProbeIssue = {
  level: 'warn' | 'error';
  code: string;
  message: string;
};

type ProbeRound = {
  round: number;
  request: {
    url: string;
    headers: Record<string, string>;
    body: Record<string, unknown>;
  };
  response?: {
    status: number;
    statusText: string;
    headers: Record<string, string>;
    body: unknown;
    rawText: string;
  };
  parsed?: Pick<AdapterResponse, 'content' | 'toolCalls' | 'usage'>;
  toolResults?: Array<{
    name: string;
    arguments: Record<string, unknown>;
    result: unknown;
  }>;
  issues: ProbeIssue[];
};

type ProbeResult = {
  name: string;
  description: string;
  status: 'pass' | 'warn' | 'error';
  rounds: ProbeRound[];
  finalContent?: string;
  toolsCalled: string[];
  issues: ProbeIssue[];
};

type CliOptions = {
  baseUrl: string;
  model: string;
  modelId: string;
  apiKey?: string;
  outFile: string;
  maxRounds: number;
  timeoutMs: number;
  temperature: number;
  topP: number;
  parseQwenXmlToolCalls: boolean;
  selectedCases: string[];
  strict: boolean;
};

function usage(): string {
  return `Live vLLM tool-call probe

Usage:
  npm run probe:vllm-tools -- [options]

Options:
  --base-url <url>       OpenAI-compatible base URL. Default: VLLM_PROBE_BASE_URL, VLLM_EXTERNAL_URL, or http://localhost:8000/v1
  --model <name>         Served model name sent in requests. Default: VLLM_PROBE_MODEL, VLLM_SERVED_MODEL_NAME, or qwen
  --model-id <id>        Model id for local config metadata. Default: same as --model
  --api-key <key>        Optional bearer token. Default: VLLM_PROBE_API_KEY or VLLM_API_KEY
  --case <name>          Run one case. Repeatable. Default: all cases
  --max-rounds <n>       Max tool-call rounds per case. Default: 3
  --timeout-ms <n>       Fetch timeout per round. Default: 60000
  --out <path>           Transcript JSON output path. Default: output/vllm-tool-probes/<timestamp>.json
  --no-parse-qwen-xml    Disable Qwen XML fallback parsing in adapter metadata
  --strict               Exit non-zero on warnings as well as errors
  --help                 Show this help

Environment aliases:
  VLLM_PROBE_BASE_URL, VLLM_EXTERNAL_URL, VLLM_PROBE_MODEL,
  VLLM_SERVED_MODEL_NAME, VLLM_PROBE_API_KEY, VLLM_API_KEY`;
}

function readFlags(argv: string[]): Map<string, string[]> {
  const flags = new Map<string, string[]>();

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith('--')) continue;

    const [rawName, inlineValue] = arg.slice(2).split('=', 2);
    const value = inlineValue ?? (!argv[index + 1]?.startsWith('--') ? argv[++index] : 'true');
    const values = flags.get(rawName) ?? [];
    values.push(value);
    flags.set(rawName, values);
  }

  return flags;
}

function getFlag(flags: Map<string, string[]>, name: string): string | undefined {
  return flags.get(name)?.at(-1);
}

function hasFlag(flags: Map<string, string[]>, name: string): boolean {
  return flags.has(name);
}

function toPositiveInt(value: string | undefined, fallback: number): number {
  const parsed = value ? Number.parseInt(value, 10) : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function toNumber(value: string | undefined, fallback: number): number {
  const parsed = value ? Number.parseFloat(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

function defaultOutFile(): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return path.join('output', 'vllm-tool-probes', `${stamp}.json`);
}

function parseCliOptions(argv: string[]): CliOptions {
  const flags = readFlags(argv);

  if (hasFlag(flags, 'help')) {
    console.log(usage());
    process.exit(0);
  }

  const model = getFlag(flags, 'model')
    ?? process.env.VLLM_PROBE_MODEL
    ?? process.env.VLLM_SERVED_MODEL_NAME
    ?? 'qwen';

  return {
    baseUrl: getFlag(flags, 'base-url')
      ?? process.env.VLLM_PROBE_BASE_URL
      ?? process.env.VLLM_EXTERNAL_URL
      ?? 'http://localhost:8000/v1',
    model,
    modelId: getFlag(flags, 'model-id') ?? process.env.VLLM_PROBE_MODEL_ID ?? model,
    apiKey: getFlag(flags, 'api-key') ?? process.env.VLLM_PROBE_API_KEY ?? process.env.VLLM_API_KEY,
    outFile: getFlag(flags, 'out') ?? defaultOutFile(),
    maxRounds: toPositiveInt(getFlag(flags, 'max-rounds'), 3),
    timeoutMs: toPositiveInt(getFlag(flags, 'timeout-ms'), 60000),
    temperature: toNumber(getFlag(flags, 'temperature'), 0),
    topP: toNumber(getFlag(flags, 'top-p'), 1),
    parseQwenXmlToolCalls: !hasFlag(flags, 'no-parse-qwen-xml'),
    selectedCases: flags.get('case') ?? [],
    strict: hasFlag(flags, 'strict'),
  };
}

function sanitizeHeaders(headers: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [
      key,
      /authorization|api-key/i.test(key) ? '[REDACTED]' : value,
    ])
  );
}

function responseHeaders(headers: Headers): Record<string, string> {
  return Object.fromEntries(headers.entries());
}

function llmToolFromPortalTool(): ToolDefinition {
  return {
    type: 'function',
    function: {
      name: calculatorTool.name,
      description: calculatorTool.description,
      parameters: calculatorTool.parameters as Record<string, unknown>,
    },
  };
}

const calculatorLlmTool = llmToolFromPortalTool();

const CASES: ProbeCase[] = [
  {
    name: 'calculator-basic',
    description: 'Model should call calculator once and then answer from the tool result.',
    tools: [calculatorLlmTool],
    expectToolCalls: true,
    messages: [
      {
        role: 'system',
        content: 'You are testing tool calling. For arithmetic, call the calculator tool instead of calculating mentally. After the tool result, answer briefly.',
      },
      {
        role: 'user',
        content: 'Use the calculator tool to compute 23% of 456. Then answer with the final number.',
      },
    ],
  },
  {
    name: 'calculator-multiple',
    description: 'Model may emit multiple tool calls in one round or serial rounds.',
    tools: [calculatorLlmTool],
    expectToolCalls: true,
    messages: [
      {
        role: 'system',
        content: 'You are testing tool calling. Use calculator for each arithmetic expression, then summarize the results.',
      },
      {
        role: 'user',
        content: 'Use tools to compute both expressions: 23% of 456, and sqrt(144).',
      },
    ],
  },
  {
    name: 'literal-xml-no-tools',
    description: 'Literal <tool_call> prose should not become an executable tool call when no tools were offered.',
    tools: [],
    expectNoToolCalls: true,
    messages: [
      {
        role: 'system',
        content: 'Do not call tools. You are formatting documentation text only.',
      },
      {
        role: 'user',
        content: 'Print this exact XML snippet in a fenced code block and explain that it is only an example: <tool_call>{"name":"calculator","arguments":{"expression":"2+2"}}</tool_call>',
      },
    ],
  },
  {
    name: 'malformed-xml-no-tools',
    description: 'Malformed XML-looking tool JSON should not throw or start a tool loop.',
    tools: [],
    expectNoToolCalls: true,
    messages: [
      {
        role: 'system',
        content: 'Do not call tools. Echo requested text as plain documentation.',
      },
      {
        role: 'user',
        content: 'Print this malformed example in a fenced code block: <tool_call>{"name":"calculator","arguments":</tool_call>',
      },
    ],
  },
];

function makeModelConfig(options: CliOptions): ModelConfig {
  return {
    id: 'vllm-live-probe',
    name: `vLLM live probe (${options.model})`,
    provider: 'vllm',
    base_url: options.baseUrl,
    model_id: options.modelId,
    served_model_name: options.model,
    auth_type: options.apiKey ? 'bearer' : 'none',
    api_key: options.apiKey,
    auth_headers: {},
    supports_streaming: false,
    supports_functions: true,
    supports_vision: false,
    context_length: 32768,
    max_output_tokens: 512,
    default_temperature: options.temperature,
    default_top_p: options.topP,
    metadata: {
      vllm_runtime: {
        parse_qwen_xml_tool_calls: options.parseQwenXmlToolCalls,
      },
    },
  };
}

async function fetchJson(
  url: string,
  headers: Record<string, string>,
  body: Record<string, unknown>,
  timeoutMs: number
): Promise<{ response: Response; text: string; parsed: unknown }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await response.text();
    let parsed: unknown = null;
    if (text.trim()) {
      parsed = JSON.parse(text);
    }
    return { response, text, parsed };
  } finally {
    clearTimeout(timeout);
  }
}

async function executeCalculator(argumentsRecord: Record<string, unknown>): Promise<unknown> {
  return calculatorTool.execute(argumentsRecord);
}

function toolMessage(toolCall: NonNullable<AdapterResponse['toolCalls']>[number], result: unknown): ChatMessage {
  return {
    role: 'tool',
    content: typeof result === 'string' ? result : JSON.stringify(result),
    tool_call_id: toolCall.id,
    name: toolCall.name,
  };
}

function assistantToolMessage(parsed: AdapterResponse): ChatMessage {
  return {
    role: 'assistant',
    content: parsed.content || null,
    tool_calls: parsed.toolCalls?.map(toolCall => ({
      id: toolCall.id,
      type: 'function',
      function: {
        name: toolCall.name,
        arguments: JSON.stringify(toolCall.arguments),
      },
    })),
  };
}

function summarizeStatus(issues: ProbeIssue[]): ProbeResult['status'] {
  if (issues.some(issue => issue.level === 'error')) return 'error';
  if (issues.some(issue => issue.level === 'warn')) return 'warn';
  return 'pass';
}

async function runCase(
  probeCase: ProbeCase,
  adapter: OpenAIAdapter,
  config: ModelConfig,
  options: CliOptions
): Promise<ProbeResult> {
  let messages = [...probeCase.messages];
  const rounds: ProbeRound[] = [];
  const toolsCalled: string[] = [];
  const issues: ProbeIssue[] = [];
  let finalContent: string | undefined;

  for (let round = 1; round <= options.maxRounds; round += 1) {
    const request: AdapterRequest = {
      messages,
      config,
      options: {
        temperature: options.temperature,
        topP: options.topP,
        maxTokens: 512,
        tools: probeCase.tools,
        stream: false,
      },
    };
    const formatted = adapter.formatRequest(request);
    const roundRecord: ProbeRound = {
      round,
      request: {
        url: formatted.url,
        headers: sanitizeHeaders(formatted.headers),
        body: formatted.body,
      },
      issues: [],
    };
    rounds.push(roundRecord);

    try {
      const { response, text, parsed } = await fetchJson(
        formatted.url,
        formatted.headers,
        formatted.body,
        options.timeoutMs
      );

      roundRecord.response = {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders(response.headers),
        body: parsed,
        rawText: text,
      };

      if (!response.ok) {
        roundRecord.issues.push({
          level: 'error',
          code: 'provider_error',
          message: `Provider returned ${response.status} ${response.statusText}`,
        });
        break;
      }

      const adapterResponse = await adapter.parseResponse(response, parsed, request);
      roundRecord.parsed = {
        content: adapterResponse.content,
        toolCalls: adapterResponse.toolCalls,
        usage: adapterResponse.usage,
      };

      if (!adapterResponse.toolCalls?.length) {
        finalContent = adapterResponse.content;
        break;
      }

      if (probeCase.tools.length === 0) {
        roundRecord.issues.push({
          level: 'error',
          code: 'tool_call_without_offered_tools',
          message: 'Adapter parsed tool calls even though this probe offered no tools.',
        });
        break;
      }

      const offeredNames = new Set(probeCase.tools.map(tool => tool.function.name));
      const toolResults: ProbeRound['toolResults'] = [];
      const nextMessages: ChatMessage[] = [assistantToolMessage(adapterResponse)];

      for (const toolCall of adapterResponse.toolCalls) {
        toolsCalled.push(toolCall.name);

        if (!offeredNames.has(toolCall.name)) {
          const result = {
            error: `Tool "${toolCall.name}" was not offered by this probe.`,
          };
          roundRecord.issues.push({
            level: 'error',
            code: 'unoffered_tool_call',
            message: result.error,
          });
          toolResults.push({ name: toolCall.name, arguments: toolCall.arguments, result });
          nextMessages.push(toolMessage(toolCall, result));
          continue;
        }

        if (toolCall.name !== calculatorTool.name) {
          const result = { error: `No probe executor for tool "${toolCall.name}".` };
          roundRecord.issues.push({
            level: 'error',
            code: 'missing_probe_executor',
            message: result.error,
          });
          toolResults.push({ name: toolCall.name, arguments: toolCall.arguments, result });
          nextMessages.push(toolMessage(toolCall, result));
          continue;
        }

        try {
          const result = await executeCalculator(toolCall.arguments);
          toolResults.push({ name: toolCall.name, arguments: toolCall.arguments, result });
          nextMessages.push(toolMessage(toolCall, result));
        } catch (error) {
          const result = {
            error: error instanceof Error ? error.message : String(error),
          };
          roundRecord.issues.push({
            level: 'error',
            code: 'tool_execution_error',
            message: result.error,
          });
          toolResults.push({ name: toolCall.name, arguments: toolCall.arguments, result });
          nextMessages.push(toolMessage(toolCall, result));
        }
      }

      roundRecord.toolResults = toolResults;
      messages = [...messages, ...nextMessages];
    } catch (error) {
      roundRecord.issues.push({
        level: 'error',
        code: error instanceof Error && error.name === 'AbortError' ? 'request_timeout' : 'probe_exception',
        message: error instanceof Error ? error.message : String(error),
      });
      break;
    }
  }

  if (probeCase.expectToolCalls && toolsCalled.length === 0) {
    issues.push({
      level: 'warn',
      code: 'expected_tool_not_called',
      message: 'Probe expected at least one tool call, but the model answered without tools.',
    });
  }

  if (probeCase.expectNoToolCalls && toolsCalled.length > 0) {
    issues.push({
      level: 'error',
      code: 'unexpected_tool_call',
      message: `Probe expected no tool calls, but saw: ${toolsCalled.join(', ')}`,
    });
  }

  if (!finalContent && !rounds.some(round => round.issues.some(issue => issue.level === 'error'))) {
    issues.push({
      level: 'warn',
      code: 'no_final_content',
      message: 'Probe ended without final assistant content.',
    });
  }

  issues.push(...rounds.flatMap(round => round.issues));

  return {
    name: probeCase.name,
    description: probeCase.description,
    status: summarizeStatus(issues),
    rounds,
    finalContent,
    toolsCalled,
    issues,
  };
}

async function main() {
  const options = parseCliOptions(process.argv.slice(2));
  const selected = options.selectedCases.length
    ? CASES.filter(probeCase => options.selectedCases.includes(probeCase.name))
    : CASES;

  if (selected.length === 0) {
    console.error('[Probe] No matching cases. Available cases:');
    for (const probeCase of CASES) {
      console.error(`  - ${probeCase.name}`);
    }
    process.exit(1);
  }

  const adapter = new OpenAIAdapter();
  const modelConfig = makeModelConfig(options);
  const startedAt = new Date().toISOString();

  console.log('[Probe] vLLM tool-call smoke probe');
  console.log('[Probe] Base URL:', options.baseUrl);
  console.log('[Probe] Model:', options.model);
  console.log('[Probe] Qwen XML fallback:', options.parseQwenXmlToolCalls ? 'enabled' : 'disabled');
  console.log('[Probe] Cases:', selected.map(probeCase => probeCase.name).join(', '));

  const results: ProbeResult[] = [];
  for (const probeCase of selected) {
    console.log(`\n[Probe] Running ${probeCase.name}: ${probeCase.description}`);
    const result = await runCase(probeCase, adapter, modelConfig, options);
    results.push(result);
    console.log(`[Probe] ${probeCase.name}: ${result.status}`);
    if (result.toolsCalled.length > 0) {
      console.log(`[Probe]   tools: ${result.toolsCalled.join(', ')}`);
    }
    for (const issue of result.issues) {
      console.log(`[Probe]   ${issue.level.toUpperCase()} ${issue.code}: ${issue.message}`);
    }
  }

  const endedAt = new Date().toISOString();
  const transcript = {
    startedAt,
    endedAt,
    options: {
      baseUrl: options.baseUrl,
      model: options.model,
      modelId: options.modelId,
      maxRounds: options.maxRounds,
      timeoutMs: options.timeoutMs,
      temperature: options.temperature,
      topP: options.topP,
      parseQwenXmlToolCalls: options.parseQwenXmlToolCalls,
      strict: options.strict,
    },
    results,
  };

  await mkdir(path.dirname(options.outFile), { recursive: true });
  await writeFile(options.outFile, `${JSON.stringify(transcript, null, 2)}\n`, 'utf8');
  console.log(`\n[Probe] Wrote transcript: ${options.outFile}`);

  const hasErrors = results.some(result => result.status === 'error');
  const hasWarnings = results.some(result => result.status === 'warn');
  if (hasErrors || (options.strict && hasWarnings)) {
    process.exit(1);
  }
}

main().catch(error => {
  console.error('[Probe] Fatal error:', error);
  process.exit(1);
});
