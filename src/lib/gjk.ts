import { Point2D, GJKResult } from '../types';

export type SupportFn = (direction: Point2D) => Point2D;

export function dot(a: Point2D, b: Point2D): number {
  return a.x * b.x + a.y * b.y;
}

export function norm(p: Point2D): number {
  return Math.sqrt(p.x * p.x + p.y * p.y);
}

export function sub(a: Point2D, b: Point2D): Point2D {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function add(a: Point2D, b: Point2D): Point2D {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function mul(p: Point2D, s: number): Point2D {
  return { x: p.x * s, y: p.y * s };
}

export function neg(p: Point2D): Point2D {
  return { x: -p.x, y: -p.y };
}

/**
 * Circle Support Function
 */
export function circleSupport(center: Point2D, radius: number): SupportFn {
  return (direction: Point2D): Point2D => {
    const dNorm = norm(direction);
    if (dNorm < 1e-10) {
      return { x: center.x + radius, y: center.y };
    }
    return {
      x: center.x + (radius * direction.x) / dNorm,
      y: center.y + (radius * direction.y) / dNorm,
    };
  };
}

/**
 * 2D Box Support Function
 */
export function boxSupport2D(center: Point2D, halfExtents: Point2D): SupportFn {
  return (direction: Point2D): Point2D => {
    return {
      x: center.x + Math.sign(direction.x || 1) * halfExtents.x,
      y: center.y + Math.sign(direction.y || 1) * halfExtents.y,
    };
  };
}

/**
 * Polygon Support Function
 */
export function polygonSupport(vertices: Point2D[]): SupportFn {
  return (direction: Point2D): Point2D => {
    let bestDot = -Infinity;
    let bestVert = vertices[0];
    for (const v of vertices) {
      const d = dot(v, direction);
      if (d > bestDot) {
        bestDot = d;
        bestVert = v;
      }
    }
    return { ...bestVert };
  };
}

/**
 * Ellipse Support Function
 */
export function ellipseSupport(center: Point2D, radii: Point2D): SupportFn {
  return (direction: Point2D): Point2D => {
    const scaled = { x: radii.x * direction.x, y: radii.y * direction.y };
    const scaledNorm = norm(scaled);
    if (scaledNorm < 1e-10) {
      return { x: center.x + radii.x, y: center.y };
    }
    return {
      x: center.x + (radii.x * scaled.x) / scaledNorm,
      y: center.y + (radii.y * scaled.y) / scaledNorm,
    };
  };
}

/**
 * Projects origin onto a line segment [simplex[0], simplex[1]].
 */
function projectLineOrigin2D(simplex: Point2D[]): { ray: Point2D; simplex: Point2D[]; inside: boolean } {
  const [b, a] = simplex; // a is latest point
  const ab = sub(b, a);
  const ao = neg(a);

  if (dot(ab, ao) > 0) {
    // Origin lies between a and b
    // Perpendicular direction towards origin
    const abNormSq = dot(ab, ab);
    if (abNormSq < 1e-12) {
      return { ray: ao, simplex: [a], inside: false };
    }
    const t = dot(ao, ab) / abNormSq;
    const closest = add(a, mul(ab, t));
    return { ray: neg(closest), simplex: [b, a], inside: false };
  } else {
    return { ray: ao, simplex: [a], inside: false };
  }
}

/**
 * 2D Nesterov-accelerated GJK algorithm.
 * Faithful implementation of vision_toolkit.geometry.gjk_2d.
 */
export function gjkNesterovAccelerated2D(
  support1: SupportFn,
  support2: SupportFn,
  options: {
    useAcceleration?: boolean;
    tolerance?: number;
    maxIterations?: number;
  } = {}
): GJKResult {
  const {
    useAcceleration: initAccel = true,
    tolerance = 1e-6,
    maxIterations = 50,
  } = options;

  let useAcceleration = initAccel;
  let ray: Point2D = { x: 1.0, y: 0.0 };
  let rayDir: Point2D = { ...ray };
  let supportPoint: Point2D = { ...ray };
  let simplex: Point2D[] = [];
  let inside = false;
  let distance = 0.0;
  let alpha = 0.0;
  let iterations = 0;

  for (let i = 0; i < maxIterations; i++) {
    iterations = i + 1;
    const rayLen = norm(ray);
    if (rayLen < tolerance) {
      inside = true;
      distance = 0.0;
      break;
    }

    if (useAcceleration) {
      const momentum = (i + 1) / (i + 3);
      const y = add(mul(ray, momentum), mul(supportPoint, 1.0 - momentum));
      rayDir = add(mul(rayDir, momentum), mul(y, 1.0 - momentum));
    } else {
      rayDir = { ...ray };
    }

    const dirNorm = norm(rayDir);
    const unitDir = dirNorm > 1e-10 ? mul(rayDir, 1 / dirNorm) : rayDir;

    const s0 = support1(neg(unitDir));
    const s1 = support2(unitDir);
    supportPoint = sub(s0, s1);
    simplex.push(supportPoint);

    const omega = dot(unitDir, supportPoint);
    if (omega > 0.0) {
      distance = omega;
      inside = false;
      break;
    }

    if (useAcceleration) {
      const frankWolfeGap = 2 * dot(ray, sub(ray, supportPoint));
      if (frankWolfeGap - tolerance <= 0) {
        useAcceleration = false;
        simplex.pop();
        continue;
      }
    }

    alpha = Math.max(alpha, omega);
    const diff = rayLen - alpha;
    if (i > 0 && diff - tolerance * rayLen <= 0) {
      simplex.pop();
      if (useAcceleration) {
        useAcceleration = false;
        continue;
      }
      distance = rayLen;
      inside = distance < tolerance;
      break;
    }

    if (simplex.length === 1) {
      ray = { ...supportPoint };
    } else if (simplex.length === 2) {
      const res = projectLineOrigin2D(simplex);
      ray = res.ray;
      simplex = res.simplex;
      inside = res.inside;
    } else {
      // Triangle simplex in 2D
      // Check if origin is enclosed
      const [c, b, a] = simplex.slice(-3);
      const ab = sub(b, a);
      const ac = sub(c, a);
      const ao = neg(a);

      const crossZ = ab.x * ac.y - ab.y * ac.x;
      const abPerp = { x: -ab.y * Math.sign(crossZ), y: ab.x * Math.sign(crossZ) };
      const acPerp = { x: ac.y * Math.sign(crossZ), y: -ac.x * Math.sign(crossZ) };

      if (dot(abPerp, ao) > 0) {
        simplex = [b, a];
        ray = abPerp;
      } else if (dot(acPerp, ao) > 0) {
        simplex = [c, a];
        ray = acPerp;
      } else {
        inside = true;
        distance = 0.0;
        break;
      }
    }
  }

  return {
    intersecting: inside,
    distance: Math.max(0, distance),
    iterations,
    simplex,
  };
}

/**
 * Fixture: self-intersecting eight from geometry.fixtures
 */
export function getSelfIntersectingEight(): { name: string; points: Point2D[]; bbox: [number, number, number, number]; isSelfIntersecting: boolean } {
  return {
    name: "Self-Intersecting Eight",
    points: [
      { x: 0.0, y: 0.0 },
      { x: 3.0, y: 0.0 },
      { x: 2.0, y: 1.0 },
      { x: 0.0, y: 3.0 },
      { x: 3.0, y: 2.0 },
    ],
    bbox: [0.0, 0.0, 3.0, 2.0],
    isSelfIntersecting: true,
  };
}

/**
 * Fixture: separated shapes from geometry.fixtures (Rectangle, Triangle, Hexagon)
 */
export function getSeparatedShapes(seed: number = 101): {
  rectangle: Point2D[];
  triangle: Point2D[];
  hexagon: Point2D[];
} {
  // Deterministic pseudo-random based on seed
  function sRandom(idx: number): number {
    const x = Math.sin(seed * 997 + idx * 7919) * 10000;
    return x - Math.floor(x);
  }

  const centers = [
    { x: 2.5, y: 3.0 },
    { x: 6.5, y: 3.0 },
    { x: 10.5, y: 3.0 },
  ];

  // Rotated rectangle
  const w = 1.0 + sRandom(1) * 0.8;
  const h = 1.0 + sRandom(2) * 0.8;
  const angR = (sRandom(3) * 360 * Math.PI) / 180;
  const cR = Math.cos(angR);
  const sR = Math.sin(angR);
  const rectRel = [
    { x: -w / 2, y: -h / 2 },
    { x: w / 2, y: -h / 2 },
    { x: w / 2, y: h / 2 },
    { x: -w / 2, y: h / 2 },
  ];
  const rectangle = rectRel.map((p) => ({
    x: p.x * cR - p.y * sR + centers[0].x,
    y: p.x * sR + p.y * cR + centers[0].y,
  }));

  // Rotated triangle
  const base = 1.5 + sRandom(4);
  const triH = 1.5 + sRandom(5);
  const angT = (sRandom(6) * 360 * Math.PI) / 180;
  const cT = Math.cos(angT);
  const sT = Math.sin(angT);
  const triRel = [
    { x: -base / 3, y: -triH / 3 },
    { x: (2 * base) / 3, y: -triH / 3 },
    { x: -base / 3, y: (2 * triH) / 3 },
  ];
  const triangle = triRel.map((p) => ({
    x: p.x * cT - p.y * sT + centers[1].x,
    y: p.x * sT + p.y * cT + centers[1].y,
  }));

  // Regular hexagon
  const radius = 0.8 + sRandom(7) * 0.5;
  const angH = (sRandom(8) * 360 * Math.PI) / 180;
  const hexagon: Point2D[] = [];
  for (let i = 0; i < 6; i++) {
    const a = angH + (i * 2 * Math.PI) / 6;
    hexagon.push({
      x: centers[2].x + radius * Math.cos(a),
      y: centers[2].y + radius * Math.sin(a),
    });
  }

  return { rectangle, triangle, hexagon };
}
