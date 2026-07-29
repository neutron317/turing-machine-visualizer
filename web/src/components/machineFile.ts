import { z } from "zod";
import { dfaSpecSchema, dtmSpecSchema } from "../contract/schemas.ts";
import type { Machine } from "../fixtures/machines.ts";
import type { Kind, Spec } from "../store/replay.ts";

// 機械をファイルへ保存/読込するためのコンパクトなテキスト形式。JSON より小さく、
// 状態・記号が1文字の DFA では ACCDFA(DTM)がそのまま構文解析できるほど素直。
//
// 1 行・パイプ区切りの 7 フィールド:
//   <k>|<states>|<alphabet>|<start>|<accepts>|<word>|<transitions>
//   - k: "d"(DFA) / "t"(DTM)
//   - states / alphabet / accepts: "," 区切りのリスト
//   - transitions: ";" 区切り。DFA=from,read,to / DTM=from,read,to,write,move
//     (read/write の空フィールドは空白 null、move は L/R)
//   - 状態名や記号に区切り文字( | , ; \ )が含まれる場合は \ でエスケープする。
// 読込は後方互換として、先頭が "{" の旧 JSON 形式も受け付ける。

// --- 旧 JSON 形式(読込のみ・後方互換) ---
const FORMAT_VERSION = 1;
const envelopeSchema = z.object({
	v: z.literal(FORMAT_VERSION),
	kind: z.enum(["dfa", "dtm"]),
	input: z.string(),
	spec: z.unknown(),
});

// フィールド内の特殊文字をエスケープする。
function esc(s: string): string {
	return s.replace(/[\\|,;]/g, (c) => `\\${c}`);
}

// \ エスケープを尊重して sep で分割する(トークンはエスケープを残したまま返す)。
function splitTop(s: string, sep: string): string[] {
	const out: string[] = [];
	let cur = "";
	for (let i = 0; i < s.length; i++) {
		const c = s[i];
		if (c === "\\") {
			cur += c + (s[i + 1] ?? "");
			i++;
		} else if (c === sep) {
			out.push(cur);
			cur = "";
		} else {
			cur += c;
		}
	}
	out.push(cur);
	return out;
}

// エスケープを外す。
function unesc(s: string): string {
	return s.replace(/\\([\s\S])/g, "$1");
}

// "," 区切りのリストフィールドを配列へ(空フィールドは空配列)。
function list(field: string): string[] {
	return field === "" ? [] : splitTop(field, ",").map(unesc);
}

// 機械の内容を保存用テキスト(コンパクト形式)へ。入力は現在の入力欄の値を渡す。
// 表示名は保存しない(読込時にファイル名から付ける)。
export function encodeMachine(m: {
	kind: Kind;
	input: string;
	spec: Spec;
}): string {
	const s = m.spec;
	const alphabet = "alphabet" in s ? s.alphabet : s.tapeAlphabet;
	const trans = s.transitions
		.map((t) =>
			"move" in t
				? [
						esc(t.from),
						t.read === null ? "" : esc(t.read),
						esc(t.to),
						t.write === null ? "" : esc(t.write),
						t.move,
					].join(",")
				: [esc(t.from), esc(t.read), esc(t.to)].join(","),
		)
		.join(";");
	return [
		m.kind === "dfa" ? "d" : "t",
		s.states.map(esc).join(","),
		alphabet.map(esc).join(","),
		esc(s.start),
		s.accept.map(esc).join(","),
		esc(m.input),
		trans,
	].join("|");
}

