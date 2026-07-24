-- | 契約の spec/config(Machine.Spec)を vendored エンジン(DFA/DTM)の型へ橋渡しする。
-- 遷移表は 'Data.Map' で引く決定的な遷移関数に組み立て、既存 @transDFA@/@transDTM@ を
-- そのまま再利用できるようにする。
--
-- テープ表現の違いもここで吸収する: 契約 'DTMConfig' の @left@ は表示順(左→右、
-- 末尾がヘッド直左)だが、vendored 'DTM.Tape' の @left@ はヘッド隣接側が先頭の逆順。
-- 'toTape' / 'fromTape' で相互変換する。
module Machine.Adapt
  ( dfaFromSpec,
    dtmFromSpec,
    dtmFromMap,
    dtmTransMap,
    toTape,
    fromTape,
  )
where

import qualified DFA as V
import qualified DTM as V
import Data.Map (Map)
import qualified Data.Map as Map
import Machine.Spec

-- | 'DFASpec' から vendored 'DFA.DFA' を構築する。出力型は使わないので @()@。
-- 遷移が無い @(state, symbol)@ では次状態 'Nothing'(= 行き詰まり)を返す。
dfaFromSpec :: DFASpec -> V.DFA String Symbol ()
dfaFromSpec spec =
  V.DFA
    { V.dfatransfunc = \st sym -> (Map.lookup (st, sym) tm, ()),
      V.dfastart = dfaStart spec,
      V.dfafinish = dfaAccept spec
    }
  where
    tm = Map.fromList [((dfatFrom t, dfatRead t), dfatTo t) | t <- dfaTransitions spec]

-- | DTM の遷移表。@(from, read)@ → その遷移 1 本。決定性なので後勝ちで一意化される。
-- 発火した遷移(fired)の復元(Step.hs)と 'dtmFromSpec' / 'dtmFromMap' で使う。
dtmTransMap :: DTMSpec -> Map (String, Maybe Symbol) DTMTrans
dtmTransMap spec =
  Map.fromList [((dtmtFrom t, dtmtRead t), t) | t <- dtmTransitions spec]

-- | 'DTMSpec' から vendored 'DTM.DTM' を構築する。
-- 遷移が無い @(state, symbol)@ では次状態 'Nothing' を返し、@transDTM@ 側で
-- 行き詰まり(reject)になる。
dtmFromSpec :: DTMSpec -> V.DTM String Symbol
dtmFromSpec spec = dtmFromMap spec (dtmTransMap spec)

-- | 遷移表を渡して 'DTM.DTM' を構築する。ステップ実行側が fired 復元用の遷移表と
-- @transDTM@ 用の 'DTM.DTM' を同じ Map から一度だけ組み立てられるようにする
-- ('dtmTransMap' の二重構築を避ける)。
dtmFromMap :: DTMSpec -> Map (String, Maybe Symbol) DTMTrans -> V.DTM String Symbol
dtmFromMap spec tm =
  V.DTM
    { V.dtmtransfunc = \st sym -> case Map.lookup (st, sym) tm of
        Just t -> (Just (dtmtTo t), (dtmtWrite t, toVMove (dtmtMove t)))
        -- 遷移なし: 次状態 Nothing で行き詰まり。出力は transDTM 側で無視される。
        Nothing -> (Nothing, (Nothing, V.R)),
      V.dtmstart = dtmStart spec,
      V.dtmfinish = dtmAccept spec
    }

-- | 契約 'Move' → vendored 'DTM.Move'。orphan instance を避けるため関数で変換する。
toVMove :: Move -> V.Move
toVMove L = V.L
toVMove R = V.R

-- | 契約 'DTMConfig'(表示順)→ vendored 'DTM.Tape'(ヘッド隣接が先頭)。
toTape :: DTMConfig -> V.Tape Symbol
toTape c =
  V.Tape
    { V.left = reverse (tcLeft c),
      V.tapehead = tcHead c,
      V.right = tcRight c
    }

-- | vendored 'DTM.Tape' → 契約 'DTMConfig'。状態は別途渡す。
fromTape :: String -> V.Tape Symbol -> DTMConfig
fromTape st t =
  DTMConfig
    { tcState = st,
      tcLeft = reverse (V.left t),
      tcHead = V.tapehead t,
      tcRight = V.right t
    }
