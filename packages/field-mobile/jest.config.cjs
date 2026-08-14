'use strict';

module.exports = {
    preset: 'jest-expo',
    setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
    testMatch: ['**/src/__tests__/**/*.component.test.tsx'],
    testPathIgnorePatterns: ['/node_modules/'],
};
