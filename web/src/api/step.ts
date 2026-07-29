import type {
	DFAConfig,
	DFASpec,
	DTMConfig,
	DTMSpec,
	StepDFA,
	StepDTM,
} from "../contract/schemas.ts";
import {
	stepDfa as stepDfaLocal,
	stepDtm as stepDtmLocal,
} from "../engine/step.ts";

// 1 ステップ実行の入口。以前は Haskell バックエンド(/api/*/step)を叩いていたが、
// 意味論を web/src/engine/step.ts に移植し、ブラウザ内で完結するようにした
// (サーバ不要=静的ホスト・ローカルで動く、ネットワーク往復が無く再生も高速)。
// 呼び出し側(replay ストア)は Promise を await するため、非同期の署名は維持する。

// StepError は互換のため残す(ローカル実行では通常発生しない)。将来ネットワーク
// 経路を再導入する場合の失敗正規化にも使える。呼び出し側は引き続きこれを握れる。
export class StepError extends Error {}

// DFA を 1 ステップ進める(ローカル実行)。
export function stepDfa(machine: DFASpec, config: DFAConfig): Promise<StepDFA> {
	return Promise.resolve(stepDfaLocal(machine, config));
}

// DTM を 1 ステップ進める(ローカル実行)。
export function stepDtm(machine: DTMSpec, config: DTMConfig): Promise<StepDTM> {
	return Promise.resolve(stepDtmLocal(machine, config));
}
