# PUREGEOMETRY.md — GA Expression Interpreter

## Overview

A minimal expression language for Geometric Algebra that lets you write
mathematical notation directly and get multivector results back. No control
flow, no functions, no conditionals — just pure algebraic expressions.

Inspired by ganja.js's inline algebra evaluation, but designed to work with
our ga.ts library and to support beautiful Unicode mathematical notation
alongside ASCII fallbacks.

## The Language

### Grammar

A program is a sequence of statements separated by semicolons or newlines:

```
program    = statement ((";" | "\n") statement)*
statement  = name "=" expr
expr       = term (("+"|"-") term)*
term       = factor (("∧"|"^"|"∨"|"v"|"*"|"⌋"|"|") factor)*
factor     = ("~"|"!"|"-") factor | atom
atom       = number basis_vector | number | basis_vector | name | "(" expr ")"
           | name "(" expr ("," expr)* ")"
```

### Operator Precedence (highest to lowest)

| Precedence | Operators           | Meaning                    | Assoc |
|------------|---------------------|----------------------------|-------|
| 1 (highest)| `~` `!` unary `-`  | reverse, dual, negation    | right |
| 2          | `*` `⌋` `\|`       | geometric product, left contraction | left |
| 3          | `∧` `^` `∨` `v`    | wedge, anti-wedge          | left  |
| 4 (lowest) | `+` `-`            | addition, subtraction       | left  |

Note: `v` as anti-wedge only when used as a binary operator between
multivector expressions. The tokenizer needs context to distinguish from
a variable name starting with `v`. Safest approach: require `∨` for
anti-wedge in Unicode mode, allow `v` only when immediately between
expressions with no spaces (or use a different ASCII fallback like `&`).

**Alternative ASCII for anti-wedge:** Consider using `&` instead of `v` to
avoid the variable-name ambiguity entirely. So the ASCII operator set would be:
`^` (wedge), `&` (anti-wedge), `*` (geometric), `|` (contraction).

### Operators

| Unicode | ASCII | Name              | Method on Algebra         |
|---------|-------|-------------------|---------------------------|
| `∧`     | `^`   | Wedge (outer)     | `wedge(a, b)`             |
| `∨`     | `&`   | Anti-wedge (meet) | `antiWedge(a, b)`         |
| `*`     | `*`   | Geometric product | `gp(a, b)`               |
| `⌋`     | `\|`  | Left contraction  | `leftContract(a, b)`      |
| `~`     | `~`   | Reverse           | `reverse(a)`              |
| `!`     | `!`   | Dual              | `dual(a)`                 |
| `+`     | `+`   | Add               | `add(a, b)`               |
| `-`     | `-`   | Subtract          | `sub(a, b)`               |

Scalar multiplication is implicit: `3e₁` means `scale(3, {e₁: 1})`.
When `*` has a plain number on one side, it becomes `scale`.

### Basis Vector Literals

The tokenizer recognises basis vectors as `e` followed by subscript
characters. Both Unicode and ASCII forms are accepted:

| Unicode    | ASCII   | Meaning                |
|------------|---------|------------------------|
| `e₁`       | `e1`    | basis vector 1         |
| `e₂`       | `e2`    | basis vector 2         |
| `e₃`       | `e3`    | basis vector 3         |
| `e₀`       | `eo`    | origin (null basis)    |
| `e∞`       | `ei`    | infinity (null basis)  |
| `e₊`       | `ep`    | positive square        |
| `e₋`       | `em`    | negative square        |
| `e₁₂`      | `e12`   | bivector e1∧e2         |
| `e₁₂₃`     | `e123`  | trivector              |
| `e₁₂∞`     | `e12i`  | mixed basis bivector   |

The tokenizer should accept any combination of subscript characters after `e`
and look them up in the algebra's basis list. Unknown basis vectors are an error.

### Built-in Functions

| Function       | Meaning                                    |
|----------------|--------------------------------------------|
| `grade(x, k)`  | Grade-k projection of multivector x        |
| `norm(x)`      | Normalize x                                |
| `inv(x)`       | Inverse of x (for versors)                 |

