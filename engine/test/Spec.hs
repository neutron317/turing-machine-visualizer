module Main (main) where

import Machine (engineName)
import Test.Hspec (describe, hspec, it, shouldBe)

main :: IO ()
main =
  hspec $
    describe "scaffold" $
      it "engine name is set" $
        engineName `shouldBe` "turing-visualizer engine"
