// A provisional Lie sphere solver, for the visualiser only.
//
// This is deliberately NOT part of the library: `lsg.ts` (see ROADMAP.md) is
// the real thing, and when it lands this file should be deleted and the
// programs pointed at it instead.
//
// The method is the one the roadmap describes: every constraint is "be
// orthogonal to this vector", so stack the constraint rows, take the null
// space (2-dimensional for n+1 constraints), and intersect that line with the
// quadric X·X = 0.
//
// Dimension-generic, because it has to be: the 3D programs use exactly the
// same code over R(4,2) that the 2D ones use over R(3,2).

import { GA } from "../dist/ga.js";
import { LIE2D } from "../dist/lie2d.js";
import { LIE3D } from "../dist/lie3d.js";

/**
 * Build the solver for one algebra. `basis` is the grade-1 basis in order —
 * ["e1","e2","eo","ei","er"] in 2D, with "e3" inserted in 3D.
 */
export function makeSolver(algebra, basis) {
    const dot = (a, b) => algebra.scalarProduct(a.vector, b.vector);
    const unit = (j) => new GA(algebra, { [basis[j]]: 1 });
    const n = basis.length;

    /** Reverse orientation: negate er alone, never the whole vector. */
    const reverse = (X) => new GA(algebra, { ...X.vector, er: -(X.vector.er ?? 0) });

    /** The constraint vector for "meet this cycle at angle theta" (degrees). */
    const atAngle = (S, degrees = 0) =>
        new GA(algebra, {
            ...S.vector,
            er: (S.vector.er ?? 0) * Math.cos((degrees * Math.PI) / 180),
        });

    function nullspace(rows) {
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
    function solve(constraints) {
        const rows = constraints.map((V) => basis.map((_, j) => dot(unit(j), V)));
        const ns = nullspace(rows);
        if (ns.length !== 2) return [];
        const [a, b] = ns.map(
            (v) => new GA(algebra, Object.fromEntries(basis.map((k, i) => [k, v[i]])))
        );
        const A = dot(a, a), B = 2 * dot(a, b), C = dot(b, b);
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
            const euclid = basis.slice(0, n - 3).reduce((m, k) => Math.max(m, Math.abs(v[k] ?? 0)), 0);
            return Math.abs(v.eo ?? 0) > 1e-9 || euclid > 1e-9;
        });
    }

    return { solve, atAngle, reverse, dot, basis, algebra };
}

export const S2 = makeSolver(LIE2D, ["e1", "e2", "eo", "ei", "er"]);
export const S3 = makeSolver(LIE3D, ["e1", "e2", "e3", "eo", "ei", "er"]);

// Back-compatible 2D names, so programs.js reads as it did.
export const solve = S2.solve;
export const atAngle = S2.atAngle;
export const reverse = S2.reverse;

/** Sign patterns for k inputs: 2^k of them. */
export const patterns = (k) =>
    [...Array(1 << k).keys()].map((i) =>
        [...Array(k).keys()].map((j) => (i & (1 << j) ? -1 : 1))
    );

export const PATTERNS = patterns(3);
export const patternName = (p) => p.map((s) => (s < 0 ? "−" : "+")).join("");
export const applyPattern = (cycles, pat, rev = reverse) =>
    cycles.map((c, i) => (pat[i] < 0 ? rev(c) : c));
