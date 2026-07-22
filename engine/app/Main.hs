module Main (main) where

import Machine (engineName)

main :: IO ()
main = do
  putStrLn (engineName <> " — usage:")
  putStrLn "  engine-cli run <fixture.json> --input <string> [--max N]"
  putStrLn "  (CLI 実装は後続 PR。現状はスケルトン)"
