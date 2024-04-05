import { ga } from './ga.ts';

const CGA2 = new ga(3, 1);
const CGA3 = new ga(4, 1);
console.log(CGA2.basis);
console.log(CGA3.basis);
console.log(CGA3.rebase("e32143"));
console.log(CGA3.rebase("e435432134"))
console.log(CGA3.rebase("e433333"));
console.log(CGA3.wedge({coefficient: 2, vector: "e3"}, {coefficient: 3, vector: "e2"}))
console.log(CGA3.bits(20))