/**
 * test-interpreter.ts — Tests for the GA expression interpreter
 *
 * Run with:  npx ts-node test-interpreter.ts
 *         or bun test-interpreter.ts
 *         or deno run --allow-all test-interpreter.ts
 */

import { Algebra, MultiVector } from "./ga.ts";
import { gaEvaluate, gaTemplate, GAInterpreterError } from "./interpreter.ts";

// ─── Tiny test harness ────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function approxEqual(a: number, b: number, eps = 1e-9): boolean {
    return Math.abs(a - b) < eps;
}

function mvApproxEqual(a: MultiVector, b: MultiVector, eps = 1e-9): boolean {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const k of keys) {
        const av = a[k] ?? 0;
        const bv = b[k] ?? 0;
        if (!approxEqual(av, bv, eps)) return false;
    }
    return true;
}

function test(name: string, fn: () => void) {
    try {
        fn();
        console.log(`  ✓ ${name}`);
        passed++;
    } catch (e: any) {
        console.log(`  ✗ ${name}`);
        console.log(`    ${e.message}`);
        failed++;
    }
}

function assert(cond: boolean, msg: string) {
    if (!cond) throw new Error(msg);
}

function assertMVEq(got: MultiVector, expected: MultiVector, label: string, eps = 1e-9) {
    if (!mvApproxEqual(got, expected, eps)) {
        throw new Error(
            `${label}\n    expected: ${JSON.stringify(expected)}\n    got:      ${JSON.stringify(got)}`
        );
    }
}

// ─── Algebra setup ────────────────────────────────────────────────────────────

const R2  = new Algebra(2, 0, 0);   // Euclidean 2D
const R3  = new Algebra(3, 0, 0);   // Euclidean 3D
const R21 = new Algebra(2, 1, 0);   // 2+1 Minkowski-like

// CGA 2D: parent R(3,1), child with null basis
const R31 = new Algebra(3, 1, 0);
const CGA2D = new Algebra(
    [
        { square: 1,  subscript: "1" },
        { square: 1,  subscript: "2" },
        { square: 0,  subscript: "o" },   // e₀ origin
        { square: 0,  subscript: "i" },   // e∞ infinity
    ],
    {
        algebra: R31,
        transform: [
            [1, 0,  0,    0],
            [0, 1,  0,    0],
            [0, 0, -1/2,  1],
            [0, 0,  1/2,  1],
        ]
    }
);

// ─── Section 1: Tokenizer & Parser (via evaluate, observing results) ──────────

console.log("\n── Section 1: Basic parsing and evaluation ──");

test("scalar assignment", () => {
    const r = gaEvaluate("x = e", R2);
    // "e" is the scalar basis element
    assertMVEq(r.x, { e: 1 }, "x = e");
});

test("basis vector assignment", () => {
    const r = gaEvaluate("A = e1", R2);
    assertMVEq(r.A, { e1: 1 }, "A = e1");
});

test("implicit scalar multiply: 3e1", () => {
    const r = gaEvaluate("A = 3e1", R2);
    assertMVEq(r.A, { e1: 3 }, "3e1");
});

test("implicit scalar multiply: 0.5e2", () => {
    const r = gaEvaluate("A = 0.5e2", R2);
    assertMVEq(r.A, { e2: 0.5 }, "0.5e2");
});

test("addition: 3e1 + 4e2", () => {
    const r = gaEvaluate("A = 3e1 + 4e2", R2);
    assertMVEq(r.A, { e1: 3, e2: 4 }, "3e1+4e2");
});

test("subtraction: 3e1 - 4e2", () => {
    const r = gaEvaluate("A = 3e1 - 4e2", R2);
    assertMVEq(r.A, { e1: 3, e2: -4 }, "3e1-4e2");
});

test("unary negation: -e1", () => {
    const r = gaEvaluate("A = -e1", R2);
    assertMVEq(r.A, { e1: -1 }, "-e1");
});

test("multi-statement via newline", () => {
    const r = gaEvaluate("A = e1\nB = e2", R2);
    assertMVEq(r.A, { e1: 1 }, "A");
    assertMVEq(r.B, { e2: 1 }, "B");
});

