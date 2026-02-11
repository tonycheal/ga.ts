/**
 * interpreter.ts — GA Expression Interpreter
 *
 * A minimal expression language for Geometric Algebra.
 * Parses and evaluates statements of the form:
 *
 *   A = 3e₁ + 4e₂ + 12.5e∞ + e₀
 *   circle = A ∧ B ∧ C
 *   meet = circle ∨ line
 *
 * Both Unicode (∧ ∨ ⌋ ~ !) and ASCII (^ & | ~ !) operators accepted.
 * Basis vectors accepted in both Unicode (e₁ e∞ e₀) and ASCII (e1 ei eo) forms.
 *
 * See PUREGEOMETRY.md for full language spec.
 */

import { Algebra, MultiVector } from "./ga.ts";

// ─── Token types ─────────────────────────────────────────────────────────────

type TokenType =
    | "number"      // 3, 2.5
    | "basis"       // e₁, e₁₂, e∞, e12, eo  (normalised to algebra's canonical name)
    | "name"        // A, circle, myPoint
    | "op"          // ∧ ∨ * ⌋ ~ ! + - ^ & |
    | "assign"      // =
    | "lparen"      // (
    | "rparen"      // )
    | "comma"       // ,
    | "newline"     // statement separator
    | "semicolon"   // statement separator
    | "eof";

interface Token {
    type: TokenType;
    value: string;       // raw text (or canonical basis name for "basis" tokens)
    pos: number;         // position in source for error messages
}

// ─── AST node types ───────────────────────────────────────────────────────────

type Expr =
    | { type: "number";       value: number }
    | { type: "basis";        name: string }           // e.g. "e12" (canonical)
    | { type: "name";         name: string }           // e.g. "circle"
    | { type: "binary";       op: string; left: Expr; right: Expr }
    | { type: "unary";        op: string; operand: Expr }
    | { type: "implicit_mul"; scalar: number; basis: string }  // 3e₁  →  scalar=3, basis="e1"
    | { type: "call";         name: string; args: Expr[] };

type Statement = { name: string; expr: Expr };
type Program   = Statement[];

// ─── Interpreter error ────────────────────────────────────────────────────────

export class GAInterpreterError extends Error {
    constructor(message: string, pos?: number) {
        super(pos !== undefined ? `${message} (at position ${pos})` : message);
        this.name = "GAInterpreterError";
    }
}

// ─── Tokenizer ────────────────────────────────────────────────────────────────

/**
 * Build a map from ASCII/alternative subscript chars to the canonical
 * subscript string used by the given algebra.
 *
 * E.g. for CGA2D with subscripts ["1","2","o","i"]:
 *   "1"→"1", "2"→"2", "o"→"o", "i"→"i"
 *
 * For an algebra after Unicode refactor with subscripts ["₁","₂","₀","∞"]:
 *   "1"→"₁", "2"→"₂", "0"→"₀", "o"→"₀", "i"→"∞"
 *   and "₁"→"₁", "₂"→"₂", etc. (identity)
 */
function buildSubscriptMap(algebra: Algebra): Map<string, string> {
    const map = new Map<string, string>();

    // Unicode subscript digits U+2080..U+2089
    const unicodeSubDigits = "₀₁₂₃₄₅₆₇₈₉";
    // Unicode superscript +/- (subscript versions)
    const unicodeSubPlus  = "₊";  // U+208A
    const unicodeSubMinus = "₋";  // U+208B
    const unicodeInfinity = "∞";  // U+221E

    for (const sub of algebra.subscripts) {
        // Always map the canonical subscript to itself
        map.set(sub, sub);

        // Check if it's a Unicode subscript digit → also accept the plain digit
        const uIdx = unicodeSubDigits.indexOf(sub);
        if (uIdx !== -1) {
            map.set(uIdx.toString(), sub);
            continue;
        }

        // Check special Unicode chars and register ASCII equivalents
        if (sub === unicodeSubPlus)  { map.set("p", sub); continue; }
        if (sub === unicodeSubMinus) { map.set("m", sub); continue; }
        if (sub === unicodeInfinity) { map.set("i", sub); continue; }

        // If it looks like a plain ASCII digit already (pre-Unicode-refactor)
        if (/^[0-9]$/.test(sub)) {
            map.set(sub, sub);
            continue;
        }

        // Common ASCII-era conventions still worth supporting
        if (sub === "o") { map.set("o", sub); continue; }  // origin
        if (sub === "i") { map.set("i", sub); continue; }  // infinity
        if (sub === "p") { map.set("p", sub); continue; }  // e+
        if (sub === "m") { map.set("m", sub); continue; }  // e-

        // For anything else, accept the subscript itself
        map.set(sub, sub);
    }
    return map;
}

