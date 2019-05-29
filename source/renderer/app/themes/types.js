// @flow
export type BackgroundShades = Object;
export type ErrorShades = Object;

export type CreateThemeParams = {
  colors?: ColorParams,
  fonts?: ThemeFonts,
  config?: Object,
};

export type ColorParams = {
  error: string,
  primary: {
    background: string,
    border: string,
    focus: string,
    text: string,
  },
  secondary: {
    background: string,
    border: string,
    text: string,
  },
};

export type ThemeColors = {
  error: ErrorShades,
  primary: {
    background: BackgroundShades,
    border: string,
    focus: string,
    text: string,
  },
  secondary: {
    background: BackgroundShades,
    border: string,
    text: string,
  },
};

export type ThemeFonts = {
  black: string,
  bold: string,
  heavy: string,
  light: string,
  medium: string,
  mono: string,
  regular: string,
  semibold: string,
  thin: string,
  ultralight: string,
};
