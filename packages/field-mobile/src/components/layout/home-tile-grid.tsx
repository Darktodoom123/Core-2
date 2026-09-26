import React from 'react';
import {
    Pressable,
    StyleSheet,
    Text,
    View,
    useWindowDimensions,
} from 'react-native';
import { useTheme } from '../../theme';
import type { ThemeColors } from '../../theme';
import { Icon } from '../common/Icon';
import type { IconName } from '../common/Icon';

export interface HomeTile<Id extends string = string> {
    id: Id;
    title: string;
    sublabel: string;
    iconName: IconName;
    badgeCount?: number;
}

interface HomeTileGridProps<Id extends string> {
    tiles: HomeTile<Id>[];
    wideTile?: HomeTile<Id>;
    onPressTile: (id: Id) => void;
}

// Screen gutters (16dp each side) plus two 8dp gaps between three columns.
const THREE_COLUMN_CHROME_DP = 48;
// Narrowest tile, in font-scaled dp, that still fits "Inspection" at 15sp.
const MIN_TILE_WIDTH_DP = 100;

export const getHomeTileColumns = (width: number, fontScale: number): 2 | 3 =>
    (width - THREE_COLUMN_CHROME_DP) / 3 / fontScale >= MIN_TILE_WIDTH_DP
        ? 3
        : 2;

const chunk = <T,>(items: T[], size: number): T[][] =>
    Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
        items.slice(index * size, index * size + size),
    );

const tileAccessibilityLabel = (tile: HomeTile): string => {
    const base = `${tile.title.replace(/\n/g, ' ')} tile, ${tile.sublabel}`;

    return tile.badgeCount ? `${base}, ${tile.badgeCount} pending` : base;
};

const surfaceStyle = (theme: ThemeColors, pressed: boolean) => ({
    backgroundColor: pressed ? theme.surfaceHighlight : theme.surface,
    borderColor: theme.border,
});

export function HomeTileGrid<Id extends string>({
    tiles,
    wideTile,
    onPressTile,
}: HomeTileGridProps<Id>) {
    const { theme, isDarkHud } = useTheme();
    const { width, fontScale } = useWindowDimensions();
    const columns = getHomeTileColumns(width, fontScale);
    const rows = chunk(tiles, columns);
    const badgeTextColor = isDarkHud ? theme.textInverse : theme.textPrimary;

    return (
        <View style={styles.grid} testID="industrial-tile-grid">
            {rows.map((row, rowIndex) => (
                <View
                    key={`tile-row-${rowIndex + 1}`}
                    style={styles.row}
                    testID={`tile-row-${rowIndex + 1}`}
                >
                    {row.map((tile) => (
                        <Pressable
                            accessibilityLabel={tileAccessibilityLabel(tile)}
                            accessibilityRole="button"
                            key={tile.id}
                            onPress={() => onPressTile(tile.id)}
                            style={({ pressed }) => [
                                styles.tile,
                                surfaceStyle(theme, pressed),
                            ]}
                            testID={`tile-${tile.id}`}
                        >
                            {tile.badgeCount ? (
                                <View
                                    style={[
                                        styles.badge,
                                        { backgroundColor: theme.brandAmber },
                                    ]}
                                    testID={`tile-${tile.id}-badge`}
                                >
                                    <Text
                                        style={[
                                            styles.badgeText,
                                            { color: badgeTextColor },
                                        ]}
                                    >
                                        {tile.badgeCount}
                                    </Text>
                                </View>
                            ) : null}
                            <View
                                style={[
                                    styles.iconHalo,
                                    { backgroundColor: theme.canvas },
                                ]}
                            >
                                <Icon
                                    color={theme.textPrimary}
                                    name={tile.iconName}
                                    size={24}
                                />
                            </View>
                            <Text
                                style={[
                                    styles.title,
                                    { color: theme.textPrimary },
                                ]}
                            >
                                {tile.title}
                            </Text>
                            <Text
                                style={[
                                    styles.sublabel,
                                    { color: theme.textSecondary },
                                ]}
                            >
                                {tile.sublabel}
                            </Text>
                        </Pressable>
                    ))}
                    {Array.from(
                        { length: columns - row.length },
                        (_, index) => (
                            <View
                                key={`spacer-${index}`}
                                style={styles.spacer}
                            />
                        ),
                    )}
                </View>
            ))}
            {wideTile ? (
                <Pressable
                    accessibilityLabel={tileAccessibilityLabel(wideTile)}
                    accessibilityRole="button"
                    onPress={() => onPressTile(wideTile.id)}
                    style={({ pressed }) => [
                        styles.tile,
                        styles.wideTile,
                        surfaceStyle(theme, pressed),
                    ]}
                    testID={`tile-${wideTile.id}`}
                >
                    <View
                        style={[
                            styles.iconHalo,
                            styles.wideIconHalo,
                            { backgroundColor: theme.canvas },
                        ]}
                    >
                        <Icon
                            color={theme.textPrimary}
                            name={wideTile.iconName}
                            size={24}
                        />
                    </View>
                    <View style={styles.wideText}>
                        <Text
                            style={[
                                styles.title,
                                styles.wideTitle,
                                { color: theme.textPrimary },
                            ]}
                        >
                            {wideTile.title}
                        </Text>
                        <Text
                            style={[
                                styles.sublabel,
                                styles.wideSublabel,
                                { color: theme.textSecondary },
                            ]}
                        >
                            {wideTile.sublabel}
                        </Text>
                    </View>
                    <Icon
                        color={theme.textSecondary}
                        name="chevron-right"
                        size={20}
                    />
                </Pressable>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    grid: {
        gap: 8,
        marginBottom: 14,
    },
    row: {
        flexDirection: 'row',
        gap: 8,
    },
    tile: {
        alignItems: 'center',
        borderRadius: 12,
        borderWidth: 1,
        flex: 1,
        justifyContent: 'flex-start',
        minHeight: 112,
        padding: 10,
        position: 'relative',
    },
    spacer: {
        flex: 1,
    },
    iconHalo: {
        alignItems: 'center',
        borderRadius: 20,
        height: 40,
        justifyContent: 'center',
        marginBottom: 8,
        width: 40,
    },
    title: {
        fontSize: 15,
        fontWeight: '700',
        letterSpacing: -0.2,
        lineHeight: 19,
        textAlign: 'center',
    },
    sublabel: {
        fontSize: 12,
        fontWeight: '500',
        lineHeight: 16,
        marginTop: 2,
        textAlign: 'center',
    },
    badge: {
        alignItems: 'center',
        borderRadius: 11,
        height: 22,
        justifyContent: 'center',
        minWidth: 22,
        paddingHorizontal: 6,
        position: 'absolute',
        right: 6,
        top: 6,
        zIndex: 1,
    },
    badgeText: {
        fontSize: 12,
        fontVariant: ['tabular-nums'],
        fontWeight: '800',
    },
    wideTile: {
        flex: 0,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        minHeight: 64,
        paddingHorizontal: 12,
    },
    wideIconHalo: {
        marginBottom: 0,
    },
    wideText: {
        flex: 1,
    },
    wideTitle: {
        textAlign: 'left',
    },
    wideSublabel: {
        textAlign: 'left',
    },
});
