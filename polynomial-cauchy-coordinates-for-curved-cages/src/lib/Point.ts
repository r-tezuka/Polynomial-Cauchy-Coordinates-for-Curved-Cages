export class Point {

    x: number;
    y: number;
    constructor(x: number, y: number) {
        this.x = x;
        this.y = y;
    }
    add(a: Point) {
        return new Point(this.x + a.x, this.y + a.y);
    }
    sub(a: Point) {
        return new Point(this.x - a.x, this.y - a.y);
    }
    multiply(n: number) {
        return new Point(n * this.x, n * this.y);
    }
    norm() {
        return Math.sqrt(this.x * this.x + this.y * this.y)
    }
    radian() {
        return Math.atan2(this.y, this.x);
    }
    // デカルト座標を極座標に変換
    toPolar() {
        return [this.norm(), this.radian()];
    }
    // ベクトルを length (mm) 延長する
    extend(length: number) {
        const currentLength = this.norm();
        // 長さが0の場合、方向が定義できないのでそのまま返す
        const scale = (currentLength + length) / currentLength;
        return new Point(this.x * scale, this.y * scale)
    }
}