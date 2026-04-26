type BinanceCmsArticle = {
  id?: number
  code?: string
  title?: string
  releaseDate?: number
}

type BinanceCmsCatalog = {
  catalogId?: number
  catalogName?: string
  total?: number
  articles?: BinanceCmsArticle[]
}

type BinanceCmsResponse = {
  success?: boolean
  data?: {
    catalogs?: BinanceCmsCatalog[]
  }
}

type BinanceFuturesTicker = {
  symbol: string
  openPrice: string
  highPrice: string
  lowPrice: string
  lastPrice: string
  priceChangePercent: string
  quoteVolume: string
  volume: string
  count: number
}

export type MarketAnalysisHotPost = {
  id: string
  title: string
  publishedAt: string
  catalogName: string
  catalogTotal: number
  heatScore: number
  symbols: string[]
}

export type MarketAnalysisCoinFrequency = {
  symbol: string
  mentionCount: number
  hotPostCount: number
  aggregatedHeatScore: number
  latestPublishedAt?: string
  sourceTitles: string[]
}

export type MarketAnalysisVolatility = {
  symbol: string
  baseAsset: string
  lastPrice: number
  openPrice: number
  highPrice: number
  lowPrice: number
  priceChangePercent: number
  volatilityPercent: number
  quoteVolume: number
  tradeCount: number
}

export type MarketAnalysisRecommendation = {
  symbol: string
  score: number
  reasonSummary: string
  reasons: string[]
  mentionCount: number
  hotPostCount: number
  volatilityPercent?: number
  priceChangePercent?: number
}

export type MarketAnalysisModule<T> = {
  items: T[]
  error?: string
}

export type MarketAnalysisPayload = {
  generatedAt: string
  hotPosts: MarketAnalysisModule<MarketAnalysisHotPost>
  frequentCoins: MarketAnalysisModule<MarketAnalysisCoinFrequency>
  volatilityRankings: MarketAnalysisModule<MarketAnalysisVolatility>
  recommendations: MarketAnalysisRecommendation[]
  strategySummary: string
}

const BINANCE_WEB_BASE = "https://www.binance.com"
const BINANCE_FUTURES_BASE = "https://fapi.binance.com"
const HOT_POST_LIMIT = 5
const FREQUENT_COIN_LIMIT = 5
const VOLATILITY_LIMIT = 10
const RECOMMENDATION_LIMIT = 3

const SYMBOL_STOP_WORDS = new Set([
  "USD",
  "USDT",
  "FDUSD",
  "USDC",
  "BTCUSDT",
  "USDM",
  "PERP",
  "ETF",
  "APR",
  "API",
  "BINANCE",
  "FUTURES",
  "SPOT",
  "MARGIN",
  "EARN",
  "HODLER",
  "LISTING",
  "ALPHA",
  "NEWS",
  "TRADE",
  "TRADING",
  "WILL",
  "WITH",
  "AND",
  "THE",
  "NEW",
  "TOP",
])

async function fetchJson<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    headers: {
      accept: "application/json",
      "user-agent": "Mozilla/5.0",
      ...init?.headers,
    },
    cache: "no-store",
    next: { revalidate: 0 },
  })

  if (!response.ok) {
    throw new Error(`请求失败: ${response.status}`)
  }

  return response.json() as Promise<T>
}

function toNumber(value: string | number | undefined) {
  const normalized = typeof value === "number" ? value : Number(value)
  return Number.isFinite(normalized) ? normalized : 0
}

function formatIsoTime(value?: number) {
  if (!value) return new Date(0).toISOString()
  return new Date(value).toISOString()
}

function normalizeSymbol(rawSymbol: string) {
  const symbol = rawSymbol.trim().toUpperCase()
  if (!symbol || symbol.length < 2 || symbol.length > 12) {
    return null
  }
  if (SYMBOL_STOP_WORDS.has(symbol)) {
    return null
  }
  return symbol
}

export function extractSymbolsFromText(text: string) {
  const symbols = new Set<string>()
  const normalizedText = text.toUpperCase()

  const directMatches = normalizedText.match(/\$[A-Z]{2,10}\b/g) ?? []
  directMatches.forEach((match) => {
    const symbol = normalizeSymbol(match.slice(1))
    if (symbol) symbols.add(symbol)
  })

  const pairMatches = normalizedText.match(/\b[A-Z]{2,10}(?=USDT\b)/g) ?? []
  pairMatches.forEach((match) => {
    const symbol = normalizeSymbol(match)
    if (symbol) symbols.add(symbol)
  })

  const bracketMatches = normalizedText.match(/\(([A-Z]{2,10})\)/g) ?? []
  bracketMatches.forEach((match) => {
    const symbol = normalizeSymbol(match.slice(1, -1))
    if (symbol) symbols.add(symbol)
  })

  return [...symbols]
}

