import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { machines } from "../fixtures/machines.ts";
import { AutomatonDiagram } from "./AutomatonDiagram.tsx";
import { draftFromMachine, draftGraph } from "./specDraft.ts";

const dfaGraph = draftGraph(draftFromMachine(machines[0]), true); // even-a
// 2 ノード(A=320,82 / B=320,558)・辺なしの編集用グラフ。
const twoNode = draftGraph(
	{ states: ["A", "B"], start: "A", accept: [], rows: [] },
	true,
);

function vbWidth(svg: Element | null): number {
	return Number(svg?.getAttribute("viewBox")?.split(" ")[2]);
}

// jsdom はレイアウト非対応。rect を確定させ client 座標 = viewBox 座標にする。
function prepareSvg(container: HTMLElement): SVGSVGElement {
	const svg = container.querySelector("svg") as SVGSVGElement;
	svg.setPointerCapture = () => {};
	svg.getBoundingClientRect = () =>
		({
			left: 0,
			top: 0,
			width: 640,
			height: 640,
			right: 640,
			bottom: 640,
			x: 0,
			y: 0,
			toJSON: () => {},
			// biome-ignore lint/suspicious/noExplicitAny: テスト用のダミー rect
		}) as any;
	return svg;
}

describe("AutomatonDiagram", () => {
	it("全状態を描き、現在状態をハイライトする", () => {
		const { container, getAllByText } = render(
			<AutomatonDiagram graph={dfaGraph} current="Odd" />,
		);
		expect(getAllByText("Even").length).toBeGreaterThan(0);
		expect(getAllByText("Odd").length).toBeGreaterThan(0);
		const active = container.querySelector('[data-active="true"]');
		expect(active?.getAttribute("data-state")).toBe("Odd");
	});

	it("遷移ラベル(read)を描く", () => {
		const { getAllByText } = render(
			<AutomatonDiagram graph={dfaGraph} current="Even" />,
		);
		expect(getAllByText("a").length).toBeGreaterThan(0);
	});

	it("DTM を描く(read/write,move ラベル・blank␣・現在状態)", () => {
		const dtmGraph = draftGraph(draftFromMachine(machines[1]), false); // anbncn
		const { container, getAllByText } = render(
			<AutomatonDiagram graph={dtmGraph} current="P1" />,
		);
		expect(getAllByText("PA").length).toBeGreaterThan(0);
		expect(container.textContent).toContain("␣/␣,R");
		const active = container.querySelector('[data-active="true"]');
		expect(active?.getAttribute("data-state")).toBe("P1");
	});

	it("発火した遷移の矢印を強調する(data-fired + 専用マーカー)", () => {
		const { container } = render(
			<AutomatonDiagram
				graph={dfaGraph}
				current="Odd"
				fired={{ from: "Even", to: "Odd" }}
			/>,
		);
		const firedEdges = container.querySelectorAll('[data-fired="true"]');
		expect(firedEdges.length).toBe(1);
		expect(
			firedEdges[0]?.querySelector("path")?.getAttribute("marker-end"),
		).toContain("arrow-active");
	});

	it("無効な遷移は data-invalid=true で赤く描く", () => {
		const graph = draftGraph(
			{
				states: ["A", "B"],
				start: "A",
				accept: [],
				rows: [
					{ from: "A", read: "a", to: "B", write: "", move: "R" },
					{ from: "A", read: "", to: "A", write: "", move: "R" }, // read 空=無効
				],
			},
			true,
		);
		const { container } = render(
			<AutomatonDiagram graph={graph} current="A" />,
		);
		const invalid = container.querySelector('[data-invalid="true"]');
		expect(invalid).not.toBeNull();
		expect(invalid?.querySelector("path")?.getAttribute("class")).toContain(
			"stroke-red-500",
		);
	});

	it("少数状態では DFA/DTM でキャンバスサイズを揃える(共に 640)", () => {
		const dtmGraph = draftGraph(draftFromMachine(machines[1]), false);
		const { container: dfa } = render(
			<AutomatonDiagram graph={dfaGraph} current="Even" />,
		);
		const { container: dtm } = render(
			<AutomatonDiagram graph={dtmGraph} current="P0" />,
		);
		expect(dfa.querySelector("svg")?.getAttribute("viewBox")).toBe(
			"0 0 640 640",
		);
		expect(dtm.querySelector("svg")?.getAttribute("viewBox")).toBe(
			"0 0 640 640",
		);
	});

	it("状態が多いとキャンバス(viewBox)を広げて詰まらないようにする", () => {
		// 少数(even-a: 2状態)は基準の 640。
		const { container: few } = render(
			<AutomatonDiagram graph={dfaGraph} current="Even" />,
		);
		expect(vbWidth(few.querySelector("svg"))).toBe(640);
		// 多数(30状態)は 640 より広がる。
		const states = Array.from({ length: 30 }, (_, i) => `s${i}`);
		const many = draftGraph(
			{ states, start: "s0", accept: [], rows: [] },
			true,
		);
		const { container: big } = render(
			<AutomatonDiagram graph={many} current="s0" />,
		);
		expect(vbWidth(big.querySelector("svg"))).toBeGreaterThan(640);
	});

	it("状態数が変わったら viewBox を再フィットする(切れない)", () => {
		const few = draftGraph(
			{ states: ["A", "B"], start: "A", accept: [], rows: [] },
			true,
		);
		const many = draftGraph(
			{
				states: Array.from({ length: 30 }, (_, i) => `s${i}`),
				start: "s0",
				accept: [],
				rows: [],
			},
			true,
		);
		const { container, rerender } = render(
			<AutomatonDiagram graph={few} current="A" />,
		);
		expect(vbWidth(container.querySelector("svg"))).toBe(640);
		// 同一コンポーネントのまま状態数を増やす → 再フィット effect で viewBox が広がる。
		rerender(<AutomatonDiagram graph={many} current="s0" />);
		expect(vbWidth(container.querySelector("svg"))).toBeGreaterThan(640);
	});

	it("編集: ノード間ドラッグで遷移を追加する", () => {
		const onAddTransition = vi.fn();
		const graph = draftGraph(
			{ states: ["A", "B"], start: "A", accept: [], rows: [] },
			true,
		);
		const { container } = render(
			<AutomatonDiagram
				graph={graph}
				current="A"
				editable
				onAddTransition={onAddTransition}
			/>,
		);
		const svg = container.querySelector("svg") as SVGSVGElement;
		svg.setPointerCapture = () => {};
		svg.getBoundingClientRect = () =>
			({
				left: 0,
				top: 0,
				width: 640,
				height: 640,
				right: 640,
				bottom: 640,
				x: 0,
				y: 0,
				toJSON: () => {},
				// biome-ignore lint/suspicious/noExplicitAny: テスト用のダミー rect
			}) as any;
		// ノード A(320,82)→ B(320,558)へドラッグ → 遷移 A→B を追加。
		fireEvent.pointerDown(svg, { clientX: 320, clientY: 82 });
		fireEvent.pointerMove(svg, { clientX: 320, clientY: 300 });
		fireEvent.pointerUp(svg, { clientX: 320, clientY: 558 });
		expect(onAddTransition).toHaveBeenCalledWith("A", "B");
	});

	it("編集: クリックのみ(移動なし)では遷移を追加しない", () => {
		const onAddTransition = vi.fn();
		const { container } = render(
			<AutomatonDiagram
				graph={twoNode}
				current="A"
				editable
				onAddTransition={onAddTransition}
			/>,
		);
		const svg = prepareSvg(container);
		// ノード A 上で押して動かさず離す(誤クリック)→ 遷移は増やさない。
		fireEvent.pointerDown(svg, { clientX: 320, clientY: 82 });
		fireEvent.pointerUp(svg, { clientX: 320, clientY: 82 });
		expect(onAddTransition).not.toHaveBeenCalled();
	});

	it("編集: ノードへ戻すドラッグで自己ループ(A→A)を追加できる", () => {
		const onAddTransition = vi.fn();
		const { container } = render(
			<AutomatonDiagram
				graph={twoNode}
				current="A"
				editable
				onAddTransition={onAddTransition}
			/>,
		);
		const svg = prepareSvg(container);
		fireEvent.pointerDown(svg, { clientX: 320, clientY: 82 });
		fireEvent.pointerMove(svg, { clientX: 340, clientY: 100 });
		fireEvent.pointerUp(svg, { clientX: 320, clientY: 82 });
		expect(onAddTransition).toHaveBeenCalledWith("A", "A");
	});

	it("編集: 空白で離すと遷移を追加しない", () => {
		const onAddTransition = vi.fn();
		const { container } = render(
			<AutomatonDiagram
				graph={twoNode}
				current="A"
				editable
				onAddTransition={onAddTransition}
			/>,
		);
		const svg = prepareSvg(container);
		fireEvent.pointerDown(svg, { clientX: 320, clientY: 82 });
		fireEvent.pointerMove(svg, { clientX: 200, clientY: 300 });
		fireEvent.pointerUp(svg, { clientX: 10, clientY: 10 }); // 空白で離す
		expect(onAddTransition).not.toHaveBeenCalled();
	});

	it("ズームスライダーで viewBox が狭まり、リセットで戻る", () => {
		const { container, getByRole } = render(
			<AutomatonDiagram graph={dfaGraph} current="Even" />,
		);
		const svg = container.querySelector("svg");
		const initial = svg?.getAttribute("viewBox");
		const w0 = vbWidth(svg);
		fireEvent.change(getByRole("slider", { name: "ズーム" }), {
			target: { value: "2" },
		});
		expect(vbWidth(svg)).toBeLessThan(w0);
		fireEvent.click(getByRole("button", { name: "リセット" }));
		expect(svg?.getAttribute("viewBox")).toBe(initial);
	});
});
