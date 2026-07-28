import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
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

	it("拡大ボタンで viewBox が狭まり、リセットで戻る", () => {
		const { container, getByRole } = render(
			<AutomatonDiagram spec={dfaSpec} current="Even" />,
		);
		const svg = container.querySelector("svg");
		const initial = svg?.getAttribute("viewBox");
		const w0 = vbWidth(svg);
		fireEvent.click(getByRole("button", { name: "拡大" }));
		expect(vbWidth(svg)).toBeLessThan(w0); // 拡大で viewBox 幅が縮む
		fireEvent.click(getByRole("button", { name: "リセット" }));
		expect(svg?.getAttribute("viewBox")).toBe(initial);
	});
});
