import React, { useCallback, useMemo, useRef, useState } from 'react';
import type { CsoundRuntimeDevice } from '../../../shared/csound-runtime';
import { HostSurfacePortal } from '../host-surface/HostSurfacePortal';
import { useHostSurface } from '../host-surface/use-host-surface';
import type { HostSurfaceAnchor } from '../host-surface/host-surface-options';
import { useHostDocument } from '../../hooks/use-host-document';
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
  const [open, setOpen] = useState(false);

  const discovered = defaultDevice?.deviceId === value
    || devices.some((device) => device.deviceId === value);
  const runtimeDevices = defaultDevice
    ? devices.filter((device) => device.deviceId !== defaultDevice.deviceId)
    : devices;
  const help = description
    ?? (value && !discovered
      ? 'Saved/custom value is not currently reported by the selected module; it remains editable.'
      : 'Choose a discovered device or enter the exact Csound identifier.');
  const options: DeviceOption[] = useMemo(() => [
    ...(defaultDevice ? [{ value: defaultDevice.deviceId, label: defaultDevice.label }] : []),
    ...runtimeDevices.map((device) => ({ value: device.deviceId, label: deviceOptionLabel(device) })),
  ], [defaultDevice, runtimeDevices]);

  const anchor = useMemo<HostSurfaceAnchor | null>(
    () => (open && inputRef.current ? { type: 'element', element: inputRef.current } : null),
    [open],
  );

  const hostDoc = useHostDocument({ fallbackToGlobal: true });
  const targetDocument = inputRef.current?.ownerDocument ?? hostDoc;

  const surface = useHostSurface(anchor, {
    kind: 'popover',
    placement: 'bottom',
    align: 'start',
    gap: DEVICE_LIST_GAP,
    margin: DEVICE_LIST_MARGIN,
    closeOnHostScroll: false,
    hostDocument: targetDocument,
    onDismiss: () => setOpen(false),
  });

  const openList = () => {
    setOpen(true);
  };
  const closeList = useCallback(() => {
    setOpen(false);
  }, []);

  const inputWidth = inputRef.current?.getBoundingClientRect().width;
  const listWidth = Math.max(inputWidth ?? 0, 240);

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
          if (event.key === 'Escape') closeList();
        }}
      />
      <HostSurfacePortal
        session={surface}
        role="listbox"
        ariaLabel={`${label} devices`}
        className="z-[10000] overflow-y-auto rounded-md border border-app-border bg-app-menu p-1 text-role-body text-app-text shadow-xl"
        style={{
          width: listWidth,
          maxHeight: surface.placement?.maxHeight != null
            ? Math.min(DEVICE_LIST_MAX_HEIGHT, surface.placement.maxHeight)
            : DEVICE_LIST_MAX_HEIGHT,
        }}
      >
        <div id={listId}>
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
        </div>
      </HostSurfacePortal>
    </div>
  );
}