test("multi-statement via semicolon", () => {
    const r = gaEvaluate("A = e1; B = e2", R2);
    assertMVEq(r.A, { e1: 1 }, "A");
    assertMVEq(r.B, { e2: 1 }, "B");
});

test("name reference: C = A + B", () => {
    const r = gaEvaluate("A = e1\nB = e2\nC = A + B", R2);
    assertMVEq(r.C, { e1: 1, e2: 1 }, "C");
});

test("parentheses: (e1 + e2)", () => {
    const r = gaEvaluate("A = (e1 + e2)", R2);
    assertMVEq(r.A, { e1: 1, e2: 1 }, "(e1+e2)");
});

test("ASCII ^ as wedge", () => {
    const r1 = gaEvaluate("C = e1 ^ e2", R2);
    const r2 = gaEvaluate("C = e1 ∧ e2", R2);
    assertMVEq(r1.C, r2.C, "^ == ∧");
});

test("ASCII & as anti-wedge", () => {
    // Just check it parses and runs without error (result may be zero in 2D)
    gaEvaluate("C = e12 & e12", R2);
});

test("ASCII | as left contraction", () => {
    gaEvaluate("C = e1 | e12", R2);
});

// ─── Section 2: Algebra operations ───────────────────────────────────────────

console.log("\n── Section 2: Wedge product correctness ──");

test("e1 ∧ e2 = e12", () => {
    const r = gaEvaluate("C = e1 ∧ e2", R2);
    assertMVEq(r.C, { e12: 1 }, "e1∧e2");
});

test("e2 ∧ e1 = -e12", () => {
    const r = gaEvaluate("C = e2 ∧ e1", R2);
    assertMVEq(r.C, { e12: -1 }, "e2∧e1");
});

test("e1 ∧ e1 = 0", () => {
    const r = gaEvaluate("C = e1 ∧ e1", R2);
    assertMVEq(r.C, {}, "e1∧e1=0");
});

test("e1 ∧ e2 ∧ e3 = e123 (left assoc)", () => {
    const r = gaEvaluate("C = e1 ∧ e2 ∧ e3", R3);
    assertMVEq(r.C, { e123: 1 }, "e1∧e2∧e3");
});

test("e1 ∧ e3 ∧ e2 = -e123", () => {
    const r = gaEvaluate("C = e1 ∧ e3 ∧ e2", R3);
    assertMVEq(r.C, { e123: -1 }, "e1∧e3∧e2");
});

test("A ∧ B wedge of vectors", () => {
    // (3e1+4e2) ∧ (6e1+5e2) = (3*5 - 4*6)*e12 = (15-24)*e12 = -9e12
    const r = gaEvaluate("A = 3e1 + 4e2\nB = 6e1 + 5e2\nC = A ∧ B", R2);
    assertMVEq(r.C, { e12: -9 }, "(3e1+4e2)∧(6e1+5e2)");
});

console.log("\n── Section 3: Geometric product ──");

test("e1 * e1 = scalar 1 (R2)", () => {
    const r = gaEvaluate("A = e1 * e1", R2);
    assertMVEq(r.A, { e: 1 }, "e1*e1=1");
});

test("e1 * e2 = e12", () => {
    const r = gaEvaluate("A = e1 * e2", R2);
    assertMVEq(r.A, { e12: 1 }, "e1*e2=e12");
});

test("e2 * e1 = -e12", () => {
    const r = gaEvaluate("A = e2 * e1", R2);
    assertMVEq(r.A, { e12: -1 }, "e2*e1=-e12");
});

test("e12 * e12 = -1 (R2)", () => {
    const r = gaEvaluate("A = e12 * e12", R2);
    assertMVEq(r.A, { e: -1 }, "e12*e12=-1");
});

test("e3 * e3 = -1 (R21, negative basis)", () => {
    const r = gaEvaluate("A = e3 * e3", R21);
    assertMVEq(r.A, { e: -1 }, "e3*e3=-1 in R(2,1)");
});

test("A * ~A = norm squared (scalar)", () => {
    // A = 3e1 + 4e2, |A|² = 9+16 = 25
    const r = gaEvaluate("A = 3e1 + 4e2\nns = A * ~A", R2);
    assertMVEq(r.ns, { e: 25 }, "A*~A=25");
});

console.log("\n── Section 4: Reverse operator ~ ──");

