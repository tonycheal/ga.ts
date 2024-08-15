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
        if (typeof negative === 'number') {
            this.transform = MatrixMath.create(this.degree, this.degree, 1); // identity
        } else {
            this.transform = negative.transform;
        }
        const {b, onesMap} = this.makeBasis();
        this.basis = b;
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
        // well actually use the parent algebra and m[1] to calculate
        for (let bits = 2; bits < this.degree + 1; bits++) {
            this.m[bits] = this.makeMn(bits);
            if (this.parent && bits === 1) {
                this.g[1] = MatrixMath.mul(MatrixMath.transpose(this.m[1]),
                    MatrixMath.mul(this.parent.g[1], this.m[1]));
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
        return {b, onesMap};
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
                const left = ea.substring(1).split("");
                const right = eb.substring(1).split("");
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
                        } else if (l > r) {
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
        for (let a = 0; a < 2**this.degree; a++) {
            const ea = this.basis[a];
            const ed = this.basis[2**this.degree - 1 - a];
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
                const left = ea.substring(1).split("");
                const right = eb.substring(1).split("");
                const result = left.concat(right);
                let swaps = 0;
                let swapped = true;
                let last = result.length - 1;
                while (last > 0 && swapped) {
                    swapped = false;
                    for (let i = 0; i < last; i++) {
                        const l = result[i], r = result[i+1];
                       if (l > r) {
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
        console.log("bits", bits);
        // const previousInfo = this.onesMap.filter((ones) => ones.length === bits -1);
        const vectors  = this.basisGrades[bits]; // names of our vectors
        const mn = MatrixMath.create(vectors.length, vectors.length,1); // default to identity
        if (this.parent) {
            // const pVectors = this.parent.basisGrades[bits]; // names of parent vectors
            // const pVectors1 = this.parent.basisGrades[1];
            vectors.forEach((vector, index) => { // e.g. e134
                console.log("vector", vector, vector[1], vector.slice(2));
                const single = this.basisGrades[1].indexOf("e" + vector[1]); //basis[index]; // e.g. e1
                const rest = this.basisGrades[bits - 1].indexOf("e" + vector.slice(2)); // e.g. e34
                console.log(single, rest);
                const x = this.parent!.basisGrades[1][single];
                const y = this.parent!.basisGrades[bits-1][rest];
                console.log(">>>", x,y);
                const left: MultiVector = {}
                for (let i = 0; i < this.basisGrades[1].length; i++) {
                    if (this.m[1][i][single]) {
                        left[this.parent!.basisGrades[1][i]] = this.m[1][i][single];
                    }
                }
                const right: MultiVector = {}
                for (let i = 0; i < this.basisGrades[bits-1].length; i++) {
                    if(this.m[bits-1][i][rest]) {
                        right[this.parent!.basisGrades[bits-1][i]] = this.m[bits-1][i][rest];
                    }
                    // and that's the column in the result
                }
                console.log("wedge of ", left, right);
                const answer = this.parent!.wedge(left, right);
                console.log("answer ", answer);
                for (let i = 0; i < this.parent!.basisGrades[bits].length; i++) {
                    const z = answer[this.parent!.basisGrades[bits][i]];
                    mn[i][index] = z ? z : 0;
                }
            });
        }
        console.log(this.basisGrades[bits]);
        console.log("m[" + bits + "]", mn);
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
    public wedge(b: GA) {
        return new GA(this.algebra, this.algebra.wedge(this.vector, b.vector));
    }
    public antiWedge(b: GA) {
        return new GA(this.algebra, this.algebra.antiWedge(this.vector, b.vector));
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
