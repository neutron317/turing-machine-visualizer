import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SymbolPalette } from "./SymbolPalette.tsx";

describe("SymbolPalette", () => {
	it("記号を一覧表示する", () => {
		render(<SymbolPalette symbols={["a", "b", "X"]} onPick={() => {}} />);
		expect(screen.getByText("使える記号:")).toBeInTheDocument();
		for (const s of ["a", "b", "X"]) {
			expect(
				screen.getByRole("button", { name: `記号 ${s} を追加` }),
			).toBeInTheDocument();
		}
	});

	it("記号をクリックすると onPick に渡す", () => {
		const onPick = vi.fn();
		render(<SymbolPalette symbols={["a", "b"]} onPick={onPick} />);
		fireEvent.click(screen.getByRole("button", { name: "記号 b を追加" }));
		expect(onPick).toHaveBeenCalledWith("b");
	});

	it("記号が空なら何も描画しない", () => {
		const { container } = render(
			<SymbolPalette symbols={[]} onPick={() => {}} />,
		);
		expect(container.firstChild).toBeNull();
	});
});
