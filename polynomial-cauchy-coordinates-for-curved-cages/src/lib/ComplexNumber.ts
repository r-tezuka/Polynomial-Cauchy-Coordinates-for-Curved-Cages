export class ComplexNumber {
    real: number; // 実部
    imaginary: number; // 虚部

    constructor(real: number, imaginary: number) {
        this.real = real;
        this.imaginary = imaginary;
    }

    // 複素数の加算
    add(other: ComplexNumber): ComplexNumber {
        return new ComplexNumber(
            this.real + other.real,
            this.imaginary + other.imaginary
        );
    }

    // 複素数の減算
    sub(other: ComplexNumber): ComplexNumber {
        return new ComplexNumber(
            this.real - other.real,
            this.imaginary - other.imaginary
        );
    }

    // 複素数の乗算
    mul(other: ComplexNumber): ComplexNumber {
        const realPart = this.real * other.real - this.imaginary * other.imaginary;
        const imaginaryPart = this.real * other.imaginary + this.imaginary * other.real;
        return new ComplexNumber(realPart, imaginaryPart);
    }

    // 複素数の除算
    div(other: ComplexNumber): ComplexNumber {
        const denominator = other.real * other.real + other.imaginary * other.imaginary;
        const realPart = (this.real * other.real + this.imaginary * other.imaginary) / denominator;
        const imaginaryPart = (this.imaginary * other.real - this.real * other.imaginary) / denominator;
        return new ComplexNumber(realPart, imaginaryPart);
    }

    // 複素数の絶対値 (モジュラス)
    modulus(): number {
        return Math.sqrt(this.real * this.real + this.imaginary * this.imaginary);
    }

    // 複素数の偏角（角度）
    argument(): number {
        return Math.atan2(this.imaginary, this.real);
    }
    // 複素数の共役
    conjugate(): ComplexNumber {
        return new ComplexNumber(this.real, -this.imaginary);
    }

    // 複素数の対数
    log(): ComplexNumber {
        const modulus = this.modulus();
        const argument = this.argument();
        const realPart = Math.log(modulus); // 対数の実部
        const imaginaryPart = argument; // 対数の虚部
        return new ComplexNumber(realPart, imaginaryPart);
    }
}
