'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { AnalyticsPoint } from '@/lib/types';
import { formatCompact } from '@/lib/format';

function smoothPath(points: Array<[number, number]>): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0][0]} ${points[0][1]}`;
  let path = `M ${points[0][0]} ${points[0][1]}`;
  for (let i = 0; i < points.length - 1; i++) {
    const current = points[i];
    const next = points[i + 1];
    const controlX = (current[0] + next[0]) / 2;
    path += ` C ${controlX} ${current[1]}, ${controlX} ${next[1]}, ${next[0]} ${next[1]}`;
  }
  return path;
}

export function PerformanceChart({ data }: { data: AnalyticsPoint[] }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);
  const [height, setHeight] = useState(284);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  useEffect(() => {
    const element = wrapRef.current;
    if (!element) return;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect) return;
      setWidth(Math.max(rect.width, 280));
      setHeight(rect.width < 480 ? 220 : 284);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const padding = { top: 18, right: 16, bottom: 30, left: width < 480 ? 40 : 50 };
  const chartWidth = Math.max(width - padding.left - padding.right, 100);
  const chartHeight = height - padding.top - padding.bottom;

  const { reachPath, reachArea, engagementPath, points, yTicks, xTicks } = useMemo(() => {
    const maxValue = Math.max(
      ...data.map((point) => Math.max(point.reach, point.engagement)),
      1,
    );
    const ceiling = Math.ceil((maxValue * 1.14) / 500) * 500;

    const mapped = data.map((point, index) => {
      const x = padding.left + (index / Math.max(data.length - 1, 1)) * chartWidth;
      const reachY = padding.top + chartHeight - (point.reach / ceiling) * chartHeight;
      const engagementY =
        padding.top + chartHeight - (point.engagement / ceiling) * chartHeight;
      return { x, reachY, engagementY, point };
    });
    const reachPoints: Array<[number, number]> = mapped.map(({ x, reachY }) => [x, reachY]);
    const engagementPoints: Array<[number, number]> = mapped.map(({ x, engagementY }) => [
      x,
      engagementY,
    ]);
    const reachLine = smoothPath(reachPoints);
    const engagementLine = smoothPath(engagementPoints);

    const yTickCount = 4;
    const ticks = Array.from({ length: yTickCount + 1 }, (_, index) => {
      const ratio = index / yTickCount;
      return {
        value: Math.round(ceiling * (1 - ratio)),
        y: padding.top + chartHeight * ratio,
      };
    });

    const desiredTicks = width < 480 ? 3 : data.length > 40 ? 5 : 5;
    const indices = Array.from({ length: desiredTicks }, (_, index) =>
      Math.round((index / Math.max(desiredTicks - 1, 1)) * (data.length - 1)),
    );
    const uniqueIndices = [...new Set(indices)];
    const xLabels = uniqueIndices.map((index) => {
      const mappedPoint = mapped[index];
      const date = new Date(`${data[index].date}T12:00:00`);
      return {
        x: mappedPoint?.x ?? padding.left,
        label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      };
    });

    return {
      reachPath: reachLine,
      reachArea: reachLine
        ? `${reachLine} L ${padding.left + chartWidth} ${padding.top + chartHeight} L ${padding.left} ${padding.top + chartHeight} Z`
        : '',
      engagementPath: engagementLine,
      points: mapped,
      yTicks: ticks,
      xTicks: xLabels,
    };
  }, [data, chartHeight, chartWidth, padding.left, padding.top, width]);

  const active = activeIndex !== null ? points[activeIndex] : null;
  const tooltipDate = active
    ? new Date(`${active.point.date}T12:00:00`).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      })
    : '';

  function onPointerMove(event: React.PointerEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const ratio = Math.min(Math.max((x - padding.left) / chartWidth, 0), 1);
    setActiveIndex(Math.round(ratio * (data.length - 1)));
  }

  return (
    <div className="chart-wrap" ref={wrapRef}>
      <svg
        className="performance-chart"
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Reach and engagement over time"
        onPointerMove={onPointerMove}
        onPointerLeave={() => setActiveIndex(null)}
      >
        <defs>
          <linearGradient id="reachGradient" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#2d5a43" stopOpacity="0.17" />
            <stop offset="80%" stopColor="#2d5a43" stopOpacity="0.015" />
            <stop offset="100%" stopColor="#2d5a43" stopOpacity="0" />
          </linearGradient>
        </defs>

        {yTicks.map((tick) => (
          <g key={tick.y}>
            <line
              x1={padding.left}
              x2={padding.left + chartWidth}
              y1={tick.y}
              y2={tick.y}
              stroke="#ebe9e1"
              strokeWidth="1"
              strokeDasharray={tick.value === 0 ? undefined : '2 5'}
            />
            <text
              x={padding.left - 10}
              y={tick.y + 3}
              textAnchor="end"
              className="chart-axis-label"
            >
              {formatCompact(tick.value)}
            </text>
          </g>
        ))}

        {xTicks.map((tick) => (
          <text
            key={`${tick.x}-${tick.label}`}
            x={tick.x}
            y={height - 8}
            textAnchor="middle"
            className="chart-axis-label"
          >
            {tick.label}
          </text>
        ))}

        <path d={reachArea} fill="url(#reachGradient)" />
        <path
          d={reachPath}
          fill="none"
          stroke="#2a5540"
          strokeWidth="2.1"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d={engagementPath}
          fill="none"
          stroke="#eb906d"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {active && (
          <g className="chart-hover">
            <line
              x1={active.x}
              x2={active.x}
              y1={padding.top}
              y2={padding.top + chartHeight}
              stroke="#a8b1a7"
              strokeWidth="1"
              strokeDasharray="3 4"
            />
            <circle cx={active.x} cy={active.reachY} r="5" fill="#2a5540" stroke="#fff" strokeWidth="2.5" />
            <circle
              cx={active.x}
              cy={active.engagementY}
              r="4.5"
              fill="#eb906d"
              stroke="#fff"
              strokeWidth="2.5"
            />
          </g>
        )}
      </svg>

      {active && (
        <div
          className="chart-tooltip"
          style={{
            left: `${Math.min(Math.max((active.x / width) * 100, 10), 88)}%`,
            top: 4,
          }}
        >
          <span>{tooltipDate}</span>
          <div>
            <i className="tooltip-dot tooltip-dot-reach" />
            <span>Reach</span>
            <b>{formatCompact(active.point.reach)}</b>
          </div>
          <div>
            <i className="tooltip-dot tooltip-dot-engagement" />
            <span>Engagement</span>
            <b>{formatCompact(active.point.engagement)}</b>
          </div>
        </div>
      )}
    </div>
  );
}

export function Sparkline({
  values,
  color = '#2a5540',
  width = 110,
  height = 36,
  fill = true,
}: {
  values: number[];
  color?: string;
  width?: number;
  height?: number;
  fill?: boolean;
}) {
  // useId() is pure and stable across renders; strip ":" so the value is a
  // safe SVG url(#...) fragment.
  const id = `spark-${useId().replace(/:/g, '')}`;
  if (values.length < 2) return null;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = Math.max(max - min, 1);
  const points = values.map((value, index) => {
    const x = (index / (values.length - 1)) * width;
    const y = height - 4 - ((value - min) / range) * (height - 8);
    return [x, y] as [number, number];
  });
  const line = points.map(([x, y], index) => `${index === 0 ? 'M' : 'L'} ${x} ${y}`).join(' ');
  const area = `${line} L ${width} ${height} L 0 ${height} Z`;
  const last = points[points.length - 1];

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="sparkline" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {fill && <path d={area} fill={`url(#${id})`} />}
      <path d={line} fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r="2.2" fill={color} />
    </svg>
  );
}
