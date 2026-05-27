import type { BsbWidgetNodeSnapshot } from '../../../../../../../shared/project-editor';
import {
  BSB_CANVAS_SCROLL_PADDING,
  BSB_LINE_SELECTOR_HEIGHT,
  BSB_VALUE_PANEL_HEIGHT,
  BSB_VALUE_PANEL_WIDTH,
  BSB_XY_READOUT_HEIGHT,
  estimateTextWidth,
  getHSliderBankDisplaySize,
  getVSliderBankDisplaySize,
} from '../../../../../../../shared/bsb-widget-layout';
import {
  getBsbSwingHtmlMaxFontSizePx,
  isBsbSwingHtmlText,
  resolveBsbSwingHtmlFontSizePx,
  stripBsbSwingHtmlText,
} from '../../../../../../../shared/bsb-swing-html';

let sharedCanvas: HTMLCanvasElement | null = null;
let sharedHtmlMeasureEl: HTMLDivElement | null = null;

const htmlMarkupCache = new Map<string, string>();
const htmlMeasurementCache = new Map<string, { width: number; height: number }>();

export const BSB_CANVAS_MIN_WIDTH = 600;
export const BSB_CANVAS_MIN_HEIGHT = 400;

export function measureTextWidth(text: string, font: string): number {
  const displayText = isBsbSwingHtmlText(text) ? stripBsbSwingHtmlText(text) : text;
  const fontSize = getTextFontSize(font);

  if (!displayText) return 0;
  if (typeof document === 'undefined') return estimateTextWidth(displayText, fontSize);
  if (!sharedCanvas) {
    sharedCanvas = document.createElement('canvas');
  }
  const ctx = sharedCanvas.getContext('2d');
  if (!ctx) return estimateTextWidth(displayText, fontSize);
  ctx.font = font;
  return ctx.measureText(displayText).width;
}

export function measureTextContent(text: string, font: string): { width: number; height: number } {
  const fontSize = getTextFontSize(font);
  const displayText = isBsbSwingHtmlText(text) ? stripBsbSwingHtmlText(text) : text;
  const baseHeight = Math.max(16, Math.ceil(fontSize * 1.25));

  if (!displayText) {
    return { width: 0, height: baseHeight };
  }

  if (!isBsbSwingHtmlText(text)) {
    return { width: measureTextWidth(displayText, font), height: baseHeight };
  }

  const cacheKey = `${font}\u0000${text}`;
  const cached = htmlMeasurementCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const fallback = estimateSwingHtmlTextContent(text, fontSize);
  if (typeof document === 'undefined' || !document.body) {
    cacheMeasurement(cacheKey, fallback);
    return fallback;
  }

  const markup = getSanitizedBsbSwingHtml(text);
  if (!markup) {
    cacheMeasurement(cacheKey, fallback);
    return fallback;
  }

  const measureEl = ensureSharedHtmlMeasureEl();
  measureEl.style.font = font;
  measureEl.innerHTML = markup;
  const rect = measureEl.getBoundingClientRect();

  const measured = {
    width: Math.ceil(rect.width),
    height: Math.ceil(rect.height),
  };

  const metrics = measured.width > 0 && measured.height > 0
    ? measured
    : fallback;

  cacheMeasurement(cacheKey, metrics);
  return metrics;
}

export function getSanitizedBsbSwingHtml(text: string): string | null {
  if (!isBsbSwingHtmlText(text)) {
    return null;
  }

  const cached = htmlMarkupCache.get(text);
  if (cached !== undefined) {
    return cached;
  }

  let markup = `${escapeHtml(stripBsbSwingHtmlText(text)).replace(/\n/g, '<br>')}`;

  if (typeof DOMParser !== 'undefined') {
    const parser = new DOMParser();
    const documentFragment = parser.parseFromString(text, 'text/html');
    markup = sanitizeHtmlNodes(Array.from(documentFragment.body.childNodes));
    if (!markup) {
      markup = `${escapeHtml(stripBsbSwingHtmlText(text)).replace(/\n/g, '<br>')}`;
    }
  }

  cacheMarkup(text, markup);
  return markup;
}

