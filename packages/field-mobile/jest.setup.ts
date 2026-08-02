import * as matchers from '@testing-library/react-native/matchers';

expect.extend(matchers);

Object.defineProperty(globalThis, 'fetch', {
    configurable: true,
    value: jest.fn(),
    writable: true,
});

jest.mock('expo-secure-store', () => ({
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: 1,
    deleteItemAsync: jest.fn(),
    getItemAsync: jest.fn(),
    setItemAsync: jest.fn(),
}));

jest.mock('expo-crypto', () => ({
    randomUUID: jest.fn(() => '157849b3-e318-4892-88e6-3f705394d299'),
}));

jest.mock('react-native-safe-area-context', () => {
    const safeAreaMock = jest.requireActual(
        'react-native-safe-area-context/jest/mock',
    );

    return safeAreaMock.default;
});
