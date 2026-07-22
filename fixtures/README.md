# fixtures

データ契約([`../docs/contract.md`](../docs/contract.md))の実例。フロント・バックエンド双方の開発とテストの基準にする。

## 構成

| パス | 内容 |
|---|---|
| `dfa/*.json` | DFA の機械定義(既存 `ExampleDFA.hs` 由来) |
| `dtm/*.json` | DTM の機械定義(既存 `ExampleDTM.hs` 由来) |
| `traces/*.json` | ゴールデントレース。`/step` を繰り返した結果の列。エンジン実装がこれを再現できることをテストで確認する |

## 機械定義(preset)

- `dfa/even-a.json` — 'a' が偶数個なら受理
- `dfa/end-ab.json` — "ab" で終わる文字列を受理
- `dfa/mod3.json` — 2進表記が 3 の倍数なら受理
- `dtm/anbncn.json` — aⁿbⁿcⁿ を受理(文脈自由言語ではない例)

各ファイルは `{ kind, name, description, machine }` の形。`/step` へ送るのは `machine` のみ。

## ゴールデントレース

- `traces/dfa-even-a.json` — `even-a` に入力 `"aa"` を与えた実行列(手計算で検証済み。トレース形式のリファレンスも兼ねる)。

> **DTM のゴールデントレースはステージ2で追加する。** 手計算は誤りが混入しやすいため、エンジンの CLI が出力した列を目視確認のうえコミットする(`anbncn` に `"abc"` など)。
