export type MapStyleVariant = 'light' | 'dark';

const STADIA_STYLE_URLS: Record<MapStyleVariant, string> = {
    light: 'https://tiles.stadiamaps.com/styles/alidade_smooth.json',
    dark: 'https://tiles.stadiamaps.com/styles/alidade_smooth_dark.json',
};

const STADIA_ATTRIBUTION =
    '&copy; <a href="https://stadiamaps.com/" target="_blank" rel="noreferrer">Stadia Maps</a> &copy; <a href="https://openmaptiles.org/" target="_blank" rel="noreferrer">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>';

export type MapProviderConfiguration = {
    provider: string;
    plan: string;
    useCase: string;
    styleUrl: string | null;
    attribution: string;
    isDevelopmentOnly: boolean;
};

function withStadiaApiKey(styleUrl: string): string {
    const apiKey = import.meta.env.VITE_STADIA_MAPS_API_KEY?.trim();

    if (!apiKey) {
        return styleUrl;
    }

    let url: URL;

    try {
        url = new URL(styleUrl);
    } catch {
        return styleUrl;
    }

    if (url.hostname !== 'tiles.stadiamaps.com') {
        return styleUrl;
    }

    url.searchParams.set('api_key', apiKey);

    return url.toString();
}

export function getMapProviderConfiguration(
    variant: MapStyleVariant = 'light',
): MapProviderConfiguration {
    const provider = import.meta.env.VITE_MAP_PROVIDER?.trim() || 'stadia';
    const plan = import.meta.env.VITE_MAP_PLAN?.trim() || 'free';
    const useCase =
        import.meta.env.VITE_MAP_USE_CASE?.trim().toLowerCase() || 'commercial';
    const configuredStyleUrl = import.meta.env.VITE_MAP_STYLE_URL?.trim();

    if (configuredStyleUrl) {
        return {
            provider,
            plan,
            useCase,
            styleUrl:
                provider === 'stadia'
                    ? withStadiaApiKey(configuredStyleUrl)
                    : configuredStyleUrl,
            attribution:
                import.meta.env.VITE_MAP_ATTRIBUTION?.trim() ||
                (provider === 'stadia' ? STADIA_ATTRIBUTION : ''),
            isDevelopmentOnly: provider === 'stadia' && plan === 'free',
        };
    }

    if (provider !== 'stadia') {
        return {
            provider,
            plan,
            useCase,
            styleUrl: null,
            attribution: '',
            isDevelopmentOnly: false,
        };
    }

    return {
        provider: 'stadia',
        plan,
        useCase,
        styleUrl: withStadiaApiKey(STADIA_STYLE_URLS[variant]),
        attribution:
            import.meta.env.VITE_MAP_ATTRIBUTION?.trim() || STADIA_ATTRIBUTION,
        isDevelopmentOnly: plan === 'free',
    };
}

export function getMapStyleUrl(
    variant: MapStyleVariant = 'light',
): string | null {
    return getMapProviderConfiguration(variant).styleUrl;
}

export function getMapAttribution(variant: MapStyleVariant = 'light'): string {
    return getMapProviderConfiguration(variant).attribution;
}
