/* eslint-disable @typescript-eslint/no-require-imports */
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

jest.mock('react-native-webview', () => {
    const React = require('react');
    const { View } = require('react-native');

    return {
        WebView: (props: any) =>
            React.createElement(View, { testID: 'mock-webview', ...props }),
    };
});

jest.mock('@expo/vector-icons', () => {
    const React = require('react');
    const { Text } = require('react-native');

    return {
        Ionicons: (props: any) =>
            React.createElement(
                Text,
                { testID: `icon-ionicons-${props.name}`, ...props },
                props.name,
            ),
        MaterialCommunityIcons: (props: any) =>
            React.createElement(
                Text,
                { testID: `icon-mci-${props.name}`, ...props },
                props.name,
            ),
    };
});

jest.mock('expo-location', () => ({
    Accuracy: {
        Lowest: 1,
        Low: 2,
        Balanced: 3,
        High: 4,
        Highest: 5,
        BestForNavigation: 6,
    },
    getForegroundPermissionsAsync: jest.fn(async () => ({
        granted: true,
        canAskAgain: true,
        status: 'granted',
        expires: 'never',
    })),
    requestForegroundPermissionsAsync: jest.fn(async () => ({
        granted: true,
        canAskAgain: true,
        status: 'granted',
        expires: 'never',
    })),
    getBackgroundPermissionsAsync: jest.fn(async () => ({
        granted: true,
        canAskAgain: true,
        status: 'granted',
        expires: 'never',
    })),
    requestBackgroundPermissionsAsync: jest.fn(async () => ({
        granted: true,
        canAskAgain: true,
        status: 'granted',
        expires: 'never',
    })),
    getLastKnownPositionAsync: jest.fn(async () => null),
    getCurrentPositionAsync: jest.fn(async () => ({
        coords: {
            latitude: 14.6091,
            longitude: 121.0223,
            accuracy: 10,
            altitude: 20,
            altitudeAccuracy: 5,
            heading: 0,
            speed: 0,
        },
        timestamp: Date.now(),
    })),
    reverseGeocodeAsync: jest.fn(async () => [
        {
            city: 'Quezon City',
            subregion: 'Metro Manila',
            district: 'Diliman',
            region: 'NCR',
            country: 'Philippines',
            postalCode: '1101',
            name: 'Quezon City',
            isoCountryCode: 'PH',
            timezone: 'Asia/Manila',
            street: null,
            streetNumber: null,
            formattedAddress: 'Quezon City, Metro Manila, Philippines',
        },
    ]),
    hasStartedLocationUpdatesAsync: jest.fn(async () => false),
    startLocationUpdatesAsync: jest.fn(async () => undefined),
    stopLocationUpdatesAsync: jest.fn(async () => undefined),
}));
