import Constants from 'expo-constants';

/** The installed build's version, read from the app config it was built with. */
export function appVersionLabel(): string {
    const version = Constants?.expoConfig?.version;

    return version ? `v${version}` : 'Version unavailable';
}