export function getDropdownDisplayWidth(node: BsbWidgetNodeSnapshot): number {
  const fontSize = typeof node.properties.fontSize === 'number' ? node.properties.fontSize : 12;
  const font = `${fontSize}px Roboto, sans-serif`;
  let maxW = 0;

  if (node.type === 'BSBSubChannelDropdown') {
    const channelOutput = typeof node.properties.channelOutput === 'string' ? node.properties.channelOutput : '';
    const text = channelOutput || node.objectName || 'Sub Channel';
    maxW = measureTextWidth(text, font);
  } else {
    const itemsRaw = node.properties.dropdownItems;
    const items: Array<{ name?: string; value?: string }> = Array.isArray(itemsRaw) ? itemsRaw as any : [];
    for (const item of items) {
      const text = item.name || item.value || '';
      maxW = Math.max(maxW, measureTextWidth(text, font));
    }
    if (maxW === 0) {
      const objectName = node.objectName || 'Dropdown';
      maxW = measureTextWidth(objectName, font);
    }
  }

  return Math.max(40, Math.ceil(maxW) + 34);
}

function getTextFontSize(font: string): number {
  const match = font.match(/(\d+(?:\.\d+)?)px/);
  return match ? Number.parseFloat(match[1]!) : 12;
}

export function getFontString(name: string, size: number, style = 0): string {
  const parts: string[] = [];
  if ((style & 1) !== 0) parts.push('bold');
  if ((style & 2) !== 0) parts.push('italic');
  parts.push(`${size}px`);
  const family = name.includes(' ') || name.includes(',') ? `"${name}"` : name;
  parts.push(`${family}, sans-serif`);
  return parts.join(' ');
}

