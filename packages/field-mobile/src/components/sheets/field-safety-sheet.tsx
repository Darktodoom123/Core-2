import React from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FieldSafetyScreen } from '../../screens/FieldSafetyScreen';
import { useTheme } from '../../theme';
import type {
    OutboxCommand,
    SafetyHazardCommandPayload,
    WorkStoppageCommandPayload,
    WorkStoppageType,
} from '../../types/index';

export interface FieldSafetySheetProps {
    visible: boolean;
    onClose: () => void;
    actorId?: number;
    activeSite?: string | null;
    isOnline?: boolean | null;
    commands: OutboxCommand[];
    onReportHazard: (payload: SafetyHazardCommandPayload) => Promise<string>;
    onIssueWorkStoppage: (
        payload: WorkStoppageCommandPayload,
    ) => Promise<string>;
    onRetryCommand?: (commandId: string) => void;
    initialMode?: 'home' | 'hazard' | 'stop-work';
    initialStoppageType?: WorkStoppageType;
}

export const FieldSafetySheet: React.FC<FieldSafetySheetProps> = ({
    visible,
    onClose,
    actorId,
    activeSite,
    isOnline,
    commands,
    onReportHazard,
    onIssueWorkStoppage,
    onRetryCommand,
    initialMode,
    initialStoppageType,
}) => {
    const { isDarkHud } = useTheme();

    if (!visible) {
        return null;
    }

    return (
        <Modal
            animationType="slide"
            onRequestClose={onClose}
            presentationStyle="fullScreen"
            testID="field-safety-sheet"
            visible={visible}
        >
            <SafeAreaView
                edges={['top', 'bottom']}
                style={[styles.fullScreen, isDarkHud && styles.darkFullScreen]}
            >
                <View style={styles.sheetContainer}>
                    <FieldSafetyScreen
                        activeSite={activeSite}
                        actorId={actorId}
                        commands={commands}
                        initialMode={initialMode}
                        initialStoppageType={initialStoppageType}
                        isOnline={isOnline}
                        onBack={onClose}
                        onIssueWorkStoppage={onIssueWorkStoppage}
                        onReportHazard={onReportHazard}
                        onRetryCommand={onRetryCommand}
                    />
                </View>
            </SafeAreaView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    fullScreen: {
        backgroundColor: '#F1F5F9',
        flex: 1,
    },
    darkFullScreen: {
        backgroundColor: '#090D16',
    },
    sheetContainer: {
        flex: 1,
    },
});
