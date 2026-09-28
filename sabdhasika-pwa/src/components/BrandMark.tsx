import { cn } from "@/lib/cn";
import { GlyphTile } from "@/components/ui/GlyphTile";

/**
 * The mark is the word for "word".
 *
 * "śabda" (शब्द) — Sanskrit and Nepali for *word*, the root the product is
 * named after. The tile shows श with its reading beneath, exactly like every
 * vocabulary tile in the app. The logo is the product.
 */
export function BrandMark({
  size = 34,
  showWordmark = true,
  className,
}: {
  size?: number;
  showWordmark?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-3", className)}>
      <GlyphTile glyph="श" reading="śa" size={size} badge="M" dense />
      {showWordmark && (
        <span className="flex flex-col leading-none">
          <span className="text-[15px] font-extrabold tracking-[-0.02em] text-ink">
            SabdhaSika
          </span>
          <span className="mt-1 text-[10px] font-medium tracking-[0.02em] text-faint">
            learn the words that matter
          </span>
        </span>
      )}
    </span>
  );
}

/** Compact lockup for tight chrome. */
export function BrandGlyph({ size = 30 }: { size?: number }) {
  return <GlyphTile glyph="श" reading="śa" size={size} dense />;
}