export function getWidgetDisplaySize(node: BsbWidgetNodeSnapshot): { width: number; height: number } {
  switch (node.type) {
    case 'BSBHSlider': {
      const sliderWidth = typeof node.properties.sliderWidth === 'number'
        ? node.properties.sliderWidth
        : typeof node.width === 'number'
          ? node.width
          : 150;
      return {
        width: Math.max(45, sliderWidth) + (node.properties.valueDisplayEnabled === true ? BSB_VALUE_PANEL_WIDTH : 0),
        height: BSB_VALUE_PANEL_HEIGHT,
      };
    }
    case 'BSBVSlider': {
      const sliderHeight = typeof node.properties.sliderHeight === 'number'
        ? node.properties.sliderHeight
        : typeof node.height === 'number'
          ? node.height
          : 150;
      return {
        width: BSB_VALUE_PANEL_WIDTH,
        height: Math.max(45, sliderHeight) + (node.properties.valueDisplayEnabled === true ? BSB_VALUE_PANEL_HEIGHT : 0),
      };
    }
    case 'BSBHSliderBank': {
      const sliderCount = Array.isArray(node.properties.sliders)
        ? Math.max(1, node.properties.sliders.length)
        : typeof node.properties.numberOfSliders === 'number'
          ? Math.max(1, node.properties.numberOfSliders)
          : 1;
      const sliderWidth = typeof node.properties.sliderWidth === 'number'
        ? node.properties.sliderWidth
        : typeof node.width === 'number'
          ? node.width
          : 150;
      return getHSliderBankDisplaySize(
        sliderCount,
        sliderWidth,
        typeof node.properties.gap === 'number' ? node.properties.gap : 5,
        node.properties.valueDisplayEnabled === true,
      );
    }
    case 'BSBVSliderBank': {
      const sliderCount = Array.isArray(node.properties.sliders)
        ? Math.max(1, node.properties.sliders.length)
        : typeof node.properties.numberOfSliders === 'number'
          ? Math.max(1, node.properties.numberOfSliders)
          : 1;
      const sliderHeight = typeof node.properties.sliderHeight === 'number'
        ? node.properties.sliderHeight
        : typeof node.height === 'number'
          ? node.height
          : 150;
      return getVSliderBankDisplaySize(
        sliderCount,
        sliderHeight,
        typeof node.properties.gap === 'number' ? node.properties.gap : 5,
        node.properties.valueDisplayEnabled === true,
      );
    }
    case 'BSBKnob': {
      const knobWidth = typeof node.properties.knobWidth === 'number'
        ? node.properties.knobWidth
        : typeof node.width === 'number'
          ? node.width
          : 60;
      const labelEnabled = node.properties.labelEnabled !== false;
      const labelText = labelEnabled && typeof node.properties.label === 'string'
        ? node.properties.label
        : '';
      const labelFontName = typeof node.properties['labelFont.name'] === 'string' ? node.properties['labelFont.name'] : 'Roboto';
      const labelFontSize = typeof node.properties['labelFont.size'] === 'number' ? node.properties['labelFont.size'] : 12;
      const labelFontStyle = typeof node.properties['labelFont.style'] === 'number' ? node.properties['labelFont.style'] : 0;
      const labelMetrics = labelEnabled
        ? measureTextContent(labelText, getFontString(labelFontName, labelFontSize, labelFontStyle))
        : { width: 0, height: 0 };
      const labelHeight = labelEnabled
        ? Math.max(16, Math.ceil(labelMetrics.height))
        : 0;
      const valueHeight = node.properties.valueDisplayEnabled === true ? 14 : 0;
      return {
        width: Math.max(knobWidth, Math.ceil(labelMetrics.width)),
        height: knobWidth + labelHeight + valueHeight,
      };
    }
    case 'BSBXYController': {
      const baseWidth = typeof node.properties.width === 'number'
        ? node.properties.width
        : typeof node.width === 'number'
          ? node.width
          : 100;
      const baseHeight = typeof node.properties.height === 'number'
        ? node.properties.height
        : typeof node.height === 'number'
          ? node.height
          : 80;
      return {
        width: baseWidth,
        height: baseHeight + (node.properties.valueDisplayEnabled === true ? BSB_XY_READOUT_HEIGHT : 0),
      };
    }
    case 'BSBGroup': {
      const titleEnabled = node.properties.titleEnabled !== false;
      const groupName = typeof node.properties.groupName === 'string' ? node.properties.groupName : '';
      const fontName = typeof node.properties['font.name'] === 'string' ? node.properties['font.name'] : 'Roboto';
      const fontSize = typeof node.properties['font.size'] === 'number' ? node.properties['font.size'] : 12;
      const fontStyle = typeof node.properties['font.style'] === 'number' ? node.properties['font.style'] : 0;
      const titleMetrics = titleEnabled && groupName
        ? measureTextContent(groupName, getFontString(fontName, fontSize, fontStyle))
        : { width: 0, height: 0 };
      const labelHeight = titleEnabled && groupName ? Math.max(20, Math.ceil(titleMetrics.height)) : 0;
      const titleWidth = titleEnabled && groupName ? Math.ceil(titleMetrics.width) + 2 : 0;

      let childrenWidth = 10;
      let childrenHeight = 10;
      for (const child of node.children ?? []) {
        const childSize = getWidgetDisplaySize(child);
        childrenWidth = Math.max(childrenWidth, child.x + childSize.width);
        childrenHeight = Math.max(childrenHeight, child.y + childSize.height);
      }
      childrenWidth += 10;
      childrenHeight += 10;

      return {
        width: Math.max(1, titleWidth, node.width ?? 20, childrenWidth),
        height: labelHeight + Math.max(1, node.height ?? 20, childrenHeight),
      };
    }
    case 'BSBLabel': {
      const labelText = typeof node.properties.label === 'string' ? node.properties.label : '';
      const fontName = typeof node.properties['font.name'] === 'string' ? node.properties['font.name'] : 'Roboto';
      const fontSize = typeof node.properties['font.size'] === 'number' ? node.properties['font.size'] : 12;
      const fontStyle = typeof node.properties['font.style'] === 'number' ? node.properties['font.style'] : 0;
      const labelMetrics = measureTextContent(labelText, getFontString(fontName, fontSize, fontStyle));
      return {
        width: Math.max(1, Math.ceil(labelMetrics.width) + 1),
        height: Math.max(16, Math.ceil(labelMetrics.height)) + 1,
      };
    }
    case 'BSBCheckBox': {
      const labelText = typeof node.properties.label === 'string' ? node.properties.label : '';
      const fontSize = 12;
      const labelMetrics = measureTextContent(labelText, `${fontSize}px Roboto, sans-serif`);
      return {
        width: Math.max(1, Math.ceil(labelMetrics.width) + 20),
        height: Math.max(20, Math.ceil(labelMetrics.height)),
      };
    }
    case 'BSBDropdown':
    case 'BSBSubChannelDropdown': {
      const fontSize = typeof node.properties.fontSize === 'number' ? node.properties.fontSize : 12;
      return {
        width: getDropdownDisplayWidth(node),
        height: Math.max(24, fontSize + 8),
      };
    }
    case 'BSBTextField': {
      const textFieldWidth = typeof node.properties.textFieldWidth === 'number'
        ? node.properties.textFieldWidth
        : typeof node.width === 'number'
          ? node.width
          : 100;
      return {
        width: textFieldWidth,
        height: 30,
      };
    }
    case 'BSBFileSelector': {
      const textFieldWidth = typeof node.properties.textFieldWidth === 'number'
        ? node.properties.textFieldWidth
        : typeof node.width === 'number'
          ? node.width - 30
          : 100;
      return {
        width: textFieldWidth + 30,
        height: 30,
      };
    }
    case 'BSBLineObject': {
      const canvasWidth = typeof node.properties.canvasWidth === 'number'
        ? node.properties.canvasWidth
        : typeof node.width === 'number'
          ? node.width
          : 200;
      const canvasHeight = typeof node.properties.canvasHeight === 'number'
        ? node.properties.canvasHeight
        : typeof node.height === 'number'
          ? node.height - BSB_LINE_SELECTOR_HEIGHT
          : 160;
      return {
        width: canvasWidth,
        height: canvasHeight + BSB_LINE_SELECTOR_HEIGHT,
      };
    }
    default:
      return {
        width: typeof node.width === 'number' ? node.width : 60,
        height: typeof node.height === 'number' ? node.height : 24,
      };
  }
}

