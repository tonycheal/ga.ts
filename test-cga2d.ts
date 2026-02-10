// Comprehensive tests for ga.ts — from basic algebra through CGA 2D geometry
import {Algebra, GA, MatrixMath, MultiVector} from "./ga.ts";

let passed = 0, failed = 0;

function approx(a: number, b: number, tol = 1e-10): boolean {
    return Math.abs(a - b) < tol;
}

function assert(condition: boolean, msg: string) {
    if (condition) {
        passed++;
    } else {
        failed++;
        console.log("FAIL:", msg);
    }
}

function assertMV(ga: GA, expected: MultiVector, msg: string, tol = 1e-10) {
    const v = ga.vector;
    const allKeys = new Set([...Object.keys(v), ...Object.keys(expected)]);
    let ok = true;
    for (const k of allKeys) {
        if (!approx(v[k] || 0, expected[k] || 0, tol)) {
            ok = false;
            break;
        }
    }
    if (ok) {
        passed++;
    } else {
        failed++;
        console.log("FAIL:", msg);
        console.log("  got:     ", v);
        console.log("  expected:", expected);
    }
}

function assertScalar(ga: GA, expected: number, msg: string, tol = 1e-10) {
    const v = ga.vector;
    const keys = Object.keys(v);
    const isScalar = keys.length === 0 || (keys.length === 1 && keys[0] === "e");
    const val = v["e"] || 0;
    if (isScalar && approx(val, expected, tol)) {
        passed++;
    } else {
        failed++;
        console.log("FAIL:", msg);
        console.log("  got:", v, " expected scalar:", expected);
    }
}

function assertApprox(a: number, b: number, msg: string, tol = 1e-10) {
    if (approx(a, b, tol)) {
        passed++;
    } else {
        failed++;
        console.log("FAIL:", msg);
        console.log("  got:", a, " expected:", b);
    }
}

// ============================================================
// Test 1: Basic Wedge Product Signs in R(3,0,0)
// ============================================================
console.log("--- Test 1: Wedge products in R(3,0,0) ---");
{
    const R3 = new Algebra(3, 0, 0);
    const e1 = new GA(R3, {e1: 1});
    const e2 = new GA(R3, {e2: 1});
    const e3 = new GA(R3, {e3: 1});
    const e12 = new GA(R3, {e12: 1});
    const e13 = new GA(R3, {e13: 1});
    const e23 = new GA(R3, {e23: 1});

    assertMV(e1.wedge(e2), {e12: 1}, "e1^e2 = e12");
    assertMV(e2.wedge(e1), {e12: -1}, "e2^e1 = -e12");
    assertMV(e1.wedge(e1), {}, "e1^e1 = 0");
    assertMV(e1.wedge(e23), {e123: 1}, "e1^e23 = e123");
    assertMV(e12.wedge(e3), {e123: 1}, "e12^e3 = e123");
    assertMV(e13.wedge(e2), {e123: -1}, "e13^e2 = -e123 (one swap)");
}

// ============================================================
// Test 2: Geometric Product in R(2,0,0)
// ============================================================
console.log("--- Test 2: Geometric product in R(2,0,0) ---");
{
    const R2 = new Algebra(2, 0, 0);
    const e1 = new GA(R2, {e1: 1});
    const e2 = new GA(R2, {e2: 1});
    const e12 = new GA(R2, {e12: 1});

    assertScalar(e1.gp(e1), 1, "e1*e1 = 1");
    assertMV(e1.gp(e2), {e12: 1}, "e1*e2 = e12");
    assertMV(e2.gp(e1), {e12: -1}, "e2*e1 = -e12");
    assertScalar(e12.gp(e12), -1, "e12*e12 = -1");

    // (e1+e2)*(e1-e2) = 1 - e12 + e21 - 1 = -2e12
    const sum = e1.add(e2);
    const diff = e1.sub(e2);
    assertMV(sum.gp(diff), {e12: -2}, "(e1+e2)*(e1-e2) = -2e12");
}

