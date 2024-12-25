import { BezierSplineCage } from "$lib/CauchyCoordinates";
import type { Complex } from "mathjs";
import { complex, add, subtract, multiply } from "mathjs";
import { Shape } from "$lib/Shape";


// オブジェクトの生成
export function createCage(points: Complex[]) {
    let cagePoints: Complex[] = [];
    let curves: number[][] = [];
    points.forEach((start, i) => {
        const end = points[(i + 1) % points.length];
        const vec = subtract(end, start);
        const startHandle = add(multiply(vec, 0.3), start) as Complex;
        const endHandle = add(multiply(vec, 0.7), start) as Complex;
        const j = cagePoints.length;
        const endPointId = i == points.length - 1 ? 0 : j + 3;
        curves.push([j, j + 1, j + 2, endPointId]);
        cagePoints.push(start, startHandle, endHandle);
    });
    return new BezierSplineCage(cagePoints, curves);
}
export function createDefaultCage() {
    // init cage
    const cagePoints = [
        complex(-200, -200),
        complex(-100, -200),
        complex(100, -200),
        complex(200, -200),
        complex(200, -100),
        complex(200, 100),
        complex(200, 200),
        complex(100, 200),
        complex(-100, 200),
        complex(-200, 200),
        complex(-200, 100),
        complex(-200, -100),
    ];
    const curves = [
        [0, 1, 2, 3],
        [3, 4, 5, 6],
        [6, 7, 8, 9],
        [9, 10, 11, 0],
    ];
    return new BezierSplineCage(cagePoints, curves);
}
export function createDefaultContent() {
    let result = new Shape();
    let star: Complex[] = [];
    const spikes = 5;
    const outerRadius = 100;
    const innerRadius = 30;
    const [cx, cy] = [0, 0];
    const step = Math.PI / spikes;
    let ids: number[] = [];
    for (let i = 0; i < 2 * spikes; i++) {
        const angle = i * step;
        const radius = i % 2 === 0 ? outerRadius : innerRadius;
        const x = cx + Math.cos(angle) * radius;
        const y = cy + Math.sin(angle) * radius;
        star.push(complex(x, y));
        ids.push(i);
    }
    ids.push(0); //ループを閉じる
    result.points = star;
    result.paths = [
        {
            segments: [
                { command: "M", ids: [0] },
                { command: "L", ids: ids },
            ],
            fill: undefined,
            stroke: "black",
        },
    ];
    return result;
}