import React from 'react';
import {
    KeyboardAvoidingView,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import type { FieldApiClient } from '../../services/apiClient';
import { useTheme, useThemedStyles } from '../../theme';
import type { ThemeColors } from '../../theme';
import type { EquipmentHandoverClaimResponse } from '../../types/index';
import { Icon } from '../common/Icon';
import { IncomingClaim } from './relief-handover/incoming-claim';
import { OutgoingHandover } from './relief-handover/outgoing-handover';

export interface ReliefHandoverModalProps {
    visible: boolean;
    mode?: 'outgoing_offer' | 'incoming_claim';
    apiClient?: FieldApiClient;
    isOnline?: boolean | null;
    /** Outgoing: the job being handed over. */
    jobId?: number | null;
    /** Outgoing: the unit's code, shown until the server confirms it. */
    assetCode?: string;
    /** Relief: called only after the server accepted the claim. */
    onClaimed?: (result: EquipmentHandoverClaimResponse) => void;
    onClose: () => void;
}

/**
 * Hot-seat handover between operators. The outgoing operator gets a PIN from
 * the server; the relief operator claims the unit with its code and that PIN.
 * Nothing here marks a unit as handed over until the server says so.
 */
export const ReliefHandoverModal: React.FC<ReliefHandoverModalProps> = ({
    visible,
    mode = 'outgoing_offer',
    apiClient,
    isOnline,
    jobId,
    assetCode,
    onClaimed,
    onClose,
}) => {
    const { theme } = useTheme();
    const styles = useThemedStyles(createStyles);
    const isOutgoing = mode === 'outgoing_offer';

    if (!visible) {
        return null;
    }

    return (
        <Modal
            animationType="slide"
            onRequestClose={onClose}
            transparent
            visible
        >
            <KeyboardAvoidingView
                behavior="padding"
                style={styles.root}
                testID="relief-handover-modal"
            >
                <Pressable
                    accessibilityLabel="Close handover"
                    accessibilityRole="button"
                    onPress={onClose}
                    style={[StyleSheet.absoluteFill, styles.scrim]}
                />
                <View style={styles.dialog}>
                    <View style={styles.header}>
                        <Text accessibilityRole="header" style={styles.title}>
                            {isOutgoing
                                ? 'Hand over this unit'
                                : 'Claim a unit'}
                        </Text>
                        <Pressable
                            accessibilityLabel="Close handover"
                            accessibilityRole="button"
                            hitSlop={8}
                            onPress={onClose}
                            style={({ pressed }) => [
                                styles.close,
                                pressed && styles.pressed,
                            ]}
                            testID="relief-handover-close"
                        >
                            <Icon
                                color={theme.textPrimary}
                                name="close"
                                size={20}
                            />
                        </Pressable>
                    </View>
                    <ScrollView
                        contentContainerStyle={styles.content}
                        keyboardShouldPersistTaps="handled"
                    >
                        {isOutgoing ? (
                            <OutgoingHandover
                                apiClient={apiClient}
                                assetCode={assetCode}
                                jobId={jobId}
                            />
                        ) : (
                            <IncomingClaim
                                apiClient={apiClient}
                                isOnline={isOnline}
                                onClaimed={(result) => {
                                    onClaimed?.(result);
                                    onClose();
                                }}
                            />
                        )}
                    </ScrollView>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
};

const createStyles = (theme: ThemeColors) =>
    StyleSheet.create({
        root: {
            flex: 1,
            justifyContent: 'flex-end',
        },
        scrim: {
            backgroundColor: theme.surfaceDark,
            opacity: 0.6,
        },
        dialog: {
            backgroundColor: theme.surface,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            elevation: 12,
            maxHeight: '90%',
        },
        header: {
            alignItems: 'center',
            borderBottomColor: theme.border,
            borderBottomWidth: 1,
            flexDirection: 'row',
            justifyContent: 'space-between',
            paddingHorizontal: 20,
            paddingVertical: 12,
        },
        title: {
            color: theme.textPrimary,
            fontSize: 20,
            fontWeight: '700',
        },
        close: {
            alignItems: 'center',
            borderColor: theme.border,
            borderRadius: 12,
            borderWidth: 1,
            height: 48,
            justifyContent: 'center',
            width: 48,
        },
        content: {
            padding: 20,
            paddingBottom: 32,
        },
        pressed: {
            transform: [{ scale: 0.985 }],
        },
    });