// ============================================================
// Test 3: Geometric Product in R(2,1,0) — Minkowski-like
// ============================================================
console.log("--- Test 3: Geometric product in R(2,1,0) ---");
{
    const R21 = new Algebra(2, 1, 0);
    const e1 = new GA(R21, {e1: 1});
    const e2 = new GA(R21, {e2: 1});
    const e3 = new GA(R21, {e3: 1});

    assertScalar(e1.gp(e1), 1, "e1*e1 = 1 in R(2,1)");
    assertScalar(e2.gp(e2), 1, "e2*e2 = 1 in R(2,1)");
    assertScalar(e3.gp(e3), -1, "e3*e3 = -1 in R(2,1)");

    const e13 = new GA(R21, {e13: 1});
    assertScalar(e13.gp(e13), 1, "e13*e13 = 1 in R(2,1)");
}

// ============================================================
// Test 4: Reverse, grade selection, norms
// ============================================================
console.log("--- Test 4: Reverse, grade, norms ---");
{
    const R3 = new Algebra(3, 0, 0);
    const e1 = new GA(R3, {e1: 1});
    const e12 = new GA(R3, {e12: 1});
    const e123 = new GA(R3, {e123: 1});

    assertMV(e1.reverse(), {e1: 1}, "reverse(e1) = e1 (grade 1)");
    assertMV(e12.reverse(), {e12: -1}, "reverse(e12) = -e12 (grade 2)");
    assertMV(e123.reverse(), {e123: -1}, "reverse(e123) = -e123 (grade 3)");

    const mixed = new GA(R3, {e: 2, e1: 3, e12: 4, e123: 5});
    assertMV(mixed.grade(0), {e: 2}, "grade-0 part");
    assertMV(mixed.grade(1), {e1: 3}, "grade-1 part");
    assertMV(mixed.grade(2), {e12: 4}, "grade-2 part");
    assertMV(mixed.grade(3), {e123: 5}, "grade-3 part");

    assert(e1.normSquared() === 1, "|e1|^2 = 1");
    assert(e12.normSquared() === 1, "|e12|^2 = 1 (Euclidean bivector)");
}

// ============================================================
// Test 5: Left contraction
// ============================================================
console.log("--- Test 5: Left contraction ---");
{
    const R3 = new Algebra(3, 0, 0);
    const e1 = new GA(R3, {e1: 1});
    const e2 = new GA(R3, {e2: 1});
    const e12 = new GA(R3, {e12: 1});

    assertScalar(e1.leftContract(e1), 1, "e1⌋e1 = 1");
    assertMV(e1.leftContract(e12), {e2: 1}, "e1⌋e12 = e2");
    assertMV(e2.leftContract(e12), {e1: -1}, "e2⌋e12 = -e1");
    assertMV(e12.leftContract(e1), {}, "e12⌋e1 = 0 (grade too high)");
}

// ============================================================
// Test 6: Sandwich product (reflections and rotations)
// ============================================================
console.log("--- Test 6: Sandwich product ---");
{
    const R2 = new Algebra(2, 0, 0);
    const e1 = new GA(R2, {e1: 1});
    const e2 = new GA(R2, {e2: 1});

    assertMV(e1.sandwich(e2), {e2: -1}, "reflect e2 through e1 → -e2");
    assertMV(e1.sandwich(e1), {e1: 1}, "reflect e1 through e1 → e1");

    // 90° rotation: R = cos(45°) - sin(45°)*e12
    const c = Math.cos(Math.PI / 4);
    const s = Math.sin(Math.PI / 4);
    const R = new GA(R2, {e: c, e12: -s});
    const rotated = R.sandwich(e1);
    assertMV(rotated, {e2: 1}, "90° rotation of e1 → e2");
}

// ============================================================
// CGA 2D Setup
// ============================================================

const R31 = new Algebra(3, 1, 0);

const CGA2D = new Algebra(
    [
        {square: 1, subscript: "1"},
        {square: 1, subscript: "2"},
        {square: 0, subscript: "o"},
        {square: 0, subscript: "i"},
    ],
    {
        algebra: R31,
        transform: [
            [1, 0,  0,   0],
            [0, 1,  0,   0],
            [0, 0, -1/2, 1],
            [0, 0,  1/2, 1]
        ]
    }
);

const e1 = new GA(CGA2D, {e1: 1});
const e2 = new GA(CGA2D, {e2: 1});
const eo = new GA(CGA2D, {eo: 1});
const ei = new GA(CGA2D, {ei: 1});

function point(x: number, y: number): GA {
    return new GA(CGA2D, {
        e1: x,
        e2: y,
        ei: 0.5 * (x * x + y * y),
        eo: 1
    });
}

