export const colors = {
  primary: '#FFBF00', // Yellow
  primaryDark: '#E5AB00',
  primaryLight: '#FFD659',
  secondary: '#1E293B', // Dark Slate
  secondaryLight: '#334155',
  background: '#F8FAFC', // Slate 50
  surface: '#FFFFFF',
  text: '#1E293B',
  textMuted: '#64748B',
  border: '#E2E8F0',
  error: '#EF4444',
  success: '#10B981',
  warning: '#F59E0B',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const typography = {
  h1: { fontSize: 24, fontWeight: 'bold', color: colors.text },
  h2: { fontSize: 20, fontWeight: 'bold', color: colors.text },
  h3: { fontSize: 18, fontWeight: '600', color: colors.text },
  body: { fontSize: 16, color: colors.text },
  bodySmall: { fontSize: 14, color: colors.textMuted },
  caption: { fontSize: 12, color: colors.textMuted },
};

export const NavigationTheme = {
  dark: false,
  colors: {
    primary: colors.primary,
    background: colors.background,
    card: colors.surface,
    text: colors.text,
    border: colors.border,
    notification: colors.error,
  },
};
