export function resolveApiBaseUrl(
    configuredUrl = process.env.EXPO_PUBLIC_API_BASE_URL,
): string {
    const baseUrl = configuredUrl?.trim();

    if (!baseUrl) {
        throw new Error(
            'EXPO_PUBLIC_API_BASE_URL is required. Configure the API origin in the Expo environment before starting the field app.',
        );
    }

    let parsedUrl: URL;

    try {
        parsedUrl = new URL(baseUrl);
    } catch {
        throw new Error(
            'EXPO_PUBLIC_API_BASE_URL must be a valid http(s) URL.',
        );
    }

    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        throw new Error('EXPO_PUBLIC_API_BASE_URL must use http or https.');
    }

    if (
        parsedUrl.protocol !== 'https:' &&
        process.env.NODE_ENV === 'production'
    ) {
        throw new Error(
            'EXPO_PUBLIC_API_BASE_URL must use HTTPS in production.',
        );
    }

    return baseUrl.replace(/\/+$/, '');
}
