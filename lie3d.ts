// Lie sphere geometry for space: the algebra of *oriented* spheres.
//
// This file is `lie2d.ts` with e3 inserted and nothing else changed. That is
// the claim ROADMAP.md makes about going up a dimension, and keeping the two
// files side by side is how it stays honest: if this ever needs a special case
// the 2D version does not have, the design was too flat.
//
// The algebra is R(4,2), six dimensions, 64 basis elements. Objects are
// oriented spheres, oriented planes, points, and the point at infinity.
//
// Key facts, all exercised in test-lie3d.ts — and note they are word for word
// the ones in lie2d.ts:
//   - every cycle is a null vector:  X * X = 0
//   - X . Y = -1/2 ( d^2 - (r1 - r2)^2 )  for two cycles distance d apart
//   - X . Y = 0  <=>  X and Y are in *oriented* contact
//   - more generally  X . Y  measures the angle of intersection (see cosAngle)

import {Algebra, GA, type MultiVector} from "./ga.ts";

// Parent: orthogonal R(4,2) — squares [1, 1, 1, 1, -1, -1]
export const R42 = new Algebra(4, 2, 0);

// Child: null basis {e1, e2, e3, eo, ei} as in CGA 3D, plus er.
// eo = 1/2 (e5 - e4), ei = e4 + e5, er = e6.
export const LIE3D = new Algebra(
    [
        {square:  1, subscript: "1"},
        {square:  1, subscript: "2"},
        {square:  1, subscript: "3"},
        {square:  0, subscript: "o"},   // origin
        {square:  0, subscript: "i"},   // infinity
        {square: -1, subscript: "r"},   // oriented radius
    ],
    {
        algebra: R42,
        transform: [
            [1, 0, 0,    0, 0, 0],
            [0, 1, 0,    0, 0, 0],
            [0, 0, 1,    0, 0, 0],
            [0, 0, 0, -1/2, 1, 0],
            [0, 0, 0,  1/2, 1, 0],
            [0, 0, 0,    0, 0, 1],
        ]
    }
);

export const e1 = new GA(LIE3D, {e1: 1});
export const e2 = new GA(LIE3D, {e2: 1});
export const e3 = new GA(LIE3D, {e3: 1});
export const eo = new GA(LIE3D, {eo: 1});
export const ei = new GA(LIE3D, {ei: 1});
export const er = new GA(LIE3D, {er: 1});

/**
 * An oriented sphere of signed radius r centred at (x, y, z).
 * The sign of r is the orientation; r = 0 gives a point.
 */
export function cycle(x: number, y: number, z: number, r: number = 0): GA {
    return new GA(LIE3D, {
        e1: x,
        e2: y,
        e3: z,
        eo: 1,
        ei: (x * x + y * y + z * z - r * r) / 2,
        er: r,
    });
}

/** A point — a sphere of zero radius. */
export function point(x: number, y: number, z: number): GA {
    return cycle(x, y, z, 0);
}

/**
 * An oriented plane: unit normal (nx, ny, nz), signed distance d from the
 * origin, so the plane is { p : p . n = d }. A plane is the cycle with no eo
 * component — a sphere of infinite radius — and orientation is er = +-1.
 *
 * As in 2D, `flip` negates ONLY er. Negating the whole vector would give the
 * same projective point, i.e. the same plane, and so would do nothing.
 */
export function plane(nx: number, ny: number, nz: number, d: number, flip = false): GA {
    const l = Math.hypot(nx, ny, nz);
    return new GA(LIE3D, {
        e1: nx / l,
        e2: ny / l,
        e3: nz / l,
        eo: 0,
        ei: d,
        er: flip ? -1 : 1,
    });
}

/** The point at infinity. */
export const infinity = new GA(LIE3D, {ei: 1});

/** The Lie inner product. Zero means oriented contact. */
export function inner(a: GA, b: GA): number {
    return LIE3D.scalarProduct(a.vector, b.vector);
}

