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
        this.positive = positive;
        this.negative = negative;
        this.zero = zero;
        this.basis = [];
        this.setBasis();
    }
    // Needs simplifying to a function to make a basis with more logic
    // should allow for things like e4=e- + e+ and clever stuff like that
    // i.e. more subtle basis vectors that simplify geometric object construction
    public setBasis() {
         // bad version, but it really doesn't matter?
        for (let bits = 0; bits < (1<<this.dimension); bits ++) {
            let vector = "e";
            for (let bit = 0; bit < this.dimension; bit ++) {
                if ((1<<bit) & bits)  {
                    vector += (bit+1).toString();
                }
            }
            this.basis.push(vector);
        }
        this.basis.sort((a,b) =>
            a.length != b.length ? a.length - b.length : a.localeCompare(b)
        );
        return this;
    }
    // change anything of the form ennnnnnnnn to one of the basis vectors
    public rebase(vector: BasisVector) {
        // remove duplicates first
        let swaps = 0;
        let check = true;
        while (check) {
            // remove duplicates by swizzling the order
            const repeats: {[key: string]: number } = {};
            let pos = 1;
            while (pos < vector.length && repeats[vector[pos]] === undefined) {
                repeats[vector[pos]] = pos;
                pos += 1;
            }
            if (pos < vector.length) {
                // must have hit a duplicate at pos
                const pos2 = repeats[vector[pos]];
                swaps += pos - pos2 - 1;
                vector = vector.substring(0, pos2)
                    + vector.substring(pos2 + 1, pos)
                    + vector.substring(pos + 1);
            } else {
                check = false; // no more duplicates
            }

        }
        // now find essentially the same basis vector - order might be different
        // we know e.g. e321 might be e123 and all entries are different
        // more swizzling will be implied
        function binary(vector: string) {
            let b = 0;
            for (let pos = 1; pos < vector.length; pos++) {
                b += 2**(Number(vector[pos]) - 1);
            }
            return b;
        }
        const bv = binary(vector);
        let bIndex = 0;
        while (bIndex < this.basis.length && binary(this.basis[bIndex]) !== bv) {
            bIndex += 1;
        }
        if (bIndex === this.basis.length) {
            return "e?";
        }
        // ToDo work out the swizzle
        return this.basis[bIndex];
    }
    public meet(...args: MultiVector[]): MultiVector {
        return args[0];
    }
    public join(...args: MultiVector[]): MultiVector {
        return args[0];
    }
}

