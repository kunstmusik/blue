export function argbToRGB(argb: number): number {
  return argb & 0x00ffffff;
}

export function rgbToCSS(rgb: number): string {
  return `#${rgb.toString(16).padStart(6, '0')}`;
}

export const JAVA_FADE_ALPHA = Number((64 / 255).toFixed(3));

export function colorToCSS(argb: number): string {
  return rgbToCSS(argbToRGB(argb));
}

const JAVA_COLOR_FACTOR = 0.7;

export function javaAwtBrighter(rgb: number): number {
  let r = (rgb >> 16) & 0xff;
  let g = (rgb >> 8) & 0xff;
  let b = rgb & 0xff;

  const i = Math.trunc(1.0 / (1.0 - JAVA_COLOR_FACTOR));
  if (r === 0 && g === 0 && b === 0) {
    return (i << 16) | (i << 8) | i;
  }

  if (r > 0 && r < i) r = i;
  if (g > 0 && g < i) g = i;
  if (b > 0 && b < i) b = i;

  r = Math.min(Math.trunc(r / JAVA_COLOR_FACTOR), 255);
  g = Math.min(Math.trunc(g / JAVA_COLOR_FACTOR), 255);
  b = Math.min(Math.trunc(b / JAVA_COLOR_FACTOR), 255);

  return (r << 16) | (g << 8) | b;
}

export function javaAwtDarker(rgb: number): number {
  const r = Math.max(Math.trunc(((rgb >> 16) & 0xff) * JAVA_COLOR_FACTOR), 0);
  const g = Math.max(Math.trunc(((rgb >> 8) & 0xff) * JAVA_COLOR_FACTOR), 0);
  const b = Math.max(Math.trunc((rgb & 0xff) * JAVA_COLOR_FACTOR), 0);
  return (r << 16) | (g << 8) | b;
}

export function brighten(rgb: number, factor: number): number {
  const r = Math.min(255, Math.round(((rgb >> 16) & 0xff) * factor));
  const g = Math.min(255, Math.round(((rgb >> 8) & 0xff) * factor));
  const b = Math.min(255, Math.round((rgb & 0xff) * factor));
  return (r << 16) | (g << 8) | b;
}

export function darken(rgb: number, factor: number): number {
  const r = Math.max(0, Math.round(((rgb >> 16) & 0xff) * factor));
  const g = Math.max(0, Math.round(((rgb >> 8) & 0xff) * factor));
  const b = Math.max(0, Math.round((rgb & 0xff) * factor));
  return (r << 16) | (g << 8) | b;
}

export function isBright(rgb: number): boolean {
  const r = (rgb >> 16) & 0xff;
  const g = (rgb >> 8) & 0xff;
  const b = rgb & 0xff;
  return r + g + b > 384;
}

export function textColorForBackground(argb: number): string {
  return isBright(argbToRGB(argb)) ? '#000000' : '#ffffff';
}

export function waveColorForBackground(rgb: number): string {
  return isBright(rgb) ? rgbToCSS(darken(rgb, 0.5)) : rgbToCSS(brighten(rgb, 1.4));
}

export function fadeColorForBackground(rgb: number): string {
  return isBright(rgb) ? `rgba(0,0,0,${JAVA_FADE_ALPHA})` : `rgba(255,255,255,${JAVA_FADE_ALPHA})`;
}

export function selectedBaseColor(argb: number): number {
  const rgb = argbToRGB(argb);
  return javaAwtBrighter(javaAwtBrighter(rgb));
}

export function selectedFillColor(argb: number): string {
  return gradientStyle(selectedBaseColor(argb));
}

export function selectedHeaderColor(argb: number): string {
  const rgb = selectedBaseColor(argb);
  return rgbToCSS(javaAwtDarker(javaAwtDarker(javaAwtDarker(javaAwtDarker(rgb)))));
}

export function gradientStyle(rgb: number): string {
  const brighter = brighten(rgb, 1.2);
  return `linear-gradient(180deg, ${rgbToCSS(brighter)} 0%, ${rgbToCSS(rgb)} 6px)`;
}

export function borderLightColor(argb: number, selected: boolean): string {
  if (selected) return '#ffffff';
  const rgb = argbToRGB(argb);
  return rgbToCSS(brighten(rgb, 1.5));
}

export function borderDarkColor(argb: number, selected: boolean): string {
  if (selected) return '#ffffff';
  const rgb = argbToRGB(argb);
  return rgbToCSS(darken(rgb, 0.5));
}
