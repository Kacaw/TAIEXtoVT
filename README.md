# TAIEX Benchmark Dashboard

單頁式資料視覺化網站，用來比較台灣加權股價報酬指數與全球、美國、亞洲 benchmark ETF 在不同執政時期的相對績效。

## Data Definition

- `TAIEX`：台灣證券交易所官方「發行量加權股價報酬指數」
- `VT / VTI / EWJ / EWY / EWS / EWH`：`Adjusted Close`，作為含配息調整後的總報酬代理
- `VT` 共同比較起點：`2008-06-26`
- `VTI / EWJ / EWY / EWS / EWH` 共同比較起點：`2003-01-02`

## Project Structure

- `index.html`：頁面結構與 metadata
- `app.js`：圖表邏輯、benchmark 設定、互動狀態
- `data/*.csv`：靜態歷史資料檔，欄位固定為 `date,value`
- `scripts/build_market_data.py`：重新產生 ETF 靜態資料檔

## Deploy

本專案是純靜態網站，直接透過 GitHub Pages 發布即可。

GitHub Pages 建議設定：

- Source: `Deploy from a branch`
- Branch: `main`
- Folder: `/ (root)`

## Local Preview

由於頁面會用 `fetch()` 載入 `/data/*.csv`，不要直接雙擊 `index.html`。請使用靜態伺服器，例如：

```powershell
py -3 -m http.server 8000
```

## Data Sources

- TWSE 報酬指數開放資料
- Yahoo Finance `VT / VTI / EWJ / EWY / EWS / EWH` historical adjusted close