function tokenize(source: string, algebra: Algebra): Token[] {
    const tokens: Token[] = [];
    const subMap = buildSubscriptMap(algebra);

    // Set of all valid subscript chars accepted by this algebra (canonical + aliases)
    const validSubscriptChars = new Set(subMap.keys());

    // Unicode operator chars we treat as operators
    const unicodeOps = new Set(["∧", "∨", "⌋", "⌊"]);

    let i = 0;

    function peek(): string { return source[i] ?? ""; }
    function advance(): string { return source[i++] ?? ""; }

    function isSubscriptChar(ch: string): boolean {
        return validSubscriptChars.has(ch);
    }

    function isIdentStart(ch: string): boolean {
        return /[A-Za-z_]/.test(ch) && !unicodeOps.has(ch);
    }

    function isIdentCont(ch: string): boolean {
        return /[A-Za-z0-9_]/.test(ch);
    }

    /**
     * Try to greedily consume a sequence of subscript chars starting at position `start`
     * in `source`, normalising each accepted char through subMap, and return the
     * canonical basis name ("e" + joined subscripts) if successful.
     * Returns null if nothing is consumed.
     */
    function tryReadBasisSuffix(start: number): { canonical: string; end: number } | null {
        // Build a list of canonical subscript strings consumed
        // We need greedy matching: try longer subscripts first
        // Sort subscripts by length desc for greedy match
        const sortedSubs = [...algebra.subscripts].sort((a, b) => b.length - a.length);

        let pos = start;
        const parts: string[] = [];

        while (pos < source.length) {
            // Try each known subscript (canonical + aliases) at pos
            let matched = false;

            // First try canonical subscripts (potentially multi-char in the future)
            for (const sub of sortedSubs) {
                if (source.startsWith(sub, pos)) {
                    parts.push(sub);
                    pos += sub.length;
                    matched = true;
                    break;
                }
            }

            if (!matched) {
                // Try alias chars via subMap
                const ch = source[pos];
                if (ch && subMap.has(ch)) {
                    parts.push(subMap.get(ch)!);
                    pos++;
                    matched = true;
                }
            }

            if (!matched) break;
        }

        if (parts.length === 0) return null;

        // Look up the composed basis name in the algebra
        const basisName = "e" + parts.join("");
        if (!algebra.basis.includes(basisName)) {
            // It might be that we over-consumed; but since we're greedy and validated
            // against algebra.basis, return what we have and let the parser error.
            // Actually we DO want an error for unknown basis vectors.
            throw new GAInterpreterError(`Unknown basis vector "${basisName}"`, start);
        }

        return { canonical: basisName, end: pos };
    }

    while (i < source.length) {
        const pos = i;
        const ch = peek();

        // Skip horizontal whitespace
        if (ch === " " || ch === "\t" || ch === "\r") { advance(); continue; }

        // Comments
        if (ch === "/" && source[i+1] === "/") {
            while (i < source.length && source[i] !== "\n") i++;
            continue;
        }

        // Newlines → statement separator
        if (ch === "\n") {
            // Collapse multiple newlines; skip newlines after op/assign/comma/lparen
            const last = tokens[tokens.length - 1];
            if (last && last.type !== "op" && last.type !== "assign" &&
                last.type !== "comma" && last.type !== "lparen" &&
                last.type !== "newline") {
                tokens.push({ type: "newline", value: "\n", pos });
            }
            advance();
            continue;
        }

        // Semicolons → statement separator (same as newline, use "newline" type)
        if (ch === ";") {
            advance();
            const last = tokens[tokens.length - 1];
            if (last && last.type !== "newline") {
                tokens.push({ type: "newline", value: ";", pos });
            }
            continue;
        }

        // Numbers (integers and floats, but NOT sign — that's handled by unary)
        if (/[0-9]/.test(ch) || (ch === "." && /[0-9]/.test(source[i+1] ?? ""))) {
            let num = "";
            while (/[0-9]/.test(peek())) num += advance();
            if (peek() === ".") { num += advance(); while (/[0-9]/.test(peek())) num += advance(); }
            // Immediately followed by a basis vector? e.g. "3e₁"
            // Don't consume here — emit number token; parser will handle implicit mul
            tokens.push({ type: "number", value: num, pos });
            continue;
        }

        // Basis vectors and identifiers starting with "e"
        if ((ch === "e") && isSubscriptChar(source[i+1] ?? "")) {
            // Try to read a basis vector
            advance(); // consume "e"
            const basisResult = tryReadBasisSuffix(i);
            if (basisResult) {
                i = basisResult.end;
                tokens.push({ type: "basis", value: basisResult.canonical, pos });
            } else {
                // "e" not followed by valid subscripts → treat as identifier
                let name = "e";
                while (isIdentCont(peek())) name += advance();
                tokens.push({ type: "name", value: name, pos });
            }
            continue;
        }

        // Plain identifiers (not starting with "e" + subscript)
        if (isIdentStart(ch)) {
            let name = "";
            while (isIdentCont(peek())) name += advance();
            // Built-in function names stay as "name"; everything else too
            tokens.push({ type: "name", value: name, pos });
            continue;
        }

        // Unicode subscript characters used as standalone (should be after e, but just in case)
        // Single-char Unicode operators
        if (unicodeOps.has(ch)) {
            advance();
            tokens.push({ type: "op", value: ch, pos });
            continue;
        }

        // ASCII / symbol chars
        switch (ch) {
            case "+": advance(); tokens.push({ type: "op",       value: "+", pos }); break;
            case "-": advance(); tokens.push({ type: "op",       value: "-", pos }); break;
            case "*": advance(); tokens.push({ type: "op",       value: "*", pos }); break;
            case "^": advance(); tokens.push({ type: "op",       value: "∧", pos }); break;  // normalise
            case "&": advance(); tokens.push({ type: "op",       value: "∨", pos }); break;  // normalise
            case "|": advance(); tokens.push({ type: "op",       value: "⌋", pos }); break;  // normalise
            case "~": advance(); tokens.push({ type: "op",       value: "~", pos }); break;
            case "!": advance(); tokens.push({ type: "op",       value: "!", pos }); break;
            case "=": advance(); tokens.push({ type: "assign",   value: "=", pos }); break;
            case "(": advance(); tokens.push({ type: "lparen",   value: "(", pos }); break;
            case ")": advance(); tokens.push({ type: "rparen",   value: ")", pos }); break;
            case ",": advance(); tokens.push({ type: "comma",    value: ",", pos }); break;
            default:
                throw new GAInterpreterError(`Unexpected character "${ch}"`, pos);
        }
    }

    tokens.push({ type: "eof", value: "", pos: source.length });
    return tokens;
}

