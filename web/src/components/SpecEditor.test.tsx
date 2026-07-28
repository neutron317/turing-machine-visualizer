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

// biome-ignore lint/suspicious/noExplicitAny: テストで spec を緩く読む
const lastSpec = (fn: ReturnType<typeof vi.fn>): any =>
	fn.mock.calls.at(-1)?.[0];

describe("SpecEditor", () => {
	it("遷移を編集するとライブで更新後の spec を通知する", () => {
		const onSpecChange = vi.fn();
		render(<SpecEditor machine={dfa} onSpecChange={onSpecChange} />);
		expect((screen.getByLabelText("from 0") as HTMLInputElement).value).toBe(
			"A",
		);
		// 初回マウントでは通知しない(呼び出し側が machine.spec を持っているため)。
		expect(onSpecChange).not.toHaveBeenCalled();
		fireEvent.change(screen.getByLabelText("to 0"), { target: { value: "A" } });
		expect(lastSpec(onSpecChange).transitions).toEqual([
			{ from: "A", read: "a", to: "A" },
		]);
		expect(lastSpec(onSpecChange).states).toContain("A");
	});

	it("行を追加・削除できる(未完成の行は無視される)", () => {
		render(<SpecEditor machine={dfa} onSpecChange={() => {}} />);
		fireEvent.click(screen.getByRole("button", { name: "行を追加" }));
		expect(screen.getAllByLabelText(/^from /)).toHaveLength(2);
		fireEvent.click(screen.getByLabelText("delete 1"));
		expect(screen.getAllByLabelText(/^from /)).toHaveLength(1);
	});

	it("読み記号が空だとエラーで通知しない", () => {
		const onSpecChange = vi.fn();
		render(<SpecEditor machine={dfa} onSpecChange={onSpecChange} />);
		fireEvent.change(screen.getByLabelText("read 0"), {
			target: { value: "" },
		});
		expect(onSpecChange).not.toHaveBeenCalled();
		expect(screen.getByRole("alert")).toHaveTextContent(/1 文字/);
	});

	it("to に新規状態を入れると states に補完される", () => {
		const onSpecChange = vi.fn();
		render(<SpecEditor machine={dfa} onSpecChange={onSpecChange} />);
		fireEvent.change(screen.getByLabelText("to 0"), { target: { value: "Z" } });
		expect(lastSpec(onSpecChange).states).toContain("Z");
	});

	it("同じ (from, 読み) が重複するとエラーになる", () => {
		const onSpecChange = vi.fn();
		render(<SpecEditor machine={dfa} onSpecChange={onSpecChange} />);
		fireEvent.click(screen.getByRole("button", { name: "行を追加" }));
		fireEvent.change(screen.getByLabelText("from 1"), {
			target: { value: "A" },
		});
		fireEvent.change(screen.getByLabelText("read 1"), {
			target: { value: "a" },
		});
		fireEvent.change(screen.getByLabelText("to 1"), { target: { value: "A" } });
		expect(screen.getByRole("alert")).toHaveTextContent(/重複/);
	});

	it("DTM の書き/読み空欄は null(空白セル)として通知する", () => {
		const onSpecChange = vi.fn();
		render(<SpecEditor machine={dtm} onSpecChange={onSpecChange} />);
		fireEvent.change(screen.getByLabelText("read 0"), {
			target: { value: "" },
		});
		fireEvent.change(screen.getByLabelText("write 0"), {
			target: { value: "" },
		});
		expect(lastSpec(onSpecChange).transitions[0]).toEqual({
			from: "P",
			read: null,
			to: "P",
			write: null,
			move: "R",
		});
	});

	it("初期状態・受理状態を編集し、アルファベットは read から自動導出する", () => {
		const onSpecChange = vi.fn();
		render(<SpecEditor machine={dfa} onSpecChange={onSpecChange} />);
		fireEvent.change(screen.getByLabelText("初期状態"), {
			target: { value: "S" },
		});
		fireEvent.change(screen.getByLabelText("受理状態"), {
			target: { value: "S, T" },
		});
		// read を b に変えると alphabet も自動で ["b"] になる。
		fireEvent.change(screen.getByLabelText("read 0"), {
			target: { value: "b" },
		});
		const spec = lastSpec(onSpecChange);
		expect(spec.start).toBe("S");
		expect(spec.accept).toEqual(["S", "T"]);
		expect(spec.alphabet).toEqual(["b"]);
		expect(spec.states).toEqual(expect.arrayContaining(["S", "T", "A", "B"]));
	});

	it("初期状態が空だとエラーになる", () => {
		const onSpecChange = vi.fn();
		render(<SpecEditor machine={dfa} onSpecChange={onSpecChange} />);
		fireEvent.change(screen.getByLabelText("初期状態"), {
			target: { value: "" },
		});
		expect(onSpecChange).not.toHaveBeenCalled();
		expect(screen.getByRole("alert")).toHaveTextContent(/必須/);
	});

	it("DTM は read と write からテープ記号を自動導出する", () => {
		const onSpecChange = vi.fn();
		render(<SpecEditor machine={dtm} onSpecChange={onSpecChange} />);
		expect(screen.getByLabelText("write 0")).toBeInTheDocument();
		expect(screen.getByLabelText("move 0")).toBeInTheDocument();
		// write を b に変えると tapeAlphabet は read=a と write=b から ["a","b"]。
		fireEvent.change(screen.getByLabelText("write 0"), {
			target: { value: "b" },
		});
		const spec = lastSpec(onSpecChange);
		expect(spec.tapeAlphabet).toEqual(["a", "b"]);
		expect(spec.transitions[0]).toEqual({
			from: "P",
			read: "a",
			to: "P",
			write: "b",
			move: "R",
		});
	});
});
