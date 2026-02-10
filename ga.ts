export interface MultiVector { [key: string]: number}
export interface CayleyTable {
    [key: string]:
        {
            [key: string]: MultiVector;
        }
}
export interface DualTable { [key: string]: MultiVector}
export interface BasisMap {square: number, subscript: string}

function isBasisMap(map: number[] | BasisMap[]):map is BasisMap[] {
    return typeof map[0] !== 'number';
}
export class Algebra {
    public parent: Algebra | null;
    public positive: number;
    public negative: number;
    public zero: number;
    public degree: number;
    public transform: Matrix;
    public squares: number[];
    public subscripts: string[];
    public basis: string[];
    public basisGrades: string[][];
    public onesMap: number[][];
    public geometricProductTable: CayleyTable = {};
    public wedgeTable: CayleyTable = {};
    public antiWedgeTable: CayleyTable = {};
    public leftDualTable: DualTable = {};
    public rightDualTable: DualTable = {};
    public m: Matrix[] = []; // root
    public g: Matrix[] = []; // metric
    public debug: Matrix[] = [];
    public subscriptOrder: Map<string, number> = new Map();
    public basisBitmap: Map<string, number> = new Map();
    public bitmapBasis: Map<number, string> = new Map();
    constructor(positive: number | number[] | BasisMap[]= 3, negative: number  | {algebra: Algebra, transform: Matrix} = 1, zero: number = 0) {
        this.parent = null;
        if (Array.isArray(positive)) {
            if (!isBasisMap(positive)) {
                this.squares = positive;
                this.subscripts = [];
                for (let index = 0; index < this.squares.length; index++) {
                    this.subscripts[index] = (index + 1).toString();
                }
             } else {
                if (typeof negative !== "number") {
                    this.parent = negative.algebra;
                }
                this.squares = positive.map((basisMap) => basisMap.square);
                this.subscripts = positive.map((basisMap) => basisMap.subscript);
            }
            this.positive = this.squares.filter((s) => s > 0).length;
            this.negative = this.squares.filter((s) => s < 0).length;
            this.zero = this.squares.filter((s) => s === 0).length;
        } else {
            this.positive = positive;
            this.negative = negative as number; // must be number if positive is number
            this.zero = zero;
            const empty = [] as number[];
            this.squares = empty
                .concat(new Array(this.zero).fill(0))
                .concat(new Array(this.positive).fill(1))
                .concat(new Array(this.negative).fill(-1))
            this.subscripts = [];
            for (let index = 0; index < this.squares.length; index++) {
                this.subscripts[index] = (index + 1).toString();
            }
        }
        this.degree = this.squares.length;
        this.subscripts.forEach((s, i) => this.subscriptOrder.set(s, i));
        if (typeof negative === 'number') {
            this.transform = MatrixMath.create(this.degree, this.degree, 1); // identity
        } else {
            this.transform = negative.transform;
        }
        const {b, onesMap, bitmaps} = this.makeBasis();
        this.basis = b;
        b.forEach((name, i) => {
            this.basisBitmap.set(name, bitmaps[i]);
            this.bitmapBasis.set(bitmaps[i], name);
        });
        this.basisGrades = [];
        for (const b of this.basis) {
            if (!this.basisGrades[b.length - 1]) {
                this.basisGrades[b.length - 1] = [];
            }
            this.basisGrades[b.length - 1].push(b);
        }
        this.onesMap = onesMap;
        // transform can be changed for algebras with parent, and then M, G and all tables recalculated
        this.m[0] = [[1]];
        this.m[1] = this.transform;
        this.g[0] = [[1]];
        this.g[1] = MatrixMath.create(this.degree, this.degree, this.squares);
        if (this.parent) {
            this.g[1] = MatrixMath.mul(MatrixMath.transpose(this.m[1]),
                MatrixMath.mul(this.parent.g[1], this.m[1]));
        }
        // well actually use the parent algebra and m[1] to calculate
        for (let bits = 2; bits < this.degree + 1; bits++) {
            this.m[bits] = this.makeMn(bits);
            if (this.parent) {
                this.g[bits] = MatrixMath.mul(MatrixMath.transpose(this.m[bits]),
                    MatrixMath.mul(this.parent.g[bits], this.m[bits]));
            } else {
                // Base algebra (no parent) is always orthogonal (defined by signature),
                // so g[1] is diagonal and we only need diagonal entries for higher grades.
                // Non-orthogonal metrics only arise in child algebras via the M^T G M path above.
                this.g[bits] = MatrixMath.create(this.basisGrades[bits].length, this.basisGrades[bits].length);
                this.basisGrades[bits].forEach((basis, index) =>  {
                    const subs = this.parseSubscripts(basis);
                    const left = this.basisGrades[1].indexOf('e' + subs[0]);
                    const right = this.basisGrades[bits - 1].indexOf('e' + subs.slice(1).join(''));
                    this.g[bits][index][index] = this.g[1][left][left] * this.g[bits-1][right][right];
                });
            }
        }

        this.geometricProductTable = this.makeGeometricProductTable();
        this.wedgeTable = this.makeWedgeTable();
        this.leftDualTable = this.makeDualTable("left");
        this.rightDualTable = this.makeDualTable("right");
        this.antiWedgeTable = this.makeAntiTable(this.wedgeTable);
    }
    public bits(n: number) {
        const binary = n.toString(2).split("").reverse();
        const ones: number[] = [];
        binary.forEach((bit, index) => {
            if (bit === "1") {
                ones.push(index);
            }
        });
        return ones;
    }
    // Parse a basis element name like "e12m" into subscript strings ["1","2","m"]
    // Uses greedy matching against known subscripts (longest match first)
    public parseSubscripts(basisName: string): string[] {
        const s = basisName.startsWith("e") ? basisName.substring(1) : basisName;
        if (s === "") return [];
        const result: string[] = [];
        // Sort subscripts longest-first for greedy matching
        const sorted = [...this.subscripts].sort((a, b) => b.length - a.length);
        let pos = 0;
        while (pos < s.length) {
            const match = sorted.find(sub => s.startsWith(sub, pos));
            if (match) {
                result.push(match);
                pos += match.length;
            } else {
                throw new Error(`Cannot parse subscript at position ${pos} in "${basisName}"`);
            }
        }
        return result;
    }
    public makeBasis() {
        const onesMap: number[][] = [];
        const degree = this.degree;
        const l = 2**degree;
        for (let i = 0; i < l; i++) {
            onesMap.push(this.bits(i));
        }
        const comp = (a: number[], b: number[]): number => {
            return a[0] === b[0] && a.length > 1 ? comp(a.slice(1), b.slice(1)) :
                a[0] - b[0]
        }
        const sortedOnesMap = [...onesMap].sort((a, b) =>
            a.length != b.length ?
                a.length - b.length :
                comp(a, b)
        );
        const b = sortedOnesMap.map((bitmap) =>
            "e" + bitmap.map((bit) => this.subscripts[bit]).join(""))
        // Compute bitmap value for each sorted basis element
        const bitmaps = sortedOnesMap.map((ones) =>
            ones.reduce((acc, bit) => acc | (1 << bit), 0));
        return {b, onesMap, bitmaps};
    }
    public binary(a: MultiVector, b: MultiVector, f = (a: number, b: number) => a + b) {
        const keys = new Set(Object.keys(a)).union(new Set(Object.keys(b)));
        const result: MultiVector = {}
        keys.forEach((key) => {
            result[key] = f(a[key]??0, b[key]??0);
        })
        return this.sortVector(result);
    }
    public add(a: MultiVector, b: MultiVector) {
        return this.binary(a,b);
    }
    public sub(a: MultiVector, b: MultiVector) {
        return this.binary(a, b, (a: number, b: number) => a - b);
    }
    public scale(s: number, m: MultiVector) {
        const result: MultiVector = {}
        for (const basis in m) {
            result[basis] = s * m[basis];
        }
        return result;
    }
    public makeWedgeTable() {
        const t: CayleyTable = {}
        for (let a = 0; a < 2**this.degree; a++) {
            const ea = this.basis[a];
            t[ea] = {}
            for (let b=0; b < 2**this.degree; b++) {
                const eb = this.basis[b];
                const left = this.parseSubscripts(ea);
                const right = this.parseSubscripts(eb);
                // so might have, say [1,2] [2,3]
                // repeats mean the answer is 0
                // remaining numbers need sorting - swaps keep negating the answer
                const result = left.concat(right);
                let swaps = 0;
                let swapped = true;
                let zero = false;
                let last = result.length - 1;
                while (last > 0 && swapped && !zero) {
                    swapped = false;
                    for (let i = 0; i < last; i++) {
                        const l = result[i], r = result[i+1];
                        if (l === r) {
                            zero = true;
                        } else if (this.subscriptOrder.get(l)! > this.subscriptOrder.get(r)!) {
                            result[i] = r; result[i+1] = l;
                            swapped = true;
                            swaps += 1;
                        }
                    }
                    last -= 1;
                }
                if (zero) {
                    t[ea][eb] = {}
                } else {
                    t[ea][eb] = { ["e" + result.join("")]: swaps & 1 ? -1 : 1}
                }
            }
        }
        return t;
    }
    public makeAntiTable(table : CayleyTable) {
        const t: CayleyTable = {}
        for (let a = 0; a < 2 ** this.degree; a++) {
            const ea = this.basis[a];
            t[ea] = {}
            for (let b = 0; b < 2 ** this.degree; b++) {
                const eb = this.basis[b];
                const lea = this.leftDualTable[ea];
                const leb = this.leftDualTable[eb];
                const leaBasis = this.getBasis(lea);
                const lebBasis = this.getBasis(leb);
                const w = table[leaBasis][lebBasis];
                if (this.isZero(w)) {
                    t[ea][eb] = w;
                } else {
                    const wBasis = this.getBasis(w);
                    const rw = this.rightDualTable[wBasis];
                    const rwBasis = this.getBasis(rw);
                    t[ea][eb] = {[wBasis]: lea[leaBasis] * leb[lebBasis] * w[wBasis] * rw[rwBasis]}
                }
            }
        }
        return t;
    }
    public makeDualTable(side: "left" | "right") {
        const result: DualTable = {}
        const allBits = (1 << this.degree) - 1; // bitmap of the pseudoscalar
        for (let a = 0; a < 2**this.degree; a++) {
            const ea = this.basis[a];
            const complementBitmap = allBits ^ this.basisBitmap.get(ea)!;
            const ed = this.bitmapBasis.get(complementBitmap)!;
            const signVector= side == "left" ?
                this.wedgeTable[ed][ea] :
                this.wedgeTable[ea][ed];
            const signBasis = this.getBasis(signVector);
            result[ea] = {[ed]: signVector[signBasis]}
        }
        return result;
    }
    public makeGeometricProductTable() {
        const t: CayleyTable = {}
        for (let a = 0; a < 2 ** this.degree; a++) {
            const ea = this.basis[a];
            t[ea] = {}
            for (let b = 0; b < 2 ** this.degree; b++) {
                const eb = this.basis[b];
                const left = this.parseSubscripts(ea);
                const right = this.parseSubscripts(eb);
                const result = left.concat(right);
                let swaps = 0;
                let swapped = true;
                let last = result.length - 1;
                while (last > 0 && swapped) {
                    swapped = false;
                    for (let i = 0; i < last; i++) {
                        const l = result[i], r = result[i+1];
                        if (this.subscriptOrder.get(l)! > this.subscriptOrder.get(r)!) {
                            result[i] = r; result[i+1] = l;
                            swapped = true;
                            swaps += 1;
                        }
                    }
                    last -= 1;
                }
                // repeats give 0, 1, or -1  if zero, positive or negative
                let result2 = "";
                let index = 0;
                while (index < result.length) {
                    if (result[index] === result[index + 1]) {
                        const bno = this.subscripts.indexOf(result[index]);
                        const square = this.squares[bno];
                        if (square === 0) {
                            index = result.length;
                            result2 = "0";
                        } else if (square == 1) {
                            index += 2;
                        } else {
                            swaps += 1;
                            index += 2;
                        }
                    } else {
                        result2 += result[index];
                        index += 1;
                    }
                }
                {
                    if (result2 === "0") {
                        t[ea][eb] = {}
                    } else {
                        t[ea][eb] = {["e" + result2]: swaps & 1 ? -1 : 1}
                    }
                }
            }
        }
        return t;
    }
    public sortVector(v: MultiVector) {
        const sorted: MultiVector = {}
        for (const key of this.basis) {
            if (v[key]) {
                sorted[key] = v[key];
            }
        }
        return sorted;
    }
    public isZero(v: MultiVector) {
        return Object.keys(v).length === 0;
    }
    public getBasis(v: MultiVector) {
        const keys =Object.keys(v);
        if (keys.length) {
            return keys[0];
        } else {
            return "?";
        }
    }
    public cayleyMul(a: MultiVector, b: MultiVector, cayleyTable: CayleyTable) {
        const answer: MultiVector = {};
        for (const basisA in a) {
            for (const basisB in b) {
                const result = cayleyTable[basisA][basisB];
                for (const basisR in result) {
                    const n = result[basisR] * a[basisA] * b[basisB];
                    answer[basisR] = answer[basisR] ? answer[basisR] + n : n;
                    if (!answer[basisR]) {
                        delete answer[basisR];
                    }
                }
            }
        }
        return this.sortVector(answer);
    }
    public toString(v: MultiVector) {
        let s = "";
        for (const basis in v) {
            const c = v[basis];
            const cs = c === 1 ?
                "" : ( c === -1 ? "-" : c.toString());
            if (basis === "e") {
                s += c.toString();
            } else if (!s) {
                s += cs+ basis;
            } else if (c > 0) {
                s += "+" + cs + basis;
            } else {
                s += cs + basis;
            }
        }
        if (Object.keys(v).length > 1) {
            s = "(" + s + ")";
        }
        return s ? s: "0";
    }
    public wedge(a: MultiVector, b: MultiVector) {
        return this.cayleyMul(a, b, this.wedgeTable);
    }
    public antiWedge(a: MultiVector, b: MultiVector) {
        return this.cayleyMul(a, b, this.antiWedgeTable);
    }
    public gp(a: MultiVector, b: MultiVector) {
        return this.cayleyMul(a, b, this.geometricProductTable);
    }
    public gradeOfBasis(basisName: string): number {
        const bitmap = this.basisBitmap.get(basisName);
        if (bitmap === undefined) return -1;
        // popcount
        let n = bitmap, count = 0;
        while (n) { count += n & 1; n >>= 1; }
        return count;
    }
    public gradeSelect(v: MultiVector, grade: number): MultiVector {
        const result: MultiVector = {};
        for (const basis in v) {
            if (this.gradeOfBasis(basis) === grade) {
                result[basis] = v[basis];
            }
        }
        return this.sortVector(result);
    }
    public reverse(v: MultiVector): MultiVector {
        // Reverse: each grade-k component gets factor (-1)^(k(k-1)/2)
        const result: MultiVector = {};
        for (const basis in v) {
            const k = this.gradeOfBasis(basis);
            const sign = (k * (k - 1) / 2) & 1 ? -1 : 1;
            result[basis] = sign * v[basis];
        }
        return this.sortVector(result);
    }
    public leftContract(a: MultiVector, b: MultiVector): MultiVector {
        // a⌋b = Σ <a_r * b_s>_{s-r} for s >= r
        const result: MultiVector = {};
        for (const basisA in a) {
            for (const basisB in b) {
                const r = this.gradeOfBasis(basisA);
                const s = this.gradeOfBasis(basisB);
                if (s >= r) {
                    const product = this.geometricProductTable[basisA][basisB];
                    for (const basisR in product) {
                        if (this.gradeOfBasis(basisR) === s - r) {
                            const n = product[basisR] * a[basisA] * b[basisB];
                            result[basisR] = (result[basisR] || 0) + n;
                            if (!result[basisR]) delete result[basisR];
                        }
                    }
                }
            }
        }
        return this.sortVector(result);
    }
    public dual(v: MultiVector): MultiVector {
        // Right dual: v* = v ⌋ I⁻¹ (using right dual table)
        const result: MultiVector = {};
        for (const basis in v) {
            const d = this.rightDualTable[basis];
            for (const dBasis in d) {
                const n = v[basis] * d[dBasis];
                result[dBasis] = (result[dBasis] || 0) + n;
                if (!result[dBasis]) delete result[dBasis];
            }
        }
        return this.sortVector(result);
    }
    public unDual(v: MultiVector): MultiVector {
        // Left undual: using left dual table
        const result: MultiVector = {};
        for (const basis in v) {
            const d = this.leftDualTable[basis];
            for (const dBasis in d) {
                const n = v[basis] * d[dBasis];
                result[dBasis] = (result[dBasis] || 0) + n;
                if (!result[dBasis]) delete result[dBasis];
            }
        }
        return this.sortVector(result);
    }
    public scalarProduct(a: MultiVector, b: MultiVector): number {
        const product = this.gp(a, b);
        return product["e"] || 0;
    }
    public normSquared(v: MultiVector): number {
        return this.scalarProduct(v, this.reverse(v));
    }
    public normalize(v: MultiVector): MultiVector {
        const ns = this.normSquared(v);
        const mag = Math.sqrt(Math.abs(ns));
        if (mag === 0) return v;
        return this.scale(1 / mag, v);
    }
    public sandwich(r: MultiVector, x: MultiVector): MultiVector {
        // R x R† — sandwich product
        return this.gp(this.gp(r, x), this.reverse(r));
    }
    public inverse(v: MultiVector): MultiVector {
        // For versors: v⁻¹ = reverse(v) / normSquared(v)
        const ns = this.normSquared(v);
        if (ns === 0) throw new Error("Cannot invert: norm squared is zero");
        return this.scale(1 / ns, this.reverse(v));
    }
    public dumpTable(table: CayleyTable) {
        const basis = this.basis;
        let line = "";
        const pad = (s: string) => s + " ".repeat(this.degree + 3 - s.length);
        line += pad("");
        for (const base of basis) {
            line += pad(base);
        }
        console.log(line);
        for (const a of basis) {
            line = pad(a);
            for (const b of basis) {
                const x= table[a][b];
                line += pad(this.toString(x));
            }
            console.log(line);
        }

    }
    public makeMn(bits: number) {
        const vectors = this.basisGrades[bits];
        const mn = MatrixMath.create(vectors.length, vectors.length, 1); // default to identity
        if (this.parent) {
            vectors.forEach((vector, index) => {
                const subs = this.parseSubscripts(vector);
                const single = this.basisGrades[1].indexOf("e" + subs[0]);
                const rest = this.basisGrades[bits - 1].indexOf("e" + subs.slice(1).join(""));
                const left: MultiVector = {}
                for (let i = 0; i < this.basisGrades[1].length; i++) {
                    if (this.m[1][i][single]) {
                        left[this.parent!.basisGrades[1][i]] = this.m[1][i][single];
                    }
                }
                const right: MultiVector = {}
                for (let i = 0; i < this.basisGrades[bits - 1].length; i++) {
                    if (this.m[bits - 1][i][rest]) {
                        right[this.parent!.basisGrades[bits - 1][i]] = this.m[bits - 1][i][rest];
                    }
                }
                const answer = this.parent!.wedge(left, right);
                for (let i = 0; i < this.parent!.basisGrades[bits].length; i++) {
                    const z = answer[this.parent!.basisGrades[bits][i]];
                    mn[i][index] = z ? z : 0;
                }
            });
        }
        return mn;
    }
}

