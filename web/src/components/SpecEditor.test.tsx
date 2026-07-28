import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SpecEditor } from "./SpecEditor.tsx";
import type { Draft } from "./specDraft.ts";

const dfaDraft: Draft = {
	states: ["A", "B"],
	start: "A",
	accept: ["A"],
	rows: [{ from: "A", read: "a", to: "B", write: "", move: "R" }],
};

const dtmDraft: Draft = {
	states: ["P"],
	start: "P",
	accept: [],
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
		fireEvent.change(screen.getByLabelText("to 0"), { target: { value: "Z" } });
		expect(lastDraft(onChange).rows[0].to).toBe("Z");
	});

	it("状態を追加・消去できる", () => {
		const onChange = vi.fn();
		render(
			<SpecEditor draft={dfaDraft} isDfa error={null} onChange={onChange} />,
		);
		fireEvent.click(screen.getByRole("button", { name: "状態を追加" }));
		expect(lastDraft(onChange).states).toContain("q0");
		fireEvent.click(screen.getByRole("button", { name: "状態 B を消去" }));
		expect(lastDraft(onChange).states).not.toContain("B");
	});

	it("状態名を変更でき、参照も追従する", () => {
		const onChange = vi.fn();
		render(
			<SpecEditor draft={dfaDraft} isDfa error={null} onChange={onChange} />,
		);
		// 先頭の状態(A)の名前入力を S に変更。
		fireEvent.change(screen.getByLabelText("state 0"), {
			target: { value: "S" },
		});
		const d = lastDraft(onChange);
		expect(d.start).toBe("S"); // start も追従
		expect(d.rows[0].from).toBe("S"); // 遷移の from も追従
	});

	it("初期状態(選択)と受理(チェック)を編集できる", () => {
		const onChange = vi.fn();
		render(
			<SpecEditor draft={dfaDraft} isDfa error={null} onChange={onChange} />,
		);
		fireEvent.change(screen.getByLabelText("初期状態"), {
			target: { value: "B" },
		});
		expect(lastDraft(onChange).start).toBe("B");
		// B の受理チェックを入れる。
		fireEvent.click(screen.getByLabelText("受理 B"));
		expect(lastDraft(onChange).accept).toContain("B");
	});

	it("アルファベットを read から自動導出して表示する", () => {
		render(
			<SpecEditor draft={dfaDraft} isDfa error={null} onChange={() => {}} />,
		);
		expect(screen.getByText(/アルファベット: .*a/)).toBeInTheDocument();
	});

	it("error を role=alert で表示する", () => {
		render(
			<SpecEditor
				draft={dfaDraft}
				isDfa
				error="初期状態を設定してください。"
				onChange={() => {}}
			/>,
		);
		expect(screen.getByRole("alert")).toHaveTextContent(/初期状態/);
	});

	it("無効な遷移があると件数の注記を表示する(色以外の手掛かり)", () => {
		const draft: Draft = {
			states: ["A", "B"],
			start: "A",
			accept: [],
			// read 空(from/to は有り)= 無効な遷移。
			rows: [{ from: "A", read: "", to: "B", write: "", move: "R" }],
		};
		render(<SpecEditor draft={draft} isDfa error={null} onChange={() => {}} />);
		expect(screen.getByText(/無効な遷移が 1 件/)).toBeInTheDocument();
	});

	it("状態名を空にする変更は無視する(番兵を作らない)", () => {
		const onChange = vi.fn();
		render(
			<SpecEditor draft={dfaDraft} isDfa error={null} onChange={onChange} />,
		);
		fireEvent.change(screen.getByLabelText("state 0"), {
			target: { value: "" },
		});
		expect(onChange).not.toHaveBeenCalled();
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
