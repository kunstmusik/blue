import { useEffect, useRef, useState } from 'react';
import { Pause, Play, Repeat } from 'lucide-react';
import { encodeAudioPath } from './audio-url';
import { subscribePendingAudioFile } from './audio-player-bus';
import { formatAudioTime } from './audio-time';
import AudioPlayerWaveform from './AudioPlayerWaveform';
import AudioPlayerMetadata from './AudioPlayerMetadata';
import { cn } from '../../../../lib/cn';
import {
  loadAudioPlayerWaveform,
  type AudioWaveformOverview,
} from '../score/bar-renderers/waveform-cache';

interface AudioMetadata {
  sampleRate: number | null;
  channels: number | null;
  fileSize: number | null;
}

export default function AudioPlayerPanel(): React.ReactElement {
  const audioRef = useRef<HTMLAudioElement>(null);
  const autoplayRef = useRef(false);
  const [selectedFile, setSelectedFile] = useState<{ path: string } | null>(null);
  const filePath = selectedFile?.path ?? null;
  const [waveform, setWaveform] = useState<AudioWaveformOverview | null>(null);
  const [waveformError, setWaveformError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLooping, setIsLooping] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<AudioMetadata>({
    sampleRate: null,
    channels: null,
    fileSize: null,
  });

  const loadFile = (path: string, autoplay: boolean) => {
    autoplayRef.current = autoplay;
    setError(null);
    setCurrentTime(0);
    setDuration(0);
    setMetadata({ sampleRate: null, channels: null, fileSize: null });
    setWaveform(null);
    setWaveformError(null);
    setSelectedFile({ path });
  };

  useEffect(() => {
    return subscribePendingAudioFile((path) => {
      loadFile(path, true);
    });
  }, []);

  useEffect(() => {
    if (!selectedFile) return;
    const filePath = selectedFile.path;
    let cancelled = false;
    const details = Promise.all([
      window.blueAPI.getAudioFileStat(filePath).catch(() => null),
      window.blueAPI.getAudioFileMetadata(filePath).catch(() => null),
    ]).then(([stat, metadata]) => {
      if (!cancelled)
        setMetadata({
          sampleRate: metadata?.sampleRate ?? null,
          channels: metadata?.channels ?? null,
          fileSize: stat?.size ?? null,
        });
      return { stat, metadata };
    });
    void (async () => {
      try {
        const overview = await loadAudioPlayerWaveform(filePath, () => cancelled);
        if (cancelled || !overview) return;
        setWaveform(overview);
        const { stat, metadata } = await details;
        if (cancelled) return;
        setMetadata({
          sampleRate: metadata?.sampleRate ?? overview.sampleRate,
          channels: metadata?.channels ?? overview.numberOfChannels,
          fileSize: stat?.size ?? null,
        });
      } catch (error: unknown) {
        if (cancelled) return;
        setWaveformError(
          error instanceof Error
            ? error.message
            : 'Could not decode this audio format for waveform display.',
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedFile]);

  const handleOpen = async () => {
    const selected = await window.blueAPI.openAudioFile();
    if (selected) {
      loadFile(selected, false);
    }
  };

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio || !filePath) return;
    if (audio.paused) {
      void audio.play().catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Could not play audio.');
      });
    } else {
      audio.pause();
    }
  };

  const toggleLoop = () => {
    const next = !isLooping;
    setIsLooping(next);
    const audio = audioRef.current;
    if (audio) audio.loop = next;
  };

  const handleSeek = (timeSeconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = timeSeconds;
    setCurrentTime(timeSeconds);
  };

  return (
    <div className="flex h-full flex-col gap-2 overflow-auto bg-app-bg p-2">
      <audio
        ref={audioRef}
        src={filePath ? encodeAudioPath(filePath) : undefined}
        loop={isLooping}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => {
          if (!isLooping) setIsPlaying(false);
        }}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onLoadedMetadata={(event) => {
          const audio = event.currentTarget;
          setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
          if (autoplayRef.current) {
            autoplayRef.current = false;
            void audio.play().catch((err: unknown) => {
              setError(err instanceof Error ? err.message : 'Could not autoplay rendered file.');
            });
          }
        }}
        onError={() => setError('Could not load audio file.')}
      />

      <div className="flex items-center">
        <button
          type="button"
          className="rounded border border-app-border bg-app-surface px-2 py-1 text-role-body text-app-text hover:bg-app-hover"
          onClick={handleOpen}
        >
          Open
        </button>
      </div>

      <AudioPlayerWaveform
        audioRef={audioRef}
        filePath={filePath}
        duration={duration}
        peaks={waveform?.channels[0] ?? null}
        status={waveformError}
        onSeek={handleSeek}
      />

      <div className="flex items-center gap-1.5" aria-label="Audio transport controls">
        <button
          type="button"
          className={cn(
            'inline-flex h-7 w-7 items-center justify-center rounded border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-focus disabled:opacity-40',
            isPlaying
              ? 'border-app-accent bg-app-accent text-app-accent-foreground'
              : 'border-app-border bg-app-surface text-app-text hover:bg-app-hover',
          )}
          onClick={togglePlay}
          disabled={!filePath}
          aria-label={isPlaying ? 'Pause' : 'Play'}
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <Pause className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Play className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
        <button
          type="button"
          className={cn(
            'inline-flex h-7 w-7 items-center justify-center rounded border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-focus disabled:opacity-40',
            isLooping
              ? 'border-app-accent bg-app-accent text-app-accent-foreground'
              : 'border-app-border bg-app-surface text-app-text hover:bg-app-hover',
          )}
          onClick={toggleLoop}
          disabled={!filePath}
          aria-pressed={isLooping}
          aria-label={isLooping ? 'Disable loop' : 'Enable loop'}
          title={isLooping ? 'Disable loop' : 'Enable loop'}
        >
          <Repeat className="h-4 w-4" aria-hidden="true" />
        </button>
        <span className="ml-auto font-mono text-role-callout tabular-nums text-app-text-muted">
          {formatAudioTime(currentTime)} / {formatAudioTime(duration)}
        </span>
      </div>

      {error && (
        <div className="rounded border border-app-danger/40 bg-app-surface-raised px-2 py-1 text-role-callout text-app-error">
          {error}
        </div>
      )}

      <AudioPlayerMetadata
        filePath={filePath}
        duration={duration}
        sampleRate={metadata.sampleRate}
        channels={metadata.channels}
        fileSize={metadata.fileSize}
      />
    </div>
  );
}
