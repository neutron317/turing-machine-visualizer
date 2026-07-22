{-# LANGUAGE OverloadedStrings #-}

module Main (main) where

import qualified Data.Aeson as A
import qualified Data.ByteString.Lazy as BL
import Data.Either (isRight)
import Machine.Spec
import Test.Hspec

-- 値 → JSON → 値 が元に戻ることを確認する。
roundTrips :: (Eq a, Show a, A.ToJSON a, A.FromJSON a) => a -> Expectation
roundTrips x = A.decode (A.encode x) `shouldBe` Just x

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
