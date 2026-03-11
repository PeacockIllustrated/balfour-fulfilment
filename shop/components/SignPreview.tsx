"use client";

const SIGN_TYPES: Record<
  string,
  { label: string; bg: string; fg: string; border: string }
> = {
  warning: {
    label: "Warning",
    bg: "#FFD700",
    fg: "#000000",
    border: "#000000",
  },
  prohibition: {
    label: "Prohibition",
    bg: "#FFFFFF",
    fg: "#000000",
    border: "#CC0000",
  },
  mandatory: {
    label: "Mandatory",
    bg: "#005BBB",
    fg: "#FFFFFF",
    border: "#003D7A",
  },
  information: {
    label: "Information",
    bg: "#009639",
    fg: "#FFFFFF",
    border: "#006B28",
  },
  "fire-safety": {
    label: "Fire Safety",
    bg: "#CC0000",
    fg: "#FFFFFF",
    border: "#990000",
  },
  directional: {
    label: "Directional",
    bg: "#009639",
    fg: "#FFFFFF",
    border: "#006B28",
  },
  security: {
    label: "Security",
    bg: "#005BBB",
    fg: "#FFFFFF",
    border: "#003D7A",
  },
  environmental: {
    label: "Environmental",
    bg: "#009639",
    fg: "#FFFFFF",
    border: "#006B28",
  },
};

const SIZE_DIMENSIONS: Record<string, { w: number; h: number; label: string }> =
  {
    E: { w: 200, h: 300, label: "200 \u00d7 300mm" },
    F: { w: 300, h: 400, label: "300 \u00d7 400mm" },
    M: { w: 400, h: 600, label: "400 \u00d7 600mm" },
    Y: { w: 600, h: 800, label: "600 \u00d7 800mm" },
    W: { w: 800, h: 1220, label: "800 \u00d7 1220mm" },
    H: { w: 1220, h: 1600, label: "1220 \u00d7 1600mm" },
  };

