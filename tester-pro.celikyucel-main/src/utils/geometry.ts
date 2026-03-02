// src/utils/geometry.ts
import { Point } from '../types/index';

export function getPolygonAreaAndPerimeter(points: Point[]) {
  let area = 0;
  let perimeter = 0;
  const n = points.length;

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
    perimeter += Math.hypot(points[j].x - points[i].x, points[j].y - points[i].y);
  }
  area = Math.abs(area) / 2;
  return { area, perimeter };
}

// --- YENİ: ZAYİAT / FİRE (WASTE FACTOR) HESAPLAMA ---
export function calculateWasteFactor(points: Point[], manualArea?: number, manualPerimeter?: number): number {
    // 1. KULLANICI ÇİZİM YAPMIŞSA (Points Varsa)
    if (points && points.length > 2) {
        // Yön bulma (Saat yönü / Ters saat yönü) hesaplaması için imzalı alan
        let signedArea = 0;
        let perimeter = 0;
        
        for (let i = 0; i < points.length; i++) {
            const p1 = points[i];
            const p2 = points[(i + 1) % points.length];
            signedArea += (p1.x * p2.y - p2.x * p1.y);
            perimeter += Math.hypot(p2.x - p1.x, p2.y - p1.y);
        }
        
        const area = Math.abs(signedArea) / 2;
        if (area === 0) return 1.0;

        // Canvas y-down sisteminde: signedArea > 0 ise Saat Yönü
        const isClockwise = signedArea > 0; 

        // A. BAZ FİRE (Form Faktörü): Çevre / İdeal Çevre
        // Aynı alana sahip mükemmel bir karenin çevresi = 4 * sqrt(Alan)
        const idealPerimeter = 4 * Math.sqrt(area);
        let extraWaste = Math.max(0, (perimeter / idealPerimeter) - 1);

        let reflexCount = 0;
        let hasSlantedWalls = false;

        // Tüm köşeleri dönüp açı incelemesi yapalım
        for (let i = 0; i < points.length; i++) {
            const prev = points[(i - 1 + points.length) % points.length];
            const curr = points[i];
            const next = points[(i + 1) % points.length];

            const v1x = curr.x - prev.x;
            const v1y = curr.y - prev.y;
            const v2x = next.x - curr.x;
            const v2y = next.y - curr.y;

            // İki vektör arası sapma/dönüş açısı (-PI ile PI arası)
            const det = v1x * v2y - v1y * v2x; 
            const dot = v1x * v2x + v1y * v2y; 
            
            let angleRad = Math.atan2(det, dot);
            let angleDeg = (angleRad * 180) / Math.PI;

            // B. İÇBÜKEY (REFLEX) KÖŞE TESPİTİ
            // Saat yönündeyken sola dönüşler, saatin tersiyken sağa dönüşler içbükeydir.
            let isReflex = false;
            if (isClockwise && det < -0.01) isReflex = true;
            if (!isClockwise && det > 0.01) isReflex = true;
            if (isReflex) reflexCount++;

            // C. YAMUK DUVAR TESPİTİ (Dik olmayan açılar)
            const absAngle = Math.abs(angleDeg);
            const isOrthogonal = 
                absAngle <= 5 || 
                Math.abs(absAngle - 90) <= 5 || 
                Math.abs(absAngle - 180) <= 5;
            
            if (!isOrthogonal) hasSlantedWalls = true;
        }

        // Zorluk Bonusu (Her içbükey köşe için %2 extra zayiat)
        extraWaste += (reflexCount * 0.02);

        // Açı Bonusu (Yamuk duvar varsa toplam zayiat katlanır)
        if (hasSlantedWalls) {
            extraWaste *= 1.10;
        }

        // Maksimum %15 limit (1.15)
        return 1.0 + Math.min(extraWaste, 0.15);
    } 
    // 2. KULLANICI ÇİZİM YAPMADAN MANUEL DEĞER GİRMİŞSE
    else if (manualArea && manualPerimeter && manualArea > 0) {
        const idealPerimeter = 4 * Math.sqrt(manualArea);
        const baseWaste = Math.max(0, (manualPerimeter / idealPerimeter) - 1);
        
        // Çizim olmadığı için açıları bilemeyiz, o yüzden limiti daha dar tutuyoruz (%10)
        return 1.0 + Math.min(baseWaste, 0.10);
    }

    return 1.0;
}
// -------------------------------------------------------------------------