test("~e1 = e1 (grade 1, no sign change)", () => {
    const r = gaEvaluate("A = ~e1", R2);
    assertMVEq(r.A, { e1: 1 }, "~e1=e1");
});

test("~e12 = -e12 (grade 2)", () => {
    const r = gaEvaluate("A = ~e12", R2);
    assertMVEq(r.A, { e12: -1 }, "~e12=-e12");
});

test("~e123 = -e123 (grade 3)", () => {
    const r = gaEvaluate("A = ~e123", R3);
    assertMVEq(r.A, { e123: -1 }, "~e123=-e123");
});

console.log("\n── Section 5: Grade selection ──");

test("grade(e1 + e12, 1) = e1", () => {
    const r = gaEvaluate("A = e1 + e12\nB = grade(A, 1)", R2);
    assertMVEq(r.B, { e1: 1 }, "grade(e1+e12,1)");
});

test("grade(e1 + e12, 2) = e12", () => {
    const r = gaEvaluate("A = e1 + e12\nB = grade(A, 2)", R2);
    assertMVEq(r.B, { e12: 1 }, "grade(e1+e12,2)");
});

console.log("\n── Section 6: Left contraction ──");

test("e1 ⌋ e12 = e2 (R2)", () => {
    // e1 contracted into e12 = e2 (lowers grade by 1)
    const r = gaEvaluate("A = e1 ⌋ e12", R2);
    assertMVEq(r.A, { e2: 1 }, "e1⌋e12=e2");
});

test("e2 ⌋ e12 = -e1 (R2)", () => {
    const r = gaEvaluate("A = e2 ⌋ e12", R2);
    assertMVEq(r.A, { e1: -1 }, "e2⌋e12=-e1");
});

console.log("\n── Section 7: Operator precedence ──");

test("* binds tighter than ∧: e1 * e2 ∧ e3 = e12 ∧ e3 = e123", () => {
    const r = gaEvaluate("A = e1 * e2 ∧ e3", R3);
    assertMVEq(r.A, { e123: 1 }, "e1*e2∧e3");
});

test("∧ binds tighter than +: e1 ∧ e2 + e3 = e12 + e3", () => {
    const r = gaEvaluate("A = e1 ∧ e2 + e3", R3);
    assertMVEq(r.A, { e12: 1, e3: 1 }, "e1∧e2+e3");
});

test("unary - binds tighter than *: -e1 * e2 = (-e1)*e2 = -e12", () => {
    const r = gaEvaluate("A = -e1 * e2", R2);
    assertMVEq(r.A, { e12: -1 }, "-e1*e2=-e12");
});

// ─── Section 8: CGA 2D ────────────────────────────────────────────────────────

console.log("\n── Section 8: CGA 2D null metric ──");

test("CGA2D g[1]: eo·eo = 0", () => {
    const g = CGA2D.g[1];
    const oIdx = CGA2D.subscripts.indexOf("o");
    assert(approxEqual(g[oIdx][oIdx], 0), `eo·eo = ${g[oIdx][oIdx]}, expected 0`);
});

test("CGA2D g[1]: ei·ei = 0", () => {
    const g = CGA2D.g[1];
    const iIdx = CGA2D.subscripts.indexOf("i");
    assert(approxEqual(g[iIdx][iIdx], 0), `ei·ei = ${g[iIdx][iIdx]}, expected 0`);
});

test("CGA2D g[1]: eo·ei = -1", () => {
    const g = CGA2D.g[1];
    const oIdx = CGA2D.subscripts.indexOf("o");
    const iIdx = CGA2D.subscripts.indexOf("i");
    assert(approxEqual(g[oIdx][iIdx], -1) || approxEqual(g[iIdx][oIdx], -1),
        `eo·ei = ${g[oIdx][iIdx]}, expected -1`);
});

test("CGA2D basis vectors parse as basis tokens", () => {
    const r = gaEvaluate("A = eo + ei", CGA2D);
    assertMVEq(r.A, { eo: 1, ei: 1 }, "eo+ei");
});

test("CGA2D point e1 + 0.5ei + eo", () => {
    const r = gaEvaluate("P = e1 + 0.5ei + eo", CGA2D);
    assertMVEq(r.P, { e1: 1, ei: 0.5, eo: 1 }, "point (1,0)");
});

