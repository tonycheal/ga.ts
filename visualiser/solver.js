// A provisional Lie sphere solver, for the visualiser only.
//
// This is deliberately NOT part of the library: `lsg.ts` (see ROADMAP.md) is
// the real thing, and when it lands this file should be deleted and the
// programs pointed at it instead. It exists so the visualiser has something to
// drive it in the meantime.
//
// The method is the one the roadmap describes: every constraint is "be
// orthogonal to this vector", so stack the constraint rows, take the null
// space (2-dimensional for n+1 constraints), and intersect that line with the
// quadric X·X = 0.

import { GA } from "../dist/ga.js";
import { LIE2D, inner } from "../dist/lie2d.js";

export const BASIS = ["e1", "e2", "eo", "ei", "er"];

const unit = (j) => new GA(LIE2D, { [BASIS[j]]: 1 });

/** Reverse a cycle's orientation: negate er alone, never the whole vector. */
export function reverse(X) {
    return new GA(LIE2D, { ...X.vector, er: -(X.vector.er ?? 0) });
}

/** The constraint vector for "meet this cycle at angle theta" (degrees). */
export function atAngle(S, degrees = 0) {
    const c = Math.cos((degrees * Math.PI) / 180);
    return new GA(LIE2D, { ...S.vector, er: (S.vector.er ?? 0) * c });
}

function nullspace(rows, n = 5) {
    const m = rows.map((r) => [...r]);
    const pivots = [];
    let r = 0;
    for (let c = 0; c < n && r < m.length; c++) {
        let best = r;
        for (let i = r; i < m.length; i++)
            if (Math.abs(m[i][c]) > Math.abs(m[best][c])) best = i;
        if (Math.abs(m[best][c]) < 1e-10) continue;
        [m[r], m[best]] = [m[best], m[r]];
        const p = m[r][c];
        for (let j = 0; j < n; j++) m[r][j] /= p;
        for (let i = 0; i < m.length; i++)
            if (i !== r) {
                const f = m[i][c];
                for (let j = 0; j < n; j++) m[i][j] -= f * m[r][j];
            }
        pivots.push(c);
        r++;
    }
    const free = [...Array(n).keys()].filter((c) => !pivots.includes(c));
    return free.map((f) => {
        const v = new Array(n).fill(0);
        v[f] = 1;
        pivots.forEach((pc, pi) => { v[pc] = -m[pi][f]; });
        return v;
    });
}

/**
 * Solve a list of constraint vectors. Returns 0, 1 or 2 cycles.
 * The quadratic uses the stable form (both roots via +sqrt, the second as
 * C/q) — see NewTanCode.ts, which had this right all along.
 */
export function solve(constraints) {
    const rows = constraints.map((V) => BASIS.map((_, j) => inner(unit(j), V)));
    const ns = nullspace(rows);
    if (ns.length !== 2) return [];
    const [a, b] = ns.map(
        (v) => new GA(LIE2D, Object.fromEntries(BASIS.map((k, i) => [k, v[i]])))
    );
    const A = inner(a, a), B = 2 * inner(a, b), C = inner(b, b);
    const out = [];
    if (Math.abs(A) < 1e-12) {
        if (Math.abs(B) > 1e-12) out.push(a.scale(-C / B).add(b));
    } else {
        const D = B * B - 4 * A * C;
        if (D < -1e-9) return [];
        const s = Math.sqrt(Math.max(D, 0));
        const q = -(B + Math.sign(B || 1) * s) / 2;
        out.push(a.scale(q / A).add(b));
        out.push(a.scale(Math.abs(q) > 1e-12 ? C / q : q / A).add(b));
    }
    return out.filter((X) => {
        const v = X.vector;
        return Math.abs(v.eo ?? 0) > 1e-9 || Math.hypot(v.e1 ?? 0, v.e2 ?? 0) > 1e-9;
    });
}

/** The eight orientation patterns of three inputs, as sign triples. */
export const PATTERNS = [...Array(8).keys()].map((i) => [
    i & 1 ? -1 : 1,
    i & 2 ? -1 : 1,
    i & 4 ? -1 : 1,
]);

export const patternName = (p) => p.map((s) => (s < 0 ? "−" : "+")).join("");

/** Apply a sign pattern to a list of cycles. */
export const applyPattern = (cycles, pat) =>
    cycles.map((c, i) => (pat[i] < 0 ? reverse(c) : c));
