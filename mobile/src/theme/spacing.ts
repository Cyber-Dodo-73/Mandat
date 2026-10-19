export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

/** Single corner radius used across every surface of the app. */
export const radius = 20;

/** Height of the bottom "edge" that gives 3D buttons their depth. */
export const buttonDepth = 5;

export const shadow = {
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.18,
  shadowRadius: 14,
  elevation: 4,
} as const;
