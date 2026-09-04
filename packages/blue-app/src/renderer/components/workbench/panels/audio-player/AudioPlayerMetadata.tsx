import { Fragment } from 'react';
import { formatAudioTime } from './audio-time';

interface AudioPlayerMetadataProps {
  filePath: string | null;
  duration: number;
  sampleRate: number | null;
  channels: number | null;
  fileSize: number | null;
}

function formatSize(bytes: number | null): string {
  if (bytes === null || !Number.isFinite(bytes)) return '—';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(value < 10 ? 2 : 1)} ${units[unitIndex]}`;
}

interface Row {
  label: string;
  value: string;
}

export default function AudioPlayerMetadata({
  filePath,
  duration,
  sampleRate,
  channels,
  fileSize,
}: AudioPlayerMetadataProps): React.ReactElement {
  const rows: Row[] = [
    { label: 'File', value: filePath ?? '—' },
    {
      label: 'Duration',
      value: duration > 0 ? formatAudioTime(duration) : '—',
    },
    {
      label: 'Sample Rate',
      value: sampleRate ? `${sampleRate.toLocaleString()} Hz` : '—',
    },
    {
      label: 'Channels',
      value: channels ? String(channels) : '—',
    },
    { label: 'Size', value: formatSize(fileSize) },
  ];

  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 px-3 py-2 text-role-callout">
      {rows.map((row) => (
        <Fragment key={row.label}>
          <dt className="font-medium text-blue-muted whitespace-nowrap">{row.label}</dt>
          <dd className="text-blue-fg truncate" title={row.value}>
            {row.value}
          </dd>
        </Fragment>
      ))}
    </dl>
  );
}