export function isPointInPolygon(point: Point, vs: Point[]) {
  const x = point.x, y = point.y;
  let inside = false;
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    const xi = vs[i].x, yi = vs[i].y;
    const xj = vs[j].x, yj = vs[j].y;
    const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

export function distanceToSegment(p: Point, v: Point, w: Point) {
  const l2 = (v.x - w.x)**2 + (v.y - w.y)**2;
  if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (v.x + t * (w.x - v.x)), p.y - (v.y + t * (w.y - v.y)));
}

// --- Ramer-Douglas-Peucker (RDP) Sadeleştirme Algoritması ---
const pointLineDistance = (p: Point, a: Point, b: Point): number => {
    const n = Math.abs((b.y - a.y) * p.x - (b.x - a.x) * p.y + b.x * a.y - b.y * a.x);
    const d = Math.sqrt(Math.pow(b.y - a.y, 2) + Math.pow(b.x - a.x, 2));
    return d === 0 ? Math.hypot(p.x - a.x, p.y - a.y) : n / d;
};

const simplifyPath = (points: Point[], tolerance: number): Point[] => {
    if (points.length <= 2) return points;
    let dmax = 0;
    let index = 0;
    const end = points.length - 1;
    for (let i = 1; i < end; i++) {
        const d = pointLineDistance(points[i], points[0], points[end]);
        if (d > dmax) {
            index = i;
            dmax = d;
        }
    }
    if (dmax > tolerance) {
        const recResults1 = simplifyPath(points.slice(0, index + 1), tolerance);
        const recResults2 = simplifyPath(points.slice(index), tolerance);
        return recResults1.slice(0, recResults1.length - 1).concat(recResults2);
    } else {
        return [points[0], points[end]];
    }
};

export const floodFillRoom = (ctx: CanvasRenderingContext2D, startX: number, startY: number, width: number, height: number): Point[] | null => {
  startX = Math.round(startX);
  startY = Math.round(startY);
  
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const pixelStack = [[startX, startY]];
  
  const getPixel = (x: number, y: number) => {
    const idx = (y * width + x) * 4;
    return [data[idx], data[idx+1], data[idx+2]];
  };
  
  const startColor = getPixel(startX, startY);
  
  // Duvarları algılamak için (Siyah ve gri tonları)
  const isWall = (r: number, g: number, b: number) => (r + g + b) / 3 < 120; 
  if (isWall(startColor[0], startColor[1], startColor[2])) return null;

  const visited = new Int8Array(width * height);
  let minX = width, maxX = 0, minY = height, maxY = 0;
  let area = 0;

  // 1. AŞAMA: Flood Fill
  while (pixelStack.length) {
    const newPos = pixelStack.pop()!;
    const x = newPos[0], y = newPos[1];
    const idx = y * width + x;
    
    if (x < 0 || x >= width || y < 0 || y >= height || visited[idx]) continue;
    
    const [r, g, b] = getPixel(x, y);
    if (!isWall(r, g, b)) {
      visited[idx] = 1;
      area++;
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
      
      pixelStack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
  }

  if (area < 100) return null;

  // 2. AŞAMA: Moore Neighborhood Tracing
  let startContourX = -1, startContourY = -1;
  outer: for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
          if (visited[y * width + x] === 1) {
              startContourX = x;
              startContourY = y;
              break outer;
          }
      }
  }

  if (startContourX === -1) return null;

  const dx = [-1, -1, 0, 1, 1, 1, 0, -1];
  const dy = [0, -1, -1, -1, 0, 1, 1, 1];
  
  const boundary: Point[] = [];
  let curX = startContourX;
  let curY = startContourY;
  let dir = 0;
  
  let attempts = 0;
  const maxAttempts = (maxX - minX + maxY - minY) * 10;

  while (true) {
      boundary.push({ x: curX, y: curY });
      let found = false;
      
      for (let i = 0; i < 8; i++) {
          let checkDir = (dir + i) % 8;
          let nx = curX + dx[checkDir];
          let ny = curY + dy[checkDir];
          
          if (nx >= 0 && nx < width && ny >= 0 && ny < height && visited[ny * width + nx] === 1) {
              curX = nx;
              curY = ny;
              dir = (checkDir + 5) % 8; 
              found = true;
              break;
          }
      }
      
      if (!found) break; 
      if (curX === startContourX && curY === startContourY) break; 
      
      attempts++;
      if (attempts > maxAttempts) break;
  }

  const tolerance = 10.0; 
  let simplifiedPolygon = simplifyPath(boundary, tolerance);

  return simplifiedPolygon;
};