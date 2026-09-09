import { motion, useScroll, useTransform } from "framer-motion";

export type WatermarkLayerSpec = {
  /** Text or glyph to render. */
  text: string;
  /** Tailwind position utilities, e.g. "-top-10 right-[-2%]". */
  position: string;
  /** Responsive font-size utilities, e.g. "text-[38vw] md:text-[24vw]". */
  size: string;
  /** "solid" = filled ghost text, "outline" = stroke-only editorial text. */
  variant?: "solid" | "outline";
  /** Base color as an hsl var reference, e.g. "var(--ms-ink)". */
  color?: string;
  /** Fill opacity for solid, or stroke opacity for outline. */
  opacity?: number;
  /** Parallax travel in px across the section scroll (negative = upward). */
  parallax?: number;
  /** Static rotation in degrees. */
  rotate?: number;
};

const Layer = ({
  layer,
  progress,
}: {
  layer: WatermarkLayerSpec;
  progress: ReturnType<typeof useScroll>["scrollYProgress"];
}) => {
  const travel = layer.parallax ?? -40;
  const y = useTransform(progress, [0, 1], [travel * -0.5, travel]);

  const color = layer.color ?? "var(--ms-ink)";
  const opacity = layer.opacity ?? 0.04;
  const isOutline = layer.variant === "outline";

  return (
    <motion.div
      aria-hidden
      style={{
        y,
        rotate: layer.rotate ?? 0,
        color: isOutline ? "transparent" : `hsl(${color} / ${opacity})`,
        WebkitTextStroke: isOutline ? `2px hsl(${color} / ${opacity})` : undefined,
      }}
      className={`absolute font-titrage font-black leading-none select-none pointer-events-none tracking-tighter whitespace-nowrap ${layer.position} ${layer.size}`}
    >
      {layer.text}
    </motion.div>
  );
};

/**
 * Decorative, non-interactive background lettering scoped to a single section.
 * Used for the secondary/accent watermarks (outline keywords, quote glyphs)
 * that live entirely inside one section — the big cross-boundary numerals are
 * handled separately by BoundaryWatermark.
 */
const SectionWatermark = ({
  layers,
  sectionRef,
}: {
  layers: WatermarkLayerSpec[];
  sectionRef: React.RefObject<HTMLElement>;
}) => {
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });

  return (
    <>
      {layers.map((layer, i) => (
        <Layer key={i} layer={layer} progress={scrollYProgress} />
      ))}
    </>
  );
};

export default SectionWatermark;
