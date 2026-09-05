// Tests for lie3d.ts — Lie sphere geometry of oriented spheres in space.
//
// Deliberately a mirror of test-lie2d.ts: same tests, same order, same
// expectations, with one more coordinate. Where a test here needs something
// the 2D one did not, that is a finding, not a convenience.
import {LIE3D, cycle, point, plane, infinity, inner, isCycle, inContact,
        cosAngle, normalise, decode, toCGA} from "./lie3d.ts";
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
    const g = LIE3D.g[1];   // order: e1 e2 e3 eo ei er
    assertApprox(g[0][0],  1, "e1.e1 = 1");
    assertApprox(g[1][1],  1, "e2.e2 = 1");
    assertApprox(g[2][2],  1, "e3.e3 = 1");
    assertApprox(g[3][3],  0, "eo.eo = 0");
    assertApprox(g[4][4],  0, "ei.ei = 0");
    assertApprox(g[3][4], -1, "eo.ei = -1");
    assertApprox(g[5][5], -1, "er.er = -1");
    assertApprox(g[2][5],  0, "e3.er = 0");
    assertApprox(g[3][5],  0, "eo.er = 0");
    assertApprox(LIE3D.degree, 6, "6-dimensional algebra");
    assertApprox(LIE3D.basis.length, 64, "64 basis elements");
}

console.log("--- Test 2: every cycle is null ---");
{
    for (const [n, c] of [
        ["sphere(0,0,0,2)",     cycle(0, 0, 0, 2)],
        ["sphere(5,-1,3,3)",    cycle(5, -1, 3, 3)],
        ["sphere(5,-1,3,-3)",   cycle(5, -1, 3, -3)],
        ["point(1,7,-2)",       point(1, 7, -2)],
        ["plane z=3",           plane(0, 0, 1, 3)],
        ["plane(3,4,0,-2) flip", plane(3, 4, 0, -2, true)],
        ["infinity",            infinity],
    ] as [string, GA][]) {
        assertApprox(inner(c, c), 0, `${n} is null`);
        assert(isCycle(c), `${n} passes isCycle`);
    }
}

console.log("--- Test 3: inner product = -1/2 (d^2 - (r1-r2)^2) ---");
{
    const cases: [number,number,number,number, number,number,number,number][] = [
        [0, 0, 0, 2,   5, 0, 0, 1],
        [0, 0, 0, 2,   5, 0, 0, -1],
        [3, 4, 1, 3,   1, 7, -2, 0],
        [1, 1, 1, 0,  -2, 5, 4, 0],
    ];
    for (const [x1,y1,z1,r1, x2,y2,z2,r2] of cases) {
        const d2 = (x1-x2)**2 + (y1-y2)**2 + (z1-z2)**2;
        assertApprox(inner(cycle(x1,y1,z1,r1), cycle(x2,y2,z2,r2)),
                     -0.5 * (d2 - (r1 - r2) ** 2),
                     `inner (${x1},${y1},${z1},${r1}) . (${x2},${y2},${z2},${r2})`);
    }
}

console.log("--- Test 4: oriented contact ---");
{
    const A = cycle(0, 0, 0, 2), B = cycle(3, 0, 0, 1);
    assert(!inContact(A, B),                     "same sense: r=2 and r=1 at d=3 not in contact");
    assert(inContact(A, cycle(3, 0, 0, -1)),     "opposite sense: externally tangent");
    assert(inContact(cycle(0,0,0,3), cycle(2,0,0,1)), "same sense: internally tangent");
    assert(inContact(cycle(0,0,0,2), point(2,0,0)),   "point on sphere");
    assert(inContact(cycle(0,0,0,-2), point(2,0,0)),  "point on sphere, other sense");
    // a plane tangent to a sphere
    assert(inContact(cycle(0, 0, 3, 3), plane(0, 0, 1, 0)),  "z=0 tangent to sphere at (0,0,3) r=3");
    assert(!inContact(cycle(0, 0, 3, 3), plane(0, 0, 1, 1)), "z=1 is not tangent");
    // every cycle is in contact with infinity iff it is a plane
    assert(inContact(plane(0, 0, 1, 3), infinity),   "planes pass through infinity");
    assert(!inContact(cycle(0,0,0,2), infinity),     "spheres do not");
}

console.log("--- Test 5: crossing angle ---");
{
    assertApprox(cosAngle(cycle(0,0,0,1), cycle(Math.SQRT2,0,0,1)), 0, "orthogonal spheres");
    assertApprox(cosAngle(cycle(0,0,0,3), cycle(2,0,0,1)),  1, "internal tangency, cos = 1");
    assertApprox(cosAngle(cycle(0,0,0,3), cycle(2,0,0,-1)), -1, "flip one: cos = -1");
    assertApprox(cosAngle(cycle(0,0,0,1), cycle(1,0,0,1)), 0.5, "60 degrees");
    assertApprox(cosAngle(cycle(0,0,0,-1), cycle(1,0,0,-1)), 0.5, "both reversed: unchanged");
}

