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
stepDFA spec c@(DFAConfig st rest) =
  case rest of
    [] -> StepDFA (finalStatus (st `elem` dfaAccept spec)) c Nothing
    (sym : more) ->
      case V.transDFA (dfaFromSpec spec) st sym of
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
stepDTM spec c
  | tcState c `elem` dtmAccept spec = StepDTM Accepted c Nothing
  | otherwise =
      case Map.lookup (tcState c, tcHead c) (dtmTransMap spec) of
        Nothing -> StepDTM Rejected c Nothing
        Just t ->
          case V.transDTM (dtmFromSpec spec) (toTape c) (tcState c) of
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
traceDFA :: DFASpec -> DFAConfig -> Int -> [StepDFA]
traceDFA spec c0 n = take n (go c0)
  where
    go c =
      let s = stepDFA spec c
       in s : if sdaStatus s == Running then go (sdaConfig s) else []

-- | 'traceDFA' の DTM 版。
traceDTM :: DTMSpec -> DTMConfig -> Int -> [StepDTM]
traceDTM spec c0 n = take n (go c0)
  where
    go c =
      let s = stepDTM spec c
       in s : if sdtStatus s == Running then go (sdtConfig s) else []
