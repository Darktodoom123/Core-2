import { strict as assert } from 'node:assert';
import { afterEach, test } from 'node:test';
// prettier-ignore
// @ts-expect-error TS5097: this test is executed directly by Node's strip-types runner.
import { createAssetMarker, createPopupCard, getSosMarkerPosition } from './markers.ts';

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

    append(...nodes: (FakeElement | string)[]): void {
        nodes.forEach((node) => {
            if (typeof node !== 'string') {
                this.children.push(node);
            }
        });
    }

    addEventListener(..._args: unknown[]): void {
        void _args;
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

test('createPopupCard renders title, subtitle, semantic status, structured fields, and actions', () => {
    installFakeDocument();

    let copied = false;
    let selected = false;

    const popup = createPopupCard({
        title: 'CRN-101 · Zoomlion TC7035',
        subtitle: 'Stationary / Tower Crane',
        status: 'Live (≤2m)',
        statusTone: 'success',
        badge: '🚨 SOS: Active (Medical)',
        badgeTone: 'danger',
        fields: [
            { label: 'Personnel', value: 'Dev Crane Operator' },
            { label: 'Dispatch', value: 'DSP-2026-089 — BGC High-Rise Lift' },
            { label: 'Movement', value: 'Stationary' },
            { label: 'Captured', value: '9:56:34 PM' },
        ],
        locationName: 'Santa Mesa, Manila',
        coordinateText: '14.59950, 121.01420',
        onCopyCoordinates: () => {
            copied = true;
        },
        actionButton: {
            label: 'Select Resource',
            onClick: () => {
                selected = true;
            },
        },
    }) as unknown as FakeElement;

    assert.equal(popup.className, 'maplibre-popup-card');

    const titleEl = findByClass(popup, 'maplibre-popup-card__title');
    assert.equal(titleEl?.textContent, 'CRN-101 · Zoomlion TC7035');

    const subtitleEl = findByClass(popup, 'maplibre-popup-card__subtitle');
    assert.equal(subtitleEl?.textContent, 'Stationary / Tower Crane');

    const statusEl = findByClass(
        popup,
        'maplibre-popup-card__status maplibre-popup-card__status--success',
    );
    assert.ok(statusEl, 'Should render success status badge');

    const badgeEl = findByClass(
        popup,
        'maplibre-popup-card__alert-badge maplibre-popup-card__alert-badge--danger',
    );
    assert.ok(badgeEl, 'Should render emergency badge');
    assert.equal(badgeEl?.textContent, '🚨 SOS: Active (Medical)');

    const fieldsContainer = findByClass(popup, 'maplibre-popup-card__fields');
    assert.ok(fieldsContainer, 'Should render fields container');
    assert.equal(fieldsContainer?.children.length, 4);

    const locationTextEl = findByClass(
        popup,
        'maplibre-popup-card__location-text',
    );
    assert.equal(locationTextEl?.textContent, 'Santa Mesa, Manila');

    const coordEl = findByClass(popup, 'maplibre-popup-card__coord-text');
    assert.equal(coordEl?.textContent, '14.59950, 121.01420');

    const copyBtn = findByClass(popup, 'maplibre-popup-card__copy');
    assert.ok(copyBtn, 'Should render copy button');

    const actionBtn = findByClass(popup, 'maplibre-popup-card__action-btn');
    assert.ok(actionBtn, 'Should render action button');
    assert.equal(actionBtn?.textContent, 'Select Resource');

    assert.equal(copied, false);
    assert.equal(selected, false);
});
