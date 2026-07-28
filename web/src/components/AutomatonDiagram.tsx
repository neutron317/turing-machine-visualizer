import {
	type PointerEvent as ReactPointerEvent,
	useEffect,
	useRef,
	useState,
} from "react";
import type {
	DFASpec,
	DFATrans,
	DTMSpec,
	DTMTrans,
} from "../contract/schemas.ts";

interface Point {
	x: number;
	y: number;
}
interface Edge {
	from: string;
	to: string;
	label: string;
}

function sym(x: string | null): string {
	return x === null ? "␣" : x;
}

// 遷移ラベル。DFA は read、DTM は read/write,move。
function transLabel(t: DFATrans | DTMTrans): string {
	return "move" in t ? `${sym(t.read)}/${sym(t.write)},${t.move}` : sym(t.read);
}

// spec を状態図の要素へ正規化する。同じ (from,to) の遷移はラベルをまとめる。
function toGraph(spec: DFASpec | DTMSpec): {
	states: string[];
	accept: Set<string>;
	start: string;
	edges: Edge[];
} {
	const grouped = new Map<string, Edge>();
	for (const t of spec.transitions) {
		// 状態名は無制約なので、区切り文字での衝突を避けてタプルを JSON 化する。
		const key = JSON.stringify([t.from, t.to]);
		const label = transLabel(t);
		const g = grouped.get(key);
		if (g) {
			g.label += `, ${label}`;
		} else {
			grouped.set(key, { from: t.from, to: t.to, label });
		}
	}
	return {
		states: spec.states,
		accept: new Set(spec.accept),
		start: spec.start,
		edges: [...grouped.values()],
	};
}

const R_NODE = 22;

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

export function AutomatonDiagram({
	spec,
	current,
	fired,
}: {
	spec: DFASpec | DTMSpec;
	current: string;
	fired?: { from: string; to: string } | null;
}) {
	const { states, accept, start, edges } = toGraph(spec);
	const firedKey = fired ? JSON.stringify([fired.from, fired.to]) : null;
	const n = states.length;
	const R = 46 + 20 * n;
	// ラベル幅(11px monospace ≈ 6.6px/字)を余白に織り込み、側方ノードのまとめ
	// ラベル(自己ループ含む)が viewBox の外へはみ出して切れないようにする。
	const maxLabelLen = edges.reduce((m, e) => Math.max(m, e.label.length), 0);
	const margin = 60 + (maxLabelLen * 6.6) / 2;
	const size = 2 * (R + R_NODE + margin);
	const c = size / 2;

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
	const dragRef = useRef<{ x: number; y: number } | null>(null);

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
			const fx = (e.clientX - rect.left) / rect.width;
			const fy = (e.clientY - rect.top) / rect.height;
			setVb((v) => {
				const nw = Math.min(Math.max(v.w * factor, size / 4), size * 2);
				return {
					x: v.x + fx * (v.w - nw),
					y: v.y + fy * (v.h - nw),
					w: nw,
					h: nw,
				};
			});
		};
		svg.addEventListener("wheel", onWheel, { passive: false });
		return () => svg.removeEventListener("wheel", onWheel);
	}, [size]);

	const onPointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
		dragRef.current = { x: e.clientX, y: e.clientY };
		e.currentTarget.setPointerCapture(e.pointerId);
	};
	const onPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
		if (!dragRef.current) {
			return;
		}
		const rect = e.currentTarget.getBoundingClientRect();
		const dx = ((e.clientX - dragRef.current.x) / rect.width) * vb.w;
		const dy = ((e.clientY - dragRef.current.y) / rect.height) * vb.h;
		dragRef.current = { x: e.clientX, y: e.clientY };
		setVb((v) => ({ ...v, x: v.x - dx, y: v.y - dy }));
	};
	const onPointerUp = () => {
		dragRef.current = null;
	};

	return (
		<div className="relative h-full w-full">
			<div className="absolute top-2 right-2 z-10 flex items-center gap-2 rounded border border-gray-300 bg-white/80 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800/80">
				<span className="text-gray-500 text-xs">ズーム</span>
				<input
					type="range"
					aria-label="ズーム"
					min={0.5}
					max={4}
					step={0.1}
					value={scale}
					onChange={(e) => zoomTo(Number(e.target.value))}
					className="w-28"
				/>
				<button
					type="button"
					className="rounded px-1.5 text-xs hover:bg-gray-100 dark:hover:bg-gray-700"
					onClick={reset}
				>
					リセット
				</button>
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
				onPointerLeave={onPointerUp}
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
						<g key={JSON.stringify([e.from, e.to])} data-fired={isFired}>
							<path
								d={geo.d}
								fill="none"
								stroke="currentColor"
								className={isFired ? "stroke-blue-500" : undefined}
								strokeWidth={isFired ? 2.5 : 1.5}
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
										: "fill-gray-600 font-mono text-[11px] dark:fill-gray-300"
								}
							>
								{e.label}
							</text>
						</g>
					);
				})}

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
