# LIESPHERE.md — Apollonius's `lcp` is a Lie sphere vector

*Written 2026-09-02, after tracing `tan2G` / `tan3G` in `~/Dev/apollonius`.
Every numeric claim here is checked in `test-lie2d.ts` (57 assertions).*

## The finding

Apollonius represents a line/circle/point as a five-field record. Two versions
of it exist in the codebase:

```ts
// src/helpers/TanCode.ts — the shipping solver
interface lcp { a: boolean; bx: number; by: number; c: number; k: number }

// src/helpers/NewTanCode.ts — the "newTanCode" experiment
interface LCP { alpha: number; beta: number; gamma: number;
                delta: number; epsilon: number }
```

Both are **homogeneous coordinates on the Lie quadric**: the five-dimensional
space `R(3,2)` in which every oriented circle, line, point and the point at
infinity is a single null vector. This is not an analogy. The translation is
exact:

| `lcp` | `LCP` | Lie basis | meaning |
|-------|-------|-----------|---------|
| `a ? 1 : 0` | `alpha`  | `eo` | 1 for circles/points, 0 for lines |
| `bx`        | `-beta/2`  | `e1` | centre x, or normal x |
| `by`        | `-gamma/2` | `e2` | centre y, or normal y |
| `2c`        | `delta/2`  | `ei` | `(x² + y² - r²)/2`, or signed offset |
| `k`         | `epsilon/2`| `er` | **signed radius** — the orientation |

with the metric

```
        e1  e2  eo  ei  er
   e1 [  1   0   0   0   0 ]
   e2 [  0   1   0   0   0 ]
   eo [  0   0   0  -1   0 ]
   ei [  0   0  -1   0   0 ]
   er [  0   0   0   0  -1 ]
```

i.e. CGA 2D's `R(3,1)` with one extra basis vector `er`, `er² = -1`.

Under this map:

- **Every `lcp` is a null vector.** `X · X = 0` is precisely the identity
  `x² + y² - 2·(x²+y²-r²)/2 - r² = 0`. `makeCircle`, `makeLine` and
  `makePoint` all land on the quadric automatically — that is *why* the five
  fields have the shapes they do.
- **`X · Y = -½ ( d² - (r₁ - r₂)² )`** for cycles distance `d` apart.
- **`X · Y = 0` ⟺ oriented contact.** Two cycles are tangent *with matching
  sense*. Same-sign radii give internal tangency, opposite signs external.
- **`makeCoefficients(S, θ) · X = -4 (X · S)`** when `θ = 0`, verified exactly
  across all pairs of circles, lines and points. The whole "new tan code"
  linear system is a stack of Lie inner products set to zero.

## What this says about the flags

Tony's open question was how the flag settings relate to the orientation of
n-D spheres. The answer falls out:

**A flag is the sign of the `er` coordinate — nothing else.**

`makeCircle(x, y, r, flip)` sets `k = flip ? -r : r`. In the algebra that is
literally `cycle(x, y, ±r)`: the same circle, opposite orientation. The
booleans passed into `tan2G` / `tan3G` as `flags` / `angles` select which of
the 2ⁿ orientation combinations of the input cycles you are solving against,
and each combination picks out a different member of the Apollonius family.
Eight tangent circles to three given circles = eight sign patterns; that is
the whole story, and it is a statement about coordinates, not about cases.

`NewTanCode.makeCoefficients` already goes one better. Its fifth entry is

```ts
e * (angle === 180 ? -1 : Math.cos(Math.PI * angle / 180))
```

so the flag has become **cos θ**, and the condition `row · X = 0` reads "X
crosses this cycle at angle θ". Setting θ = 0 or 180 recovers the two tangency
senses; θ = 90 gives orthogonality; anything in between is the general angle
problem. `lie2d.ts` exposes the same quantity as `cosAngle(a, b)`. The
booleans were always a two-valued sample of a continuous parameter.

## Why this changes the plan

The library so far targets **CGA 2D**, `R(3,1)`, following the plan in
`CLAUDE.md`. CGA is the right algebra for *unoriented* incidence: join with
`∧`, meet with `∨`, points/lines/circles all uniform. It is verifiably working
(`test-cga2d.ts`, 102 assertions).

But CGA has no orientation coordinate. A circle and its reverse are the same
CGA vector, so CGA tangency is unsigned and the eight Apollonius solutions
collapse into "solve, then disambiguate by hand" — which is exactly the shape
of the existing `tan3G`, with its `flags[2]` sign choice on a square root and
its `flags[3]` sign flip on the output.

Lie geometry keeps the orientation and the eight solutions separate *by
construction*. The Apollonius problem in `R(3,2)` is:

> find null `X` with `X · S₁ = X · S₂ = X · S₃ = 0`

— three linear equations and one quadratic, which is precisely the algebraic
skeleton already visible in `tan3G` (eliminate to get `cx, cy, kx, ky`, then
solve `A S² + B S + C = 0`). The existing solver is a hand-derived Lie sphere
solve. Rewriting it in the algebra should be a *simplification*, not a
translation.

## Dimensional bookkeeping

| geometry of Rⁿ | CGA | Lie |
|---|---|---|
| plane, n = 2 | `R(3,1)`, 4 dims, 16 basis elements | `R(3,2)`, 5 dims, 32 |
| space, n = 3 | `R(4,1)`, 5 dims, 32 | `R(4,2)`, 6 dims, 64 |

General rule: CGA of Rⁿ is `R(n+1, 1)`; Lie of Rⁿ is `R(n+1, 2)`. The upgrade
from 2D to 3D adds one Euclidean basis vector and nothing else — the `er`
machinery, the null condition and the contact condition are identical. That is
the real payoff for Apollonius: the 3D version of the solver is the same code
over a bigger algebra, rather than a new set of case analyses for
point/line/plane/circle/sphere pairs.

## One wrinkle to be aware of

`tan2G` and `tan3G` take `lcp` (five fields, orientation included) but return
`quad` (four fields, orientation dropped), and the returned `c` does not mean
what the input `c` means: for `a === true` results, `c` carries the **radius**
(`tan2G` does `if (a) { c = k; }` explicitly, and `tan3G`'s circle branch sets
`cp = S / C` with the comment "Circle radius"). Verified: three unit circles
at (0,0), (4,0), (2,3) give `{a: true, bx: 2, by: 0.8333, c: 3.1667}`, and
3.1667 is the circumradius + 1, not `(x² + y² - r²)/4`.

So the solver's output is not directly re-injectable as an input, and the
orientation of the answer — which the Lie solve determines — is thrown away.
Any GA replacement should return a full oriented `lcp`, and that alone may fix
downstream sign fiddling.

## Files

- `lie2d.ts` — the `R(3,2)` algebra, `cycle`/`point`/`line`, `inner`,
  `inContact`, `cosAngle`, `decode`, `toCGA`.
- `test-lie2d.ts` — 57 assertions covering all of the above.
