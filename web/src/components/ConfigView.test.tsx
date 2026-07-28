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
});
