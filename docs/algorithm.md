# Pixel Snapper 変換アルゴリズム解説

## このツールが解決する問題

AI で生成されたピクセルアートには共通の欠陥がある。本来ピクセルアートは「全てのドットが均一なグリッドに乗っている」ことが前提だが、AI が出力した画像はドットの大きさや位置が微妙にずれており、そのままではゲームエンジンや他のピクセルアートツールで扱えない。

このツールは、そうした「グリッドが崩れたピクセルアート風の画像」を入力として受け取り、正確なグリッドに揃った本物のピクセルアートに変換する。

変換は以下の 6 つのステージで順番に実行される。

---

## Stage 1: 色の量子化（Color Quantization）

### 前提知識

**量子化（Quantization）とは:**
連続的な値や大量の離散値を、より少ない代表値に丸める処理の総称。ここでは「何万色もある画像を 16 色に減らす」という意味で使われている。

**RGB 色空間:**
色を赤（R）・緑（G）・青（B）の 3 成分で表現する方法。各成分は 0〜255 の整数値をとる。1 ピクセルの色は `[R, G, B]` の 3 次元の点として扱える。例えば純粋な赤は `[255, 0, 0]`。

**アルファチャンネル（Alpha Channel）:**
色の透明度を表す 4 番目の成分。0 が完全透明、255 が完全不透明。RGBA の A がこれに当たる。透明ピクセルには「色」という概念がないため、量子化の対象から除外する。

**アンチエイリアス（Anti-aliasing）:**
図形の輪郭のギザギザ（ジャギー）を目立たなくするために、境界部分に中間色のピクセルを挿入する技法。AI 画像生成では意図せずこれが発生し、本来 2 色で済むはずの境界に数十種類の中間色が生まれる。

**クラスタリング（Clustering）:**
データの集合を、似ているもの同士のグループ（クラスタ）に分ける手法の総称。ここでは色をグループ分けする。

**k-means 法:**
クラスタリング手法の一つ。以下を繰り返す:
1. 各データ点を、最も近い代表点（セントロイド）に割り当てる
2. 各クラスタに属するデータ点の平均を新しいセントロイドにする

「最も近い」は RGB 空間上のユークリッド距離（色の差）で測る。繰り返すうちにセントロイドが動かなくなり、安定する（収束）。

**k-means++ 初期化:**
k-means 法の弱点は「最初のセントロイドの選び方で結果が大きく変わる」こと。k-means++ は、すでに選んだセントロイドから**遠いデータ点ほど高い確率で次のセントロイドに選ばれる**ように重み付き抽選を行う初期化法。これにより、色空間上でまんべんなく散らばった初期セントロイドが得られ、結果が安定する。

**セントロイド（Centroid）:**
クラスタの「重心」。そのクラスタに属する全データ点の平均座標。色の量子化では「代表色」に当たる。

**収束（Convergence）:**
繰り返し処理においてセントロイドの移動量が十分小さくなり、それ以上繰り返しても結果がほぼ変わらない状態。このコードでは移動量 < 0.01 で収束と判定している。

---

**目的:** 画像に含まれる色の数を減らし、後続の処理を安定させる。

**なぜ必要か:**
AI が生成した画像には、アンチエイリアスやグラデーションにより、本来同じ色であるべき隣接ピクセルが微妙に異なる色になっている。例えば「赤いドット」が純粋な赤ではなく、暗い赤・明るい赤・オレンジがかった赤など数十種類に分散している。この状態のままグリッドの境界を検出しようとすると、本来存在しないエッジを大量に拾ってしまう。

**何をしているか:**

k-means++ クラスタリングで、画像内の全色を指定数（デフォルト 16 色）に集約する。

1. 不透明ピクセルだけを対象に RGB 値を収集する
2. k-means++ 初期化で、なるべく離れた色を初期代表色として選ぶ
3. 各ピクセルを最も近い代表色に割り当て → 代表色を所属ピクセルの平均に更新、を最大 15 回繰り返す
4. 代表色の移動量が十分小さくなったら（< 0.01）早期終了する
5. 全ピクセルを最も近い代表色に置き換えた新しい画像を返す

透明ピクセル（alpha = 0）はそのまま保持される。

> **対応コード:** `src/main.rs` L227-365 `quantize_image()`

---

## Stage 2: エッジプロファイル計算（Profile Computation）

### 前提知識

**グレースケール（Grayscale）:**
カラー画像を白黒の濃淡だけで表現したもの。RGB の 3 値を 1 つの輝度値に変換する。

**輝度の重み係数（0.299R + 0.587G + 0.114B）:**
人間の目は緑に最も敏感で、青には鈍い。この知覚特性を反映した標準的な重み（ITU-R BT.601 規格）。単純に `(R+G+B)/3` とするより自然な明るさになる。

**勾配（Gradient）:**
ある位置での値の変化率。画像処理では「隣接ピクセル間の明るさの差」を指す。勾配が大きい = そこで色が急に変わっている = エッジがある、と判断できる。

**カーネル `[-1, 0, 1]`:**
勾配を計算するための小さなフィルタ。あるピクセルの左隣の値に -1、右隣に +1 を掛けて足し合わせると `右 - 左` になり、水平方向の色の変化量が得られる。中央の 0 は自分自身を無視することを意味する。これは画像処理における最も単純なエッジ検出フィルタの一つ（Prewitt や Sobel の簡略版）。

