// The little programs. Each is  frame(t) -> {shapes, note}  with t in 0..1.
//
// Adding one is meant to be easy: write a frame function, push it onto the
// list at the bottom. Set `steps: n` if it should advance in discrete jumps
// rather than continuously, `pingpong: true` to bounce instead of loop.

import { GA } from "../dist/ga.js";
import { LIE2D, cycle, point, line, inner, decode, normalise } from "../dist/lie2d.js";
import { S2, solve, atAngle, PATTERNS, patternName, applyPattern } from "./solver.js";
import { shape } from "./viz.js";

const INPUT = "#6E8079";
const SOL_A = "#2E9B80";
const SOL_B = "#C08A3E";
const HOT   = "#C0553E";

const lerp = (a, b, t) => a + (b - a) * t;
const fixed = (v, n = 3) => (v < 0 ? "" : " ") + v.toFixed(n);

/* --------------------------------------------- 1. the eight tangent circles */

const eight = {
    id: "eight",
    name: "The eight tangent circles",
    blurb: "One orientation pattern per step. Three sign choices, eight answers — not eight cases.",
    steps: 8,
    halfWidth: 7,
    cx: 2, cy: 1,
    frame(t) {
        const base = [cycle(0, 0, 1), cycle(4, 0, 1), cycle(2, 3, 1)];
        const i = Math.round(t * 7);
        const pat = PATTERNS[i];
        const ins = applyPattern(base, pat);
        const sols = solve(ins.map((c) => atAngle(c, 0)));
        const shapes = [
            ...ins.map((c, k) => shape(c, { stroke: INPUT, width: 2, label: `S${k + 1}` })),
            ...sols.map((s, k) =>
                shape(s, { stroke: k === 0 ? SOL_A : SOL_B, width: 2.5, centre: false })
            ),
        ];
        const radii = sols
            .map((s) => decode(normalise(s)))
            .filter((d) => d.kind === "circle")
            .map((d) => fixed(d.r));
        return {
            shapes,
            note: `pattern ${patternName(pat)}   ·   r = ${radii.join(", ") || "no real solution"}`,
        };
    },
};

/* ------------------------------------------------- 2. drag one input around */

const drag = {
    id: "drag",
    name: "Drag a circle through a pair",
    blurb: "Pattern held at +++. The two answers move continuously; nothing pops or swaps.",
    pingpong: true,
    halfWidth: 8,
    cx: 2, cy: 1,
    frame(t) {
        const y = lerp(-2.5, 6.5, t);
        const ins = [cycle(0, 0, 1), cycle(4, 0, 1), cycle(2.2, y, 1)];
        const sols = solve(ins.map((c) => atAngle(c, 0)));
        const rs = sols.map((s) => decode(normalise(s))).filter((d) => d.kind === "circle");
        return {
            shapes: [
                ...ins.map((c, k) => shape(c, { stroke: k === 2 ? HOT : INPUT, width: 2 })),
                ...sols.map((s, k) => shape(s, { stroke: k === 0 ? SOL_A : SOL_B, width: 2.5, centre: false })),
            ],
            note: `moving circle at y = ${fixed(y, 2)}   ·   r = ${rs.map((d) => fixed(d.r)).join(", ")}`,
        };
    },
};

/* ------------------------------------------------------ 3. the Laguerre shear */

const { offset } = S2;   // dimension-generic; see solver.js

const laguerre = {
    id: "laguerre",
    name: "The Laguerre shear",
    blurb: "Add a constant to every radius. Circles grow, lines slide, tangency survives — it is a rotation in the algebra.",
    pingpong: true,
    halfWidth: 8,
    frame(t) {
        const d = lerp(-2, 3, t);
        const objs = [
            cycle(-3, -1, 2.2),
            cycle(2.5, 1.5, 1.4),
            cycle(0.2, -2.6, 0.8),
            line(0, 1, 4.5),
            line(0.7071, 0.7071, -4),
        ];
        const moved = objs.map((o) => offset(d, o));
        const notes = moved
            .map((m) => decode(normalise(m)))
            .map((x) => (x.kind === "circle" ? `r=${fixed(x.r, 2)}` : x.kind === "point" ? "point" : `line d=${fixed(x.d, 2)}`));
        return {
            shapes: [
                ...objs.map((o) => shape(o, { stroke: INPUT, width: 1, dash: [3, 4], arrows: false, centre: false })),
                ...moved.map((m) => shape(m, { stroke: SOL_A, width: 2.5, centre: false })),
            ],
            note: `offset ${fixed(d, 2)}   ·   ${notes.join("  ")}`,
        };
    },
};

/* ------------------------------------------------------------ 4. inversion */

function mirrorIn(X, S) {
    const V = new GA(LIE2D, { ...S.vector, er: 0 });
    const Vi = LIE2D.inverse(V.vector);
    return new GA(LIE2D, LIE2D.gp(LIE2D.gp(V.vector, X.vector), Vi));
}

