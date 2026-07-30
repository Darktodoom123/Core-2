import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { describe, it } from 'node:test';

type DevClientLaunchOptions = {
    delete: boolean;
    newInstance: boolean;
    url: string;
};

type DevClientModule = {
    createDevClientLaunchOptions(options?: {
        metroUrl?: string;
        resetAppData?: boolean;
    }): DevClientLaunchOptions;
    createDevClientUrl(metroUrl?: string): string;
};

const require = createRequire(import.meta.url);
const { createDevClientLaunchOptions, createDevClientUrl } =
    require('../../e2e/dev-client.cjs') as DevClientModule;

describe('Expo development-client launch options', () => {
    it('opens the local Metro bundle through the generated development-client scheme', () => {
        assert.deepEqual(createDevClientLaunchOptions({ resetAppData: true }), {
            delete: true,
            newInstance: true,
            url: 'exp+core-2-field-mobile://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A18081%2F&disableOnboarding=1',
        });
    });

    it('preserves app data for authenticated restart coverage', () => {
        assert.equal(createDevClientLaunchOptions().delete, false);
    });

    it('rejects non-HTTP Metro URLs and embedded credentials', () => {
        assert.throws(
            () => createDevClientUrl('file:///tmp/bundle'),
            /must use HTTP or HTTPS/,
        );
        assert.throws(
            () => createDevClientUrl('http://user:secret@127.0.0.1:18081'),
            /must not include credentials/,
        );
    });
});
