import React from 'react';
import type { BaseEntity } from '../utils/dxfProcessor';

interface DxfViewerProps {
  data: BaseEntity[];
  rawDxf: any;
}

export const DxfViewer: React.FC<DxfViewerProps> = ({ data, rawDxf }) => {
  if (!rawDxf || !rawDxf.entities) {
    return (
      <div className="flex-1 flex items-center justify-center text-text-muted">
        Upload a DXF file to view drawing.
      </div>
    );
  }

  // Very basic DXF bounds calculation for SVG ViewBox
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  rawDxf.entities.forEach((ent: any) => {
    if (ent.vertices) {
      ent.vertices.forEach((v: any) => {
        if (v.x < minX) minX = v.x;
        if (v.y < minY) minY = v.y;
        if (v.x > maxX) maxX = v.x;
        if (v.y > maxY) maxY = v.y;
      });
    } else if (ent.type === 'CIRCLE') {
      const cx = ent.center?.x || 0;
      const cy = ent.center?.y || 0;
      const r = ent.radius || 0;
      if (cx - r < minX) minX = cx - r;
      if (cy - r < minY) minY = cy - r;
      if (cx + r > maxX) maxX = cx + r;
      if (cy + r > maxY) maxY = cy + r;
    }
  });

  // Default box if nothing found
  if (minX === Infinity) {
    minX = -10; minY = -10; maxX = 10; maxY = 10;
  }

  const padding = (maxX - minX) * 0.1;
  const vbMinX = minX - padding;
  const vbMinY = minY - padding;
  const vbWidth = (maxX - minX) + 2 * padding;
  const vbHeight = (maxY - minY) + 2 * padding;

  return (
    <div className="flex-1 overflow-hidden relative">
      <svg
        width="100%"
        height="100%"
        viewBox={`${vbMinX} ${vbMinY} ${vbWidth} ${vbHeight}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ transform: 'scaleY(-1)' }} // Invert Y axis for CAD standard
      >
        {rawDxf.entities.map((ent: any, i: number) => {
          // Attempt to map modified data lengths if available
          const currentData = data.find(d => d.id === ent.handle);
          const color = '#3b82f6'; // using accent primary

          if (ent.type === 'LINE') {
            if (!ent.vertices || ent.vertices.length < 2) return null;
            let x2 = ent.vertices[1].x;
            let y2 = ent.vertices[1].y;
            
            // If length was edited in table, we could scale it
            if (currentData?.length !== undefined) {
              const dx = x2 - ent.vertices[0].x;
              const dy = y2 - ent.vertices[0].y;
              const originalLen = Math.sqrt(dx * dx + dy * dy);
              if (originalLen > 0) {
                const scale = currentData.length / originalLen;
                x2 = ent.vertices[0].x + dx * scale;
                y2 = ent.vertices[0].y + dy * scale;
              }
            }
            
            return (
              <line
                key={i}
                x1={ent.vertices[0].x}
                y1={ent.vertices[0].y}
                x2={x2}
                y2={y2}
                stroke={color}
                strokeWidth={vbWidth / 500}
                vectorEffect="non-scaling-stroke"
              />
            );
          } else if (ent.type === 'CIRCLE') {
            const r = ent.radius || 0;
            // Area edited -> adjust radius
            let adjustedR = r;
            if (currentData?.area !== undefined && currentData.area > 0) {
              adjustedR = Math.sqrt(currentData.area / Math.PI);
            }
            return (
              <circle
                key={i}
                cx={ent.center?.x || 0}
                cy={ent.center?.y || 0}
                r={adjustedR}
                stroke={color}
                fill="none"
                strokeWidth={vbWidth / 500}
                vectorEffect="non-scaling-stroke"
              />
            );
          } else if (ent.type === 'LWPOLYLINE' || ent.type === 'POLYLINE') {
            if (!ent.vertices) return null;
            const points = ent.vertices.map((v: any) => `${v.x},${v.y}`).join(' ');
            return (
              <polyline
                key={i}
                points={points}
                stroke={color}
                fill="none"
                strokeWidth={vbWidth / 500}
                vectorEffect="non-scaling-stroke"
              />
            );
          }
          return null;
        })}
      </svg>
    </div>
  );
};
