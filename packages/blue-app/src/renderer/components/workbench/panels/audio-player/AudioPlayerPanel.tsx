import { useEffect, useRef, useState } from "react";
import { Pause, Play, Repeat } from "lucide-react";
import { encodeAudioPath } from "./audio-url";
import { subscribePendingAudioFile } from "./audio-player-bus";
import { formatAudioTime } from "./audio-time";
import AudioPlayerWaveform from "./AudioPlayerWaveform";
import AudioPlayerMetadata from "./AudioPlayerMetadata";

interface AudioMetadata {
  sampleRate: number | null;
  channels: number | null;
  fileSize: number | null;
}

type AudioContextCtor = typeof AudioContext;

function getAudioContextCtor(): AudioContextCtor | null {
  return (
    globalThis.AudioContext ??
    (
      globalThis as typeof globalThis & {
        webkitAudioContext?: typeof AudioContext;
      }
    ).webkitAudioContext ??
    null
  );
}

export default function AudioPlayerPanel(): React.ReactElement {
  const audioRef = useRef<HTMLAudioElement>(null);
  const autoplayRef = useRef(false);
  const [filePath, setFilePath] = useState<string | null>(null);
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
    setFilePath(path);
  };

  useEffect(() => {
    return subscribePendingAudioFile((path) => {
      loadFile(path, true);
    });
  }, []);

  useEffect(() => {
    if (!filePath) return;
    let cancelled = false;
    (async () => {
      const stat = await window.blueAPI.getAudioFileStat(filePath);
      const bytes = await window.blueAPI.readAuthorizedAudioFileBytes(filePath);
      if (cancelled) return;

      let sampleRate: number | null = null;
      let channels: number | null = null;

      const AudioContextCtor = getAudioContextCtor();
      if (AudioContextCtor && bytes) {
        const ctx = new AudioContextCtor();
        try {
          const decoded = await ctx.decodeAudioData(bytes.slice(0));
          sampleRate = decoded.sampleRate;
          channels = decoded.numberOfChannels;
        } catch {
          sampleRate = null;
          channels = null;
        }
        void ctx.close().catch(() => undefined);
      }

      if (!cancelled) {
        setMetadata({
          sampleRate,
          channels,
          fileSize: stat?.size ?? null,
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [filePath]);

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
        setError(err instanceof Error ? err.message : "Could not play audio.");
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
    <div className="flex h-full flex-col gap-2 overflow-auto bg-blue-bg p-2">
      <audio
        ref={audioRef}
        src={filePath ? encodeAudioPath(filePath) : undefined}
        loop={isLooping}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => {
          if (!isLooping) setIsPlaying(false);
        }}
        onTimeUpdate={(event) =>
          setCurrentTime(event.currentTarget.currentTime)
        }
        onLoadedMetadata={(event) => {
          const audio = event.currentTarget;
          setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
          if (autoplayRef.current) {
            autoplayRef.current = false;
            void audio.play().catch((err: unknown) => {
              setError(
                err instanceof Error
                  ? err.message
                  : "Could not autoplay rendered file.",
              );
            });
          }
        }}
        onError={() => setError("Could not load audio file.")}
      />

      <div className="flex items-center">
        <button
          type="button"
          className="rounded border border-blue-border bg-blue-surface px-2 py-1 text-role-body hover:bg-blue-surface-hover"
          onClick={handleOpen}
        >
          Open
        </button>
      </div>

      <AudioPlayerWaveform
        audioRef={audioRef}
        filePath={filePath}
        duration={duration}
        onSeek={handleSeek}
      />

      <div
        className="flex items-center gap-1.5"
        aria-label="Audio transport controls"
      >
        <button
          type="button"
          className={`inline-flex h-7 w-7 items-center justify-center rounded border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-accent disabled:opacity-40 ${
            isPlaying
              ? "border-blue-accent bg-blue-accent text-white"
              : "border-blue-border bg-blue-surface text-blue-fg hover:bg-blue-surface-hover"
          }`}
          onClick={togglePlay}
          disabled={!filePath}
          aria-label={isPlaying ? "Pause" : "Play"}
          title={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? (
            <Pause className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Play className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
        <button
          type="button"
          className={`inline-flex h-7 w-7 items-center justify-center rounded border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-accent disabled:opacity-40 ${
            isLooping
              ? "border-blue-accent bg-blue-accent text-white"
              : "border-blue-border bg-blue-surface text-blue-fg hover:bg-blue-surface-hover"
          }`}
          onClick={toggleLoop}
          disabled={!filePath}
          aria-pressed={isLooping}
          aria-label={isLooping ? "Disable loop" : "Enable loop"}
          title={isLooping ? "Disable loop" : "Enable loop"}
        >
          <Repeat className="h-4 w-4" aria-hidden="true" />
        </button>
        <span className="ml-auto font-mono text-role-callout tabular-nums text-blue-muted">
          {formatAudioTime(currentTime)} / {formatAudioTime(duration)}
        </span>
      </div>

      {error && (
        <div className="rounded border border-red-400 bg-red-50 px-2 py-1 text-role-callout text-red-700">
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
