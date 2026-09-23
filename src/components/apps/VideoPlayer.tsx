import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Maximize, Minimize, Pause, Play, RotateCcw } from "lucide-react";
import { useT } from "@/i18n/LanguageContext";

type Props = {
  /** Rendition for wide screens and for narrow ones - picked once, at mount. */
  hdSrc: string;
  sdSrc: string;
  poster: string;
  width: number;
  height: number;
  /** Names the player for assistive tech and heads the thumbnail. */
  title: string;
  /** Small label above the title on the thumbnail. */
  eyebrow?: string;
  /** Describes the thumbnail frame, for search and for anyone not seeing it. */
  posterAlt?: string;
  /** Id of the visible text that describes the video. */
  describedBy?: string;
};

const SEEK_STEP_S = 5;
const HD_QUERY = "(min-width: 900px)";
// Shown on the thumbnail before metadata loads (preload="none" loads none).
const FALLBACK_DURATION_S = 40;

const fmt = (s: number) => {
  if (!Number.isFinite(s)) return "0:00";
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
};

// Safari on iPhone has no element fullscreen; the <video> itself can go fullscreen.
type IosVideo = HTMLVideoElement & { webkitEnterFullscreen?: () => void };

/**
 * A silent product demo with its own controls: the native bar differs per
 * browser and offers a volume slider for a track that has no audio.
 * preload="none" plus a lazy thumbnail means nothing downloads until the player
 * is near the viewport, and the video itself not until someone presses play.
 */
