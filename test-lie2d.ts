// Tests for lie2d.ts — Lie sphere geometry of oriented cycles in the plane.
import {LIE2D, cycle, point, line, infinity, inner, isCycle, inContact,
        cosAngle, normalise, decode, toCGA, e1, e2, eo, ei, er} from "./lie2d.ts";
import {GA} from "./ga.ts";

let passed = 0, failed = 0;
const approx = (a: number, b: number, tol = 1e-9) => Math.abs(a - b) < tol;
function assert(ok: boolean, msg: string) {
    if (ok) { passed++; } else { failed++; console.log("FAIL:", msg); }
}
function assertApprox(a: number, b: number, msg: string, tol = 1e-9) {
    if (approx(a, b, tol)) { passed++; }
    else { failed++; console.log("FAIL:", msg, "\n  got:", a, " expected:", b); }
}

console.log("--- Test 1: the metric ---");
{
    const g = LIE2D.g[1];   // order: e1 e2 eo ei er
    assertApprox(g[0][0],  1, "e1.e1 = 1");
    assertApprox(g[1][1],  1, "e2.e2 = 1");
    assertApprox(g[2][2],  0, "eo.eo = 0");
    assertApprox(g[3][3],  0, "ei.ei = 0");
    assertApprox(g[2][3], -1, "eo.ei = -1");
    assertApprox(g[4][4], -1, "er.er = -1");
    assertApprox(g[0][4],  0, "e1.er = 0");
    assertApprox(g[2][4],  0, "eo.er = 0");
}

console.log("--- Test 2: every cycle is null ---");
{
    for (const [n, c] of [
        ["circle(0,0,2)",  cycle(0, 0, 2)],
        ["circle(5,-1,3)", cycle(5, -1, 3)],
        ["circle(5,-1,-3) (opposite sense)", cycle(5, -1, -3)],
        ["point(1,7)",     point(1, 7)],
        ["line(0,1,3)",    line(0, 1, 3)],
        ["line(3,4,-2)",   line(3, 4, -2, true)],
        ["infinity",       infinity],
    ] as [string, GA][]) {
        assertApprox(inner(c, c), 0, `${n} is null`);
        assert(isCycle(c), `${n} passes isCycle`);
    }
}

console.log("--- Test 3: inner product = -1/2 (d^2 - (r1-r2)^2) ---");
{
    const cases: [number, number, number, number, number, number][] = [
        [0, 0, 2,  5, 0, 1],
        [0, 0, 2,  5, 0, -1],
        [3, 4, 3,  1, 7, 0],
        [1, 1, 0, -2, 5, 0],
    ];
    for (const [x1, y1, r1, x2, y2, r2] of cases) {
        const d2 = (x1 - x2) ** 2 + (y1 - y2) ** 2;
        assertApprox(inner(cycle(x1, y1, r1), cycle(x2, y2, r2)),
                     -0.5 * (d2 - (r1 - r2) ** 2),
                     `inner (${x1},${y1},${r1}) . (${x2},${y2},${r2})`);
    }
}

console.log("--- Test 4: oriented contact ---");
{
    // Two circles, radii 2 and 1, centres 3 apart: externally tangent.
    const A = cycle(0, 0, 2), B = cycle(3, 0, 1);
    // External tangency needs *opposite* orientations in Lie geometry.
    assert(!inContact(A, B),                "same sense: r=2 and r=1 at d=3 not in contact");
    assert(inContact(A, cycle(3, 0, -1)),   "opposite sense: externally tangent");
    // Internally tangent: radii 3 and 1, centres 2 apart, same sense.
    assert(inContact(cycle(0, 0, 3), cycle(2, 0, 1)), "same sense: internally tangent");
    // A point on a circle is in contact with it, either orientation.
    assert(inContact(cycle(0, 0, 2), point(2, 0)),  "point on circle");
    assert(inContact(cycle(0, 0, -2), point(2, 0)), "point on circle, other sense");
    // A line tangent to a circle.
    assert(inContact(cycle(0, 3, 3), line(0, 1, 0)),  "y=0 tangent to circle at (0,3) r=3");
    assert(!inContact(cycle(0, 3, 3), line(0, 1, 1)), "y=1 is not tangent");
    // Every cycle is in contact with infinity iff it is a line.
    assert(inContact(line(0, 1, 3), infinity),  "lines pass through infinity");
    assert(!inContact(cycle(0, 0, 2), infinity), "circles do not");
}

console.log("--- Test 5: crossing angle ---");
{
    // Two unit circles whose centres are sqrt(2) apart cross at 90 degrees.
    assertApprox(cosAngle(cycle(0, 0, 1), cycle(Math.SQRT2, 0, 1)), 0, "orthogonal circles");
    // Tangent, same sense -> cos = 1; flip one -> cos = -1.
    assertApprox(cosAngle(cycle(0, 0, 3), cycle(2, 0, 1)),  1, "internal tangency, cos = 1");
    assertApprox(cosAngle(cycle(0, 0, 3), cycle(2, 0, -1)), -1, "flip one: cos = -1");
    // 60 degrees: d^2 = r1^2 + r2^2 - 2 r1 r2 cos60 = 1 + 1 - 1 = 1
    assertApprox(cosAngle(cycle(0, 0, 1), cycle(1, 0, 1)), 0.5, "60 degrees");
    // Reversing BOTH cycles leaves the angle alone.
    assertApprox(cosAngle(cycle(0, 0, -1), cycle(1, 0, -1)), 0.5, "both reversed: unchanged");
}

