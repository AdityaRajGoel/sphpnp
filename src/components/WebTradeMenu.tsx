import type { ReactNode } from "react";
import { ExternalLink } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useT } from "@/i18n/LanguageContext";
import { TRADING_PLATFORMS } from "@/lib/trading-platforms";

type Props = {
  /** The button that opens the menu - rendered as the trigger, so it keeps its own look. */
  children: ReactNode;
  align?: "start" | "center" | "end";
};

/**
 * Web Trade opens a choice of platform rather than one of them: Parasram Trade
 * and Parasram Money. Each opens in a new tab, as the single link did.
 */
export default function WebTradeMenu({ children, align = "end" }: Props) {
  const { t } = useT();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-60">
        <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">{t("cta.choosePlatform")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {TRADING_PLATFORMS.map((platform) => (
          <DropdownMenuItem key={platform.href} asChild>
            <a href={platform.href} target="_blank" rel="noopener noreferrer" className="flex cursor-pointer items-start justify-between gap-3 py-2">
              <span>
                <span className="block font-semibold">{t(platform.labelKey)}</span>
                <span className="block text-xs text-muted-foreground">{platform.host}</span>
              </span>
              <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
            </a>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
