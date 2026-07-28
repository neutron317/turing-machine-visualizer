import {
	type DFAConfig,
	type DFASpec,
	type DTMConfig,
	type DTMSpec,
	type StepDFA,
	type StepDTM,
	stepDfaSchema,
	stepDtmSchema,
} from "../contract/schemas.ts";

// バックエンド(Scotty)の 1 ステップ API を叩くクライアント(contract.md §4)。
// サーバはステートレスなので、実行状態(config)はクライアントが保持し、毎回
// machine spec と共に送る。パスは相対 /api 固定 — dev は vite proxy 経由で :3000
// へ、本番は同一オリジンで解決する。

// API 由来の失敗(接続不可 / 非 2xx / 契約違反)を表す。UI はこれを握って表示する。
export class StepError extends Error {}

// 応答本体の取得までを共通化する。接続不可・非 2xx は StepError に正規化する。
async function post(path: string, body: unknown): Promise<unknown> {
	let res: Response;
	try {
		res = await fetch(path, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		});
	} catch {
		throw new StepError(`API へ接続できませんでした(${path})`);
	}
	if (!res.ok) {
		throw new StepError(`API がエラーを返しました(HTTP ${res.status})`);
	}
	return res.json();
}

// DFA を 1 ステップ進める。応答は契約(Zod)で検証してから返す。
export async function stepDfa(
	machine: DFASpec,
	config: DFAConfig,
): Promise<StepDFA> {
	return stepDfaSchema.parse(await post("/api/dfa/step", { machine, config }));
}

// DTM を 1 ステップ進める。応答は契約(Zod)で検証してから返す。
export async function stepDtm(
	machine: DTMSpec,
	config: DTMConfig,
): Promise<StepDTM> {
	return stepDtmSchema.parse(await post("/api/dtm/step", { machine, config }));
}
