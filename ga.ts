export type BasisVector = string;
export type BasisElement = BasisVector[];
export interface MultiComponent {
    coefficient: number;
    element: BasisElement;
}
export type MultiVector = MultiComponent[];
export class ga {
    public positive: number;
    public negative: number;
    public zero: number;
    public basis: BasisVector[];
    public get dimension() {
        return this.positive + this.negative + this.zero;
    }
    constructor(positive: number = 3, negative: number = 1, zero: number = 0) {
        return this.setBasis(positive, negative, zero);
    }
    setBasis(positive: number = 3, negative: number = 1, zero: number = 0) {
        this.positive = positive;
        this.negative = negative;
        this.zero = zero;
        this.basis = [];
        // bad version, but it really doesn't matter?
        for (let bits = 0; bits < (1<<this.dimension); bits ++) {
            console.log(bits);
            let vector = "e";
            for (let bit = 0; bit < this.dimension; bit ++) {
                console.log(bit);
                if ((1<<bit) & bits)  {
                    console.log("..", bit);
                    vector += (bit+1).toString();
                }
            }
            this.basis.push(vector);
        }
        this.basis.sort((a,b) =>
            a.length != b.length ? a.length - b.length : a.localeCompare(b)
        );
    }
    public meet(...args: MultiVector[]): MultiVector {
        return args[0];
    }
    public join(...args: MultiVector[]): MultiVector {
        return args[0];
    }
}