/* ── SVG icon paths for each sign type (rendered inline, no emojis) ── */
function TypeIcon({
  signType,
  x,
  y,
  size,
  color,
}: {
  signType: string;
  x: number;
  y: number;
  size: number;
  color: string;
}) {
  const s = size;
  const cx = x;
  const cy = y;
  const half = s / 2;

  switch (signType) {
    case "warning":
      // Exclamation triangle
      return (
        <g transform={`translate(${cx - half},${cy - half})`}>
          <polygon
            points={`${s / 2},${s * 0.08} ${s * 0.92},${s * 0.88} ${s * 0.08},${s * 0.88}`}
            fill="none"
            stroke={color}
            strokeWidth={s * 0.08}
            strokeLinejoin="round"
          />
          <line x1={s / 2} y1={s * 0.38} x2={s / 2} y2={s * 0.6} stroke={color} strokeWidth={s * 0.1} strokeLinecap="round" />
          <circle cx={s / 2} cy={s * 0.74} r={s * 0.055} fill={color} />
        </g>
      );
    case "prohibition":
      // Circle with diagonal line
      return (
        <g transform={`translate(${cx - half},${cy - half})`}>
          <circle cx={s / 2} cy={s / 2} r={s * 0.4} fill="none" stroke={color} strokeWidth={s * 0.08} />
          <line x1={s * 0.22} y1={s * 0.78} x2={s * 0.78} y2={s * 0.22} stroke={color} strokeWidth={s * 0.08} strokeLinecap="round" />
        </g>
      );
    case "mandatory":
      // Exclamation in circle
      return (
        <g transform={`translate(${cx - half},${cy - half})`}>
          <circle cx={s / 2} cy={s / 2} r={s * 0.4} fill="none" stroke={color} strokeWidth={s * 0.07} />
          <line x1={s / 2} y1={s * 0.28} x2={s / 2} y2={s * 0.55} stroke={color} strokeWidth={s * 0.09} strokeLinecap="round" />
          <circle cx={s / 2} cy={s * 0.68} r={s * 0.05} fill={color} />
        </g>
      );
    case "information":
      // "i" in circle
      return (
        <g transform={`translate(${cx - half},${cy - half})`}>
          <circle cx={s / 2} cy={s / 2} r={s * 0.4} fill="none" stroke={color} strokeWidth={s * 0.07} />
          <circle cx={s / 2} cy={s * 0.32} r={s * 0.05} fill={color} />
          <line x1={s / 2} y1={s * 0.44} x2={s / 2} y2={s * 0.72} stroke={color} strokeWidth={s * 0.09} strokeLinecap="round" />
        </g>
      );
    case "fire-safety":
      // Flame shape
      return (
        <g transform={`translate(${cx - half},${cy - half})`}>
          <path
            d={`M${s / 2},${s * 0.1} C${s * 0.65},${s * 0.3} ${s * 0.82},${s * 0.55} ${s * 0.75},${s * 0.78} C${s * 0.68},${s * 0.9} ${s * 0.55},${s * 0.95} ${s / 2},${s * 0.95} C${s * 0.45},${s * 0.95} ${s * 0.32},${s * 0.9} ${s * 0.25},${s * 0.78} C${s * 0.18},${s * 0.55} ${s * 0.35},${s * 0.3} ${s / 2},${s * 0.1}Z`}
            fill="none"
            stroke={color}
            strokeWidth={s * 0.06}
            strokeLinejoin="round"
          />
        </g>
      );
    case "directional":
      // Arrow pointing right
      return (
        <g transform={`translate(${cx - half},${cy - half})`}>
          <line x1={s * 0.15} y1={s / 2} x2={s * 0.75} y2={s / 2} stroke={color} strokeWidth={s * 0.09} strokeLinecap="round" />
          <polyline points={`${s * 0.55},${s * 0.25} ${s * 0.82},${s / 2} ${s * 0.55},${s * 0.75}`} fill="none" stroke={color} strokeWidth={s * 0.09} strokeLinecap="round" strokeLinejoin="round" />
        </g>
      );
    case "security":
      // Shield outline
      return (
        <g transform={`translate(${cx - half},${cy - half})`}>
          <path
            d={`M${s / 2},${s * 0.1} L${s * 0.82},${s * 0.28} L${s * 0.82},${s * 0.55} C${s * 0.82},${s * 0.75} ${s * 0.65},${s * 0.88} ${s / 2},${s * 0.95} C${s * 0.35},${s * 0.88} ${s * 0.18},${s * 0.75} ${s * 0.18},${s * 0.55} L${s * 0.18},${s * 0.28}Z`}
            fill="none"
            stroke={color}
            strokeWidth={s * 0.06}
            strokeLinejoin="round"
          />
        </g>
      );
    case "environmental":
      // Leaf shape
      return (
        <g transform={`translate(${cx - half},${cy - half})`}>
          <path
            d={`M${s * 0.2},${s * 0.8} C${s * 0.2},${s * 0.35} ${s * 0.45},${s * 0.1} ${s * 0.8},${s * 0.15} C${s * 0.75},${s * 0.5} ${s * 0.6},${s * 0.75} ${s * 0.2},${s * 0.8}Z`}
            fill="none"
            stroke={color}
            strokeWidth={s * 0.06}
            strokeLinejoin="round"
          />
          <path
            d={`M${s * 0.25},${s * 0.75} Q${s * 0.5},${s * 0.5} ${s * 0.7},${s * 0.25}`}
            fill="none"
            stroke={color}
            strokeWidth={s * 0.05}
            strokeLinecap="round"
          />
        </g>
      );
    default:
      return null;
  }
}

/* ── Dynamic font sizing: binary-search for largest font that fits ── */
function dynamicFontSize(
  text: string,
  areaW: number,
  areaH: number,
): number {
  if (!text || text.trim().length === 0) {
    return Math.min(areaW * 0.08, areaH * 0.12);
  }

  const words = text.trim().split(/\s+/);
  // Bold uppercase sans-serif chars average ~0.68× the font-size in width
  const charWidthRatio = 0.68;

  let lo = 8;
  let hi = Math.min(areaW * 0.3, areaH * 0.5, 120);
  let best = lo;

  while (hi - lo > 0.5) {
    const mid = (lo + hi) / 2;
    const charW = mid * charWidthRatio;
    const maxChars = Math.max(1, Math.floor(areaW / charW));

    // Simulate word wrapping — accounts for word-break on long words
    let lines = 1;
    let lineChars = 0;
    for (const word of words) {
      if (lineChars === 0) {
        if (word.length > maxChars) {
          // Word itself exceeds line width — CSS will break it
          lines += Math.ceil(word.length / maxChars) - 1;
          lineChars = word.length % maxChars || maxChars;
        } else {
          lineChars = word.length;
        }
      } else if (lineChars + 1 + word.length <= maxChars) {
        lineChars += 1 + word.length;
      } else {
        lines++;
        if (word.length > maxChars) {
          lines += Math.ceil(word.length / maxChars) - 1;
          lineChars = word.length % maxChars || maxChars;
        } else {
          lineChars = word.length;
        }
      }
    }

    const neededH = lines * mid * 1.4;
    if (neededH <= areaH * 0.92) {
      best = mid;
      lo = mid;
    } else {
      hi = mid;
    }
  }

  return Math.max(8, Math.floor(best));
}

interface SignPreviewProps {
  signType: string;
  textContent: string;
  shape: string;
  size: string;
}

