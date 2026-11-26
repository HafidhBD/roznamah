/** Mark length is the bleed minus this gap, so a mark never reaches into the trimmed page. */
const GAP_MM = 0.75;
const STROKE_MM = 0.25 * (25.4 / 72); // 0.25 pt

/**
 * Corner crop marks for a page with bleed: in each corner of the bleed area, thin black lines
 * continue the two trim lines from the sheet edge toward the trim, stopping short of it.
 */
export function CropMarks({ width, height, bleed }: { width: number; height: number; bleed: number }) {
  if (!bleed) return null;
  const len = bleed - GAP_MM;
  const xs = [bleed, width - bleed];
  const ys = [bleed, height - bleed];
  const lines: { x1: number; y1: number; x2: number; y2: number }[] = [];
  for (const x of xs) {
    for (const y of ys) {
      const hx = x === bleed ? 0 : width; // sheet edge on this side
      const vy = y === bleed ? 0 : height;
      lines.push({ x1: hx, y1: y, x2: hx + (hx ? -len : len), y2: y }); // along the horizontal trim line
      lines.push({ x1: x, y1: vy, x2: x, y2: vy + (vy ? -len : len) }); // along the vertical trim line
    }
  }
  return (
    <svg
      className="rz-crop-marks"
      data-crop-marks
      aria-hidden
      viewBox={`0 0 ${width} ${height}`}
      width={`${width}mm`}
      height={`${height}mm`}
    >
      {lines.map((l, i) => (
        <line key={i} {...l} stroke="#000" strokeWidth={STROKE_MM} strokeLinecap="butt" />
      ))}
    </svg>
  );
}
