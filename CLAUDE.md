# CLAUDE.md — Geometric Algebra Library (ga.ts)

## Project Overview

This is a TypeScript Geometric Algebra library intended to become the mathematical
foundation for **Apollonius PDT**, a geometric construction tool originally written
in BBC BASIC in the 1990s. The library must support **Conformal Geometric Algebra (CGA)**
where points, lines, and circles are all represented uniformly as elements of the algebra.

The current target is 2D CGA: the algebra R(3,1,0) with a basis change to the null
basis (e₀, e∞) — giving a 4D algebra with 16 basis elements. The eventual target is
3D CGA: R(4,1,0) with 32 basis elements.

The code follows ideas from Eric Lengyel's "Projective Geometric Algebra Illuminated",
particularly the basis-change machinery using transform matrices M[n] and metric
tensors G[n].

## Current State

The library has:
- Basis generation from algebra signature (p,q,r)
- Cayley table generation for geometric product, wedge (outer) product, and anti-wedge (regressive) product
- Left and right duals via the pseudoscalar
- Support for custom subscripts (e.g. "m", "p" instead of "3", "4")
- Parent algebra + transform matrix for basis changes
- Higher-grade transform matrices M[n] built by wedging columns of M[1]
- Metric tensors G[n] computed as M[n]^T * G_parent[n] * M[n]
- A thin GA wrapper class pairing an Algebra with a MultiVector
- Basic matrix math utilities
- A test file (ga2.ts) exercising CGA-like basis changes

The last git commit says "Complete metric - maybe signs wrong??" — the developer was
not confident the higher-grade metrics were computing correctly.

## Files

- `ga.ts` — Main library (Algebra, GA, MatrixMath classes)
- `ga2.ts` — Test/exploration file for CGA basis changes  
- `test.ts` — Old test file from an earlier API iteration (DEAD CODE — uses old API)

## Bugs to Fix (Priority Order)

### BUG 1: String comparison in basis vector sorting (CRITICAL)

**Location:** `makeWedgeTable()` line ~188, `makeGeometricProductTable()` line ~259

**Problem:** The bubble sort that determines signs uses string comparison (`l > r`) 
on subscript characters. This compares characters lexicographically, not by their 
position in the algebra's declared basis order.

For single-digit subscripts "1"-"9" this accidentally works. But with custom 
subscripts like "m" and "p" (used in ga2.ts for the CGA null basis), the sort 
order is alphabetical, not the intended basis order.

Example: subscripts are ["1", "2", "m", "p"]. Alphabetically "1" < "2" < "m" < "p"
which happens to match the declared order — but this is coincidental. If subscripts
were ["x", "y", "o", "i"] (another common CGA convention), the sort would be wrong.

**Fix:** Replace string comparison with comparison by index in `this.subscripts`:
```typescript
// Instead of: if (l > r)
// Use: if (this.subscripts.indexOf(l) > this.subscripts.indexOf(r))
```

Or better: pre-compute a lookup map `subscriptOrder: Map<string, number>` in the
constructor and use that for O(1) lookups.

### BUG 2: Dual table bitmap complement assumption (MODERATE)

**Location:** `makeDualTable()` line ~232-233

**Problem:** Uses `basis[2^degree - 1 - a]` to find the complement of `basis[a]`.
This relies on the basis array index being the same as the bitmap value, which is
NOT true after the basis has been sorted by grade.

For example in a 3D algebra, the basis sorted by grade is:
```
index: 0    1    2    3    4    5    6    7
basis: e    e1   e2   e3   e12  e13  e23  e123
bitmap: 0   1    2    4    3    5    6    7
```

The complement of e1 (bitmap 001) should be e23 (bitmap 110 = 6), but
`basis[2^3 - 1 - 1] = basis[6] = e23` — this works by accident in this case
because the grade-sorted order happens to produce a nice symmetry. But it's
not guaranteed with custom subscript orderings.

**Fix:** Build a lookup from basis element to its bitmap, then find the complement
by looking up the element whose bitmap is `(2^degree - 1) XOR currentBitmap`.

### BUG 3: Non-diagonal metric in higher grades (MODERATE)

**Location:** Constructor, lines ~99-105

**Problem:** For algebras WITHOUT a parent, the higher-grade metric is computed as:
```typescript
this.g[bits][index][index] = this.g[1][left][left] * this.g[bits-1][right][right];
```

