import React from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DispatchOrdersScreen } from '../../screens/DispatchOrdersScreen';
import type { FieldApiClient } from '../../services/apiClient';
import { useTheme } from '../../theme';
import type {
    DispatchJob,
    DispatchStatus,
    OutboxCommand,
} from '../../types/index';

export interface DispatchIntakeSheetProps {
    visible: boolean;
    onClose: () => void;
    jobs: DispatchJob[];
    apiClient?: FieldApiClient;
    onAcceptAssignment?: (
        jobId: number,
        assignmentId: number,
        version: number,
    ) => void;
    onRejectAssignment?: (
        jobId: number,
        assignmentId: number,
        reason: string,
        version: number,
    ) => void;
    onSelectJob?: (jobId: number) => void;
    onTransitionStatus?: (
        jobId: number,
        nextStatus: DispatchStatus,
        version: number,
    ) => void;
    onReportDelay?: (job: DispatchJob) => void;
    conflictedCommands?: OutboxCommand[];
    onAcceptServerState?: (commandId: string) => void;
    onRetryNewVersion?: (commandId: string, newVersion: number) => void;
}

export const DispatchIntakeSheet: React.FC<DispatchIntakeSheetProps> = ({
    visible,
    onClose,
    jobs,
    apiClient,
    onAcceptAssignment,
    onRejectAssignment,
    onSelectJob,
    onTransitionStatus,
    onReportDelay,
    conflictedCommands,
    onAcceptServerState,
    onRetryNewVersion,
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
            visible={visible}
        >
            <SafeAreaView
                edges={['top', 'bottom']}
                style={[styles.fullScreen, isDarkHud && styles.darkFullScreen]}
            >
                <View
                    style={styles.sheetContainer}
                    testID="dispatch-intake-sheet"
                >
                    <DispatchOrdersScreen
                        apiClient={apiClient}
                        backTestID="close-dispatch-intake-btn"
                        conflictedCommands={conflictedCommands}
                        jobs={jobs}
                        onAcceptAssignment={onAcceptAssignment}
                        onAcceptServerState={onAcceptServerState}
                        onBack={onClose}
                        onRejectAssignment={onRejectAssignment}
                        onReportDelay={onReportDelay}
                        onRetryNewVersion={onRetryNewVersion}
                        onSelectJob={(jobId) => {
                            onSelectJob?.(jobId);
                            onClose();
                        }}
                        onTransitionStatus={onTransitionStatus}
                        testID="dispatch-orders-screen-view"
                    />
                </View>
            </SafeAreaView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    fullScreen: {
        backgroundColor: '#F8FAFC',
        flex: 1,
    },
    darkFullScreen: {
        backgroundColor: '#0F172A',
    },
    sheetContainer: {
        flex: 1,
    },
});
