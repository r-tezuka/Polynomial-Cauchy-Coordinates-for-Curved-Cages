import { ComplexNumber } from "$lib/ComplexNumber"

export class BezierSplineCage {
    points: ComplexNumber[] // コントロールポイントの座標
    curves: number[][] // カーブごとのコントロールポイントのID
    coeffs: ComplexNumber[][][] = []; //コーシー変換係数
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
    setCoeffs(points: ComplexNumber[]) {
        let result: ComplexNumber[][][] = []
        points.forEach((z, i) => {
            result.push([])
            this.curves.forEach((controlPoints, j) => {
                result[i].push([])
                const degree = controlPoints.length - 1
                const [edgeStart, edgeEnd] = [controlPoints[0], controlPoints[degree]]
                const edge: [ComplexNumber, ComplexNumber] = [this.points[edgeStart], this.points[edgeEnd]]
                for (let m: number = 0; m <= degree; m++) {
                    const c = integral(z, edge, m, degree)
                    result[i][j].push(c.div(new ComplexNumber(0, 2 * Math.PI)))
                }
            })
        })
        this.coeffs = result
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
}

function integral(z: ComplexNumber, edge: [ComplexNumber, ComplexNumber], m: number, n: number) {
    let result = new ComplexNumber(0, 0)
    const b = edge[1].sub(z)
    const bPrev = edge[0].sub(z)
    for (let k: number = 0; k <= m; k++) {
        for (let l: number = 0; l <= n - m; l++) {
            if (n - m - l + k == 0) continue   //0除算はスキップ
            const mk = binomialCoefficient(m, k)
            const nml = binomialCoefficient(n - m, l)
            const factorNum = mk * nml * Math.pow(-1, n - k - l) / (n - m - l + k)
            const factorCompNum = b.pow(n - m + k).mul(bPrev.pow(m - k)).sub(b.pow(l).mul(bPrev.pow(n - l)))
            result = result.add(factorCompNum.mul(factorNum))
        }
    }
    result = result.add(bPrev.mul(-1).pow(m).mul(b.pow(n - m)).mul(b.div(bPrev).log()))
    const a = edge[1].sub(edge[0])
    const nm = binomialCoefficient(n, m)
    result = result.mul(nm)
    result = result.div(a.pow(n))
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