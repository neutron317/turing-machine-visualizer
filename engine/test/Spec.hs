{-# LANGUAGE OverloadedStrings #-}

module Main (main) where

import qualified Data.Aeson as A
import qualified Data.ByteString.Lazy as BL
import Data.Either (isRight)
import Machine
import Test.Hspec

-- 値 → JSON → 値 が元に戻ることを確認する。
roundTrips :: (Eq a, Show a, A.ToJSON a, A.FromJSON a) => a -> Expectation
roundTrips x = A.decode (A.encode x) `shouldBe` Just x

-- JSON ファイルを読んでデコードする(失敗はテスト失敗にする)。
decodeIO :: (A.FromJSON a) => FilePath -> IO a
decodeIO path = do
  bs <- BL.readFile path
  either (\e -> fail (path <> ": " <> e)) pure (A.eitherDecode bs)

main :: IO ()
main = hspec $ do
  describe "JSON 契約" $ do
    it "DFAConfig を契約どおり解釈する(記号は1文字文字列の配列)" $
      A.decode "{\"state\":\"Odd\",\"rest\":[\"a\",\"b\"]}"
        `shouldBe` Just (DFAConfig "Odd" [Symbol 'a', Symbol 'b'])

    it "DTMConfig の blank は null" $
      A.decode "{\"state\":\"P1\",\"left\":[\"X\"],\"head\":null,\"right\":[]}"
        `shouldBe` Just (DTMConfig "P1" [Just (Symbol 'X')] Nothing [])

    it "Move は \"L\"/\"R\"" $ do
      A.encode R `shouldBe` "\"R\""
      A.decode "\"L\"" `shouldBe` Just L

    it "Status は running/accept/reject" $ do
      A.encode Accepted `shouldBe` "\"accept\""
      A.decode "\"reject\"" `shouldBe` Just Rejected

    it "StepDFA(fired 付き)が round-trip する" $
      roundTrips
        ( StepDFA
            Running
            (DFAConfig "Even" [Symbol 'a'])
            (Just (FiredDFA "Even" (Symbol 'a') "Odd"))
        )

    it "StepDTM(fired 付き)が round-trip する" $
      roundTrips
        ( StepDTM
            Running
            (DTMConfig "P0" [] (Just (Symbol 'a')) [Just (Symbol 'b')])
            (Just (FiredDTM "P0" (Just (Symbol 'a')) "P1" (Just (Symbol 'X')) R))
        )

  describe "fixtures を parse できる" $ do
    it "DFA preset (even-a)" $ do
      bs <- BL.readFile "../fixtures/dfa/even-a.json"
      let r = A.eitherDecode bs :: Either String (Fixture DFASpec)
      fmap (dfaStart . fixtureMachine) r `shouldBe` Right "Even"

    it "DTM preset (anbncn)" $ do
      bs <- BL.readFile "../fixtures/dtm/anbncn.json"
      let r = A.eitherDecode bs :: Either String (Fixture DTMSpec)
      fmap (dtmStart . fixtureMachine) r `shouldBe` Right "P0"

    it "DFA preset の全 fixture が読める" $ do
      let files = ["even-a", "end-ab", "mod3"]
      oks <-
        mapM
          ( \n -> do
              bs <- BL.readFile ("../fixtures/dfa/" <> n <> ".json")
              pure (isRight (A.eitherDecode bs :: Either String (Fixture DFASpec)))
          )
          files
      oks `shouldBe` map (const True) files

  describe "ステップ意味論(contract.md §4.2)" $ do
    let evenA =
          DFASpec
            { dfaStates = ["Even", "Odd"],
              dfaAlphabet = [Symbol 'a'],
              dfaStart = "Even",
              dfaAccept = ["Even"],
              dfaTransitions =
                [ DFATrans "Even" (Symbol 'a') "Odd",
                  DFATrans "Odd" (Symbol 'a') "Even"
                ]
            }

    it "DFA: 入力を読み切って受理状態なら accept" $
      stepDFA evenA (DFAConfig "Even" [])
        `shouldBe` StepDFA Accepted (DFAConfig "Even" []) Nothing

    it "DFA: 遷移が無ければ reject(config 据え置き・fired=null)" $
      stepDFA evenA (DFAConfig "Even" [Symbol 'b'])
        `shouldBe` StepDFA Rejected (DFAConfig "Even" [Symbol 'b']) Nothing

    it "DFA: 入力を読み切っても非受理状態なら terminal reject" $
      stepDFA evenA (DFAConfig "Odd" [])
        `shouldBe` StepDFA Rejected (DFAConfig "Odd" []) Nothing

    it "DFA: 受理状態でも入力が残っていれば受理しない(1歩進む)" $
      stepDFA evenA (DFAConfig "Even" [Symbol 'a'])
        `shouldBe` StepDFA Running (DFAConfig "Odd" []) (Just (FiredDFA "Even" (Symbol 'a') "Odd"))

    it "DFA: 初期コンフィグは (start, 入力列)" $
      initialDFA evenA [Symbol 'a', Symbol 'a'] `shouldBe` DFAConfig "Even" [Symbol 'a', Symbol 'a']

    let leftMover =
          DTMSpec
            { dtmStates = ["P0", "PA"],
              dtmTapeAlphabet = [Symbol 'a'],
              dtmStart = "P0",
              dtmAccept = ["PA"],
              dtmTransitions = [DTMTrans "P0" (Just (Symbol 'a')) "P0" (Just (Symbol 'a')) L]
            }

    it "DTM: 受理は遷移より先に判定する" $
      stepDTM leftMover (DTMConfig "PA" [] (Just (Symbol 'a')) [])
        `shouldBe` StepDTM Accepted (DTMConfig "PA" [] (Just (Symbol 'a')) []) Nothing

    it "DTM: 左端で左移動しようとすると reject(config 据え置き・書き込みも反映しない)" $
      stepDTM leftMover (DTMConfig "P0" [] (Just (Symbol 'a')) [])
        `shouldBe` StepDTM Rejected (DTMConfig "P0" [] (Just (Symbol 'a')) []) Nothing

    it "DTM: 遷移が無い(行き詰まり)なら reject(config 据え置き・fired=null)" $
      stepDTM leftMover (DTMConfig "P0" [] (Just (Symbol 'b')) [])
        `shouldBe` StepDTM Rejected (DTMConfig "P0" [] (Just (Symbol 'b')) []) Nothing

    it "DTM: 初期コンフィグは head=先頭・right=残り(空入力は head=null)" $ do
      initialDTM leftMover [Symbol 'a', Symbol 'a']
        `shouldBe` DTMConfig "P0" [] (Just (Symbol 'a')) [Just (Symbol 'a')]
      initialDTM leftMover [] `shouldBe` DTMConfig "P0" [] Nothing []

  describe "ゴールデントレース再現(contract.md §6)" $ do
    it "DFA even-a / \"aa\" を再現する" $ do
      fx <- decodeIO "../fixtures/dfa/even-a.json" :: IO (Fixture DFASpec)
      tr <- decodeIO "../fixtures/traces/dfa-even-a.json" :: IO (Trace DFAConfig StepDFA)
      let spec = fixtureMachine fx
      traceInitial tr `shouldBe` initialDFA spec (map Symbol (traceInput tr))
      traceDFA spec (traceInitial tr) 100 `shouldBe` traceSteps tr

    it "DTM anbncn / \"abc\" を再現する" $ do
      fx <- decodeIO "../fixtures/dtm/anbncn.json" :: IO (Fixture DTMSpec)
      tr <- decodeIO "../fixtures/traces/dtm-anbncn.json" :: IO (Trace DTMConfig StepDTM)
      let spec = fixtureMachine fx
      traceInitial tr `shouldBe` initialDTM spec (map Symbol (traceInput tr))
      traceDTM spec (traceInitial tr) 1000 `shouldBe` traceSteps tr
