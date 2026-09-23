import { SCREEN_SIZE, type Screen } from "./appMedia";

type Props = { screens: Screen[]; label: string };

/** A swipeable row of phone screenshots; scroll-snaps on touch, wraps into view on wide screens. */
const ScreenshotStrip = ({ screens, label }: Props) => (
  <ul
    className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-4 -mx-4 px-4 lg:mx-0 lg:px-0 [scrollbar-width:thin]"
    aria-label={label}
  >
    {screens.map((shot) => (
      <li key={shot.src} className="snap-start shrink-0">
        <img
          src={shot.src}
          alt={shot.alt}
          width={SCREEN_SIZE.width}
          height={SCREEN_SIZE.height}
          loading="lazy"
          decoding="async"
          className="w-36 sm:w-40 lg:w-44 h-auto rounded-[1.4rem] ring-1 ring-black/10 dark:ring-white/10 shadow-lg"
        />
      </li>
    ))}
  </ul>
);

export default ScreenshotStrip;
