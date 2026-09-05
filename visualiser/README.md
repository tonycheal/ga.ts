# visualiser

A small web app for *seeing* what the library does — oriented circles and
spheres with their quills on, moving slowly enough to follow.

Two dimensions and two view modes:

- **2D** — `R(3,2)`, sharp canvas, as before
- **3D solid** — `R(4,2)`, translucent spheres in three.js, orbitable
- **3D projection** — the same scene flattened onto a picture plane and drawn
  by the *same* 2D renderer: a sphere becomes its silhouette, a plane becomes
  its trace. A plane parallel to the picture plane has no trace and is dropped.

The **viewcube** top right snaps the view. It is not modelled with cut
corners — the hit point is quantised instead, so the middle of a face gives a
face direction, near an edge an edge, near a corner a corner. It behaves like
a truncated cube with 26 zones without being one. Drag anywhere else in the
3D view to orbit by hand.

Not shipped in the npm package (`files` in `package.json` excludes it).

## Running it

The page imports the compiled library from `../dist/` and three.js from
`../node_modules/`, both gitignored, so install and build once first:

```bash
npm install          # three.js, for the 3D view
npm run build
python3 -m http.server 8777
```

Then open <http://localhost:8777/visualiser/>.

## Adding a program

A program is a function of one number:

```js
{
  name: "What it shows",
  blurb: "One sentence for the sidebar.",
  frame(t) {                    // t runs 0..1
    return { shapes: [...], note: "readout line" };
  },
  steps: 8,                     // optional: advance in discrete jumps
  pingpong: true,               // optional: bounce instead of loop
  halfWidth: 7, cx: 2, cy: 1,   // optional: starting view
}
```

Because it is a function of `t` rather than a generator, play, pause, step,
scrub and reverse all come for free, and interpolation is the program's own
business — usually one `lerp`. Push it onto `PROGRAMS` at the bottom of
`programs.js`.

`shape(X, style)` turns a Lie multivector into something drawable. 2D styles
are `{stroke, width, dash, label, arrows, centre}`; 3D adds `{opacity, wire}`.

A 3D program is the same shape as a 2D one — only the kinds differ (sphere /
plane / point instead of circle / line / point), and the solve takes n+1
constraints, so four spheres rather than three circles. Put it in
`PROGRAMS_3D` in `programs3d.js`.

## Files

| file | what it is |
|---|---|
| `index.html` | layout, controls, wiring |
| `viz.js` | 2D canvas renderer and the player |
| `viz3d.js` | three.js scene, the projection, and the viewcube |
| `programs.js` | the 2D demos |
| `programs3d.js` | the 3D demos — ports of the 2D ones |
| `solver.js` | **provisional** Apollonius solver — delete when `lsg.ts` lands |

`solver.js` is a stopgap so the visualiser has something to drive it. The real
one is step 1 of `ROADMAP.md`.
