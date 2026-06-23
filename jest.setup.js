// jest.setup.js
import '@testing-library/jest-dom';

// Mock next/navigation so components/hooks that call useRouter() (e.g. AuthProvider)
// don't throw "invariant expected app router to be mounted" under jsdom. The App Router
// isn't mounted in unit tests, so provide inert stubs.
jest.mock('next/navigation', () => {
  const router = {
    push: jest.fn(),
    replace: jest.fn(),
    refresh: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    prefetch: jest.fn(),
  };
  return {
    useRouter: () => router,
    usePathname: () => '/',
    useSearchParams: () => new URLSearchParams(),
    useParams: () => ({}),
    useSelectedLayoutSegment: () => null,
    useSelectedLayoutSegments: () => [],
    redirect: jest.fn(),
    notFound: jest.fn(),
  };
});

// Mock vitest imports to use jest instead
// This allows running vitest-style tests with jest
const _viGlobalStubs = [];
global.vi = {
  fn: jest.fn,
  mock: jest.mock,
  unmock: jest.unmock,
  spyOn: jest.spyOn,
  clearAllMocks: jest.clearAllMocks,
  resetAllMocks: jest.resetAllMocks,
  restoreAllMocks: jest.restoreAllMocks,
  resetModules: jest.resetModules,
  mocked: jest.mocked,
  // ---- vitest API surface not covered by jest's globals ----
  hoisted: (factory) => factory(),
  importActual: (mod) => Promise.resolve(jest.requireActual(mod)),
  importMock: (mod) => Promise.resolve(jest.requireMock(mod)),
  stubGlobal: (name, value) => {
    _viGlobalStubs.push([name, Object.getOwnPropertyDescriptor(globalThis, name)]);
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  },
  unstubAllGlobals: () => {
    while (_viGlobalStubs.length) {
      const [name, desc] = _viGlobalStubs.pop();
      if (desc) Object.defineProperty(globalThis, name, desc);
      else delete globalThis[name];
    }
  },
  stubEnv: (key, value) => {
    process.env[key] = value;
  },
  unstubAllEnvs: () => {},
  // Timer helpers map onto jest's fake timers
  useFakeTimers: (...args) => jest.useFakeTimers(...args),
  useRealTimers: () => jest.useRealTimers(),
  advanceTimersByTime: (ms) => jest.advanceTimersByTime(ms),
  advanceTimersByTimeAsync: async (ms) => jest.advanceTimersByTime(ms),
  runAllTimers: () => jest.runAllTimers(),
  runOnlyPendingTimers: () => jest.runOnlyPendingTimers(),
  clearAllTimers: () => jest.clearAllTimers(),
  setSystemTime: (time) => jest.setSystemTime(time),
  getRealSystemTime: () => Date.now(),
};

// Mock Supabase createClient
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }),
      getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
      signIn: jest.fn(),
      signInWithPassword: jest.fn().mockResolvedValue({ data: { user: null, session: null }, error: null }),
      signOut: jest.fn().mockResolvedValue({ error: null }),
      // AuthProvider subscribes to auth changes and expects a subscription it can unsubscribe.
      onAuthStateChange: jest.fn(() => ({
        data: { subscription: { unsubscribe: jest.fn() } },
      })),
    },
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(),
    })),
  })),
}));

// Mock OpenAI for LLM-Judge tests
jest.mock('openai', () => {
  const mockOpenAI = jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [{
            message: {
              content: JSON.stringify({
                score: 8,
                reasoning: 'Test reasoning',
              }),
            },
          }],
        }),
      },
    },
  }));

  return {
    __esModule: true,
    default: mockOpenAI,
    OpenAI: mockOpenAI,
  };
});

// Ensure File API works correctly for dataset validator tests
// jsdom has File but might not support text() method correctly
if (typeof File === 'undefined' || !File.prototype.text) {
  const OriginalFile = typeof File !== 'undefined' ? File : class {};

  global.File = class File extends OriginalFile {
    constructor(bits, name, options = {}) {
      if (typeof OriginalFile.prototype !== 'undefined' && OriginalFile.name !== 'Object') {
        super(bits, name, options);
      } else {
        this.bits = bits;
        this.name = name;
        this.type = options.type || '';
        this.size = bits.reduce((sum, bit) => sum + (bit?.length || 0), 0);
      }
    }

    async text() {
      if (this.bits) {
        return this.bits.join('');
      }
      if (super.text) {
        return super.text();
      }
      return '';
    }
  };
}

// Polyfill Web APIs for Next.js tests
if (typeof Request === 'undefined') {
  global.Request = class Request {
    constructor(input, init) {
      this.url = typeof input === 'string' ? input : input.url;
      this.method = init?.method || 'GET';
      this.headers = new Map(Object.entries(init?.headers || {}));
      this.body = init?.body;
    }

    async json() {
      return JSON.parse(this.body);
    }
  };
}

if (typeof Response === 'undefined') {
  global.Response = class Response {
    constructor(body, init) {
      this.body = body;
      this.status = init?.status || 200;
      this.statusText = init?.statusText || 'OK';
      this.headers = new Map(Object.entries(init?.headers || {}));
    }

    async json() {
      return JSON.parse(this.body);
    }
  };
}
