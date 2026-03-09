"use client";

import { useMemo } from "react";

interface SparklineChartProps {
  data: number[];
  color?: string;
  height?: number;
  width?: number;
}

export function SparklineChart({ data, color = "#3B82F6", height = 32, width = 100 }: SparklineChartProps) {
  const { path, areaPath, gradientId } = useMemo(() => {
    if (data.length === 0) return { path: "", areaPath: "", gradientId: "" };
    
    const max = Math.max(...data, 1);
    const min = Math.min(...data, 0);
    const range = max - min || 1;
    
    const points = data.map((value, index) => {
      const x = (index / (data.length - 1 || 1)) * width;
      const y = height - ((value - min) / range) * height;
      return `${x},${y}`;
    });
    
    const pathStr = `M ${points.join(" L ")}`;
    const areaPathStr = `${pathStr} L ${width},${height} L 0,${height} Z`;
    const gradientIdStr = `sparkline-gradient-${color.replace("#", "")}`;
    
    return { path: pathStr, areaPath: areaPathStr, gradientId: gradientIdStr };
  }, [data, width, height, color]);

  // Определяем, растет ли график
  const isGrowing = data.length > 1 && data[data.length - 1] > data[0];
  const finalColor = isGrowing ? "#10B981" : data[data.length - 1] < data[0] ? "#EF4444" : color;

  return (
    <div className="relative" style={{ width, height }}>
      <svg width={width} height={height} className="overflow-visible">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={finalColor} stopOpacity="0.3" />
            <stop offset="100%" stopColor={finalColor} stopOpacity="0.05" />
          </linearGradient>
        </defs>
        {/* Area fill with gradient */}
        {areaPath && (
          <path
            d={areaPath}
            fill={`url(#${gradientId})`}
          />
        )}
        {/* Line with improved styling */}
        {path && (
          <path
            d={path}
            fill="none"
            stroke={finalColor}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              filter: `drop-shadow(0 2px 4px ${finalColor}40)`,
            }}
          />
        )}
      </svg>
    </div>
  );
}
