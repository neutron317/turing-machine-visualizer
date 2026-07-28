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

	it("to に新規状態を入れると states に補完される", () => {
		const onRun = vi.fn();
		render(<SpecEditor machine={dfa} onRun={onRun} />);
		fireEvent.change(screen.getByLabelText("to 0"), {
			target: { value: "Z" },
		});
		fireEvent.click(screen.getByRole("button", { name: "この定義で実行" }));
		expect(onRun.mock.calls[0][0].states).toContain("Z");
	});

	it("同じ (from, 読み) が重複するとエラーで実行しない", () => {
		const onRun = vi.fn();
		render(<SpecEditor machine={dfa} onRun={onRun} />);
		fireEvent.click(screen.getByRole("button", { name: "行を追加" }));
		fireEvent.change(screen.getByLabelText("from 1"), {
			target: { value: "A" },
		});
		fireEvent.change(screen.getByLabelText("read 1"), {
			target: { value: "a" },
		});
		fireEvent.change(screen.getByLabelText("to 1"), {
			target: { value: "A" },
		});
		fireEvent.click(screen.getByRole("button", { name: "この定義で実行" }));
		expect(onRun).not.toHaveBeenCalled();
		expect(screen.getByText(/重複/)).toBeInTheDocument();
	});

	it("DTM の書き/読み空欄は null(空白セル)として渡る", () => {
		const onRun = vi.fn();
		render(<SpecEditor machine={dtm} onRun={onRun} />);
		fireEvent.change(screen.getByLabelText("read 0"), {
			target: { value: "" },
		});
		fireEvent.change(screen.getByLabelText("write 0"), {
			target: { value: "" },
		});
		fireEvent.click(screen.getByRole("button", { name: "この定義で実行" }));
		expect(onRun.mock.calls[0][0].transitions[0]).toEqual({
			from: "P",
			read: null,
			to: "P",
			write: null,
			move: "R",
		});
	});

	it("初期状態・受理状態・アルファベットを編集して spec に反映する", () => {
		const onRun = vi.fn();
		render(<SpecEditor machine={dfa} onRun={onRun} />);
		fireEvent.change(screen.getByLabelText("初期状態"), {
			target: { value: "S" },
		});
		fireEvent.change(screen.getByLabelText("受理状態"), {
			target: { value: "S, T" },
		});
		fireEvent.change(screen.getByLabelText("アルファベット"), {
			target: { value: "x, y" },
		});
		fireEvent.click(screen.getByRole("button", { name: "この定義で実行" }));
		const spec = onRun.mock.calls[0][0];
		expect(spec.start).toBe("S");
		expect(spec.accept).toEqual(["S", "T"]);
		expect(spec.alphabet).toEqual(["x", "y"]);
		// states は from/to・start・accept から導出される。
		expect(spec.states).toEqual(expect.arrayContaining(["S", "T", "A", "B"]));
	});

	it("初期状態が空だとエラーで実行しない", () => {
		const onRun = vi.fn();
		render(<SpecEditor machine={dfa} onRun={onRun} />);
		fireEvent.change(screen.getByLabelText("初期状態"), {
			target: { value: "" },
		});
		fireEvent.click(screen.getByRole("button", { name: "この定義で実行" }));
		expect(onRun).not.toHaveBeenCalled();
		expect(screen.getByText(/必須/)).toBeInTheDocument();
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