**プロファイル（Profile）/ 射影（Projection）:**
2 次元の画像データを 1 次元に集約したもの。ここでは「ある列の全行にわたる勾配の合計」を計算することで、画像全体を 1 本の数値配列に畳み込む。グリッドの境界線がある列では多くの行でエッジが検出されるため、合計値が突出して高くなる。

**エッジ検出（Edge Detection）:**
画像中の物体の輪郭や境界を見つける処理の総称。このステージでは、隣接ピクセル間の輝度差を取るだけの最もシンプルな手法を使っている。

---

**目的:** 画像の中で「色が急に変わる縦線・横線」がどこにあるかを数値化する。

**なぜ必要か:**
ピクセルアートのグリッド線上では必ず色が切り替わる。つまり「色の変化が集中している列・行」を見つければ、それがグリッドの境界だとわかる。

**何をしているか:**

画像を走査して、各列・各行ごとの「色の変化の強さ」を合計した 1 次元の配列（プロファイル）を作る。

1. 各ピクセルをグレースケール値に変換する（0.299R + 0.587G + 0.114B）
2. **列プロファイル（縦の切れ目の検出）:** 各ピクセルについて、左隣と右隣のグレースケール値の差（水平勾配）を計算し、その絶対値をその列に加算する
3. **行プロファイル（横の切れ目の検出）:** 同様に、上と下のグレースケール値の差（垂直勾配）を計算し、その絶対値をその行に加算する

結果として「列プロファイル」と「行プロファイル」という 2 本の数値配列が得られる。値が大きい位置ほど、そこにグリッドの境界がある可能性が高い。

> **対応コード:** `src/main.rs` L367-407 `compute_profiles()`

---

## Stage 3: グリッド間隔の推定（Step Size Estimation）

### 前提知識

**ピーク検出（Peak Detection）:**
1 次元の数値配列から「山」（周囲より値が高い点）を見つける処理。このコードでは「前後の値より大きい」という単純な条件で局所最大値を検出している。

**局所最大値（Local Maximum）:**
直前と直後の値より大きい点。プロファイル上の局所最大値は、グリッドの境界線の候補に対応する。

**閾値（Threshold）:**
「この値以上なら有効、未満ならノイズとして無視」という判定の境界値。ここではプロファイルの最大値の 20% を閾値とし、小さすぎるピークを除外している。

**中央値（Median）と平均値（Mean）の違い:**
5 つの値 `[8, 8, 9, 8, 30]` があるとき、平均値は 12.6、中央値は 8。平均値は外れ値（ここでは 30）に引っ張られるが、中央値は影響を受けない。グリッド間隔の推定では、画像端やスプライトの区切り目で異常に大きい間隔が混ざることがあるため、外れ値に強い中央値を採用している。

**外れ値（Outlier）:**
他の大多数のデータから大きく外れた値。統計的な推定を歪める原因になるため、中央値のようなロバスト（頑健）な指標を使って影響を抑える。

---

**目的:** グリッド 1 マスの幅（ピクセル数）を自動推定する。

**なぜ必要か:**
入力画像のグリッドサイズは事前にわからない。8x8 かもしれないし 16x16 かもしれない。正しいグリッドで切り分けるには、まず 1 マスの大きさを知る必要がある。

**何をしているか:**

Stage 2 で得たプロファイルのピーク（山）を見つけ、ピーク間の間隔からグリッド幅を割り出す。

1. プロファイルの最大値の 20% を閾値とし、それを超える局所的な山（前後の値より大きい点）をピークとして抽出する
2. 近すぎるピーク（4px 未満の間隔）を除去する。これはノイズの誤検出を防ぐため
3. 隣接ピーク間の間隔を全て計算する
4. それらの間隔の**中央値**をグリッド幅として返す。平均値ではなく中央値を使うのは、外れ値（画像端やスプライト境界など）の影響を抑えるため

列プロファイルと行プロファイルそれぞれに対してこの処理を行い、X 方向・Y 方向のグリッド幅を推定する。

> **対応コード:** `src/main.rs` L409-451 `estimate_step_size()`

---

## Stage 4: グリッド間隔の統合（Step Size Resolution）

### 前提知識

**正方グリッド（Square Grid）の仮定:**
ピクセルアートのドットは通常、縦横同じサイズの正方形マスに並ぶ。この仮定に基づき、X 方向と Y 方向のグリッド幅は最終的に同じ値に揃える。

**ステップ比率（Step Ratio）:**
X 方向と Y 方向のグリッド幅の比。例えば X=10px, Y=8px なら比率は 1.25。この値が大きすぎる場合（1.8 倍超）、片方の推定が誤っている可能性が高い。

**フォールバック（Fallback）:**
本来の手段が失敗したときの代替手段。ここでは両軸ともピーク検出に失敗した場合に、画像サイズから機械的に算出した値（短辺 / 64）で代用する。64 分割という値は、一般的なピクセルアートのグリッドサイズ（8〜64px）に対して妥当な初期推定となるように選ばれている。

---

**目的:** X 方向と Y 方向で別々に推定されたグリッド幅を、一つの整合性のある値に統合する。

**なぜ必要か:**
ピクセルアートのグリッドは通常正方形（縦横同じ幅）だが、Stage 3 の推定では X と Y で異なる値が出ることがある。また、片方の軸でピークが見つからない場合もある。これらのケースを適切に処理する必要がある。

**何をしているか:**

4 つのケースに分けて処理する:

| ケース | 処理 |
|---|---|
| X・Y 両方推定できた & 比率が 1.8 倍以内 | 両者の平均値を両軸に使う |
| X・Y 両方推定できた & 比率が 1.8 倍を超える | 小さい方の値を両軸に使う（大きい方は誤推定と見なす） |
| 片方だけ推定できた | 推定できた方の値を両軸に使う |
| 両方推定できなかった | フォールバック値（画像の短辺 / 64）を使う |

> **対応コード:** `src/main.rs` L453-482 `resolve_step_sizes()`

---

## Stage 5: グリッド線の決定 — Elastic Walker

### 前提知識

**スナップ（Snapping）:**
ある値を近くの「きりのいい値」に吸着させる操作。グラフィックツールで図形をグリッドに吸着させる動作と同じ概念。ここでは、等間隔の理想位置を近くの実際のエッジ位置に吸着させている。

**探索窓（Search Window）:**
目標位置の前後に設ける探索範囲。グリッド幅の 35% を半径とする区間内で最もエッジの強い位置を探す。窓が広すぎるとグリッド 1 マス分ずれるリスクがあり、狭すぎるとエッジを捉えられない。35% はこのトレードオフのバランスを取った値。

**貪欲法（Greedy Algorithm）:**
各ステップで「その時点で最善の選択」を行い、後戻りしない手法。Elastic Walker は左端から右に向かって 1 つずつカット位置を決めていき、一度決めた位置を変更しない。全体最適ではなく局所最適だが、計算が速く、グリッド検出には十分な精度が得られる。

**安定化（Stabilization）:**
Elastic Walker の結果を後処理で修正する工程。2 つの問題を検出・修正する:
- **カット数の不足:** ピーク検出に失敗した軸でカット数が極端に少ない場合、もう片方の軸の情報を使って補完する
- **軸間の不整合:** X と Y でセル幅が大きくずれている場合（例: X が 10px なのに Y が 25px）、小さい方に合わせて大きい方を均一に再分割する

**相互検証（Cross-Validation）:**
ここでは X 軸と Y 軸の結果を互いに照合し、片方の推定が明らかにおかしい場合にもう片方の結果で補正する仕組みを指す。

---

**目的:** 画像を実際にどのピクセル位置で切るか（カット位置）を決定する。

**なぜ必要か:**
Stage 4 で得たグリッド幅はあくまで「平均的な間隔」であり、画像上の全てのグリッド線が等間隔に並んでいるとは限らない。AI 生成画像ではドットの位置が揺らいでいるため、グリッド線の位置も多少ずれている。機械的に等間隔で切ると、ドットの途中で切ってしまう可能性がある。

**何をしているか:**

「Elastic Walker（弾力的な歩行者）」と呼ばれるアルゴリズムで、等間隔を基準にしつつ、実際のエッジに合わせてカット位置を微調整する。

1. 位置 0 からスタートし、グリッド幅ぶん先を「目標位置」とする
2. 目標位置を中心に、グリッド幅の 35%（最低 2px）の範囲を「探索窓」とする
3. 探索窓内で Stage 2 のプロファイル値が最も高い位置を見つける
4. その値がプロファイル全体の平均の 50% を超えていれば、そこにカットを置く（エッジにスナップ）
5. 超えていなければ、目標位置そのままにカットを置く（等間隔にフォールバック）
6. カット位置を新たな現在位置として、次の目標位置へ進む。画像の端に達するまで繰り返す

この後、2 パスの安定化処理が行われる:

- **パス 1（軸ごとの安定化）:** 各軸のカット数が少なすぎる場合や、X と Y のステップ比率が歪んでいる場合に、もう片方の軸のステップサイズを基準にして均一カットをやり直す
- **パス 2（軸間の相互検証）:** パス 1 の結果で X と Y のセル幅を比較し、まだ 1.8 倍以上の差がある場合は、小さい方のセル幅に合わせて大きい方を均一カットで再生成する

> **対応コード:**
> - `src/main.rs` L557-603 `walk()`（Elastic Walker 本体）
> - `src/main.rs` L484-553 `stabilize_both_axes()`（2 パス安定化）
> - `src/main.rs` L605-649 `stabilize_cuts()`（軸ごとの安定化）
> - `src/main.rs` L683-762 `snap_uniform_cuts()`（均一カットの再生成）

---

## Stage 6: リサンプリング（Resampling）

### 前提知識

**リサンプリング（Resampling）:**
画像の解像度を変更する処理の総称。解像度を下げる場合はダウンサンプリングとも呼ぶ。一般的な画像縮小では双線形補間（周囲のピクセルを加重平均する手法）などが使われるが、ピクセルアートでは中間色が生まれると困るため、ここでは多数決という別の方法を取る。

**多数決投票（Majority Voting）:**
複数の候補から「最も票が多いもの」を選ぶ方法。グリッドセル内に赤が 60 個、青が 30 個、緑が 10 個あれば、そのセルの色は赤になる。平均を取ると中間色が生まれてしまうが、多数決なら元の色がそのまま残る。これはピクセルアートにとって重要な性質で、エッジがぼやけずシャープに保たれる。

**決定論的（Deterministic）:**
同じ入力に対して常に同じ出力を返すこと。多数決で同票になった場合、このコードでは RGBA 値を辞書順（[0,0,0,255] < [255,0,0,255] のように数値の小さい方が先）で比較して一意に選ぶ。ランダムに選ぶと実行のたびに結果が変わるが、辞書順なら常に同じ結果になる。

