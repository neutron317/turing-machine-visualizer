import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { machines } from "../fixtures/machines.ts";
import { AutomatonDiagram } from "./AutomatonDiagram.tsx";

const dfaSpec = machines[0].spec; // even-a

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
});