export default function SignPreview({
  signType,
  textContent,
  shape,
  size,
}: SignPreviewProps) {
  const type = SIGN_TYPES[signType] || SIGN_TYPES.warning;
  const dim = SIZE_DIMENSIONS[size] || SIZE_DIMENSIONS.M;

  const previewW = 320;

  const isCircle = shape === "circle";
  const isTriangle = shape === "triangle";
  const isSquare = shape === "square";

  // ViewBox dimensions — equilateral triangle gets its own aspect ratio
  const vbW = isSquare || isCircle ? Math.min(dim.w, dim.h) : dim.w;

  let vbH: number;
  let pad: number;

  if (isTriangle) {
    pad = vbW * 0.06;
    const triBase = vbW - pad * 2;
    vbH = triBase * Math.sqrt(3) / 2 + pad * 2;
  } else if (isSquare || isCircle) {
    vbH = vbW;
    pad = vbW * 0.06;
  } else {
    vbH = dim.h;
    pad = Math.max(vbW, vbH) * 0.06;
  }

  const headerH = vbH * 0.15;
  const iconSize = headerH * 0.7;

  // ── Text area geometry per shape ──
  let textX: number, textY: number, textW: number, textH: number;

  if (isTriangle) {
    // Equilateral triangle — text in lower portion where there's width
    const triTopY = pad;
    const triBottomY = vbH - pad;
    const triH = triBottomY - triTopY;
    // Push text to the wider lower section
    textY = triTopY + triH * 0.42;
    textH = triH * 0.35;
    // Width at the text area midpoint (linear interpolation of triangle)
    const midFrac = (textY + textH / 2 - triTopY) / triH;
    const widthAtMid = (vbW - pad * 2) * midFrac;
    textW = widthAtMid * 0.88;
    textX = (vbW - textW) / 2;
  } else if (isCircle) {
    // Inscribed rectangle in circle — centred
    const r = vbW / 2 - 8;
    const inscribedSide = r * Math.sqrt(2);
    textW = inscribedSide * 0.85;
    textH = inscribedSide * 0.45;
    textX = (vbW - textW) / 2;
    textY = vbH / 2 - textH / 2;
  } else {
    // Rectangle / square — extra inset so text stays clear of borders
    const inset = Math.max(vbW * 0.04, 12);
    textX = pad + inset;
    textY = pad + headerH + inset;
    textW = vbW - pad * 2 - inset * 2;
    textH = vbH - pad * 2 - headerH - inset * 2 - 20;
  }

  // Preview render dimensions
  const aspect = vbH / vbW;
  const renderW = isSquare || isCircle ? previewW * 0.8 : isTriangle ? previewW * 0.85 : previewW;
  const renderH = renderW * aspect;

  // Font size calculated in actual CSS pixels (foreignObject renders in screen space)
  const scale = renderW / vbW;
  const fontSize = dynamicFontSize(textContent || "Your sign text here", textW * scale, textH * scale);

  return (
    <div className="flex flex-col items-center gap-4">
      <svg
        viewBox={`0 0 ${vbW} ${vbH}`}
        width={renderW}
        height={renderH}
        xmlns="http://www.w3.org/2000/svg"
        className="drop-shadow-lg max-w-full h-auto"
      >
        {/* Background shape */}
        {isCircle ? (
          <circle
            cx={vbW / 2}
            cy={vbH / 2}
            r={vbW / 2 - 4}
            fill={type.bg}
            stroke={type.border}
            strokeWidth={8}
          />
        ) : isTriangle ? (
          <polygon
            points={`${vbW / 2},${pad} ${vbW - pad},${vbH - pad} ${pad},${vbH - pad}`}
            fill={type.bg}
            stroke={type.border}
            strokeWidth={6}
            strokeLinejoin="round"
          />
        ) : (
          <rect
            x={4}
            y={4}
            width={vbW - 8}
            height={vbH - 8}
            rx={12}
            fill={type.bg}
            stroke={type.border}
            strokeWidth={6}
          />
        )}

        {/* Inner border for rect/square */}
        {!isCircle && !isTriangle && (
          <rect
            x={pad}
            y={pad}
            width={vbW - pad * 2}
            height={vbH - pad * 2}
            rx={8}
            fill="none"
            stroke={type.border}
            strokeWidth={3}
            opacity={0.3}
          />
        )}

        {/* Type header bar (rect/square only) */}
        {!isCircle && !isTriangle && (
          <>
            <rect
              x={pad + 2}
              y={pad + 2}
              width={vbW - pad * 2 - 4}
              height={headerH}
              rx={6}
              fill={type.border}
              opacity={0.15}
            />
            <TypeIcon
              signType={signType}
              x={pad + 2 + iconSize / 2 + 8}
              y={pad + 2 + headerH / 2}
              size={iconSize}
              color={type.fg}
            />
            <text
              x={pad + 2 + iconSize + 14}
              y={pad + headerH / 2 + 2}
              textAnchor="start"
              dominantBaseline="central"
              fill={type.fg}
              fontSize={headerH * 0.42}
              fontWeight="bold"
              fontFamily="Arial, Helvetica, sans-serif"
              style={{ textTransform: "uppercase" }}
            >
              {type.label}
            </text>
          </>
        )}

        {/* Type icon for circle (top area) */}
        {isCircle && (
          <TypeIcon
            signType={signType}
            x={vbW / 2}
            y={vbH * 0.22}
            size={vbW * 0.18}
            color={type.fg}
          />
        )}

        {/* Type icon for triangle (top area, small) */}
        {isTriangle && (
          <TypeIcon
            signType={signType}
            x={vbW / 2}
            y={pad + (vbH - pad * 2) * 0.22}
            size={vbW * 0.12}
            color={type.fg}
          />
        )}

        {/* Sign text via foreignObject for wrapping */}
        <foreignObject
          x={textX}
          y={textY}
          width={textW}
          height={textH}
        >
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              color: type.fg,
              fontSize: `${fontSize}px`,
              fontWeight: "bold",
              fontFamily: "Arial, Helvetica, sans-serif",
              lineHeight: 1.3,
              wordBreak: "break-word",
              overflow: "hidden",
              padding: "2px",
            }}
          >
            {textContent || "Your sign text here"}
          </div>
        </foreignObject>

        {/* Type label for circle/triangle */}
        {(isCircle || isTriangle) && (
          <text
            x={vbW / 2}
            y={isTriangle ? vbH - pad - vbH * 0.04 : vbH * 0.82}
            textAnchor="middle"
            dominantBaseline="central"
            fill={type.fg}
            fontSize={vbW * 0.055}
            fontWeight="bold"
            fontFamily="Arial, Helvetica, sans-serif"
            opacity={0.5}
            style={{ textTransform: "uppercase" }}
          >
            {type.label}
          </text>
        )}

        {/* Watermark */}
        <text
          x={vbW / 2}
          y={
            isCircle
              ? vbH * 0.92
              : isTriangle
                ? vbH - pad * 0.8
                : vbH - pad - 4
          }
          textAnchor="middle"
          fill={type.fg}
          fontSize={vbW * 0.032}
          fontFamily="Arial, Helvetica, sans-serif"
          opacity={0.2}
        >
          INDICATIVE PREVIEW
        </text>
      </svg>

      {/* Size label below */}
      <span className="text-xs text-gray-400 font-medium">{dim.label}</span>
    </div>
  );
}