This only reads diagonal entries of g[1], assuming an orthogonal basis. For the
base/parent algebra (which is defined by signature and IS orthogonal), this is
actually correct. The bug would only manifest if someone tried to use a
non-orthogonal base algebra, which isn't the current use case.

**Assessment:** This is technically correct for the intended usage (base algebra is
always orthogonal; non-orthogonal metrics only arise in child algebras, which use
the M^T G M path). But add a comment explaining this assumption, and consider
asserting that g[1] is diagonal when the parent path isn't taken.

### BUG 4: Single-character subscript assumption in makeMn (LOW)

**Location:** `makeMn()` line ~391

**Problem:** `vector[1]` and `vector.slice(2)` assume each subscript is exactly
one character. With subscripts like "1", "2", "m", "p" this is fine.

**Fix (eventual):** Store basis elements as arrays of subscript strings rather than
concatenated strings, or use a proper parsing function. Not urgent for current use
cases but will bite if multi-character subscripts are ever needed.

## Operations to Add

The GA class currently only has `wedge` and `antiWedge`. For CGA geometry, add:

### Essential Operations

```typescript
class GA {
    // Already have: wedge, antiWedge

    // Geometric product — the fundamental product
    gp(b: GA): GA

    // Reverse (†) — reverses the order of basis vectors in each term
    // Grade-k part picks up factor (-1)^(k(k-1)/2)
    reverse(): GA

    // Grade selection — extract the grade-k part of a multivector
    grade(k: number): GA

    // Left contraction (⌋) — the "inner product" most useful in CGA
    // a⌋b = Σ <a_r * b_s>_{s-r}  for s >= r
    leftContract(b: GA): GA

    // Dual — maps grade-k to grade-(n-k) via the pseudoscalar
    dual(): GA      // right dual: x* = x ⌋ I⁻¹
    unDual(): GA    // left undual: x̃ = I ∧ x  (or I * x for the left version)

    // Squared norm — x * reverse(x), should be scalar
    normSquared(): number

    // Normalize — x / sqrt(|normSquared()|)
    normalize(): GA

    // Sandwich product — the fundamental operation for transformations
    // R x R† where R is a rotor/versor
    sandwich(x: GA): GA

    // Scalar product — grade-0 part of the geometric product
    scalarProduct(b: GA): number
}
```

### On the Algebra class

```typescript
class Algebra {
    // Add a pseudoscalar getter
    get pseudoscalar(): MultiVector  // the highest-grade basis element

    // Inverse of a multivector (at least for versors)
    inverse(v: MultiVector): MultiVector

    // Reverse
    reverse(v: MultiVector): MultiVector

    // Grade projection
    gradeSelect(v: MultiVector, grade: number): MultiVector

    // Left contraction via Cayley table
    leftContractionTable: CayleyTable  // build alongside existing tables
}
```

## CGA 2D Implementation Plan

### The Algebra

2D CGA is built on R(3,1) — four basis vectors where three square to +1 and
one squares to -1.

**Base (orthogonal) algebra:** R(3,1) with basis {e₁, e₂, e₊, e₋}
where e₊² = +1, e₋² = -1.

**Null basis:** Define e₀ = ½(e₋ - e₊) and e∞ = e₋ + e₊.
These satisfy e₀² = 0, e∞² = 0, e₀·e∞ = -1.

The transform matrix M[1] from the working basis {e₁, e₂, e₀, e∞} to the
parent basis {e₁, e₂, e₊, e₋} is:

```
         e₁  e₂  e₀   e∞
    e₁ [  1   0   0    0  ]
    e₂ [  0   1   0    0  ]
    e₊ [  0   0  -1/2  1  ]
    e₋ [  0   0   1/2  1  ]
```

(Reading column-wise: e₀ maps to -½e₊ + ½e₋, e∞ maps to e₊ + e₋)

Note: The ga2.ts file has this partially set up but with subscripts "m" and "p"
instead of "+" and "-". The transform matrix in ga2.ts is:
```
[[1,0,0,0], [0,1,0,0], [0,0,1/2,1], [0,0,-1/2,1]]
```
which maps e₃ → ½e_m - ½e_p and e₄ → e_m + e_p. Check the signs carefully
against the convention above — the sign convention for e₀ vs e∞ matters and
Lengyel uses a specific one.

### Representing Geometric Objects

