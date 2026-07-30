import type { JestNativeMatchers } from '@testing-library/react-native';

declare global {
    namespace jest {
        // The declaration merge is required to add RNTL's custom matchers.
        // eslint-disable-next-line @typescript-eslint/no-empty-object-type
        interface Matchers<R> extends JestNativeMatchers<R> {}
    }
}

export {};
