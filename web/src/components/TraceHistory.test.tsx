import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
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
];

describe("TraceHistory", () => {
	it("カーソルまでの ID を ⊢ 記法で表示し、参照セルを赤で強調する", () => {
		const { container, getAllByText } = render(
			<TraceHistory frames={frames} cursor={1} />,
		);
		expect(getAllByText("Even").length).toBeGreaterThan(0);
		expect(getAllByText("Odd").length).toBeGreaterThan(0);
		// 2 行目に ⊢。
		expect(container.textContent).toContain("⊢");
		// 参照セル(残り入力の先頭)が赤で強調。
		expect(container.querySelector(".text-red-600")?.textContent).toBe("a");
	});

	it("cursor までしか表示しない", () => {
		const { queryAllByText } = render(
			<TraceHistory frames={frames} cursor={0} />,
		);
		expect(queryAllByText("Odd").length).toBe(0);
	});

	it("初期行には ⊢ が付かない(⊢ は行数-1)", () => {
		const { container } = render(<TraceHistory frames={frames} cursor={1} />);
		expect((container.textContent?.match(/⊢/g) ?? []).length).toBe(1);
	});

	it("DTM は left…状態 head …right の順で描き、head を赤・null を ␣ にする", () => {
		const dtm: Frame[] = [
			{
				config: { state: "P1", left: ["X", null], head: "b", right: [null] },
				status: "running",
				fired: null,
			},
		];
		const { container } = render(<TraceHistory frames={dtm} cursor={0} />);
		// 左→状態→head→右 の順(null は ␣)。
		expect(container.querySelector(".font-mono")?.textContent).toBe("X␣P1b␣");
		// 参照セル(head)だけ赤。
		expect(container.querySelector(".text-red-600")?.textContent).toBe("b");
	});
});
