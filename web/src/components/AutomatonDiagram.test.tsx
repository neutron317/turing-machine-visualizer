import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { machines } from "../fixtures/machines.ts";
import { AutomatonDiagram } from "./AutomatonDiagram.tsx";

const dfaSpec = machines[0].spec; // even-a

function vbWidth(svg: Element | null): number {
	return Number(svg?.getAttribute("viewBox")?.split(" ")[2]);
}

describe("AutomatonDiagram", () => {
	it("全状態を描き、現在状態をハイライトする", () => {
		const { container, getAllByText } = render(
			<AutomatonDiagram spec={dfaSpec} current="Odd" />,
		);
		expect(getAllByText("Even").length).toBeGreaterThan(0);
		expect(getAllByText("Odd").length).toBeGreaterThan(0);
		const active = container.querySelector('[data-active="true"]');
		expect(active?.getAttribute("data-state")).toBe("Odd");
	});

	it("遷移ラベル(read)を描く", () => {
		const { getAllByText } = render(
			<AutomatonDiagram spec={dfaSpec} current="Even" />,
		);
		// Even──a──▶Odd と Odd──a──▶Even の 2 本にラベル "a"。
		expect(getAllByText("a").length).toBeGreaterThan(0);
	});

	it("DTM spec を描く(read/write,move ラベル・blank␣・現在状態)", () => {
		const dtmSpec = machines[1].spec; // anbncn
		const { container, getAllByText } = render(
			<AutomatonDiagram spec={dtmSpec} current="P1" />,
		);
		expect(getAllByText("PA").length).toBeGreaterThan(0);
		// DTM の遷移ラベルは read/write,move。P0→PA は ␣/␣,R。
		expect(container.textContent).toContain("␣/␣,R");
		const active = container.querySelector('[data-active="true"]');
		expect(active?.getAttribute("data-state")).toBe("P1");
	});

	it("発火した遷移の矢印を強調する(data-fired + 専用マーカー)", () => {
		const { container } = render(
			<AutomatonDiagram
				spec={dfaSpec}
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

	it("キャンバスは機械に依らず一定サイズ(DFA/DTM でノード表示を統一)", () => {
		const dtmSpec = machines[1].spec; // anbncn(状態数・ラベル長が DFA と異なる)
		const { container: dfa } = render(
			<AutomatonDiagram spec={dfaSpec} current="Even" />,
		);
		const { container: dtm } = render(
			<AutomatonDiagram spec={dtmSpec} current="P0" />,
		);
		// 初期 viewBox が両者一致 = ノードの表示 px が揃う(状態数に依らない)。
		expect(dfa.querySelector("svg")?.getAttribute("viewBox")).toBe(
			"0 0 640 640",
		);
		expect(dtm.querySelector("svg")?.getAttribute("viewBox")).toBe(
			"0 0 640 640",
		);
	});

	it("編集: 空白クリックで状態追加、ノード間ドラッグで遷移追加", () => {
		const onAddState = vi.fn();
		const onAddTransition = vi.fn();
		const spec = {
			states: ["A", "B"],
			alphabet: [],
			start: "A",
			accept: [],
			transitions: [],
		};
		const { container } = render(
			<AutomatonDiagram
				spec={spec}
				current="A"
				editable
				onAddState={onAddState}
				onAddTransition={onAddTransition}
			/>,
		);
		const svg = container.querySelector("svg") as SVGSVGElement;
		// jsdom はレイアウト非対応。rect を確定させ、client 座標 = viewBox 座標にする
		// (viewBox は 0 0 640 640 / preserveAspectRatio meet で s=1)。
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
		// 空白(ノードから離れた点)をクリック → 状態追加。
		fireEvent.pointerDown(svg, { clientX: 10, clientY: 10 });
		fireEvent.pointerUp(svg, { clientX: 10, clientY: 10 });
		expect(onAddState).toHaveBeenCalledTimes(1);
		// ノード A(320,82)→ B(320,558)へドラッグ → 遷移 A→B を追加。
		fireEvent.pointerDown(svg, { clientX: 320, clientY: 82 });
		fireEvent.pointerMove(svg, { clientX: 320, clientY: 300 });
		fireEvent.pointerUp(svg, { clientX: 320, clientY: 558 });
		expect(onAddTransition).toHaveBeenCalledWith("A", "B");
	});

	it("ズームスライダーで viewBox が狭まり、リセットで戻る", () => {
		const { container, getByRole } = render(
			<AutomatonDiagram spec={dfaSpec} current="Even" />,
		);
		const svg = container.querySelector("svg");
		const initial = svg?.getAttribute("viewBox");
		const w0 = vbWidth(svg);
		fireEvent.change(getByRole("slider", { name: "ズーム" }), {
			target: { value: "2" },
		});
		expect(vbWidth(svg)).toBeLessThan(w0); // 2x 拡大で viewBox 幅が縮む
		fireEvent.click(getByRole("button", { name: "リセット" }));
		expect(svg?.getAttribute("viewBox")).toBe(initial);
	});
});