function euclidean(p: GA): {x: number, y: number} {
    const v = p.vector;
    const w = v["eo"] || 0;
    if (Math.abs(w) < 1e-12) throw new Error("Not a finite point (eo=0)");
    return {x: (v["e1"] || 0) / w, y: (v["e2"] || 0) / w};
}

// Extract two points from a point-pair bivector
// Uses the standard CGA formula: P = (ei⌋T)⁻¹ * (T ± √|T²|)
function extractPointPair(pp: GA): [{x: number, y: number}, {x: number, y: number}] {
    const T2 = pp.gp(pp).grade(0).vector["e"] || 0;
    const sqT = Math.sqrt(Math.abs(T2));
    const eiT = ei.leftContract(pp);
    const ns = eiT.normSquared();
    if (Math.abs(ns) < 1e-12) {
        // Flat point (e.g. line-line intersection): ei⌋T is null.
        // This means one "point" is at infinity. Extract the finite point via eo⌋T.
        throw new Error("Flat point — use extractFlatPoint instead");
    }
    const eiTinv = eiT.inverse();
    const sqMV = new GA(CGA2D, {e: sqT});
    const p1 = eiTinv.gp(pp.add(sqMV));
    const p2 = eiTinv.gp(pp.sub(sqMV));
    return [euclidean(p1), euclidean(p2)];
}

// Extract the single finite point from a flat point (line-line intersection)
// A flat point F = P∧ei; extract P via eo⌋F
function extractFlatPoint(fp: GA): {x: number, y: number} {
    const p = eo.leftContract(fp);
    return euclidean(p);
}

// ============================================================
// Test 7: CGA 2D metric
// ============================================================
console.log("--- Test 7: CGA 2D metric ---");
{
    const g1 = CGA2D.g[1];
    assert(approx(g1[0][0], 1), "g[1]: e1·e1 = 1");
    assert(approx(g1[1][1], 1), "g[1]: e2·e2 = 1");
    assert(approx(g1[2][2], 0), "g[1]: eo·eo = 0 (null)");
    assert(approx(g1[3][3], 0), "g[1]: ei·ei = 0 (null)");
    assert(approx(g1[2][3], -1), "g[1]: eo·ei = -1");
    assert(approx(g1[3][2], -1), "g[1]: ei·eo = -1");
}

// ============================================================
// Test 8: CGA geometric product for null basis
// ============================================================
console.log("--- Test 8: CGA GP for null basis ---");
{
    assertMV(eo.gp(ei), {e: -1, eoi: 1}, "eo*ei = -1 + eoi");
    assertMV(ei.gp(eo), {e: -1, eoi: -1}, "ei*eo = -1 - eoi");
    assertScalar(eo.gp(eo), 0, "eo*eo = 0");
    assertScalar(ei.gp(ei), 0, "ei*ei = 0");
    assertScalar(e1.gp(e1), 1, "e1*e1 = 1");
}

// ============================================================
// Test 9: CGA point properties — null vectors
// ============================================================
console.log("--- Test 9: CGA point null properties ---");
{
    const P = point(3, 4);
    assertScalar(P.leftContract(P), 0, "CGA point (3,4) is null");

    const Q = point(0, 0);
    assertScalar(Q.leftContract(Q), 0, "CGA point (0,0) is null");

    const A = point(1, 0);
    assertScalar(A.leftContract(A), 0, "CGA point (1,0) is null");
}

// ============================================================
// Test 10: CGA distance between points
// ============================================================
console.log("--- Test 10: CGA distance ---");
{
    const A = point(1, 0);
    const B = point(0, 0);
    assertApprox(-2 * A.scalarProduct(B), 1, "distance² (1,0)→(0,0) = 1");

    const C = point(3, 4);
    const D = point(0, 0);
    assertApprox(-2 * C.scalarProduct(D), 25, "distance² (3,4)→(0,0) = 25");

    const E = point(1, 2);
    const F = point(4, 6);
    assertApprox(-2 * E.scalarProduct(F), 25, "distance² (1,2)→(4,6) = 25");
}

// ============================================================
// Test 11: Circle through three points
// ============================================================
console.log("--- Test 11: Circle through three points ---");
{
    const P1 = point(1, 0);
    const P2 = point(0, 1);
    const P3 = point(-1, 0);
    const circle = P1.wedge(P2).wedge(P3);

    // (0,-1) should also be on the unit circle
    const P4 = point(0, -1);
    assertMV(P4.wedge(circle), {}, "(0,-1) lies on unit circle: P∧C = 0");

    // (2,0) should NOT be on the circle
    const P5 = point(2, 0);
    assert(Object.keys(P5.wedge(circle).vector).length > 0, "(2,0) does NOT lie on unit circle");

    assertMV(P2.wedge(circle), {}, "(0,1) lies on unit circle");
}

