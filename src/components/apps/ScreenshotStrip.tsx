import { SCREEN_SIZE, type Screen } from "./appMedia";
import { useT } from "@/i18n/LanguageContext";

type Props = { screens: Screen[]; label: string };

/** A swipeable row of captioned phone screenshots; scroll-snaps on touch. */
const ScreenshotStrip = ({ screens, label }: Props) => {
  const { t } = useT();
  return (
    <ul className="flex gap-5 overflow-x-auto snap-x snap-mandatory pb-4 -mx-4 px-4 lg:mx-0 lg:px-0 [scrollbar-width:thin]" aria-label={label}>
      {screens.map((shot) => (
        <li key={shot.src} className="snap-start shrink-0">
          <figure className="w-36 sm:w-40 lg:w-44">
            <img
              src={shot.src}
              alt={shot.alt}
              width={SCREEN_SIZE.width}
              height={SCREEN_SIZE.height}
              loading="lazy"
              decoding="async"
              className="h-auto w-full rounded-[1.4rem] ring-1 ring-black/10 shadow-lg dark:ring-white/10"
            />
            {shot.captionKey && (
              <figcaption className="mt-2.5 text-center text-sm font-medium text-muted-foreground">{t(shot.captionKey)}</figcaption>
            )}
          </figure>
        </li>
      ))}
    </ul>
  );
};

export default ScreenshotStrip;
