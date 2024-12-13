<script lang="ts">
	import { onMount } from "svelte";
	import { ComplexNumber, convertToComplexNumber } from "$lib/ComplexNumber";
	import { BezierSplineCage } from "$lib/CauchyCoordinates";
	import { parseSVG, shiftInverse } from "$lib/Svg";

	// Canvas 関連の変数
	let canvas: HTMLCanvasElement;
	let ctx: CanvasRenderingContext2D;
	let scale: number = 1;
	let isDragging = false; // ドラッグ中かどうか
	let dragStart = { x: 0, y: 0 }; // ドラッグ開始位置
	let offset = { x: 0, y: 0 }; // 現在のオフセット
	let lastOffset = { x: 0, y: 0 }; // ドラッグ終了時のオフセット
	let posInCanvas = { x: 0, y: 0 }; // オフセットとスケールを考慮したcanvas内マウス位置
	const MAX_SCALE = 5;
	const MIN_SCALE = 0.3;
	const NEAREST_THRESHOLD = 20; // 最近傍点の検出閾値

	// Cage 関連
	let cage: BezierSplineCage;
	let shape: ComplexNumber[][] = [];
	let cagePolygon: ComplexNumber[] = []; // 作成中のケージを格納する
	let svg: {
		d: { command: string; points: ComplexNumber[] }[];
		fill: string | undefined;
		stroke: string | undefined;
	}[] = [];

	// 画面モード
	let mode = "deform";
	let mousePointDiff = { x: 0, y: 0 };
	let pActive = -1;

	// 初期化
	onMount(() => {
		ctx = canvas.getContext("2d") as CanvasRenderingContext2D;

		// init cage and shape
		cage = createDefaultCage();
		shape = createDefaultContent();

		// init C（コーシー変換係数）
		cage.setCoeffs(shape);
		shape = cage.cauchyCoordinates();
		// init canvas
		handleResize();
		resetCanvas();
	});

	// ウインドウのリサイズ
	function handleResize() {
		// キャンバスをブラウザのサイズに合わせる
		const rect = canvas.getBoundingClientRect();
		const headerOffset = rect.top + rect.left; // leftに何もない前提
		canvas.width = window.innerWidth;
		canvas.height = window.innerHeight - headerOffset;
	}

	// キーボードイベント
	function handleKeydown(e: KeyboardEvent) {
		// Spaceキーを押したときの処理
		if (e.code === "Space") {
			e.preventDefault(); // デフォルトの動作を防止 (スクロールなど)
			resetCanvas();
		}
	}

	// UIイベント
	function handleModeChange(event: Event) {
		cagePolygon = [];
		const input = event.target as HTMLInputElement;
		if (input.value == "create") {
			cage = new BezierSplineCage([], []);
		}
		if (input.value == "deform") {
			cage.setCoeffs(shape);
			shape = cage.cauchyCoordinates();
		}
	}
	function handleReset() {
		cage = createDefaultCage();
		cage.setCoeffs(createDefaultContent());
		shape = cage.cauchyCoordinates();
		cagePolygon = [];
		resetCanvas();
		mode = "deform";
	}
	async function handleFileDrop(event: DragEvent) {
		event.preventDefault();
		const dataTransfer = event.dataTransfer as DataTransfer;
		const file = dataTransfer.files[0];
		const svgRaw = await parseSVG(file);
		const svgShifted = shiftInverse(svgRaw);
		svg = svgShifted.map((path) => {
			const newD = path.d.map(({ command, points }) => {
				const newPoints = convertToComplexNumber(points);
				return { command, points: newPoints };
			});
			return { d: newD, fill: path.fill, stroke: path.stroke };
		});
	}
	const preventDefaults = (event: DragEvent) => {
		event.preventDefault();
		event.stopPropagation();
	};

	// マウスイベント
	function onMouseDown(e: MouseEvent) {
		isDragging = true;
		if (mode == "view") {
			isDragging = true;
			dragStart = { x: e.clientX, y: e.clientY };
		} else if (mode == "deform") {
			if (pActive != -1) {
				mousePointDiff = {
					x: posInCanvas.x - cage.points[pActive].real,
					y: posInCanvas.y - cage.points[pActive].imaginary,
				};
			}
		} else if (mode == "create") {
			if (
				cagePolygon.length > 0 &&
				Math.abs(cagePolygon[0].real - posInCanvas.x) <
					NEAREST_THRESHOLD &&
				Math.abs(cagePolygon[0].imaginary - posInCanvas.y) <
					NEAREST_THRESHOLD
			) {
				cage = createCage(cagePolygon);
				cagePolygon = [];
				mode = "edit";
			} else {
				cagePolygon = [
					...cagePolygon,
					new ComplexNumber(posInCanvas.x, posInCanvas.y),
				];
			}
		}
	}
	function onMouseMove(e: MouseEvent) {
		// オフセットとスケールを考慮したマウス位置の取得
		posInCanvas = {
			x: (e.offsetX - canvas.width / 2 - offset.x) / scale,
			y: -((e.offsetY - canvas.height / 2 - offset.y) / scale),
		};
		if (mode == "view") {
			// 画面をパンする
			if (isDragging) {
				offset.x = lastOffset.x + (e.clientX - dragStart.x);
				offset.y = lastOffset.y + (e.clientY - dragStart.y);
			}
		} else if (mode == "deform" || mode == "edit") {
			// ケージを動かす
			if (isDragging) {
				if (pActive != -1) {
					// console.log(shape[0]);
					cage.points[pActive].real =
						posInCanvas.x - mousePointDiff.x;
					cage.points[pActive].imaginary =
						posInCanvas.y - mousePointDiff.y;
					cage = cage;
					if (mode == "deform") {
						// シェイプを変形する
						shape = cage.cauchyCoordinates();
					}
					// console.log(shape[0]);
				}
			} else {
				pActive = getNearestPointId(cage.points, NEAREST_THRESHOLD);
			}
		}
	}
	function getNearestPointId(points: ComplexNumber[], threshold: number) {
		let result = -1;
		let distMin = Infinity;
		points.forEach((p, i) => {
			const dist = Math.sqrt(
				(p.real - posInCanvas.x) * (p.real - posInCanvas.x) +
					(p.imaginary - posInCanvas.y) *
						(p.imaginary - posInCanvas.y),
			);
			if (dist < distMin && dist < threshold) {
				result = i;
				distMin = dist;
			}
		});
		return result;
	}
	function onMouseUp(e: MouseEvent) {
		isDragging = false;
		lastOffset = { ...offset }; // オフセットを更新
		pActive = -1;
	}
	function onMouseLeave(e: MouseEvent) {
		isDragging = false; // マウスが Canvas から出たらドラッグ終了
	}
	function handleWheel(e: WheelEvent) {
		// デフォルトのホイール操作を無効化
		e.preventDefault();
		// 新しいスケールを計算
		const oldScale = scale;
		scale -= e.deltaY * 0.01;
		if (scale < MIN_SCALE) {
			scale = MIN_SCALE;
		}
		if (scale > MAX_SCALE) {
			scale = MAX_SCALE;
		}
		// スケールに応じたオフセット調整
		const scaleChange = scale / oldScale;
		offset.x +=
			(e.offsetX - canvas.width / 2 - offset.x) * (1 - scaleChange);
		offset.y +=
			(e.offsetY - canvas.height / 2 - offset.y) * (1 - scaleChange);
		lastOffset = { ...offset }; // オフセットを更新
	}

	// 再描画。定義内の変数が更新されたら呼ばれる
	$: pActive,
		canvas,
		ctx,
		offset,
		scale,
		cage,
		posInCanvas,
		cagePolygon,
		mode,
		updateCanvas();

	// 画面の描画
	function updateCanvas() {
		if (!ctx) return;
		ctx.save(); // 現在の状態を保存
		ctx.clearRect(0, 0, canvas.width, canvas.height); // canvasのクリア
		ctx.setTransform(1, 0, 0, 1, 0, 0); // 変換行列を（設定されていれば）リセット
		ctx.translate(canvas.width / 2, canvas.height / 2); //原点中心にリセット
		ctx.scale(1, -1); // Y軸反転
		ctx.translate(offset.x, -offset.y); // オフセットの適用
		ctx.scale(scale, scale); // スケールをリセット
		drawAll(); // コンテンツの描画
		ctx.restore(); // 保存した状態を復元
	}
	function resetCanvas() {
		const contentBbox = cage.bbox();
		// スケールをリセット
		const contentWidth = contentBbox.max.x - contentBbox.min.x;
		const contentHeight = contentBbox.max.y - contentBbox.min.y;
		const wScale = canvas.width / contentWidth;
		const hScale = canvas.height / contentHeight;
		if (contentWidth == 0 || contentHeight == 0) {
			scale = 1; // 何も読み込まれてない
		} else if (wScale > hScale) {
			scale = hScale * 0.9;
		} else {
			scale = wScale * 0.9;
		}
		const centerX = ((contentBbox.max.x + contentBbox.min.x) / 2) * scale;
		const centerY = ((contentBbox.max.y + contentBbox.min.y) / 2) * scale;
		// オフセットをリセット
		offset = { x: -centerX, y: centerY };
		lastOffset = { ...offset };
	}
	function drawPolygon(points: ComplexNumber[], isLoop: boolean) {
		// draw polygon
		points.forEach((start, i) => {
			const end = points[(i + 1) % points.length];
			if (!isLoop && i == points.length - 1) return;
			ctx.moveTo(start.real, start.imaginary);
			ctx.lineTo(end.real, end.imaginary);
		});
	}
	function drawHandles(bSpline: BezierSplineCage, pActive: number) {
		bSpline.points.forEach((p, i) => {
			const next = bSpline.points[(i + 1) % bSpline.points.length];
			ctx.moveTo(p.real, p.imaginary);
			ctx.lineTo(next.real, next.imaginary);
			if (i == pActive) {
				drawPoint(p.real, p.imaginary, 10);
			} else {
				drawPoint(p.real, p.imaginary);
			}
		});
	}
	function drawSvg() {
		ctx.save();
		svg.forEach((path) => {
			ctx.beginPath();
			path.d.forEach(({ command, points }) => {
				if (command == "M") {
					points.forEach((p) => {
						ctx.moveTo(p.real, p.imaginary);
					});
				} else if (["L", "H", "V"].includes(command)) {
					points.forEach((p) => {
						ctx.lineTo(p.real, p.imaginary);
					});
				} else if (["C", "S"].includes(command)) {
					for (let i = 0; i < points.length; i += 3) {
						ctx.bezierCurveTo(
							points[i + 0].real,
							points[i + 0].imaginary,
							points[i + 1].real,
							points[i + 1].imaginary,
							points[i + 2].real,
							points[i + 2].imaginary,
						);
					}
				}
			});
			if (path.fill != undefined) {
				ctx.fillStyle = path.fill;
				ctx.fill();
			}
			if (path.stroke != undefined) {
				ctx.strokeStyle = path.stroke;
				ctx.stroke();
			}
		});
		ctx.restore();
	}
	function drawAll() {
		ctx.beginPath();
		// draw cage
		ctx.strokeStyle = "lightgray";
		ctx.fillStyle = "lightgray";
		drawHandles(cage, pActive);
		ctx.stroke();
		ctx.beginPath();
		const cagePoints = cage.polygonize();
		ctx.strokeStyle = "black";
		drawPolygon(cagePoints, true);
		// draw content
		shape.forEach((path) => {
			drawPolygon(path, true);
		});
		drawPolygon(cagePolygon, false);
		if (mode == "create") {
			if (cagePolygon.length > 0) {
				if (
					cagePolygon.length > 1 &&
					Math.abs(cagePolygon[0].real - posInCanvas.x) <
						NEAREST_THRESHOLD &&
					Math.abs(cagePolygon[0].imaginary - posInCanvas.y) <
						NEAREST_THRESHOLD
				) {
					drawPoint(
						cagePolygon[0].real,
						cagePolygon[0].imaginary,
						10,
					);
				}
				const last = cagePolygon[cagePolygon.length - 1];
				ctx.moveTo(last.real, last.imaginary);
				ctx.lineTo(posInCanvas.x, posInCanvas.y);
			}
		}
		ctx.stroke();
		drawSvg();
	}
	function drawPoint(x: number, y: number, r?: number) {
		if (r == undefined) r = 5;
		ctx.fillRect(x - r / 2, y - r / 2, r, r);
	}

	// オブジェクトの生成
	function createCage(points: ComplexNumber[]) {
		let cagePoints: ComplexNumber[] = [];
		let curves: number[][] = [];
		points.forEach((start, i) => {
			const end = points[(i + 1) % points.length];
			const vec = end.sub(start);
			const startHandle = vec.mul(0.3).add(start);
			const endHandle = vec.mul(0.7).add(start);
			const j = cagePoints.length;
			const endPointId = i == points.length - 1 ? 0 : j + 3;
			curves = [...curves, [j, j + 1, j + 2, endPointId]];
			cagePoints = [...cagePoints, start, startHandle, endHandle];
		});
		return new BezierSplineCage(cagePoints, curves);
	}
	function createDefaultCage() {
		// init cage
		const cagePoints = [
			new ComplexNumber(-200, -200),
			new ComplexNumber(-100, -200),
			new ComplexNumber(100, -200),
			new ComplexNumber(200, -200),
			new ComplexNumber(200, -100),
			new ComplexNumber(200, 100),
			new ComplexNumber(200, 200),
			new ComplexNumber(100, 200),
			new ComplexNumber(-100, 200),
			new ComplexNumber(-200, 200),
			new ComplexNumber(-200, 100),
			new ComplexNumber(-200, -100),
		];
		const curves = [
			[0, 1, 2, 3],
			[3, 4, 5, 6],
			[6, 7, 8, 9],
			[9, 10, 11, 0],
		];
		return new BezierSplineCage(cagePoints, curves);
	}
	function createDefaultContent() {
		let star: ComplexNumber[] = [];
		const spikes = 5;
		const outerRadius = 100;
		const innerRadius = 30;
		const [cx, cy] = [0, 0];
		const step = Math.PI / spikes;
		for (let i = 0; i < 2 * spikes; i++) {
			const angle = i * step;
			const radius = i % 2 === 0 ? outerRadius : innerRadius;
			const x = cx + Math.cos(angle) * radius;
			const y = cy + Math.sin(angle) * radius;
			star = [...star, new ComplexNumber(x, y)];
		}
		return [star];
	}

	// モード一覧
	const options = [
		{ value: "view", label: "View canvas" },
		{ value: "create", label: "Create cage" },
		{ value: "edit", label: "Edit cage" },
		{ value: "deform", label: "Deform shape" },
	];
