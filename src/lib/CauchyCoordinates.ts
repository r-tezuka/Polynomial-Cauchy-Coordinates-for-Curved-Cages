import { add, complex, inv, multiply, transpose, zeros, subtract, pow, divide, log, lusolve } from 'mathjs';
import type { Complex, Matrix } from 'mathjs'
export class BezierSplineCage {
    points: Complex[] // コントロールポイントの座標
    curves: number[][] // カーブごとのコントロールポイントのID
    coeffs: Complex[][][] = [] //コーシー変換係数
    srcZs: Complex[] = [] // p2p 用のsrc
    dstZs: Complex[] = [] // p2p 用のdst
    constructor(points: Complex[], curves: number[][]) {
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
        let result: Complex[] = []
        this.curves.forEach((cps) => {
            const degree = cps.length - 1
            for (let i: number = 0; i < T; i++) {
                const t = i / T
                let pDraw: Complex = complex(0, 0)
                cps.forEach((pId, i) => {
                    const b = this.points[pId]
                    const bernsteinBasis = binomialCoefficient(degree, i) * Math.pow(t, i) * Math.pow(1 - t, degree - i)
                    pDraw = add(pDraw, multiply(b, bernsteinBasis)) as Complex
                })
                result.push(pDraw)
            }
        })
        return result
    }
    bbox() {
        let result = { max: { x: 0, y: 0 }, min: { x: 0, y: 0 } }
        this.points.forEach((p) => {
            const x = p.re
            const y = p.im
            if (x < result.min.x) result.min.x = x
            if (y < result.min.y) result.min.y = y
            if (x > result.max.x) result.max.x = x
            if (y > result.max.y) result.max.y = y
        })
        return result
    }
    getCoeffs(points: Complex[]) {
        let result: Complex[][][] = []
        const i2Pi = complex(0, 2 * Math.PI)
        points.forEach((z, i) => {
            result.push([])
            this.curves.forEach((controlPoints, j) => {
                result[i].push([])
                const degree = controlPoints.length - 1
                const [edgeStart, edgeEnd] = [controlPoints[0], controlPoints[degree]]
                const edge: [Complex, Complex] = [this.points[edgeStart], this.points[edgeEnd]]
                for (let m: number = 0; m <= degree; m++) {
                    const c = integral(z, edge, m, degree)
                    result[i][j].push(divide(c, i2Pi) as Complex)
                }
            })
        })
        return result
    }
    setCoeffs(points: Complex[]) {
        this.coeffs = this.getCoeffs(points)
    }
    cauchyCoordinates() {
        let result: Complex[] = []
        this.coeffs.forEach((pz) => {
            let real = 0
            let imaginary = 0
            pz.forEach((ci, i) => {
                const curve = this.curves[i]
                ci.forEach((p, j) => {
                    const pId = curve[j]
                    const c = this.points[pId]
                    // newP += p * c
                    real += p.re * c.re - p.im * c.im;
                    imaginary += p.re * c.im + p.im * c.re;
                })
            })
            result.push(complex(real, imaginary))
        })
        return result
    }
    getCoeffDerivative(points: Complex[], n: number) {
        let result: Complex[][][] = []
        points.forEach((z, i) => {
            result.push([])
            this.curves.forEach((controlPoints, j) => {
                result[i].push([])
                const degree = controlPoints.length - 1
                const [edgeStart, edgeEnd] = [controlPoints[0], controlPoints[degree]]
                const edge: [Complex, Complex] = [this.points[edgeStart], this.points[edgeEnd]]
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
        const Cp2p = convertCoeffs(Cp2pRaw)
        const C2 = convertCoeffs(C2Raw)
        const np2p = Cp2p[0].length
        const n2 = C2[0].length
        let Cp2pSum: Matrix = zeros(np2p, np2p) as Matrix
        let C2Sum: Matrix = zeros(n2, n2) as Matrix
        let b: Matrix = zeros(1, Cp2p[0].length) as Matrix
        this.dstZs.forEach((dstZ, i) => {
            const Cp2pi = Cp2p[i]
            const Cp2pTi = transpose(Cp2p[i])
            const Cp2pDot = multiply(Cp2pTi, Cp2pi)
            Cp2pSum = add(Cp2pSum, Cp2pDot) as Matrix
            const C2i = C2[i]
            const C2Ti = transpose(C2[i])
            const C2Dot = multiply(C2Ti, C2i)
            C2Sum = add(C2Sum, C2Dot) as Matrix
            const bDot = multiply(Cp2pTi, dstZ)
            b = add(b, bDot) as Matrix
        })
        const A = add(Cp2pSum, multiply(C2Sum, lambda))
        return lusolve(A, b)
        // const invA = inv(A);
        // const x = multiply(invA, b);
        // return x
    }
}

function integral(z: Complex, edge: [Complex, Complex], m: number, N: number) {
    let result = complex(0, 0)
    const b = subtract(edge[1], z)
    const bPrev = subtract(edge[0], z)
    for (let k: number = 0; k <= m; k++) {
        for (let l: number = 0; l <= N - m; l++) {
            if (N - m - l + k == 0) continue   //0除算はスキップ
            const mk = binomialCoefficient(m, k)
            const nml = binomialCoefficient(N - m, l)
            const factorNum = mk * nml * Math.pow(-1, N - k - l) / (N - m - l + k)
            const factorCompNum = subtract(multiply(pow(b, N - m + k), pow(bPrev, m - k)), multiply(pow(b, l), pow(bPrev, N - l)))
            result = add(result, multiply(factorCompNum, factorNum)) as Complex
        }
    }
    result = add(result, multiply(multiply(pow(multiply(bPrev, -1), m), pow(b, N - m)), log(divide(b, bPrev) as Complex))) as Complex
    const a = subtract(edge[1], (edge[0]))
    const nm = binomialCoefficient(N, m)
    result = multiply(result, nm) as Complex
    result = divide(result, pow(a, N)) as Complex
    return result
}

function derivative(z: Complex, edge: [Complex, Complex], m: number, N: number, n: number) {
    let result = complex(0, 0)
    const a = subtract(edge[1], edge[0])
    const b = subtract(edge[1], z)
    const bPrev = subtract(edge[0], z)
    const nFactorial = factorial(n)
    const i2Pi = complex(0, Math.PI * 2)
    for (let k = 0; k < m; k++) {
        for (let l = 0; l < N - m; l++) {
            const mk = binomialCoefficient(m, k)
            const nml = binomialCoefficient(N - m, l)
            let factorNum = mk * nml * Math.pow(-1, N - k - l)
            let factorCompNum: Complex
            if (N - m - l + k == n) {
                factorCompNum = multiply(multiply(pow(b, l), pow(bPrev, m - k)), log(divide(b, bPrev) as Complex)) as Complex
            } else {
                factorNum /= N - m - l + k - n
                factorCompNum = subtract(multiply(pow(b, N - m + k - n), pow(bPrev, m - k)), multiply(pow(b, l), pow(bPrev, N - l - n))) as Complex
                result = add(result, multiply(factorCompNum, factorNum)) as Complex
            }
            result = add(result, multiply(factorCompNum, factorNum)) as Complex
        }
        const nm = binomialCoefficient(N, m)
        result = multiply(result, multiply(divide(pow(a, N), i2Pi), nm * nFactorial)) as Complex
    }
    return result
}

function isClockwise(points: Complex[]): boolean {
    if (points.length < 3) {
        return true
    }
    let sum = 0;
    for (let i = 0; i < points.length; i++) {
        const current = points[i];
        const next = points[(i + 1) % points.length];
        sum += (next.re - current.re) * (next.im + current.im);
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

function convertCoeffs(coeffs: Complex[][][]): Complex[][][] {
    return coeffs.map((cz) => {
        let result: Complex[][] = []
        result.push([])
        cz.forEach((cj) => {
            cj.forEach((p) => {
                result[0].push(complex(p.re, p.im))
            })
        })
        return result
    })
}