import type {
	DFAConfig,
	DFASpec,
	DFATrans,
	DTMConfig,
	DTMSpec,
	DTMTrans,
	FiredDTM,
	StepDFA,
	StepDTM,
} from "../contract/schemas.ts";

// クライアント側の 1 ステップ実行(docs/contract.md §4.2 の意味論)。以前は Haskell
// バックエンド(/api/*/step)に投げていたが、この純関数に移植してブラウザ内で完結
// させた(サーバ不要=静的ホスト・ローカルで動く、往復が無く高速)。意味論は engine/
// (Haskell)と一致し、fixtures/traces のゴールデントレースで回帰検証する。
//
// 遷移の選び方: 決定的な機械では各 (from, read) の遷移は高々 1 本。ただし重複があっても
// Haskell 版(Map.fromList=後勝ち)と一致するよう、TS でも「最後に一致した遷移」を採る。
function lastDfaTrans(
	spec: DFASpec,
	from: string,
	read: string,
): DFATrans | undefined {
	let hit: DFATrans | undefined;
	for (const tr of spec.transitions) {
		if (tr.from === from && tr.read === read) hit = tr;
	}
	return hit;
}
function lastDtmTrans(
	spec: DTMSpec,
	from: string,
	read: string | null,
): DTMTrans | undefined {
	let hit: DTMTrans | undefined;
	for (const tr of spec.transitions) {
		if (tr.from === from && tr.read === read) hit = tr;
	}
	return hit;
}

// DFA を 1 ステップ進める。
// - rest が空 → terminal。state ∈ accept なら accept、さもなくば reject。
//   (入力を読み切った時のみ受理。途中で受理状態でも受理しない。)
// - さもなくば先頭記号を読み、遷移が有れば running、無ければ reject(行き詰まり)。
export function stepDfa(spec: DFASpec, config: DFAConfig): StepDFA {
	const { state, rest } = config;
	if (rest.length === 0) {
		const accepted = spec.accept.includes(state);
		return { status: accepted ? "accept" : "reject", config, fired: null };
	}
	const sym = rest[0];
	const t = lastDfaTrans(spec, state, sym);
	if (!t) {
		return { status: "reject", config, fired: null };
	}
	return {
		status: "running",
		config: { state: t.to, rest: rest.slice(1) },
		fired: { from: t.from, read: t.read, to: t.to },
	};
}

// DTM を 1 ステップ進める。
// - state ∈ accept → accept(遷移より先に判定。受理状態からの遷移は不要)。
// - さもなくば (state, head) の遷移を引く(read/head は blank=null も一致対象)。
//     - 無い → reject(行き詰まり)。
//     - 有る → 書き込み・移動を適用。ただし左端(left 空)での左移動は行き詰まりとして
//       reject(半無限テープの左端。config 据え置き)。
// テープ表現は契約の表示順(left はヘッド隣接が末尾、right はヘッド隣接が先頭)。
export function stepDtm(spec: DTMSpec, config: DTMConfig): StepDTM {
	const { state, left, head, right } = config;
	if (spec.accept.includes(state)) {
		return { status: "accept", config, fired: null };
	}
	const t = lastDtmTrans(spec, state, head);
	if (!t) {
		return { status: "reject", config, fired: null };
	}
	const fired: FiredDTM = {
		from: t.from,
		read: t.read,
		to: t.to,
		write: t.write,
		move: t.move,
	};
	if (t.move === "L") {
		if (left.length === 0) {
			// 左端で左移動 → 行き詰まり(config 据え置き)。
			return { status: "reject", config, fired: null };
		}
		return {
			status: "running",
			config: {
				state: t.to,
				left: left.slice(0, -1),
				head: left[left.length - 1],
				right: [t.write, ...right],
			},
			fired,
		};
	}
	// move === "R": 書き込みを左末尾へ、ヘッドは右先頭(無ければ blank=null)。
	return {
		status: "running",
		config: {
			state: t.to,
			left: [...left, t.write],
			head: right.length > 0 ? right[0] : null,
			right: right.slice(1),
		},
		fired,
	};
}
