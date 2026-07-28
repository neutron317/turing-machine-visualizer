import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Tape } from "./Tape.tsx";

describe("Tape", () => {
	it("ヘッドセルを data-head で示し、その記号を表示する", () => {
		const { container } = render(
			<Tape left={["X", "Y"]} head={"b"} right={["c"]} />,
		);
		const head = container.querySelector('[data-head="true"]');
		expect(head?.textContent).toBe("b");
	});

	it("右側の半無限を空セル(␣)で示唆する", () => {
		const { getAllByText } = render(<Tape left={[]} head={"a"} right={[]} />);
		// 右パディングのぶん ␣ が並ぶ。
		expect(getAllByText("␣").length).toBeGreaterThanOrEqual(3);
	});

	it("ヘッドが blank(null)なら ␣ を表示する", () => {
		const { container } = render(<Tape left={["X"]} head={null} right={[]} />);
		expect(container.querySelector('[data-head="true"]')?.textContent).toBe(
			"␣",
		);
	});
});
