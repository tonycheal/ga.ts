// Lie sphere geometry for the plane: the algebra of *oriented* cycles.
//
// CGA 2D (see test-cga2d.ts) represents points, lines and circles in R(3,1).
// It has no room for orientation: a circle and the same circle traversed the
// other way are the same multivector, and tangency is unsigned.
//
// Lie sphere geometry adds one more basis vector, er (er^2 = -1), carrying the
// *signed* radius. The algebra is R(3,2), five dimensions, and the objects are
// oriented cycles: circles with a sense, lines with a side, points, and the
// point at infinity. See LIESPHERE.md for why this matters for Apollonius.
//
// Key facts, all exercised in test-lie2d.ts:
//   - every cycle is a null vector:  X * X = 0
//   - X . Y = -1/2 ( d^2 - (r1 - r2)^2 )  for two cycles distance d apart
//   - X . Y = 0  <=>  X and Y are in *oriented* contact
//   - more generally  X . Y  measures the angle of intersection (see cosAngle)

import {Algebra, GA, type MultiVector} from "./ga.ts";

// Parent: orthogonal R(3,2) — squares [1, 1, 1, -1, -1]
export const R32 = new Algebra(3, 2, 0);

// Child: null basis {e1, e2, eo, ei} as in CGA 2D, plus er for oriented radius.
// eo = 1/2 (e4 - e3), ei = e3 + e4, er = e5.
export const LIE2D = new Algebra(
    [
        {square:  1, subscript: "1"},
        {square:  1, subscript: "2"},
        {square:  0, subscript: "o"},   // origin
        {square:  0, subscript: "i"},   // infinity
        {square: -1, subscript: "r"},   // oriented radius
    ],
    {
        algebra: R32,
        transform: [
            [1, 0,    0, 0, 0],
            [0, 1,    0, 0, 0],
            [0, 0, -1/2, 1, 0],
            [0, 0,  1/2, 1, 0],
            [0, 0,    0, 0, 1],
        ]
    }
);

export const e1 = new GA(LIE2D, {e1: 1});
export const e2 = new GA(LIE2D, {e2: 1});
export const eo = new GA(LIE2D, {eo: 1});
export const ei = new GA(LIE2D, {ei: 1});
export const er = new GA(LIE2D, {er: 1});

/**
 * An oriented circle of signed radius r centred at (x, y).
 * The sign of r is the orientation; r = 0 gives a point.
 */
export function cycle(x: number, y: number, r: number = 0): GA {
    return new GA(LIE2D, {
        e1: x,
        e2: y,
        eo: 1,
        ei: (x * x + y * y - r * r) / 2,
        er: r,
    });
}

/** A point — a cycle of zero radius, and the CGA point embedded in Lie space. */
export function point(x: number, y: number): GA {
    return cycle(x, y, 0);
}

/**
 * An oriented line: unit normal (nx, ny), signed distance d from the origin,
 * so the line is { p : p . n = d }. A line is the cycle with no eo component —
 * a circle of infinite radius — and orientation is er = +-1.
 *
 * Note: `flip` negates ONLY er. Negating the whole vector would produce the
 * SAME projective point, i.e. the same line, and so would do nothing at all.
 * Orientation is never the overall sign — see normalise().
 */
export function line(nx: number, ny: number, d: number, flip = false): GA {
    const l = Math.hypot(nx, ny);
    return new GA(LIE2D, {
        e1: nx / l,
        e2: ny / l,
        eo: 0,
        ei: d,
        er: flip ? -1 : 1,
    });
}

/** The point at infinity — the one cycle that is neither a circle nor a line. */
export const infinity = new GA(LIE2D, {ei: 1});

/** The Lie inner product. Zero means oriented contact. */
export function inner(a: GA, b: GA): number {
    return LIE2D.scalarProduct(a.vector, b.vector);
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
 * This is the continuous quantity of which Apollonius's boolean "flip" flags
 * are the +-1 endpoints. Requires both cycles to be proper (non-null radius).
 */
export function cosAngle(a: GA, b: GA): number {
    const A = normalise(a), B = normalise(b);
    const ra = A.vector.er ?? 0, rb = B.vector.er ?? 0;
    if (ra === 0 || rb === 0) {
        throw new Error("cosAngle needs two cycles of non-zero radius");
    }
    // Two cycles crossing at theta satisfy d^2 = ra^2 + rb^2 - 2 ra rb cos(theta),
    // and X . Y = -1/2 (d^2 - (ra - rb)^2), so X . Y = ra rb (cos(theta) - 1).
    return inner(A, B) / (ra * rb) + 1;
}

/**
 * Scale a cycle to canonical form: eo = 1 for circles and points, er = 1 for
 * lines. Lie vectors are homogeneous — k*X is the same object for EVERY k,
 * negative included — so this picks one representative per object.
 *
 * Both divisors are signed, deliberately. Dividing a line by |er| would keep
 * X and -X apart when they are the same line, and dividing a circle by |eo|
 * would do the same. After normalising, a line always has er = +1 and its
 * orientation is carried by the direction of its unit normal.
 */
export function normalise(a: GA): GA {
    const v = a.vector;
    const o = v.eo ?? 0;
    if (Math.abs(o) > 1e-12) return a.scale(1 / o);
    const r = v.er ?? 0;
    if (Math.abs(r) > 1e-12) return a.scale(1 / r);
    const n = Math.hypot(v.e1 ?? 0, v.e2 ?? 0);
    return n > 1e-12 ? a.scale(1 / n) : a;
}

export type Cycle =
    | {kind: "circle"; x: number; y: number; r: number}
    | {kind: "point";  x: number; y: number}
    | {kind: "line";   nx: number; ny: number; d: number}
    | {kind: "infinity"};

/** Read a Lie vector back as ordinary plane geometry. */
export function decode(a: GA, tol = 1e-9): Cycle {
    const v = normalise(a).vector;
    const o = v.eo ?? 0;
    if (Math.abs(o) > tol) {
        const x = v.e1 ?? 0, y = v.e2 ?? 0, r = v.er ?? 0;
        return Math.abs(r) < tol ? {kind: "point", x, y} : {kind: "circle", x, y, r};
    }
    // After normalise a line has er = +1, so the unit normal's direction is the
    // orientation. There is no separate flip flag: reversing a line reverses
    // its normal.
    const nx = v.e1 ?? 0, ny = v.e2 ?? 0;
    if (Math.hypot(nx, ny) < tol) return {kind: "infinity"};
    return {kind: "line", nx, ny, d: v.ei ?? 0};
}

/**
 * The orientation direction of a decoded line is MINUS its normal.
 *
 * `decode` returns the honest description of *which* line this is —
 * `{ p : p . n = d }` — and that is what `nx, ny` mean. But a line is the
 * r -> infinity limit of a circle, and the direction playing the role of the
 * circle's outward normal is `-n`, not `n`:
 *
 *   cycle(0, 1, +1) and line(0, 1, 0) are in oriented contact (X . Y = 0),
 *   they touch at the origin, and the circle's outward normal there is (0,-1).
 *
 * The Laguerre shear agrees: adding d to every radius grows a positive circle
 * outwards and moves this line from `d` to `d - delta`, i.e. along `-n`.
 *
 * Anything drawing or reasoning about which side a line faces wants `-n`.
 */

/** Drop the orientation coordinate to get the corresponding CGA 2D vector. */
export function toCGA(a: GA): MultiVector {
    const {e1: x = 0, e2: y = 0, eo: o = 0, ei: i = 0} = a.vector;
    return {e1: x, e2: y, eo: o, ei: i};
}
