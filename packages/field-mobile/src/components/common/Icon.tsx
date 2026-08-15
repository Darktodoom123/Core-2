import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { colors } from '../nativeStyles';

export type IconName =
    | 'home'
    | 'route'
    | 'profile'
    | 'bell'
    | 'back'
    | 'check'
    | 'check-circle'
    | 'alert'
    | 'alert-circle'
    | 'crane'
    | 'truck'
    | 'tools'
    | 'fuel'
    | 'signature'
    | 'camera'
    | 'clock'
    | 'location'
    | 'sync'
    | 'speed'
    | 'chevron-right'
    | 'chevron-down'
    | 'shield-check'
    | 'file-text'
    | 'close'
    | 'power';

export interface IconProps {
    name: IconName;
    size?: number;
    color?: string;
}

export const Icon: React.FC<IconProps> = ({
    name,
    size = 20,
    color = colors.text,
}) => {
    switch (name) {
        case 'home':
            return <Ionicons name="grid-outline" size={size} color={color} />;
        case 'route':
            return (
                <Ionicons name="navigate-outline" size={size} color={color} />
            );
        case 'profile':
            return <Ionicons name="person-outline" size={size} color={color} />;
        case 'bell':
            return (
                <Ionicons
                    name="notifications-outline"
                    size={size}
                    color={color}
                />
            );
        case 'back':
            return <Ionicons name="arrow-back" size={size} color={color} />;
        case 'check':
            return <Ionicons name="checkmark" size={size} color={color} />;
        case 'check-circle':
            return (
                <Ionicons name="checkmark-circle" size={size} color={color} />
            );
        case 'alert':
            return (
                <Ionicons name="warning-outline" size={size} color={color} />
            );
        case 'alert-circle':
            return <Ionicons name="alert-circle" size={size} color={color} />;
        case 'crane':
            return (
                <MaterialCommunityIcons
                    name="crane"
                    size={size}
                    color={color}
                />
            );
        case 'truck':
            return (
                <MaterialCommunityIcons
                    name="truck-cargo-container"
                    size={size}
                    color={color}
                />
            );
        case 'tools':
            return (
                <Ionicons name="construct-outline" size={size} color={color} />
            );
        case 'fuel':
            return (
                <MaterialCommunityIcons
                    name="gas-station-outline"
                    size={size}
                    color={color}
                />
            );
        case 'signature':
            return (
                <MaterialCommunityIcons
                    name="draw-pen"
                    size={size}
                    color={color}
                />
            );
        case 'camera':
            return <Ionicons name="camera-outline" size={size} color={color} />;
        case 'clock':
            return <Ionicons name="time-outline" size={size} color={color} />;
        case 'location':
            return (
                <Ionicons name="location-outline" size={size} color={color} />
            );
        case 'sync':
            return <Ionicons name="sync-outline" size={size} color={color} />;
        case 'speed':
            return (
                <Ionicons
                    name="speedometer-outline"
                    size={size}
                    color={color}
                />
            );
        case 'chevron-right':
            return (
                <Ionicons name="chevron-forward" size={size} color={color} />
            );
        case 'chevron-down':
            return <Ionicons name="chevron-down" size={size} color={color} />;
        case 'shield-check':
            return (
                <Ionicons
                    name="shield-checkmark-outline"
                    size={size}
                    color={color}
                />
            );
        case 'file-text':
            return (
                <Ionicons
                    name="document-text-outline"
                    size={size}
                    color={color}
                />
            );
        case 'close':
            return <Ionicons name="close" size={size} color={color} />;
        case 'power':
            return <Ionicons name="power-outline" size={size} color={color} />;
        default:
            return (
                <Ionicons
                    name="information-circle-outline"
                    size={size}
                    color={color}
                />
            );
    }
};
