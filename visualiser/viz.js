// Canvas renderer and playback for the ga.ts visualiser.
//
// A program is a function of one number:  frame(t) -> {shapes, note}
// with t running 0..1. Everything else — play, pause, step, scrub, reverse,
// speed — falls out of that, and interpolation is the program's own business
// (usually one lerp), so nothing here has to know what is moving.

import { decode, normalise } from "../dist/lie2d.js";

/* ------------------------------------------------------------------ view */

export function makeView(canvas, halfWidth = 8) {
    return { canvas, halfWidth, cx: 0, cy: 0 };
}

function transform(view) {
    const { canvas, halfWidth, cx, cy } = view;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    const scale = Math.min(w, h) / (2 * halfWidth);
    return {
        scale,
        sx: (x) => w / 2 + (x - cx) * scale,
        sy: (y) => h / 2 - (y - cy) * scale,   // y up, as maths intends
        w, h,
    };
}

/* --------------------------------------------------------------- drawing */

function css(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function grid(ctx, view, T) {
    const step = 1;
    ctx.save();
    ctx.strokeStyle = css("--grid");
    ctx.lineWidth = 1;
    const x0 = Math.floor(view.cx - view.halfWidth), x1 = Math.ceil(view.cx + view.halfWidth);
    const y0 = Math.floor(view.cy - view.halfWidth), y1 = Math.ceil(view.cy + view.halfWidth);
    ctx.beginPath();
    for (let x = x0; x <= x1; x += step) { ctx.moveTo(T.sx(x), 0); ctx.lineTo(T.sx(x), T.h); }
    for (let y = y0; y <= y1; y += step) { ctx.moveTo(0, T.sy(y)); ctx.lineTo(T.w, T.sy(y)); }
    ctx.stroke();
    ctx.strokeStyle = css("--axis");
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, T.sy(0)); ctx.lineTo(T.w, T.sy(0));
    ctx.moveTo(T.sx(0), 0); ctx.lineTo(T.sx(0), T.h);
    ctx.stroke();
    ctx.restore();
}

function arrowHead(ctx, px, py, dx, dy, size) {
    const l = Math.hypot(dx, dy) || 1;
    const ux = dx / l, uy = dy / l;
    const nx = -uy, ny = ux;
    ctx.beginPath();
    ctx.moveTo(px + ux * size, py + uy * size);
    ctx.lineTo(px - ux * size * 0.5 + nx * size * 0.55, py - uy * size * 0.5 + ny * size * 0.55);
    ctx.lineTo(px - ux * size * 0.5 - nx * size * 0.55, py - uy * size * 0.5 - ny * size * 0.55);
    ctx.closePath();
    ctx.fill();
}

// Orientation marks, drawn RADIALLY — not along the curve.
//
// A tangential arrow says "traversed anticlockwise", which is a 2D-only idea:
// a sphere has no direction of travel. A radial arrow is the normal, which
// means the same thing in every dimension, reads as inside-versus-outside
// rather than as a rotation, and is literally the ripple spreading or closing.
// It also removes a special case: circles and lines both just show a normal,
// exactly as the algebra treats them.
function normalTick(ctx, T, wx, wy, dx, dy, colour, len = 11) {
    const px = T.sx(wx), py = T.sy(wy);
    const sx = dx, sy = -dy;                 // world -> screen (y flips)
    ctx.save();
    ctx.strokeStyle = colour;
    ctx.fillStyle = colour;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + sx * len, py + sy * len);
    ctx.stroke();
    arrowHead(ctx, px + sx * len, py + sy * len, sx, sy, 5.5);
    ctx.restore();
}

function circleArrows(ctx, T, x, y, r, colour) {
    const R = Math.abs(r) * T.scale;
    if (R < 7) return;
    const dir = Math.sign(r) || 1;           // +r points outward, -r inward
    for (const a of [0.35, 1.9, 3.45, 5.0]) {
        const ux = Math.cos(a), uy = Math.sin(a);
        normalTick(ctx, T, x + Math.abs(r) * ux, y + Math.abs(r) * uy, dir * ux, dir * uy, colour);
    }
}

