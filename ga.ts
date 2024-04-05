export type BasisVector = string;
export interface MultiComponent {
    coefficient: number;
    vector: BasisVector;
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
        console.log(vector);
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
            return {basis: "e?", swaps, swaps2: 0};
        }
        const basis = this.basis[bIndex];
        console.log(vector);
        let swaps2 = 0;
        for (let index = 0; index < vector.length; index++) {
            if (basis[index] !== vector[index]) {
                const vIndex = vector.indexOf(basis[index]);
                swaps2 += vIndex - index;
                vector = vector.substring(0, index) + basis[index] + vector.substring(index, vIndex) + vector.substring(vIndex + 1);
                console.log({basis, vector});
            }
        }
        return {basis, swaps, swaps2};
    }
    // wedge does just two multiVectors with coefficients
    public wedge(m1: MultiComponent, m2: MultiComponent): MultiComponent {
        const {basis, swaps, swaps2} = this.rebase(m1.vector + m2.vector.substring(1));
        return {
            coefficient: m1.coefficient * m2.coefficient * (swaps + swaps2 & 1 ? -1: 1),
                    vector: basis
            }
    }
    public meet(...args: MultiVector[]): MultiVector {
        const answer: MultiVector = [];
        for (const arg of args) {

        }
        return args[0];
    }
    public join(...args: MultiVector[]): MultiVector {
        return args[0];
    }
    public bits(i: number) {
        let vector = "e";
        const binary = i.toString(2);
        const bl = binary.length;
        const matches =Array.from(binary.matchAll(/1/g)).reverse()
        for (const match of matches) {
            vector += (bl - match.index!).toString();
        }
        return vector;
    }
}