function getWidgetCanvasBoundsSize(node: BsbWidgetNodeSnapshot): { width: number; height: number } {
  const displaySize = getWidgetDisplaySize(node);
  if (node.type !== 'BSBGroup') return displaySize;

  let width = displaySize.width;
  let height = displaySize.height;
  for (const child of node.children ?? []) {
    const childSize = getWidgetCanvasBoundsSize(child);
    width = Math.max(width, child.x + childSize.width + BSB_CANVAS_SCROLL_PADDING);
    height = Math.max(height, child.y + childSize.height + BSB_CANVAS_SCROLL_PADDING);
  }
  return { width, height };
}

export function getCanvasDisplaySize(
  children: BsbWidgetNodeSnapshot[],
  viewportWidth = 0,
  viewportHeight = 0,
  minOverride?: number,
): { width: number; height: number } {
  let maxWidth = 1;
  let maxHeight = 1;

  for (const child of children) {
    const childSize = getWidgetCanvasBoundsSize(child);
    maxWidth = Math.max(maxWidth, child.x + childSize.width);
    maxHeight = Math.max(maxHeight, child.y + childSize.height);
  }

  const contentWidth = maxWidth + BSB_CANVAS_SCROLL_PADDING;
  const contentHeight = maxHeight + BSB_CANVAS_SCROLL_PADDING;
  const minW = minOverride ?? BSB_CANVAS_MIN_WIDTH;
  const minH = minOverride ?? BSB_CANVAS_MIN_HEIGHT;

  return {
    width: Math.max(minW, Math.ceil(viewportWidth), contentWidth),
    height: Math.max(minH, Math.ceil(viewportHeight), contentHeight),
  };
}

function ensureSharedHtmlMeasureEl(): HTMLDivElement {
  if (!sharedHtmlMeasureEl) {
    sharedHtmlMeasureEl = document.createElement('div');
    sharedHtmlMeasureEl.setAttribute('aria-hidden', 'true');
    sharedHtmlMeasureEl.style.position = 'fixed';
    sharedHtmlMeasureEl.style.left = '-10000px';
    sharedHtmlMeasureEl.style.top = '-10000px';
    sharedHtmlMeasureEl.style.visibility = 'hidden';
    sharedHtmlMeasureEl.style.pointerEvents = 'none';
    sharedHtmlMeasureEl.style.display = 'inline-block';
    sharedHtmlMeasureEl.style.whiteSpace = 'pre-wrap';
    sharedHtmlMeasureEl.style.boxSizing = 'border-box';
    sharedHtmlMeasureEl.style.padding = '0';
    sharedHtmlMeasureEl.style.margin = '0';
    sharedHtmlMeasureEl.style.lineHeight = 'normal';
    document.body.appendChild(sharedHtmlMeasureEl);
  }

  return sharedHtmlMeasureEl;
}

