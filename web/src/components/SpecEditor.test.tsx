import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DFAMachine, DTMMachine } from "../fixtures/machines.ts";
import { SpecEditor } from "./SpecEditor.tsx";

const dfa: DFAMachine = {
	id: "d",
	label: "DFA",
	kind: "dfa",
	spec: {
		states: ["A", "B"],
		alphabet: ["a"],
		start: "A",
		accept: ["A"],
		transitions: [{ from: "A", read: "a", to: "B" }],
	},
	input: "a",
};

const dtm: DTMMachine = {
	id: "t",
	label: "DTM",
	kind: "dtm",
	spec: {
		states: ["P"],
		tapeAlphabet: ["a"],
		start: "P",
		accept: [],
		transitions: [{ from: "P", read: "a", to: "P", write: "a", move: "R" }],
	},
	input: "a",
};

describe("SpecEditor", () => {
	it("既存の遷移を表示し、編集して実行すると更新した spec を渡す", () => {
		const onRun = vi.fn();
		render(<SpecEditor machine={dfa} onRun={onRun} />);
		expect((screen.getByLabelText("from 0") as HTMLInputElement).value).toBe(
			"A",
		);
		fireEvent.change(screen.getByLabelText("to 0"), {
			target: { value: "A" },
		});
		fireEvent.click(screen.getByRole("button", { name: "この定義で実行" }));
		expect(onRun).toHaveBeenCalledTimes(1);
		const spec = onRun.mock.calls[0][0];
		expect(spec.transitions).toEqual([{ from: "A", read: "a", to: "A" }]);
		expect(spec.states).toContain("A");
	});

	it("行を追加・削除できる", () => {
		render(<SpecEditor machine={dfa} onRun={() => {}} />);
		fireEvent.click(screen.getByRole("button", { name: "行を追加" }));
		expect(screen.getAllByLabelText(/^from /)).toHaveLength(2);
		fireEvent.click(screen.getByLabelText("delete 1"));
		expect(screen.getAllByLabelText(/^from /)).toHaveLength(1);
	});

	it("読み記号が空だとエラーになり実行しない", () => {
		const onRun = vi.fn();
		render(<SpecEditor machine={dfa} onRun={onRun} />);
		fireEvent.change(screen.getByLabelText("read 0"), {
			target: { value: "" },
		});
		fireEvent.click(screen.getByRole("button", { name: "この定義で実行" }));
		expect(onRun).not.toHaveBeenCalled();
		expect(screen.getByText(/1 文字/)).toBeInTheDocument();
	});

	it("DTM は書き込み/移動列を表示し、その内容を spec に含める", () => {
		const onRun = vi.fn();
		render(<SpecEditor machine={dtm} onRun={onRun} />);
		expect(screen.getByLabelText("write 0")).toBeInTheDocument();
		expect(screen.getByLabelText("move 0")).toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "この定義で実行" }));
		expect(onRun).toHaveBeenCalledTimes(1);
		expect(onRun.mock.calls[0][0].transitions[0]).toEqual({
			from: "P",
			read: "a",
			to: "P",
			write: "a",
			move: "R",
		});
	});
});
