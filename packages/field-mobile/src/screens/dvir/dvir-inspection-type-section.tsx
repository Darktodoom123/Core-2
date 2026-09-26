import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useThemedStyles } from '../../theme';
import { createDvirSharedStyles } from './dvir-shared-styles';

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
    const dvirSharedStyles = useThemedStyles(createDvirSharedStyles);

    return (
        <View style={dvirSharedStyles.formSection}>
            <Text style={[dvirSharedStyles.formSectionTitle]}>
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
                        mode === 'pre_trip' &&
                            dvirSharedStyles.toggleCardActive,
                    ]}
                    testID="tab-pre-trip"
                >
                    <Text
                        style={[
                            dvirSharedStyles.toggleCardText,
                            mode === 'pre_trip' &&
                                dvirSharedStyles.toggleCardTextActive,
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
                        mode === 'post_trip' &&
                            dvirSharedStyles.toggleCardActive,
                    ]}
                    testID="tab-post-trip"
                >
                    <Text
                        style={[
                            dvirSharedStyles.toggleCardText,
                            mode === 'post_trip' &&
                                dvirSharedStyles.toggleCardTextActive,
                        ]}
                    >
                        2. Post-Trip
                    </Text>
                </Pressable>
            </View>
        </View>
    );
};
