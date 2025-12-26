// jest.setup.js
import '@testing-library/jest-dom';

// Mock vitest imports to use jest instead
// This allows running vitest-style tests with jest
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
};

// Mock Supabase createClient
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    auth: {
      getUser: jest.fn(),
      signIn: jest.fn(),
      signOut: jest.fn(),
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
