{-# LANGUAGE OverloadedStrings #-}

-- | エンジン CLI。fixture(機械定義)と入力を受け取り、初期コンフィグから停止
-- (または最大 N 手)まで実行し、ゴールデントレース JSON(contract.md §6)を
-- stdout に出力する。ゴールデントレースの生成・目視確認に使う。
--
--   engine-cli run <fixture.json> --input <string> [--max N] [--note <text>]
module Main (main) where

import Data.Aeson (Value)
import qualified Data.Aeson as A
import Data.Aeson.Encode.Pretty
  ( Config (..),
    Indent (Tab),
    defConfig,
    encodePretty',
    keyOrder,
  )
import qualified Data.ByteString.Lazy as BL
import Machine
import System.Environment (getArgs)
import System.Exit (die)
import System.FilePath (takeBaseName)

main :: IO ()
main = do
  args <- getArgs
  case args of
    ("run" : path : opts) -> runCmd path opts
    _ -> die usage

usage :: String
usage =
  unlines
    [ "usage:",
      "  engine-cli run <fixture.json> --input <string> [--max N] [--note <text>]",
      "",
      "fixture は { kind, machine, ... } 形式。--input の各文字を記号として初期",
      "コンフィグから停止(または N 手)まで実行し、ゴールデントレース JSON を",
      "stdout に出力する(--max の既定は 1000)。"
    ]

data Opts = Opts
  { optInput :: Maybe String,
    optMax :: Int,
    optNote :: Maybe String
  }

parseOpts :: [String] -> IO Opts
parseOpts = go (Opts Nothing 1000 Nothing)
  where
    go acc [] = pure acc
    go acc ("--input" : v : r) = go acc {optInput = Just v} r
    go acc ("--note" : v : r) = go acc {optNote = Just v} r
    go acc ("--max" : v : r) = case reads v of
      [(n, "")] | n > 0 -> go acc {optMax = n} r
      _ -> die "--max は正の整数で指定してください"
    go _ (x : _) = die ("不明な引数: " <> x)

runCmd :: FilePath -> [String] -> IO ()
runCmd path opts = do
  o <- parseOpts opts
  input <- maybe (die "--input が必要です") pure (optInput o)
  bs <- BL.readFile path
  kind <- either die pure (kindOf bs)
  let stem = takeBaseName path
      syms = map Symbol input
  out <- case kind of
    "dfa" -> do
      spec <- fixtureMachine <$> decodeOrDie bs
      let c0 = initialDFA spec syms
      pure (render (Trace kind stem input (optNote o) c0 (traceDFA spec c0 (optMax o))))
    "dtm" -> do
      spec <- fixtureMachine <$> decodeOrDie bs
      let c0 = initialDTM spec syms
      pure (render (Trace kind stem input (optNote o) c0 (traceDTM spec c0 (optMax o))))
    other -> die ("未知の kind(dfa/dtm のみ対応): " <> other)
  BL.putStr out

-- | fixture の @kind@ だけを先に読む(machine は Value のまま素通し)。
kindOf :: BL.ByteString -> Either String String
kindOf bs = fixtureKind <$> (A.eitherDecode bs :: Either String (Fixture Value))

decodeOrDie :: (A.FromJSON a) => BL.ByteString -> IO a
decodeOrDie bs = either die pure (A.eitherDecode bs)

-- | トレースをタブ整形の JSON にする。キー順は契約の読みやすい順に固定し、
-- リポジトリ既定(タブインデント)と末尾改行に合わせる。
render :: (A.ToJSON a) => a -> BL.ByteString
render = encodePretty' cfg
  where
    cfg =
      defConfig
        { confIndent = Tab,
          confTrailingNewline = True,
          confCompare =
            keyOrder
              [ "kind",
                "machine",
                "input",
                "note",
                "initial",
                "steps",
                "status",
                "config",
                "fired",
                "state",
                "rest",
                "left",
                "head",
                "right",
                "from",
                "read",
                "to",
                "write",
                "move"
              ]
              <> compare
        }