console.log("--- Test 6: orientation is the sign of er ---");
{
    const c = cycle(2, 3, 4);
    const flipped = c.scale(-1);                    // projectively the same point...
    assertApprox(normalise(flipped).vector.er ?? 0, 4, "scaling by -1 does NOT flip orientation");
    const opposite = cycle(2, 3, -4);
    assertApprox(opposite.vector.er ?? 0, -4, "opposite cycle has er = -r");
    // ...so a cycle and its reverse are genuinely different Lie vectors,
    // not two scalings of one. This is exactly what CGA cannot express.
    assert(!inContact(cycle(0, 0, 1), cycle(2, 0, 1)) !==
           !inContact(cycle(0, 0, 1), cycle(2, 0, -1)),
           "orientation changes the tangency answer");
}

console.log("--- Test 6b: homogeneity and line orientation ---");
{
    // A Lie vector is a point of projective space: k*X is the SAME object for
    // every k, negative included.
    const C = cycle(3, 4, 2);
    for (const k of [2, 0.1, -1, -7]) {
        const d = decode(C.scale(k));
        assert(d.kind === "circle" && approx(d.x, 3) && approx(d.y, 4) && approx(d.r, 2),
               `scaling by ${k} leaves the object alone`);
    }
    // ...so orientation can never be the overall sign. For a line it is er
    // alone: negating the whole vector gives back the same line.
    const L = line(0, 1, 3);
    const negated = L.scale(-1);
    assert(inContact(cycle(0, 5, 2), L) === inContact(cycle(0, 5, 2), negated),
           "negating a whole line changes nothing");
    // Reversing er really does swap which side it touches.
    const above = cycle(0, 5, 2), below = cycle(0, 1, 2);
    assert(inContact(above, line(0, 1, 3)),        "r=2 at (0,5) touches the line from above");
    assert(!inContact(below, line(0, 1, 3)),       "...and (0,1) does not");
    assert(!inContact(above, line(0, 1, 3, true)), "reversed: (0,5) no longer touches");
    assert(inContact(below, line(0, 1, 3, true)),  "reversed: (0,1) now does");
}

console.log("--- Test 7: decode round-trips ---");
{
    const c = decode(cycle(3, -4, 2.5));
    assert(c.kind === "circle" && approx(c.x, 3) && approx(c.y, -4) && approx(c.r, 2.5),
           "circle round-trip");
    const p = decode(point(1, 7));
    assert(p.kind === "point" && approx(p.x, 1) && approx(p.y, 7), "point round-trip");
    const l = decode(line(0, 1, 3));
    assert(l.kind === "line" && approx(l.nx, 0) && approx(l.ny, 1) && approx(l.d, 3),
           "line round-trip");
    // Reversing a line reverses its normal — there is no separate flip flag.
    const lf = decode(line(0, 1, 3, true));
    assert(lf.kind === "line" && approx(lf.nx, 0) && approx(lf.ny, -1) && approx(lf.d, -3),
           "reversed line round-trip: the normal turns round");
    assert(decode(infinity).kind === "infinity", "infinity round-trip");
    // Homogeneity: any positive scaling decodes the same.
    const s = decode(cycle(3, -4, 2.5).scale(7));
    assert(s.kind === "circle" && approx(s.x, 3) && approx(s.r, 2.5), "scale-invariant decode");
}

console.log("--- Test 8: CGA 2D sits inside Lie ---");
{
    // Dropping er from a Lie point gives exactly the CGA 2D point.
    const cga = toCGA(point(3, 4));
    assertApprox(cga.e1 ?? 0, 3,    "CGA e1");
    assertApprox(cga.e2 ?? 0, 4,    "CGA e2");
    assertApprox(cga.eo ?? 0, 1,    "CGA eo");
    assertApprox(cga.ei ?? 0, 12.5, "CGA ei = (x^2+y^2)/2");
    // Distance between points is the same in both: d^2 = -2 (P . Q)
    assertApprox(-2 * inner(point(0, 0), point(3, 4)), 25, "squared distance");
}

console.log("--- Test 9: wedge grades behave ---");
{
    assertApprox(LIE2D.degree, 5, "5-dimensional algebra");
    assertApprox(LIE2D.basis.length, 32, "32 basis elements");
    const pencil = point(0, 0).wedge(point(1, 0));
    assertApprox(LIE2D.gradeOfBasis(Object.keys(pencil.vector)[0]), 2, "wedge of two cycles is grade 2");
}

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
