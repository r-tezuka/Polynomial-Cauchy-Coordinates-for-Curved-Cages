import type { Complex } from "mathjs";

export function getNearestPointId(points: Complex[], posInCanvas: { x: number, y: number }, threshold: number) {
    let result = -1;
    let distMin = Infinity;
    points.forEach((p, i) => {
        const dist = Math.sqrt(
            (p.re - posInCanvas.x) * (p.re - posInCanvas.x) +
            (p.im - posInCanvas.y) * (p.im - posInCanvas.y),
        );
        if (dist < distMin && dist < threshold) {
            result = i;
            distMin = dist;
        }
    });
    return result;
}