const inversion = {
    id: "inversion",
    name: "Inversion is reflection",
    blurb: "One sandwich product. The mirror morphs from a line into a circle, and reflection becomes inversion.",
    pingpong: true,
    halfWidth: 6,
    cx: 1.2,
    frame(t) {
        // the mirror: a line at t=0, tightening into a circle as t grows
        const R = 1 / Math.max(t, 1e-3) - 1 + 1.6;
        const mirror = t < 0.02 ? line(1, 0, 1.6) : cycle(1.6 + R, 0, R);
        const stuff = [
            cycle(0.3, 1.9, 0.75),
            cycle(0.3, -1.9, 0.75),
            cycle(1.1, 0, 0.6),
            line(0, 1, 2.9),
            point(-0.7, 0),
        ];
        const out = stuff.map((s) => mirrorIn(s, mirror));
        return {
            shapes: [
                shape(mirror, { stroke: HOT, width: 2, dash: [6, 4], centre: false, label: t < 0.02 ? "mirror (line)" : "mirror (circle)" }),
                ...stuff.map((s) => shape(s, { stroke: INPUT, width: 1.5, arrows: false, centre: false })),
                ...out.map((s) => shape(s, { stroke: SOL_A, width: 2.5, centre: false })),
            ],
            note: t < 0.02 ? "mirror is a straight line — this is ordinary reflection"
                           : `mirror radius ${fixed(R, 2)} — same call, now inverting`,
        };
    },
};

/* ------------------------------------------------------------ 5. quadrance */

const quadrance = {
    id: "quadrance",
    name: "Quadrance and the light cone",
    blurb: "Q = −2 (X·Y) is the squared common-tangent length. Watch it pass through zero and go negative.",
    pingpong: true,
    halfWidth: 7,
    frame(t) {
        const A = cycle(-2.2, 0, 2.6);
        const d = lerp(0.4, 7.5, t);
        const B = cycle(-2.2 + d, 0, 1.1);
        const a = decode(normalise(A)), b = decode(normalise(B));
        const Q = -2 * inner(A, B);
        const shapes = [
            shape(A, { stroke: INPUT, width: 2, label: "A" }),
            shape(B, { stroke: HOT, width: 2, label: "B" }),
        ];
        let verdict;
        if (Q > 1e-9) {
            // external common tangent: unit normal n with n·u = (r1 − r2)/d
            const ux = (b.x - a.x) / d, uy = (b.y - a.y) / d;
            const cosf = (a.r - b.r) / d, sinf = Math.sqrt(Math.max(0, 1 - cosf * cosf));
            for (const sgn of [1, -1]) {
                const nx = cosf * ux + sgn * sinf * -uy;
                const ny = cosf * uy + sgn * sinf * ux;
                shapes.push({
                    kind: "line", nx, ny, d: nx * a.x + ny * a.y + a.r,
                    stroke: SOL_A, width: 1.5, arrows: false,
                });
            }
            verdict = "spacelike — a real common tangent exists";
        } else if (Q < -1e-9) {
            verdict = "TIMELIKE — one inside the other, no common tangent";
        } else {
            verdict = "LIGHTLIKE — they touch";
        }
        return { shapes, note: `d = ${fixed(d, 2)}   ·   Q = ${fixed(Q, 3)}   ·   ${verdict}` };
    },
};

/* ------------------------------------------------ 6. the arc-sided triangle */

const sameSign = {
    id: "samesign",
    name: "The arc-sided triangle",
    blurb: "Three overlapping circles. At +++ both answers share a radius sign — the little one in the gap and the big one outside.",
    steps: 8,
    halfWidth: 7,
    cx: 1.3, cy: 0.8,
    frame(t) {
        const base = [cycle(0, 0, 2), cycle(2.6, 0, 2), cycle(1.3, 2.3, 2)];
        const pat = PATTERNS[Math.round(t * 7)];
        const ins = applyPattern(base, pat);
        const sols = solve(ins.map((c) => atAngle(c, 0)));
        const rs = sols.map((s) => decode(normalise(s))).filter((d) => d.kind === "circle").map((d) => d.r);
        const same = rs.length === 2 && rs[0] * rs[1] > 0;
        return {
            shapes: [
                ...ins.map((c) => shape(c, { stroke: INPUT, width: 2 })),
                ...sols.map((s, k) => shape(s, { stroke: same ? HOT : k === 0 ? SOL_A : SOL_B, width: 2.5, centre: false })),
            ],
            note: `pattern ${patternName(pat)}   ·   r = ${rs.map((r) => fixed(r)).join(", ")}   ·   ${same ? "SAME sign" : "opposite signs"}`,
        };
    },
};

/* --------------------------------------------------------- 7. angle sweep */

const angles = {
    id: "angles",
    name: "Sweep the angle",
    blurb: "Not tangency — meet all three at θ. Tangency is just θ = 0, and 90° gives the radical circle.",
    halfWidth: 7,
    cx: 2, cy: 1,
    // A full turn, not a 0..180 yo-yo. cos(360°) = cos(0°), so the loop closes
    // seamlessly where a bounce would visibly stall at each end — and an angle
    // that keeps increasing is what an angle does.
    frame(t) {
        const theta = lerp(0, 360, t);
        const base = [cycle(0, 0, 1), cycle(4, 0, 1), cycle(2, 3, 1)];
        const sols = solve(base.map((c) => atAngle(c, theta)));
        const rs = sols.map((s) => decode(normalise(s))).filter((d) => d.kind === "circle");
        return {
            shapes: [
                ...base.map((c) => shape(c, { stroke: INPUT, width: 2 })),
                ...sols.map((s, k) => shape(s, { stroke: k === 0 ? SOL_A : SOL_B, width: 2.5, centre: false })),
            ],
            note: `θ = ${theta.toFixed(0)}°   ·   r = ${rs.map((d) => fixed(d.r)).join(", ") || "none"}` +
                  (Math.abs(Math.cos((theta * Math.PI) / 180)) < 0.02 ? "   ·   radical circle" : ""),
        };
    },
};

export const PROGRAMS = [eight, drag, angles, laguerre, inversion, quadrance, sameSign];