// ─── Parser (Pratt / precedence climbing) ────────────────────────────────────

// [left binding power, right binding power]
const INFIX_BP: Record<string, [number, number]> = {
    "+":  [10, 11],
    "-":  [10, 11],
    "∧":  [20, 21],
    "∨":  [20, 21],
    "*":  [30, 31],
    "⌋":  [30, 31],
    "⌊":  [30, 31],
};

const PREFIX_BP: Record<string, number> = {
    "~":  40,
    "!":  40,
    "-":  40,
};

function parse(tokens: Token[]): Program {
    let cursor = 0;

    function peek(): Token { return tokens[cursor]; }
    function advance(): Token { return tokens[cursor++]; }
    function eat(type: TokenType, value?: string): Token {
        const t = peek();
        if (t.type !== type || (value !== undefined && t.value !== value)) {
            throw new GAInterpreterError(
                `Expected ${value ?? type} but got "${t.value}" (${t.type})`, t.pos);
        }
        return advance();
    }

    function skipSeparators() {
        while (peek().type === "newline" || peek().type === "semicolon") advance();
    }

    function parseExpr(minBP: number = 0): Expr {
        let left = parsePrefix();

        while (true) {
            const t = peek();
            if (t.type === "eof" || t.type === "newline" || t.type === "semicolon" ||
                t.type === "rparen" || t.type === "comma" || t.type === "assign") break;

            const bp = INFIX_BP[t.value];
            if (!bp || bp[0] < minBP) break;

            advance(); // consume operator
            const right = parseExpr(bp[1]);
            left = { type: "binary", op: t.value, left, right };
        }

        return left;
    }

    function parsePrefix(): Expr {
        const t = peek();

        // Unary prefix operators
        if (t.type === "op" && PREFIX_BP[t.value] !== undefined) {
            advance();
            const bp = PREFIX_BP[t.value];
            const operand = parseExpr(bp);
            return { type: "unary", op: t.value, operand };
        }

        return parseAtom();
    }

    function parseAtom(): Expr {
        const t = peek();

        // Number — possibly followed immediately by a basis vector (implicit mul)
        if (t.type === "number") {
            advance();
            const value = parseFloat(t.value);
            const next = peek();
            if (next.type === "basis") {
                advance();
                return { type: "implicit_mul", scalar: value, basis: next.value };
            }
            return { type: "number", value };
        }

        // Basis vector literal
        if (t.type === "basis") {
            advance();
            return { type: "basis", name: t.value };
        }

        // Name — could be a variable or a function call
        if (t.type === "name") {
            advance();
            if (peek().type === "lparen") {
                // Function call
                advance(); // consume "("
                const args: Expr[] = [];
                if (peek().type !== "rparen") {
                    args.push(parseExpr(0));
                    while (peek().type === "comma") {
                        advance();
                        args.push(parseExpr(0));
                    }
                }
                eat("rparen");
                return { type: "call", name: t.value, args };
            }
            return { type: "name", name: t.value };
        }

        // Parenthesised expression
        if (t.type === "lparen") {
            advance();
            const expr = parseExpr(0);
            eat("rparen");
            return expr;
        }

        throw new GAInterpreterError(
            `Unexpected token "${t.value}" (${t.type})`, t.pos);
    }

    function parseStatement(): Statement {
        const t = peek();
        if (t.type !== "name") {
            throw new GAInterpreterError(
                `Expected variable name at start of statement, got "${t.value}"`, t.pos);
        }
        const name = t.value;
        advance();
        eat("assign");
        const expr = parseExpr(0);
        return { name, expr };
    }

    const program: Program = [];
    skipSeparators();
    while (peek().type !== "eof") {
        program.push(parseStatement());
        // After a statement, consume separator(s)
        if (peek().type === "newline" || peek().type === "semicolon") {
            skipSeparators();
        } else if (peek().type !== "eof") {
            throw new GAInterpreterError(
                `Expected newline or ";" after statement, got "${peek().value}"`, peek().pos);
        }
    }
    return program;
}