// 表示名から安全な保存ファイル名を作る。空白のみ/空はフォールバックし、ファイル名に
// 使えない文字は _ へ置換する。拡張子は .tm。
export function machineFileName(name: string): string {
	const base = name.trim().replace(/[\\/:*?"<>|]/g, "_");
	return `${base || "machine"}.tm`;
}

// 読み込んだファイル名から機械の表示名を作る。末尾の .tm / .json を除き、空はフォールバック。
export function machineNameFromFile(filename: string): string {
	const base = filename.replace(/\.(tm|json)$/i, "").trim();
	return base || "machine";
}

// 旧 JSON 形式を読む(後方互換)。
function decodeJson(
	text: string,
	id: string,
	name: string,
): { machine: Machine } | { error: string } {
	let data: unknown;
	try {
		data = JSON.parse(text);
	} catch {
		return { error: "JSON として読み込めませんでした。" };
	}
	const env = envelopeSchema.safeParse(data);
	if (!env.success) {
		return { error: "ファイル形式が不正です。" };
	}
	const { kind, input, spec } = env.data;
	if (kind === "dfa") {
		const parsed = dfaSpecSchema.safeParse(spec);
		if (!parsed.success) {
			return { error: "DFA の定義が契約に一致しません。" };
		}
		return {
			machine: { id, kind: "dfa", label: name, input, spec: parsed.data },
		};
	}
	const parsed = dtmSpecSchema.safeParse(spec);
	if (!parsed.success) {
		return { error: "DTM の定義が契約に一致しません。" };
	}
	return {
		machine: { id, kind: "dtm", label: name, input, spec: parsed.data },
	};
}

// 保存テキストから機械を復元する。id は呼び出し側が採番して渡す。name は表示名
// (ファイル名から作る)。spec は kind に応じて契約(Zod)で検証する。失敗は error
// 文字列に正規化する。先頭が "{" の旧 JSON 形式も読める。
export function decodeMachine(
	text: string,
	id: string,
	name: string,
): { machine: Machine } | { error: string } {
	const trimmed = text.trim();
	if (trimmed.startsWith("{")) {
		return decodeJson(trimmed, id, name);
	}
	const fields = splitTop(trimmed, "|");
	if (fields.length !== 7) {
		return { error: "ファイル形式が不正です(7 フィールド想定)。" };
	}
	const [k, statesF, alphaF, startF, acceptsF, wordF, transF] = fields;
	const kind = k === "d" ? "dfa" : k === "t" ? "dtm" : null;
	if (kind === null) {
		return { error: "先頭は d(DFA)/t(DTM)である必要があります。" };
	}
	const states = list(statesF);
	const alphabet = list(alphaF);
	const start = unesc(startF);
	const accept = list(acceptsF);
	const input = unesc(wordF);
	const records = transF === "" ? [] : splitTop(transF, ";");
	if (kind === "dfa") {
		const transitions = records.map((r) => {
			const p = splitTop(r, ",").map(unesc);
			return { from: p[0] ?? "", read: p[1] ?? "", to: p[2] ?? "" };
		});
		const parsed = dfaSpecSchema.safeParse({
			states,
			alphabet,
			start,
			accept,
			transitions,
		});
		if (!parsed.success) {
			return { error: "DFA の定義が契約に一致しません。" };
		}
		return {
			machine: { id, kind: "dfa", label: name, input, spec: parsed.data },
		};
	}
	const transitions = records.map((r) => {
		const p = splitTop(r, ",").map(unesc);
		return {
			from: p[0] ?? "",
			read: p[1] === "" || p[1] === undefined ? null : p[1],
			to: p[2] ?? "",
			write: p[3] === "" || p[3] === undefined ? null : p[3],
			move: p[4] ?? "",
		};
	});
	const parsed = dtmSpecSchema.safeParse({
		states,
		tapeAlphabet: alphabet,
		start,
		accept,
		transitions,
	});
	if (!parsed.success) {
		return { error: "DTM の定義が契約に一致しません。" };
	}
	return {
		machine: { id, kind: "dtm", label: name, input, spec: parsed.data },
	};
}

// 保存テキストをファイルとしてダウンロードさせる(ブラウザのみ)。<a> を DOM に挿入
// してからクリックし、revoke は次のタスクへ遅延させる(Safari 等で click 直後の同期
// revoke だと保存に失敗することがあるため)。
export function downloadText(filename: string, text: string): void {
	const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = filename;
	document.body.append(a);
	a.click();
	a.remove();
	setTimeout(() => URL.revokeObjectURL(url), 0);
}
