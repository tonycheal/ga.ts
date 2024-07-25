// Second attempt at simple geometric algebra library now moved to ga.ts
import {Algebra, GA} from "./ga.ts";
import type {MultiVector} from "./ga.ts";

const algebra = new Algebra();
console.log(algebra);
const vector1 = new GA(algebra, {e1: 3});
const vector2 = new GA(algebra, {e2: 6});
console.log(algebra.basis);
console.log(vector1.vector);
console.log(vector1.toString());
console.log(vector1.wedge(vector2));
