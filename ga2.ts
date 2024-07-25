// Second attempt at simple geometric algebra library now moved to ga.ts
import {Algebra, GA} from "./ga.ts";

const algebra = new Algebra();
console.log(algebra);
const vector1 = new GA(algebra, {e1: 3, e2: 4});
const vector2 = new GA(algebra, {e1: 6, e2: 5});
console.log(algebra.basis);
console.log(vector1.vector);
console.log(vector1.toString());
console.log(vector1.toString() + "^" + vector2.toString() + "=" + vector1.wedge(vector2).toString());
console.log(vector1.toString() + "v" + vector2.toString() + "=" + vector1.antiWedge(vector2).toString());
