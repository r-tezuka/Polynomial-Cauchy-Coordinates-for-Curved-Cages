<script lang="ts">
	import { onMount } from "svelte";
	import { Point } from "$lib/Point";

	// Canvas 関連の変数
	let canvas: HTMLCanvasElement;
	let ctx: CanvasRenderingContext2D;
	let scale: number = 1;
	let isDragging = false; // ドラッグ中かどうか
	let contentBbox = { min: { x: 0, y: 0 }, max: { x: 0, y: 0 } };
	let dragStart = { x: 0, y: 0 }; // ドラッグ開始位置
	let offset = { x: 0, y: 0 }; // 現在のオフセット
	let lastOffset = { x: 0, y: 0 }; // ドラッグ終了時のオフセット
	let posInCanvas = { x: 0, y: 0 }; // オフセットとスケールを考慮したcanvas内マウス位置
	const MAX_SCALE = 5;
	const MIN_SCALE = 0.3;

	// Cage 関連
	let cage: Point[] = [];
	let star: Point[] = [];

	// 画面モード
	let mode = "view";
	let mousePointDiff = { x: 0, y: 0 };
	let pActive = -1;

	onMount(() => {
		ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
		// init cage
		let p = new Point(-200, -200); // 始点と終点を同一のオブジェクトにする
		cage = [
			p,
			new Point(200, -200),
			new Point(200, 200),
			new Point(-200, 200),
			p,
		];
		// init obj in cage
		const spikes = 5;
		const outerRadius = 100;
		const innerRadius = 30;
		const [cx, cy] = [0, 0];
		const step = Math.PI / spikes;
		for (let i = 0; i < 2 * spikes; i++) {
			const angle = i * step;
			const radius = i % 2 === 0 ? outerRadius : innerRadius;
			const x = cx + Math.cos(angle) * radius;
			const y = cy - Math.sin(angle) * radius; // CanvasのY軸は下方向が正
			star = [...star, new Point(x, y)];
		}
		star = [...star, star[0]];
		// init canvas
		handleResize();
		resetCanvas();
	});
	// リサイズ時の処理
	function handleResize() {
		// キャンバスをブラウザのサイズに合わせる
		const rect = canvas.getBoundingClientRect();
		const headerOffset = rect.top + rect.left; // leftに何もない前提
		canvas.width = window.innerWidth;
		canvas.height = window.innerHeight - headerOffset;
	}
	// キーボードイベントの管理
	function handleKeydown(e: KeyboardEvent) {
		// Spaceキーを押したときの処理
		if (e.code === "Space") {
			e.preventDefault(); // デフォルトの動作を防止 (スクロールなど)
			resetCanvas();
		}
	}
	function onMouseDown(e: MouseEvent) {
		isDragging = true;
		if (mode == "view") {
			isDragging = true;
			dragStart = { x: e.clientX, y: e.clientY };
		} else if (mode == "edit") {
			if (pActive != -1) {
				mousePointDiff = {
					x: posInCanvas.x - cage[pActive].x,
					y: posInCanvas.y - cage[pActive].y,
				};
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
			if (isDragging) {
				offset.x = lastOffset.x + (e.clientX - dragStart.x);
				offset.y = lastOffset.y + (e.clientY - dragStart.y);
			}
		} else if (mode == "edit") {
			if (isDragging) {
				if (pActive != -1) {
					cage[pActive].x = posInCanvas.x - mousePointDiff.x;
					cage[pActive].y = posInCanvas.y - mousePointDiff.y;
					// cage = [...cage];
				}
			} else {
				pActive = getNearestPointId(cage, 50);
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
	// ホイールイベントでスケールを変更
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
	$: pActive, canvas, ctx, offset, scale, cage, updateCanvas();

	function updateCanvas() {
		if (!ctx) {
			return;
		}
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
	function draw(points: Point[], active?: number) {
		// draw cage
		points.forEach((end, i) => {
			if (i > 0) {
				const start = points[i - 1];
				ctx.moveTo(end.x, end.y);
				ctx.lineTo(start.x, start.y);
			}
			if (i == active) {
				drawPoint(end.x, end.y, 10);
			} else {
				drawPoint(end.x, end.y);
			}
		});
	}
	function drawAll() {
		ctx.beginPath();
		draw(cage, pActive);
		draw(star);
		ctx.stroke();
	}

	function drawPoint(x: number, y: number, r?: number) {
		if (r == undefined) r = 5;
		ctx.fillRect(x - r / 2, y - r / 2, r, r);
	}

	function getNearestPointId(points: Point[], threshold: number) {
		let result = -1;
		let distMin = Infinity;
		points.forEach((p, i) => {
			const dist = Math.sqrt(
				(p.x - posInCanvas.x) * (p.x - posInCanvas.x) +
					(p.y - posInCanvas.y) * (p.y - posInCanvas.y),
			);
			if (dist < distMin && dist < threshold) {
				result = i;
				distMin = dist;
			}
		});
		return result;
	}

	// オプション一覧
	const options = [
		{ value: "view", label: "View Mode" },
		{ value: "edit", label: "Edit Mode" },
	];

	// 選択変更時のイベントハンドラ (オプション)
	function handleChange(event: Event) {
		const target = event.target as HTMLInputElement;
		console.log("選択された値:", target.value);
	}
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
	></canvas>
	<div class="overlay-text-left">
		{#each options as { value, label }}
			<label>
				<input
					type="radio"
					bind:group={mode}
					{value}
					on:change={handleChange}
				/>
				{label}
			</label>
			<br />
		{/each}
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
