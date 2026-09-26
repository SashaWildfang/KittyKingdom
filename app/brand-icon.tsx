import { BRAND_ICONS } from "../lib/brand-icons";
import type { SocialKey } from "../lib/contact";

/** A social network's official logo as an inline SVG (inherits the text color unless `brandColor` is set). */
export function BrandIcon({ network, brandColor = false, size = 18 }: { network: SocialKey; brandColor?: boolean; size?: number }) {
  const icon = BRAND_ICONS[network];
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      role="img"
      aria-hidden="true"
      fill={brandColor ? icon.color : "currentColor"}
      className="brand-icon"
    >
      <path d={icon.path} />
    </svg>
  );
}
