import { ComplexNumber } from "$lib/ComplexNumber"
import { add, matrix, lusolve, complex, inv, multiply, transpose } from 'mathjs';
import type { Complex, Matrix, MathType } from 'mathjs'
export class BezierSplineCage {
    points: ComplexNumber[] // コントロールポイントの座標
    curves: number[][] // カーブごとのコントロールポイントのID
    coeffs: ComplexNumber[][][] = [] //コーシー変換係数
    srcZs: ComplexNumber[] = [] // p2p 用のsrc
    dstZs: ComplexNumber[] = [] // p2p 用のdst
    constructor(points: ComplexNumber[], curves: number[][]) {
        this.points = points
        this.curves = curves
        // 反時計周りに修正
        if (isClockwise(points)) {
            curves.reverse()
            curves.forEach((cps) => {
                cps.reverse()
            })
        }
    }
    polygonize() {
        const T = 100 // Bezier の分割数
        let result: ComplexNumber[] = []
        this.curves.forEach((cps) => {
            const degree = cps.length - 1
            for (let i: number = 0; i < T; i++) {
                const t = i / T
                let pDraw = new ComplexNumber(0, 0)
                cps.forEach((pId, i) => {
                    const b = this.points[pId]
                    const bernsteinBasis = binomialCoefficient(degree, i) * Math.pow(t, i) * Math.pow(1 - t, degree - i)
                    pDraw = pDraw.add(b.mul(bernsteinBasis))
                })
                result.push(pDraw)
            }
        })
        return result
    }
    bbox() {
        let result = { max: { x: 0, y: 0 }, min: { x: 0, y: 0 } }
        this.points.forEach((p) => {
            const x = p.real
            const y = p.imaginary
            if (x < result.min.x) result.min.x = x
            if (y < result.min.y) result.min.y = y
            if (x > result.max.x) result.max.x = x
            if (y > result.max.y) result.max.y = y
        })
        return result
    }
    getCoeffs(points: ComplexNumber[]) {
        let result: ComplexNumber[][][] = []
        const i2Pi = new ComplexNumber(0, 2 * Math.PI)
        points.forEach((z, i) => {
            result.push([])
            this.curves.forEach((controlPoints, j) => {
                result[i].push([])
                const degree = controlPoints.length - 1
                const [edgeStart, edgeEnd] = [controlPoints[0], controlPoints[degree]]
                const edge: [ComplexNumber, ComplexNumber] = [this.points[edgeStart], this.points[edgeEnd]]
                for (let m: number = 0; m <= degree; m++) {
                    const c = integral(z, edge, m, degree)
                    result[i][j].push(c.div(i2Pi))
                }
            })
        })
        return result
    }
    setCoeffs(points: ComplexNumber[]) {
        this.coeffs = this.getCoeffs(points)
    }
    cauchyCoordinates() {
        let result: ComplexNumber[] = []
        this.coeffs.forEach((pz) => {
            let real = 0
            let imaginary = 0
            pz.forEach((ci, i) => {
                const curve = this.curves[i]
                ci.forEach((p, j) => {
                    const pId = curve[j]
                    const c = this.points[pId]
                    // newP += p * c
                    real += p.real * c.real - p.imaginary * c.imaginary;
                    imaginary += p.real * c.imaginary + p.imaginary * c.real;
                })
            })
            result.push(new ComplexNumber(real, imaginary))
        })
        return result
    }
    getCoeffDerivative(points: ComplexNumber[], n: number) {
        let result: ComplexNumber[][][] = []
        points.forEach((z, i) => {
            result.push([])
            this.curves.forEach((controlPoints, j) => {
                result[i].push([])
                const degree = controlPoints.length - 1
                const [edgeStart, edgeEnd] = [controlPoints[0], controlPoints[degree]]
                const edge: [ComplexNumber, ComplexNumber] = [this.points[edgeStart], this.points[edgeEnd]]
                for (let m: number = 0; m <= degree; m++) {
                    const c = derivative(z, edge, m, degree, n)
                    result[i][j].push(c)
                }
            })
        })
        return result
    }
    p2pDeformation() {
        // initialize
        const lambda = 1
        const Cp2pRaw = this.getCoeffs(this.srcZs)
        const C2Raw = this.getCoeffDerivative(this.srcZs, 2)
        // convert ComplexNumber to {re, im}
        const Cp2p = convertCoeffs(Cp2pRaw)
        const C2 = convertCoeffs(C2Raw)
        const dstZs = this.dstZs.map((z) => {
            return complex(z.real, z.imaginary)
        })
        let Cp2pSum: MathType = initSquareMatrix(this.curves.length)
        let C2Sum: MathType = initSquareMatrix(this.curves.length)
        let b: MathType = []
        dstZs.forEach((dstZ, i) => {
            const Cp2pi = Cp2p[i]
            const Cp2pTi = transpose(Cp2p[i])
            const C2i = C2[i]
            const C2Ti = transpose(C2[i])
            const Cp2pDot = multiply(Cp2pTi, Cp2pi)
            Cp2pSum = add(Cp2pSum, Cp2pDot)
            const C2Dot = multiply(C2Ti, C2i)
            C2Sum = add(C2Sum, C2Dot)
            const bDot = multiply(Cp2pTi, dstZ)
            b = add(b, bDot)
        })
        const A = add(Cp2pSum, multiply(C2Sum, lambda))
        const A_inv = inv(A);
        const x = multiply(A_inv, b);
        return x
    }
}

