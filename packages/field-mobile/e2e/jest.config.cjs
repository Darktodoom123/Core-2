'use strict';

const testNamePattern = process.env.DETOX_TEST_NAME_PATTERN;

module.exports = {
    rootDir: '..',
    testMatch: ['<rootDir>/e2e/**/*.e2e.test.js'],
    ...(testNamePattern ? { testNamePattern } : {}),
    testTimeout: 120000,
    globalSetup: 'detox/runners/jest/globalSetup',
    globalTeardown: 'detox/runners/jest/globalTeardown',
    reporters: ['detox/runners/jest/reporter'],
    testEnvironment: 'detox/runners/jest/testEnvironment',
    verbose: true,
};
