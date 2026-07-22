# データ契約 (JSON)

フロントとバックエンドが共有する JSON の仕様。**この契約が両側の唯一の基準**であり、Haskell 型・Zod スキーマ・fixture はすべてこれに一致させる。

- 文字コードは UTF-8。フィールド名は camelCase。
- 記号(入力・テープ記号)は **1 文字の文字列**。将来複数文字に拡張しうるが当面は 1 文字。
- 状態は任意の文字列。
- テープの空白(blank)は **`null`** で表す。名前付きの空白記号は使わない。

---

## 1. 機械 spec

ユーザーが編集して作る「機械の定義」。`/step` へは後述の `machine` フィールドとして渡す。

### 1.1 DFASpec

```jsonc
{
	"states": ["Even", "Odd"],        // 状態の集合(重複なし)
	"alphabet": ["a"],                // 入力アルファベット(1文字記号の集合)
	"start": "Even",                  // 初期状態(states に含まれる)
	"accept": ["Even"],               // 受理状態の集合(states の部分集合)
	"transitions": [                  // 遷移表
		{ "from": "Even", "read": "a", "to": "Odd" },
		{ "from": "Odd",  "read": "a", "to": "Even" }
	]
}
```

- `transitions` の各要素は `(from, read)` について一意(決定性)。
- ある `(state, symbol)` に遷移が **無い** 場合、その入力で機械は行き詰まり **reject** する(部分関数 DFA の慣習)。

### 1.2 DTMSpec

```jsonc
{
	"states": ["P0", "P1", "PA"],
	"tapeAlphabet": ["a", "b", "X"],  // テープに書ける記号(blank=null は含めない)
	"start": "P0",
	"accept": ["PA"],
	"transitions": [
		// read/write は記号または null(=blank)。move は "L" | "R"。
		{ "from": "P0", "read": "a",  "to": "P1", "write": "X",  "move": "R" },
		{ "from": "P0", "read": null, "to": "PA", "write": null, "move": "R" }
	]
}
```

- `transitions` の各要素は `(from, read)` について一意。
- 遷移が無い `(state, symbol)` に達したら **reject**(行き詰まり)。
- 受理状態の自己ループなどは書かなくてよい(後述のとおり受理はステップ実行の前に判定される)。

---

## 2. コンフィグ (config)

実行の「今この瞬間」の状態。履歴(`history[]`)の 1 要素であり、`/step` の入力にも出力にもなる。

### 2.1 DFAConfig

```jsonc
{
	"state": "Odd",          // 現在の状態
	"rest": ["a", "b"]       // まだ読んでいない残りの入力(先頭が次に読む記号)
}
```

### 2.2 DTMConfig

```jsonc
{
	"state": "P1",
	"left":  ["X", "a"],     // ヘッドより左のセル(表示順・左→右。末尾がヘッド直左)
	"head":  "b",            // ヘッド位置の記号(blank は null)
	"right": ["c", null]     // ヘッドより右のセル(表示順・左→右。先頭がヘッド直右)
}
```

- **テープは表示順(左→右)** で持つ。`left` の末尾がヘッドのすぐ左、`right` の先頭がヘッドのすぐ右。
	(既存 Haskell の `Tape.left` はヘッド隣接側が先頭の逆順だが、シリアライズ層で表示順に正規化する。)
- テープは両端が blank で無限に続くとみなす。`left`/`right` は blank でない範囲＋αを保持し、端に達したら `head` に `null` が現れる。

---

## 3. 初期コンフィグの作り方

入力文字列 `s`(記号の列)から初期コンフィグを構成する規則。フロントで組んでよい。

- **DFA**: `{ "state": start, "rest": [s の各文字] }`
- **DTM**:
	- `s` が空: `{ "state": start, "left": [], "head": null, "right": [] }`
	- それ以外: `{ "state": start, "left": [], "head": s[0], "right": [s[1..末尾]] }`

---

## 4. ステップ実行

### 4.1 エンドポイント

いずれもステートレス。

- `POST /api/dfa/step` — body `{ "machine": DFASpec, "config": DFAConfig }`
- `POST /api/dtm/step` — body `{ "machine": DTMSpec, "config": DTMConfig }`

応答は `StepResult`:

