import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Frame } from "../store/replay.ts";
import { ConfigView } from "./ConfigView.tsx";

describe("ConfigView", () => {
	it("DFA の状態・残り入力・発火遷移を表示する", () => {
		const frame: Frame = {
			config: { state: "Odd", rest: ["a"] },
			status: "running",
			fired: { from: "Even", read: "a", to: "Odd" },
		};
		render(<ConfigView frame={frame} />);
		expect(screen.getByText(/状態: Odd/)).toBeInTheDocument();
		expect(screen.getByText("実行中")).toBeInTheDocument();
		expect(screen.getByText("残り入力")).toBeInTheDocument();
		expect(screen.getByText(/Even ──a──▶ Odd/)).toBeInTheDocument();
	});

	it("DTM のテープと blank(␣)・受理を表示する", () => {
		const frame: Frame = {
			config: {
				state: "PA",
				left: ["X", "Y", "Z", null],
				head: null,
				right: [],
			},
			status: "accept",
			fired: null,
		};
		render(<ConfigView frame={frame} />);
		expect(screen.getByText(/状態: PA/)).toBeInTheDocument();
		expect(screen.getByText("受理")).toBeInTheDocument();
		expect(screen.getByText(/テープ/)).toBeInTheDocument();
		expect(screen.getAllByText("␣").length).toBeGreaterThan(0);
	});

	it("DTM の fired 遷移を read/write,move で表示する", () => {
		const frame: Frame = {
			config: { state: "P1", left: ["X"], head: "b", right: ["c"] },
			status: "running",
			fired: { from: "P0", read: "a", to: "P1", write: "X", move: "R" },
		};
		render(<ConfigView frame={frame} />);
		expect(screen.getByText(/P0 ──a\/X,R──▶ P1/)).toBeInTheDocument();
	});

	it("DTM の fired で blank(null)は ␣ として表示する", () => {
		const frame: Frame = {
			config: { state: "PA", left: [], head: null, right: [] },
			status: "running",
			fired: { from: "P4", read: null, to: "PA", write: null, move: "R" },
		};
		render(<ConfigView frame={frame} />);
		expect(screen.getByText(/P4 ──␣\/␣,R──▶ PA/)).toBeInTheDocument();
	});
});
