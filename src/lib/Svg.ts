
export type SvgPath = {
    d: { command: string, points: { x: number, y: number }[] }[]
    fill: string | undefined
    stroke: string | undefined
}

type SvgContext = {
    fill: string | undefined
    stroke: string | undefined
    transforms: { command: string, values: number[] }[]
    defs: SvgDefs
}

interface Style {
    [property: string]: string;
}

interface SvgDefs {
    [className: string]: Style;
}

export async function parseSVGFromPath(filePath: string): Promise<SvgPath[]> {
    const response = await fetch(filePath)
    const blob = await response.blob()
    const fileName = filePath.split('/').pop() || 'unknown'
    const file = new File([blob], fileName, { type: blob.type });
    return parseSVG(file)
}

export async function parseSVG(file: File): Promise<SvgPath[]> {
    return new Promise((resolve, reject) => {
        if (file && file.type === "image/svg+xml") {
            const reader = new FileReader();
            reader.onload = () => {
                try {
                    const parser = new DOMParser();
                    const svgDoc = parser.parseFromString(reader.result as string, "image/svg+xml");

                    // SVG要素を取得
                    const svgElement = svgDoc.documentElement;
                    let defs = {}
                    const defsElement = svgElement.querySelector('defs');
                    if (defsElement) {
                        defs = parseDefs(defsElement)
                    }
                    const context: SvgContext = { fill: undefined, stroke: undefined, transforms: [], defs }
                    const result: SvgPath[] = parseElement(svgElement, context)
                    resolve(result);
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = () => reject(new Error("Failed to read file."));
            reader.readAsText(file);
        } else {
            reject(new Error("Please drop a valid SVG file."));
        }
    });
}

function parseElement(element: Element, context: SvgContext): SvgPath[] {
    let currentContext: SvgContext = updateContext(element, context)
    if (element.tagName.toLowerCase() === "path") {
        const path = element as SVGPathElement
        return [parsePath(path, currentContext)]
    }
    // 子要素を再帰的に処理
    let result: SvgPath[] = []
    // currentContext = { fill: undefined, stroke: undefined, transforms: [] }
    for (const child of element.children) {
        // deep copy
        const childContext: SvgContext = {
            fill: currentContext.fill,
            stroke: currentContext.stroke,
            transforms: [...currentContext.transforms],
            defs: currentContext.defs
        }
        const paths = parseElement(child, childContext);
        result = [...result, ...paths]
    }
    return result
}

function updateContext(element: Element, context: SvgContext) {
    //apply class style if class definition exists
    const elmClass = element.getAttribute("class")
    if (elmClass) {
        const def = context.defs[elmClass]
        if (def) {
            const fill = def["fill"]
            if (fill && fill != "none") context.fill = fill
            const stroke = def["stroke"]
            if (stroke && stroke != "none") context.stroke = stroke
        }
    }
    // apply element style
    const fill = element.getAttribute("fill")
    const stroke = element.getAttribute("stroke")
    if (fill && fill != "none") context.fill = fill
    if (stroke && stroke != "none") context.stroke = stroke
    let styleData = element.getAttribute("style")
    if (styleData) {
        styleData.split(';').forEach((rule) => {
            const [key, value] = rule.split(':').map((s) => s.trim());
            if (key && value) {
                if (key == "fill") {
                    context.fill = value
                } else if (key == "stroke") {
                    context.stroke = value
                }
            }
        });
    }
    // apply element transform
    const transform = element.getAttribute("transform")
    if (transform) {
        const commands = transform.match(/[a-z]+\([^\)]+\)/gi);
        if (commands) {
            for (const command of commands) {
                const [type, values] = command.split('(');
                const coordinates = parseCoordinates(values)
                // const args = values
                //     .replace(')', '')
                //     .split(',')
                //     .map((v) => parseFloat(v.trim()));
                context.transforms.push({ command: type.trim(), values: coordinates })
            }
        }
    }
    return context
}

function parsePath(path: SVGPathElement, context: SvgContext): SvgPath {
    // init result
    let result: SvgPath = { d: [], fill: context.fill, stroke: context.stroke };
    const d = path.getAttribute("d");
    if (d) {
        // parse command and points
        const pathCommandRegex = /([a-zA-Z])([^a-zA-Z]*)/g;
        let match: RegExpExecArray | null;
        let currentX = 0;
        let currentY = 0;
        let prev = { x: 0, y: 0 }
        while ((match = pathCommandRegex.exec(d)) !== null) {
            const command = match[1]; // コマンド（例: M, L, C）
            const rawPoints = match[2].trim(); // データ部分を取得
            const points = parseCoordinates(rawPoints)
            // カンマまたは負号で分割して座標を抽出
            // const points = rawPoints
            //     ? rawPoints
            //         .split(/(?=[, -])/g) // カンマまたは負号、空欄を基準に分割
            //         .map((p) => p.replace(",", "").replace("-.", "-0.")) // カンマを除去
            //         .filter((p) => p.trim() !== "") // 空要素を除去
            //         .map(Number) // 数値に変換
            //     : [];
            const isRelative = command === command.toLowerCase();
            const absoluteCommand = isRelative ? command.toUpperCase() : command;
            const newPoints: { x: number, y: number }[] = [];

            if (absoluteCommand === "M" || absoluteCommand === "L") {
                for (let i = 0; i < points.length; i += 2) {
                    const x = points[i] + (isRelative ? currentX : 0);
                    const y = points[i + 1] + (isRelative ? currentY : 0);
                    newPoints.push({ x, y });
                    currentX = x;
                    currentY = y;
                }
            } else if (absoluteCommand === "H") {
                points.forEach((x) => {
                    const absoluteX = x + (isRelative ? currentX : 0);
                    newPoints.push({ x: absoluteX, y: currentY });
                    currentX = absoluteX;
                });
            } else if (absoluteCommand === "V") {
                points.forEach((y) => {
                    const absoluteY = y + (isRelative ? currentY : 0);
                    newPoints.push({ x: currentX, y: absoluteY });
                    currentY = absoluteY;
                });
            } else if (absoluteCommand === "C") {
                for (let i = 0; i < points.length; i += 6) {
                    const x1 = points[i] + (isRelative ? currentX : 0);
                    const y1 = points[i + 1] + (isRelative ? currentY : 0);
                    const x2 = points[i + 2] + (isRelative ? currentX : 0);
                    const y2 = points[i + 3] + (isRelative ? currentY : 0);
                    const x = points[i + 4] + (isRelative ? currentX : 0);
                    const y = points[i + 5] + (isRelative ? currentY : 0);
                    newPoints.push({ x: x1, y: y1 });
                    newPoints.push({ x: x2, y: y2 });
                    newPoints.push({ x, y });
                    currentX = x;
                    currentY = y;
                    prev = { x: x2, y: y2 }
                }
            } else if (absoluteCommand === "S") {
                for (let i = 0; i < points.length; i += 4) {
                    const x1 = currentX - prev.x + currentX
                    const y1 = currentY - prev.y + currentY
                    const x2 = points[i] + (isRelative ? currentX : 0);
                    const y2 = points[i + 1] + (isRelative ? currentY : 0);
                    const x = points[i + 2] + (isRelative ? currentX : 0);
                    const y = points[i + 3] + (isRelative ? currentY : 0);
                    newPoints.push({ x: x1, y: y1 });
                    newPoints.push({ x: x2, y: y2 });
                    newPoints.push({ x, y });
                    currentX = x;
                    currentY = y;
                    prev = { x: x2, y: y2 }
                }
            } else if (absoluteCommand === "Z") {
                // 'Z' has no values, simply close the path
            } else {
                alert("unexpected command detected: " + absoluteCommand)
            }
            result.d.push({ command: absoluteCommand, points: newPoints })
        }
    }
    // apply transform
    if (context.transforms.length > 0) {
        result.d = result.d.map(({ command, points }) => {
            const newPoints = points.map((p) => {
                let newP = { x: p.x, y: p.y }
                context.transforms.forEach(({ command, values }) => {
                    switch (command) {
                        case 'translate':
                            newP.x += values[0]
                            newP.y += values[1]
                            break;
                        case 'rotate':
                            const rad = (values[0] * Math.PI) / 180; // 角度をラジアンに変換
                            const cx = values[1] || 0; // 回転の中心X
                            const cy = values[2] || 0; // 回転の中心Y
                            newP.x += cx
                            newP.y += cy
                            newP.x = newP.x * Math.cos(rad)
                            newP.y = newP.y * Math.sin(rad)
                            newP.x -= cx
                            newP.y -= cy
                            break;
                        case 'scale':
                            const xScale = values[0]
                            const yScale = values[1] || values[0]
                            newP.x *= xScale
                            newP.y *= yScale
                            break;
                        case 'skewX':
                            newP = transform(p, [1, 0, Math.tan((values[0] * Math.PI) / 180), 1, 0, 0]);
                            break;
                        case 'skewY':
                            newP = transform(p, [1, Math.tan((values[0] * Math.PI) / 180), 0, 1, 0, 0]);
                            break;
                        case 'matrix':
                            newP = transform(p, [values[0], values[1], values[2], values[3], values[4], values[5]]);
                            break;
                        default:
                            console.warn(`Unsupported transform type: ${command}`);
                    }
                })
                return newP
            })
            return { command, points: newPoints }
        })
    }
    return result
}

function parseCoordinates(data: string): number[] {
    const numberRegex = /-?\d*\.?\d+(?:e[-+]?\d+)?/g; // 数値の抽出用正規表現
    return data
        .match(numberRegex) // 数値部分を抽出
        ?.map(Number) || []; // 数値配列に変換
    // 正規表現で数値を抽出。整数、浮動小数点、負の数にも対応
    // const regex = /-?\d+(\.\d+)?/g;
    // const matches = data.match(regex);
    // // もしマッチした数値があれば、それを数値に変換して返す
    // return matches ? matches.map(num => parseFloat(num)) : [];
}

function parseDefs(defs: SVGDefsElement): SvgDefs {
    const styleElement = defs.querySelector('style');
    const result: SvgDefs = {};
    if (styleElement) {
        const styleStr = styleElement.textContent
        if (styleStr) {
            // CSSルールを正規表現で分解
            const ruleRegex = /\.([a-zA-Z0-9_-]+)\s*\{([^}]+)\}/g;
            let match: RegExpExecArray | null;
            while ((match = ruleRegex.exec(styleStr)) !== null) {
                const className = match[1];
                const properties = match[2].split(';').reduce((acc: Style, property) => {
                    const [key, value] = property.split(':').map(s => s.trim());
                    if (key && value) {
                        acc[key] = value;
                    }
                    return acc;
                }, {});
                result[className] = properties;
            }
        }
    }
    return result;
}

