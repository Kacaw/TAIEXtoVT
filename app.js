const DATA_FILES = {
  taiex: "data/taiex.csv",
  taiex_ex_tsmc: "data/taiex_ex_tsmc_estimated.csv",
  tsmc_weight_estimate: "data/tsmc_weight_estimate.csv",
  vt: "data/vt.csv",
  vti: "data/vti.csv",
  ewj: "data/ewj.csv",
  ewy: "data/ewy.csv",
  ews: "data/ews.csv",
  ewh: "data/ewh.csv"
};

const resolutionSettings = {
  daily: { label: "每日" },
  weekly: { label: "每週" },
  monthly: { label: "每月" },
  quarterly: { label: "每季" }
};

function parseISODate(value) {
  const [year, month, day] = value.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

function cleanCsvValue(value) {
  return value.replace(/^"|"$/g, "").trim();
}

function parseSeries(csvText) {
  return csvText
    .trim()
    .split(/\r?\n/)
    .slice(1)
    .map((line) => {
      const [dateRaw, valueRaw] = line.split(",");
      const date = cleanCsvValue(dateRaw);
      const value = Number(cleanCsvValue(valueRaw));

      return {
        date,
        ts: parseISODate(date),
        value
      };
    })
    .filter((point) => point.date && Number.isFinite(point.value))
    .sort((a, b) => a.ts - b.ts);
}

async function loadSeriesFile(path) {
  const response = await fetch(path, { cache: "no-cache" });
  if (!response.ok) {
    throw new Error(`Failed to load ${path}: ${response.status}`);
  }

  return parseSeries(await response.text());
}

function formatDate(ts) {
  const date = new Date(ts);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}.${month}.${day}`;
}

function formatValue(value, maximumFractionDigits = 2) {
  return new Intl.NumberFormat("zh-TW", {
    maximumFractionDigits,
    minimumFractionDigits: maximumFractionDigits === 0 ? 0 : Math.min(2, maximumFractionDigits)
  }).format(value);
}

function lastDayOfMonth(year, monthIndex) {
  return Date.UTC(year, monthIndex + 1, 0);
}

function lastDayOfQuarter(year, quarterIndex) {
  return Date.UTC(year, quarterIndex * 3 + 3, 0);
}

function binaryFindAtOrBefore(series, ts) {
  let left = 0;
  let right = series.length - 1;
  let answer = null;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    if (series[mid].ts <= ts) {
      answer = series[mid];
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }

  return answer;
}

function binaryFindAtOrAfter(series, ts) {
  let left = 0;
  let right = series.length - 1;
  let answer = null;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    if (series[mid].ts >= ts) {
      answer = series[mid];
      right = mid - 1;
    } else {
      left = mid + 1;
    }
  }

  return answer;
}

function createGradient(context, chartArea, stops) {
  const gradient = context.createLinearGradient(chartArea.left, chartArea.top, chartArea.right, chartArea.bottom);
  stops.forEach((stop) => gradient.addColorStop(stop.offset, stop.color));
  return gradient;
}

const taiwanSeriesConfigs = {
  taiex: {
    key: "taiex",
    seriesKey: "taiex",
    shortName: "TAIEX",
    datasetLabel: "TAIEX Total Return Index",
    metricLabel: "最新 TAIEX TR",
    metricNote: "TWSE 官方報酬指數，含股息再投入",
    legendLabel: "TAIEX Total Return",
    sourceLabel: "TAIEX：",
    sourceCopy: "台灣證券交易所「發行量加權股價報酬指數」開放資料，採官方日資料。",
    methodLabel: "台股版本使用 TWSE 官方 TAIEX 發行量加權股價報酬指數。",
    chartNarrativeNote: "TAIEX 使用 TWSE 官方含息報酬指數。",
    proxyLabel: "TAIEX = 官方報酬指數",
    disclaimer: "",
    links: [],
    color: "#ef5a29",
    gradientStops: [
      { offset: 0, color: "#ff8c4c" },
      { offset: 0.45, color: "#ef5a29" },
      { offset: 1, color: "#c93a0d" }
    ]
  },
  taiex_ex_tsmc: {
    key: "taiex_ex_tsmc",
    seriesKey: "taiex_ex_tsmc",
    shortName: "TAIEX ex-TSMC（估算）",
    datasetLabel: "TAIEX ex-TSMC Estimated",
    metricLabel: "最新 ex-TSMC 估算值",
    metricNote: "以月頻台積電權重估算反推之台股序列，非官方指數",
    legendLabel: "TAIEX ex-TSMC（估算）",
    sourceLabel: "台股估算序列：",
    sourceCopy:
      "以 TWSE 官方 TAIEX 報酬指數、2330.TW Adjusted Close、Yahoo split events 與 FSC 上市市值月資料反推之估算序列。",
    methodLabel:
      "台股版本改用 TAIEX ex-TSMC 估算值；台積電權重以『當前股本 + Yahoo split events 回推股數 + FSC 上市市值月資料』估算，並在月觀測點間 piecewise hold。",
    chartNarrativeNote:
      "台股序列改為 ex-TSMC 估算值；台積電權重採月頻估算並於日頻報酬計算中沿用前一觀測值。",
    proxyLabel: "台股 = ex-TSMC 估算序列",
    disclaimer: "台股 ex-TSMC 為估算序列，不等同 TWSE 官方指數；權重採月頻估算，僅供歷史比較。",
    links: [
      { label: "FSC 股票發行概況", url: "https://data.gov.tw/dataset/103533" },
      { label: "研究說明", url: "https://github.com/Kacaw/TAIEXtoVT/blob/codex/ex-tsmc-estimate/research/ex-tsmc-estimate.md" }
    ],
    color: "#d14316",
    gradientStops: [
      { offset: 0, color: "#fdba74" },
      { offset: 0.45, color: "#d14316" },
      { offset: 1, color: "#9a3412" }
    ]
  }
};

const threeAdministrationSet = [
  {
    key: "ma",
    label: "馬英九時期",
    shortLabel: "馬英九",
    officialStartTs: parseISODate("2008-05-20"),
    officialEndTs: parseISODate("2016-05-20"),
    fill: "rgba(99, 116, 139, 0.055)",
    textColor: "rgba(20, 32, 43, 0.68)"
  },
  {
    key: "tsai",
    label: "蔡英文時期",
    shortLabel: "蔡英文",
    officialStartTs: parseISODate("2016-05-20"),
    officialEndTs: parseISODate("2024-05-20"),
    fill: "rgba(239, 90, 41, 0.050)",
    textColor: "rgba(20, 32, 43, 0.70)"
  },
  {
    key: "lai",
    label: "賴清德時期",
    shortLabel: "賴清德",
    officialStartTs: parseISODate("2024-05-20"),
    officialEndTs: parseISODate("2026-04-15"),
    fill: "rgba(255, 179, 110, 0.15)",
    textColor: "rgba(20, 32, 43, 0.74)"
  }
];

const fourAdministrationSet = [
  {
    key: "chen",
    label: "陳水扁時期",
    shortLabel: "陳水扁",
    officialStartTs: parseISODate("2000-05-20"),
    officialEndTs: parseISODate("2008-05-20"),
    fill: "rgba(15, 118, 110, 0.07)",
    textColor: "rgba(20, 32, 43, 0.70)"
  },
  ...threeAdministrationSet
];

function buildBenchmarkConfig(config) {
  const globalHero =
    "本圖表比較 TAIEX 發行量加權股價報酬指數（含息滾入）與全球、美國及亞洲主要 ETF 的調整後收盤價（含配息與拆分調整）於各執政時期之相對走勢。";

  return {
    rawDigits: 4,
    metricDigits: 2,
    defaultBaseline: "ma",
    ...config,
    heroText: config.heroText || globalHero
  };
}

const benchmarkConfigs = {
  vt: buildBenchmarkConfig({
    key: "vt",
    controlLabel: "VT 全球市場",
    shortName: "VT",
    seriesKey: "vt",
    datasetLabel: "VT Adjusted Close",
    metricLabel: "最新 VT Adj Close",
    metricNote: "Vanguard Total World ETF 調整後收盤價，含配息與拆分調整",
    methodHint: "TAIEX 使用 TWSE 官方報酬指數；VT 使用 Yahoo Finance Adjusted Close。VT 模式自 2008.06.26 起，僅使用真實資料。",
    chartNarrative:
      "全圖以真實日資料重新取樣。TAIEX 使用 TWSE 官方含息報酬指數；目前 benchmark 使用全球股市 ETF VT 的 Adjusted Close 作為含息可比序列，可觀察台灣與全球市場的相對強弱。",
    proxyNotice: "TAIEX = 官方報酬指數；VT = 調整後收盤價。",
    rangeDetailTemplate: (context) => `VT 模式資料區間為 ${formatDate(context.startTs)} 至 ${formatDate(context.endTs)}。`,
    sourceBenchmarkLabel: "VT：",
    sourceBenchmarkCopy:
      "Yahoo Finance 歷史序列，對應 Vanguard Total World ETF，使用 Adjusted Close 作為含配息與拆分調整後的可比序列。",
    disclaimerCopy: "VT 的 Adjusted Close 為含配息調整代理，不等同 Vanguard 官方 Total Return Index 點位。",
    links: [
      { label: "VT Historical Data", url: "https://finance.yahoo.com/quote/VT/history/" },
      { label: "VT Official", url: "https://investor.vanguard.com/investment-products/etfs/profile/vt" }
    ],
    color: "#194f98",
    softBg: "rgba(25, 79, 152, 0.08)",
    gradientCss: "linear-gradient(90deg, #6ea5ea 0%, #194f98 50%, #123769 100%)",
    gradientStops: [
      { offset: 0, color: "#6ea5ea" },
      { offset: 0.5, color: "#194f98" },
      { offset: 1, color: "#123769" }
    ],
    annotatePartialStart: false,
    administrations: threeAdministrationSet
  }),
  vti: buildBenchmarkConfig({
    key: "vti",
    controlLabel: "VTI 美國市場",
    shortName: "VTI",
    seriesKey: "vti",
    datasetLabel: "VTI Adjusted Close",
    metricLabel: "最新 VTI Adj Close",
    metricNote: "Vanguard Total Stock Market ETF 調整後收盤價，含配息與拆分調整",
    methodHint: "TAIEX 使用 TWSE 官方報酬指數；VTI 使用 Yahoo Finance Adjusted Close。VTI 模式可回溯至 2003.01.02，並納入陳水扁任期後段。",
    chartNarrative:
      "全圖以真實日資料重新取樣。TAIEX 使用 TWSE 官方含息報酬指數；目前 benchmark 使用美國總市場 ETF VTI 的 Adjusted Close 作為含息可比序列，可觀察台灣與美國市場的相對強弱。",
    proxyNotice: "TAIEX = 官方報酬指數；VTI = 調整後收盤價。",
    rangeDetailTemplate: (context) => `VTI 模式資料區間為 ${formatDate(context.startTs)} 至 ${formatDate(context.endTs)}；陳水扁任期以可得資料起點開始計算。`,
    sourceBenchmarkLabel: "VTI：",
    sourceBenchmarkCopy:
      "Yahoo Finance 歷史序列，對應 Vanguard Total Stock Market ETF，使用 Adjusted Close 作為含配息與拆分調整後的可比序列。",
    disclaimerCopy: "VTI 的 Adjusted Close 為含配息調整代理，不等同 Vanguard 官方 Total Return Index 點位。",
    links: [
      { label: "VTI Historical Data", url: "https://finance.yahoo.com/quote/VTI/history/" },
      { label: "VTI Official", url: "https://investor.vanguard.com/investment-products/etfs/profile/vti" }
    ],
    color: "#0f766e",
    softBg: "rgba(15, 118, 110, 0.08)",
    gradientCss: "linear-gradient(90deg, #5fd0b7 0%, #0f766e 50%, #115e59 100%)",
    gradientStops: [
      { offset: 0, color: "#5fd0b7" },
      { offset: 0.5, color: "#0f766e" },
      { offset: 1, color: "#115e59" }
    ],
    annotatePartialStart: true,
    administrations: fourAdministrationSet
  }),
  ewj: buildBenchmarkConfig({
    key: "ewj",
    controlLabel: "EWJ 日本",
    shortName: "EWJ",
    seriesKey: "ewj",
    datasetLabel: "EWJ Adjusted Close",
    metricLabel: "最新 EWJ Adj Close",
    metricNote: "iShares MSCI Japan ETF 調整後收盤價，含配息與拆分調整",
    methodHint: "TAIEX 使用 TWSE 官方報酬指數；EWJ 使用 Yahoo Finance Adjusted Close。EWJ 模式可回溯至 2003.01.02，並納入陳水扁任期後段。",
    chartNarrative:
      "全圖以真實日資料重新取樣。TAIEX 使用 TWSE 官方含息報酬指數；目前 benchmark 使用日本股市 ETF EWJ 的 Adjusted Close 作為含息可比序列，可觀察台灣與日本市場的相對強弱。",
    proxyNotice: "TAIEX = 官方報酬指數；EWJ = 調整後收盤價。",
    rangeDetailTemplate: (context) => `EWJ 模式資料區間為 ${formatDate(context.startTs)} 至 ${formatDate(context.endTs)}；陳水扁任期以可得資料起點開始計算。`,
    sourceBenchmarkLabel: "EWJ：",
    sourceBenchmarkCopy:
      "Yahoo Finance 歷史序列，對應 iShares MSCI Japan ETF，使用 Adjusted Close 作為含配息與拆分調整後的可比序列。",
    disclaimerCopy: "EWJ 的 Adjusted Close 為含配息調整代理，不等同 iShares 官方 total return 點位。",
    links: [
      { label: "EWJ Historical Data", url: "https://finance.yahoo.com/quote/EWJ/history/" },
      { label: "EWJ Official", url: "https://www.ishares.com/us/products/239665/ishares-msci-japan-etf" }
    ],
    color: "#b91c1c",
    softBg: "rgba(185, 28, 28, 0.08)",
    gradientCss: "linear-gradient(90deg, #f87171 0%, #b91c1c 50%, #7f1d1d 100%)",
    gradientStops: [
      { offset: 0, color: "#f87171" },
      { offset: 0.5, color: "#b91c1c" },
      { offset: 1, color: "#7f1d1d" }
    ],
    annotatePartialStart: true,
    administrations: fourAdministrationSet
  }),
  ewy: buildBenchmarkConfig({
    key: "ewy",
    controlLabel: "EWY 韓國",
    shortName: "EWY",
    seriesKey: "ewy",
    datasetLabel: "EWY Adjusted Close",
    metricLabel: "最新 EWY Adj Close",
    metricNote: "iShares MSCI South Korea ETF 調整後收盤價，含配息與拆分調整",
    methodHint: "TAIEX 使用 TWSE 官方報酬指數；EWY 使用 Yahoo Finance Adjusted Close。EWY 模式可回溯至 2003.01.02，並納入陳水扁任期後段。",
    chartNarrative:
      "全圖以真實日資料重新取樣。TAIEX 使用 TWSE 官方含息報酬指數；目前 benchmark 使用韓國股市 ETF EWY 的 Adjusted Close 作為含息可比序列，可觀察台灣與韓國市場的相對強弱。",
    proxyNotice: "TAIEX = 官方報酬指數；EWY = 調整後收盤價。",
    rangeDetailTemplate: (context) => `EWY 模式資料區間為 ${formatDate(context.startTs)} 至 ${formatDate(context.endTs)}；陳水扁任期以可得資料起點開始計算。`,
    sourceBenchmarkLabel: "EWY：",
    sourceBenchmarkCopy:
      "Yahoo Finance 歷史序列，對應 iShares MSCI South Korea ETF，使用 Adjusted Close 作為含配息與拆分調整後的可比序列。",
    disclaimerCopy: "EWY 的 Adjusted Close 為含配息調整代理，不等同 iShares 官方 total return 點位。",
    links: [
      { label: "EWY Historical Data", url: "https://finance.yahoo.com/quote/EWY/history/" },
      { label: "EWY Official", url: "https://www.ishares.com/us/products/239681/ishares-msci-south-korea-etf" }
    ],
    color: "#166534",
    softBg: "rgba(22, 101, 52, 0.08)",
    gradientCss: "linear-gradient(90deg, #86efac 0%, #166534 50%, #14532d 100%)",
    gradientStops: [
      { offset: 0, color: "#86efac" },
      { offset: 0.5, color: "#166534" },
      { offset: 1, color: "#14532d" }
    ],
    annotatePartialStart: true,
    administrations: fourAdministrationSet
  }),
  ews: buildBenchmarkConfig({
    key: "ews",
    controlLabel: "EWS 新加坡",
    shortName: "EWS",
    seriesKey: "ews",
    datasetLabel: "EWS Adjusted Close",
    metricLabel: "最新 EWS Adj Close",
    metricNote: "iShares MSCI Singapore ETF 調整後收盤價，含配息與拆分調整",
    methodHint: "TAIEX 使用 TWSE 官方報酬指數；EWS 使用 Yahoo Finance Adjusted Close。EWS 模式可回溯至 2003.01.02，並納入陳水扁任期後段。",
    chartNarrative:
      "全圖以真實日資料重新取樣。TAIEX 使用 TWSE 官方含息報酬指數；目前 benchmark 使用新加坡股市 ETF EWS 的 Adjusted Close 作為含息可比序列，可觀察台灣與新加坡市場的相對強弱。",
    proxyNotice: "TAIEX = 官方報酬指數；EWS = 調整後收盤價。",
    rangeDetailTemplate: (context) => `EWS 模式資料區間為 ${formatDate(context.startTs)} 至 ${formatDate(context.endTs)}；陳水扁任期以可得資料起點開始計算。`,
    sourceBenchmarkLabel: "EWS：",
    sourceBenchmarkCopy:
      "Yahoo Finance 歷史序列，對應 iShares MSCI Singapore ETF，使用 Adjusted Close 作為含配息與拆分調整後的可比序列。",
    disclaimerCopy: "EWS 的 Adjusted Close 為含配息調整代理，不等同 iShares 官方 total return 點位。",
    links: [
      { label: "EWS Historical Data", url: "https://finance.yahoo.com/quote/EWS/history/" },
      { label: "EWS Official", url: "https://www.ishares.com/us/products/239678/ishares-msci-singapore-capped-etf" }
    ],
    color: "#b45309",
    softBg: "rgba(180, 83, 9, 0.08)",
    gradientCss: "linear-gradient(90deg, #fbbf24 0%, #b45309 50%, #92400e 100%)",
    gradientStops: [
      { offset: 0, color: "#fbbf24" },
      { offset: 0.5, color: "#b45309" },
      { offset: 1, color: "#92400e" }
    ],
    annotatePartialStart: true,
    administrations: fourAdministrationSet
  }),
  ewh: buildBenchmarkConfig({
    key: "ewh",
    controlLabel: "EWH 香港",
    shortName: "EWH",
    seriesKey: "ewh",
    datasetLabel: "EWH Adjusted Close",
    metricLabel: "最新 EWH Adj Close",
    metricNote: "iShares MSCI Hong Kong ETF 調整後收盤價，含配息與拆分調整",
    methodHint: "TAIEX 使用 TWSE 官方報酬指數；EWH 使用 Yahoo Finance Adjusted Close。EWH 模式可回溯至 2003.01.02，並納入陳水扁任期後段。",
    chartNarrative:
      "全圖以真實日資料重新取樣。TAIEX 使用 TWSE 官方含息報酬指數；目前 benchmark 使用香港股市 ETF EWH 的 Adjusted Close 作為含息可比序列，可觀察台灣與香港市場的相對強弱。",
    proxyNotice: "TAIEX = 官方報酬指數；EWH = 調整後收盤價。",
    rangeDetailTemplate: (context) => `EWH 模式資料區間為 ${formatDate(context.startTs)} 至 ${formatDate(context.endTs)}；陳水扁任期以可得資料起點開始計算。`,
    sourceBenchmarkLabel: "EWH：",
    sourceBenchmarkCopy:
      "Yahoo Finance 歷史序列，對應 iShares MSCI Hong Kong ETF，使用 Adjusted Close 作為含配息與拆分調整後的可比序列。",
    disclaimerCopy: "EWH 的 Adjusted Close 為含配息調整代理，不等同 iShares 官方 total return 點位。",
    links: [
      { label: "EWH Historical Data", url: "https://finance.yahoo.com/quote/EWH/history/" },
      { label: "EWH Official", url: "https://www.ishares.com/us/products/239657/ishares-msci-hong-kong-etf" }
    ],
    color: "#7c3aed",
    softBg: "rgba(124, 58, 237, 0.08)",
    gradientCss: "linear-gradient(90deg, #c4b5fd 0%, #7c3aed 50%, #5b21b6 100%)",
    gradientStops: [
      { offset: 0, color: "#c4b5fd" },
      { offset: 0.5, color: "#7c3aed" },
      { offset: 1, color: "#5b21b6" }
    ],
    annotatePartialStart: true,
    administrations: fourAdministrationSet
  })
};

const controls = {
  taiwanSeries: document.getElementById("taiwanSeries"),
  benchmark: document.getElementById("benchmark"),
  baseline: document.getElementById("baseline"),
  resolution: document.getElementById("resolution")
};

const metrics = {
  heroDescription: document.getElementById("heroDescription"),
  methodHint: document.getElementById("methodHint"),
  modeBadge: document.getElementById("modeBadge"),
  basisLabel: document.getElementById("basisLabel"),
  taiwanMetricLabel: document.getElementById("taiwanMetricLabel"),
  taiexMetric: document.getElementById("taiexMetric"),
  taiwanMetricNote: document.getElementById("taiwanMetricNote"),
  benchmarkMetricLabel: document.getElementById("benchmarkMetricLabel"),
  benchmarkMetric: document.getElementById("benchmarkMetric"),
  benchmarkMetricNote: document.getElementById("benchmarkMetricNote"),
  administrationGrid: document.getElementById("administrationGrid"),
  proxyNotice: document.getElementById("proxyNotice"),
  officialWindow: document.getElementById("officialWindow"),
  periodSummary: document.getElementById("periodSummary"),
  chartNarrative: document.getElementById("chartNarrative"),
  taiwanLegendLabel: document.getElementById("taiwanLegendLabel"),
  benchmarkLegend: document.getElementById("benchmarkLegend"),
  methodDetail: document.getElementById("methodDetail"),
  rangeDetail: document.getElementById("rangeDetail"),
  sourceTaiwanLabel: document.getElementById("sourceTaiwanLabel"),
  sourceTaiwanCopy: document.getElementById("sourceTaiwanCopy"),
  sourceBenchmarkLabel: document.getElementById("sourceBenchmarkLabel"),
  sourceBenchmarkCopy: document.getElementById("sourceBenchmarkCopy"),
  disclaimerBenchmarkCopy: document.getElementById("disclaimerBenchmarkCopy"),
  sourceLinks: document.getElementById("sourceLinks")
};

const state = {
  rawSeries: null,
  chartInstance: null
};

function setControlsDisabled(disabled) {
  Object.values(controls).forEach((element) => {
    element.disabled = disabled;
  });
}

function showError(message) {
  metrics.modeBadge.textContent = "載入失敗";
  metrics.basisLabel.textContent = message;
  metrics.chartNarrative.textContent = message;
  metrics.periodSummary.textContent = "請透過 GitHub Pages 或本機靜態伺服器開啟本站。";
}

function getTaiwanSeriesContext(taiwanSeriesKey) {
  const config = taiwanSeriesConfigs[taiwanSeriesKey];
  const series = state.rawSeries[config.seriesKey];
  const latestWeightSeries = state.rawSeries.tsmc_weight_estimate || [];
  const latestWeight = latestWeightSeries.length ? latestWeightSeries[latestWeightSeries.length - 1].value : null;

  return {
    ...config,
    series,
    latestWeight
  };
}

function getBenchmarkContext(benchmarkKey, taiwanContext) {
  const config = benchmarkConfigs[benchmarkKey];
  const benchmarkSeries = state.rawSeries[config.seriesKey];
  const taiexSeries = taiwanContext.series;
  const startTs = Math.max(taiexSeries[0].ts, benchmarkSeries[0].ts);
  const endTs = Math.min(taiexSeries[taiexSeries.length - 1].ts, benchmarkSeries[benchmarkSeries.length - 1].ts);

  const administrations = config.administrations
    .map((period) => {
      const windowStartTs = Math.max(startTs, period.officialStartTs);
      const windowEndTs = Math.min(endTs, period.officialEndTs);

      if (windowStartTs > windowEndTs) {
        return null;
      }

      const taiexStartCandidate = binaryFindAtOrAfter(taiexSeries, windowStartTs);
      const benchmarkStartCandidate = binaryFindAtOrAfter(benchmarkSeries, windowStartTs);
      const taiexEndCandidate = binaryFindAtOrBefore(taiexSeries, windowEndTs);
      const benchmarkEndCandidate = binaryFindAtOrBefore(benchmarkSeries, windowEndTs);

      if (!taiexStartCandidate || !benchmarkStartCandidate || !taiexEndCandidate || !benchmarkEndCandidate) {
        return null;
      }

      const sharedStartTs = Math.max(taiexStartCandidate.ts, benchmarkStartCandidate.ts);
      const sharedEndTs = Math.min(taiexEndCandidate.ts, benchmarkEndCandidate.ts);

      if (sharedStartTs > sharedEndTs) {
        return null;
      }

      const isPartialStart = sharedStartTs > period.officialStartTs;
      const displayLabel =
        config.annotatePartialStart && isPartialStart ? `${period.label}（可得資料起）` : period.label;
      const bandLabel =
        config.annotatePartialStart && isPartialStart ? `${period.shortLabel}*` : period.shortLabel;

      return {
        ...period,
        startTs: sharedStartTs,
        endTs: sharedEndTs,
        isPartialStart,
        displayLabel,
        bandLabel
      };
    })
    .filter(Boolean);

  return {
    ...config,
    taiwanContext,
    taiexSeries,
    benchmarkSeries,
    startTs,
    endTs,
    administrations,
    administrationMap: Object.fromEntries(administrations.map((period) => [period.key, period]))
  };
}

function buildSampleDates(context, resolution) {
  const { startTs, endTs, taiexSeries, benchmarkSeries } = context;

  if (resolution === "daily") {
    return [...new Set([...taiexSeries.map((point) => point.ts), ...benchmarkSeries.map((point) => point.ts)])]
      .filter((ts) => ts >= startTs && ts <= endTs)
      .sort((a, b) => a - b);
  }

  const dates = [];

  if (resolution === "weekly") {
    for (let ts = startTs; ts <= endTs; ts += 7 * 24 * 60 * 60 * 1000) {
      dates.push(ts);
    }
  }

  if (resolution === "monthly") {
    const cursor = new Date(startTs);
    while (cursor.getTime() <= endTs) {
      dates.push(lastDayOfMonth(cursor.getUTCFullYear(), cursor.getUTCMonth()));
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }
  }

  if (resolution === "quarterly") {
    const startDate = new Date(startTs);
    const quarterStartMonth = Math.floor(startDate.getUTCMonth() / 3) * 3;
    const cursor = new Date(Date.UTC(startDate.getUTCFullYear(), quarterStartMonth, 1));
    while (cursor.getTime() <= endTs) {
      const quarter = Math.floor(cursor.getUTCMonth() / 3);
      dates.push(lastDayOfQuarter(cursor.getUTCFullYear(), quarter));
      cursor.setUTCMonth(cursor.getUTCMonth() + 3);
    }
  }

  return [...new Set(dates.filter((ts) => ts >= startTs && ts <= endTs).concat([endTs]))].sort((a, b) => a - b);
}

function buildNormalizedSeries(context, baselineKey, resolution) {
  const baselinePeriod = context.administrationMap[baselineKey];
  const taiexBaseline = binaryFindAtOrAfter(context.taiexSeries, baselinePeriod.startTs);
  const benchmarkBaseline = binaryFindAtOrAfter(context.benchmarkSeries, baselinePeriod.startTs);
  const sampleDates = buildSampleDates(context, resolution);

  return sampleDates
    .map((ts) => {
      const taiexPoint = binaryFindAtOrBefore(context.taiexSeries, ts);
      const benchmarkPoint = binaryFindAtOrBefore(context.benchmarkSeries, ts);

      if (!taiexPoint || !benchmarkPoint) {
        return null;
      }

      if (taiexPoint.ts < context.startTs || benchmarkPoint.ts < context.startTs) {
        return null;
      }

      return {
        ts,
        label: formatDate(ts),
        rawTaiex: taiexPoint.value,
        rawBenchmark: benchmarkPoint.value,
        taiex: (taiexPoint.value / taiexBaseline.value) * 100,
        benchmark: (benchmarkPoint.value / benchmarkBaseline.value) * 100
      };
    })
    .filter(Boolean);
}

function buildAdministrationComparisons(context) {
  return context.administrations.map((period) => {
    const taiexStart = binaryFindAtOrAfter(context.taiexSeries, period.startTs);
    const benchmarkStart = binaryFindAtOrAfter(context.benchmarkSeries, period.startTs);
    const taiexEnd = binaryFindAtOrBefore(context.taiexSeries, period.endTs);
    const benchmarkEnd = binaryFindAtOrBefore(context.benchmarkSeries, period.endTs);

    return {
      ...period,
      taiexStart,
      taiexEnd,
      benchmarkStart,
      benchmarkEnd,
      taiexRatio: taiexEnd.value / taiexStart.value,
      benchmarkRatio: benchmarkEnd.value / benchmarkStart.value,
      relativeRatio: (taiexEnd.value / taiexStart.value) / (benchmarkEnd.value / benchmarkStart.value)
    };
  });
}

const periodBandsPlugin = {
  id: "periodBands",
  beforeDatasetsDraw(chart, args, pluginOptions) {
    const { ctx, chartArea, scales } = chart;
    if (!chartArea) return;

    const { left, right, top, bottom } = chartArea;
    const xScale = scales.x;
    const yScale = scales.y;

    ctx.save();

    (pluginOptions.periods || []).forEach((period) => {
      const start = xScale.getPixelForValue(period.startTs);
      const end = xScale.getPixelForValue(period.endTs);
      const bandLeft = Math.max(left, Math.min(start, end));
      const bandRight = Math.min(right, Math.max(start, end));
      const width = Math.max(0, bandRight - bandLeft);

      if (width <= 1) return;

      ctx.fillStyle = period.fill;
      ctx.fillRect(bandLeft, top, width, bottom - top);

      const center = bandLeft + width / 2;
      const compact = width < 120;
      const titleSize = window.innerWidth < 640 ? 10 : 12;
      const rangeSize = window.innerWidth < 640 ? 9 : 10;

      ctx.textAlign = "center";
      ctx.fillStyle = period.textColor;
      ctx.font = `800 ${titleSize}px "Manrope", "Noto Sans TC", sans-serif`;
      ctx.fillText(period.bandLabel, center, top + 20);

      if (!compact) {
        ctx.font = `600 ${rangeSize}px "Manrope", "Noto Sans TC", sans-serif`;
        ctx.fillText(`${formatDate(period.startTs)} - ${formatDate(period.endTs)}`, center, top + 36);
      }
    });

    ctx.strokeStyle = "rgba(20, 32, 43, 0.08)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(left, yScale.getPixelForValue(100));
    ctx.lineTo(right, yScale.getPixelForValue(100));
    ctx.stroke();
    ctx.restore();
  }
};

Chart.register(periodBandsPlugin);

function populateBaselineOptions(context) {
  const currentBaseline = controls.baseline.value;
  controls.baseline.innerHTML = "";

  context.administrations.forEach((period) => {
    const option = document.createElement("option");
    option.value = period.key;
    option.textContent = period.displayLabel;
    controls.baseline.appendChild(option);
  });

  const validValues = Array.from(controls.baseline.options).map((option) => option.value);
  if (validValues.includes(currentBaseline)) {
    controls.baseline.value = currentBaseline;
    return;
  }

  controls.baseline.value = validValues.includes(context.defaultBaseline) ? context.defaultBaseline : validValues[0];
}

function buildSourceLinksHtml(context) {
  const links = [
    { label: "TWSE 開放資料", url: "https://data.gov.tw/dataset/11871" },
    ...(context.taiwanContext.links || []),
    ...context.links
  ];

  return links
    .map(
      (link) =>
        `<a class="font-semibold text-slate-700 underline decoration-slate-300 underline-offset-4 hover:text-slate-900" href="${link.url}" target="_blank" rel="noreferrer">${link.label}</a>`
    )
    .join(" · ");
}

function updateSummary(context, series, baselineKey, resolution) {
  const latest = series[series.length - 1];
  const baselinePeriod = context.administrationMap[baselineKey];
  const comparisons = buildAdministrationComparisons(context);
  const cardCount = comparisons.length;
  const taiwanContext = context.taiwanContext;
  const modeLabel = taiwanContext.key === "taiex" ? "官方 TAIEX" : "ex-TSMC 估算";
  const benchmarkWindowNote =
    context.key === "vt"
      ? "VT 模式自 2008.06.26 起，僅使用真實資料。"
      : `${context.shortName} 模式可回溯至 2003.01.02，並納入陳水扁任期後段。`;
  const benchmarkNarrative =
    context.key === "vt"
      ? "目前 benchmark 使用全球股市 ETF VT 的 Adjusted Close 作為含息可比序列，可觀察台灣與全球市場的相對強弱。"
      : context.key === "vti"
        ? "目前 benchmark 使用美國總市場 ETF VTI 的 Adjusted Close 作為含息可比序列，可觀察台灣與美國市場的相對強弱。"
        : context.key === "ewj"
          ? "目前 benchmark 使用日本股市 ETF EWJ 的 Adjusted Close 作為含息可比序列，可觀察台灣與日本市場的相對強弱。"
          : context.key === "ewy"
            ? "目前 benchmark 使用韓國股市 ETF EWY 的 Adjusted Close 作為含息可比序列，可觀察台灣與韓國市場的相對強弱。"
            : context.key === "ews"
              ? "目前 benchmark 使用新加坡股市 ETF EWS 的 Adjusted Close 作為含息可比序列，可觀察台灣與新加坡市場的相對強弱。"
              : "目前 benchmark 使用香港股市 ETF EWH 的 Adjusted Close 作為含息可比序列，可觀察台灣與香港市場的相對強弱。";

  metrics.heroDescription.textContent =
    taiwanContext.key === "taiex_ex_tsmc"
      ? `${context.heroText} 目前台股版本已切換為 ex-TSMC 估算序列。`
      : context.heroText;
  metrics.methodHint.textContent = `${taiwanContext.methodLabel} benchmark 端使用 ${context.shortName} Yahoo Finance Adjusted Close。${benchmarkWindowNote}`;
  metrics.modeBadge.textContent = `${modeLabel} / ${context.controlLabel} / ${resolutionSettings[resolution].label}`;
  metrics.basisLabel.textContent = `基準點：${baselinePeriod.displayLabel} ${formatDate(baselinePeriod.startTs)} = 100`;
  metrics.taiwanMetricLabel.textContent = taiwanContext.metricLabel;
  metrics.taiexMetric.textContent = formatValue(latest.rawTaiex, 2);
  metrics.taiexMetric.style.color = taiwanContext.color;
  metrics.taiwanMetricNote.textContent =
    taiwanContext.latestWeight && taiwanContext.key === "taiex_ex_tsmc"
      ? `${taiwanContext.metricNote}；最新月估權重約 ${(taiwanContext.latestWeight * 100).toFixed(1)}%。`
      : taiwanContext.metricNote;
  metrics.benchmarkMetricLabel.textContent = context.metricLabel;
  metrics.benchmarkMetric.textContent = formatValue(latest.rawBenchmark, context.metricDigits);
  metrics.benchmarkMetric.style.color = context.color;
  metrics.benchmarkMetricNote.textContent = context.metricNote;
  metrics.proxyNotice.textContent = `${taiwanContext.proxyLabel}；${context.shortName} = 調整後收盤價。`;
  metrics.officialWindow.textContent = `本頁顯示範圍：${formatDate(context.startTs)} - ${formatDate(context.endTs)}。`;
  metrics.periodSummary.textContent = `可視區間：${context.administrations.map((period) => period.displayLabel).join("、")}。`;
  metrics.chartNarrative.textContent = `全圖以真實日資料重新取樣。${taiwanContext.chartNarrativeNote} ${benchmarkNarrative}`;
  metrics.taiwanLegendLabel.textContent = taiwanContext.legendLabel;
  metrics.methodDetail.textContent = `倍率定義為「任期結束 ÷ 任期開始」；相對倍率為「${taiwanContext.shortName} 任期倍率 ÷ ${context.shortName} 任期倍率」。`;
  metrics.rangeDetail.textContent = `${context.rangeDetailTemplate(context)}${taiwanContext.key === "taiex_ex_tsmc" ? " ex-TSMC 估算值自可得月頻權重起點開始計算。" : ""}`;
  metrics.sourceTaiwanLabel.textContent = taiwanContext.sourceLabel;
  metrics.sourceTaiwanCopy.textContent = taiwanContext.sourceCopy;
  metrics.benchmarkLegend.innerHTML = `
    <span class="h-3 w-8 rounded-full" style="background:${context.gradientCss}"></span>
    ${context.datasetLabel}
  `;
  metrics.sourceBenchmarkLabel.textContent = context.sourceBenchmarkLabel;
  metrics.sourceBenchmarkCopy.innerHTML = context.sourceBenchmarkCopy;
  metrics.disclaimerBenchmarkCopy.textContent = [taiwanContext.disclaimer, context.disclaimerCopy].filter(Boolean).join(" ");
  metrics.sourceLinks.innerHTML = buildSourceLinksHtml(context);

  metrics.administrationGrid.className = [
    "mt-4",
    "grid",
    "gap-4",
    "md:grid-cols-2",
    cardCount === 4 ? "xl:grid-cols-4" : "xl:grid-cols-3"
  ].join(" ");

  metrics.administrationGrid.innerHTML = comparisons
    .map(
      (period) => `
        <article class="rounded-[24px] border border-slate-900/10 bg-white/88 p-4" style="background:${period.fill}">
          <p class="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">${period.displayLabel}</p>
          <p class="mt-2 text-lg font-extrabold text-slate-900">${formatDate(period.startTs)} → ${formatDate(period.endTs)}</p>
          <div class="mt-3 space-y-1 text-xs leading-5 text-slate-600">
            <p><span class="font-bold" style="color:${taiwanContext.color}">${taiwanContext.shortName}</span>：${formatValue(period.taiexStart.value, 2)} → ${formatValue(period.taiexEnd.value, 2)}</p>
            <p><span class="font-bold" style="color:${context.color}">${context.shortName}</span>：${formatValue(period.benchmarkStart.value, context.rawDigits)} → ${formatValue(period.benchmarkEnd.value, context.rawDigits)}</p>
          </div>
          <div class="mt-4 grid grid-cols-3 gap-2 text-center">
            <div class="rounded-2xl bg-white/80 px-2 py-3">
              <p class="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">${taiwanContext.key === "taiex" ? "TAIEX" : "ex-TSMC"}</p>
              <p class="mt-2 text-2xl font-extrabold" style="color:${taiwanContext.color}">${period.taiexRatio.toFixed(2)}x</p>
            </div>
            <div class="rounded-2xl bg-white/80 px-2 py-3">
              <p class="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">${context.shortName}</p>
              <p class="mt-2 text-2xl font-extrabold" style="color:${context.color}">${period.benchmarkRatio.toFixed(2)}x</p>
            </div>
            <div class="rounded-2xl bg-white/80 px-2 py-3">
              <p class="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">相對</p>
              <p class="mt-2 text-2xl font-extrabold text-ink">${period.relativeRatio.toFixed(2)}x</p>
            </div>
          </div>
          <p class="mt-3 text-xs leading-5 text-slate-500">
            相對 = ${taiwanContext.shortName} 任期倍率 ÷ ${context.shortName} 任期倍率${period.isPartialStart && context.annotatePartialStart ? "；本期自 benchmark 可得資料起點開始。" : ""}
          </p>
        </article>
      `
    )
    .join("");
}

function renderChart() {
  if (!state.rawSeries) return;

  const taiwanSeriesKey = controls.taiwanSeries.value;
  const benchmarkKey = controls.benchmark.value;
  const resolution = controls.resolution.value;
  const taiwanContext = getTaiwanSeriesContext(taiwanSeriesKey);
  const context = getBenchmarkContext(benchmarkKey, taiwanContext);

  populateBaselineOptions(context);

  const baselineKey = controls.baseline.value;
  const series = buildNormalizedSeries(context, baselineKey, resolution);
  const values = series.flatMap((point) => [point.taiex, point.benchmark]);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const suggestedMin = Math.max(0, Math.floor(minValue * 0.9));
  const suggestedMax = Math.ceil(maxValue * 1.08);

  updateSummary(context, series, baselineKey, resolution);

  const canvas = document.getElementById("performanceChart");
  const context2d = canvas.getContext("2d");

  if (state.chartInstance) {
    state.chartInstance.destroy();
  }

  state.chartInstance = new Chart(context2d, {
    type: "line",
    data: {
      datasets: [
        {
          label: taiwanContext.datasetLabel,
          data: series.map((point) => ({
            x: point.ts,
            y: point.taiex,
            rawValue: point.rawTaiex,
            rawDigits: 2,
            dateLabel: point.label
          })),
          borderWidth: resolution === "daily" ? 2.0 : 3.5,
          borderColor(chartContext) {
            const area = chartContext.chart.chartArea;
            if (!area) return taiwanContext.color;
            return createGradient(chartContext.chart.ctx, area, taiwanContext.gradientStops);
          },
          pointRadius: 0,
          pointHoverRadius: 4.5,
          pointHoverBackgroundColor: "#ffffff",
          pointHoverBorderColor: taiwanContext.color,
          pointHoverBorderWidth: 3,
          tension: 0.22,
          fill: false
        },
        {
          label: context.datasetLabel,
          data: series.map((point) => ({
            x: point.ts,
            y: point.benchmark,
            rawValue: point.rawBenchmark,
            rawDigits: context.rawDigits,
            dateLabel: point.label
          })),
          borderWidth: resolution === "daily" ? 1.9 : 3.0,
          borderColor(chartContext) {
            const area = chartContext.chart.chartArea;
            if (!area) return context.color;
            return createGradient(chartContext.chart.ctx, area, context.gradientStops);
          },
          pointRadius: 0,
          pointHoverRadius: 4.5,
          pointHoverBackgroundColor: "#ffffff",
          pointHoverBorderColor: context.color,
          pointHoverBorderWidth: 3,
          tension: 0.22,
          fill: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 1200,
        easing: "easeOutQuart"
      },
      interaction: {
        mode: "index",
        intersect: false
      },
      layout: {
        padding: {
          top: 18,
          right: 8,
          bottom: 8,
          left: 8
        }
      },
      plugins: {
        legend: {
          display: false
        },
        periodBands: {
          periods: context.administrations
        },
        tooltip: {
          backgroundColor: "rgba(8, 16, 24, 0.94)",
          titleColor: "#f8fafc",
          bodyColor: "#e2e8f0",
          footerColor: "#f8fafc",
          padding: 14,
          displayColors: true,
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.10)",
          callbacks: {
            title(items) {
              return items[0]?.raw?.dateLabel || "";
            },
            label(contextItem) {
              return `${contextItem.dataset.label}: ${formatValue(contextItem.parsed.y, 2)}（raw ${formatValue(
                contextItem.raw.rawValue,
                contextItem.raw.rawDigits
              )}）`;
            },
            footer(items) {
              if (items.length < 2) return "";
              const taiexPoint = items.find((item) => item.dataset.label === taiwanContext.datasetLabel);
              const benchmarkPoint = items.find((item) => item.dataset.label === context.datasetLabel);
              if (!taiexPoint || !benchmarkPoint) return "";
              const ratio = taiexPoint.parsed.y / benchmarkPoint.parsed.y;
              return `相對倍率：${ratio.toFixed(2)}x（${taiwanContext.shortName} / ${context.shortName}）`;
            }
          }
        }
      },
      scales: {
        x: {
          type: "linear",
          min: context.startTs,
          max: context.endTs,
          grid: {
            color: "rgba(20, 32, 43, 0.05)",
            drawBorder: false,
            tickLength: 0
          },
          border: {
            display: false
          },
          ticks: {
            color: "rgba(20, 32, 43, 0.68)",
            font: {
              weight: 700
            },
            maxTicksLimit: window.innerWidth < 640 ? 6 : 10,
            callback(value) {
              return new Date(Number(value)).getUTCFullYear();
            }
          }
        },
        y: {
          beginAtZero: false,
          suggestedMin,
          suggestedMax,
          grid: {
            color: "rgba(20, 32, 43, 0.08)",
            drawBorder: false
          },
          border: {
            display: false
          },
          ticks: {
            color: "rgba(20, 32, 43, 0.68)",
            font: {
              weight: 700
            },
            callback(value) {
              return formatValue(Number(value), 0);
            }
          },
          title: {
            display: true,
            text: `${formatDate(context.administrationMap[baselineKey].startTs)} = 100`,
            color: "rgba(20, 32, 43, 0.62)",
            font: {
              size: 12,
              weight: 700
            },
            padding: {
              bottom: 8
            }
          }
        }
      }
    }
  });
}

async function initializeApp() {
  setControlsDisabled(true);

  try {
    const loaded = await Promise.all(
      Object.entries(DATA_FILES).map(async ([key, path]) => [key, await loadSeriesFile(path)])
    );

    state.rawSeries = Object.fromEntries(loaded);
    controls.taiwanSeries.addEventListener("change", renderChart);
    controls.benchmark.addEventListener("change", renderChart);
    controls.baseline.addEventListener("change", renderChart);
    controls.resolution.addEventListener("change", renderChart);
    window.addEventListener("resize", renderChart);
    renderChart();
  } catch (error) {
    console.error(error);
    showError("資料載入失敗。若你是直接雙擊開啟檔案，請改用 GitHub Pages 或本機靜態伺服器。");
  } finally {
    setControlsDisabled(false);
  }
}

initializeApp();
