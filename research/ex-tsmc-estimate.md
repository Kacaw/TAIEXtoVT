# TAIEX ex-TSMC 估算研究筆記

## 目前狀態

- 此分支已做出可切換的 prototype UI，但仍不建議合回 `main`。
- 已備妥並自動生成下列資料：
  - `data/taiex.csv`：TWSE 官方 TAIEX Total Return
  - `data/tsmc_tw.csv`：`2330.TW` Yahoo Finance `Adjusted Close`
  - `data/tsmc_tw_close.csv`：`2330.TW` 未調整收盤價
  - `data/tw_listed_market_value_monthly.csv`：FSC 上市市值月資料
  - `data/tsmc_shares_estimated.csv`：以最新股本搭配 Yahoo split events 回推之月頻股數估算
  - `data/tsmc_weight_estimate.csv`：台積電在上市市值中的月頻估算權重
  - `data/taiex_ex_tsmc_estimated.csv`：反推出的 ex-TSMC 台股估算序列
- `scripts/build_market_data.py` 會一併更新上述資料。

## 既定公式

以日報酬表示：

```text
r_index,t = TAIEX_TR_t / TAIEX_TR_{t-1} - 1
r_tsmc,t = AdjClose_2330.TW_t / AdjClose_2330.TW_{t-1} - 1
w_{t-1} = 前一交易日台積電在 TAIEX 的估計權重
r_ex,t = (r_index,t - w_{t-1} * r_tsmc,t) / (1 - w_{t-1})
ExTSMC_t = ExTSMC_{t-1} * (1 + r_ex,t)
```

## 當前限制

目前 prototype 的 `w_{t-1}` 來自：

1. 最新可得股本
2. Yahoo split events 回推歷史股數
3. FSC 上市市值月資料

這已經能生成一條連續序列，但仍不是官方權重。缺口仍在：

1. 台積電完整歷史流通股數 / 發行股數正式序列
2. TAIEX 官方每日成分股權重
3. 足以處理所有資本變動與指數維護調整的成分股層級資料

目前已知限制：

- TWSE 成分股檔與權重檔屬授權 / 付費資料。
- 若只靠 `2330.TW` 價格與粗略市值快照，會把權重估計誤差直接傳遞到 `ex-TSMC` 路徑。
- 這種誤差在 2023-2026 年尤其危險，因為台積電權重大、對最終結論影響極強。

## 下一步建議

若未來要把這條線做成正式功能，建議先補下列任一來源：

- 可合法使用的歷史權重 / 成分股檔授權資料
- 可重建台積電每日權重的公開總市值與股本變動資料
- 可信的第三方歷史權重資料集

在上述資料未補齊前，此功能仍應視為研究 / prototype 狀態，不建議進入正式頁面。
