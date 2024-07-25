export interface MultiVector { [key: string]: number}
export interface CayleyTable {
    [key: string]:
        {
            [key: string]:
                { basis: string; sign: number }
        }
}

export class Algebra {
    public positive: number;
    public negative: number;
    public zero: number;
    public basis: string[];
    public onesMap: number[][];
    public wedgeTable: CayleyTable = {};
    constructor(positive: number = 3, negative: number = 1, zero: number = 0) {
        this.positive = positive;
        this.negative = negative;
        this.zero = zero;
        const {b, onesMap} = this.makeBasis();
        this.basis = b;
        this.onesMap = onesMap;
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
        return s ? s: "0";
    }
    wedge(a: MultiVector, b: MultiVector) {
        return this.cayleyMul(a, b, this.wedgeTable);
    }
}

const cga3 = new Algebra();
console.log(cga3.basis);

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
}
