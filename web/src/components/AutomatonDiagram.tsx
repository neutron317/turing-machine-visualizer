import {
	type PointerEvent as ReactPointerEvent,
	useEffect,
	useRef,
	useState,
} from "react";
import type { DisplayGraph } from "./specDraft.ts";

interface Point {
	x: number;
	y: number;
}

const R_NODE = 22;
// キャンバス(viewBox)の一辺。機械が変わってもこの値を一定に保つことで、
// ノードの表示サイズが DFA/DTM で揃う(状態数やラベル長に依らない)。
const DIAGRAM_SIZE = 640;

// A→B の曲線(両端はノード境界)。矢印は marker-end で終端に付く。
function curve(a: Point, b: Point): { d: string; lx: number; ly: number } {
	const dx = b.x - a.x;
	const dy = b.y - a.y;
	const len = Math.hypot(dx, dy) || 1;
	const ux = dx / len;
	const uy = dy / len;
	const sx = a.x + ux * R_NODE;
	const sy = a.y + uy * R_NODE;
	const ex = b.x - ux * R_NODE;
	const ey = b.y - uy * R_NODE;
	const mx = (sx + ex) / 2;
	const my = (sy + ey) / 2;
	// 垂直方向へ膨らませる。逆向きの遷移は自然に反対側へ曲がる。
	const cx = mx + -uy * 26;
	const cy = my + ux * 26;
	return { d: `M ${sx} ${sy} Q ${cx} ${cy} ${ex} ${ey}`, lx: cx, ly: cy };
}

// A→A の自己ループ(中心から外向きに膨らむ)。
function selfLoop(p: Point, c: number): { d: string; lx: number; ly: number } {
	let ox = p.x - c;
	let oy = p.y - c;
	const ol = Math.hypot(ox, oy);
	if (ol < 1) {
		ox = 0;
		oy = -1;
	} else {
		ox /= ol;
		oy /= ol;
	}
	const ang = Math.atan2(oy, ox);
	const spread = 0.6;
	const s = {
		x: p.x + R_NODE * Math.cos(ang - spread),
		y: p.y + R_NODE * Math.sin(ang - spread),
	};
	const e = {
		x: p.x + R_NODE * Math.cos(ang + spread),
		y: p.y + R_NODE * Math.sin(ang + spread),
	};
	const apex = { x: p.x + ox * (R_NODE + 30), y: p.y + oy * (R_NODE + 30) };
	const perp = { x: -oy, y: ox };
	const c1 = { x: apex.x - perp.x * 22, y: apex.y - perp.y * 22 };
	const c2 = { x: apex.x + perp.x * 22, y: apex.y + perp.y * 22 };
	return {
		d: `M ${s.x} ${s.y} C ${c1.x} ${c1.y} ${c2.x} ${c2.y} ${e.x} ${e.y}`,
		lx: p.x + ox * (R_NODE + 46),
		ly: p.y + oy * (R_NODE + 46),
	};
}

// クライアント座標 → viewBox(SVG)座標。preserveAspectRatio="meet" の
// レターボックスを考慮する(パン/ズーム/当たり判定で共通に使う)。
function clientToSvg(
	clientX: number,
	clientY: number,
	rect: DOMRect,
	vb: { x: number; y: number; w: number; h: number },
): Point {
	const s = Math.min(rect.width / vb.w, rect.height / vb.h);
	return {
		x: vb.x + (clientX - rect.left - (rect.width - vb.w * s) / 2) / s,
		y: vb.y + (clientY - rect.top - (rect.height - vb.h * s) / 2) / s,
	};
}