Keep the function list minimal. More can be added later, but resist the urge
to build a full language. This is a calculator, not a programming language.

### Implicit Scalar-Basis Multiplication

The tokenizer should handle juxtaposition of number and basis vector:
- `3e₁` → `scale(3, {e₁: 1})`
- `-2.5e₁₂` → `scale(-2.5, {e₁₂: 1})`
- `0.5e∞` → `scale(0.5, {e∞: 1})`

This is the key readability feature — without it, you'd need `3*e₁` everywhere.

## Examples

### Simple wedge product
```
A = 3e₁ + 4e₂
B = 6e₁ + 5e₂
C = A ∧ B
```
Returns: `{A: {e₁: 3, e₂: 4}, B: {e₁: 6, e₂: 5}, C: {e₁₂: -9}}`

### CGA 2D: Circle through three points
```
A = e₁ + 0.5e∞ + e₀
B = e₂ + 0.5e∞ + e₀
C = -e₁ + 0.5e∞ + e₀
circle = A ∧ B ∧ C
```

### CGA 2D: Line and intersection
```
O = e₀
A = e₁ + e₂ + e∞ + e₀
B = e₁ + 0.5e∞ + e₀
C = e₂ + 0.5e∞ + e₀
L1 = O ∧ A ∧ e∞
L2 = B ∧ C ∧ e∞
meet = L1 ∨ L2
```

### Sandwich product (reflection)
```
L = some_line_trivector
P = some_point
reflected = L * P * ~L
```

### Mixed Unicode and ASCII (both valid)
```
A = 3e1 + 4e2
B = 6e₁ + 5e₂
C = A ^ B
D = A ∧ B
```
`C` and `D` should give identical results.

## Implementation

### Architecture

```
Input string
    ↓
Tokenizer  →  Token[]
    ↓
Parser     →  AST (expression tree)
    ↓
Evaluator  →  {[name]: MultiVector}
```

Total implementation: approximately 200-300 lines of TypeScript.

### Tokenizer

The tokenizer needs to handle:

1. **Unicode operator characters:** `∧` `∨` `⌋` `~` `!` `+` `-` `*` `(` `)` `=` `,`
2. **ASCII operator equivalents:** `^` `&` `|`
3. **Numbers:** integer and floating point, including negative (as unary minus)
4. **Basis vectors:** `e` followed by one or more subscript chars (Unicode or ASCII)
5. **Names:** alphabetic identifiers (but NOT starting with `e` followed by valid subscripts — that's a basis vector)
6. **Whitespace:** skip (but newlines are statement separators)
7. **Semicolons:** statement separators
8. **Comments:** consider `//` to end of line

Token types:
```typescript
type TokenType =
    | "number"        // 3, -2.5, 0.5
    | "basis"         // e₁, e₁₂, e∞, e12, eo
    | "name"          // A, circle, myPoint
    | "op"            // ∧ ∨ * ⌋ ~ ! + - 
    | "assign"        // =
    | "lparen"        // (
    | "rparen"        // )
    | "comma"         // ,
    | "newline"       // statement separator
    | "semicolon"     // statement separator
```

Key tokenizer decisions:
- `e` followed by subscript chars → `basis` token
- `e` followed by non-subscript → start of a `name` token
- Numbers immediately followed by `e` + subscripts → two tokens: `number` then `basis`
  (the parser handles implicit multiplication)

### Subscript Character Recognition

Build a set of valid subscript characters from the algebra's subscripts:

```typescript
// If algebra has subscripts ["₁", "₂", "₀", "∞"]
// Then also accept ASCII equivalents ["1", "2", "o", "i"]
// Build a map: "1" → "₁", "o" → "₀", etc.

const subscriptMap: Map<string, string> = new Map();
// Populate from algebra.subscripts and their ASCII equivalents
```

This way the tokenizer normalises all basis vectors to their canonical
(Unicode) form during tokenisation, and the rest of the pipeline only
deals with one representation.

### Parser

Use precedence climbing (Pratt parser style). Each operator has a
binding power:

```typescript
const bindingPower: Record<string, [number, number]> = {
    "+": [10, 11],   // left associative
    "-": [10, 11],
    "∧": [20, 21],
    "∨": [20, 21],
    "*": [30, 31],
    "⌋": [30, 31],
};

const prefixPower: Record<string, number> = {
    "~": 40,   // reverse
    "!": 40,   // dual
    "-": 40,   // unary negation
};
```

### AST Nodes

```typescript
type Expr =
    | { type: "number", value: number }
    | { type: "basis", name: string }          // e.g. "e₁₂"
    | { type: "name", name: string }           // e.g. "circle"
    | { type: "binary", op: string, left: Expr, right: Expr }
    | { type: "unary", op: string, operand: Expr }
    | { type: "call", name: string, args: Expr[] }  // grade(x, 2)
    | { type: "implicit_mul", scalar: Expr, basis: Expr }  // 3e₁

type Statement = { name: string, expr: Expr }
type Program = Statement[]
```

### Evaluator

Walk the AST, maintaining an environment of name → MultiVector bindings:

```typescript
function evaluate(program: Program, algebra: Algebra): Record<string, MultiVector> {
    const env: Record<string, MultiVector> = {};

    // Pre-populate with basis vectors
    for (const b of algebra.basis) {
        env[b] = { [b]: 1 };
    }

    for (const stmt of program) {
        env[stmt.name] = evalExpr(stmt.expr, env, algebra);
    }

    return env;
}

function evalExpr(expr: Expr, env: Record<string, MultiVector>, algebra: Algebra): MultiVector {
    switch (expr.type) {
        case "number": return { e: expr.value };  // scalar
        case "basis": return { [expr.name]: 1 };
        case "name": return env[expr.name];  // lookup
        case "implicit_mul": return algebra.scale(
            evalExpr(expr.scalar, env, algebra)["e"],
            evalExpr(expr.basis, env, algebra)
        );
        case "binary": {
            const l = evalExpr(expr.left, env, algebra);
            const r = evalExpr(expr.right, env, algebra);
            switch (expr.op) {
                case "∧": return algebra.wedge(l, r);
                case "∨": return algebra.antiWedge(l, r);
                case "*": return algebra.gp(l, r);
                case "⌋": return algebra.leftContract(l, r);
                case "+": return algebra.add(l, r);
                case "-": return algebra.sub(l, r);
            }
        }
        case "unary": {
            const v = evalExpr(expr.operand, env, algebra);
            switch (expr.op) {
                case "~": return algebra.reverse(v);
                case "!": return algebra.dual(v);
                case "-": return algebra.scale(-1, v);
            }
        }
        case "call": {
            const args = expr.args.map(a => evalExpr(a, env, algebra));
            switch (expr.name) {
                case "grade": return algebra.gradeSelect(args[0], /* extract scalar */ 0);
                case "norm": return algebra.normalize(args[0]);
                case "inv": return algebra.inverse(args[0]);
            }
        }
    }
}
```

## Integration with TypeScript

### Tagged Template Literal

The slickest integration is as a tagged template literal on the Algebra class:

```typescript
class Algebra {
    eval(strings: TemplateStringsArray, ...values: any[]): Record<string, MultiVector> {
        // Interpolate values into the template
        let source = strings[0];
        for (let i = 0; i < values.length; i++) {
            // Inject TypeScript values as named temporaries
            source += `__interp${i}__`;
            source += strings[i + 1];
        }

        // Parse and evaluate
        const program = parse(tokenize(source, this));
        const env: Record<string, MultiVector> = {};

        // Pre-inject interpolated values
        for (let i = 0; i < values.length; i++) {
            env[`__interp${i}__`] = values[i];  // must be MultiVector
        }

        return evaluate(program, this, env);
    }
}
```

Usage:
```typescript
const CGA2D = new Algebra(/* ... */);

// Direct evaluation
const result = CGA2D.eval`
    A = e₁ + 0.5e∞ + e₀
    B = e₂ + 0.5e∞ + e₀
    C = -e₁ + 0.5e∞ + e₀
    circle = A ∧ B ∧ C
`;

console.log(result.circle);  // the circle trivector

// With interpolation from TypeScript
function cgaPoint(x: number, y: number): MultiVector {
    return CGA2D.eval`P = ${x}e₁ + ${y}e₂ + ${0.5*(x*x+y*y)}e∞ + e₀`.P;
}
```

### Simple Function Call

For programmatic use without template literals:

```typescript
const result = CGA2D.evaluate("A = 3e₁ + 4e₂; B = 6e₁ + 5e₂; C = A ∧ B");
// result.C is the bivector
```

### Pretty Printer

The toString method (already on Algebra) should use Unicode when the algebra
has Unicode subscripts. Output should look like:

```
circle = A ∧ B ∧ C = 2e₁₂₀ - e₁₂∞ + 3e₁₀∞ - e₂₀∞
```

Consider also a `toTeX()` method for LaTeX output, useful for documentation
or rendering in a web UI with MathJax/KaTeX.

## Relationship to CLAUDE.md

This interpreter depends on the operations listed in CLAUDE.md being
implemented on the Algebra class. Specifically it needs:

- `wedge` (exists)
- `antiWedge` (exists)
- `gp` (geometric product — needs adding)
- `leftContract` (needs adding)
- `reverse` (needs adding)
- `dual` (partially exists via dualTable)
- `gradeSelect` (needs adding)
- `normalize` (needs adding)
- `inverse` (needs adding)
- `add`, `sub`, `scale` (exist)

So the implementation order should be:
1. Fix bugs (CLAUDE.md)
2. Add missing operations (CLAUDE.md)
3. Build the interpreter (this document)
4. Unicode refactor (CLAUDE.md — late stage)

The interpreter is a natural companion to the Unicode refactor — once
basis vectors are named with proper mathematical symbols, the interpreter
input and the internal representation use the same notation. No translation
layer needed.

## Testing the Interpreter

### Parse tests (does it tokenize and parse correctly?)
```
"A = 3e₁ + 4e₂"           → assign A = add(implicit_mul(3, e₁), implicit_mul(4, e₂))
"C = A ∧ B"                → assign C = wedge(name(A), name(B))
"x = ~A * B * ~A"          → assign x = gp(gp(reverse(A), B), reverse(A))
"g = grade(x, 2)"          → assign g = call(grade, [name(x), number(2)])
"C = A ^ B"                → same AST as "C = A ∧ B" (ASCII equivalent)
```

### Evaluation tests (does it compute correctly?)
```
// In R(2,0,0):
"A = e₁; B = e₂; C = A ∧ B"     → C = {e₁₂: 1}
"A = e₁; B = e₁; C = A ∧ B"     → C = {}  (zero — parallel)
"A = 3e₁ + 4e₂; B = A * ~A"     → B = {e: 25}  (squared norm)

// In CGA 2D:
"P = e₁ + 0.5e∞ + e₀; Q = e₂ + 0.5e∞ + e₀; L = P ∧ Q ∧ e∞"
    → L should be a line trivector
```

### Error handling
```
"A = e₇"          → error: unknown basis vector e₇ (if algebra is 4D)
"A = B + C"        → error: undefined name B
"A = 3 ∧ 4"       → either error or treat as scalar wedge (= 0)
"= e₁"            → error: missing name on left of assignment
```

## Future Possibilities (NOT for now)

- **REPL mode:** Interactive evaluation, one line at a time, maintaining state
- **Plotting integration:** `plot(circle)` renders to SVG/Canvas
- **Animation:** `t = 0..1; R = cos(t) + sin(t)e₁₂; P' = R * P * ~R`
- **Constraint solving:** Given a circle and a point, find the tangent
- **Export to Apollonius:** Convert interpreter expressions to construction steps

These are all tempting but premature. Get the basic calculator working first.
