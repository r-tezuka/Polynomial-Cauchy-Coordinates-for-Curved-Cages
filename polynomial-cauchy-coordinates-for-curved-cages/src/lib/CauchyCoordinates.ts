import { ComplexNumber } from "$lib/ComplexNumber"

export class BezierSpline {
    points: ComplexNumber[] // コントロールポイントの配列
    terminals: number[] // Bezierの端点のIDの配列
    constructor(points: ComplexNumber[], terminals: number[]) {
        this.points = points
        this.terminals = terminals
    }
    getDrawingPoints() {
        const T = 100 // Bezier の分割数
        let result: ComplexNumber[] = []
        this.terminals.forEach((iStart, i) => {
            const iEnd = i + 1 == this.terminals.length ? this.points.length : this.terminals[i + 1]
            const degree = iEnd - iStart
            let cps: ComplexNumber[] = []
            for (let j: number = iStart; j <= iEnd; j++) {
                cps = [...cps, this.points[j % this.points.length]]
            }
            for (let i: number = 0; i < T; i++) {
                const t = i / T
                let pDraw = new ComplexNumber(0, 0)
                cps.forEach((b, i) => {
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
}

export function getCoeffs(cage: BezierSpline, content: ComplexNumber[]) {
    let result: ComplexNumber[][] = []
    content.forEach((z, i) => {
        result = [...result, []]
        cage.terminals.forEach((iStart, j) => {
            const iEnd = j + 1 == cage.terminals.length ? cage.points.length : cage.terminals[j + 1]
            const degree = iEnd - iStart
            const edge: [ComplexNumber, ComplexNumber] = [cage.points[iStart], cage.points[iEnd % cage.points.length]]
            for (let m: number = 0; m < degree; m++) {
                const c = integral(z, edge, m, degree)
                result[i] = [...result[i], c.div(new ComplexNumber(0, 2 * Math.PI))]
            }
        })
    })
    return result
}

export function cauchyCoordinates(coeffs: ComplexNumber[][], controlPoints: ComplexNumber[]) {
    let result: ComplexNumber[] = []
    coeffs.forEach((pz) => {
        let newP = new ComplexNumber(0, 0)
        pz.forEach((p, i) => {
            newP = newP.add(p.mul(controlPoints[i]))
        })
        result = [...result, newP]
    })
    return result
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
