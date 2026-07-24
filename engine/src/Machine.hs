-- | エンジンの公開 API。契約型('Machine.Spec')と 1 ステップ実行('Machine.Step')を
-- まとめて再エクスポートする。HTTP 層・CLI・テストはこのモジュールを入口にする。
-- 内部の型変換('Machine.Adapt')は公開しない。
module Machine
  ( module Machine.Spec,
    module Machine.Step,
  )
where

import Machine.Spec
import Machine.Step