function integral(z: ComplexNumber, edge: [ComplexNumber, ComplexNumber], m: number, N: number) {
    let result = new ComplexNumber(0, 0)
    const b = edge[1].sub(z)
    const bPrev = edge[0].sub(z)
    for (let k: number = 0; k <= m; k++) {
        for (let l: number = 0; l <= N - m; l++) {
            if (N - m - l + k == 0) continue   //0除算はスキップ
            const mk = binomialCoefficient(m, k)
            const nml = binomialCoefficient(N - m, l)
            const factorNum = mk * nml * Math.pow(-1, N - k - l) / (N - m - l + k)
            const factorCompNum = b.pow(N - m + k).mul(bPrev.pow(m - k)).sub(b.pow(l).mul(bPrev.pow(N - l)))
            result = result.add(factorCompNum.mul(factorNum))
        }
    }
    result = result.add(bPrev.mul(-1).pow(m).mul(b.pow(N - m)).mul(b.div(bPrev).log()))
    const a = edge[1].sub(edge[0])
    const nm = binomialCoefficient(N, m)
    result = result.mul(nm)
    result = result.div(a.pow(N))
    return result
}

function derivative(z: ComplexNumber, edge: [ComplexNumber, ComplexNumber], m: number, N: number, n: number) {
    let result = new ComplexNumber(0, 0)
    const a = edge[1].sub(edge[0])
    const b = edge[1].sub(z)
    const bPrev = edge[0].sub(z)
    const nFactorial = factorial(n)
    const i2Pi = new ComplexNumber(0, Math.PI * 2)
    for (let k = 0; k < m; k++) {
        for (let l = 0; l < N - m; l++) {
            const mk = binomialCoefficient(m, k)
            const nml = binomialCoefficient(N - m, l)
            let factorNum = mk * nml * Math.pow(-1, N - k - l)
            let factorCompNum: ComplexNumber
            if (N - m - l + k == n) {
                factorCompNum = b.pow(l).mul(bPrev.pow(m - k)).mul(b.div(bPrev).log())
            } else {
                factorNum /= N - m - l + k - n
                factorCompNum = b.pow(N - m + k - n).mul(bPrev.pow(m - k)).sub(b.pow(l).mul(bPrev.pow(N - l - n)))
                result = result.add(factorCompNum.mul(factorNum))
            }
            result = result.add(factorCompNum.mul(factorNum))
        }
        const nm = binomialCoefficient(N, m)
        result = result.mul(a.pow(N).div(i2Pi).mul(nm * nFactorial))
    }
    return result
}

function isClockwise(points: ComplexNumber[]): boolean {
    if (points.length < 3) {
        return true
    }
    let sum = 0;
    for (let i = 0; i < points.length; i++) {
        const current = points[i];
        const next = points[(i + 1) % points.length];
        sum += (next.real - current.real) * (next.imaginary + current.imaginary);
    }
    // 面積が正なら反時計回り (CCW)、負なら時計回り (CW)
    return sum > 0;
}

// 二項係数
function binomialCoefficient(n: number, k: number) {
    return factorial(n) / (factorial(k) * factorial(n - k))
}

// 階乗
function factorial(n: number): number {
    if (n === 0 || n === 1) {
        return 1
    }
    return n * factorial(n - 1)
}

function convertCoeffs(coeffs: ComplexNumber[][][]): Complex[][][] {
    return coeffs.map((cz) => {
        const cjs = cz.map((cj) => {
            const ps = cj.map((p) => {
                return complex(p.real, p.imaginary)
            })
            return ps
        })
        return cjs
    })
}

function initSquareMatrix(n: number): Matrix {
    return matrix(
        Array.from({ length: n }, () =>
            Array.from({ length: n }, () => complex(0, 0))
        )
    )
}