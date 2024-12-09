import { ComplexNumber } from "$lib/ComplexNumber"

export class BezierSplineCage {
    points: ComplexNumber[] // コントロールポイントの配列
    curves: number[][]
    constructor(points: ComplexNumber[], curves: number[][]) {
        this.points = points
        this.curves = curves
    }
    getDrawingPoints() {
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
                result = [...result, pDraw]
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
    getCoeffs(content: ComplexNumber[]) {
        let result: ComplexNumber[][][] = []
        content.forEach((z, i) => {
            result = [...result, []]
            this.curves.forEach((cps, j) => {
                result[i] = [...result[i], []]
                const degree = cps.length - 1
                const edge: [ComplexNumber, ComplexNumber] = [this.points[cps[0]], this.points[cps[degree]]]
                for (let m: number = 0; m <= degree; m++) {
                    const c = integral(z, edge, m, degree)
                    result[i][j] = [...result[i][j], c.div(new ComplexNumber(0, 2 * Math.PI))]
                }
            })
        })
        return result
    }
    cauchyCoordinates(coeffs: ComplexNumber[][][]) {
        let result: ComplexNumber[] = []
        coeffs.forEach((pz) => {
            let newP = new ComplexNumber(0, 0)
            pz.forEach((ci, i) => {
                ci.forEach((p, j) => {
                    const pId = this.curves[i][j]
                    newP = newP.add(p.mul(this.points[pId]))
                })
            })
            result = [...result, newP]
        })
        return result
    }
}

function integral(z: ComplexNumber, edge: [ComplexNumber, ComplexNumber], m: number, n: number) {
    const a = edge[1].sub(edge[0])
    const b = edge[1].sub(z)
    const bPrev = edge[0].sub(z)
    const nm = binomialCoefficient(n, m)
    let result = new ComplexNumber(0, 0)
    for (let k: number = 0; k <= m; k++) {
        for (let l: number = 0; l <= n - m; l++) {
            if (n - m - l + k == 0) continue //0除算はスキップ
            const mk = binomialCoefficient(m, k)
            const nml = binomialCoefficient(n - m, l)
            const factorNum = mk * nml * Math.pow(-1, n - k - l) / (n - m - l + k)
            const factorCompNum = b.pow(n - m + k).mul(bPrev.pow(m - k)).sub(b.pow(l).mul(bPrev.pow(n - l)))
            result = result.add(factorCompNum.mul(factorNum))
        }
    }
    result = result.add(bPrev.mul(-1).pow(m).mul(b.pow(n - m)).mul(b.div(bPrev).log()))
    result = result.mul(nm)
    result = result.div(a.pow(n))
    return result
}

// 二項係数
function binomialCoefficient(n: number, k: number) {
    return factorial(n) / (factorial(k) * factorial(n - k))
}

// 階乗
function factorial(n: number) {
    let result = 1
    for (let i: number = 2; i <= n; i++) {
        result *= i
    }
    return result
}
