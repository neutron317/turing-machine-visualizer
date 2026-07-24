module Main (main) where

import Data.Maybe (fromMaybe)
import Machine.Http (runServer)
import System.Environment (lookupEnv)
import Text.Read (readMaybe)

-- | エンジンの HTTP サーバ。環境変数 PORT(既定 3000)で待ち受ける。
main :: IO ()
main = do
  portEnv <- lookupEnv "PORT"
  let port = fromMaybe 3000 (portEnv >>= readMaybe)
  putStrLn ("engine-server listening on port " <> show port)
  runServer port