export class GA {
    public vector: MultiVector;
    public algebra: Algebra;
    constructor(algebra: Algebra, vector: MultiVector = {}) {
        this.algebra = algebra;
        this.vector = vector;
    }
    // so you can say GA1
    public toString() {
        return this.algebra.toString(this.vector);
    }
    public add(b: GA) {
        return new GA(this.algebra, this.algebra.add(this.vector, b.vector));
    }
    public sub(b: GA) {
        return new GA(this.algebra, this.algebra.sub(this.vector, b.vector));
    }
    public scale(s: number) {
        return new GA(this.algebra, this.algebra.scale(s, this.vector));
    }
    public wedge(b: GA) {
        return new GA(this.algebra, this.algebra.wedge(this.vector, b.vector));
    }
    public antiWedge(b: GA) {
        return new GA(this.algebra, this.algebra.antiWedge(this.vector, b.vector));
    }
    public gp(b: GA) {
        return new GA(this.algebra, this.algebra.gp(this.vector, b.vector));
    }
    public grade(k: number) {
        return new GA(this.algebra, this.algebra.gradeSelect(this.vector, k));
    }
    public reverse() {
        return new GA(this.algebra, this.algebra.reverse(this.vector));
    }
    public leftContract(b: GA) {
        return new GA(this.algebra, this.algebra.leftContract(this.vector, b.vector));
    }
    public dual() {
        return new GA(this.algebra, this.algebra.dual(this.vector));
    }
    public unDual() {
        return new GA(this.algebra, this.algebra.unDual(this.vector));
    }
    public normSquared(): number {
        return this.algebra.normSquared(this.vector);
    }
    public normalize() {
        return new GA(this.algebra, this.algebra.normalize(this.vector));
    }
    public sandwich(x: GA) {
        return new GA(this.algebra, this.algebra.sandwich(this.vector, x.vector));
    }
    public scalarProduct(b: GA): number {
        return this.algebra.scalarProduct(this.vector, b.vector);
    }
    public inverse() {
        return new GA(this.algebra, this.algebra.inverse(this.vector));
    }
}