```jsonc
{
	"status": "running",     // "running" | "accept" | "reject"
	"config": { ... },       // 1ステップ後のコンフィグ(terminal 時は入力と同じ)
	"fired": {               // 発火した遷移(terminal 時は null)
		"from": "Even", "read": "a", "to": "Odd"
		// DTM の場合は "write" と "move" も含む
	}
}
```

### 4.2 ステップ意味論(両側で同一に実装する)

**DFA** — `config = (state, rest)`:

1. `rest` が空 → terminal。`state ∈ accept` なら `status="accept"`、そうでなければ `"reject"`。`fired=null`、`config` は据え置き。
2. そうでなければ `sym = rest[0]` を読む。`(state, sym)` の遷移が
	- **有る** → `config' = (to, rest[1..])`、`status="running"`、`fired={from,read,to}`。
	- **無い** → terminal。`status="reject"`、`fired=null`、`config` 据え置き。

> 注: DFA の受理判定は **入力を全部読み切った時のみ**。途中で受理状態に居ても入力が残っていれば受理しない(標準的な DFA 意味論)。

**DTM** — `config = (state, tape)`:

1. `state ∈ accept` → terminal。`status="accept"`、`fired=null`、`config` 据え置き。**(遷移より先に受理を判定)**
2. そうでなければ `(state, head)` の遷移が
	- **有る** → `write` を書き込み `move` 方向へヘッドを動かして `config'` を作る。`status="running"`、`fired={from,read,to,write,move}`。
	- **無い** → terminal。`status="reject"`、`fired=null`、`config` 据え置き。

> 注: 受理を遷移より先に判定するため、受理状態からの遷移は定義不要。停止しない機械はいつまでも `status="running"` を返し続ける(クライアント側の安全弁で止める)。

### 4.3 再生の流れ(フロント)

```
initial config を history=[c0], cursor=0 で開始
├ 前進: cursor が末尾 → /step(machine, history[cursor]) → 応答の config を push、status を記録、cursor++
│        cursor が途中   → cursor++(再計算しない)
└ 後退: cursor--
描画は常に history[cursor] を使う。status が accept/reject になったらそれ以上前進しない。
```

---

## 5. fixture ファイル形式

`fixtures/` 以下の機械定義ファイルは、spec にメタ情報を添えた形で持つ。

```jsonc
{
	"kind": "dfa",              // "dfa" | "dtm"(フロントの振り分け用)
	"name": "偶数個の a",
	"description": "…",
	"machine": { ...DFASpec / DTMSpec... }
}
```

- `kind` / `name` / `description` はメタ情報。`/step` へ送るのは `machine` のみ。
- ゴールデントレース(`fixtures/traces/`)は、初期コンフィグと各ステップ応答の列を記録し、エンジン実装の検証に使う(§6)。

## 6. ゴールデントレース形式

`/step` を繰り返し呼んだ結果を記録したもの。エンジンがこれを再現できることをテストで確認する。

```jsonc
{
	"kind": "dfa",
	"machine": "even-a",        // 参照する preset の "ファイル名 stem"(下記参照)
	"input": "aa",
	"note": "…",                // 任意。この例の説明メモ
	"initial": { "state": "Even", "rest": ["a", "a"] },
	"steps": [                  // 各要素は /step の応答(StepResult)
		{ "fired": { "from": "Even", "read": "a", "to": "Odd" },  "status": "running", "config": { "state": "Odd",  "rest": ["a"] } },
		{ "fired": { "from": "Odd",  "read": "a", "to": "Even" }, "status": "running", "config": { "state": "Even", "rest": [] } },
		{ "fired": null, "status": "accept", "config": { "state": "Even", "rest": [] } }
	]
}
```

各フィールド:

- `kind`: `"dfa"` | `"dtm"`。参照する preset の種別。
- `machine`: 参照する preset ファイルの **stem(拡張子を除いたファイル名)**。`kind` に応じて `fixtures/dfa/<stem>.json` または `fixtures/dtm/<stem>.json` を指す。例では `"even-a"` → `fixtures/dfa/even-a.json`。preset 内の `name`(表示用の日本語ラベル。例 `"偶数個の a"`)とは別物。
- `input`: この実行に与えた入力文字列。
- `note`: 任意。この例の意図を説明するメモ。
- `initial`: 初期コンフィグ(§3 の規則で `input` から構成したもの)。
- `steps`: `/step` を繰り返し呼んだときの応答(StepResult)の列。
