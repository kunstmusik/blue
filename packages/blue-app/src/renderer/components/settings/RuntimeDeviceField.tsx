import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { CsoundRuntimeDevice } from '../../../shared/csound-runtime';
import { useDocumentMouseDownOutside } from '../../hooks/use-document-mousedown-outside';
import { computeFloatingPosition, getFloatingViewport } from '../floating-position-utils';
import SettingsField, { SETTINGS_MEDIUM_FIELD_CLASS } from './SettingsField';

interface RuntimeDeviceFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  devices: CsoundRuntimeDevice[];
  description?: string;
  defaultDevice?: {
    deviceId: string;
    label: string;
  };
}

function deviceOptionLabel(device: CsoundRuntimeDevice): string {
  const name = device.displayName || device.deviceId;
  const interfaceName = device.interfaceName && device.interfaceName !== name
    ? ` — ${device.interfaceName}`
    : '';
  const channelCount = device.maxChannels === null
    ? ''
    : ` - ${device.maxChannels} channel${device.maxChannels === 1 ? '' : 's'}`;
  return `${name}${interfaceName} (${device.deviceId})${channelCount}`;
}

interface DeviceOption {
  value: string;
  label: string;
}

interface RuntimeDeviceListPosition {
  left: number;
  top: number;
  width: number;
  maxHeight: number;
  placement: 'top' | 'bottom';
}

const DEVICE_LIST_GAP = 4;
const DEVICE_LIST_MARGIN = 8;
const DEVICE_LIST_MAX_HEIGHT = 256;

/** Editable exact Csound identifier with the full runtime option list available on focus. */
export default function RuntimeDeviceField({
  label,
  value,
  onChange,
  devices,
  description,
  defaultDevice,
}: RuntimeDeviceFieldProps): React.ReactElement {
  const listId = `runtime-devices-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [listPosition, setListPosition] = useState<RuntimeDeviceListPosition>({
    left: 0,
    top: 0,
    width: 300,
    maxHeight: DEVICE_LIST_MAX_HEIGHT,
    placement: 'bottom',
  });
  const discovered = defaultDevice?.deviceId === value
    || devices.some((device) => device.deviceId === value);
  const runtimeDevices = defaultDevice
    ? devices.filter((device) => device.deviceId !== defaultDevice.deviceId)
    : devices;
  const help = description
    ?? (value && !discovered
      ? 'Saved/custom value is not currently reported by the selected module; it remains editable.'
      : 'Choose a discovered device or enter the exact Csound identifier.');
  const options: DeviceOption[] = [
    ...(defaultDevice ? [{ value: defaultDevice.deviceId, label: defaultDevice.label }] : []),
    ...runtimeDevices.map((device) => ({ value: device.deviceId, label: deviceOptionLabel(device) })),
  ];
  const updateListPosition = useCallback(() => {
    const input = inputRef.current;
    if (!input) return;
    const anchor = input.getBoundingClientRect();
    const measuredHeight = listRef.current?.getBoundingClientRect().height ?? 0;
    const popupHeight = measuredHeight > 0
      ? measuredHeight
      : Math.min(DEVICE_LIST_MAX_HEIGHT, 40 + options.length * 36);
    const viewport = getFloatingViewport(input);
    const position = computeFloatingPosition(
      anchor,
      { width: Math.max(anchor.width, 240), height: popupHeight },
      viewport,
      { gap: DEVICE_LIST_GAP, margin: DEVICE_LIST_MARGIN, align: 'start' },
    );
    const availableHeight = position.placement === 'bottom'
      ? (viewport.bottom ?? viewport.height) - anchor.bottom - DEVICE_LIST_GAP - DEVICE_LIST_MARGIN
      : anchor.top - (viewport.top ?? 0) - DEVICE_LIST_GAP - DEVICE_LIST_MARGIN;
    setListPosition({
      left: position.left,
      top: position.top,
      width: Math.max(anchor.width, 240),
      maxHeight: Math.max(0, Math.min(DEVICE_LIST_MAX_HEIGHT, availableHeight)),
      placement: position.placement,
    });
  }, [options.length]);
  const openList = () => {
    setOpen(true);
  };
  const closeList = useCallback(() => setOpen(false), []);
  useDocumentMouseDownOutside({
    enabled: open,
    isInside: (target) => target instanceof Node
      && (inputRef.current?.contains(target) === true || listRef.current?.contains(target) === true),
    onMouseDownOutside: closeList,
  });
  useLayoutEffect(() => {
    if (!open) return;
    updateListPosition();
    const handleViewportChange = () => updateListPosition();
    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('scroll', handleViewportChange, true);
    return () => {
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('scroll', handleViewportChange, true);
    };
  }, [open, updateListPosition]);
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeList();
        inputRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [closeList, open]);
  return (
    <div className="relative mb-4">
      <SettingsField
        label={label}
        value={value}
        onChange={onChange}
        description={help}
        containerClassName="mb-0"
        inputClassName={SETTINGS_MEDIUM_FIELD_CLASS}
        inputRef={inputRef}
        aria-controls={listId}
        aria-expanded={open}
        aria-haspopup="listbox"
        onFocus={openList}
        onClick={openList}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'Enter') openList();
        }}
      />
      {open && createPortal(
        <div
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label={`${label} devices`}
          data-placement={listPosition.placement}
          className="fixed z-[10000] max-h-64 overflow-y-auto rounded-md border border-app-border bg-app-menu p-1 text-content text-app-text shadow-xl"
          style={{
            left: listPosition.left,
            top: listPosition.top,
            width: listPosition.width,
            maxHeight: listPosition.maxHeight,
          }}
        >
          {options.length === 0 ? (
            <div className="px-2 py-1.5 text-app-text-muted">No runtime devices reported.</div>
          ) : options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              className="block w-full rounded px-2 py-1.5 text-left hover:bg-app-accent/10"
              onClick={() => {
                onChange(option.value);
                closeList();
              }}
            >
              {option.label}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
}
