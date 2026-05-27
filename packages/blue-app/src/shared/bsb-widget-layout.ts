import type { BsbWidgetNodeSnapshot } from './project-editor';
import {
  getBsbSwingHtmlMaxFontSizePx,
  isBsbSwingHtmlText,
  stripBsbSwingHtmlText,
} from './bsb-swing-html';

export const BSB_VALUE_PANEL_WIDTH = 50;
export const BSB_VALUE_PANEL_HEIGHT = 30;
export const BSB_LINE_SELECTOR_HEIGHT = 28;
export const BSB_XY_READOUT_HEIGHT = 18;
export const BSB_CANVAS_SCROLL_PADDING = 10;

function getTextFontSize(font: string): number {
  const match = font.match(/(\d+(?:\.\d+)?)px/);
  return match ? Number.parseFloat(match[1]!) : 12;
}

export function estimateTextWidth(text: string, fontSize = 12): number {
  const displayText = isBsbSwingHtmlText(text) ? stripBsbSwingHtmlText(text) : text;
  if (!displayText) return 0;
  const averageCharWidth = fontSize * 0.58;
  return Math.max(0, Math.ceil(displayText.length * averageCharWidth) + 2);
}

function estimateTextContentSize(text: string, fontSize = 12): { width: number; height: number } {
  const effectiveFontSize = getBsbSwingHtmlMaxFontSizePx(text, fontSize);
  const lines = (isBsbSwingHtmlText(text) ? stripBsbSwingHtmlText(text) : text)
    .split('\n')
    .map((line) => line.trim());

  const width = lines.reduce((maxWidth, line) => Math.max(maxWidth, estimateTextWidth(line, effectiveFontSize)), 0);
  const lineCount = Math.max(1, lines.length);
  const lineHeight = Math.max(16, Math.ceil(effectiveFontSize * 1.25));

  return {
    width,
    height: Math.max(lineHeight, lineHeight * lineCount),
  };
}

export function getHSliderBankDisplaySize(
  sliderCount: number,
  sliderWidth: number,
  gap: number,
  showValue: boolean,
): { width: number; height: number } {
  const count = Math.max(1, sliderCount);
  const width = Math.max(45, sliderWidth) + (showValue ? BSB_VALUE_PANEL_WIDTH : 0);
  const height = BSB_VALUE_PANEL_HEIGHT * count + Math.max(0, gap) * (count - 1);
  return { width, height };
}

export function getVSliderBankDisplaySize(
  sliderCount: number,
  sliderHeight: number,
  gap: number,
  showValue: boolean,
): { width: number; height: number } {
  const count = Math.max(1, sliderCount);
  const width = BSB_VALUE_PANEL_WIDTH * count + Math.max(0, gap) * (count - 1);
  const height = Math.max(45, sliderHeight) + (showValue ? BSB_VALUE_PANEL_HEIGHT : 0);
  return { width, height };
}

export function getBsbWidgetDisplaySize(node: BsbWidgetNodeSnapshot): { width: number; height: number } {
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
      const knobWidth = typeof node.width === 'number'
        ? node.width
        : typeof node.properties.knobWidth === 'number'
          ? node.properties.knobWidth
          : 60;
      const labelEnabled = node.properties.labelEnabled !== false;
      const labelText = labelEnabled && typeof node.properties.label === 'string'
        ? node.properties.label
        : '';
      const labelFontSize = typeof node.properties['labelFont.size'] === 'number'
        ? node.properties['labelFont.size']
        : 12;
      const labelWidth = labelEnabled
        ? estimateTextContentSize(labelText, labelFontSize).width
        : 0;
      return {
        width: Math.max(knobWidth, labelWidth),
        height: knobWidth,
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
      const fontSize = typeof node.properties['font.size'] === 'number' ? node.properties['font.size'] : 12;
      const titleMetrics = titleEnabled && groupName
        ? estimateTextContentSize(groupName, fontSize)
        : { width: 0, height: 0 };
      const labelHeight = titleEnabled && groupName ? Math.max(20, Math.ceil(titleMetrics.height)) : 0;
      const titleWidth = titleEnabled && groupName ? Math.ceil(titleMetrics.width) : 0;

      let childrenWidth = 10;
      let childrenHeight = 10;
      for (const child of node.children ?? []) {
        const childSize = getBsbWidgetDisplaySize(child);
        childrenWidth = Math.max(childrenWidth, child.x + childSize.width);
        childrenHeight = Math.max(childrenHeight, child.y + childSize.height);
      }
      childrenWidth += 10;
      childrenHeight += 10;

      return {
        width: Math.max(1, titleWidth, typeof node.width === 'number' ? node.width : 20, childrenWidth),
        height: labelHeight + Math.max(1, typeof node.height === 'number' ? node.height : 20, childrenHeight),
      };
    }
    case 'BSBLabel': {
      const labelText = typeof node.properties.label === 'string' ? node.properties.label : '';
      const fontSize = typeof node.properties['font.size'] === 'number' ? node.properties['font.size'] : 12;
      const labelMetrics = estimateTextContentSize(labelText, fontSize);
      return {
        width: Math.max(1, Math.ceil(labelMetrics.width) + 1),
        height: Math.max(16, Math.ceil(labelMetrics.height)) + 1,
      };
    }
    case 'BSBCheckBox': {
      const labelText = typeof node.properties.label === 'string' ? node.properties.label : '';
      const fontSize = 12;
      const labelMetrics = estimateTextContentSize(labelText, fontSize);
      return {
        width: Math.max(1, Math.ceil(labelMetrics.width) + 20),
        height: Math.max(20, Math.ceil(labelMetrics.height)),
      };
    }
    case 'BSBDropdown':
    case 'BSBSubChannelDropdown': {
      const fontSize = typeof node.properties.fontSize === 'number' ? node.properties.fontSize : 12;
      return {
        width: getDropdownDisplayWidthFromSnapshot(node, fontSize),
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

function getDropdownDisplayWidthFromSnapshot(node: BsbWidgetNodeSnapshot, fontSize: number): number {
  const font = `${fontSize}px Roboto, sans-serif`;
  let maxW = 0;

  if (node.type === 'BSBSubChannelDropdown') {
    const channelOutput = typeof node.properties.channelOutput === 'string' ? node.properties.channelOutput : '';
    const text = channelOutput || node.objectName || 'Sub Channel';
    maxW = estimateTextWidth(text, getTextFontSize(font));
  } else {
    const itemsRaw = node.properties.dropdownItems;
    const items: Array<{ name?: string; value?: string }> = Array.isArray(itemsRaw) ? itemsRaw as any : [];
    for (const item of items) {
      const text = item.name || item.value || '';
      maxW = Math.max(maxW, estimateTextWidth(text, getTextFontSize(font)));
    }
    if (maxW === 0) {
      const objectName = node.objectName || 'Dropdown';
      maxW = estimateTextWidth(objectName, getTextFontSize(font));
    }
  }

  return Math.max(40, Math.ceil(maxW) + 34);
}
