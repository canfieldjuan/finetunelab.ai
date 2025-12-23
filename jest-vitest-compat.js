// Vitest compatibility layer for Jest
// This allows tests written for Vitest to run with Jest

module.exports = {
  describe: global.describe,
  it: global.it,
  test: global.test,
  expect: global.expect,
  beforeEach: global.beforeEach,
  afterEach: global.afterEach,
  beforeAll: global.beforeAll,
  afterAll: global.afterAll,
  vi: global.vi,
};
