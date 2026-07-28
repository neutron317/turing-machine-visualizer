import type { z } from "zod";
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
// へ、本番は同一オリジンで解決する(proxy 設定は 5-2 で追加)。

// API 由来の失敗をすべてこの型に正規化する: 接続不可 / 非 2xx / JSON パース失敗 /
// 契約違反(Zod)。UI は StepError だけを握れば全経路を表示できる。切り分け用に
// 元の例外(fetch の TypeError や ZodError など)は cause に残す。
export class StepError extends Error {}

// 1 ステップ要求の共通処理。上記いずれの失敗も StepError にして投げる。
async function stepRequest<S extends z.ZodTypeAny>(
	path: string,
	schema: S,
	body: unknown,
): Promise<z.infer<S>> {
	let res: Response;
	try {
		res = await fetch(path, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		});
	} catch (cause) {
		throw new StepError(`API へ接続できませんでした(${path})`, { cause });
	}
	if (!res.ok) {
		throw new StepError(`API がエラーを返しました(HTTP ${res.status})`);
	}
	let data: unknown;
	try {
		data = await res.json();
	} catch (cause) {
		throw new StepError(`API 応答を JSON として解釈できませんでした(${path})`, {
			cause,
		});
	}
	const parsed = schema.safeParse(data);
	if (!parsed.success) {
		throw new StepError(`API 応答が契約に一致しません(${path})`, {
			cause: parsed.error,
		});
	}
	return parsed.data;
}

// DFA を 1 ステップ進める。応答は契約(Zod)で検証してから返す。
export function stepDfa(machine: DFASpec, config: DFAConfig): Promise<StepDFA> {
	return stepRequest("/api/dfa/step", stepDfaSchema, { machine, config });
}

// DTM を 1 ステップ進める。応答は契約(Zod)で検証してから返す。
export function stepDtm(machine: DTMSpec, config: DTMConfig): Promise<StepDTM> {
	return stepRequest("/api/dtm/step", stepDtmSchema, { machine, config });
}
