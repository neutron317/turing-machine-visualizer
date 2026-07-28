import { z } from "zod";
import { dfaSpecSchema, dtmSpecSchema } from "../contract/schemas.ts";
import type { Machine } from "../fixtures/machines.ts";
import type { Kind, Spec } from "../store/replay.ts";

// 機械をファイルへ保存/読込するための最小フォーマット。できるだけ軽量にするため
// ミニファイした JSON エンベロープ(id は保存せず、読込時に振り直す)。
// v はフォーマットのバージョン(将来の互換用)。

// フォーマットのバージョン。encode と schema で共有する(単一点で更新できるように)。
const FORMAT_VERSION = 1;

const envelopeSchema = z.object({
	v: z.literal(FORMAT_VERSION),
	kind: z.enum(["dfa", "dtm"]),
	label: z.string(),
	input: z.string(),
	spec: z.unknown(),
});

// 機械の内容を保存用テキスト(ミニファイ JSON)へ。入力は現在の入力欄の値を渡す。
export function encodeMachine(m: {
	kind: Kind;
	label: string;
	input: string;
	spec: Spec;
}): string {
	return JSON.stringify({
		v: FORMAT_VERSION,
		kind: m.kind,
		label: m.label,
		input: m.input,
		spec: m.spec,
	});
}

// ラベルから安全な保存ファイル名を作る。空白のみ/空はフォールバックし、ファイル名に
// 使えない文字(と制御文字)は _ へ置換する。
export function machineFileName(label: string): string {
	const base = label.trim().replace(/[\\/:*?"<>|]/g, "_");
	return `${base || "machine"}.json`;
}

// 保存テキストから機械を復元する。id は呼び出し側が採番して渡す。spec は kind に
// 応じて契約(Zod)で検証する。失敗は error 文字列に正規化する。
export function decodeMachine(
	text: string,
	id: string,
): { machine: Machine } | { error: string } {
	let data: unknown;
	try {
		data = JSON.parse(text);
	} catch {
		return { error: "JSON として読み込めませんでした。" };
	}
	const env = envelopeSchema.safeParse(data);
	if (!env.success) {
		return { error: "ファイル形式が不正です(v/kind/label/input/spec)。" };
	}
	const { kind, label, input, spec } = env.data;
	if (kind === "dfa") {
		const parsed = dfaSpecSchema.safeParse(spec);
		if (!parsed.success) {
			return { error: "DFA の定義が契約に一致しません。" };
		}
		return { machine: { id, kind: "dfa", label, input, spec: parsed.data } };
	}
	const parsed = dtmSpecSchema.safeParse(spec);
	if (!parsed.success) {
		return { error: "DTM の定義が契約に一致しません。" };
	}
	return { machine: { id, kind: "dtm", label, input, spec: parsed.data } };
}

// 保存テキストをファイルとしてダウンロードさせる(ブラウザのみ)。<a> を DOM に挿入
// してからクリックし、revoke は次のタスクへ遅延させる(Safari 等で click 直後の同期
// revoke だと保存に失敗することがあるため)。
export function downloadText(filename: string, text: string): void {
	const blob = new Blob([text], { type: "application/json" });
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = filename;
	document.body.append(a);
	a.click();
	a.remove();
	setTimeout(() => URL.revokeObjectURL(url), 0);
}
