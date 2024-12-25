import type { Complex } from "mathjs";

export class Shape {
    points: Complex[] = [];
    paths: {
        segments: { command: string; ids: number[] }[];
        fill: string | undefined;
        stroke: string | undefined;
    }[] = [];
}