In CGA 2D, with the null basis {e₁, e₂, e₀, e∞}:

**Point:** Given Euclidean coordinates (x, y), the CGA point is:
```
P = x·e₁ + y·e₂ + ½(x² + y²)·e∞ + e₀
```

**Point pair:** The wedge of two points: `P ∧ Q` (a bivector)

**Line:** The wedge of two points and e∞: `P ∧ Q ∧ e∞` (a trivector)
Or equivalently: a circle through infinity.

**Circle:** The wedge of three points: `P ∧ Q ∧ R` (a trivector)

Note: Lines and circles are BOTH trivectors in 2D CGA. A line is just a circle
that passes through the point at infinity. This is the beautiful uniformity that
makes CGA perfect for Apollonius.

### Key Operations for Apollonius

**Construct line through two points:**
```
L = P ∧ Q ∧ e∞
```

**Construct circle through three points:**
```
C = P ∧ Q ∧ R
```

**Intersection of two circles/lines** (the "meet"):
```
PP = C₁ ∨ C₂    (anti-wedge / regressive product)
```
This gives a point-pair. Extract the two points by:
```
P± = PP ± sqrt(PP²)  (simplified; actual extraction needs care)
```

**Perpendicular from point to line:**
```
foot = (P · L) · L⁻¹    (projection)
```

**Reflection of point in line:**
```
P' = L · P · L⁻¹    (sandwich product)
```

**Inversion in circle:**
```
P' = C · P · C⁻¹    (sandwich product)
```

**Distance between points:**
```
d² = -2(P · Q)    (inner product of normalized CGA points)
```

**Tangent line to circle at point:**
```
T = P ⌋ C ∧ e∞
```

### Setup Code

```typescript
// Parent: orthogonal R(3,1)
const R31 = new Algebra(3, 1, 0);

// Child: CGA with null basis
const CGA2D = new Algebra(
    [
        {square: 1, subscript: "1"},
        {square: 1, subscript: "2"},
        {square: 0, subscript: "o"},   // e₀ (origin), squares to 0 in null basis
        {square: 0, subscript: "i"},   // e∞ (infinity), squares to 0 in null basis
    ],
    {
        algebra: R31,
        transform: [
            [1, 0,  0,    0],
            [0, 1,  0,    0],
            [0, 0, -1/2,  1],
            [0, 0,  1/2,  1]
        ]
    }
);

// Convenience: basis vectors
const e1 = new GA(CGA2D, {e1: 1});
const e2 = new GA(CGA2D, {e2: 1});
const eo = new GA(CGA2D, {eo: 1});   // origin
const ei = new GA(CGA2D, {ei: 1});   // infinity

// CGA point from Euclidean (x, y)
function point(x: number, y: number): GA {
    return new GA(CGA2D, {
        e1: x,
        e2: y,
        ei: 0.5 * (x*x + y*y),
        eo: 1
    });
}
```

**Note on subscripts:** Using "o" and "i" for origin and infinity is one convention.
Lengyel may use different notation. The subscript choice doesn't affect the maths
as long as the transform matrix is correct. The squares declared in the child
algebra's BasisMap are what the child basis vectors square to (both 0 for null
vectors), but the ACTUAL metric is computed from M^T G_parent M, which will give
the correct off-diagonal terms (e₀·e∞ = -1).

## Test Cases

### Test 1: Basic Wedge Product Signs

```typescript
const R3 = new Algebra(3, 0, 0);  // Plain 3D Euclidean
// e1 ∧ e2 = e12
// e2 ∧ e1 = -e12
// e1 ∧ e1 = 0
// e1 ∧ e23 = e123
// e12 ∧ e3 = e123
// e13 ∧ e2 = -e123  (one swap: e132 → e123)
```

### Test 2: Geometric Product in R(2,0,0)

```typescript
const R2 = new Algebra(2, 0, 0);
// e1 * e1 = 1 (scalar)
// e1 * e2 = e12
// e2 * e1 = -e12
// e12 * e12 = -1  (e12*e12 = e1*e2*e1*e2 = -e1*e1*e2*e2 = -1)
// (e1 + e2) * (e1 - e2) = e1*e1 - e1*e2 + e2*e1 - e2*e2 = 1 - e12 - e12 - 1 = -2*e12
```

### Test 3: Geometric Product in R(2,1,0) (Minkowski-like)

