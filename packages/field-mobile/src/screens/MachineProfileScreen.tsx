import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Icon } from '../components/common/Icon';
import { TileScreenHeader } from '../components/layout/tile-screen-header';
import { useTheme, useThemedStyles } from '../theme';
import type { ThemeColors } from '../theme';
import type { AssetAssignment } from '../types/index';
import { MachineDetails } from './machine-profile/machine-details';
import { MachineReadiness } from './machine-profile/machine-readiness';
import type { MachineDvirStatus } from './machine-profile/machine-readiness';

export interface MachineProfileScreenProps {
    assets: AssetAssignment[];
    dvirStatus: MachineDvirStatus;
    selectedAssetId?: number | null;
    onSelectAsset?: (assetId: number) => void;
    onBack?: () => void;
    onOpenDvir?: () => void;
    onOpenDocuments?: () => void;
}

/**
 * The operator's view of the machine on this shift: what it is, whether it is
 * cleared to operate, and where to report a defect or find its documents.
 * Maintenance work orders and post-repair release are technician work and
 * are not part of the field app.
 */
export const MachineProfileScreen: React.FC<MachineProfileScreenProps> = ({
    assets,
    dvirStatus,
    selectedAssetId,
    onSelectAsset,
    onBack,
    onOpenDvir,
    onOpenDocuments,
}) => {
    const { theme } = useTheme();
    const styles = useThemedStyles(createStyles);
    const [localSelection, setLocalSelection] = useState<number | null>(null);
    const selection = selectedAssetId ?? localSelection;
    const asset =
        assets.find((a) => a.operational_asset_id === selection) ??
        assets[0] ??
        null;

    return (
        <View style={styles.root} testID="machine-profile-screen">
            <TileScreenHeader
                backAccessibilityLabel="Back to dashboard"
                backTestID="equipment-back-button"
                category="Machine"
                onBack={onBack}
                subtitle={
                    asset
                        ? `${asset.asset_code} · ${asset.asset_name}`
                        : 'No machine on this shift'
                }
                title="Machine profile"
            />

            <ScrollView contentContainerStyle={styles.content}>
                {assets.length > 1 ? (
                    <View
                        accessibilityLabel="Select assigned machine"
                        accessibilityRole="radiogroup"
                        style={styles.selector}
                    >
                        {assets.map((item) => {
                            const isSelected =
                                item.operational_asset_id ===
                                asset?.operational_asset_id;

                            return (
                                <Pressable
                                    accessibilityLabel={`${item.asset_code}, ${item.asset_name}`}
                                    accessibilityRole="radio"
                                    accessibilityState={{
                                        selected: isSelected,
                                    }}
                                    key={item.operational_asset_id}
                                    onPress={() => {
                                        setLocalSelection(
                                            item.operational_asset_id,
                                        );
                                        onSelectAsset?.(
                                            item.operational_asset_id,
                                        );
                                    }}
                                    style={[
                                        styles.chip,
                                        isSelected && styles.chipSelected,
                                    ]}
                                    testID={`machine-select-${item.operational_asset_id}`}
                                >
                                    <Text
                                        style={[
                                            styles.chipText,
                                            isSelected &&
                                                styles.chipTextSelected,
                                        ]}
                                    >
                                        {item.asset_code}
                                    </Text>
                                </Pressable>
                            );
                        })}
                    </View>
                ) : null}

                {asset ? (
                    <>
                        <MachineReadiness
                            onOpenDvir={onOpenDvir}
                            status={dvirStatus}
                        />
                        <MachineDetails asset={asset} />

                        {onOpenDvir ? (
                            <Pressable
                                accessibilityHint="Opens the vehicle inspection to record the defect"
                                accessibilityLabel="Report a defect"
                                accessibilityRole="button"
                                onPress={onOpenDvir}
                                style={({ pressed }) => [
                                    styles.secondary,
                                    pressed && styles.pressed,
                                ]}
                                testID="machine-report-defect-btn"
                            >
                                <Icon
                                    color={theme.textPrimary}
                                    name="alert"
                                    size={16}
                                />
                                <Text style={styles.secondaryText}>
                                    Report a defect
                                </Text>
                            </Pressable>
                        ) : null}
                        {onOpenDocuments ? (
                            <Pressable
                                accessibilityLabel="Open documents and permits for this machine"
                                accessibilityRole="button"
                                onPress={onOpenDocuments}
                                style={({ pressed }) => [
                                    styles.secondary,
                                    pressed && styles.pressed,
                                ]}
                                testID="machine-documents-btn"
                            >
                                <Icon
                                    color={theme.textPrimary}
                                    name="document"
                                    size={16}
                                />
                                <Text style={styles.secondaryText}>
                                    Documents & permits
                                </Text>
                            </Pressable>
                        ) : null}
                    </>
                ) : (
                    <View style={styles.empty} testID="machine-empty">
                        <Icon
                            color={theme.textSecondary}
                            name="crane"
                            size={32}
                        />
                        <Text style={styles.emptyTitle}>
                            No machine assigned
                        </Text>
                        <Text style={styles.emptyBody}>
                            Dispatch has not assigned a machine to this shift.
                            Its details appear here once they do.
                        </Text>
                    </View>
                )}
            </ScrollView>
        </View>
    );
};

const createStyles = (theme: ThemeColors) =>
    StyleSheet.create({
        root: {
            backgroundColor: theme.canvas,
            flex: 1,
        },
        content: {
            padding: 16,
            paddingBottom: 40,
        },
        selector: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 8,
            marginBottom: 14,
        },
        chip: {
            alignItems: 'center',
            backgroundColor: theme.surface,
            borderColor: theme.border,
            borderRadius: 24,
            borderWidth: 1,
            justifyContent: 'center',
            minHeight: 48,
            paddingHorizontal: 16,
        },
        chipSelected: {
            backgroundColor: theme.brandAmberLight,
            borderColor: theme.brandAmber,
        },
        chipText: {
            color: theme.textSecondary,
            fontFamily: 'monospace',
            fontSize: 14,
            fontWeight: '500',
        },
        chipTextSelected: {
            color: theme.textPrimary,
            fontWeight: '700',
        },
        secondary: {
            alignItems: 'center',
            backgroundColor: theme.surface,
            borderColor: theme.borderStrong,
            borderRadius: 12,
            borderWidth: 1,
            flexDirection: 'row',
            gap: 8,
            justifyContent: 'center',
            marginBottom: 10,
            minHeight: 48,
        },
        secondaryText: {
            color: theme.textPrimary,
            fontSize: 15,
            fontWeight: '700',
        },
        pressed: {
            opacity: 0.85,
        },
        empty: {
            alignItems: 'center',
            backgroundColor: theme.surface,
            borderColor: theme.border,
            borderRadius: 16,
            borderWidth: 1,
            gap: 8,
            padding: 28,
        },
        emptyTitle: {
            color: theme.textPrimary,
            fontSize: 17,
            fontWeight: '700',
        },
        emptyBody: {
            color: theme.textSecondary,
            fontSize: 14,
            lineHeight: 20,
            textAlign: 'center',
        },
    });