**ダウンサンプリング（Downsampling）:**
画像の解像度を下げること。例えば 256x256 の画像を 32x32 にする場合、元の 8x8 ピクセルの領域を 1 ピクセルにまとめる。このステージでは、不均一なグリッドセルごとに 1 ピクセルにまとめるため、厳密には均等なダウンサンプリングではないが、概念としては同じ。

---

**目的:** Stage 5 で決まったグリッドに基づいて、各セルを 1 ピクセルに集約し、最終的なピクセルアート画像を出力する。

**なぜ必要か:**
ここまでの処理で「画像をどこで切るか」は決まったが、まだ元画像のサイズのままである。各グリッドセル内には複数のピクセルが含まれており、これを 1 ピクセルに集約する必要がある。

**何をしているか:**

各グリッドセルに対して**多数決投票**を行い、セル内で最も多く出現する色を代表色にする。

1. 出力画像のサイズを「(列カット数 - 1) x (行カット数 - 1)」に設定する。各セルが 1 ピクセルになる
2. 各セルについて、セル内に含まれる全ピクセルの色を集計する
3. 最も出現回数が多い色をそのセルの代表色にする
4. 同数の場合は RGBA 値の辞書順（小さい方）で決定論的に選ぶ

例えば 16x16 ピクセルの元画像が 32x32 のグリッドで区切られていた場合、出力は 16x16 ピクセルの画像になる。各セルの中で最も多かった色がそのまま 1 ドットになる。

> **対応コード:** `src/main.rs` L764-817 `resample()`

---

## 全体の処理フロー

```
入力画像（AI生成のピクセルアート風画像）
  │
  ▼
[Stage 1] 色の量子化 ─── 色数を16色に削減し、微妙な色のばらつきを除去
  │
  ▼
[Stage 2] エッジプロファイル計算 ─── 縦・横方向の「色の変化の強さ」を列/行ごとに集計
  │
  ▼
[Stage 3] グリッド間隔の推定 ─── プロファイルのピーク間隔から1マスの幅を推定
  │
  ▼
[Stage 4] グリッド間隔の統合 ─── X/Y軸の推定値を統合し、正方形グリッドに揃える
  │
  ▼
[Stage 5] グリッド線の決定 ─── Elastic Walkerで実際のエッジに合わせてカット位置を確定
  │
  ▼
[Stage 6] リサンプリング ─── 各グリッドセル内の多数決で1ドットに集約
  │
  ▼
出力画像（正確なグリッドに揃ったピクセルアート）
```

## 実際のコード