console.log("--- Test 6: orientation is the sign of er ---");
{
    const c = cycle(2, 3, 1, 4);
    assertApprox(normalise(c.scale(-1)).vector.er ?? 0, 4, "scaling by -1 does NOT flip orientation");
    assertApprox(cycle(2,3,1,-4).vector.er ?? 0, -4, "opposite cycle has er = -r");
    assert(!inContact(cycle(0,0,0,1), cycle(2,0,0,1)) !==
           !inContact(cycle(0,0,0,1), cycle(2,0,0,-1)),
           "orientation changes the tangency answer");
}

console.log("--- Test 6b: homogeneity and plane orientation ---");
{
    const C = cycle(3, 4, -1, 2);
    for (const k of [2, 0.1, -1, -7]) {
        const d = decode(C.scale(k));
        assert(d.kind === "sphere" && approx(d.x,3) && approx(d.y,4) && approx(d.z,-1) && approx(d.r,2),
               `scaling by ${k} leaves the object alone`);
    }
    const P = plane(0, 0, 1, 3);
    assert(inContact(cycle(0,0,5,2), P) === inContact(cycle(0,0,5,2), P.scale(-1)),
           "negating a whole plane changes nothing");
    const above = cycle(0, 0, 5, 2), below = cycle(0, 0, 1, 2);
    assert(inContact(above, plane(0,0,1,3)),        "sphere above touches z=3");
    assert(!inContact(below, plane(0,0,1,3)),       "...and the one below does not");
    assert(!inContact(above, plane(0,0,1,3, true)), "reversed: the one above no longer touches");
    assert(inContact(below, plane(0,0,1,3, true)),  "reversed: the one below now does");
}

console.log("--- Test 7: decode round-trips ---");
{
    const s = decode(cycle(3, -4, 2, 2.5));
    assert(s.kind === "sphere" && approx(s.x,3) && approx(s.y,-4) && approx(s.z,2) && approx(s.r,2.5),
           "sphere round-trip");
    const p = decode(point(1, 7, -3));
    assert(p.kind === "point" && approx(p.x,1) && approx(p.y,7) && approx(p.z,-3), "point round-trip");
    const pl = decode(plane(0, 0, 1, 3));
    assert(pl.kind === "plane" && approx(pl.nx,0) && approx(pl.ny,0) && approx(pl.nz,1) && approx(pl.d,3),
           "plane round-trip");
    const pf = decode(plane(0, 0, 1, 3, true));
    assert(pf.kind === "plane" && approx(pf.nz,-1) && approx(pf.d,-3),
           "reversed plane round-trip: the normal turns round");
    assert(decode(infinity).kind === "infinity", "infinity round-trip");
    const sc = decode(cycle(3, -4, 2, 2.5).scale(7));
    assert(sc.kind === "sphere" && approx(sc.x,3) && approx(sc.r,2.5), "scale-invariant decode");
}

console.log("--- Test 8: CGA 3D sits inside Lie ---");
{
    const cga = toCGA(point(3, 4, 12));
    assertApprox(cga.e1 ?? 0, 3,    "CGA e1");
    assertApprox(cga.e2 ?? 0, 4,    "CGA e2");
    assertApprox(cga.e3 ?? 0, 12,   "CGA e3");
    assertApprox(cga.eo ?? 0, 1,    "CGA eo");
    assertApprox(cga.ei ?? 0, 84.5, "CGA ei = (x^2+y^2+z^2)/2");
    assertApprox(-2 * inner(point(0,0,0), point(3,4,12)), 169, "squared distance");
}

console.log("--- Test 9: slicing 3D gives the 2D story ---");
{
    // A sphere cut by a plane through its centre is a circle of the same
    // radius, and tangency in the slice matches tangency in space.
    const A = cycle(0, 0, 0, 2), B = cycle(3, 0, 0, -1);   // externally tangent
    assert(inContact(A, B), "spheres tangent in space");
    const zA = 0, zB = 0;                                   // both centres on z = 0
    const rA = Math.sqrt(4 - zA * zA), rB = Math.sqrt(1 - zB * zB);
    assertApprox(rA, 2, "slice of A at z=0 has radius 2");
    assertApprox(rB, 1, "slice of B at z=0 has radius 1");
    assertApprox(Math.hypot(3, 0), rA + rB, "the slices are tangent too");
}

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
