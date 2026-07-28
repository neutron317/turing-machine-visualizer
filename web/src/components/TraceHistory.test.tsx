import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Frame } from "../store/replay.ts";
import { TraceHistory } from "./TraceHistory.tsx";

const frames: Frame[] = [
	{
		config: { state: "Even", rest: ["a", "a"] },
		status: "running",
		fired: null,
	},
	{
		config: { state: "Odd", rest: ["a"] },
		status: "running",
		fired: { from: "Even", read: "a", to: "Odd" },
	},
	{ config: { state: "Even", rest: [] }, status: "accept", fired: null },
];

describe("TraceHistory", () => {
	it("全コマを ⊢ 記法で表示し、参照セルを赤で強調する", () => {
		const { container, getAllByText } = render(
			<TraceHistory frames={frames} current={1} onSelect={() => {}} />,
		);
		expect(getAllByText("Even").length).toBeGreaterThan(0);
		expect(getAllByText("Odd").length).toBeGreaterThan(0);
		// ⊢ は行数-1(初期行には付かない)。
		expect((container.textContent?.match(/⊢/g) ?? []).length).toBe(
			frames.length - 1,
		);
		// 参照セル(先頭記号)が赤。
		expect(container.querySelector(".text-red-600")?.textContent).toBe("a");
	});

	it("行をクリックするとその index で onSelect が呼ばれる", () => {
		const onSelect = vi.fn();
		const { getAllByRole } = render(
			<TraceHistory frames={frames} current={0} onSelect={onSelect} />,
		);
		fireEvent.click(getAllByRole("button")[2]);
		expect(onSelect).toHaveBeenCalledWith(2);
	});

	it("DTM は left…状態 head …right の順で描き、head を赤・null を ␣ にする", () => {
		const dtm: Frame[] = [
			{
				config: { state: "P1", left: ["X", null], head: "b", right: [null] },
				status: "running",
				fired: null,
			},
		];
		const { container } = render(
			<TraceHistory frames={dtm} current={0} onSelect={() => {}} />,
		);
		expect(container.querySelector(".font-mono")?.textContent).toBe("X␣P1b␣");
		expect(container.querySelector(".text-red-600")?.textContent).toBe("b");
	});
});