```rust
use image::{GenericImageView, ImageBuffer, Rgba, RgbaImage};
use rand::prelude::*;
use rand::SeedableRng;
use rand_chacha::ChaCha8Rng;
use rand_distr::{Distribution, WeightedIndex};
use std::cmp::Ordering;
use std::collections::HashMap;
#[cfg(not(target_arch = "wasm32"))]
use std::env;
use std::error::Error;
use std::fmt;

#[cfg(target_arch = "wasm32")]
use wasm_bindgen::prelude::*;

#[derive(Debug, Clone)]
#[cfg_attr(target_arch = "wasm32", wasm_bindgen)]
pub struct Config {
    pub k_colors: usize,
    k_seed: u64,
    /// Input image path only used for CLI use
    #[allow(dead_code)]
    input_path: String,
    /// Output image path only used for CLI use
    #[allow(dead_code)]
    output_path: String,
    max_kmeans_iterations: usize,
    peak_threshold_multiplier: f64,
    peak_distance_filter: usize,
    walker_search_window_ratio: f64,
    walker_min_search_window: f64,
    walker_strength_threshold: f64,
    min_cuts_per_axis: usize,
    fallback_target_segments: usize,
    max_step_ratio: f64,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            k_colors: 16,
            k_seed: 42,
            input_path: "samples/2/skeleton.png".to_string(),
            output_path: "samples/2/skeleton_fixed_clean2.png".to_string(),
            max_kmeans_iterations: 15,
            peak_threshold_multiplier: 0.2,
            peak_distance_filter: 4,
            walker_search_window_ratio: 0.35,
            walker_min_search_window: 2.0,
            walker_strength_threshold: 0.5,
            min_cuts_per_axis: 4,
            fallback_target_segments: 64,
            max_step_ratio: 1.8, // Lowered from 3.0 to catch more skew cases
        }
    }
}

#[derive(Debug)]
pub enum PixelSnapperError {
    ImageError(image::ImageError),
    InvalidInput(String),
    ProcessingError(String),
}

impl fmt::Display for PixelSnapperError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            PixelSnapperError::ImageError(e) => write!(f, "Image error: {}", e),
            PixelSnapperError::InvalidInput(msg) => write!(f, "Invalid input: {}", msg),
            PixelSnapperError::ProcessingError(msg) => write!(f, "Processing error: {}", msg),
        }
    }
}

impl Error for PixelSnapperError {}

impl From<image::ImageError> for PixelSnapperError {
    fn from(error: image::ImageError) -> Self {
        PixelSnapperError::ImageError(error)
    }
}

#[cfg(target_arch = "wasm32")]
impl From<PixelSnapperError> for wasm_bindgen::JsValue {
    fn from(err: PixelSnapperError) -> wasm_bindgen::JsValue {
        wasm_bindgen::JsValue::from_str(&err.to_string())
    }
}

type Result<T> = std::result::Result<T, PixelSnapperError>;

/// CLI entry point
#[cfg(not(target_arch = "wasm32"))]
#[allow(dead_code)]
fn main() -> Result<()> {
    let config = parse_args().unwrap_or_default();
    process_image(&config)
}

fn process_image_bytes_common(input_bytes: &[u8], config: Option<Config>) -> Result<Vec<u8>> {
    let config = config.unwrap_or_default();

    let img = image::load_from_memory(input_bytes)?;
    let (width, height) = img.dimensions();

    validate_image_dimensions(width, height)?;

    let rgba_img = img.to_rgba8();

    let quantized_img = quantize_image(&rgba_img, &config)?;
    let (profile_x, profile_y) = compute_profiles(&quantized_img)?;

    // Estimate step sizes
    let step_x_opt = estimate_step_size(&profile_x, &config);
    let step_y_opt = estimate_step_size(&profile_y, &config);

    // Resolve step sizes. Some instabilities so use sibling axis if one fails, or fallback if both fail
    let (step_x, step_y) = resolve_step_sizes(step_x_opt, step_y_opt, width, height, &config);

    let raw_col_cuts = walk(&profile_x, step_x, width as usize, &config)?;
    let raw_row_cuts = walk(&profile_y, step_y, height as usize, &config)?;

    // Two-pass stabilization: first pass with raw cuts, then cross-validate
    let (col_cuts, row_cuts) = stabilize_both_axes(
        &profile_x,
        &profile_y,
        raw_col_cuts,
        raw_row_cuts,
        width as usize,
        height as usize,
        &config,
    );

    let output_img = resample(&quantized_img, &col_cuts, &row_cuts)?;

    // Returns bytes for both implementations
    let mut output_bytes = Vec::new();
    let mut cursor = std::io::Cursor::new(&mut output_bytes);
    output_img
        .write_to(&mut cursor, image::ImageFormat::Png)
        .map_err(|e| PixelSnapperError::ImageError(e))?;

    Ok(output_bytes)
}

/// WASM entry point
#[cfg(target_arch = "wasm32")]
#[wasm_bindgen]
pub fn process_image(
    input_bytes: &[u8],
    k_colors: Option<u32>,
) -> std::result::Result<Vec<u8>, wasm_bindgen::JsValue> {
    let mut config = Config::default();
    if let Some(k) = k_colors {
        if k == 0 {
            return Err(wasm_bindgen::JsValue::from_str(
                "k_colors must be greater than 0",
            ));
        }
        config.k_colors = k as usize;
    }

    process_image_bytes_common(input_bytes, Some(config))
        .map_err(|e| wasm_bindgen::JsValue::from(e))
}

#[cfg(not(target_arch = "wasm32"))]
#[allow(dead_code)]
fn parse_args() -> Option<Config> {
    let args: Vec<String> = env::args().collect();
    if args.len() < 3 {
        return None;
    }

    let mut config = Config {
        input_path: args[1].clone(),
        output_path: args[2].clone(),
        ..Default::default()
    };

    if let Some(k_arg) = args.get(3) {
        match k_arg.parse::<usize>() {
            Ok(k) if k > 0 => config.k_colors = k,
            _ => eprintln!(
                "Warning: invalid k_colors '{}', falling back to default ({})",
                k_arg, config.k_colors
            ),
        }
    }

    Some(config)
}

#[cfg(not(target_arch = "wasm32"))]
#[allow(dead_code)]
fn process_image(config: &Config) -> Result<()> {
    println!("Processing: {}", config.input_path);

    let img_bytes = std::fs::read(&config.input_path).map_err(|e| {
        PixelSnapperError::ProcessingError(format!("Failed to read input file: {}", e))
    })?;

    let output_bytes = process_image_bytes_common(&img_bytes, Some(config.clone()))?;

    std::fs::write(&config.output_path, output_bytes).map_err(|e| {
        PixelSnapperError::ProcessingError(format!("Failed to write output file: {}", e))
    })?;

    println!("Saved to: {}", config.output_path);
    Ok(())
}

fn validate_image_dimensions(width: u32, height: u32) -> Result<()> {
    if width == 0 || height == 0 {
        return Err(PixelSnapperError::InvalidInput(
            "Image dimensions cannot be zero".to_string(),
        ));
    }
    if width > 10000 || height > 10000 {
        return Err(PixelSnapperError::InvalidInput(
            "Image dimensions too large (max 10000x10000)".to_string(),
        ));
    }
    Ok(())
}

fn quantize_image(img: &RgbaImage, config: &Config) -> Result<RgbaImage> {
    if config.k_colors == 0 {
        return Err(PixelSnapperError::InvalidInput(
            "Number of colors must be greater than 0".to_string(),
        ));
    }

    let opaque_pixels: Vec<[f32; 3]> = img
        .pixels()
        .filter_map(|p| {
            if p[3] == 0 {
                None
            } else {
                Some([p[0] as f32, p[1] as f32, p[2] as f32])
            }
        })
        .collect();
    let n_pixels = opaque_pixels.len();
    if n_pixels == 0 {
        return Ok(img.clone());
    }

    let mut rng = ChaCha8Rng::seed_from_u64(config.k_seed);
    let k = config.k_colors.min(n_pixels);

    fn sample_index(rng: &mut ChaCha8Rng, upper: usize) -> usize {
        debug_assert!(upper > 0);
        let upper = upper as u64;
        rng.gen_range(0..upper) as usize
    }

    fn dist_sq(p: &[f32; 3], c: &[f32; 3]) -> f32 {
        let dr = p[0] - c[0];
        let dg = p[1] - c[1];
        let db = p[2] - c[2];
        dr * dr + dg * dg + db * db
    }

    let mut centroids: Vec<[f32; 3]> = Vec::with_capacity(k);
    let first_idx = sample_index(&mut rng, n_pixels);
    centroids.push(opaque_pixels[first_idx]);
    let mut distances = vec![f32::MAX; n_pixels];

    // Maybe try a faster algorithm for this? like https://crates.io/crates/kmeans_colors
    for _ in 1..k {
        let last_c = centroids.last().unwrap();
        let mut sum_sq_dist = 0.0;

        for (i, p) in opaque_pixels.iter().enumerate() {
            let d_sq = dist_sq(p, last_c);
            if d_sq < distances[i] {
                distances[i] = d_sq;
            }
            sum_sq_dist += distances[i];
        }

        if sum_sq_dist <= 0.0 {
            let idx = sample_index(&mut rng, n_pixels);
            centroids.push(opaque_pixels[idx]);
        } else {
            let dist = WeightedIndex::new(&distances).map_err(|e| {
                PixelSnapperError::ProcessingError(format!("Failed to sample new centroid: {}", e))
            })?;
            let idx = dist.sample(&mut rng);
            centroids.push(opaque_pixels[idx]);
        }
    }

    let mut prev_centroids = centroids.clone();
    for iteration in 0..config.max_kmeans_iterations {
        let mut sums = vec![[0.0f32; 3]; k];
        let mut counts = vec![0usize; k];

        for p in &opaque_pixels {
            let mut min_dist = f32::MAX;
            let mut best_k = 0;

            for (i, c) in centroids.iter().enumerate() {
                let d = dist_sq(p, c);
                if d < min_dist {
                    min_dist = d;
                    best_k = i;
                }
            }
            sums[best_k][0] += p[0];
            sums[best_k][1] += p[1];
            sums[best_k][2] += p[2];
            counts[best_k] += 1;
        }

        for i in 0..k {
            if counts[i] > 0 {
                let fcount = counts[i] as f32;
                centroids[i] = [
                    sums[i][0] / fcount,
                    sums[i][1] / fcount,
                    sums[i][2] / fcount,
                ];
            }
        }

        if iteration > 0 {
            let mut max_movement = 0.0f32;
            for (new_c, old_c) in centroids.iter().zip(prev_centroids.iter()) {
                let movement = dist_sq(new_c, old_c);
                if movement > max_movement {
                    max_movement = movement;
                }
            }

            if max_movement < 0.01 {
                break;
            }
        }

        prev_centroids.copy_from_slice(&centroids);
    }

    let mut new_img = RgbaImage::new(img.width(), img.height());
    for (x, y, pixel) in img.enumerate_pixels() {
        if pixel[3] == 0 {
            new_img.put_pixel(x, y, *pixel);
            continue;
        }
        let p = [pixel[0] as f32, pixel[1] as f32, pixel[2] as f32];
        let mut min_dist = f32::MAX;
        let mut best_c = [pixel[0], pixel[1], pixel[2]];

        for c in &centroids {
            let d = dist_sq(&p, c);
            if d < min_dist {
                min_dist = d;
                best_c = [c[0].round() as u8, c[1].round() as u8, c[2].round() as u8];
            }
        }
        new_img.put_pixel(x, y, Rgba([best_c[0], best_c[1], best_c[2], pixel[3]]));
    }
    Ok(new_img)
}

fn compute_profiles(img: &RgbaImage) -> Result<(Vec<f64>, Vec<f64>)> {
    let (w, h) = img.dimensions();

    if w < 3 || h < 3 {
        return Err(PixelSnapperError::InvalidInput(
            "Image too small (minimum 3x3)".to_string(),
        ));
    }

    let mut col_proj = vec![0.0; w as usize];
    let mut row_proj = vec![0.0; h as usize];

    let gray = |x, y| {
        let p = img.get_pixel(x, y);
        if p[3] == 0 {
            0.0
        } else {
            0.299 * p[0] as f64 + 0.587 * p[1] as f64 + 0.114 * p[2] as f64
        }
    };

    // kernels: [-1, 0, 1]
    for y in 0..h {
        for x in 1..w - 1 {
            let left = gray(x - 1, y);
            let right = gray(x + 1, y);
            let grad = (right - left).abs();
            col_proj[x as usize] += grad;
        }
    }
    for x in 0..w {
        for y in 1..h - 1 {
            let top = gray(x, y - 1);
            let bottom = gray(x, y + 1);
            let grad = (bottom - top).abs();
            row_proj[y as usize] += grad;
        }
    }

    Ok((col_proj, row_proj))
}

fn estimate_step_size(profile: &[f64], config: &Config) -> Option<f64> {
    if profile.is_empty() {
        return None;
    }

    let max_val = profile.iter().cloned().fold(0.0 / 0.0, f64::max);
    if max_val == 0.0 {
        return None; // Decide later
    }
    let threshold = max_val * config.peak_threshold_multiplier;

    let mut peaks = Vec::new();
    for i in 1..profile.len() - 1 {
        if profile[i] > threshold && profile[i] > profile[i - 1] && profile[i] > profile[i + 1] {
            peaks.push(i);
        }
    }

    if peaks.len() < 2 {
        return None;
    }

    let mut clean_peaks = vec![peaks[0]];
    for &p in peaks.iter().skip(1) {
        if p - clean_peaks.last().unwrap() > (config.peak_distance_filter - 1) {
            clean_peaks.push(p);
        }
    }

    if clean_peaks.len() < 2 {
        return None;
    }

    // Compute diffs
    let mut diffs: Vec<f64> = clean_peaks
        .windows(2)
        .map(|w| (w[1] - w[0]) as f64)
        .collect();

    // Median
    diffs.sort_by(|a, b| a.partial_cmp(b).unwrap_or(Ordering::Equal));
    Some(diffs[diffs.len() / 2])
}

fn resolve_step_sizes(
    step_x_opt: Option<f64>,
    step_y_opt: Option<f64>,
    width: u32,
    height: u32,
    config: &Config,
) -> (f64, f64) {
    match (step_x_opt, step_y_opt) {
        (Some(sx), Some(sy)) => {
            let ratio = if sx > sy { sx / sy } else { sy / sx };
            if ratio > config.max_step_ratio {
                let smaller = sx.min(sy);
                (smaller, smaller)
            } else {
                let avg = (sx + sy) / 2.0;
                (avg, avg)
            }
        }

        (Some(sx), None) => (sx, sx),

        (None, Some(sy)) => (sy, sy),

        (None, None) => {
            let fallback_step =
                ((width.min(height) as f64) / config.fallback_target_segments as f64).max(1.0);
            (fallback_step, fallback_step)
        }
    }
}

fn stabilize_both_axes(
    profile_x: &[f64],
    profile_y: &[f64],
    raw_col_cuts: Vec<usize>,
    raw_row_cuts: Vec<usize>,
    width: usize,
    height: usize,
    config: &Config,
) -> (Vec<usize>, Vec<usize>) {
    let col_cuts_pass1 = stabilize_cuts(
        profile_x,
        raw_col_cuts.clone(),
        width,
        &raw_row_cuts,
        height,
        config,
    );
    let row_cuts_pass1 = stabilize_cuts(
        profile_y,
        raw_row_cuts.clone(),
        height,
        &raw_col_cuts,
        width,
        config,
    );

    // Check if the results are coherent
    let col_cells = col_cuts_pass1.len().saturating_sub(1).max(1);
    let row_cells = row_cuts_pass1.len().saturating_sub(1).max(1);
    let col_step = width as f64 / col_cells as f64;
    let row_step = height as f64 / row_cells as f64;

    let step_ratio = if col_step > row_step {
        col_step / row_step
    } else {
        row_step / col_step
    };

    if step_ratio > config.max_step_ratio {
        let target_step = col_step.min(row_step);

        let final_col_cuts = if col_step > target_step * 1.2 {
            snap_uniform_cuts(
                profile_x,
                width,
                target_step,
                config,
                config.min_cuts_per_axis,
            )
        } else {
            col_cuts_pass1
        };

        let final_row_cuts = if row_step > target_step * 1.2 {
            snap_uniform_cuts(
                profile_y,
                height,
                target_step,
                config,
                config.min_cuts_per_axis,
            )
        } else {
            row_cuts_pass1
        };

        (final_col_cuts, final_row_cuts)
    } else {
        (col_cuts_pass1, row_cuts_pass1)
    }
}

// Tried uniform grid instead of an elastic-ish walker, but the result was a bit worse.
// Keeping the walker for now. But some distortions might happen...
fn walk(profile: &[f64], step_size: f64, limit: usize, config: &Config) -> Result<Vec<usize>> {
    if profile.is_empty() {
        return Err(PixelSnapperError::ProcessingError(
            "Cannot walk on empty profile".to_string(),
        ));
    }

    let mut cuts = vec![0];
    let mut current_pos = 0.0;
    let search_window =
        (step_size * config.walker_search_window_ratio).max(config.walker_min_search_window);
    let mean_val: f64 = profile.iter().sum::<f64>() / profile.len() as f64;

    while current_pos < limit as f64 {
        let target = current_pos + step_size;
        if target >= limit as f64 {
            cuts.push(limit);
            break;
        }

        let start_search = ((target - search_window) as usize).max((current_pos + 1.0) as usize);
        let end_search = ((target + search_window) as usize).min(limit);

        if end_search <= start_search {
            current_pos = target;
            continue;
        }

        let mut max_val = -1.0;
        let mut max_idx = start_search;
        for i in start_search..end_search {
            if profile[i] > max_val {
                max_val = profile[i];
                max_idx = i;
            }
        }

        if max_val > mean_val * config.walker_strength_threshold {
            cuts.push(max_idx);
            current_pos = max_idx as f64;
        } else {
            cuts.push(target as usize);
            current_pos = target;
        }
    }
    Ok(cuts)
}

fn stabilize_cuts(
    profile: &[f64],
    cuts: Vec<usize>,
    limit: usize,
    sibling_cuts: &[usize],
    sibling_limit: usize,
    config: &Config,
) -> Vec<usize> {
    if limit == 0 {
        return vec![0];
    }

    let cuts = sanitize_cuts(cuts, limit);
    let min_required = config.min_cuts_per_axis.max(2).min(limit.saturating_add(1));
    let axis_cells = cuts.len().saturating_sub(1);
    let sibling_cells = sibling_cuts.len().saturating_sub(1);
    let sibling_has_grid =
        sibling_limit > 0 && sibling_cells >= min_required.saturating_sub(1) && sibling_cells > 0;
    let steps_skewed = sibling_has_grid && axis_cells > 0 && {
        let axis_step = limit as f64 / axis_cells as f64;
        let sibling_step = sibling_limit as f64 / sibling_cells as f64;
        let step_ratio = axis_step / sibling_step;
        step_ratio > config.max_step_ratio || step_ratio < 1.0 / config.max_step_ratio
    };
    let has_enough = cuts.len() >= min_required;

    if has_enough && !steps_skewed {
        return cuts;
    }

    let mut target_step = if sibling_has_grid {
        sibling_limit as f64 / sibling_cells as f64
    } else if config.fallback_target_segments > 1 {
        limit as f64 / config.fallback_target_segments as f64
    } else if axis_cells > 0 {
        limit as f64 / axis_cells as f64
    } else {
        limit as f64
    };
    if !target_step.is_finite() || target_step <= 0.0 {
        target_step = 1.0;
    }

    snap_uniform_cuts(profile, limit, target_step, config, min_required)
}

fn sanitize_cuts(mut cuts: Vec<usize>, limit: usize) -> Vec<usize> {
    if limit == 0 {
        return vec![0];
    }

    let mut has_zero = false;
    let mut has_limit = false;

    for value in cuts.iter_mut() {
        if *value == 0 {
            has_zero = true;
        }
        if *value >= limit {
            *value = limit;
        }
        if *value == limit {
            has_limit = true;
        }
    }

    if !has_zero {
        cuts.push(0);
    }
    if !has_limit {
        cuts.push(limit);
    }

    cuts.sort_unstable();
    cuts.dedup();
    cuts
}

fn snap_uniform_cuts(
    profile: &[f64],
    limit: usize,
    target_step: f64,
    config: &Config,
    min_required: usize,
) -> Vec<usize> {
    if limit == 0 {
        return vec![0];
    }
    if limit == 1 {
        return vec![0, 1];
    }

    // Get desired cells
    let mut desired_cells = if target_step.is_finite() && target_step > 0.0 {
        (limit as f64 / target_step).round() as usize
    } else {
        0
    };
    desired_cells = desired_cells
        .max(min_required.saturating_sub(1))
        .max(1)
        .min(limit);

    let cell_width = limit as f64 / desired_cells as f64;
    let search_window =
        (cell_width * config.walker_search_window_ratio).max(config.walker_min_search_window);
    let mean_val = if profile.is_empty() {
        0.0
    } else {
        profile.iter().sum::<f64>() / profile.len() as f64
    };

    let mut cuts = Vec::with_capacity(desired_cells + 1);
    cuts.push(0);
    for idx in 1..desired_cells {
        let target = cell_width * idx as f64;
        let prev = *cuts.last().unwrap();
        if prev + 1 >= limit {
            break;
        }
        let mut start = ((target - search_window).floor() as isize)
            .max(prev as isize + 1)
            .max(0);
        let mut end = ((target + search_window).ceil() as isize).min(limit as isize - 1);
        if end < start {
            start = prev as isize + 1;
            end = start;
        }
        let start = start as usize;
        let end = end as usize;
        let mut best_idx = start.min(profile.len().saturating_sub(1));
        let mut best_val = -1.0;
        for i in start..=end.min(profile.len().saturating_sub(1)) {
            let v = profile.get(i).copied().unwrap_or(0.0);
            if v > best_val {
                best_val = v;
                best_idx = i;
            }
        }
        let strength_threshold = mean_val * config.walker_strength_threshold;
        if best_val < strength_threshold {
            let mut fallback_idx = target.round() as isize;
            if fallback_idx <= prev as isize {
                fallback_idx = prev as isize + 1;
            }
            if fallback_idx >= limit as isize {
                fallback_idx = (limit as isize - 1).max(prev as isize + 1);
            }
            best_idx = fallback_idx as usize;
        }
        cuts.push(best_idx);
    }
    if *cuts.last().unwrap() != limit {
        cuts.push(limit);
    }
    cuts = sanitize_cuts(cuts, limit);
    cuts
}

fn resample(img: &RgbaImage, cols: &[usize], rows: &[usize]) -> Result<RgbaImage> {
    if cols.len() < 2 || rows.len() < 2 {
        return Err(PixelSnapperError::ProcessingError(
            "Insufficient grid cuts for resampling".to_string(),
        ));
    }

    let out_w = (cols.len().max(1) - 1) as u32;
    let out_h = (rows.len().max(1) - 1) as u32;
    let mut final_img: RgbaImage = ImageBuffer::new(out_w, out_h);

    for (y_i, w_y) in rows.windows(2).enumerate() {
        for (x_i, w_x) in cols.windows(2).enumerate() {
            let ys = w_y[0];
            let ye = w_y[1];
            let xs = w_x[0];
            let xe = w_x[1];

            if xe <= xs || ye <= ys {
                continue;
            }

            let mut counts: HashMap<[u8; 4], usize> = HashMap::new();

            for y in ys..ye {
                for x in xs..xe {
                    if x < img.width() as usize && y < img.height() as usize {
                        let p = img.get_pixel(x as u32, y as u32).0;
                        *counts.entry(p).or_insert(0) += 1;
                    }
                }
            }

            let mut best_pixel = [0, 0, 0, 0];

            let mut candidates: Vec<([u8; 4], usize)> = counts.into_iter().collect();
            candidates.sort_by(|a, b| {
                let count_cmp = b.1.cmp(&a.1);
                if count_cmp == Ordering::Equal {
                    a.0.cmp(&b.0)
                } else {
                    count_cmp
                }
            });

            if let Some(winner) = candidates.first() {
                best_pixel = winner.0;
            }

            final_img.put_pixel(x_i as u32, y_i as u32, Rgba(best_pixel));
        }
    }
    Ok(final_img)
}
```