export type Matrix = number[][];
export class MatrixMath {
    public static create(rows: number, columns: number = rows, diagonal: number | number[] = 0): Matrix {
        const c: Matrix = [];
        if (!Array.isArray(diagonal)) {
            diagonal = new Array(rows).fill(diagonal);
        }
        for (let row = 0; row < rows; row ++) {
            // initialise as identity is possible, or anything on leading diagonal
            c[row] = new Array(columns).fill(0);
            c[row][row] = diagonal[row];
        }
        return c;
    }
    public static binary(a: Matrix, b: Matrix, f: (a: number, b: number) => number) {
        const {rows: aRows, columns: aColumns} = MatrixMath.dim(a);
        const c: Matrix = [];
        for (let row = 0; row < aRows; row++) {
            c[row] = [];
            for (let column = 0; column < aColumns; column ++) {
                c[row][column] = f(a[row][column], b[row][column]);
            }
        }
        return c;
    }
    public static add(a: Matrix, b: Matrix) {
        return MatrixMath.binary(a, b, (a,b) => a+ b);
    }
    public static sub(a: Matrix, b: Matrix) {
        return MatrixMath.binary(a, b, (a, b) => a-b);
    }
    public static dim(m: Matrix) {
        const rows = m.length;
        const columns = rows ? m[0].length : 0;
        return {rows, columns}
    }
    public static mul(a: Matrix, b: Matrix) {
        const {rows: aRows, columns: aColumns} = MatrixMath.dim(a);
        const {rows: bRows, columns: bColumns} = MatrixMath.dim(b);
        // aColumns must equal bRows
        const c: Matrix = [];
        if (aColumns === bRows) {
            for (let row = 0; row < aRows; row++) {
                c[row] = [];
                for (let column = 0; column < bColumns; column++) {
                    c[row][column] = 0;
                    for (let aCbR = 0; aCbR < aColumns; aCbR++) {
                        c[row][column] += a[row][aCbR] * b[aCbR][column];
                    }
                }
            }
        }
        return c; // return is [] if you can't do this
    }
    public static transpose(m: Matrix) {
        const {rows, columns} = MatrixMath.dim(m);
        const c: Matrix = [];
        for (let row = 0; row < rows; row ++) {
            c[row] = [];
            for (let column = 0; column < columns; column ++) {
                c[row][column] = m[column][row];
            }
        }
        return c;
    }
}