/** Is this multivector a cycle at all? Cycles are exactly the null vectors. */
export function isCycle(a: GA, tol = 1e-9): boolean {
    return Math.abs(inner(a, a)) < tol;
}

/** Are two cycles in oriented contact (tangent, with matching sense)? */
export function inContact(a: GA, b: GA, tol = 1e-9): boolean {
    return Math.abs(inner(a, b)) < tol;
}

/**
 * The cosine of the angle at which two cycles cross.
 *   +1  oriented contact (tangent, same sense)
 *    0  orthogonal
 *   -1  tangent, opposite sense
 */
export function cosAngle(a: GA, b: GA): number {
    const A = normalise(a), B = normalise(b);
    const ra = A.vector.er ?? 0, rb = B.vector.er ?? 0;
    if (ra === 0 || rb === 0) {
        throw new Error("cosAngle needs two cycles of non-zero radius");
    }
    return inner(A, B) / (ra * rb) + 1;
}

/**
 * Scale a cycle to canonical form: eo = 1 for spheres and points, er = 1 for
 * planes. Both divisors are signed — k*X is the same object for EVERY k,
 * negative included, so dividing by |er| would keep X and -X apart when they
 * are the same plane.
 */
export function normalise(a: GA): GA {
    const v = a.vector;
    const o = v.eo ?? 0;
    if (Math.abs(o) > 1e-12) return a.scale(1 / o);
    const r = v.er ?? 0;
    if (Math.abs(r) > 1e-12) return a.scale(1 / r);
    const n = Math.hypot(v.e1 ?? 0, v.e2 ?? 0, v.e3 ?? 0);
    return n > 1e-12 ? a.scale(1 / n) : a;
}

export type Cycle =
    | {kind: "sphere"; x: number; y: number; z: number; r: number}
    | {kind: "point";  x: number; y: number; z: number}
    | {kind: "plane";  nx: number; ny: number; nz: number; d: number}
    | {kind: "infinity"};

/** Read a Lie vector back as ordinary solid geometry. */
export function decode(a: GA, tol = 1e-9): Cycle {
    const v = normalise(a).vector;
    const o = v.eo ?? 0;
    if (Math.abs(o) > tol) {
        const x = v.e1 ?? 0, y = v.e2 ?? 0, z = v.e3 ?? 0, r = v.er ?? 0;
        return Math.abs(r) < tol ? {kind: "point", x, y, z} : {kind: "sphere", x, y, z, r};
    }
    // After normalise a plane has er = +1, so the unit normal's direction is
    // the orientation. There is no separate flip flag.
    const nx = v.e1 ?? 0, ny = v.e2 ?? 0, nz = v.e3 ?? 0;
    if (Math.hypot(nx, ny, nz) < tol) return {kind: "infinity"};
    return {kind: "plane", nx, ny, nz, d: v.ei ?? 0};
}

/**
 * The orientation direction of a decoded plane is MINUS its normal.
 *
 * `decode` returns the honest description of *which* plane this is —
 * `{ p : p . n = d }` — and that is what `nx, ny` mean. But a plane is the
 * r -> infinity limit of a circle, and the direction playing the role of the
 * circle's outward normal is `-n`, not `n`:
 *
 *   cycle(0, 1, 0, +1) and plane(0, 1, 0, 0) are in oriented contact (X . Y = 0),
 *   they touch at the origin, and the sphere's outward normal there is (0,-1,0).
 *
 * The Laguerre shear agrees: adding d to every radius grows a positive sphere
 * outwards and moves this plane from `d` to `d - delta`, i.e. along `-n`.
 *
 * Anything drawing or reasoning about which side a plane faces wants `-n`.
 */

/** Drop the orientation coordinate to get the corresponding CGA 3D vector. */
export function toCGA(a: GA): MultiVector {
    const {e1: x = 0, e2: y = 0, e3: z = 0, eo: o = 0, ei: i = 0} = a.vector;
    return {e1: x, e2: y, e3: z, eo: o, ei: i};
}
