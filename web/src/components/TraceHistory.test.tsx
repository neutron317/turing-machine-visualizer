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
});
