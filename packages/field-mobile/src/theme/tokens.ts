export type ThemeMode = 'light' | 'dark_hud';

export interface ThemeColors {
    mode: ThemeMode;
    // Canvas & Surfaces
    canvas: string;
    surface: string;
    surfaceElevated: string;
    surfaceHighlight: string;
    surfaceDark: string;
    // Borders
    border: string;
    borderSubtle: string;
    borderStrong: string;
    // Typography
    textPrimary: string;
    textSecondary: string;
    textMuted: string;
    textOnDark: string;
    textInverse: string;
    // Functional Brands
    brandAmber: string;
    brandAmberLight: string;
    actionCobalt: string;
    actionCobaltLight: string;
    successEmerald: string;
    successEmeraldLight: string;
    hazardRed: string;
    hazardRedLight: string;
    // Cockpit Instrument
    hudBezel: string;
    hudGlowAmber: string;
    hudGlowEmerald: string;
}

export const lightThemeColors: ThemeColors = {
    mode: 'light',
    canvas: '#F1F5F9',
    surface: '#FFFFFF',
    surfaceElevated: '#FFFFFF',
    surfaceHighlight: '#F8FAFC',
    surfaceDark: '#0F172A',
    border: '#E2E8F0',
    borderSubtle: '#F1F5F9',
    borderStrong: '#CBD5E1',
    textPrimary: '#0F172A',
    textSecondary: '#64748B',
    textMuted: '#64748B',
    textOnDark: '#FFFFFF',
    textInverse: '#FFFFFF',
    brandAmber: '#FFBF00',
    brandAmberLight: '#FFF3C4',
    actionCobalt: '#2563EB',
    actionCobaltLight: '#EFF6FF',
    successEmerald: '#059669',
    successEmeraldLight: '#ECFDF5',
    hazardRed: '#DC2626',
    hazardRedLight: '#FEF2F2',
    hudBezel: '#1E293B',
    hudGlowAmber: '#FFBF00',
    hudGlowEmerald: '#10B981',
};

export const darkHudThemeColors: ThemeColors = {
    mode: 'dark_hud',
    canvas: '#090D16',
    surface: '#1E293B',
    surfaceElevated: '#1E293B',
    surfaceHighlight: '#27354A',
    surfaceDark: '#090D16',
    border: '#334155',
    borderSubtle: '#1E293B',
    borderStrong: '#475569',
    textPrimary: '#F8FAFC',
    textSecondary: '#94A3B8',
    textMuted: '#94A3B8',
    textOnDark: '#FFFFFF',
    textInverse: '#0F172A',
    brandAmber: '#FFBF00',
    brandAmberLight: '#332800',
    actionCobalt: '#3B82F6',
    actionCobaltLight: '#1E3A8A',
    successEmerald: '#10B981',
    successEmeraldLight: '#064E3B',
    hazardRed: '#EF4444',
    hazardRedLight: '#7F1D1D',
    hudBezel: '#1E293B',
    hudGlowAmber: '#FFBF00',
    hudGlowEmerald: '#34D399',
};
