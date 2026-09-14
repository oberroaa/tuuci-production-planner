import React from 'react';

// Code 128 B Patterns (ASCII 32 to 127, Start B = 104, Stop = 106)
const PATTERNS: string[] = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213', // 0-9
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132', // 10-19
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211', // 20-29
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313', // 30-39
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331', // 40-49
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111', // 50-59
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214', // 60-69
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111', // 70-79
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141', // 80-89
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141', // 90-99
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112' // 100-106
];

const START_B = 104;
const STOP = 106;
const QUIET_ZONE_MODULES = 10;

interface Barcode128Props {
  value: string;
  height?: number;
  barWidth?: number;
  showText?: boolean;
  className?: string;
}

export const Barcode128: React.FC<Barcode128Props> = ({
  value,
  height = 48,
  barWidth = 1.8,
  showText = true,
  className = ''
}) => {
  if (!value) return null;

  // Clean value to valid Code 128 B printable characters (ASCII 32 to 126)
  const cleanText = value.replace(/[^\x20-\x7E]/g, '');
  if (!cleanText) return null;

  // Calculate symbols array: [START_B, ...chars, checksum, STOP]
  const symbols: number[] = [START_B];
  let checksumSum = START_B;

  for (let i = 0; i < cleanText.length; i++) {
    const code = cleanText.charCodeAt(i) - 32;
    symbols.push(code);
    checksumSum += code * (i + 1);
  }

  const checksum = checksumSum % 103;
  symbols.push(checksum);
  symbols.push(STOP);

  // Generate bar elements (black rects)
  const rects: React.ReactNode[] = [];
  let currentX = QUIET_ZONE_MODULES;

  symbols.forEach((symbolIdx, sIndex) => {
    const pattern = PATTERNS[symbolIdx] || PATTERNS[0];
    for (let pIdx = 0; pIdx < pattern.length; pIdx++) {
      const widthUnits = parseInt(pattern[pIdx], 10);
      const isBar = pIdx % 2 === 0; // Even indices are bars (black), odd are spaces (white)

      if (isBar) {
        rects.push(
          <rect
            key={`bar-${sIndex}-${pIdx}`}
            x={currentX * barWidth}
            y={0}
            width={widthUnits * barWidth}
            height={height}
            fill="#000000"
          />
        );
      }
      currentX += widthUnits;
    }
  });

  const totalModules = currentX + QUIET_ZONE_MODULES;
  const totalSvgWidth = totalModules * barWidth;
  const totalSvgHeight = showText ? height + 16 : height;

  return (
    <div className={`inline-flex flex-col items-center select-none ${className}`}>
      <svg
        width={totalSvgWidth}
        height={totalSvgHeight}
        viewBox={`0 0 ${totalSvgWidth} ${totalSvgHeight}`}
        xmlns="http://www.w3.org/2000/svg"
        shapeRendering="crispEdges"
        className="max-w-full"
      >
        {/* Crisp white background */}
        <rect width={totalSvgWidth} height={totalSvgHeight} fill="#ffffff" />

        {/* Black bars */}
        {rects}

        {/* Human readable text under barcode */}
        {showText && (
          <text
            x={totalSvgWidth / 2}
            y={height + 13}
            textAnchor="middle"
            fontFamily="monospace"
            fontSize="11"
            fontWeight="bold"
            letterSpacing="1.5"
            fill="#000000"
          >
            {cleanText}
          </text>
        )}
      </svg>
    </div>
  );
};
