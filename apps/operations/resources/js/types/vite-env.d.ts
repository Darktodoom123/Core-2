/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_MAP_PROVIDER?: string;
    readonly VITE_MAP_PLAN?: string;
    readonly VITE_MAP_USE_CASE?: string;
    readonly VITE_MAP_STYLE_URL?: string;
    readonly VITE_MAP_ATTRIBUTION?: string;
    /** Public browser credential; restrict it by domain in the provider dashboard. */
    readonly VITE_STADIA_MAPS_API_KEY?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
