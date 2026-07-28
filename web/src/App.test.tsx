import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App.tsx";
import { useReplayStore } from "./store/replay.ts";

// api/step をモックし、機械ごとに最初の 1 ステップを返す(ネットワーク不要)。
vi.mock("./api/step.ts", () => ({
	StepError: class StepError extends Error {},
	// biome-ignore lint/suspicious/noExplicitAny: テスト用の緩いダミー
	stepDfa: vi.fn(async (_spec: any, config: any) => {
		if (config.state === "Even" && config.rest.length === 2) {
			return {
				status: "running",
				config: { state: "Odd", rest: ["a"] },
				fired: { from: "Even", read: "a", to: "Odd" },
			};
		}
		return { status: "accept", config, fired: null };
	}),
	// biome-ignore lint/suspicious/noExplicitAny: テスト用の緩いダミー
	stepDtm: vi.fn(async (_spec: any, config: any) => {
		if (config.state === "P0" && config.head === "a") {
			return {
				status: "running",
				config: { state: "P1", left: ["X"], head: "b", right: ["c"] },
				fired: { from: "P0", read: "a", to: "P1", write: "X", move: "R" },
			};
		}
		return { status: "reject", config, fired: null };
	}),
}));

beforeEach(() => {
	// ストアはシングルトンなのでテスト間で初期状態へ戻す。
	useReplayStore.setState(useReplayStore.getInitialState(), true);
});

