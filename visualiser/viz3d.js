// 3D rendering for the ga.ts visualiser.
//
// Three pieces, all driven by the same `frame(t) -> {shapes, note}` a 2D
// program returns — only the shape kinds differ (sphere / plane / point
// instead of circle / line / point):
//
//   makeScene3D   translucent solids via three.js, orbitable
//   project       the same shapes flattened onto a picture plane, so the
//                 existing sharp 2D canvas renderer draws them unchanged
//   makeViewCube  click a face, edge or corner to snap the view
//
// Orientation is drawn the same way as in 2D: radial quills along the normal,
// out for positive radius, in for negative. That was the point of going radial
// — it needed no rethinking here.

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const AXES = {
    front:  [0, 0, 1],  back:   [0, 0, -1],
    right:  [1, 0, 0],  left:   [-1, 0, 0],
    top:    [0, 1, 0],  bottom: [0, -1, 0],
    corner: [1, 0.8, 1],
};

const up = (v) => (Math.abs(v[1]) > 0.99 ? [0, 0, 1] : [0, 1, 0]);
const norm = (v) => { const l = Math.hypot(...v) || 1; return v.map((c) => c / l); };
const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];

/* ------------------------------------------------------------- projection */

/**
 * Flatten 3D shapes onto the picture plane through the origin perpendicular
 * to `dir`, giving 2D shapes the existing canvas renderer understands.
 *
 *   sphere -> its silhouette, a circle of the same signed radius
 *   point  -> a point
 *   plane  -> its TRACE: the line where it cuts the picture plane. A plane
 *             parallel to the picture plane has no trace and is dropped.
 */
export function project(shapes, dir) {
    const v = norm(dir);
    const u = norm(cross(up(v), v));
    const w = cross(v, u);
    const flat = (p) => [p[0]*u[0] + p[1]*u[1] + p[2]*u[2], p[0]*w[0] + p[1]*w[1] + p[2]*w[2]];
    const out = [];
    for (const s of shapes) {
        if (!s) continue;
        const style = { stroke: s.stroke, width: s.width, dash: s.dash, label: s.label,
                        arrows: s.arrows, centre: s.centre };
        if (s.kind === "sphere") {
            const [x, y] = flat([s.x, s.y, s.z]);
            out.push({ kind: "circle", x, y, r: s.r, ...style });
        } else if (s.kind === "point") {
            const [x, y] = flat([s.x, s.y, s.z]);
            out.push({ kind: "point", x, y, ...style });
        } else if (s.kind === "plane") {
            const n2 = flat([s.nx, s.ny, s.nz]);
            const len = Math.hypot(n2[0], n2[1]);
            if (len < 1e-6) continue;                 // face-on: no trace
            out.push({ kind: "line", nx: n2[0]/len, ny: n2[1]/len, d: s.d/len, ...style });
        }
    }
    return out;
}

/* ---------------------------------------------------------------- 3D view */

