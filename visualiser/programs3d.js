// The 3D programs — deliberately ports of the 2D ones.
//
// Tony's guess was that the demos would be "almost re-doable by just adding
// one more sphere and using a +1 dimension GA instance". They are. Compare
// any of these with its twin in programs.js: same structure, one more
// coordinate, one more input where the solve needs n+1 constraints.

import { GA } from "../dist/ga.js";
import { LIE3D, cycle, point, plane, inner, decode, normalise } from "../dist/lie3d.js";
import { S3, patterns, patternName, applyPattern } from "./solver.js";
import { tangentCone } from "./viz3d.js";

const { solve, atAngle, reverse, offset } = S3;

const INPUT = "#6E8079";
const SOL_A = "#2E9B80";
const SOL_B = "#C08A3E";
const HOT   = "#C0553E";

const lerp = (a, b, t) => a + (b - a) * t;
const fixed = (v, n = 3) => (v < 0 ? "" : " ") + v.toFixed(n);

/** Decode a Lie multivector into a drawable 3D shape, carrying style. */
function shape(X, style = {}) {
    const d = decode(normalise(X));
    if (d.kind === "infinity") return null;
    return { ...d, ...style };
}

/** Describe a solution: a solve can legitimately return a PLANE. */
const describe = (d) =>
    d.kind === "sphere" ? `r =${fixed(d.r)}`
  : d.kind === "plane"  ? `plane n = (${fixed(d.nx, 2)},${fixed(d.ny, 2)},${fixed(d.nz, 2)}) d =${fixed(d.d, 2)}`
  : d.kind === "point"  ? "point"
  : "infinity";

const describeAll = (sols) =>
    sols.map((x) => describe(decode(normalise(x)))).join("   ") || "no real solution";

/* ------------------------------------------ 1. the sixteen tangent spheres */

// A regular tetrahedron of unit spheres.
const TETRA = [
    cycle( 1.6,  1.6,  1.6, 1),
    cycle( 1.6, -1.6, -1.6, 1),
    cycle(-1.6,  1.6, -1.6, 1),
    cycle(-1.6, -1.6,  1.6, 1),
];

const sixteen = {
    id: "sixteen3",
    name: "The sixteen tangent spheres",
    blurb: "Four spheres, four sign choices, sixteen answers. The 2D count was 8 = 2³; this is 2⁴.",
    steps: 16,
    halfWidth: 5.5,
    frame(t) {
        const pat = patterns(4)[Math.round(t * 15)];
        const ins = applyPattern(TETRA, pat, reverse);
        const sols = solve(ins.map((c) => atAngle(c, 0)));
        return {
            shapes: [
                ...ins.map((c) => shape(c, { stroke: INPUT, opacity: 0.3, wire: 0.3 })),
                ...sols.map((s, k) => shape(s, { stroke: k === 0 ? SOL_A : SOL_B, opacity: 0.3, wire: 0.22 })),
            ],
            note: `pattern ${patternName(pat)}   ·   ${describeAll(sols)}`,
        };
    },
};

/* --------------------------------------------------- 2. drag one input around */

const drag = {
    id: "drag3",
    name: "Drag a sphere through the rest",
    blurb: "Pattern held at ++++. The two answers move continuously; nothing pops or swaps.",
    pingpong: true,
    halfWidth: 8,
    frame(t) {
        const z = lerp(-5.5, 5.5, t);
        const ins = [TETRA[0], TETRA[1], TETRA[2], cycle(-0.6, -0.6, z, 1)];
        const sols = solve(ins.map((c) => atAngle(c, 0)));
        return {
            shapes: [
                ...ins.map((c, k) => shape(c, { stroke: k === 3 ? HOT : INPUT, opacity: 0.16 })),
                ...sols.map((s, k) => shape(s, { stroke: k === 0 ? SOL_A : SOL_B, opacity: 0.22 })),
            ],
            note: `moving sphere at z =${fixed(z, 2)}   ·   ${describeAll(sols)}`,
        };
    },
};

/* ------------------------------------------------------------ 3. angle sweep */

const angles = {
    id: "angles3",
    name: "Sweep the angle",
    blurb: "Meet all four at θ. Tangency is θ = 0; 90° gives the sphere orthogonal to all four.",
    halfWidth: 7,
    frame(t) {
        const theta = lerp(0, 360, t);
        const sols = solve(TETRA.map((c) => atAngle(c, theta)));
        const orth = Math.abs(Math.cos((theta * Math.PI) / 180)) < 0.02;
        return {
            shapes: [
                ...TETRA.map((c) => shape(c, { stroke: INPUT, opacity: 0.16 })),
                ...sols.map((s, k) => shape(s, { stroke: k === 0 ? SOL_A : SOL_B, opacity: 0.22 })),
            ],
            note: `θ = ${theta.toFixed(0)}°   ·   ${describeAll(sols)}` +
                  (orth ? "   ·   orthogonal sphere" : ""),
        };
    },
};

