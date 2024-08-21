// Second attempt at simple geometric algebra library now moved to ga.ts
import {Algebra, GA, MatrixMath} from "./ga.ts";

const algebra = new Algebra(3,1,0);
console.log(algebra);
const vector1 = new GA(algebra, {e1: 3, e2: 4});
const vector2 = new GA(algebra, {e1: 6, e2: 5});
const zero = new GA(algebra, {});
console.log(algebra.basis);
console.log(vector1.vector);
console.log(zero.toString());
console.log(vector1.toString());
console.log(vector1.toString() + "^" + vector2.toString() + "=" + vector1.wedge(vector2).toString());
console.log(vector1.toString() + "v" + vector2.toString() + "=" + vector1.antiWedge(vector2).toString());
const { degree, wedgeTable, basis} = algebra;
console.log(degree, basis);
console.log("Geometric Product");
algebra.dumpTable(algebra.geometricProductTable);
console.log("Wedge");
algebra.dumpTable(wedgeTable);
console.log("AntiWedge");
algebra.dumpTable(algebra.antiWedgeTable);
const left = {e1: 3, e2: 4}
const right = {e1: 7, e3: 8}
console.log("a", left, "b", right);
console.log("a+b",algebra.add(left, right))
console.log("a-b",algebra.sub(left, right))
console.log(".5*a", algebra.scale(.5, left))

const algebraC = new Algebra(
    [
        {square: 1, subscript: "1"},
        {square: 1, subscript: "2"},
        {square: -1, subscript: "m"},
        {square: 1, subscript: "p"}
    ]
)
console.log("Algebra 3");
//console.log(algebraC);
const e4 = new GA(algebraC, {em: 1/2, ep: -1/2});
const e5 = new GA(algebraC, {em: 1, ep: 1});
console.log("e4^e5=", e4.toString(), e5.toString(),e4.wedge(e5).toString());
console.log("e5^e4=", e5.toString(), e4.toString(),e5.wedge(e4).toString());
algebraC.dumpTable(algebraC.geometricProductTable);

const algebra2DC = new Algebra(
    [
        {square: 1, subscript: "1"},
        {square: 1, subscript: "2"},
        {square: 1, subscript: "3"},
        {square: 1, subscript: "4"},
    ],
    {algebra: algebraC, transform:
        /* would be better as... or as an alternative as column from CayleyTable
        {
            e1: {e1: 1},
            e2: {e2: 1},
            e3: {em: 1/2, ep: -1/2},
            e4: {em: 1   ,ep: 1},
        }
        but Matrix will do for the moment, since most entries are 0,1 */
    [
        [1,0,0,0],
        [0,1,0,0],
        [0,0,1/2,1],
        [0,0,-1/2,1]
    ]}
);
console.log(algebraC.wedgeTable);
console.log(algebra2DC.m[1]);
console.log(MatrixMath.transpose(algebra2DC.m[1]))
console.log(algebra2DC.g[1]);
console.log(algebra2DC.parent!.g[1])
const gg = MatrixMath.mul(MatrixMath.transpose(algebra2DC.m[1]),
    MatrixMath.mul(algebra2DC.parent!.g[1], algebra2DC.m[1]));
console.log (gg);
console.log(MatrixMath.mul([[1,0],[0,1]], [[.5,.4],[.3,.2]]))
console.log("==============+++++++====");
console.log(algebra2DC);
