#!/usr/bin/env python3
# app の DFA(保存 JSON エンベロープ)→ ACCDFA v2 のテープ文字列に変換する。
# 使い方: python3 dfa_to_accdfa_tape.py path/to/dfa.json [入力語]
#  - DFA の入力アルファベットは {a,b} のみ対応(ACCDFA v2 の固定入力)。
#  - 状態名は任意文字列。states の順で 0,1,2... の2進添字(固定幅 W)に割り当てる。
import json, sys, math
def convert(env, word=None):
    assert env["kind"] == "dfa", "DFA のみ"
    sp = env["spec"]; states = list(sp["states"])
    idx = {s: i for i, s in enumerate(states)}
    W = max(1, math.ceil(math.log2(len(states))) if len(states) > 1 else 1)
    def b(s): return format(idx[s], f"0{W}b")
    for x in sp["alphabet"]:
        assert x in ("a", "b"), f"入力記号 {x!r} は非対応(a/b のみ)"
    ent = ";".join(f"{b(t['from'])}{t['read']}{b(t['to'])}"
                   for t in sorted(sp["transitions"], key=lambda t:(t['from'],t['read'])))
    acc = ";".join(b(s) for s in sorted(sp["accept"], key=lambda s: idx[s]))
    acc = (";" + acc) if acc else ""
    w = word if word is not None else env.get("input", "")
    tape = "{t;" + ent + "f" + acc + "s" + b(sp["start"]) + "i" + w + "}"
    return tape, W, idx
if __name__ == "__main__":
    env = json.load(open(sys.argv[1]))
    word = sys.argv[2] if len(sys.argv) > 2 else None
    tape, W, idx = convert(env, word)
    print("width W =", W)
    print("state->index:", {s: i for s, i in idx.items()})
    print("tape:", tape)
