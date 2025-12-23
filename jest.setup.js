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
