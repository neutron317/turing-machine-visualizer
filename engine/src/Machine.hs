module Machine
  ( engineName,
    exampleResult,
    exampleMove,
  )
where

import DFA (Result (..))
import DTM (Move (..))

-- | スケルトン用のプレースホルダ。
-- 実際の Spec / Adapt / Step は後続 PR で追加する。
engineName :: String
engineName = "turing-visualizer engine"

-- | 既存エンジン(submodule)の型がリンクできることの確認用。
exampleResult :: Result
exampleResult = Accept

exampleMove :: Move
exampleMove = R
