'use strict';

const DEFAULT_METRO_URL = 'http://127.0.0.1:18081';
const DEV_CLIENT_SCHEME = 'exp+core-2-field-mobile';

function createDevClientUrl(
    metroUrl = process.env.EXPO_DEV_CLIENT_METRO_URL ?? DEFAULT_METRO_URL,
) {
    let parsedUrl;

    try {
        parsedUrl = new URL(metroUrl);
    } catch {
        throw new Error('The Expo development-client Metro URL is invalid.');
    }

    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        throw new Error(
            'The Expo development-client Metro URL must use HTTP or HTTPS.',
        );
    }

    if (parsedUrl.username || parsedUrl.password) {
        throw new Error(
            'The Expo development-client Metro URL must not include credentials.',
        );
    }

    return `${DEV_CLIENT_SCHEME}://expo-development-client/?url=${encodeURIComponent(parsedUrl.toString())}&disableOnboarding=1`;
}

function createDevClientLaunchOptions({ resetAppData = false, metroUrl } = {}) {
    return {
        delete: resetAppData,
        newInstance: true,
        url: createDevClientUrl(metroUrl),
    };
}

module.exports = {
    createDevClientLaunchOptions,
    createDevClientUrl,
};