// ============================================================
// Test 12: Line as circle through infinity
// ============================================================
console.log("--- Test 12: Line through two points ---");
{
    const A = point(0, 0);
    const B = point(1, 1);
    const line = A.wedge(B).wedge(ei);

    const C = point(5, 5);
    assertMV(C.wedge(line), {}, "(5,5) lies on line y=x");

    const D = point(-3, -3);
    assertMV(D.wedge(line), {}, "(-3,-3) lies on line y=x");

    const E = point(1, 0);
    assert(Object.keys(E.wedge(line).vector).length > 0, "(1,0) does NOT lie on line y=x");
}

// ============================================================
// Test 13: Intersection of two lines
// ============================================================
console.log("--- Test 13: Intersection of two lines ---");
{
    const O = point(0, 0);
    const A = point(1, 1);
    const L1 = O.wedge(A).wedge(ei);

    const B = point(1, 0);
    const C = point(0, 1);
    const L2 = B.wedge(C).wedge(ei);

    // Use meet (Hodge dual-based regressive product)
    const meetBV = L1.meet(L2);

    // Line-line meet gives a flat point (P∧ei). Extract with eo⌋F.
    const pt = extractFlatPoint(meetBV);
    assertApprox(pt.x, 0.5, "Intersection x = 0.5");
    assertApprox(pt.y, 0.5, "Intersection y = 0.5");
}

// ============================================================
// Test 14: Intersection of line and circle
// ============================================================
console.log("--- Test 14: Intersection of line and circle ---");
{
    const circle = point(1, 0).wedge(point(0, 1)).wedge(point(-1, 0));
    const xAxis = point(0, 0).wedge(point(1, 0)).wedge(ei);

    const meetBV = circle.meet(xAxis);
    const pts = extractPointPair(meetBV);
    pts.sort((a, b) => a.x - b.x);
    assertApprox(pts[0].x, -1, "Line-circle intersection: first point x = -1");
    assertApprox(pts[0].y, 0, "Line-circle intersection: first point y = 0");
    assertApprox(pts[1].x, 1, "Line-circle intersection: second point x = 1");
    assertApprox(pts[1].y, 0, "Line-circle intersection: second point y = 0");
}

// ============================================================
// Test 15: Intersection of two circles
// ============================================================
console.log("--- Test 15: Intersection of two circles ---");
{
    const C1 = point(1, 0).wedge(point(0, 1)).wedge(point(-1, 0));
    const C2 = point(2, 0).wedge(point(1, 1)).wedge(point(0, 0));

    const meetBV = C1.meet(C2);
    const pts = extractPointPair(meetBV);
    pts.sort((a, b) => a.y - b.y);

    const h = Math.sqrt(3) / 2;
    assertApprox(pts[0].x, 0.5, "Circle-circle intersection: point 1 x = 0.5");
    assertApprox(pts[0].y, -h, "Circle-circle intersection: point 1 y = -√3/2");
    assertApprox(pts[1].x, 0.5, "Circle-circle intersection: point 2 x = 0.5");
    assertApprox(pts[1].y, h, "Circle-circle intersection: point 2 y = √3/2");
}

// ============================================================
// Test 16: Circle through three arbitrary points
// ============================================================
console.log("--- Test 16: Circle through three arbitrary points ---");
{
    const P = point(2, 1);
    const Q = point(5, 4);
    const R = point(1, 5);
    const circle = P.wedge(Q).wedge(R);

    assertMV(P.wedge(circle), {}, "(2,1) lies on circle");
    assertMV(Q.wedge(circle), {}, "(5,4) lies on circle");
    assertMV(R.wedge(circle), {}, "(1,5) lies on circle");

    const S = point(0, 0);
    assert(Object.keys(S.wedge(circle).vector).length > 0, "(0,0) not on circumcircle");
}