function estimateSwingHtmlTextContent(text: string, fontSize: number): { width: number; height: number } {
  const plainText = stripBsbSwingHtmlText(text);
  const lines = plainText ? plainText.split('\n') : [''];
  const effectiveFontSize = getBsbSwingHtmlMaxFontSizePx(text, fontSize);
  const width = lines.reduce((maxWidth, line) => Math.max(maxWidth, estimateTextWidth(line, effectiveFontSize)), 0);
  const lineHeight = Math.max(16, Math.ceil(effectiveFontSize * 1.25));
  return {
    width,
    height: Math.max(lineHeight, lineHeight * Math.max(1, lines.length)),
  };
}

function sanitizeHtmlNodes(nodes: Node[]): string {
  return nodes.map((node) => sanitizeHtmlNode(node)).join('');
}

function sanitizeHtmlNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return escapeHtml(node.textContent ?? '');
  }
  if (node.nodeType !== Node.ELEMENT_NODE) {
    return '';
  }

  const element = node as Element;
  const tag = element.tagName.toLowerCase();
  const children = sanitizeHtmlNodes(Array.from(element.childNodes));

  switch (tag) {
    case 'html':
    case 'body':
      return children;
    case 'br':
      return '<br>';
    case 'b':
    case 'strong':
      return children ? `<strong>${children}</strong>` : '';
    case 'i':
    case 'em':
      return children ? `<em>${children}</em>` : '';
    case 'u':
      return children ? `<u>${children}</u>` : '';
    case 's':
    case 'strike':
      return children ? `<s>${children}</s>` : '';
    case 'sup':
      return children ? `<sup>${children}</sup>` : '';
    case 'sub':
      return children ? `<sub>${children}</sub>` : '';
    case 'center':
      return children ? `<span style="display:block;text-align:center">${children}</span>` : '';
    case 'div':
    case 'p':
      return children ? `<span style="display:block">${children}</span>` : '<br>';
    case 'font': {
      const style = getSanitizedFontStyle(element);
      return style ? `<span style="${style}">${children}</span>` : children;
    }
    default:
      return children;
  }
}

function getSanitizedFontStyle(element: Element): string {
  const styles: string[] = [];
  const size = element.getAttribute('size');
  if (size) {
    const fontSizePx = resolveBsbSwingHtmlFontSizePx(size);
    if (fontSizePx !== null) {
      styles.push(`font-size:${fontSizePx}px`);
    }
  }

  const color = sanitizeColorValue(element.getAttribute('color'));
  if (color) {
    styles.push(`color:${color}`);
  }

  const fontFace = sanitizeFontFaceValue(element.getAttribute('face'));
  if (fontFace) {
    styles.push(`font-family:${fontFace}`);
  }

  return styles.join(';');
}

function sanitizeColorValue(rawValue: string | null): string | null {
  if (!rawValue) return null;
  const value = rawValue.trim();
  if (/^#[0-9a-f]{3,8}$/i.test(value)) return value;
  if (/^[a-z]+$/i.test(value)) return value;
  if (/^rgba?\([-\d\s.,%]+\)$/i.test(value)) return value;
  return null;
}

function sanitizeFontFaceValue(rawValue: string | null): string | null {
  if (!rawValue) return null;
  const fonts = rawValue
    .split(',')
    .map((part) => part.trim().replace(/["'<>]/g, ''))
    .filter((part) => /^[\w -]+$/.test(part));

  if (fonts.length === 0) {
    return null;
  }

  return fonts
    .map((font) => (font.includes(' ') ? `'${font}'` : font))
    .join(',');
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeHtmlAttribute(text: string): string {
  return escapeHtml(text).replace(/`/g, '&#96;');
}

function cacheMarkup(key: string, value: string): void {
  if (htmlMarkupCache.size > 500) {
    htmlMarkupCache.clear();
  }
  htmlMarkupCache.set(key, value);
}

function cacheMeasurement(key: string, value: { width: number; height: number }): void {
  if (htmlMeasurementCache.size > 500) {
    htmlMeasurementCache.clear();
  }
  htmlMeasurementCache.set(key, value);
}
