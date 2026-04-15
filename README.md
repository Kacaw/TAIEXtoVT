# TAIEX vs VT

單頁式資料視覺化網站，用來比較台灣加權股價報酬指數與 Vanguard Total World Stock ETF (`VT`) 在不同執政時期的相對績效。

## Data Definition

- `TAIEX`：台灣證券交易所官方「發行量加權股價報酬指數」
- `VT`：`Adjusted Close`，作為含配息調整後的總報酬代理
- 比較起點：`2008-06-26`

## Deploy

本專案是純靜態網站，`index.html` 放在 repository root，即可直接透過 GitHub Pages 發布。

GitHub Pages 建議設定：

- Source: `Deploy from a branch`
- Branch: `main`
- Folder: `/ (root)`

## Data Sources

- TWSE 報酬指數開放資料
- Yahoo Finance `VT` historical adjusted close
