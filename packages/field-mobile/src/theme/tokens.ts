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
    brandAmberText: string;
    actionCobalt: string;
    actionCobaltLight: string;
    successEmerald: string;
    successEmeraldLight: string;
    successEmeraldText: string;
    hazardRed: string;
    hazardRedLight: string;
    hazardRedText: string;
    // Warning & conflict (distinct from brand gold)
    warningOrange: string;
    warningOrangeLight: string;
    warningOrangeText: string;
    // Duty category colors for HoS graphs and badges only (see mobile.md).
    dutyOnDuty: string;
    dutyDriving: string;
    dutyStandby: string;
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
    brandAmberText: '#806000',
    actionCobalt: '#2563EB',
    actionCobaltLight: '#EFF6FF',
    successEmerald: '#059669',
    successEmeraldLight: '#ECFDF5',
    successEmeraldText: '#047857',
    hazardRed: '#DC2626',
    hazardRedLight: '#FEF2F2',
    hazardRedText: '#B91C1C',
    warningOrange: '#EA580C',
    warningOrangeLight: '#FFF7ED',
    warningOrangeText: '#9A3412',
    dutyOnDuty: '#134E4A',
    dutyDriving: '#2563EB',
    dutyStandby: '#6D28D9',
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
    brandAmberText: '#FFBF00',
    actionCobalt: '#3B82F6',
    actionCobaltLight: '#1E3A8A',
    successEmerald: '#10B981',
    successEmeraldLight: '#064E3B',
    successEmeraldText: '#6EE7B7',
    hazardRed: '#EF4444',
    hazardRedLight: '#7F1D1D',
    hazardRedText: '#FCA5A5',
    warningOrange: '#F97316',
    warningOrangeLight: '#7C2D12',
    warningOrangeText: '#FDBA74',
    dutyOnDuty: '#67E8F9',
    dutyDriving: '#60A5FA',
    dutyStandby: '#A78BFA',
    hudBezel: '#1E293B',
    hudGlowAmber: '#FFBF00',
    hudGlowEmerald: '#34D399',
};
