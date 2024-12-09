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

    mul(other: ComplexNumber | number): ComplexNumber {
        if (other instanceof ComplexNumber) {
            const real = this.real * other.real - this.imaginary * other.imaginary;
            const imaginary = this.real * other.imaginary + this.imaginary * other.real;
            return new ComplexNumber(real, imaginary);
        }
        else {
            return new ComplexNumber(this.real * other, this.imaginary * other);
        }
    }

    div(other: ComplexNumber): ComplexNumber {
        const denominator = other.real * other.real + other.imaginary * other.imaginary;
        const real = (this.real * other.real + this.imaginary * other.imaginary) / denominator;
        const imaginary = (this.imaginary * other.real - this.real * other.imaginary) / denominator;
        return new ComplexNumber(real, imaginary);
    }

    pow(n: number): ComplexNumber {
        // 極形式を使用して計算
        const modulus = this.modulus(); // 絶対値
        const argument = this.argument(); // 偏角

        const newModulus = Math.pow(modulus, n); // 絶対値を N 乗
        const newArgument = argument * n; // 偏角を N 倍

        // 極形式をデカルト形式に変換
        const real = newModulus * Math.cos(newArgument);
        const imaginary = newModulus * Math.sin(newArgument);

        return new ComplexNumber(real, imaginary);
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
