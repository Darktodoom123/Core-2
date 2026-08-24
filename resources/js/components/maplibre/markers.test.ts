import { strict as assert } from 'node:assert';
import { afterEach, test } from 'node:test';
// Node's native TypeScript runner needs the extension; the app bundler intentionally does not.
// @ts-expect-error TS5097: this test is executed directly by Node's strip-types runner.
import { createAssetMarker, getSosMarkerPosition } from './markers.ts';

class FakeElement {
    public readonly children: FakeElement[] = [];
    public readonly dataset: Record<string, string> = {};
    public readonly style: Record<string, string> = {};
    public readonly attributes = new Map<string, string>();
    public className = '';
    public innerHTML = '';
    public textContent = '';
    public title = '';
    public type = '';

    appendChild(child: FakeElement): FakeElement {
        this.children.push(child);

        return child;
    }

    setAttribute(name: string, value: string): void {
        this.attributes.set(name, value);
    }
}

const fakeDocument = {
    createElement: () => new FakeElement(),
};

function installFakeDocument(): void {
    Object.defineProperty(globalThis, 'document', {
        configurable: true,
        value: fakeDocument,
        writable: true,
    });
}

function removeFakeDocument(): void {
    Reflect.deleteProperty(globalThis, 'document');
}

function findByClass(root: FakeElement, className: string): FakeElement | null {
    if (root.className === className) {
        return root;
    }

    for (const child of root.children) {
        const match = findByClass(child, className);

        if (match) {
            return match;
        }
    }

    return null;
}

function createMarker(
    status: 'active' | 'escalated' | 'acknowledged' | 'resolved' | 'cancelled',
    prefersReducedMotion = false,
): FakeElement {
    installFakeDocument();

    return createAssetMarker({
        kind: 'truck',
        freshness: 'fresh',
        isSelected: false,
        label: 'Worker One, fresh location',
        sos: {
            status,
            label: `SOS incident for Worker One (${status})`,
            prefersReducedMotion,
        },
    }) as unknown as FakeElement;
}

afterEach(removeFakeDocument);

test('renders an unmistakable halo for active, escalated, and acknowledged SOS', () => {
    for (const status of ['active', 'escalated', 'acknowledged'] as const) {
        const marker = createMarker(status);
        const halo = findByClass(marker, 'maplibre-sos-marker__halo');
        const indicator = findByClass(marker, 'maplibre-sos-marker__indicator');

        assert.ok(halo, `${status} SOS should have a halo`);
        assert.equal(halo?.dataset.sosStatus, status);
        assert.ok(indicator?.innerHTML.includes('SOS'));
        assert.equal(
            marker.attributes.get('aria-label'),
            'Worker One, fresh location. SOS incident for Worker One (' +
                status +
                ')',
        );
    }
});

test('keeps the SOS icon and accessible label while resolved or cancelled has no halo', () => {
    for (const status of ['resolved', 'cancelled'] as const) {
        const marker = createMarker(status);

        assert.equal(findByClass(marker, 'maplibre-sos-marker__halo'), null);
        assert.ok(
            findByClass(
                marker,
                'maplibre-sos-marker__indicator',
            )?.innerHTML.includes('SOS'),
        );
        assert.match(
            marker.attributes.get('aria-label') ?? '',
            /SOS incident for Worker One/,
        );
    }
});

test('uses a strong static halo when reduced motion is requested', () => {
    const marker = createMarker('active', true);
    const halo = findByClass(marker, 'maplibre-sos-marker__halo');

    assert.ok(halo);
    assert.equal(halo?.style.animation, 'none');
    assert.match(halo?.style.boxShadow ?? '', /0 0 0 6px/);
});

test('keeps the halo inside the same marker element that MapLibre repositions', () => {
    const marker = createMarker('acknowledged');
    const halo = findByClass(marker, 'maplibre-sos-marker__halo');
    const surface = findByClass(marker, 'maplibre-asset-marker__surface');

    assert.ok(halo);
    assert.ok(surface);
    assert.ok(marker.children.includes(halo));
    assert.ok(marker.children.includes(surface));
});

test('follows the affected worker when a newer live location replaces the SOS snapshot', () => {
    const incident = {
        location: {
            latitude: 14.61,
            longitude: 121.02,
        },
    } as never;
    const initialLocation = {
        latitude: 14.62,
        longitude: 121.03,
    } as never;
    const updatedLocation = {
        latitude: 14.63,
        longitude: 121.04,
    } as never;

    assert.deepEqual(
        getSosMarkerPosition(incident, initialLocation),
        [121.03, 14.62],
    );
    assert.deepEqual(
        getSosMarkerPosition(incident, updatedLocation),
        [121.04, 14.63],
    );
    assert.deepEqual(getSosMarkerPosition(incident), [121.02, 14.61]);
});