function scoreHotArticle(article: BinanceCmsArticle, catalog: BinanceCmsCatalog, index: number) {
  const baseCatalogHeat = toNumber(catalog.total)
  const recencyBonus = article.releaseDate ? Math.max(0, 100 - index * 5) : 0
  return baseCatalogHeat + recencyBonus
}

export async function fetchHotPosts() {
  const payload = await fetchJson<BinanceCmsResponse>(
    `${BINANCE_WEB_BASE}/bapi/composite/v1/public/cms/article/list/query?type=1&pageNo=1&pageSize=20`,
  )

  const catalogs = payload.data?.catalogs ?? []
  const posts = catalogs.flatMap((catalog) =>
    (catalog.articles ?? []).map((article, index) => {
      const title = article.title?.trim() ?? ""
      return {
        id: String(article.id ?? `${catalog.catalogId ?? "catalog"}-${index}`),
        title,
        publishedAt: formatIsoTime(article.releaseDate),
        catalogName: catalog.catalogName?.trim() || "未知分区",
        catalogTotal: toNumber(catalog.total),
        heatScore: scoreHotArticle(article, catalog, index),
        symbols: extractSymbolsFromText(title),
      } satisfies MarketAnalysisHotPost
    }),
  )

  return posts
    .filter((post) => post.title && post.symbols.length > 0)
    .sort((left, right) => {
      if (right.heatScore !== left.heatScore) {
        return right.heatScore - left.heatScore
      }
      return right.publishedAt.localeCompare(left.publishedAt)
    })
    .slice(0, HOT_POST_LIMIT)
}

export function buildCoinFrequency(posts: MarketAnalysisHotPost[]) {
  const frequencyMap = new Map<string, MarketAnalysisCoinFrequency>()

  posts.forEach((post) => {
    post.symbols.forEach((symbol) => {
      const existing = frequencyMap.get(symbol) ?? {
        symbol,
        mentionCount: 0,
        hotPostCount: 0,
        aggregatedHeatScore: 0,
        latestPublishedAt: post.publishedAt,
        sourceTitles: [],
      }

      existing.mentionCount += 1
      existing.hotPostCount += 1
      existing.aggregatedHeatScore += post.heatScore
      existing.latestPublishedAt =
        !existing.latestPublishedAt || existing.latestPublishedAt < post.publishedAt
          ? post.publishedAt
          : existing.latestPublishedAt
      if (existing.sourceTitles.length < 3) {
        existing.sourceTitles.push(post.title)
      }

      frequencyMap.set(symbol, existing)
    })
  })

  return [...frequencyMap.values()]
    .sort((left, right) => {
      if (right.mentionCount !== left.mentionCount) {
        return right.mentionCount - left.mentionCount
      }
      if (right.aggregatedHeatScore !== left.aggregatedHeatScore) {
        return right.aggregatedHeatScore - left.aggregatedHeatScore
      }
      return (right.latestPublishedAt ?? "").localeCompare(left.latestPublishedAt ?? "")
    })
    .slice(0, FREQUENT_COIN_LIMIT)
}

export async function fetchVolatilityRankings() {
  const tickers = await fetchJson<BinanceFuturesTicker[]>(`${BINANCE_FUTURES_BASE}/fapi/v1/ticker/24hr`)

  return tickers
    .filter((ticker) => ticker.symbol.endsWith("USDT"))
    .map((ticker) => {
      const openPrice = toNumber(ticker.openPrice)
      const highPrice = toNumber(ticker.highPrice)
      const lowPrice = toNumber(ticker.lowPrice)
      const lastPrice = toNumber(ticker.lastPrice)
      const priceChangePercent = toNumber(ticker.priceChangePercent)
      const volatilityPercent = openPrice > 0 ? ((highPrice - lowPrice) / openPrice) * 100 : 0

      return {
        symbol: ticker.symbol,
        baseAsset: ticker.symbol.replace(/USDT$/, ""),
        lastPrice,
        openPrice,
        highPrice,
        lowPrice,
        priceChangePercent,
        volatilityPercent,
        quoteVolume: toNumber(ticker.quoteVolume),
        tradeCount: toNumber(ticker.count),
      } satisfies MarketAnalysisVolatility
    })
    .filter((ticker) => ticker.priceChangePercent > 0 && ticker.quoteVolume > 1_000_000)
    .sort((left, right) => {
      if (right.priceChangePercent !== left.priceChangePercent) {
        return right.priceChangePercent - left.priceChangePercent
      }
      return right.quoteVolume - left.quoteVolume
    })
    .slice(0, 50)
    .sort((left, right) => {
      if (right.volatilityPercent !== left.volatilityPercent) {
        return right.volatilityPercent - left.volatilityPercent
      }
      return right.priceChangePercent - left.priceChangePercent
    })
    .slice(0, VOLATILITY_LIMIT)
}

