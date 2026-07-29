#!/usr/bin/env python3
"""保存した DFA(.tmvdfa)を ACCDFA(accdfa.tmvdtm)へ流せる形に正規化して出力する。

ACCDFA の制約:
  - 状態名は 10 進の数字列(0,1,2,…。桁数任意=状態数は無制限)
  - 入力記号は a-e(最大 5 種)
このスクリプトは任意の状態名を 0,1,2,… に採番し、記号を a-e に対応付ける。
入力記号が 6 種以上のときだけ変換できず、その旨を表示する(=「可能であれば」)。

使い方:
  python3 example/dfa_to_accdfa.py path/to/foo.tmvdfa [判定したい語]
出力(標準出力の 1 行)を accdfa.tmvdtm の「入力(テープ)」欄に貼って「再生」。
状態・記号の対応表は標準エラーに出す。
"""
from __future__ import annotations

import re
import sys


def _split_top(s: str, sep: str) -> list[str]:
	# \ エスケープを尊重して sep で分割(トークンはエスケープを残す)。
	out: list[str] = []
	cur = ""
	i = 0
	while i < len(s):
		c = s[i]
		if c == "\\":
			cur += c + (s[i + 1] if i + 1 < len(s) else "")
			i += 2
			continue
		if c == sep:
			out.append(cur)
			cur = ""
			i += 1
			continue
		cur += c
		i += 1
	out.append(cur)
	return out


def _unesc(s: str) -> str:
	return re.sub(r"\\(.)", r"\1", s)


def _esc(s: str) -> str:
	return re.sub(r"[\\|,;]", lambda m: "\\" + m.group(0), s)


def _list(field: str) -> list[str]:
	return [] if field == "" else [_unesc(x) for x in _split_top(field, ",")]


def convert(text: str, word_override: str | None = None) -> tuple[str, dict, dict]:
	""".tmvdfa テキストを ACCDFA 用の正規化 .tmvdfa 文字列へ。(out, 状態対応, 記号対応)。"""
	t = text.strip()
	if t.startswith("{"):
		raise SystemExit("旧 JSON 形式は非対応です。.tmvdfa を渡してください。")
	f = _split_top(t, "|")
	if len(f) != 7:
		raise SystemExit("形式が不正です(| 区切りの 7 フィールド想定)。")
	if f[0] != "d":
		raise SystemExit("DFA(.tmvdfa)のみ対応です。DTM は ACCDFA に流せません。")
	states = _list(f[1])
	start = _unesc(f[3])
	accepts = _list(f[4])
	word = word_override if word_override is not None else _unesc(f[5])
	recs = [] if f[6] == "" else _split_top(f[6], ";")
	trans = [tuple(_unesc(x) for x in _split_top(r, ",")) for r in recs]

	# 状態採番: states の順を優先し、未登場の端点(start/accept/遷移)も後ろに補う。
	order = list(states)
	for s in [start, *accepts, *[x for tr in trans for x in (tr[0], tr[2])]]:
		if s not in order:
			order.append(s)
	smap = {s: str(i) for i, s in enumerate(order)}

	# 記号対応: 実際に使う記号(遷移の read と語)を昇順で a-e に割り当てる。
	syms = sorted({tr[1] for tr in trans} | set(word))
	if len(syms) > 5:
		raise SystemExit(
			f"入力記号が {len(syms)} 種({','.join(syms)})あります。"
			"ACCDFA は最大 5 種(a-e)までなので流せません。"
		)
	amap = {s: "abcde"[i] for i, s in enumerate(syms)}

	out = "|".join(
		[
			"d",
			",".join(smap[s] for s in order),
			",".join(amap[s] for s in syms),
			smap[start],
			",".join(smap[s] for s in accepts),
			"".join(amap[c] for c in word),
			";".join(f"{smap[a]},{amap[rd]},{smap[b]}" for (a, rd, b) in trans),
		]
	)
	return out, smap, amap


if __name__ == "__main__":
	if len(sys.argv) < 2:
		raise SystemExit("使い方: python3 dfa_to_accdfa.py foo.tmvdfa [判定したい語]")
	src = open(sys.argv[1], encoding="utf-8").read()
	w = sys.argv[2] if len(sys.argv) > 2 else None
	tape, smap, amap = convert(src, w)
	print(f"# 状態対応: {smap}", file=sys.stderr)
	print(f"# 記号対応: {amap}", file=sys.stderr)
	print(tape)