function drawShape(ctx, view, T, s) {
    const stroke = s.stroke ?? css("--ink");
    ctx.save();
    ctx.strokeStyle = stroke;
    ctx.fillStyle = stroke;
    ctx.lineWidth = s.width ?? 2;
    ctx.setLineDash(s.dash ?? []);

    if (s.kind === "circle") {
        ctx.beginPath();
        ctx.arc(T.sx(s.x), T.sy(s.y), Math.abs(s.r) * T.scale, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        if (s.arrows !== false) circleArrows(ctx, T, s.x, s.y, s.r, stroke);
        if (s.centre !== false) {
            ctx.beginPath();
            ctx.arc(T.sx(s.x), T.sy(s.y), 2, 0, Math.PI * 2);
            ctx.fill();
        }
    } else if (s.kind === "point") {
        ctx.beginPath();
        ctx.arc(T.sx(s.x), T.sy(s.y), s.big ? 5 : 3.5, 0, Math.PI * 2);
        ctx.fill();
    } else if (s.kind === "segment") {
        // bounded, unlike a line: used for a cone's silhouette, which stops
        // at the apex
        ctx.beginPath();
        ctx.moveTo(T.sx(s.x1), T.sy(s.y1));
        ctx.lineTo(T.sx(s.x2), T.sy(s.y2));
        ctx.stroke();
    } else if (s.kind === "line") {
        // p0 is the foot of the perpendicular from the origin
        const p0x = s.nx * s.d, p0y = s.ny * s.d;
        const dx = -s.ny, dy = s.nx;           // travel direction for er = +1
        const L = view.halfWidth * 4;
        ctx.beginPath();
        ctx.moveTo(T.sx(p0x - dx * L), T.sy(p0y - dy * L));
        ctx.lineTo(T.sx(p0x + dx * L), T.sy(p0y + dy * L));
        ctx.stroke();
        ctx.setLineDash([]);
        if (s.arrows !== false) {
            // same radial mark as a circle: the normal, nothing else
            for (const k of [-1.6, 0, 1.6]) {
                normalTick(ctx, T, p0x + dx * k, p0y + dy * k, s.nx, s.ny, stroke);
            }
        }
    }
    ctx.restore();

    if (s.label) {
        ctx.save();
        ctx.fillStyle = s.labelColour ?? stroke;
        ctx.font = "12px ui-monospace, Menlo, monospace";
        const lx = s.kind === "line" ? T.sx(s.nx * s.d) + 8 : T.sx(s.x) + 6;
        const ly = s.kind === "line" ? T.sy(s.ny * s.d) - 8 : T.sy(s.y) - 6;
        ctx.fillText(s.label, lx, ly);
        ctx.restore();
    }
}

/** Turn a Lie multivector into a drawable shape, carrying style through. */
export function shape(X, style = {}) {
    const d = decode(normalise(X));
    if (d.kind === "infinity") return null;
    return { ...d, ...style };
}

export function render(view, scene) {
    const { canvas } = view;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr; canvas.height = h * dpr;
    }
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = css("--panel");
    ctx.fillRect(0, 0, w, h);
    const T = transform(view);
    grid(ctx, view, T);
    for (const s of scene.shapes ?? []) if (s) drawShape(ctx, view, T, s);
}

/* ---------------------------------------------------------------- player */

// `paint(scene, program)` decides how a scene reaches the screen — the 2D
// canvas, the three.js view, or the 2D canvas fed by a projection. The player
// itself does not care, which is what lets one transport drive all three.
export function makePlayer({ paint, onFrame }) {
    let program = null, t = 0, playing = false, speed = 0.15, last = 0, dir = 1;

    function draw() {
        if (!program) return;
        const tt = program.steps ? Math.round(t * (program.steps - 1)) / (program.steps - 1) : t;
        const scene = program.frame(tt);
        paint(scene, program);
        onFrame({ t: tt, note: scene.note ?? "", program });
    }

    function tick(now) {
        if (playing && program) {
            const dt = last ? (now - last) / 1000 : 0;
            t += dir * speed * dt;
            if (t >= 1) { t = program.pingpong ? 1 : 0; if (program.pingpong) dir = -1; }
            if (t <= 0) { t = 0; if (program.pingpong) dir = 1; }
            draw();
        }
        last = now;
        requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);

    return {
        load(p) {
            program = p; t = 0; dir = 1;
            draw();
        },
        play() { playing = true; },
        pause() { playing = false; },
        toggle() { playing = !playing; return playing; },
        get playing() { return playing; },
        setSpeed(v) { speed = v; },
        setT(v) { t = Math.max(0, Math.min(1, v)); draw(); },
        get t() { return t; },
        step(delta) {
            playing = false;
            const n = program?.steps;
            t = n ? Math.max(0, Math.min(1, t + Math.sign(delta) / (n - 1)))
                  : Math.max(0, Math.min(1, t + delta));
            draw();
        },
        redraw: draw,
        get program() { return program; },
    };
}
