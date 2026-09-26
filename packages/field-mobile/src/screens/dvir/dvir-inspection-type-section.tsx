import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTheme } from '../../theme';
import { dvirSharedStyles } from './dvir-shared-styles';

export interface DvirInspectionTypeSectionProps {
    mode: 'pre_trip' | 'post_trip' | 'history';
    setIsSaved: React.Dispatch<React.SetStateAction<boolean>>;
    setMode: React.Dispatch<
        React.SetStateAction<'pre_trip' | 'post_trip' | 'history'>
    >;
}

export const DvirInspectionTypeSection: React.FC<
    DvirInspectionTypeSectionProps
> = ({ mode, setIsSaved, setMode }) => {
    const { isDarkHud } = useTheme();

    return (
        <View style={dvirSharedStyles.formSection}>
            <Text
                style={[
                    dvirSharedStyles.formSectionTitle,
                    isDarkHud && dvirSharedStyles.darkFormSectionTitle,
                ]}
            >
                Choose inspection type
            </Text>
            <Text style={dvirSharedStyles.requiredBadge}>Required</Text>

            <View style={dvirSharedStyles.toggleRow}>
                <Pressable
                    accessibilityLabel="Pre-Trip Inspection"
                    accessibilityRole="button"
                    accessibilityState={{
                        selected: mode === 'pre_trip',
                    }}
                    onPress={() => {
                        setMode('pre_trip');
                        setIsSaved(false);
                    }}
                    style={[
                        dvirSharedStyles.toggleCard,
                        isDarkHud && dvirSharedStyles.darkToggleCard,
                        mode === 'pre_trip' &&
                            dvirSharedStyles.toggleCardActive,
                        isDarkHud &&
                            mode === 'pre_trip' &&
                            dvirSharedStyles.darkToggleCardActive,
                    ]}
                    testID="tab-pre-trip"
                >
                    <Text
                        style={[
                            dvirSharedStyles.toggleCardText,
                            isDarkHud && dvirSharedStyles.darkToggleCardText,
                            mode === 'pre_trip' &&
                                dvirSharedStyles.toggleCardTextActive,
                            isDarkHud &&
                                mode === 'pre_trip' &&
                                dvirSharedStyles.darkToggleCardTextActive,
                        ]}
                    >
                        1. Pre-Trip
                    </Text>
                </Pressable>

                <Pressable
                    accessibilityLabel="Post-Trip Inspection"
                    accessibilityRole="button"
                    accessibilityState={{
                        selected: mode === 'post_trip',
                    }}
                    onPress={() => {
                        setMode('post_trip');
                        setIsSaved(false);
                    }}
                    style={[
                        dvirSharedStyles.toggleCard,
                        isDarkHud && dvirSharedStyles.darkToggleCard,
                        mode === 'post_trip' &&
                            dvirSharedStyles.toggleCardActive,
                        isDarkHud &&
                            mode === 'post_trip' &&
                            dvirSharedStyles.darkToggleCardActive,
                    ]}
                    testID="tab-post-trip"
                >
                    <Text
                        style={[
                            dvirSharedStyles.toggleCardText,
                            isDarkHud && dvirSharedStyles.darkToggleCardText,
                            mode === 'post_trip' &&
                                dvirSharedStyles.toggleCardTextActive,
                            isDarkHud &&
                                mode === 'post_trip' &&
                                dvirSharedStyles.darkToggleCardTextActive,
                        ]}
                    >
                        2. Post-Trip
                    </Text>
                </Pressable>
            </View>
        </View>
    );
};