/* ── Generate a data URI for the basket thumbnail ── */
export function generateSignPreviewDataUri(
  signType: string,
  textContent: string,
  shape: string,
): string {
  const type = SIGN_TYPES[signType] || SIGN_TYPES.warning;
  const s = 120;

  // Equilateral triangle: height = base * sqrt(3)/2
  const triBase = s - 16;
  const triH = Math.round(triBase * 0.866);
  const triTop = Math.round((s - triH) / 2);

  let shapeEl: string;
  if (shape === "circle") {
    shapeEl = `<circle cx="${s / 2}" cy="${s / 2}" r="${s / 2 - 4}" fill="${type.bg}" stroke="${type.border}" stroke-width="4"/>`;
  } else if (shape === "triangle") {
    shapeEl = `<polygon points="${s / 2},${triTop} ${s - 8},${triTop + triH} 8,${triTop + triH}" fill="${type.bg}" stroke="${type.border}" stroke-width="4" stroke-linejoin="round"/>`;
  } else {
    shapeEl = `<rect x="4" y="4" width="${s - 8}" height="${s - 8}" rx="6" fill="${type.bg}" stroke="${type.border}" stroke-width="4"/>`;
  }

  const truncText =
    textContent.length > 30 ? textContent.slice(0, 28) + "\u2026" : textContent;
  const escapedText = truncText
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
    ${shapeEl}
    <text x="${s / 2}" y="${s * 0.3}" text-anchor="middle" fill="${type.fg}" font-size="10" font-weight="bold" font-family="Arial">${type.label.toUpperCase()}</text>
    <foreignObject x="12" y="${shape === "triangle" ? s * 0.42 : s * 0.34}" width="${s - 24}" height="${s * 0.45}">
      <div xmlns="http://www.w3.org/1999/xhtml" style="text-align:center;color:${type.fg};font-size:9px;font-family:Arial;word-break:break-word;overflow:hidden;line-height:1.2">${escapedText || "Custom Sign"}</div>
    </foreignObject>
  </svg>`;

  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
}

export { SIGN_TYPES, SIZE_DIMENSIONS };
