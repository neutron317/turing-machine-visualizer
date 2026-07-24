{-# LANGUAGE LambdaCase #-}
{-# LANGUAGE OverloadedStrings #-}

-- | データ契約(docs/contract.md)に対応する型と JSON 変換。
-- フロント・バックエンドが共有する唯一の基準であり、Zod スキーマ・fixture も
-- これに一致させる。ステップ実行の意味論そのものは後続の Machine.Step で扱う。
module Machine.Spec
  ( -- * 記号
    Symbol (..),

    -- * 機械 spec
    DFASpec (..),
    DFATrans (..),
    DTMSpec (..),
    DTMTrans (..),
    Move (..),

    -- * コンフィグ
    DFAConfig (..),
    DTMConfig (..),

    -- * ステップ結果
    Status (..),
    FiredDFA (..),
    FiredDTM (..),
    StepDFA (..),
    StepDTM (..),

    -- * fixture ラッパ
    Fixture (..),

    -- * ゴールデントレース
    Trace (..),
  )
where

import Data.Aeson
  ( FromJSON (..),
    ToJSON (..),
    Value (String),
    object,
    withObject,
    withText,
    (.:),
    (.:?),
    (.=),
  )
import qualified Data.Text as T

-- | 入力記号・テープ記号。契約では 1 文字の JSON 文字列。
-- テープの空白(blank)は @Maybe Symbol@ の @Nothing@(JSON では null)で表す。
newtype Symbol = Symbol {unSymbol :: Char}
  deriving (Eq, Ord, Show)

instance ToJSON Symbol where
  toJSON (Symbol c) = String (T.singleton c)

instance FromJSON Symbol where
  parseJSON = withText "Symbol" $ \t -> case T.unpack t of
    [c] -> pure (Symbol c)
    _ -> fail "記号は1文字の文字列である必要があります"

-- | ヘッドの移動方向。契約では "L" | "R"。
-- vendored の DTM.Move とは別に契約レイヤで独自定義し、変換は Adapt 層で行う
-- (vendored 型への orphan instance を避けるため)。
data Move = L | R
  deriving (Eq, Show)

instance ToJSON Move where
  toJSON L = String "L"
  toJSON R = String "R"

instance FromJSON Move where
  parseJSON = withText "Move" $ \case
    "L" -> pure L
    "R" -> pure R
    _ -> fail "move は \"L\" または \"R\" である必要があります"

-- | 実行の終了状態(running=継続中)。
data Status = Running | Accepted | Rejected
  deriving (Eq, Show)

instance ToJSON Status where
  toJSON Running = String "running"
  toJSON Accepted = String "accept"
  toJSON Rejected = String "reject"

instance FromJSON Status where
  parseJSON = withText "Status" $ \case
    "running" -> pure Running
    "accept" -> pure Accepted
    "reject" -> pure Rejected
    _ -> fail "status は running/accept/reject のいずれか"

-- | DFA の遷移 1 本。
data DFATrans = DFATrans
  { dfatFrom :: String,
    dfatRead :: Symbol,
    dfatTo :: String
  }
  deriving (Eq, Show)

instance ToJSON DFATrans where
  toJSON t = object ["from" .= dfatFrom t, "read" .= dfatRead t, "to" .= dfatTo t]

instance FromJSON DFATrans where
  parseJSON = withObject "DFATrans" $ \o ->
    DFATrans <$> o .: "from" <*> o .: "read" <*> o .: "to"

-- | DFA の定義。
data DFASpec = DFASpec
  { dfaStates :: [String],
    dfaAlphabet :: [Symbol],
    dfaStart :: String,
    dfaAccept :: [String],
    dfaTransitions :: [DFATrans]
  }
  deriving (Eq, Show)

instance ToJSON DFASpec where
  toJSON s =
    object
      [ "states" .= dfaStates s,
        "alphabet" .= dfaAlphabet s,
        "start" .= dfaStart s,
        "accept" .= dfaAccept s,
        "transitions" .= dfaTransitions s
      ]

instance FromJSON DFASpec where
  parseJSON = withObject "DFASpec" $ \o ->
    DFASpec
      <$> o .: "states"
      <*> o .: "alphabet"
      <*> o .: "start"
      <*> o .: "accept"
      <*> o .: "transitions"

-- | DTM の遷移 1 本。read/write は Nothing=blank(JSON null)。
data DTMTrans = DTMTrans
  { dtmtFrom :: String,
    dtmtRead :: Maybe Symbol,
    dtmtTo :: String,
    dtmtWrite :: Maybe Symbol,
    dtmtMove :: Move
  }
  deriving (Eq, Show)

instance ToJSON DTMTrans where
  toJSON t =
    object
      [ "from" .= dtmtFrom t,
        "read" .= dtmtRead t,
        "to" .= dtmtTo t,
        "write" .= dtmtWrite t,
        "move" .= dtmtMove t
      ]

instance FromJSON DTMTrans where
  parseJSON = withObject "DTMTrans" $ \o ->
    DTMTrans
      <$> o .: "from"
      <*> o .: "read"
      <*> o .: "to"
      <*> o .: "write"
      <*> o .: "move"

-- | DTM の定義。
data DTMSpec = DTMSpec
  { dtmStates :: [String],
    dtmTapeAlphabet :: [Symbol],
    dtmStart :: String,
    dtmAccept :: [String],
    dtmTransitions :: [DTMTrans]
  }
  deriving (Eq, Show)

instance ToJSON DTMSpec where
  toJSON s =
    object
      [ "states" .= dtmStates s,
        "tapeAlphabet" .= dtmTapeAlphabet s,
        "start" .= dtmStart s,
        "accept" .= dtmAccept s,
        "transitions" .= dtmTransitions s
      ]

instance FromJSON DTMSpec where
  parseJSON = withObject "DTMSpec" $ \o ->
    DTMSpec
      <$> o .: "states"
      <*> o .: "tapeAlphabet"
      <*> o .: "start"
      <*> o .: "accept"
      <*> o .: "transitions"

-- | DFA のコンフィグ。rest = まだ読んでいない残り入力(先頭が次に読む記号)。
data DFAConfig = DFAConfig
  { dcState :: String,
    dcRest :: [Symbol]
  }
  deriving (Eq, Show)

instance ToJSON DFAConfig where
  toJSON c = object ["state" .= dcState c, "rest" .= dcRest c]

instance FromJSON DFAConfig where
  parseJSON = withObject "DFAConfig" $ \o ->
    DFAConfig <$> o .: "state" <*> o .: "rest"

-- | DTM のコンフィグ。テープは表示順(左→右)。
-- left の末尾がヘッド直左、right の先頭がヘッド直右。blank は null。
data DTMConfig = DTMConfig
  { tcState :: String,
    tcLeft :: [Maybe Symbol],
    tcHead :: Maybe Symbol,
    tcRight :: [Maybe Symbol]
  }
  deriving (Eq, Show)

instance ToJSON DTMConfig where
  toJSON c =
    object
      [ "state" .= tcState c,
        "left" .= tcLeft c,
        "head" .= tcHead c,
        "right" .= tcRight c
      ]

instance FromJSON DTMConfig where
  parseJSON = withObject "DTMConfig" $ \o ->
    DTMConfig
      <$> o .: "state"
      <*> o .: "left"
      <*> o .: "head"
      <*> o .: "right"

-- | 発火した DFA 遷移。
data FiredDFA = FiredDFA
  { fdaFrom :: String,
    fdaRead :: Symbol,
    fdaTo :: String
  }
  deriving (Eq, Show)

instance ToJSON FiredDFA where
  toJSON f = object ["from" .= fdaFrom f, "read" .= fdaRead f, "to" .= fdaTo f]

instance FromJSON FiredDFA where
  parseJSON = withObject "FiredDFA" $ \o ->
    FiredDFA <$> o .: "from" <*> o .: "read" <*> o .: "to"

-- | 発火した DTM 遷移。
data FiredDTM = FiredDTM
  { fdtFrom :: String,
    fdtRead :: Maybe Symbol,
    fdtTo :: String,
    fdtWrite :: Maybe Symbol,
    fdtMove :: Move
  }
  deriving (Eq, Show)

instance ToJSON FiredDTM where
  toJSON f =
    object
      [ "from" .= fdtFrom f,
        "read" .= fdtRead f,
        "to" .= fdtTo f,
        "write" .= fdtWrite f,
        "move" .= fdtMove f
      ]

instance FromJSON FiredDTM where
  parseJSON = withObject "FiredDTM" $ \o ->
    FiredDTM
      <$> o .: "from"
      <*> o .: "read"
      <*> o .: "to"
      <*> o .: "write"
      <*> o .: "move"

-- | DFA の 1 ステップ応答。terminal 時は fired=Nothing。
data StepDFA = StepDFA
  { sdaStatus :: Status,
    sdaConfig :: DFAConfig,
    sdaFired :: Maybe FiredDFA
  }
  deriving (Eq, Show)

instance ToJSON StepDFA where
  toJSON r =
    object
      [ "status" .= sdaStatus r,
        "config" .= sdaConfig r,
        "fired" .= sdaFired r
      ]

instance FromJSON StepDFA where
  parseJSON = withObject "StepDFA" $ \o ->
    StepDFA <$> o .: "status" <*> o .: "config" <*> o .: "fired"

-- | DTM の 1 ステップ応答。terminal 時は fired=Nothing。
data StepDTM = StepDTM
  { sdtStatus :: Status,
    sdtConfig :: DTMConfig,
    sdtFired :: Maybe FiredDTM
  }
  deriving (Eq, Show)

instance ToJSON StepDTM where
  toJSON r =
    object
      [ "status" .= sdtStatus r,
        "config" .= sdtConfig r,
        "fired" .= sdtFired r
      ]

instance FromJSON StepDTM where
  parseJSON = withObject "StepDTM" $ \o ->
    StepDTM <$> o .: "status" <*> o .: "config" <*> o .: "fired"

-- | fixture ファイル @{kind, name, description, machine}@ から機械定義を取り出す。
-- @/step@ に渡すのは machine のみ。kind はフロントの振り分け用。
data Fixture a = Fixture
  { fixtureKind :: String,
    fixtureName :: String,
    fixtureDescription :: String,
    fixtureMachine :: a
  }
  deriving (Eq, Show)

instance (FromJSON a) => FromJSON (Fixture a) where
  parseJSON = withObject "Fixture" $ \o ->
    Fixture
      <$> o .: "kind"
      <*> o .: "name"
      <*> o .: "description"
      <*> o .: "machine"

-- | ゴールデントレース(docs/contract.md §6)。初期コンフィグと @/step@ 応答の列を
-- 記録し、エンジン実装がこれを再現できることをテストで確認する。
-- @cfg@ は 'DFAConfig' / 'DTMConfig'、@step@ は 'StepDFA' / 'StepDTM'。
-- @note@ は任意メモ(null または欠落で 'Nothing')。
data Trace cfg step = Trace
  { traceKind :: String,
    traceMachine :: String,
    traceInput :: String,
    traceNote :: Maybe String,
    traceInitial :: cfg,
    traceSteps :: [step]
  }
  deriving (Eq, Show)

instance (ToJSON cfg, ToJSON step) => ToJSON (Trace cfg step) where
  toJSON t =
    object $
      [ "kind" .= traceKind t,
        "machine" .= traceMachine t,
        "input" .= traceInput t
      ]
        ++ maybe [] (\n -> ["note" .= n]) (traceNote t)
        ++ [ "initial" .= traceInitial t,
             "steps" .= traceSteps t
           ]

instance (FromJSON cfg, FromJSON step) => FromJSON (Trace cfg step) where
  parseJSON = withObject "Trace" $ \o ->
    Trace
      <$> o .: "kind"
      <*> o .: "machine"
      <*> o .: "input"
      <*> o .:? "note"
      <*> o .: "initial"
      <*> o .: "steps"
