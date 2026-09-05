# visualiser

A small web app for *seeing* what the library does — oriented circles with
their arrows on, moving slowly enough to follow.

Not shipped in the npm package (`files` in `package.json` excludes it).

## Running it

The page imports the compiled library from `../dist/`, which is gitignored, so
build once first:

```bash
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

`shape(X, style)` turns a Lie multivector into something drawable; styles are
`{stroke, width, dash, label, arrows, centre}`.

## Files

| file | what it is |
|---|---|
| `index.html` | layout, controls, wiring |
| `viz.js` | canvas renderer and the player |
| `programs.js` | the demos |
| `solver.js` | **provisional** Apollonius solver — delete when `lsg.ts` lands |

`solver.js` is a stopgap so the visualiser has something to drive it. The real
one is step 1 of `ROADMAP.md`.
