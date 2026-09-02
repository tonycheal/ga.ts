# ROADMAP.md — ga.ts

*Last reviewed 2026-09-02, after a long gap. Status of everything below is
current as of that date; see "Where we are" for what actually exists.*

## Where we are

Working and tested:

| area | file | state |
|---|---|---|
| Core algebra (basis, Cayley tables, duals, metric) | `ga.ts` | done |
| Basis change via parent algebra + transform `M[n]` / `G[n]` | `ga.ts` | done, verified |
| Operations: `gp`, `wedge`, `antiWedge`, `meet`, `reverse`, `grade`, `leftContract`, `dual`, `norm`, `normalize`, `sandwich`, `inverse` | `ga.ts` | done |
| CGA 2D — points, lines, circles, meets, reflections | `test-cga2d.ts` | 102 assertions, all pass |
| Lie sphere 2D — oriented cycles | `lie2d.ts`, `test-lie2d.ts` | 57 assertions, all pass |
| Expression interpreter (`e1 ∧ e2 ∨ e3` etc.) | `interpreter.ts`, `test-interpreter.ts` | 49 assertions, all pass |
| Symbol-entry helper app | `equation-editor/index.html` | standalone, works |

The four bugs listed in the old `CLAUDE.md` (subscript ordering, dual bitmap
complements, non-diagonal higher-grade metrics, multi-character subscripts) are
all fixed — see commit `7a88786`.

Run everything with:

```bash
bun run test-cga2d.ts && bun run test-lie2d.ts && bun run test-interpreter.ts
```

## The big shift: Lie, not just CGA

`LIESPHERE.md` records the main finding from this session: Apollonius's `lcp` /
`LCP` records already *are* Lie sphere vectors in `R(3,2)`, and the boolean
"flip" flags are the sign of the oriented-radius coordinate. That answers the
open question about how flags relate to sphere orientation, and it changes the
target algebra for the Apollonius work from CGA `R(3,1)` to Lie `R(3,2)`.

CGA does not become wrong — it stays the right tool for unoriented incidence,
and Lie contains it (`toCGA` in `lie2d.ts` is just "drop `er`"). But the
Apollonius solver wants the oriented one.

## Next steps, in order

### 1. Lie-algebra Apollonius solver  *(the main event)*

Implement, in this repo:

```ts
// find the oriented cycles in contact with all three
function apollonius(s1: GA, s2: GA, s3: GA): GA[]
```

The maths is a three-equation linear system plus the null condition
`X · X = 0`, exactly the skeleton `tan3G` already has by hand. Deliverables:

- `apollonius.ts` — solver over `LIE2D`
- `test-apollonius.ts` — the classical cases: three circles (8 solutions),
  three points, three lines (4 solutions), and the degenerate mixtures that
  currently drive `tan3G`'s `d === 0` branch into calling `tan2G`
- the two-cycle case (`tan2G`: two constraints plus a given radius) as a
  special case of the same machinery, not a separate function

Open question worth settling early: whether to solve the linear system with
matrix elimination (as `NewTanCode.ts` does) or with GA operations — the
constraint set `{X : X · Sᵢ = 0}` is the orthogonal complement of the
trivector `S₁ ∧ S₂ ∧ S₃`, so `dual(S₁ ∧ S₂ ∧ S₃)` should hand back the pencil
directly and reduce the problem to intersecting a line with the quadric. If
that works it is a genuinely shorter derivation than the existing solver, which
is the thing worth demonstrating.

### 2. The parallel experiment against Apollonius

Tony's stated goal: run the GA formulation alongside the current `tan2G` /
`tan3G` and compare. Plan:

- Keep it **in this repo**, not in Apollonius. Commit `4258feb` in
  `~/Dev/apollonius` deliberately removed `ts-geometric-algebra` and
  `ganja.js` from the shipped bundle (1.1 MB of 1.5 MB); do not put a GA
  dependency back into the app until the comparison has actually been won.
- Vendor a copy of `TanCode.ts` / `NewTanCode.ts` into a `compare/` directory
  (they have no imports, so this is a straight copy) and write a harness that
  runs both solvers over randomised and hand-picked configurations, comparing:
  **agreement** (do they find the same cycles?), **coverage** (does either miss
  solutions the other finds?), **conditioning** (near-degenerate inputs: nearly
  parallel lines, nearly equal circles, tangency at the input), and **speed**.
