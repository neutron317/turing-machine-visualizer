-- | ステップ実行の意味論(docs/contract.md §4.2)。1 リクエスト = 1 ステップの
-- ステートレス関数 'stepDFA' / 'stepDTM' が中核で、HTTP 層はこれを薄く公開する。
-- 正しさは vendored エンジン(@transDFA@/@transDTM@)側に持たせ、ここは契約への
-- 変換と終了状態(accept/reject)の判定だけを行う。
module Machine.Step
  ( -- * 1 ステップ
    stepDFA,
    stepDTM,

    -- * 初期コンフィグ(contract.md §3)
    initialDFA,
    initialDTM,

    -- * トレース(停止 or 最大 N 手まで)
    traceDFA,
    traceDTM,
  )
where

import qualified DFA as V
import qualified DTM as V
import Data.Map (Map)
import qualified Data.Map as Map
import Machine.Adapt
import Machine.Spec

-- | DFA を 1 ステップ進める。
--
-- * @rest@ が空 → terminal。@state ∈ accept@ なら accept、さもなくば reject。
-- * さもなくば先頭記号を読み、遷移が有れば running、無ければ reject(行き詰まり)。
--
-- 注: DFA の受理判定は入力を読み切った時のみ(途中で受理状態に居ても受理しない)。
stepDFA :: DFASpec -> DFAConfig -> StepDFA
stepDFA spec = stepDFAWith (dfaFromSpec spec)

-- | コンパイル済みの 'DFA.DFA' で 1 ステップ進める下請け。トレースが遷移表を
-- ステップ毎に組み直さないよう、マシンの構築(= Map 構築)と分離する。
stepDFAWith :: V.DFA String Symbol () -> DFAConfig -> StepDFA
stepDFAWith dfa c@(DFAConfig st rest) =
  case rest of
    [] -> StepDFA (finalStatus (st `elem` V.dfafinish dfa)) c Nothing
    (sym : more) ->
      case V.transDFA dfa st sym of
        (Just to, _) -> StepDFA Running (DFAConfig to more) (Just (FiredDFA st sym to))
        (Nothing, _) -> StepDFA Rejected c Nothing

-- | DTM を 1 ステップ進める。
--
-- * @state ∈ accept@ → terminal accept(遷移より先に判定するため受理状態からの遷移は不要)。
-- * さもなくば @(state, head)@ の遷移を引く。
--     * 無い → reject(行き詰まり)。
--     * 有る → @transDTM@ で書き込み・移動を適用。ただし左端で左移動しようとすると
--       @transDTM@ が行き詰まりを返すため reject(半無限テープの左端。config 据え置き)。
--
-- テープ機構(左端 reject・右端での @head=null@ 生成)は vendored @transDTM@ に委ねる。
stepDTM :: DTMSpec -> DTMConfig -> StepDTM
stepDTM spec = let tmap = dtmTransMap spec in stepDTMWith (dtmFromMap spec tmap) tmap

-- | コンパイル済みの 'DTM.DTM' と遷移表で 1 ステップ進める下請け。遷移表は fired
-- 復元に、'DTM.DTM' は @transDTM@ に使う。両者は同じ Map から一度だけ組む。
stepDTMWith ::
  V.DTM String Symbol ->
  Map (String, Maybe Symbol) DTMTrans ->
  DTMConfig ->
  StepDTM
stepDTMWith dtm tmap c
  | tcState c `elem` V.dtmfinish dtm = StepDTM Accepted c Nothing
  | otherwise =
      case Map.lookup (tcState c, tcHead c) tmap of
        Nothing -> StepDTM Rejected c Nothing
        Just t ->
          case V.transDTM dtm (toTape c) (tcState c) of
            (Nothing, _) -> StepDTM Rejected c Nothing
            (Just to, tape') -> StepDTM Running (fromTape to tape') (Just (firedDTM t))

-- | 発火した DTM 遷移を契約の 'FiredDTM' に写す。
firedDTM :: DTMTrans -> FiredDTM
firedDTM t = FiredDTM (dtmtFrom t) (dtmtRead t) (dtmtTo t) (dtmtWrite t) (dtmtMove t)

finalStatus :: Bool -> Status
finalStatus accepted = if accepted then Accepted else Rejected

-- | 入力記号列から DFA の初期コンフィグを作る(contract.md §3)。
initialDFA :: DFASpec -> [Symbol] -> DFAConfig
initialDFA spec = DFAConfig (dfaStart spec)

-- | 入力記号列から DTM の初期コンフィグを作る(contract.md §3)。
initialDTM :: DTMSpec -> [Symbol] -> DTMConfig
initialDTM spec [] = DTMConfig (dtmStart spec) [] Nothing []
initialDTM spec (x : xs) = DTMConfig (dtmStart spec) [] (Just x) (map Just xs)

-- | 初期コンフィグから停止(status ≠ running)まで、または最大 @n@ 手まで
-- 各ステップ応答を並べる。停止しない DTM でも @n@ で打ち切れる(遅延評価で安全)。
-- コンパイル済みマシン(遷移表)は走査の前に一度だけ構築して使い回す。
traceDFA :: DFASpec -> DFAConfig -> Int -> [StepDFA]
traceDFA spec c0 n = take n (go c0)
  where
    dfa = dfaFromSpec spec
    go c =
      let s = stepDFAWith dfa c
       in s : if sdaStatus s == Running then go (sdaConfig s) else []

-- | 'traceDFA' の DTM 版。
traceDTM :: DTMSpec -> DTMConfig -> Int -> [StepDTM]
traceDTM spec c0 n = take n (go c0)
  where
    tmap = dtmTransMap spec
    dtm = dtmFromMap spec tmap
    go c =
      let s = stepDTMWith dtm tmap c
       in s : if sdtStatus s == Running then go (sdtConfig s) else []