export function AutomatonDiagram({
	graph,
	current,
	fired,
	rightInset = 0,
	historyOpen = false,
	onToggleHistory,
	editable = false,
	onAddTransition,
}: {
	graph: DisplayGraph;
	current: string;
	fired?: { from: string; to: string } | null;
	rightInset?: number;
	historyOpen?: boolean;
	onToggleHistory?: () => void;
	// 編集モード: 状態間ドラッグで遷移を追加(無効な遷移は赤で表示される)。
	editable?: boolean;
	onAddTransition?: (from: string, to: string) => void;
}) {
	const { states, accept, start, edges } = graph;
	const firedKey = fired ? JSON.stringify([fired.from, fired.to]) : null;
	const n = states.length;
	// ラベル幅(11px monospace ≈ 6.6px/字)を余白に織り込み、側方ノードのまとめ
	// ラベル(自己ループ含む)がキャンバス外へはみ出して切れないようにする。
	const maxLabelLen = edges.reduce((m, e) => Math.max(m, e.label.length), 0);
	const margin = 60 + (maxLabelLen * 6.6) / 2;
	// キャンバスは常に一定サイズ。状態を並べる円の半径 R をここから逆算し、
	// ラベル余白を確保しつつ収める(こうするとノードの表示 px が機械間で揃う)。
	const size = DIAGRAM_SIZE;
	const c = size / 2;
	const R = Math.max(40, c - R_NODE - margin);

	const pos = new Map<string, Point>();
	states.forEach((st, i) => {
		if (n === 1) {
			pos.set(st, { x: c, y: c });
			return;
		}
		const a = -Math.PI / 2 + (2 * Math.PI * i) / n;
		pos.set(st, { x: c + R * Math.cos(a), y: c + R * Math.sin(a) });
	});

	// 開始マーカー(外側からノードへ入る矢印)。
	const sp = pos.get(start) ?? { x: c, y: c };
	let sox = sp.x - c;
	let soy = sp.y - c;
	const sol = Math.hypot(sox, soy);
	if (sol < 1) {
		sox = -1;
		soy = 0;
	} else {
		sox /= sol;
		soy /= sol;
	}

	// --- pan / zoom(viewBox を操作。ライブラリ不要)---
	const svgRef = useRef<SVGSVGElement>(null);
	const [vb, setVb] = useState(() => ({ x: 0, y: 0, w: size, h: size }));
	// ドラッグの種別: pan(視点移動)か link(遷移の作図)。moved でクリックと
	// ドラッグを区別する(小さなクリックはパン、ノード間ドラッグは遷移作図)。
	const gesture = useRef<{
		kind: "pan" | "link";
		from?: string;
		sx: number;
		sy: number;
		lastX: number;
		lastY: number;
		moved: boolean;
	} | null>(null);
	// 作図中の一時線(from ノード → カーソル)。
	const [link, setLink] = useState<{
		from: string;
		x: number;
		y: number;
	} | null>(null);
	// SVG 座標で半径 R_NODE 内の最も近いノード名を返す。
	const hitNode = (x: number, y: number): string | null => {
		for (const [name, p] of pos) {
			if (Math.hypot(x - p.x, y - p.y) <= R_NODE) {
				return name;
			}
		}
		return null;
	};

	// スケール(1=フィット, >1=拡大)へ、現在の中心を保ってズームする。
	const zoomTo = (scale: number) => {
		setVb((v) => {
			const nw = Math.min(Math.max(size / scale, size / 4), size * 2);
			const cx = v.x + v.w / 2;
			const cy = v.y + v.h / 2;
			return { x: cx - nw / 2, y: cy - nw / 2, w: nw, h: nw };
		});
	};
	const reset = () => setVb({ x: 0, y: 0, w: size, h: size });
	const scale = size / vb.w;

	// ホイールでカーソル位置基準にズーム(ページスクロールを止めるため非 passive)。
	useEffect(() => {
		const svg = svgRef.current;
		if (!svg) {
			return;
		}
		const onWheel = (e: WheelEvent) => {
			e.preventDefault();
			const rect = svg.getBoundingClientRect();
			const factor = e.deltaY > 0 ? 1.1 : 1 / 1.1;
			setVb((v) => {
				const nw = Math.min(Math.max(v.w * factor, size / 4), size * 2);
				// letterbox(meet)を考慮してカーソル直下の viewBox 座標を固定する。
				const s = Math.min(rect.width / v.w, rect.height / v.h);
				const px =
					v.x + (e.clientX - rect.left - (rect.width - v.w * s) / 2) / s;
				const py =
					v.y + (e.clientY - rect.top - (rect.height - v.h * s) / 2) / s;
				return {
					x: px - ((px - v.x) / v.w) * nw,
					y: py - ((py - v.y) / v.h) * nw,
					w: nw,
					h: nw,
				};
			});
		};
		svg.addEventListener("wheel", onWheel, { passive: false });
		return () => svg.removeEventListener("wheel", onWheel);
		// size は定数(DIAGRAM_SIZE)なのでリスナは一度だけ張れば十分。
	}, []);

	const onPointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
		const rect = e.currentTarget.getBoundingClientRect();
		const p = clientToSvg(e.clientX, e.clientY, rect, vb);
		const hit = editable ? hitNode(p.x, p.y) : null;
		gesture.current = {
			kind: hit ? "link" : "pan",
			from: hit ?? undefined,
			sx: e.clientX,
			sy: e.clientY,
			lastX: e.clientX,
			lastY: e.clientY,
			moved: false,
		};
		if (hit) {
			setLink({ from: hit, x: p.x, y: p.y });
		}
		e.currentTarget.setPointerCapture(e.pointerId);
	};
	const onPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
		const g = gesture.current;
		if (!g) {
			return;
		}
		if (!g.moved && Math.hypot(e.clientX - g.sx, e.clientY - g.sy) > 4) {
			g.moved = true;
		}
		const rect = e.currentTarget.getBoundingClientRect();
		if (g.kind === "link") {
			const p = clientToSvg(e.clientX, e.clientY, rect, vb);
			setLink((l) => (l ? { ...l, x: p.x, y: p.y } : l));
			return;
		}
		// パン: preserveAspectRatio="meet" の実効スケールで delta を換算する。
		const s = Math.min(rect.width / vb.w, rect.height / vb.h);
		const dx = (e.clientX - g.lastX) / s;
		const dy = (e.clientY - g.lastY) / s;
		g.lastX = e.clientX;
		g.lastY = e.clientY;
		setVb((v) => ({ ...v, x: v.x - dx, y: v.y - dy }));
	};
	const onPointerUp = (e: ReactPointerEvent<SVGSVGElement>) => {
		const g = gesture.current;
		gesture.current = null;
		if (!g) {
			return;
		}
		if (g.kind === "link") {
			setLink(null);
			if (g.moved && g.from && onAddTransition) {
				const rect = e.currentTarget.getBoundingClientRect();
				const p = clientToSvg(e.clientX, e.clientY, rect, vb);
				const target = hitNode(p.x, p.y);
				if (target) {
					onAddTransition(g.from, target);
				}
			}
		}
	};
	const onPointerCancel = () => {
		gesture.current = null;
		setLink(null);
	};
	const linkFromPos = link ? (pos.get(link.from) ?? null) : null;

	return (
		<div className="relative h-full w-full">
			{/* 操作クラスタ(縦ズーム + 履歴トグル)。テープの上を避けて右上に置く。 */}
			<div
				className="absolute z-30 flex flex-col items-center gap-2 rounded border border-gray-300 bg-white/85 p-2 text-sm dark:border-gray-600 dark:bg-gray-800/85"
				style={{ top: 12, right: rightInset + 12 }}
			>
				{onToggleHistory && (
					<button
						type="button"
						aria-pressed={historyOpen}
						className="rounded border border-gray-300 px-2 py-0.5 text-xs hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-700"
						onClick={onToggleHistory}
					>
						{historyOpen ? "履歴を隠す" : "遷移履歴"}
					</button>
				)}
				<span className="text-gray-500 text-xs">ズーム</span>
				<input
					type="range"
					aria-label="ズーム"
					min={0.5}
					max={4}
					step={0.1}
					value={scale}
					onChange={(e) => zoomTo(Number(e.target.value))}
					className="h-28"
					style={{ writingMode: "vertical-lr", direction: "rtl" }}
				/>
				<button
					type="button"
					className="rounded px-1.5 text-xs hover:bg-gray-100 dark:hover:bg-gray-700"
					onClick={reset}
				>
					リセット
				</button>
				{editable && (
					<span className="max-w-16 text-center text-[11px] text-gray-600 leading-tight dark:text-gray-300">
						ドラッグで遷移を追加
					</span>
				)}
			</div>
			<svg
				ref={svgRef}
				viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
				preserveAspectRatio="xMidYMid meet"
				className="h-full w-full touch-none cursor-grab text-gray-400 active:cursor-grabbing dark:text-gray-500"
				role="img"
				aria-label="状態遷移図"
				onPointerDown={onPointerDown}
				onPointerMove={onPointerMove}
				onPointerUp={onPointerUp}
				onPointerCancel={onPointerCancel}
				onPointerLeave={onPointerCancel}
			>
				<title>状態遷移図</title>
				<defs>
					<marker
						id="arrow"
						viewBox="0 0 10 10"
						refX="9"
						refY="5"
						markerWidth="7"
						markerHeight="7"
						orient="auto-start-reverse"
					>
						<path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
					</marker>
					<marker
						id="arrow-active"
						viewBox="0 0 10 10"
						refX="9"
						refY="5"
						markerWidth="7"
						markerHeight="7"
						orient="auto-start-reverse"
					>
						<path d="M 0 0 L 10 5 L 0 10 z" className="fill-blue-500" />
					</marker>
				</defs>

				{/* 開始マーカー */}
				<line
					x1={sp.x + sox * (R_NODE + 26)}
					y1={sp.y + soy * (R_NODE + 26)}
					x2={sp.x + sox * (R_NODE + 2)}
					y2={sp.y + soy * (R_NODE + 2)}
					stroke="currentColor"
					strokeWidth={1.5}
					markerEnd="url(#arrow)"
				/>

				{/* 遷移 */}
				{edges.map((e) => {
					const a = pos.get(e.from);
					const b = pos.get(e.to);
					if (!a || !b) {
						return null;
					}
					const geo = e.from === e.to ? selfLoop(a, c) : curve(a, b);
					const isFired = JSON.stringify([e.from, e.to]) === firedKey;
					return (
						<g
							key={JSON.stringify([e.from, e.to])}
							data-fired={isFired}
							data-invalid={!e.valid}
						>
							<path
								d={geo.d}
								fill="none"
								stroke="currentColor"
								className={
									isFired
										? "stroke-blue-500"
										: e.valid
											? undefined
											: "stroke-red-500"
								}
								strokeWidth={isFired ? 2.5 : 1.5}
								strokeDasharray={e.valid ? undefined : "6 4"}
								markerEnd={isFired ? "url(#arrow-active)" : "url(#arrow)"}
							/>
							<text
								x={geo.lx}
								y={geo.ly}
								textAnchor="middle"
								dominantBaseline="middle"
								className={
									isFired
										? "fill-blue-600 font-bold font-mono text-[11px] dark:fill-blue-300"
										: e.valid
											? "fill-gray-600 font-mono text-[11px] dark:fill-gray-300"
											: "fill-red-600 font-mono text-[11px] dark:fill-red-400"
								}
							>
								{e.label}
							</text>
						</g>
					);
				})}

				{/* 作図中の一時線(状態間ドラッグで遷移を作る) */}
				{link && linkFromPos && (
					<line
						x1={linkFromPos.x}
						y1={linkFromPos.y}
						x2={link.x}
						y2={link.y}
						className="stroke-blue-400"
						strokeWidth={2}
						strokeDasharray="5 4"
						markerEnd="url(#arrow-active)"
					/>
				)}

				{/* 状態ノード */}
				{states.map((st) => {
					const p = pos.get(st);
					if (!p) {
						return null;
					}
					const active = st === current;
					return (
						<g key={st} data-state={st} data-active={active}>
							<circle
								cx={p.x}
								cy={p.y}
								r={R_NODE}
								className={
									active
										? "fill-blue-500 stroke-blue-600"
										: "fill-white stroke-gray-400 dark:fill-gray-800 dark:stroke-gray-500"
								}
								strokeWidth={1.5}
							/>
							{accept.has(st) && (
								<circle
									cx={p.x}
									cy={p.y}
									r={R_NODE - 4}
									fill="none"
									className={
										active
											? "stroke-white"
											: "stroke-gray-400 dark:stroke-gray-500"
									}
									strokeWidth={1.5}
								/>
							)}
							<text
								x={p.x}
								y={p.y}
								textAnchor="middle"
								dominantBaseline="central"
								className={
									active
										? "fill-white font-mono text-sm"
										: "fill-gray-700 font-mono text-sm dark:fill-gray-200"
								}
							>
								{st}
							</text>
						</g>
					);
				})}
			</svg>
		</div>
	);
}
