// A provisional Lie sphere solver, for the visualiser only.
//
// This is deliberately NOT part of the library: `lsg.ts` (see ROADMAP.md) is
// the real thing, and when it lands this file should be deleted and the
// programs pointed at it instead.
//
// The method is the one the roadmap describes, but done with the algebra
// rather than with elimination. Every constraint is "be orthogonal to this
// vector", so the pencil of candidate answers is the orthogonal complement of
// S1 ^ S2 ^ ... — one bivector B, the CONTACT BLADE. Where that plane meets
// the quadric X·X = 0 are the two answers, and they come out of B directly:
//
//     M = B / sqrt(B·B)     so that  M*M = 1
//     X+ = 1/2 (v + M v)    X- = 1/2 (v - M v)     for v projected into B
//
// M is a reflection of the pencil in itself, and the two answers are its two
// eigenvectors. That matters for more than elegance — see solve() below.
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

    /**
     * Lower the index: the condition "X · S = 0" read as a covector, so that
     * wedging the constraints gives the blade whose complement is the pencil.
     * (`dual` in ga.ts is the metric-free complement, so the metric has to go
     * in here rather than there.)
     */
    const lower = (S) =>
        new GA(algebra, Object.fromEntries(basis.map((k, j) => [k, dot(unit(j), S)])));

    /**
     * The contact blade: the bivector whose plane is exactly the set of cycles
     * satisfying every constraint. A continuous function of the inputs — no
     * pivoting, no case analysis, no division.
     */
    function contactBlade(constraints) {
        let T = lower(constraints[0]);
        for (let i = 1; i < constraints.length; i++) T = T.wedge(lower(constraints[i]));
        return T.dual();
    }

    /** The scalar part of B*B. Positive means two real answers. */
    const bladeSquared = (B) => B.gp(B).vector["e"] ?? 0;

    const magnitude = (X) => Math.hypot(...basis.map((k) => X.vector[k] ?? 0));

    /**
     * Solve a list of constraint vectors. Returns 0, 1 or 2 cycles.
     *
     * WHICH root is which is the whole difficulty, and this is where it is
     * settled. The obvious route — eliminate to a nullspace basis {a, b}, put
     * X = s a + b and solve a quadratic — gives an answer whose LABELLING
     * depends on which columns the elimination happened to pivot on, and on
     * the sign of a square root taken in that accidental frame. Drag an input
     * until a solution passes through the line case (radius through infinity)
     * and the two answers change places: the branch bounces instead of
     * carrying on through and coming back with the opposite orientation.
     *
     * The projection form has no such frame. `M` is built from the contact
     * blade, which is a continuous function of the constraint list, so the two
     * eigenvectors X+ and X- are continuous too, and nothing anywhere divides
     * by eo — which is why the line case is not a special point for them. The
     * one square root taken is sqrt(B·B), a positive quantity belonging to the
     * blade, not a +/- choice belonging to a coordinate system.
     *
     * The labelling is therefore fixed by the ORDER and ORIENTATION of the
     * constraints — the user's click order and flip flags — and by nothing
     * else. Reverse two constraints and X+ and X- change places, as they
     * should; move the geometry and they never do.
     *
     * The probe vector `v` only has to be one that does not project to zero;
     * which one is picked changes the scale of the answers and nothing else,
     * because a Lie vector is homogeneous.
     */
    function solve(constraints) {
        const B = contactBlade(constraints);
        const d = bladeSquared(B);
        if (!(d > 1e-18)) return [];            // no real pair (or degenerate)
        const M = B.scale(1 / Math.sqrt(d));
        const Binv = B.scale(1 / d);

        // Project each basis vector into the plane of B and keep the biggest.
        let v = null;
        for (let j = 0; j < n; j++) {
            const p = unit(j).leftContract(B).gp(Binv).grade(1);
            if (!v || magnitude(p) > magnitude(v)) v = p;
        }
        if (!v || magnitude(v) < 1e-12) return [];

        const Mv = M.gp(v).grade(1);
        const out = [v.add(Mv).scale(0.5), v.add(Mv.scale(-1)).scale(0.5)];

        // Drop the point at infinity. It is a perfectly good null vector and a
        // perfectly good member of the pencil, and it is what the second
        // "root" IS whenever the quadratic degenerates — a circle of given
        // radius tangent to two lines has one answer per corner, not two.
        return out.filter((X) => {
            const w = X.vector;
            const euclid = basis.slice(0, n - 3).reduce((m, k) => Math.max(m, Math.abs(w[k] ?? 0)), 0);
            return magnitude(X) > 1e-9 && (Math.abs(w.eo ?? 0) > 1e-9 || euclid > 1e-9);
        });
    }

    /**
     * The Laguerre shear: add `d` to every radius. Circles and spheres grow,
     * lines and planes slide, points become cycles of radius d — one linear
     * map, no case analysis. In the ripple picture it is simply time passing.
     *
     * Note what it does NOT mention: e1, e2, e3. Only ei and er move, and
     * everything else is passed through, so this one function is already
     * correct in any dimension.
     */
    const offset = (d, X) => {
        const v = X.vector;
        return new GA(algebra, {
            ...v,
            ei: (v.ei ?? 0) - d * (v.er ?? 0) - ((d * d) / 2) * (v.eo ?? 0),
            er: (v.er ?? 0) + d * (v.eo ?? 0),
        });
    };

    /** "The answer is a line (a plane in 3D)" — orthogonality to infinity. */
    const flat = () => new GA(algebra, { ei: 1 });

    /** "The answer has signed radius p" — X·er = -r and X·ei = -eo. */
    const withRadius = (p) => new GA(algebra, { ei: p, er: -1 });

    return { solve, atAngle, reverse, offset, flat, withRadius,
             contactBlade, bladeSquared, dot, basis, algebra };
}

export const S2 = makeSolver(LIE2D, ["e1", "e2", "eo", "ei", "er"]);
export const S3 = makeSolver(LIE3D, ["e1", "e2", "e3", "eo", "ei", "er"]);

// Back-compatible 2D names, so programs.js reads as it did.
export const solve = S2.solve;
export const atAngle = S2.atAngle;
export const reverse = S2.reverse;
export const flat = S2.flat;
export const withRadius = S2.withRadius;

/** Sign patterns for k inputs: 2^k of them. */
export const patterns = (k) =>
    [...Array(1 << k).keys()].map((i) =>
        [...Array(k).keys()].map((j) => (i & (1 << j) ? -1 : 1))
    );

export const PATTERNS = patterns(3);
export const patternName = (p) => p.map((s) => (s < 0 ? "−" : "+")).join("");
export const applyPattern = (cycles, pat, rev = reverse) =>
    cycles.map((c, i) => (pat[i] < 0 ? rev(c) : c));