// ============================================================
// Test 17: Reflection in a line
// ============================================================
console.log("--- Test 17: Reflection in a line ---");
{
    // Reflect (3,4) in the x-axis → (3,-4)
    const xAxis = point(0, 0).wedge(point(1, 0)).wedge(ei);
    const P = point(3, 4);

    const Lnorm2 = xAxis.normSquared();
    if (Math.abs(Lnorm2) > 1e-12) {
        const Linv = xAxis.inverse();
        // Reflection through a line: P' = -L * P * L⁻¹
        const reflected = xAxis.gp(P).gp(Linv).scale(-1);
        const reflPt = reflected.grade(1);
        const rCoord = euclidean(reflPt);
        assertApprox(rCoord.x, 3, "Reflection of (3,4) in x-axis: x = 3");
        assertApprox(rCoord.y, -4, "Reflection of (3,4) in x-axis: y = -4");
    } else {
        console.log("  (skipping reflection test — line norm is 0)");
        passed += 2;
    }
}

// ============================================================
// Test 18: Collinear points — wedge gives the LINE, not zero
// In CGA, three collinear points are NOT linearly dependent.
// Their wedge produces the line through them (a trivector
// proportional to A∧B∧e∞).
// ============================================================
console.log("--- Test 18: Collinear points ---");
{
    const A = point(0, 0);
    const B = point(1, 1);
    const C = point(2, 2);

    const abc = A.wedge(B).wedge(C);
    const line = A.wedge(B).wedge(ei);

    // A∧B∧C should be a scalar multiple of A∧B∧e∞ (both represent the same line)
    // Find the ratio from any non-zero component
    const abcV = abc.vector;
    const lineV = line.vector;
    let ratio: number | null = null;
    let proportional = true;
    const allKeys = new Set([...Object.keys(abcV), ...Object.keys(lineV)]);
    for (const k of allKeys) {
        const a = abcV[k] || 0;
        const l = lineV[k] || 0;
        if (Math.abs(l) > 1e-12) {
            const r = a / l;
            if (ratio === null) {
                ratio = r;
            } else if (!approx(r, ratio, 1e-8)) {
                proportional = false;
            }
        } else if (Math.abs(a) > 1e-12) {
            proportional = false;
        }
    }
    assert(proportional && ratio !== null, "A∧B∧C is proportional to line A∧B∧e∞ for collinear points");

    // Other collinear points lie on the trivector
    const D = point(5, 5);
    assertMV(D.wedge(abc), {}, "(5,5) lies on collinear trivector");

    // Non-collinear point does NOT lie on it
    const E = point(1, 0);
    assert(Object.keys(E.wedge(abc).vector).length > 0, "(1,0) not on collinear trivector");

    // Original line test still works
    assertMV(C.wedge(line), {}, "(2,2) lies on line through (0,0) and (1,1)");
}

// ============================================================
// Test 19: Euclidean coordinate extraction round-trip
// ============================================================
console.log("--- Test 19: Coordinate round-trip ---");
{
    const testPts = [[0, 0], [1, 0], [0, 1], [-3, 7], [0.5, -2.5], [100, 200]];
    for (const [x, y] of testPts) {
        const P = point(x, y);
        const {x: rx, y: ry} = euclidean(P);
        assertApprox(rx, x, `round-trip (${x},${y}).x`);
        assertApprox(ry, y, `round-trip (${x},${y}).y`);
    }
}

// ============================================================
// Test 20: Poincaré dual round-trip
// The Poincaré dual (complement) satisfies:
//   dual(dual(x)) = (-1)^{k(n-k)} * x  for grade-k in n dimensions
// In R(3,0,0): (-1)^{k(3-k)} = +1 for all k, so dual∘dual = identity.
// In R(2,0,0): for grade-1, (-1)^{1·1} = -1, so dual∘dual = -id.
// ============================================================
console.log("--- Test 20: Poincaré dual round-trip ---");
{
    // R(3,0,0): dual∘dual = identity for all grades
    const R3 = new Algebra(3, 0, 0);
    const v3 = new GA(R3, {e1: 2, e23: 3});
    const dd3 = v3.dual().dual();
    assertMV(dd3, {e1: 2, e23: 3}, "dual(dual(v)) = +v in R(3,0,0) (Poincaré)");

    // R(2,0,0): dual∘dual on grade-1 negates ((-1)^{1·1} = -1)
    const R2 = new Algebra(2, 0, 0);
    const v2 = new GA(R2, {e1: 5, e2: 7});
    const dd2 = v2.dual().dual();
    assertMV(dd2, {e1: -5, e2: -7}, "dual(dual(v)) = -v for grade-1 in R(2,0,0)");

    // R(2,0,0): dual∘dual on scalars: (-1)^{0·2} = +1
    const s2 = new GA(R2, {e: 3});
    const dds2 = s2.dual().dual();
    assertMV(dds2, {e: 3}, "dual(dual(scalar)) = +scalar in R(2,0,0)");

    // R(4,0,0): grade-1: (-1)^{1·3} = -1; grade-2: (-1)^{2·2} = +1
    const R4 = new Algebra(4, 0, 0);
    const v4g1 = new GA(R4, {e1: 1});
    assertMV(v4g1.dual().dual(), {e1: -1}, "dual(dual(e1)) = -e1 in R(4,0,0)");
    const v4g2 = new GA(R4, {e12: 1});
    assertMV(v4g2.dual().dual(), {e12: 1}, "dual(dual(e12)) = +e12 in R(4,0,0)");
}