// ─── Evaluator ────────────────────────────────────────────────────────────────

export type Env = Record<string, MultiVector>;

function evalExpr(expr: Expr, env: Env, algebra: Algebra): MultiVector {
    switch (expr.type) {
        case "number":
            // A bare number is a scalar multivector
            return expr.value === 0 ? {} : { e: expr.value };

        case "basis":
            return { [expr.name]: 1 };

        case "implicit_mul":
            return algebra.scale(expr.scalar, { [expr.basis]: 1 });

        case "name": {
            const v = env[expr.name];
            if (v === undefined) {
                throw new GAInterpreterError(`Undefined variable "${expr.name}"`);
            }
            return v;
        }

        case "binary": {
            const l = evalExpr(expr.left,  env, algebra);
            const r = evalExpr(expr.right, env, algebra);
            switch (expr.op) {
                case "∧":  return algebra.wedge(l, r);
                case "∨":  return algebra.antiWedge(l, r);
                case "*":  return algebra.gp(l, r);
                case "⌋":
                case "⌊":  return algebra.leftContract(l, r);
                case "+":  return algebra.add(l, r);
                case "-":  return algebra.sub(l, r);
                default:
                    throw new GAInterpreterError(`Unknown binary operator "${expr.op}"`);
            }
        }

        case "unary": {
            const v = evalExpr(expr.operand, env, algebra);
            switch (expr.op) {
                case "~":  return algebra.reverse(v);
                case "!":  return algebra.dual(v);
                case "-":  return algebra.scale(-1, v);
                default:
                    throw new GAInterpreterError(`Unknown unary operator "${expr.op}"`);
            }
        }

        case "call": {
            const args = expr.args.map(a => evalExpr(a, env, algebra));
            switch (expr.name) {
                case "grade": {
                    // grade(x, k) — k must be a literal number in the AST
                    const kExpr = expr.args[1];
                    if (kExpr?.type !== "number") {
                        throw new GAInterpreterError(
                            'grade() second argument must be a literal number');
                    }
                    return algebra.gradeSelect(args[0], kExpr.value);
                }
                case "norm":
                    return algebra.normalize(args[0]);
                case "inv":
                    return algebra.inverse(args[0]);
                default:
                    throw new GAInterpreterError(`Unknown function "${expr.name}"`);
            }
        }
    }
}