```typescript
const R21 = new Algebra(2, 0, 1);  // e1²=0, e2²=1, e3²=1 (with zero first)
// Actually let's use R(2,1):
const R21 = new Algebra(2, 1, 0);  // e1²=1, e2²=1, e3²=-1
// e3 * e3 = -1
// e13 * e13 = -e1*e3*e1*e3 = +e1*e1*e3*e3 = 1*(-1) = -1
// Hmm, let's be careful:
// e13 * e13 = e1*e3*e1*e3
//   swap e3,e1 in middle: = -e1*e1*e3*e3 = -(+1)(-1) = +1
```

### Test 4: CGA 2D — Null vector properties

```typescript
// After setting up CGA2D as above:
// e₀ · e₀ = 0  (null vector)
// e∞ · e∞ = 0  (null vector)
// e₀ · e∞ = -1
// These should come from the metric g[1], which should be:
//   e1  e2  eo  ei
// [[1,  0,  0,  0],
//  [0,  1,  0,  0],
//  [0,  0,  0, -1],
//  [0,  0, -1,  0]]
```

### Test 5: CGA 2D — Circle through three points

```typescript
// Points: A=(1,0), B=(0,1), C=(-1,0)
const A = point(1, 0);   // e1 + 0.5*ei + eo
const B = point(0, 1);   // e2 + 0.5*ei + eo
const C = point(-1, 0);  // -e1 + 0.5*ei + eo

// Circle through A, B, C
const circle = A.wedge(B).wedge(C);

// This should be a circle centred at (0, 0) with radius 1.
// The circle trivector encodes centre and radius.
// To verify: compute circle.normSquared() — should relate to radius.
```

### Test 6: CGA 2D — Line as circle through infinity

```typescript
// Line through A=(1,0) and B=(0,1)
const A = point(1, 0);
const B = point(0, 1);
const line = A.wedge(B).wedge(ei);  // ei = e∞

// This should be a line (a circle through infinity)
// Verify: line contains e∞ in its factorisation
```

### Test 7: CGA 2D — Intersection of two lines

```typescript
// Line 1: through (0,0) and (1,1) — the line y=x
// Line 2: through (1,0) and (0,1) — the line x+y=1
const O = point(0, 0);
const A = point(1, 1);
const B = point(1, 0);
const C = point(0, 1);

const L1 = O.wedge(A).wedge(ei);
const L2 = B.wedge(C).wedge(ei);

// Meet (anti-wedge) should give a point-pair or point
const meet = L1.antiWedge(L2);
// The intersection point should be (0.5, 0.5)
```

### Test 8: CGA 2D — Intersection of line and circle

```typescript
// Unit circle centred at origin
const P1 = point(1, 0);
const P2 = point(0, 1);
const P3 = point(-1, 0);
const circle = P1.wedge(P2).wedge(P3);

// Horizontal line y = 0 (the x-axis)
const A = point(0, 0);
const B = point(1, 0);
const xAxis = A.wedge(B).wedge(ei);

// Meet should give point-pair at (1,0) and (-1,0)
const meet = circle.antiWedge(xAxis);
```

## Architecture Notes for Apollonius Integration

### Current Apollonius Architecture
Apollonius currently represents geometric objects (points, lines, circles) with
separate types and has specific intersection/construction routines for each
combination (line-line, line-circle, circle-circle). This works but doesn't scale
to 3D (where you'd need point, line, plane, circle, sphere and all their pairwise
intersections).

### CGA Advantage
With CGA, ALL geometric objects are just multivectors in the same algebra:
- Points are grade-1 (vectors) in the null representation
- Point-pairs are grade-2 (bivectors)  
- Lines and circles are grade-3 (trivectors)
- The pseudoscalar is grade-4

ALL constructions use the same operations:
- Join (through) = wedge product
- Meet (intersection) = anti-wedge product
- Reflection/inversion = sandwich product
- Distance = inner product

### Suggested Apollonius Refactor Path
1. Get CGA 2D working with all operations in this library
2. Build a thin geometry layer on top:
   - `cgaPoint(x, y)` → CGA multivector
   - `euclideanPoint(cgaPoint)` → {x, y} (extract Euclidean coords)
   - `cgaCircle(cx, cy, r)` → CGA multivector (from centre + radius)
   - `cgaLine(a, b, c)` → CGA multivector (from ax + by + c = 0)