export function makeScene3D(canvas) {
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-8, 8, 8, -8, -200, 200);
    scene.add(new THREE.AmbientLight(0xffffff, 1.6));
    const key = new THREE.DirectionalLight(0xffffff, 1.5);
    key.position.set(4, 8, 6);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.6);
    fill.position.set(-6, -3, -4);
    scene.add(fill);

    const grid = new THREE.GridHelper(20, 20);
    grid.material.opacity = 0.16;
    grid.material.transparent = true;
    scene.add(grid);

    const group = new THREE.Group();
    scene.add(group);

    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.enablePan = false;

    let halfWidth = 8;
    setDirection(AXES.corner);

    function setDirection(dir) {
        const v = norm(dir);
        camera.position.set(v[0] * 50, v[1] * 50, v[2] * 50);
        camera.up.set(...up(v));
        controls.target.set(0, 0, 0);
        camera.lookAt(0, 0, 0);
        controls.update();
    }

    function resize() {
        const w = canvas.clientWidth, h = canvas.clientHeight;
        if (!w || !h) return;
        renderer.setSize(w, h, false);
        const aspect = w / h;
        camera.left = -halfWidth * aspect; camera.right = halfWidth * aspect;
        camera.top = halfWidth; camera.bottom = -halfWidth;
        camera.updateProjectionMatrix();
    }

    function clear() {
        while (group.children.length) {
            const c = group.children.pop();
            c.traverse?.((o) => { o.geometry?.dispose?.(); o.material?.dispose?.(); });
        }
    }

    // radial quills: out for +r, in for -r — identical in meaning to 2D
    function quills(parent, origin, dirs, sign, colour, len) {
        for (const d of dirs) {
            const from = new THREE.Vector3(...origin).addScaledVector(new THREE.Vector3(...d), 0);
            const arrow = new THREE.ArrowHelper(
                new THREE.Vector3(...d).multiplyScalar(sign).normalize(),
                from, len, colour, len * 0.42, len * 0.28
            );
            parent.add(arrow);
        }
    }

    const SPOKES = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];

    function build(shapes) {
        clear();
        for (const s of shapes) {
            if (!s) continue;
            const colour = new THREE.Color(s.stroke ?? "#2E9B80");
            if (s.kind === "sphere") {
                const R = Math.abs(s.r);
                // Nested translucent spheres go muddy fast, so big ones are
                // fainter and every one gets a faint globe wireframe — that is
                // what makes the extent of each readable when they overlap.
                const op = (s.opacity ?? 0.2) * Math.min(1, 1.6 / Math.max(R, 0.8));
                const mesh = new THREE.Mesh(
                    new THREE.SphereGeometry(R, 40, 28),
                    new THREE.MeshStandardMaterial({
                        color: colour, transparent: true, opacity: op,
                        side: THREE.DoubleSide, depthWrite: false,
                        roughness: 0.45, metalness: 0.0,
                    })
                );
                mesh.position.set(s.x, s.y, s.z);
                group.add(mesh);
                const wire = new THREE.Mesh(
                    new THREE.SphereGeometry(R, 16, 10),
                    new THREE.MeshBasicMaterial({
                        color: colour, wireframe: true, transparent: true,
                        opacity: s.wire ?? 0.16, depthWrite: false,
                    })
                );
                wire.position.set(s.x, s.y, s.z);
                group.add(wire);
                if (s.arrows !== false) {
                    const sign = Math.sign(s.r) || 1;
                    const g = new THREE.Group();
                    for (const d of SPOKES) {
                        const base = [s.x + d[0]*R, s.y + d[1]*R, s.z + d[2]*R];
                        quills(g, base, [d], sign, colour, Math.max(0.35, R * 0.32));
                    }
                    group.add(g);
                }
            } else if (s.kind === "point") {
                const mesh = new THREE.Mesh(
                    new THREE.SphereGeometry(0.11, 16, 12),
                    new THREE.MeshStandardMaterial({ color: colour })
                );
                mesh.position.set(s.x, s.y, s.z);
                group.add(mesh);
            } else if (s.kind === "plane") {
                const L = halfWidth * 1.9;
                const mesh = new THREE.Mesh(
                    new THREE.PlaneGeometry(L, L),
                    new THREE.MeshStandardMaterial({
                        color: colour, transparent: true, opacity: s.opacity ?? 0.14,
                        side: THREE.DoubleSide, depthWrite: false,
                    })
                );
                const n = new THREE.Vector3(s.nx, s.ny, s.nz).normalize();
                mesh.position.copy(n).multiplyScalar(s.d);
                mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
                group.add(mesh);
                if (s.arrows !== false) {
                    const g = new THREE.Group();
                    const t1 = new THREE.Vector3(0, 0, 1).cross(n).normalize();
                    if (t1.lengthSq() < 0.5) t1.set(1, 0, 0);
                    const t2 = n.clone().cross(t1).normalize();
                    for (const [a, b] of [[0,0],[2,0],[-2,0],[0,2],[0,-2]]) {
                        const base = n.clone().multiplyScalar(s.d)
                            .addScaledVector(t1, a).addScaledVector(t2, b);
                        quills(g, [base.x, base.y, base.z], [[n.x, n.y, n.z]], 1, colour, 0.7);
                    }
                    group.add(g);
                }
            }
        }
    }

    return {
        render(shapes) { resize(); build(shapes); controls.update(); renderer.render(scene, camera); },
        redraw() { resize(); controls.update(); renderer.render(scene, camera); },
        setDirection,
        setHalfWidth(h) { halfWidth = h; resize(); },
        get cameraDirection() {
            const p = camera.position.clone().normalize();
            return [p.x, p.y, p.z];
        },
        controls, camera,
    };
}

/* --------------------------------------------------------------- viewcube */

function faceTexture(label, bg, fg) {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d");
    g.fillStyle = bg; g.fillRect(0, 0, 128, 128);
    g.strokeStyle = fg; g.globalAlpha = 0.45; g.lineWidth = 5;
    g.strokeRect(3, 3, 122, 122); g.globalAlpha = 1;
    g.fillStyle = fg; g.font = "bold 26px system-ui, sans-serif";
    g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText(label, 64, 66);
    return new THREE.CanvasTexture(c);
}

/**
 * A cube you click to change the view. Not modelled with cut corners —
 * instead the hit point is quantised, so the middle of a face gives a face
 * direction, near an edge gives an edge, near a corner gives a corner. It
 * behaves exactly like a truncated cube with 26 zones, without being one.
 */
export function makeViewCube(canvas, onPick, colours) {
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1.7, 1.7, 1.7, -1.7, 0.1, 50);
    scene.add(new THREE.AmbientLight(0xffffff, 2.2));

    // BoxGeometry face order: +x, -x, +y, -y, +z, -z
    const labels = ["R", "L", "T", "Bo", "F", "Ba"];
    const mats = labels.map((l) => new THREE.MeshBasicMaterial({
        map: faceTexture(l, colours.face, colours.text),
    }));
    const cube = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.6, 1.6), mats);
    scene.add(cube);

    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();

    canvas.addEventListener("pointerdown", (e) => {
        const r = canvas.getBoundingClientRect();
        ndc.x = ((e.clientX - r.left) / r.width) * 2 - 1;
        ndc.y = -((e.clientY - r.top) / r.height) * 2 + 1;
        ray.setFromCamera(ndc, camera);
        const hit = ray.intersectObject(cube)[0];
        if (!hit) return;
        const p = cube.worldToLocal(hit.point.clone());
        // quantise: middle of a face -> face, near an edge -> edge, near a
        // corner -> corner. 0.8 is the half-extent; 0.45 the cut-off band.
        const q = [p.x, p.y, p.z].map((c) => (Math.abs(c) > 0.45 ? Math.sign(c) : 0));
        if (q.every((c) => c === 0)) return;
        onPick(q);
    });

    function draw(dir) {
        const w = canvas.clientWidth, h = canvas.clientHeight;
        if (w && h) renderer.setSize(w, h, false);
        // the cube shows the camera's orientation
        const v = norm(dir);
        camera.position.set(v[0] * 6, v[1] * 6, v[2] * 6);
        camera.up.set(...up(v));
        camera.lookAt(0, 0, 0);
        renderer.render(scene, camera);
    }
    return { draw, AXES };
}

export { AXES };