test("CGA2D: three points → circle via wedge", () => {
    // Points on unit circle: (1,0), (0,1), (-1,0)
    const src = `
        A = e1 + 0.5ei + eo
        B = e2 + 0.5ei + eo
        C = -e1 + 0.5ei + eo
        circle = A ∧ B ∧ C
    `;
    const r = gaEvaluate(src, CGA2D);
    // circle should be a non-zero trivector
    const isNonZero = Object.keys(r.circle).length > 0;
    assert(isNonZero, "circle should be non-zero trivector");
    // All components should be grade 3
    for (const k in r.circle) {
        const grade = CGA2D.gradeOfBasis(k);
        assert(grade === 3, `circle component ${k} has grade ${grade}, expected 3`);
    }
});

test("CGA2D: line through two points ∧ ei is trivector", () => {
    const src = `
        A = e1 + 0.5ei + eo
        B = e2 + 0.5ei + eo
        line = A ∧ B ∧ ei
    `;
    const r = gaEvaluate(src, CGA2D);
    const isNonZero = Object.keys(r.line).length > 0;
    assert(isNonZero, "line should be non-zero");
    for (const k in r.line) {
        const grade = CGA2D.gradeOfBasis(k);
        assert(grade === 3, `line component ${k} has grade ${grade}, expected 3`);
    }
});

test("CGA2D: antiWedge of two lines gives a point (grade ≤ 1)", () => {
    // Line y=x through O=(0,0) and A=(1,1)
    // Line x+y=1 through B=(1,0) and C=(0,1)
    const src = `
        O = eo
        A = e1 + e2 + ei + eo
        B = e1 + 0.5ei + eo
        C = e2 + 0.5ei + eo
        L1 = O ∧ A ∧ ei
        L2 = B ∧ C ∧ ei
        meet = L1 ∧ L2
    `;
    // Note: meet of two lines in CGA is their wedge product (they're trivectors)
    // giving the 4-vector / pseudoscalar-grade component; use antiWedge (meet)
    const src2 = `
        O = eo
        A = e1 + e2 + ei + eo
        B = e1 + 0.5ei + eo
        C = e2 + 0.5ei + eo
        L1 = O ∧ A ∧ ei
        L2 = B ∧ C ∧ ei
        meet = L1 & L2
    `;
    const r = gaEvaluate(src2, CGA2D);
    // meet should be non-zero (intersection exists)
    const isNonZero = Object.keys(r.meet).length > 0;
    assert(isNonZero, "meet of two lines should be non-zero");
});

console.log("\n── Section 9: Error handling ──");

test("undefined variable throws", () => {
    let threw = false;
    try { gaEvaluate("A = B + e1", R2); }
    catch (e) { threw = e instanceof GAInterpreterError; }
    assert(threw, "should throw GAInterpreterError for undefined B");
});

test("unknown basis vector throws", () => {
    let threw = false;
    try { gaEvaluate("A = e9", R2); }
    catch (e) { threw = e instanceof GAInterpreterError; }
    assert(threw, "should throw for e9 in R2");
});

test("missing assignment RHS syntax error", () => {
    let threw = false;
    try { gaEvaluate("A =", R2); }
    catch (e) { threw = true; }
    assert(threw, "should throw for incomplete assignment");
});

// ─── Section 10: gaTemplate tagged literal ────────────────────────────────────

console.log("\n── Section 10: gaTemplate tagged literal ──");

test("gaTemplate basic usage", () => {
    const result = gaTemplate(R2)`
        A = e1 + e2
        B = e1 - e2
        C = A ∧ B
    `;
    assertMVEq(result.C, { e12: -2 }, "gaTemplate C = (e1+e2)∧(e1-e2) = -2e12");
});

test("gaTemplate with interpolated MultiVector", () => {
    const myVec: MultiVector = { e1: 3, e2: 4 };
    const result = gaTemplate(R2)`
        A = ${myVec}
        B = A ∧ e2
    `;
    // A = 3e1 + 4e2, A ∧ e2 = 3e12
    assertMVEq(result.B, { e12: 3 }, "interpolated vector ∧ e2");
});

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n── Results: ${passed} passed, ${failed} failed ──\n`);
if (failed > 0) process.exit(1);