export function buildRecommendations(
  hotPosts: MarketAnalysisHotPost[],
  frequentCoins: MarketAnalysisCoinFrequency[],
  volatilityRankings: MarketAnalysisVolatility[],
) {
  const frequentRankMap = new Map(frequentCoins.map((coin, index) => [coin.symbol, index]))
  const volatilityRankMap = new Map(volatilityRankings.map((coin, index) => [coin.baseAsset, index]))
  const hotPostMentionCount = new Map<string, number>()

  hotPosts.forEach((post) => {
    post.symbols.forEach((symbol) => {
      hotPostMentionCount.set(symbol, (hotPostMentionCount.get(symbol) ?? 0) + 1)
    })
  })

  const candidateSymbols = new Set<string>([
    ...frequentCoins.map((coin) => coin.symbol),
    ...volatilityRankings.map((coin) => coin.baseAsset),
  ])

  const recommendations = [...candidateSymbols]
    .map((symbol) => {
      const frequentCoin = frequentCoins.find((coin) => coin.symbol === symbol)
      const volatilityCoin = volatilityRankings.find((coin) => coin.baseAsset === symbol)
      const hotMentions = hotPostMentionCount.get(symbol) ?? 0
      const reasons: string[] = []
      let score = 0

      if (frequentCoin) {
        score += Math.max(0, 8 - (frequentRankMap.get(symbol) ?? 7))
        reasons.push(`进入每日高频币种榜，提及 ${frequentCoin.mentionCount} 次`)
      }

      if (volatilityCoin) {
        score += Math.max(0, 10 - (volatilityRankMap.get(symbol) ?? 9))
        reasons.push(`进入涨幅波动榜，24h 波动 ${volatilityCoin.volatilityPercent.toFixed(2)}%`)
        if (volatilityCoin.priceChangePercent > 0) {
          reasons.push(`24h 涨幅 ${volatilityCoin.priceChangePercent.toFixed(2)}%`)
        }
      }

      if (hotMentions > 0) {
        score += hotMentions * 2
        reasons.push(`出现在高热度帖子中 ${hotMentions} 次`)
      }

      if (frequentCoin && volatilityCoin) {
        score += 5
        reasons.push("同时命中高频讨论和高波动两个核心维度")
      }

      return {
        symbol,
        score,
        reasonSummary: reasons.slice(0, 3).join("，"),
        reasons,
        mentionCount: frequentCoin?.mentionCount ?? 0,
        hotPostCount: hotMentions,
        volatilityPercent: volatilityCoin?.volatilityPercent,
        priceChangePercent: volatilityCoin?.priceChangePercent,
      } satisfies MarketAnalysisRecommendation
    })
    .filter((item) => item.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score
      }
      return (right.volatilityPercent ?? 0) - (left.volatilityPercent ?? 0)
    })

  return recommendations.slice(0, RECOMMENDATION_LIMIT)
}

export async function getMarketAnalysisPayload(): Promise<MarketAnalysisPayload> {
  const generatedAt = new Date().toISOString()
  const hotPostsResult: MarketAnalysisModule<MarketAnalysisHotPost> = { items: [] }
  const frequentCoinsResult: MarketAnalysisModule<MarketAnalysisCoinFrequency> = { items: [] }
  const volatilityResult: MarketAnalysisModule<MarketAnalysisVolatility> = { items: [] }

  try {
    hotPostsResult.items = await fetchHotPosts()
    frequentCoinsResult.items = buildCoinFrequency(hotPostsResult.items)
  } catch (error) {
    const message = error instanceof Error ? error.message : "获取币安广场数据失败"
    hotPostsResult.error = message
    frequentCoinsResult.error = "由于帖子数据加载失败，无法完成高频币种统计"
  }

  try {
    volatilityResult.items = await fetchVolatilityRankings()
  } catch (error) {
    volatilityResult.error = error instanceof Error ? error.message : "获取合约行情失败"
  }

  const recommendations = buildRecommendations(
    hotPostsResult.items,
    frequentCoinsResult.items,
    volatilityResult.items,
  )

  return {
    generatedAt,
    hotPosts: hotPostsResult,
    frequentCoins: frequentCoinsResult,
    volatilityRankings: volatilityResult,
    recommendations,
    strategySummary:
      "优先选择同时进入高频讨论榜和涨幅波动榜的币种；若交集不足，则按热度提及次数、帖子热度分和 24h 波动强度做加权补位。",
  }
}