export function evaluate(program: Program, algebra: Algebra, seed: Env = {}): Env {
    const env: Env = { ...seed };

    // Pre-populate with basis vectors so they're available as names
    for (const b of algebra.basis) {
        env[b] = { [b]: 1 };
    }

    for (const stmt of program) {
        env[stmt.name] = evalExpr(stmt.expr, env, algebra);
    }

    return env;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Parse and evaluate a GA expression string against the given algebra.
 * Returns an environment mapping all assigned names to their MultiVector values.
 * Basis vectors from the algebra are pre-seeded but not included in the returned
 * object (only user-assigned names are returned, for clarity).
 */
export function gaEvaluate(
    source: string,
    algebra: Algebra,
    seed: Env = {}
): Env {
    const tokens  = tokenize(source, algebra);
    const program = parse(tokens);
    const fullEnv = evaluate(program, algebra, seed);

    // Filter out the pre-seeded basis vector entries
    const userEnv: Env = {};
    const basisSet = new Set(algebra.basis);
    for (const k in fullEnv) {
        if (!basisSet.has(k)) userEnv[k] = fullEnv[k];
    }
    return userEnv;
}

/**
 * Tagged template literal version.
 *
 * Usage:
 *   const result = gaTemplate(CGA2D)`
 *       A = e1 + 0.5ei + eo
 *       B = e2 + 0.5ei + eo
 *       circle = A ∧ B ∧ ${C}
 *   `;
 *
 * Interpolated values (MultiVector) are injected as named temporaries __0__, __1__, etc.
 */
export function gaTemplate(algebra: Algebra) {
    return function(strings: TemplateStringsArray, ...values: MultiVector[]): Env {
        let source = strings[0];
        const injected: Env = {};
        for (let i = 0; i < values.length; i++) {
            const tmpName = `__${i}__`;
            injected[tmpName] = values[i];
            source += tmpName;
            source += strings[i + 1];
        }
        const tokens  = tokenize(source, algebra);
        const program = parse(tokens);
        const fullEnv = evaluate(program, algebra, injected);

        const userEnv: Env = {};
        const basisSet = new Set([...algebra.basis, ...Object.keys(injected)]);
        for (const k in fullEnv) {
            if (!basisSet.has(k)) userEnv[k] = fullEnv[k];
        }
        return userEnv;
    };
}
