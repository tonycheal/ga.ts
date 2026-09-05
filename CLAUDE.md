# CLAUDE.md — ga.ts

## What this is

A TypeScript Geometric Algebra library, written from scratch, intended to
become the mathematical foundation for **Apollonius PDT** (`~/Dev/apollonius`)
— a geometric construction tool that began life in BBC BASIC in the 1990s.

The point of using GA is uniformity: points, lines, circles (and later planes
and spheres) are all elements of one algebra, so "through" is always the wedge
product and "intersect" is always the anti-wedge, instead of a case analysis
over every pair of object types. That is what makes the 3D version tractable.

The basis-change machinery follows Eric Lengyel's *Projective Geometric Algebra
Illuminated* — transform matrices `M[n]` and metric tensors `G[n]` — but see
"Conventions" below for where this library deliberately departs from his
notation.

**Start here:** `ROADMAP.md` for current state and next steps, `LIESPHERE.md`
for the Lie sphere geometry finding that shapes the Apollonius work.

## Files

| file | what it is |
|---|---|
| `ga.ts` | the library — `Algebra`, `GA`, `MatrixMath` (~830 lines) |
| `lie2d.ts` | Lie sphere geometry `R(3,2)`: oriented cycles in the plane |
| `interpreter.ts` | expression language — `e1 ∧ e2 ∨ e3` evaluated against an `Algebra` |
| `test-cga2d.ts` | CGA 2D tests, 102 assertions |
| `test-lie2d.ts` | Lie sphere tests, 66 assertions |
| `test-interpreter.ts` | interpreter tests, 49 assertions |
| `LIESPHERE.md` | why Apollonius's `lcp` records are Lie sphere vectors |
| `RIPPLES.html` | the same thing in plain English, open it in a browser |
| `PUREGEOMETRY.md` | design doc for the expression language |
| `visualiser/` | web app: watch oriented circles move — `npm run build` first |
| `equation-editor/index.html` | standalone symbol-entry helper |
| `ga2.ts` | scratchpad, `console.log` dumps — not a test |
| `test.ts` | **dead code**, an API that no longer exists — ignore it |

## Running things

TypeScript, no build system. `bun` is installed and is the easiest runner:

```bash
bun run test-cga2d.ts && bun run test-lie2d.ts && bun run test-interpreter.ts
```

There is a `tsconfig.json` but **no `package.json`**, so `npx tsc --noEmit`
fails with a misleading "this is not the tsc command" error. Adding one is on
the roadmap.

## The architecture in one page

**`Algebra`** is constructed either from a signature — `new Algebra(3, 1, 0)`
for `R(3,1)` — or from an explicit list of `{square, subscript}` basis maps.
On construction it builds the whole multiplication apparatus eagerly: the
basis sorted by grade, bitmap lookups both ways, the metric tensors `g[n]`,
the transform matrices `m[n]`, and Cayley tables for the geometric product,
wedge, anti-wedge, plus left and right dual tables.

**Basis change** is the interesting part. An algebra may declare a *parent*
plus a transform matrix:

```ts
const R31  = new Algebra(3, 1, 0);
const CGA2D = new Algebra(
    [{square: 1, subscript: "1"}, {square: 1, subscript: "2"},
     {square: 0, subscript: "o"}, {square: 0, subscript: "i"}],
    {algebra: R31, transform: [[1,0,0,0],[0,1,0,0],[0,0,-1/2,1],[0,0,1/2,1]]}
);
```

Columns of the transform give each child basis vector in terms of the parent's.
Higher-grade transforms `M[n]` are built by wedging columns of `M[1]`, and the
metric follows as `G[n] = M[n]ᵀ · G_parent[n] · M[n]`. This is what lets the
null basis `{e₁, e₂, e₀, e∞}` be a first-class algebra with a genuinely
non-orthogonal metric (`e₀ · e∞ = -1`) rather than a set of helper functions
layered over `R(3,1)`. Nothing else in the library needs to know.

The `squares` declared for a child algebra are documentation; the *real* metric
comes from `MᵀGM`.

**`GA`** is a thin wrapper pairing an `Algebra` with a `MultiVector` (a plain
`{[basisName]: coefficient}` object), so expressions chain:
`a.wedge(b).wedge(c).normalize()`.

## The two algebras in play

**CGA 2D — `R(3,1)`, 16 basis elements.** Unoriented incidence geometry.
Points are grade 1, point-pairs grade 2, lines *and* circles grade 3 (a line is
a circle through infinity). Join with `∧`, meet with `∨`. Fully tested in
`test-cga2d.ts`. The setup is currently duplicated inline in that file and in
`test-interpreter.ts` — extracting it to `cga2d.ts` is on the roadmap.

A point at Euclidean `(x, y)` is `x·e₁ + y·e₂ + ½(x²+y²)·e∞ + e₀`.

**Lie sphere 2D — `R(3,2)`, 32 basis elements.** CGA plus one basis vector
`e_r` with `e_r² = -1` carrying the *signed* radius, so cycles are oriented.
Every cycle is a null vector; `X · Y = 0` means oriented contact. This is the
algebra Apollonius actually wants, because its `lcp` records already are Lie
vectors and its flip flags already are the sign of `e_r`. See `LIESPHERE.md`.

General pattern: CGA of Rⁿ is `R(n+1, 1)`; Lie of Rⁿ is `R(n+1, 2)`. Going to
3D adds one Euclidean basis vector and changes nothing else.

## Conventions

**Basis ordering.** Lengyel puts the degenerate/special dimensions *first*.
This library does the opposite, and deliberately: Euclidean dimensions first
(`e₁`, `e₂`, …), special ones last (`e₀`, `e∞`, `e_r`). Tony finds Lengyel's
order un-memorable, and the basis-change machinery means internal ordering does
not matter as long as the transform matrix is right.

**Subscripts** are arbitrary strings, and sort order comes from their position
in `this.subscripts`, not from string comparison. Multi-character subscripts
work. `parseSubscripts` handles the splitting.

**Null basis names.** `o` for the origin `e₀`, `i` for infinity `e∞`, `r` for
the Lie radius. Parent algebras use plain numeric subscripts.

## Planned late-stage refactor: Unicode notation

Once the API is stable and *before* publishing, rename subscripts to real
mathematical characters so the code reads like maths: `"1"` → `"₁"` (U+2081),
`"o"` → `"₀"` (U+2080), `"i"` → `"∞"` (U+221E), `"p"`/`"m"` → `"₊"`/`"₋"`
(U+208A/U+208B). All are BMP, single UTF-16 code units, and valid JavaScript
identifier characters, so `const e₁ = new GA(CGA2D, {e₁: 1})` works and the
existing string handling needs no changes. `toString()` then produces `e₁₂∞`
for free.

Two rules: this is a *pure rename*, never combined with a behaviour change;
and it goes in its own commit.

## Working notes

- Tony's own preference, recorded across his repos: **no git worktrees** —
  work directly on `main`.
- Apollonius commit `4258feb` (2026-09-01) removed `ts-geometric-algebra` and
  `ganja.js` from the app bundle, explicitly noting that the comparison against
  a GA formulation is still worth doing, *against this library*. Do not add a
  GA dependency back to Apollonius before that comparison is done.
- The repo is on GitHub at `tonycheal/ga.ts` (migrated from Bitbucket).
