ga.ts
=====

TypeScript Geometric Algebra library.

Designed for use with the book "Projective Geometric Algebra Illuminated" by Eric Lengyel.

An algebra is built either from a signature or from an explicit basis, and an
algebra may declare a *parent* plus a transform matrix. Higher-grade transforms
are built by wedging columns of `M[1]`, and the metric follows as
`G[n] = M[n]ᵀ · G_parent[n] · M[n]`. That is what lets a null basis such as
`{e₁, e₂, e₀, e∞}` be a first-class algebra with a genuinely non-orthogonal
metric, rather than a set of helper functions layered over `R(3,1)`.

Install
-------

No npm release yet. Install straight from GitHub:

```bash
npm install github:tonycheal/ga.ts
```

The package builds itself on install, and ships compiled JavaScript with type
declarations, plus the TypeScript source.

Usage
-----

```ts
import { Algebra, GA } from "ga.ts";

// Conformal geometric algebra of the plane, as a basis change of R(3,1)
const R31 = new Algebra(3, 1, 0);
const CGA2D = new Algebra(
    [{square: 1, subscript: "1"}, {square: 1, subscript: "2"},
     {square: 0, subscript: "o"}, {square: 0, subscript: "i"}],
    {algebra: R31, transform: [[1,0,0,0],[0,1,0,0],[0,0,-1/2,1],[0,0,1/2,1]]}
);

// A Euclidean point (x, y) is x·e₁ + y·e₂ + ½(x²+y²)·e∞ + e₀
const point = (x: number, y: number) =>
    new GA(CGA2D, {e1: x, e2: y, ei: 0.5 * (x * x + y * y), eo: 1});

// Join with ∧: two points and infinity give the line through them
const line = point(0, 0).wedge(point(1, 0)).wedge(new GA(CGA2D, {ei: 1}));
```

Points are grade 1, point-pairs grade 2, lines and circles grade 3 — a line
being a circle through infinity. Join is the wedge product, meet the anti-wedge,
for every combination of object types.

Development
-----------

`bun` is the easiest runner:

```bash
bun run test-cga2d.ts && bun run test-lie2d.ts && bun run test-interpreter.ts
```

`npm run build` compiles to `dist/`, `npm run type-check` checks the whole repo.

The repository also contains `lie2d.ts`, an implementation of Lie sphere
geometry `R(3,2)` in which oriented cycles are null vectors and `X · Y = 0`
means oriented contact. It is not yet part of the package's public interface,
as the API has still to settle. See `LIESPHERE.md`.

Licence
-------

MIT — see [LICENSE](LICENSE).
