import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    getDefaultInspectionChecks,
    getEquipmentPresentation,
    resolveDesignatedEquipmentType,
} from '../utils/equipmentClassification';

describe('equipmentClassification utility', () => {
    describe('resolveDesignatedEquipmentType', () => {
        it('falls back to mobile_crane if null or empty descriptor provided', () => {
            assert.equal(resolveDesignatedEquipmentType(null), 'mobile_crane');
            assert.equal(
                resolveDesignatedEquipmentType(undefined),
                'mobile_crane',
            );
            assert.equal(resolveDesignatedEquipmentType({}), 'mobile_crane');
        });

        it('respects explicit equipmentType override', () => {
            assert.equal(
                resolveDesignatedEquipmentType({
                    assetCode: 'ALB-CRN-050',
                    equipmentType: 'tower_crane',
                }),
                'tower_crane',
            );

            assert.equal(
                resolveDesignatedEquipmentType({
                    assetCode: 'TWR-01',
                    equipmentType: 'carrier',
                }),
                'carrier',
            );

            assert.equal(
                resolveDesignatedEquipmentType({
                    equipmentType: 'mobile_crane',
                }),
                'mobile_crane',
            );
        });

        it('resolves Tower Crane via assetKind', () => {
            assert.equal(
                resolveDesignatedEquipmentType({ assetKind: 'tower_crane' }),
                'tower_crane',
            );
            assert.equal(
                resolveDesignatedEquipmentType({ assetKind: 'tower' }),
                'tower_crane',
            );
            assert.equal(
                resolveDesignatedEquipmentType({ assetKind: 'climbing_crane' }),
                'tower_crane',
            );
            assert.equal(
                resolveDesignatedEquipmentType({ assetKind: 'hoist' }),
                'tower_crane',
            );
        });

        it('resolves Vehicle / Carrier via assetKind', () => {
            assert.equal(
                resolveDesignatedEquipmentType({ assetKind: 'truck' }),
                'carrier',
            );
            assert.equal(
                resolveDesignatedEquipmentType({ assetKind: 'vehicle' }),
                'carrier',
            );
            assert.equal(
                resolveDesignatedEquipmentType({ assetKind: 'carrier' }),
                'carrier',
            );
            assert.equal(
                resolveDesignatedEquipmentType({ assetKind: 'fleet' }),
                'carrier',
            );
            assert.equal(
                resolveDesignatedEquipmentType({ assetKind: 'lowbed' }),
                'carrier',
            );
            assert.equal(
                resolveDesignatedEquipmentType({ assetKind: 'flatbed' }),
                'carrier',
            );
        });

        it('resolves Mobile Crane via assetKind', () => {
            assert.equal(
                resolveDesignatedEquipmentType({ assetKind: 'mobile_crane' }),
                'mobile_crane',
            );
            assert.equal(
                resolveDesignatedEquipmentType({ assetKind: 'crane' }),
                'mobile_crane',
            );
            assert.equal(
                resolveDesignatedEquipmentType({ assetKind: 'all_terrain' }),
                'mobile_crane',
            );
            assert.equal(
                resolveDesignatedEquipmentType({ assetKind: 'rough_terrain' }),
                'mobile_crane',
            );
            assert.equal(
                resolveDesignatedEquipmentType({ assetKind: 'crawler' }),
                'mobile_crane',
            );
        });

        it('resolves Tower Crane via assetCode and assetName heuristics', () => {
            assert.equal(
                resolveDesignatedEquipmentType({
                    assetCode: 'TWR-CRN-280',
                    assetName: 'Liebherr 280 EC-H',
                }),
                'tower_crane',
            );

            assert.equal(
                resolveDesignatedEquipmentType({
                    assetCode: 'CRN-POTAIN',
                    assetName: 'Potain MDT 389 Top-Slewing',
                }),
                'tower_crane',
            );

            assert.equal(
                resolveDesignatedEquipmentType({
                    assetCode: 'EQ-WOLFF',
                    assetName: 'Wolff Hammerhead Crane',
                }),
                'tower_crane',
            );
        });

        it('resolves Vehicle via assetCode and assetName heuristics', () => {
            assert.equal(
                resolveDesignatedEquipmentType({
                    assetCode: 'TRK-202',
                    assetName: 'Heavy Rig Truck',
                }),
                'carrier',
            );

            assert.equal(
                resolveDesignatedEquipmentType({
                    assetCode: 'FLT-09',
                    assetName: 'Freightliner Lowbed 40T Trailer',
                }),
                'carrier',
            );

            assert.equal(
                resolveDesignatedEquipmentType({
                    assetCode: 'ESC-01',
                    assetName: 'Ford F-150 Field Escort Pickup',
                }),
                'carrier',
            );
        });

        it('resolves Mobile Crane via assetCode and assetName heuristics', () => {
            assert.equal(
                resolveDesignatedEquipmentType({
                    assetCode: 'ALB-CRN-050',
                    assetName: '50T Tadano All-Terrain Crane',
                }),
                'mobile_crane',
            );

            assert.equal(
                resolveDesignatedEquipmentType({
                    assetCode: 'CRN-LTM',
                    assetName: 'Liebherr LTM 1050-3.1',
                }),
                'mobile_crane',
            );

            assert.equal(
                resolveDesignatedEquipmentType({
                    assetCode: 'CRN-ROUGH',
                    assetName: 'Grove RT540 Rough-Terrain',
                }),
                'mobile_crane',
            );
        });
    });

    describe('getEquipmentPresentation', () => {
        it('returns proper presentation for tower crane', () => {
            const pres = getEquipmentPresentation('tower_crane');
            assert.equal(pres.type, 'tower_crane');
            assert.equal(pres.icon, '🗼');
            assert.equal(pres.modalTitle, 'Add Tower Crane Defects');
            assert.equal(pres.defectsSectionTitle, 'Add crane tower defects');
            assert.equal(pres.safetySafeLabel, 'Safe to operate');
            assert.ok(pres.safetyDisclaimer.includes('crane operator'));
            assert.ok(pres.designatedBadgeLabel.includes('Tower Crane'));
        });

        it('returns proper presentation for mobile crane', () => {
            const pres = getEquipmentPresentation('mobile_crane');
            assert.equal(pres.type, 'mobile_crane');
            assert.equal(pres.icon, '🏗️');
            assert.equal(pres.modalTitle, 'Add Mobile Crane Defects');
            assert.equal(pres.defectsSectionTitle, 'Add mobile crane defects');
            assert.equal(pres.safetySafeLabel, 'Safe to drive');
            assert.ok(pres.safetyDisclaimer.includes('crane operator'));
            assert.ok(pres.designatedBadgeLabel.includes('Mobile Crane'));
        });

        it('returns proper presentation for carrier / vehicle', () => {
            const pres = getEquipmentPresentation('carrier');
            assert.equal(pres.type, 'carrier');
            assert.equal(pres.icon, '🚛');
            assert.equal(pres.modalTitle, 'Add Vehicle Defects');
            assert.equal(pres.defectsSectionTitle, 'Add vehicle defects');
            assert.equal(pres.safetySafeLabel, 'Safe to drive');
            assert.ok(pres.safetyDisclaimer.includes('driver'));
            assert.ok(pres.designatedBadgeLabel.includes('Carrier'));
        });
    });

    describe('getDefaultInspectionChecks', () => {
        it('provides tower crane specific checks (mast, jib, trolley, LMI)', () => {
            const checks = getDefaultInspectionChecks('tower_crane');
            const labels = checks.map((c) => c.label);
            assert.ok(labels.some((l) => l.includes('Tower mast')));
            assert.ok(labels.some((l) => l.includes('Main jib lattice')));
            assert.ok(labels.some((l) => l.includes('Trolley winch')));
            assert.ok(labels.some((l) => l.includes('Load Moment Indicator')));
            // No truck tires on a tower crane
            assert.equal(
                labels.some((l) => l.includes('Tire pressures')),
                false,
            );
        });

        it('provides carrier / vehicle specific checks (air brakes, steering, tires)', () => {
            const checks = getDefaultInspectionChecks('carrier');
            const labels = checks.map((c) => c.label);
            assert.ok(labels.some((l) => l.includes('Air brake')));
            assert.ok(labels.some((l) => l.includes('Steering linkage')));
            assert.ok(labels.some((l) => l.includes('Tire pressures')));
            // No LMI on a standard truck
            assert.equal(
                labels.some((l) => l.includes('Load Moment Indicator')),
                false,
            );
        });

        it('provides mobile crane specific checks (boom, outriggers, LMI, tires)', () => {
            const checks = getDefaultInspectionChecks('mobile_crane');
            const labels = checks.map((c) => c.label);
            assert.ok(labels.some((l) => l.includes('outrigger')));
            assert.ok(labels.some((l) => l.includes('Telescopic boom')));
            assert.ok(labels.some((l) => l.includes('Load Moment Indicator')));
            assert.ok(labels.some((l) => l.includes('Tire pressures')));
        });
    });
});
