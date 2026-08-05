import DxfParser from 'dxf-parser';

export interface BaseEntity {
  id: string; // Handle
  type: string;
  layer: string;
  color?: number;
  length?: number;
  area?: number;
  
  // Geometric Section Properties
  centroidY?: number;
  momentOfInertia?: number;
  zTop?: number;
  zBottom?: number;
  
  // New Structural Fields
  stripIdMark?: string;
  stripWidth?: number;
  topStress?: number;
  bottomStress?: number;
  ptSlabDepth?: number;
  effDepth?: number;
  hMinusX?: number;
  x?: number;
  ft?: number;
  astReq?: number;
  rebar?: string;
  noOfBar?: number;
  spacingOfBar?: number;
  stressPassFail?: boolean;
  stripWidthRebar?: number;
  inputDiameterOfBar?: number;
  spacing?: number;
  axis?: 'X' | 'Y';
  appliedMoment?: number;
}

export interface Point {
  x: number;
  y: number;
  z: number;
}

export interface DxfData {
  entities: BaseEntity[];
  rawDxf: any; // The raw parsed DXF object for rendering or re-saving
}

function calculateDistance(p1: Point, p2: Point): number {
  return Math.sqrt(
    Math.pow(p2.x - p1.x, 2) +
    Math.pow(p2.y - p1.y, 2) +
    Math.pow((p2.z || 0) - (p1.z || 0), 2)
  );
}

function computePolygonProperties(vertices: Point[]) {
  if (vertices.length < 3) return null;
  
  // Ensure polygon is closed for calculation
  const pts = [...vertices];
  if (pts[0].x !== pts[pts.length - 1].x || pts[0].y !== pts[pts.length - 1].y) {
    pts.push(pts[0]);
  }

  let area = 0;
  let cx = 0;
  let cy = 0;
  let ix = 0;

  for (let i = 0; i < pts.length - 1; i++) {
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const cross = (p1.x * p2.y) - (p2.x * p1.y);
    
    area += cross;
    cx += (p1.x + p2.x) * cross;
    cy += (p1.y + p2.y) * cross;
    ix += (p1.y * p1.y + p1.y * p2.y + p2.y * p2.y) * cross;
  }

  area = area / 2;
  
  if (Math.abs(area) < 1e-9) return null; // degenerate polygon

  cx = cx / (6 * area);
  cy = cy / (6 * area);
  ix = ix / 12;

  // Parallel axis theorem
  let icx = ix - (area * cy * cy);
  icx = Math.abs(icx);
  area = Math.abs(area);

  let yMin = Infinity;
  let yMax = -Infinity;
  pts.forEach(p => {
    if (p.y < yMin) yMin = p.y;
    if (p.y > yMax) yMax = p.y;
  });

  const distTop = yMax - cy;
  const distBot = cy - yMin;

  const zTop = distTop !== 0 ? icx / distTop : 0;
  const zBottom = distBot !== 0 ? icx / distBot : 0;

  return {
    area,
    centroidY: cy,
    momentOfInertia: icx,
    zTop,
    zBottom,
    depth: yMax - yMin
  };
}

export function parseDxf(dxfContent: string): DxfData {
  const parser = new DxfParser();
  let parsedDxf: any = null;
  
  try {
    parsedDxf = parser.parseSync(dxfContent);
  } catch (err) {
    console.error("Error parsing DXF", err);
    throw new Error("Failed to parse DXF file. Ensure it is a valid ASCII DXF.");
  }

  const entities: BaseEntity[] = [];

  if (parsedDxf && parsedDxf.entities) {
    parsedDxf.entities.forEach((ent: any) => {
      let length: number | undefined;
      let area: number | undefined;
      let props: any = null;

      if (ent.type === 'LINE') {
        if (ent.vertices && ent.vertices.length >= 2) {
          length = calculateDistance(ent.vertices[0], ent.vertices[1]);
        }
      } else if (ent.type === 'CIRCLE') {
        const radius = ent.radius || 0;
        length = 2 * Math.PI * radius;
        area = Math.PI * radius * radius;
        props = {
          area,
          centroidY: ent.center?.y || 0,
          momentOfInertia: (Math.PI * Math.pow(radius, 4)) / 4,
          zTop: (Math.PI * Math.pow(radius, 3)) / 4,
          zBottom: (Math.PI * Math.pow(radius, 3)) / 4,
          depth: 2 * radius
        };
      } else if (ent.type === 'LWPOLYLINE' || ent.type === 'POLYLINE') {
        if (ent.vertices && ent.vertices.length > 1) {
          let polyLength = 0;
          for (let i = 0; i < ent.vertices.length - 1; i++) {
            polyLength += calculateDistance(ent.vertices[i], ent.vertices[i + 1]);
          }
          if (ent.shape === true || ent.closed === true) {
            polyLength += calculateDistance(ent.vertices[ent.vertices.length - 1], ent.vertices[0]);
          }
          length = polyLength;
          
          if (ent.shape === true || ent.closed === true) {
            props = computePolygonProperties(ent.vertices);
          }
        }
      }

      if (props) {
        area = props.area;
      }

      entities.push({
        id: ent.handle || Math.random().toString(36).substr(2, 9),
        type: ent.type,
        layer: ent.layer,
        color: ent.colorNumber,
        length: length !== undefined ? Number(length.toFixed(2)) : undefined,
        area: area !== undefined ? Number(area.toFixed(2)) : undefined,
        centroidY: props?.centroidY,
        momentOfInertia: props?.momentOfInertia,
        zTop: props?.zTop,
        zBottom: props?.zBottom,
        stripIdMark: ent.layer || `STRIP-${entities.length + 1}`,
        stripWidth: 1000,
        topStress: 0,
        bottomStress: 0,
        ptSlabDepth: props?.depth || 200,
        rebar: 'T12',
        inputDiameterOfBar: 12,
        stripWidthRebar: 1000,
        appliedMoment: 100, // Default 100 kNm
      });
    });
  }

  return {
    entities,
    rawDxf: parsedDxf,
  };
}