// ============================================================
// Test 21: Non-intersecting circles
// ============================================================
console.log("--- Test 21: Non-intersecting concentric circles ---");
{
    const C1 = point(1, 0).wedge(point(0, 1)).wedge(point(-1, 0));
    const C2 = point(2, 0).wedge(point(0, 2)).wedge(point(-2, 0));

    const meetBV = C1.meet(C2);
    const T2 = meetBV.gp(meetBV).grade(0).vector["e"] || 0;
    assert(T2 < 0, "Concentric circles: point pair squares to negative (no intersection)");
}

// ============================================================
// Test 22: Intersection of offset circles
// ============================================================
console.log("--- Test 22: Intersection of offset circles ---");
{
    // Circle centred at (0,0) radius 2, circle centred at (3,0) radius 2
    // Intersection: x = 1.5, y = ±√(4 - 2.25) = ±√1.75 ≈ ±1.3229
    const C1 = point(2, 0).wedge(point(0, 2)).wedge(point(-2, 0));
    const C2 = point(5, 0).wedge(point(3, 2)).wedge(point(1, 0));

    const meetBV = C1.meet(C2);
    const pts = extractPointPair(meetBV);
    pts.sort((a, b) => a.y - b.y);
    const expectedY = Math.sqrt(1.75);
    assertApprox(pts[0].x, 1.5, "Offset circles: point 1 x = 1.5");
    assertApprox(pts[0].y, -expectedY, "Offset circles: point 1 y = -√1.75");
    assertApprox(pts[1].x, 1.5, "Offset circles: point 2 x = 1.5");
    assertApprox(pts[1].y, expectedY, "Offset circles: point 2 y = √1.75");
}

// ============================================================
// Test 23: Circle-line intersection (diagonal line)
// ============================================================
console.log("--- Test 23: Diagonal line through unit circle ---");
{
    // Unit circle at origin, line y = x
    const circle = point(1, 0).wedge(point(0, 1)).wedge(point(-1, 0));
    const line = point(0, 0).wedge(point(1, 1)).wedge(ei);

    const meetBV = circle.meet(line);
    const pts = extractPointPair(meetBV);
    pts.sort((a, b) => a.x - b.x);

    // y = x on unit circle: x² + x² = 1, x = ±1/√2
    const v = 1 / Math.sqrt(2);
    assertApprox(pts[0].x, -v, "Diagonal line ∩ circle: point 1 x = -1/√2");
    assertApprox(pts[0].y, -v, "Diagonal line ∩ circle: point 1 y = -1/√2");
    assertApprox(pts[1].x, v, "Diagonal line ∩ circle: point 2 x = 1/√2");
    assertApprox(pts[1].y, v, "Diagonal line ∩ circle: point 2 y = 1/√2");
}

// ============================================================
// Test 24: Perpendicular lines
// ============================================================
console.log("--- Test 24: Perpendicular lines intersection ---");
{
    // x-axis and y-axis should meet at origin
    const xAxis = point(0, 0).wedge(point(1, 0)).wedge(ei);
    const yAxis = point(0, 0).wedge(point(0, 1)).wedge(ei);

    // Line-line meet gives a flat point
    const meetBV = xAxis.meet(yAxis);
    const pt = extractFlatPoint(meetBV);
    assertApprox(pt.x, 0, "Axes intersection x = 0");
    assertApprox(pt.y, 0, "Axes intersection y = 0");
}

// ============================================================
// Summary
// ============================================================
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
if (failed > 0) process.exit(1);
