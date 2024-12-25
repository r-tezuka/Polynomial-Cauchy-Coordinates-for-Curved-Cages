<script lang="ts">
	import { onMount } from "svelte";
	import { getNearestPointId } from "$lib/Util";
	import { BezierSplineCage } from "$lib/CauchyCoordinates";
	import { parseSVG, shiftInverse } from "$lib/Svg";
	import type { Complex } from "mathjs";
	import { complex } from "mathjs";
	import { Shape } from "$lib/Shape";
	import {
		createCage,
		createDefaultCage,
		createDefaultContent,
	} from "$lib/SampleObject";

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
	let shape: Shape = new Shape();
	let cagePolygon: Complex[] = []; // 作成中のケージを格納する

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
		cage.setCoeffs(shape.points);
		shape.points = cage.cauchyCoordinates();
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
			cage.setCoeffs(shape.points);
			shape.points = cage.cauchyCoordinates();
		}
		if (input.value == "p2p") {
			cage.setCoeffs(shape.points);
			shape.points = cage.cauchyCoordinates();
		}
	}
	function handleReset() {
		cage = createDefaultCage();
		shape = createDefaultContent();
		cage.setCoeffs(shape.points);
		shape.points = cage.cauchyCoordinates();
		cagePolygon = [];
		resetCanvas();
		mode = "deform";
	}
	function handleP2P() {
		const x = cage.p2pDeformation();
		let i = 0;
		x.forEach((pHandle) => {
			const iCurve = Math.trunc(i / 4);
			const iCp = i % 4;
			const iPoint = cage.curves[iCurve][iCp];
			cage.points[iPoint] = complex(pHandle.re, pHandle.im);
			i++;
		});
	}

	async function handleFileDrop(event: DragEvent) {
		event.preventDefault();
		const dataTransfer = event.dataTransfer as DataTransfer;
		const file = dataTransfer.files[0];
		const svgRaw = await parseSVG(file);
		const svgShifted = shiftInverse(svgRaw);
		let svgPoints: Complex[] = [];
		shape = new Shape();
		svgShifted.forEach((path) => {
			const segments = path.d.map(({ command, points }) => {
				let id = svgPoints.length;
				let ids: number[] = [];
				points.forEach((p, i) => {
					svgPoints.push(complex(p.x, p.y));
					ids.push(id + i);
				});
				return { command, ids };
			});
			shape.paths.push({
				segments,
				fill: path.fill,
				stroke: path.stroke,
			});
		});
		shape.points = svgPoints;
		cage.setCoeffs(shape.points);
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
					x: posInCanvas.x - cage.points[pActive].re,
					y: posInCanvas.y - cage.points[pActive].im,
				};
			}
		} else if (mode == "create") {
			if (
				cagePolygon.length > 0 &&
				Math.abs(cagePolygon[0].re - posInCanvas.x) <
					NEAREST_THRESHOLD &&
				Math.abs(cagePolygon[0].im - posInCanvas.y) < NEAREST_THRESHOLD
			) {
				cage = createCage(cagePolygon);
				cagePolygon = [];
				mode = "edit";
			} else {
				cagePolygon = [
					...cagePolygon,
					complex(posInCanvas.x, posInCanvas.y),
				];
			}
		} else if (mode == "p2p") {
			const p = complex(posInCanvas.x, posInCanvas.y);
			if (cage.srcZs.length == cage.dstZs.length) {
				cage.srcZs = [...cage.srcZs, p];
			} else {
				cage.dstZs = [...cage.dstZs, p];
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
					cage.points[pActive].re = posInCanvas.x - mousePointDiff.x;
					cage.points[pActive].im = posInCanvas.y - mousePointDiff.y;
					cage = cage;
					if (mode == "deform") {
						// シェイプを変形する
						shape.points = cage.cauchyCoordinates();
					}
					// console.log(shape[0]);
				}
			} else {
				pActive = getNearestPointId(
					cage.points,
					posInCanvas,
					NEAREST_THRESHOLD,
				);
			}
		}
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
	function drawPolygon(points: Complex[], isLoop: boolean) {
		// draw polygon
		points.forEach((start, i) => {
			const end = points[(i + 1) % points.length];
			if (!isLoop && i == points.length - 1) return;
			ctx.moveTo(start.re, start.im);
			ctx.lineTo(end.re, end.im);
		});
	}
	function drawHandles(bSpline: BezierSplineCage, pActive: number) {
		bSpline.points.forEach((p, i) => {
			const next = bSpline.points[(i + 1) % bSpline.points.length];
			ctx.moveTo(p.re, p.im);
			ctx.lineTo(next.re, next.im);
			if (i == pActive) {
				drawPoint(p.re, p.im, 10);
			} else {
				drawPoint(p.re, p.im);
			}
		});
	}
	function drawShape(shape: Shape) {
		ctx.save();
		shape.paths.forEach((path) => {
			ctx.beginPath();
			path.segments.forEach(({ command, ids }) => {
				const points = ids.map((i) => {
					return shape.points[i];
				});
				if (command == "M") {
					points.forEach((p) => {
						ctx.moveTo(p.re, p.im);
					});
				} else if (["L", "H", "V"].includes(command)) {
					points.forEach((p) => {
						ctx.lineTo(p.re, p.im);
					});
				} else if (["C", "S"].includes(command)) {
					for (let i = 0; i < points.length; i += 3) {
						ctx.bezierCurveTo(
							points[i + 0].re,
							points[i + 0].im,
							points[i + 1].re,
							points[i + 1].im,
							points[i + 2].re,
							points[i + 2].im,
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
		drawShape(shape);
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
		drawPolygon(cagePolygon, false);
		if (mode == "create") {
			if (cagePolygon.length > 0) {
				if (
					cagePolygon.length > 1 &&
					Math.abs(cagePolygon[0].re - posInCanvas.x) <
						NEAREST_THRESHOLD &&
					Math.abs(cagePolygon[0].im - posInCanvas.y) <
						NEAREST_THRESHOLD
				) {
					drawPoint(cagePolygon[0].re, cagePolygon[0].im, 10);
				}
				const last = cagePolygon[cagePolygon.length - 1];
				ctx.moveTo(last.re, last.im);
				ctx.lineTo(posInCanvas.x, posInCanvas.y);
			}
		}
		ctx.stroke();
		ctx.fillStyle = "red";
		cage.srcZs.forEach((p) => {
			drawPoint(p.re, p.im, 10);
		});
		ctx.fillStyle = "blue";
		cage.dstZs.forEach((p) => {
			drawPoint(p.re, p.im, 10);
		});
		ctx.fillStyle = "";
	}
	function drawPoint(x: number, y: number, r?: number) {
		if (r == undefined) r = 5;
		ctx.fillRect(x - r / 2, y - r / 2, r, r);
	}

	// モード一覧
	const options = [
		{ value: "view", label: "View canvas" },
		{ value: "create", label: "Create cage" },
		{ value: "edit", label: "Edit cage" },
		{ value: "deform", label: "Deform shape" },
		{ value: "p2p", label: "P2P Deformation" },
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
		{#if mode == "p2p"}
			<br />
			<br />
			<button on:click={handleP2P}>Deform</button>
		{/if}
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