const VideoPlayer = ({ hdSrc, sdSrc, poster, width, height, title, eyebrow, posterAlt = "", describedBy }: Props) => {
  const { t } = useT();
  const frameRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [src] = useState(() =>
    typeof window !== "undefined" && window.matchMedia(HD_QUERY).matches ? hdSrc : sdSrc,
  );
  const [isPlaying, setIsPlaying] = useState(false);
  // Flips on the first painted frame, not on play(): the thumbnail stays up
  // while the first bytes load, so there is no black flash between the two.
  const [hasStarted, setHasStarted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasEnded, setHasEnded] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement === frameRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggle = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused || v.ended) {
      if (!hasStarted) setIsLoading(true);
      v.play().catch(() => {
        setIsPlaying(false);
        setIsLoading(false);
      });
    } else {
      v.pause();
    }
  };

  const seekTo = (t: number) => {
    const v = videoRef.current;
    if (!v || !duration) return;
    v.currentTime = Math.min(Math.max(t, 0), duration);
    setTime(v.currentTime);
  };

  const toggleFullscreen = () => {
    const frame = frameRef.current;
    const v = videoRef.current as IosVideo | null;
    if (!frame || !v) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => undefined);
    } else if (frame.requestFullscreen) {
      frame.requestFullscreen().catch(() => undefined);
    } else {
      v.webkitEnterFullscreen?.();
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    // Leave keys alone while the seek slider has focus - it handles arrows itself.
    if ((e.target as HTMLElement).tagName === "INPUT") return;
    const actions: Record<string, () => void> = {
      " ": toggle,
      k: toggle,
      ArrowRight: () => seekTo(time + SEEK_STEP_S),
      ArrowLeft: () => seekTo(time - SEEK_STEP_S),
      f: toggleFullscreen,
    };
    const run = actions[e.key];
    if (!run) return;
    e.preventDefault();
    run();
  };

  const progress = duration ? (time / duration) * 100 : 0;

  return (
    <div
      ref={frameRef}
      role="region"
      aria-label={title}
      onKeyDown={onKeyDown}
      className="group/player relative overflow-hidden rounded-2xl bg-black shadow-2xl ring-1 ring-white/10"
      style={{ aspectRatio: `${width} / ${height}` }}
    >
      <video
        ref={videoRef}
        src={src}
        width={width}
        height={height}
        preload="none"
        aria-label={title}
        aria-describedby={describedBy}
        muted
        playsInline
        onClick={toggle}
        onPlay={() => {
          setIsPlaying(true);
          setHasEnded(false);
        }}
        onPlaying={() => {
          setHasStarted(true);
          setIsLoading(false);
        }}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setHasEnded(true)}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        className="block h-full w-full cursor-pointer object-contain"
      />

      {/* Thumbnail: a lazy <img> rather than the poster attribute, which the
          browser fetches as soon as the element renders, below the fold or not. */}
      {!hasStarted && (
        <button
          type="button"
          onClick={toggle}
          aria-label={`${t("video.play")}: ${title}`}
          className="absolute inset-0 text-left text-white focus-visible:outline-none"
        >
          <img
            src={poster}
            alt={posterAlt}
            width={width}
            height={height}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-slow ease-out group-hover/player:scale-[1.03]"
          />
          <span className="absolute inset-0 bg-gradient-to-tr from-brand-navy/95 via-brand-navy/55 to-brand-navy/10" />
          <span className="absolute inset-x-5 bottom-5 max-w-lg md:inset-x-8 md:bottom-8">
            {eyebrow && (
              <span className="inline-flex rounded-full bg-secondary px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-secondary-foreground">
                {eyebrow}
              </span>
            )}
            <span className="mt-2 block font-heading text-base font-bold leading-tight sm:text-xl md:text-4xl">{title}</span>
            <span className="mt-1.5 block text-xs text-white/75 md:text-sm">{fmt(duration || FALLBACK_DURATION_S)} · {t("video.noSound")}</span>
          </span>
          <span className="absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-secondary text-secondary-foreground shadow-xl shadow-black/40 ring-4 ring-white/25 transition-transform duration-base ease-out group-hover/player:scale-110 group-focus-within/player:ring-white/70 md:h-24 md:w-24">
            {isLoading ? (
              <span className="h-7 w-7 animate-spin rounded-full border-[3px] border-current border-t-transparent md:h-9 md:w-9" aria-hidden />
            ) : (
              <Play className="h-7 w-7 translate-x-0.5 fill-current md:h-10 md:w-10" aria-hidden />
            )}
          </span>
        </button>
      )}

      {hasEnded && (
        <button
          type="button"
          onClick={toggle}
          aria-label={`${t("video.replay")}: ${title}`}
          className="absolute inset-0 flex items-center justify-center bg-black/50 focus-visible:outline-none"
        >
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary text-secondary-foreground shadow-xl ring-4 ring-white/25 md:h-20 md:w-20">
            <RotateCcw className="h-7 w-7 md:h-9 md:w-9" aria-hidden />
          </span>
        </button>
      )}

      {/* Control bar: always visible when paused, fades while playing until hovered or focused. */}
      {hasStarted && (
        <div
          className={`absolute inset-x-0 bottom-0 flex items-center gap-3 bg-gradient-to-t from-black/80 to-transparent px-3 pb-2.5 pt-8 text-white transition-opacity duration-base ease-out md:px-4 ${
            isPlaying ? "opacity-0 group-hover/player:opacity-100 group-focus-within/player:opacity-100" : "opacity-100"
          }`}
        >
          <button
            type="button"
            onClick={toggle}
            aria-label={isPlaying ? t("video.pause") : t("video.play")}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary"
          >
            {isPlaying ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current" />}
          </button>
          <span className="w-[5.5rem] shrink-0 text-xs tabular-nums text-white/85">
            {fmt(time)} / {fmt(duration)}
          </span>
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={time}
            onChange={(e) => seekTo(Number(e.target.value))}
            aria-label={t("video.seek")}
            aria-valuetext={`${fmt(time)} of ${fmt(duration)}`}
            className="h-1.5 min-w-0 flex-1 cursor-pointer appearance-none rounded-full accent-secondary"
            style={{ background: `linear-gradient(to right, hsl(var(--secondary)) ${progress}%, rgb(255 255 255 / 0.3) ${progress}%)` }}
          />
          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? t("video.exitFullscreen") : t("video.fullscreen")}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary"
          >
            {isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
          </button>
        </div>
      )}
    </div>
  );
};

export default VideoPlayer;
