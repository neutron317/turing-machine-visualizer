{-# LANGUAGE OverloadedStrings #-}

-- | HTTP 層。中核の 1 ステップ関数(Machine.Step)を薄く公開する(contract.md §4)。
-- ステートレス: 各リクエストは @{machine, config}@ を受け取り、1 ステップ進めた
-- StepResult を返すだけ。実行状態(config)はクライアントが保持する。CORS 許可。
module Machine.Http
  ( application,
    runServer,
  )
where

import Data.Aeson (FromJSON (..), withObject, (.:))
import qualified Data.Aeson as A
import Machine
import Network.Wai (Middleware)
import Network.Wai.Middleware.Cors
  ( cors,
    corsRequestHeaders,
    simpleCorsResourcePolicy,
  )
import Web.Scotty

-- | @/step@ のリクエストボディ: @{ "machine": Spec, "config": Config }@。
data StepReq spec cfg = StepReq spec cfg

instance (FromJSON spec, FromJSON cfg) => FromJSON (StepReq spec cfg) where
  parseJSON = withObject "StepReq" $ \o -> StepReq <$> o .: "machine" <*> o .: "config"

-- | ルーティング。
routes :: ScottyM ()
routes = do
  get "/health" $ json (A.object ["status" A..= ("ok" :: String)])
  post "/api/dfa/step" $ do
    StepReq machine config <- jsonData
    json (stepDFA machine config)
  post "/api/dtm/step" $ do
    StepReq machine config <- jsonData
    json (stepDTM machine config)

-- | CORS: 任意オリジンから JSON POST を許可する。JSON ボディは Content-Type が
-- application/json でプリフライト(OPTIONS)が飛ぶため、そのヘッダを明示的に許可する。
corsMw :: Middleware
corsMw = cors (const (Just policy))
  where
    policy = simpleCorsResourcePolicy {corsRequestHeaders = ["Content-Type"]}

-- | Scotty アプリ(CORS ミドルウェア + ルート)。
application :: ScottyM ()
application = middleware corsMw >> routes

-- | 指定ポートでサーバを起動する。
runServer :: Int -> IO ()
runServer port = scotty port application
