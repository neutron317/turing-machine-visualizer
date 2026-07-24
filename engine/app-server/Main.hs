module Main (main) where

import Machine.Http (runServer)
import System.Environment (lookupEnv)
import System.Exit (die)
import Text.Read (readMaybe)

-- | エンジンの HTTP サーバ。環境変数 PORT(既定 3000)で待ち受ける。
main :: IO ()
main = do
  port <- resolvePort
  putStrLn ("engine-server listening on port " <> show port)
  runServer port

-- | 環境変数 PORT を解決する。未設定なら既定 3000。設定されているが 1..65535 の
-- 整数として解釈できない場合は、設定ミスを黙って既定に隠さずエラーで停止する。
resolvePort :: IO Int
resolvePort = do
  portEnv <- lookupEnv "PORT"
  case portEnv of
    Nothing -> pure 3000
    Just s -> case readMaybe s of
      Just n | n >= 1 && n <= 65535 -> pure n
      _ -> die ("invalid PORT: " <> s <> "(1..65535 の整数を指定してください)")