// アフィン変換
function transform(p: { x: number, y: number }, matrix: number[]): { x: number, y: number } {
    return { x: p.x * matrix[0] + p.y * matrix[2] + matrix[4], y: p.x * matrix[1] + p.y * matrix[3] + matrix[5] }
}

// Y軸反転して原点中心にシフト
export function shiftInverse(paths: SvgPath[]): SvgPath[] {
    let bbox = { max: { x: 0, y: 0 }, min: { x: 0, y: 0 } }
    paths.forEach((path) => {
        path.d.forEach(({ command, points }) => {
            points.forEach((p) => {
                const x = p.x
                const y = p.y
                if (x < bbox.min.x) bbox.min.x = x
                if (y < bbox.min.y) bbox.min.y = y
                if (x > bbox.max.x) bbox.max.x = x
                if (y > bbox.max.y) bbox.max.y = y
            })

        })
    })
    const center = { x: (bbox.max.x + bbox.min.x) / 2, y: (bbox.max.y + bbox.min.y) / 2 }
    return paths.map((path) => {
        const newD = path.d.map(({ command, points }) => {
            const newPoints = points.map((p) => {
                return { x: p.x - center.x, y: -p.y + center.y }
            })
            return { command, points: newPoints }
        })
        return { d: newD, fill: path.fill, stroke: path.stroke }
    })
}