describe("App(再生 UI)", () => {
	it("初期表示は even-a を開始し Even 状態と 1/1 を示す", () => {
		render(<App />);
		expect(
			screen.getByRole("heading", { name: "Turing Machine Visualizer" }),
		).toBeInTheDocument();
		expect(screen.getByText(/状態: Even/)).toBeInTheDocument();
		expect(screen.getByText("1 / 1")).toBeInTheDocument();
	});

	it("「進む」で /step を取得し次のコマ(Odd)へ進む", async () => {
		render(<App />);
		fireEvent.click(screen.getByRole("button", { name: /進む/ }));
		expect(await screen.findByText(/状態: Odd/)).toBeInTheDocument();
		expect(await screen.findByText("2 / 2")).toBeInTheDocument();
	});

	it("先頭では「戻る」が無効", () => {
		render(<App />);
		expect(screen.getByRole("button", { name: /戻る/ })).toBeDisabled();
	});

	it("DTM を選ぶとテープを表示する", () => {
		render(<App />);
		fireEvent.click(screen.getByRole("button", { name: /DTM:/ }));
		expect(screen.getByText(/状態: P0/)).toBeInTheDocument();
		expect(screen.getByText(/ヘッド/)).toBeInTheDocument();
	});

	it("入力を変えると即、初期テープに反映される(実行ボタン無し)", () => {
		render(<App />);
		const input = screen.getByLabelText(/入力/) as HTMLInputElement;
		fireEvent.change(input, { target: { value: "aaa" } });
		expect(screen.getByText("1 / 1")).toBeInTheDocument();
		expect(useReplayStore.getState().frames[0]?.config).toEqual({
			state: "Even",
			rest: ["a", "a", "a"],
		});
	});

	it("機械を切り替えると入力欄が既定入力へ戻る", () => {
		render(<App />);
		const input = () => screen.getByLabelText(/入力/) as HTMLInputElement;
		fireEvent.change(input(), { target: { value: "aaa" } });
		fireEvent.click(screen.getByRole("button", { name: /DTM:/ }));
		expect(input().value).toBe("abc"); // DTM の既定入力
	});

	it("左パネルに遷移関数エディタを表示する", () => {
		render(<App />);
		// aria-labelledby と h2#editor-heading の結び付き(名前付き region)も検証。
		expect(
			screen.getByRole("region", { name: /遷移関数/ }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("heading", { name: /遷移関数/ }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "行を追加" }),
		).toBeInTheDocument();
	});

	it("入力欄の id は重複しない(移設で二重にしていない)", () => {
		const { container } = render(<App />);
		expect(container.querySelectorAll("#input-str")).toHaveLength(1);
	});

	it("再生を押すと再生状態になる(最初の再生で実行が始まる)", () => {
		render(<App />);
		fireEvent.click(screen.getByRole("button", { name: "再生" }));
		expect(useReplayStore.getState().playing).toBe(true);
		// 後片付け: 自動再生を止める。
		useReplayStore.getState().pause();
	});

	it("入力を変えずに再生すると現在位置から継続する(作り直さない)", async () => {
		render(<App />);
		fireEvent.click(screen.getByRole("button", { name: /進む/ }));
		expect(await screen.findByText("2 / 2")).toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "再生" }));
		// 入力未変更 → フレームを作り直さず位置(2/2)を保つ(1/1 に戻らない)。
		expect(screen.getByText("2 / 2")).toBeInTheDocument();
		expect(useReplayStore.getState().frames.length).toBe(2);
		// 後片付け: 自動再生を止める。
		useReplayStore.getState().pause();
	});

	it("使える記号を表示し、クリックで入力へ追記する", () => {
		render(<App />);
		// DFA(even-a)の alphabet は ["a"]。
		const chip = screen.getByRole("button", { name: "記号 a を追加" });
		const input = screen.getByLabelText(/入力/) as HTMLInputElement;
		expect(input.value).toBe("aa"); // 既定入力
		fireEvent.click(chip);
		expect(input.value).toBe("aaa"); // クリックで追記
	});

	it("DTM では tapeAlphabet の記号を表示し、末尾へ追記する", () => {
		render(<App />);
		fireEvent.click(screen.getByRole("button", { name: /DTM:/ }));
		// anbncn の tapeAlphabet は a,b,c,X,Y,Z。
		for (const s of ["a", "b", "c", "X", "Y", "Z"]) {
			expect(
				screen.getByRole("button", { name: `記号 ${s} を追加` }),
			).toBeInTheDocument();
		}
		// 相異なる既定入力 "abc" と記号 "X" で末尾追記を固定(先頭追記なら "Xabc")。
		const input = screen.getByLabelText(/入力/) as HTMLInputElement;
		expect(input.value).toBe("abc");
		fireEvent.click(screen.getByRole("button", { name: "記号 X を追加" }));
		expect(input.value).toBe("abcX");
	});

	it("新規 DFA を作成して選択・編集開始できる", () => {
		render(<App />);
		fireEvent.click(screen.getByRole("button", { name: "新規DFA" }));
		// 選択され、空機械の初期状態 q0 が表示される。
		expect(screen.getByText(/状態: q0/)).toBeInTheDocument();
		// エディタの初期状態フィールドが q0(ここから定義を編集していく)。
		expect((screen.getByLabelText("初期状態") as HTMLInputElement).value).toBe(
			"q0",
		);
	});

	it("新規 DTM を作成すると DTM 用エディタ(テープ記号)を表示する", () => {
		render(<App />);
		fireEvent.click(screen.getByRole("button", { name: "新規DTM" }));
		expect(screen.getByText(/状態: q0/)).toBeInTheDocument();
		// DTM は「テープ記号」一覧を持つ(DFA は「アルファベット」)。
		expect(screen.getByText(/テープ記号/)).toBeInTheDocument();
	});

	it("状態名の変更は機械へライブ反映され、切替後も残る", () => {
		render(<App />);
		// 先頭状態(Even)を Z に改名。
		fireEvent.change(screen.getByLabelText("state 0"), {
			target: { value: "Z" },
		});
		// 別機械へ切替 → 戻る。
		fireEvent.click(screen.getByRole("button", { name: /DTM:/ }));
		fireEvent.click(screen.getByRole("button", { name: /DFA:/ }));
		expect((screen.getByLabelText("state 0") as HTMLInputElement).value).toBe(
			"Z",
		);
	});

	it("新規 DTM に遷移を定義するとライブで実行に反映される(記号は自動導出)", () => {
		render(<App />);
		fireEvent.click(screen.getByRole("button", { name: "新規DTM" }));
		fireEvent.click(screen.getByRole("button", { name: "行を追加" }));
		fireEvent.change(screen.getByLabelText("from 0"), {
			target: { value: "q0" },
		});
		fireEvent.change(screen.getByLabelText("read 0"), {
			target: { value: "a" },
		});
		fireEvent.change(screen.getByLabelText("write 0"), {
			target: { value: "a" },
		});
		fireEvent.change(screen.getByLabelText("to 0"), {
			target: { value: "q0" },
		});
		// biome-ignore lint/suspicious/noExplicitAny: テストで spec を緩く読む
		const spec = useReplayStore.getState().spec as any;
		// tapeAlphabet は read/write("a")から自動導出される。
		expect(spec.tapeAlphabet).toContain("a");
		expect(spec.transitions[0]).toEqual({
			from: "q0",
			read: "a",
			to: "q0",
			write: "a",
			move: "R",
		});
	});

	it("ファイルから機械を読み込んで追加・選択する", async () => {
		render(<App />);
		const encoded = JSON.stringify({
			v: 1,
			kind: "dfa",
			label: "読込テスト",
			input: "ab",
			spec: {
				states: ["S"],
				alphabet: ["a"],
				start: "S",
				accept: ["S"],
				transitions: [],
			},
		});
		const file = new File([encoded], "m.json", { type: "application/json" });
		fireEvent.change(screen.getByLabelText("機械ファイルを読み込み"), {
			target: { files: [file] },
		});
		// 読み込んだ機械が一覧に現れ、選択され、入力欄が読み込んだ値になる。
		expect(
			await screen.findByRole("button", { name: "読込テスト" }),
		).toBeInTheDocument();
		expect((screen.getByLabelText(/入力/) as HTMLInputElement).value).toBe(
			"ab",
		);
	});

	it("保存ボタンでダウンロードを実行する", () => {
		const origCreate = URL.createObjectURL;
		const origRevoke = URL.revokeObjectURL;
		URL.createObjectURL = vi.fn(() => "blob:x");
		URL.revokeObjectURL = vi.fn();
		const clickSpy = vi
			.spyOn(HTMLAnchorElement.prototype, "click")
			.mockImplementation(() => {});
		render(<App />);
		fireEvent.click(screen.getByRole("button", { name: "保存" }));
		expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
		expect(clickSpy).toHaveBeenCalledTimes(1);
		clickSpy.mockRestore();
		URL.createObjectURL = origCreate;
		URL.revokeObjectURL = origRevoke;
	});

	it("状態図が編集モード(ドラッグで遷移追加)である", () => {
		render(<App />);
		expect(screen.getByText(/ドラッグで遷移/)).toBeInTheDocument();
	});

	it("機械の名前を変更できる", () => {
		render(<App />);
		const nameInput = screen.getByLabelText("名前") as HTMLInputElement;
		fireEvent.change(nameInput, { target: { value: "マイ機械" } });
		expect(
			screen.getByRole("button", { name: "マイ機械" }),
		).toBeInTheDocument();
	});

	it("ウィンドウを縮小すると操作板が画面内へクランプされる", () => {
		render(<App />);
		const heading = screen.getByRole("heading", {
			name: "Turing Machine Visualizer",
		});
		// 操作板 = 見出しを含む外側の絶対配置 div。
		const panel = heading.closest("div.absolute") as HTMLElement;
		// 幅を PANEL_W(240)より狭くして resize → left は innerWidth-240 へ寄る。
		window.innerWidth = 300;
		fireEvent(window, new Event("resize"));
		expect(panel.style.left).toBe("60px"); // 300 - 240
		// 後片付け: jsdom 既定幅へ戻す。
		window.innerWidth = 1024;
	});

	it("機械を切り替えると状態図と現在状態が切り替わる", async () => {
		const { container } = render(<App />);
		const activeState = () =>
			container
				.querySelector('[data-active="true"]')
				?.getAttribute("data-state");
		// 初期は DFA の Even が active。
		expect(activeState()).toBe("Even");
		// DTM に切替 → P0 が active。
		fireEvent.click(screen.getByRole("button", { name: /DTM:/ }));
		expect(activeState()).toBe("P0");
		// 進むと状態図の現在状態が追従(P0 -> P1、取得は非同期)。
		fireEvent.click(screen.getByRole("button", { name: /進む/ }));
		await waitFor(() => expect(activeState()).toBe("P1"));
	});
});