</script>

<svelte:window on:keydown={handleKeydown} on:resize={handleResize} />
<div class="container">
	<!-- Canvas -->
	<canvas
		bind:this={canvas}
		on:mousedown={onMouseDown}
		on:mousemove={onMouseMove}
		on:mouseup={onMouseUp}
		on:mouseleave={onMouseLeave}
		on:wheel={handleWheel}
		on:drop={handleFileDrop}
		on:dragover={preventDefaults}
		on:dragenter={preventDefaults}
		on:dragleave={preventDefaults}
	></canvas>
	<div class="overlay-text-left">
		{#each options as { value, label }}
			<label>
				<input
					type="radio"
					bind:group={mode}
					on:change={handleModeChange}
					{value}
				/>
				{label}
			</label>
			<br />
		{/each}
		<br />
		<button on:click={handleReset}>Reset cage & shape</button>
	</div>
	<div class="overlay-text-right">
		X: {posInCanvas.x.toPrecision(3)}
		Y: {posInCanvas.y.toPrecision(3)}
		offsetX: {offset.x.toPrecision(3)}
		offsetY: {offset.y.toPrecision(3)}
		Scale: {scale.toFixed(2)}
	</div>
</div>

<style>
	.container {
		overflow: hidden; /* スクロールバーを非表示 */
		position: relative;
	}
	.overlay-text-left {
		position: absolute;
		top: 0%;
		left: 0%;
		font-size: 12px;
		font-weight: bold;
	}
	.overlay-text-right {
		position: absolute;
		top: 0%;
		right: 0%;
		font-size: 12px;
		font-weight: bold;
	}
</style>
