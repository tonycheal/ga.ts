export interface MultiVector { [key: string]: number}
export interface CayleyTable {
    [key: string]:
        {
            [key: string]:
                { basis: string; sign: number }
        }
}
export interface DualTable { [key: string]: {basis: string, sign: number}}

export class Algebra {
    public positive: number;
    public negative: number;
    public zero: number;
    public basis: string[];
    public onesMap: number[][];
    public wedgeTable: CayleyTable = {};
    public antiWedgeTable: CayleyTable = {};
    public leftDualTable: DualTable = {};
    public rightDualTable: DualTable = {};
    public geometricProductTable: CayleyTable = {};
    constructor(positive: number = 3, negative: number = 1, zero: number = 0) {
        this.positive = positive;
        this.negative = negative;
        this.zero = zero;
        const {b, onesMap} = this.makeBasis();
        this.basis = b;
        this.onesMap = onesMap;
        this.wedgeTable = this.makeWedgeTable();
        this.leftDualTable = this.makeDualTable("left");
        this.rightDualTable = this.makeDualTable("right");
        this.antiWedgeTable = this.makeAntiWedgeTable();
        this.geometricProductTable = this.makeGeometricProductTable();
    }
    public get degree() {
        return this.positive + this.negative + this.zero;
    }
    public bits(n: number) {
        const binary = n.toString(2).split("").reverse();
        const ones: number[] = [];
        binary.forEach((bit, index) => {
            if (bit === "1") {
                ones.push(index + 1);
            }
        });
        return ones;
    }
    public makeBasis() {
        const b: string[] = [];
        const onesMap: number[][] = [];
        const degree = this.degree;
        const l = 2**degree;
        for (let grade = 0; grade <= degree; grade ++) {
            for (let i = 0; i < l; i++) {
                const ones = this.bits(i);
                onesMap.push(ones);
                if (ones.length === grade) {
                    b.push("e" + ones.join(""))
                }
            }
        }
        b.sort((a,b) =>
            a.length != b.length ?
                a.length - b.length :
                (a < b ? -1 : 1)
        );
        return {b, onesMap};
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
                    t[ea][eb] = { basis: "0", sign: 1 }
                } else {
                    t[ea][eb] = { basis: "e" + result.join(""), sign: swaps & 1 ? -1 : 1}
                }
            }
        }
        return t;
    }
    public makeAntiWedgeTable() {
        const t: CayleyTable = {}
        for (let a = 0; a < 2 ** this.degree; a++) {
            const ea = this.basis[a];
            t[ea] = {}
            for (let b = 0; b < 2 ** this.degree; b++) {
                const eb = this.basis[b];
                const lea = this.leftDualTable[ea];
                const leb = this.leftDualTable[eb];
                const w = this.wedgeTable[lea.basis][leb.basis];
                let rw = {basis: "0", sign: 1}
                if (w.basis !== "0") {
                    rw = this.rightDualTable[w.basis];
                }
                t[ea][eb] = {basis: rw.basis, sign: lea.sign * leb.sign * w.sign * rw.sign}
            }
        }
        return t;
    }
    public makeDualTable(side: "left" | "right") {
        const result: DualTable = {}
        for (let a = 0; a < 2**this.degree; a++) {
            const ea = this.basis[a];
            const ed = this.basis[2**this.degree - 1 - a];
            const sign = side == "left" ?
                this.wedgeTable[ed][ea].sign :
                this.wedgeTable[ea][ed].sign;
            result[ea] = {basis: ed, sign}
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
                        const bno = Number(result[index]);
                        if (bno <= this.zero) {
                            index = result.length;
                            result2 = "0";
                        } else if (bno <= this.zero + this.positive) {
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
                        t[ea][eb] = { basis: result2, sign: 1}
                    } else {
                        t[ea][eb] = {basis: "e" + result2, sign: swaps & 1 ? -1 : 1}
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
    public cayleyMul(a: MultiVector, b: MultiVector, cayleyTable: CayleyTable) {
        const answer: MultiVector = {};
        for (const basisA in a) {
            for (const basisB in b) {
                const {basis, sign} = cayleyTable[basisA][basisB];
                const n = sign * a[basisA] * b[basisB];
                answer[basis] = answer[basis] ? answer[basis] + n : n;
                if (!answer[basis]) {
                    delete answer[basis]; // don't include 0s
                }
            }
        }
        return this.sortVector(answer);
    }
    public toString(v: MultiVector) {
        let s = "";
        for (const basis in v) {
            const c = v[basis];
            if (basis === "e") {
                s += c.toString();
            } else if (!s) {
                s += c.toString() + basis;
            } else if (c > 0) {
                s += "+" + c.toString() + basis;
            } else {
                s += c.toString() + basis;
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
                line += pad((x.sign < 0 ? "-" : "") + x.basis);
            }
            console.log(line);
        }

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