/* ------------------------------------------------------ 4. the Laguerre shear */

// offset comes from S3 — the SAME function the 2D programs use.

const laguerre = {
    id: "laguerre3",
    name: "The Laguerre shear",
    blurb: "Add a constant to every radius. Spheres grow, planes slide, tangency survives — a rotation in R(4,2).",
    pingpong: true,
    halfWidth: 9,
    frame(t) {
        const d = lerp(-1.6, 3, t);
        const objs = [
            cycle(-3, 0, -1, 2.2),
            cycle(2.5, 1.5, 1, 1.4),
            cycle(0.2, -2.6, 2, 0.8),
            plane(0, 1, 0, 5),
            plane(0.577, 0.577, 0.577, -4.5),
        ];
        const moved = objs.map((o) => offset(d, o));
        const notes = moved.map((m) => decode(normalise(m)))
            .map((x) => x.kind === "sphere" ? `r=${fixed(x.r, 2)}`
                      : x.kind === "point"  ? "point"
                      : `plane d=${fixed(x.d, 2)}`);
        return {
            shapes: [
                ...objs.map((o) => shape(o, { stroke: INPUT, opacity: 0.07, arrows: false })),
                ...moved.map((m) => shape(m, { stroke: SOL_A, opacity: 0.2 })),
            ],
            note: `offset ${fixed(d, 2)}   ·   ${notes.join("  ")}`,
        };
    },
};

/* --------------------------------------------------------------- 5. inversion */

function mirrorIn(X, S) {
    const V = new GA(LIE3D, { ...S.vector, er: 0 });
    const Vi = LIE3D.inverse(V.vector);
    return new GA(LIE3D, LIE3D.gp(LIE3D.gp(V.vector, X.vector), Vi));
}

const inversion = {
    id: "inversion3",
    name: "Inversion is reflection",
    blurb: "One sandwich product. The mirror morphs from a plane into a sphere, and reflection becomes inversion.",
    pingpong: true,
    halfWidth: 6,
    frame(t) {
        const R = 1 / Math.max(t, 1e-3) - 1 + 1.7;
        const mirror = t < 0.02 ? plane(1, 0, 0, 1.7) : cycle(1.7 + R, 0, 0, R);
        const stuff = [
            cycle(0.3, 1.9, 0.4, 0.75),
            cycle(0.3, -1.9, -0.4, 0.75),
            cycle(1.2, 0, 0, 0.6),
            plane(0, 1, 0, 3.0),
            point(-0.8, 0, 0),
        ];
        const out = stuff.map((s) => mirrorIn(s, mirror));
        return {
            shapes: [
                shape(mirror, { stroke: HOT, opacity: 0.1, arrows: false }),
                ...stuff.map((s) => shape(s, { stroke: INPUT, opacity: 0.09, arrows: false })),
                ...out.map((s) => shape(s, { stroke: SOL_A, opacity: 0.22 })),
            ],
            note: t < 0.02 ? "mirror is a flat plane — this is ordinary reflection"
                           : `mirror radius ${fixed(R, 2)} — same call, now inverting`,
        };
    },
};

/* --------------------------------------------------------------- 6. quadrance */

const quadrance = {
    id: "quadrance3",
    name: "Quadrance and the light cone",
    blurb: "Q = −2 (X·Y) is the squared common-tangent length. In space the common tangents form a cone — literally the light cone of the pair.",
    pingpong: true,
    halfWidth: 8,
    frame(t) {
        const rA = 2.6, rB = 1.1;
        const A = cycle(-2.2, 0, 0, rA);
        const d = lerp(0.4, 7.5, t);
        const B = cycle(-2.2 + d, 0, 0, rB);
        const Q = -2 * inner(A, B);
        const shapes = [
            shape(A, { stroke: INPUT, opacity: 0.18 }),
            shape(B, { stroke: HOT, opacity: 0.22 }),
        ];
        let verdict;
        if (Q > 1e-9) {
            // In 2D this was two tangent lines; in 3D they sweep into a cone
            // with its apex at the external homothetic centre.
            const cone = tangentCone([-2.2, 0, 0], rA, [-2.2 + d, 0, 0], rB);
            if (cone) shapes.push({ kind: "cone", ...cone, stroke: SOL_A, opacity: 0.11, wire: 0.22 });
            verdict = "spacelike — a real common tangent cone exists";
        } else if (Q < -1e-9) {
            verdict = "TIMELIKE — one inside the other, no common tangent";
        } else {
            verdict = "LIGHTLIKE — they touch";
        }
        return { shapes, note: `d = ${fixed(d, 2)}   ·   Q = ${fixed(Q, 3)}   ·   ${verdict}` };
    },
};

export const PROGRAMS_3D = [sixteen, drag, angles, laguerre, inversion, quadrance];
