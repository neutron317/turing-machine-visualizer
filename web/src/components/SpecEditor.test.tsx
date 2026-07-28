import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SpecEditor } from "./SpecEditor.tsx";
import type { Draft } from "./specDraft.ts";

const dfaDraft: Draft = {
	states: ["A", "B"],
	start: "A",
	accept: "A",
	rows: [{ from: "A", read: "a", to: "B", write: "", move: "R" }],
};

const dtmDraft: Draft = {
	states: ["P"],
	start: "P",
	accept: "",
	rows: [{ from: "P", read: "a", to: "P", write: "a", move: "R" }],
};

// biome-ignore lint/suspicious/noExplicitAny: テストで draft を緩く読む
const lastDraft = (fn: ReturnType<typeof vi.fn>): any =>
	fn.mock.calls.at(-1)?.[0];

describe("SpecEditor(制御コンポーネント)", () => {
	it("遷移を編集すると更新後の draft を通知する", () => {
		const onChange = vi.fn();
		render(
			<SpecEditor draft={dfaDraft} isDfa error={null} onChange={onChange} />,
		);
		expect((screen.getByLabelText("from 0") as HTMLInputElement).value).toBe(
			"A",
		);
		fireEvent.change(screen.getByLabelText("to 0"), { target: { value: "Z" } });
		expect(lastDraft(onChange).rows[0].to).toBe("Z");
	});

	it("初期状態・受理状態を編集して draft に反映する", () => {
		const onChange = vi.fn();
		render(
			<SpecEditor draft={dfaDraft} isDfa error={null} onChange={onChange} />,
		);
		fireEvent.change(screen.getByLabelText("初期状態"), {
			target: { value: "S" },
		});
		expect(lastDraft(onChange).start).toBe("S");
		fireEvent.change(screen.getByLabelText("受理状態"), {
			target: { value: "S, T" },
		});
		expect(lastDraft(onChange).accept).toBe("S, T");
	});

	it("行を追加・削除できる", () => {
		const onChange = vi.fn();
		const { rerender } = render(
			<SpecEditor draft={dfaDraft} isDfa error={null} onChange={onChange} />,
		);
		fireEvent.click(screen.getByRole("button", { name: "行を追加" }));
		expect(lastDraft(onChange).rows).toHaveLength(2);
		// 制御コンポーネントなので追加後の draft を親から反映して削除を確認。
		rerender(
			<SpecEditor
				draft={lastDraft(onChange)}
				isDfa
				error={null}
				onChange={onChange}
			/>,
		);
		fireEvent.click(screen.getByLabelText("delete 1"));
		expect(lastDraft(onChange).rows).toHaveLength(1);
	});

	it("状態一覧とアルファベットを自動導出して表示する", () => {
		render(
			<SpecEditor draft={dfaDraft} isDfa error={null} onChange={() => {}} />,
		);
		expect(screen.getByText(/状態一覧: .*A.*B/)).toBeInTheDocument();
		expect(screen.getByText(/アルファベット: .*a/)).toBeInTheDocument();
	});

	it("error を role=alert で表示する", () => {
		render(
			<SpecEditor
				draft={dfaDraft}
				isDfa
				error="初期状態は必須です。"
				onChange={() => {}}
			/>,
		);
		expect(screen.getByRole("alert")).toHaveTextContent(/必須/);
	});

	it("DTM は書き込み/移動列とテープ記号一覧を表示する", () => {
		render(
			<SpecEditor
				draft={dtmDraft}
				isDfa={false}
				error={null}
				onChange={() => {}}
			/>,
		);
		expect(screen.getByLabelText("write 0")).toBeInTheDocument();
		expect(screen.getByLabelText("move 0")).toBeInTheDocument();
		expect(screen.getByText(/テープ記号: .*a/)).toBeInTheDocument();
	});
});