- Report as a table, not prose. The interesting result is most likely
  *robustness at degeneracies*, where `tan3G` has explicit `d === 0`,
  `l === 0`, `C !== 0` branches and the Lie version should have none.
- Only after that: decide whether Apollonius adopts it, and how (see 3).

### 3. Upgrade implications for Apollonius

If the comparison goes the GA way, the migration is smaller than it looks
because the data structures already match:

- `lcp` ↔ Lie vector is a five-field relabel (table in `LIESPHERE.md`), so
  Apollonius's stored geometry does not have to change at all — only the
  solver behind `callTan2` / `callTan3`.
- The `newTanCode` boolean already switches solvers at those two call sites.
  A third option is a one-line change, which makes A/B testing inside the
  live app cheap.
- **Fix the return type as part of the move.** `tan2G`/`tan3G` return `quad`
  (orientation dropped, and `c` meaning radius rather than the input's
  quadratic term — see `LIESPHERE.md`). A Lie solver naturally returns a full
  oriented cycle; returning `lcp` instead of `quad` removes a real asymmetry
  and probably some downstream sign handling.
- The `angles` parameter generalises for free: `makeCoefficients` already
  takes a continuous angle, and `cosAngle` in `lie2d.ts` is the same quantity.
  "Circle tangent to these three" and "circle meeting these three at 30°"
  become the same call.

### 4. 3D

Once 2D is settled, `R(3,2)` → `R(4,2)`: add one Euclidean basis vector, keep
everything else. `lie3d.ts` should be `lie2d.ts` with `e3` inserted; if it
isn't, something in the 2D design was too special-cased. This is the argument
for doing Apollonius in GA at all, so it is worth proving early with a small
spike (spheres tangent to four spheres) even before the 2D work is finished.

The parallel CGA line (`R(4,1)`) should get the same treatment — the existing
`test-cga2d.ts` setup should generalise to `test-cga3d.ts` with one extra
basis vector and no other changes.

### 5. Packaging (`npm`)

Tony's read — "fame rather than fortune", plenty of alternatives already —
is right, and it shapes the packaging decisions rather than arguing against
them. What that means concretely:

- **Name:** `ga.ts` is unclaimed on npm (checked 2026-09-02) and matches the
  repo. Take it. `@tonycheal/ga` is also free as a fallback.
- **Licence:** MIT. Nothing about a fame-not-fortune goal is served by a
  restrictive licence, and permissive licensing is what gets a library used.
- **Minimum viable package:** `package.json` with `exports`, TypeScript
  `declaration` output, `tsup` or plain `tsc` for a dual ESM build, and a
  `README.md` that leads with a *worked example* (the Apollonius picture) not
  a feature list. Currently `README.md` is three lines.
- **What actually earns attention** is the differentiator, and it is not
  "another GA library": it is (a) the parent-algebra/transform basis-change
  machinery, which most libraries do not expose at all, and (b) Lie sphere
  geometry with oriented cycles, which almost none of them have. Lead with
  those. `ganja.js` owns the "pretty demos" ground; do not compete there.
- **Do not** publish before the interpreter's API is stable — a tagged
  template literal in the public surface is a compatibility commitment.

Sequence: 1 → 2 → 5 → 3, with 4 as a spike whenever it is useful. Packaging
before the Apollonius migration, because a published, versioned dependency is a
cleaner thing for Apollonius to consume than a relative path across `~/Dev`.

## Smaller jobs, whenever

- **Extract the CGA 2D setup.** `CGA2D` is currently defined inline in both
  `test-cga2d.ts` and `test-interpreter.ts`. It should be `cga2d.ts`, shaped
  like `lie2d.ts`, and imported by both.
- **Delete `test.ts`.** Ten lines against an API that no longer exists
  (`new ga(3,1)`, `rebase`). It is not a test and it does not compile.
- **`ga2.ts` is a scratchpad**, not a test — its output is `console.log` dumps
  no one reads. Either turn its basis-change checks into assertions and fold
  them into a test file, or delete it.
- **Add `package.json`** even before publishing, so `bun test` / `tsc` /
  `npx tsc --noEmit` work without ceremony. There is a `tsconfig.json` but no
  `package.json`, so `npx tsc` currently fails with a confusing error.
- **The Unicode refactor** (`e₁`, `e∞`, …) described in `CLAUDE.md` is still a
  good idea and still explicitly a *late* step. Do it after the API is stable
  and before publishing, never in the same commit as a behaviour change.