3. Replace Apollonius intersection routines with `antiWedge`
4. Replace Apollonius construction routines with `wedge`
5. For 3D: change CGA2D to CGA3D (add one basis vector), and the geometry
   layer gains planes and spheres — all the algebra code stays the same

## Lengyel Basis Ordering Note

Lengyel orders basis vectors with the degenerate/special dimensions FIRST, which
is unusual. Most GA literature puts them last. The library supports arbitrary
ordering via the BasisMap/subscript system, so either convention can be used.

The developer's preference is to NOT follow Lengyel's ordering, finding it
"un-memorable". The basis-change machinery (parent algebra + transform) means the
internal ordering doesn't matter as long as the transform matrix is correct.

For consistency with most GA literature, this library defaults to:
- Euclidean dimensions first (e₁, e₂, ...)
- Special dimensions last (e₊, e₋ for CGA; e₀ for PGA)

## Late-Stage Refactor: Unicode Mathematical Notation

Once the library is functionally complete and tested, refactor all basis vector
names and subscripts to use proper Unicode mathematical characters. This makes
the code and output read like actual mathematics. The developer will no longer
be able to edit the code by hand (only AI-assisted editing from this point),
so keyboard-friendliness is not a concern.

### Subscript Mapping

| Meaning       | Before | After | Unicode   |
|---------------|--------|-------|-----------|
| basis 1       | "1"    | "₁"  | U+2081    |
| basis 2       | "2"    | "₂"  | U+2082    |
| basis 3       | "3"    | "₃"  | U+2083    |
| basis 4       | "4"    | "₄"  | U+2084    |
| basis 5       | "5"    | "₅"  | U+2085    |
| plus          | "p"    | "₊"  | U+208A    |
| minus         | "m"    | "₋"  | U+208B    |
| origin (e₀)   | "o"    | "₀"  | U+2080    |
| infinity (e∞) | "i"    | "∞"  | U+221E    |

All of these are valid JavaScript/TypeScript identifier characters (BMP, single
UTF-16 code unit, in the Unicode ID_Continue category), so they work in both
object property keys AND variable names:

```typescript
const e₁ = new GA(CGA2D, {e₁: 1});
const e∞ = new GA(CGA2D, {e∞: 1});
const circle = e₁.wedge(e₂).wedge(e₃);  // reads like maths
```

### What to Refactor

1. **BasisMap subscripts:** Change `{square: 1, subscript: "1"}` to
   `{square: 1, subscript: "₁"}` etc.

2. **Default subscript generation** in the Algebra constructor: generate "₁", "₂"
   etc. instead of "1", "2" using: `String.fromCharCode(0x2080 + n)` for digits 0-9.

3. **Variable names** in test/usage code: `e₁`, `e₂`, `e₀`, `e∞` instead of
   `e1`, `e2`, `eo`, `ei`.

4. **toString() output:** Will automatically produce `e₁₂∞` instead of `e12i`
   since it already concatenates subscripts.

5. **Consider also** using Unicode operators in toString():
   - `∧` (U+2227) for wedge product display
   - `∨` (U+2228) for anti-wedge display  
   - `·` (U+00B7) for inner product display

### Safety Notes

- All characters listed are in the Basic Multilingual Plane, so `.length` and
  string indexing work correctly (single UTF-16 code unit each).
- The existing string manipulation code (e.g. `vector[1]`, `.split("")`,
  `.substring()`) will continue to work unchanged.
- Object property access with these characters is fine: `mv["e₁₂"]` and
  `mv.e₁₂` both work.
- Do NOT use this refactor as an opportunity to change the internal architecture —
  it's purely a renaming/reskinning pass.

## Development Environment

- TypeScript (runs with ts-node, Deno, or Bun)
- No build system yet — just raw .ts files
- Git repo on Bitbucket (consider migrating to GitHub)
- JetBrains IDE (.idea directory present)

## Quick Start for Claude Code

1. Read ga.ts thoroughly — it's ~510 lines, the entire library
2. Ignore test.ts — it's dead code from an old API
3. ga2.ts is the most recent test/exploration file
4. Start with BUG 1 (string comparison) as it affects correctness of everything
5. Then add the missing operations (geometric product on GA class, reverse, grade select)
6. Then write proper CGA 2D tests following the test cases above
7. The basis-change machinery SHOULD work once BUG 1 is fixed — verify with the g[1] metric test (Test 4)
