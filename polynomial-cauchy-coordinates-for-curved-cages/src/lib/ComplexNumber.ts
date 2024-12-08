// 複素数クラス
export class ComplexNumber {
    real: number;
    imaginary: number;

    constructor(real: number, imaginary: number) {
        this.real = real;
        this.imaginary = imaginary;
    }

    add(other: ComplexNumber): ComplexNumber {
        return new ComplexNumber(
            this.real + other.real,
            this.imaginary + other.imaginary
        );
    }

    sub(other: ComplexNumber): ComplexNumber {
        return new ComplexNumber(
            this.real - other.real,
            this.imaginary - other.imaginary
        );
    }

    mul(other: ComplexNumber): ComplexNumber {
        const realPart = this.real * other.real - this.imaginary * other.imaginary;
        const imaginaryPart = this.real * other.imaginary + this.imaginary * other.real;
        return new ComplexNumber(realPart, imaginaryPart);
    }

    div(other: ComplexNumber): ComplexNumber {
        const denominator = other.real * other.real + other.imaginary * other.imaginary;
        const realPart = (this.real * other.real + this.imaginary * other.imaginary) / denominator;
        const imaginaryPart = (this.imaginary * other.real - this.real * other.imaginary) / denominator;
        return new ComplexNumber(realPart, imaginaryPart);
    }

    // 絶対値
    modulus(): number {
        return Math.sqrt(this.real * this.real + this.imaginary * this.imaginary);
    }

    // 偏角
    argument(): number {
        return Math.atan2(this.imaginary, this.real);
    }

    // 共役
    conjugate(): ComplexNumber {
        return new ComplexNumber(this.real, -this.imaginary);
    }

    // 対数
    log(): ComplexNumber {
        const modulus = this.modulus();
        const argument = this.argument();
        const real = Math.log(modulus);
        const imaginary = argument;
        return new ComplexNumber(real, imaginary);
    }
}
