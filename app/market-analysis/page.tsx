"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertCircle, Loader2, RefreshCcw, Sparkles, TrendingUp, Waves } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { toast } from "@/hooks/use-toast"
import type {
  MarketAnalysisCoinFrequency,
  MarketAnalysisHotPost,
  MarketAnalysisPayload,
  MarketAnalysisRecommendation,
  MarketAnalysisVolatility,
} from "@/lib/market-analysis"

function formatDateTime(value?: string) {
  if (!value) return "-"
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString("zh-CN")
}

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat("zh-CN", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value)
}

function ModuleError({ message }: { message?: string }) {
  if (!message) return null

  return (
    <Alert variant="destructive" className="mb-4">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>模块加载失败</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  )
}

function EmptyState({ message }: { message: string }) {
  return <div className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">{message}</div>
}

function HotPostsTable({ items }: { items: MarketAnalysisHotPost[] }) {
  if (items.length === 0) {
    return <EmptyState message="当前没有可展示的高热度帖子数据" />
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>帖子</TableHead>
          <TableHead>提及币种</TableHead>
          <TableHead>热度分</TableHead>
          <TableHead>发布时间</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.id}>
            <TableCell className="align-top">
              <div className="min-w-0">
                <div className="font-medium whitespace-normal">{item.title}</div>
                <div className="mt-1 text-xs text-muted-foreground">{item.catalogName}</div>
              </div>
            </TableCell>
            <TableCell className="align-top">
              <div className="flex flex-wrap gap-1">
                {item.symbols.map((symbol) => (
                  <Badge key={`${item.id}-${symbol}`} variant="secondary">
                    {symbol}
                  </Badge>
                ))}
              </div>
            </TableCell>
            <TableCell>{item.heatScore}</TableCell>
            <TableCell>{formatDateTime(item.publishedAt)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function FrequentCoinsTable({ items }: { items: MarketAnalysisCoinFrequency[] }) {
  if (items.length === 0) {
    return <EmptyState message="当前没有可展示的每日高频币种数据" />
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>币种</TableHead>
          <TableHead>帖子量</TableHead>
          <TableHead>聚合热度</TableHead>
          <TableHead>代表帖子</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.symbol}>
            <TableCell>
              <Badge variant="secondary">{item.symbol}</Badge>
            </TableCell>
            <TableCell>{item.mentionCount}</TableCell>
            <TableCell>{item.aggregatedHeatScore}</TableCell>
            <TableCell className="whitespace-normal text-sm text-muted-foreground">{item.sourceTitles[0] ?? "-"}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function VolatilityTable({ items }: { items: MarketAnalysisVolatility[] }) {
  if (items.length === 0) {
    return <EmptyState message="当前没有可展示的涨幅波动数据" />
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>合约</TableHead>
          <TableHead>24h 涨幅</TableHead>
          <TableHead>24h 波动</TableHead>
          <TableHead>最新价格</TableHead>
          <TableHead>成交额</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.symbol}>
            <TableCell>
              <div className="font-medium">{item.symbol}</div>
            </TableCell>
            <TableCell className="text-emerald-600">{item.priceChangePercent.toFixed(2)}%</TableCell>
            <TableCell>{item.volatilityPercent.toFixed(2)}%</TableCell>
            <TableCell>{item.lastPrice}</TableCell>
            <TableCell>{formatCompactNumber(item.quoteVolume)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function RecommendationList({ items, strategySummary }: { items: MarketAnalysisRecommendation[]; strategySummary: string }) {
  return (
    <div className="space-y-4">
      <Alert>
        <Sparkles className="h-4 w-4" />
        <AlertTitle>筛选逻辑</AlertTitle>
        <AlertDescription>{strategySummary}</AlertDescription>
      </Alert>

      {items.length === 0 ? (
        <EmptyState message="当前没有满足条件的建议交易币种，请稍后刷新重试" />
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {items.map((item, index) => (
            <Card key={item.symbol} className="gap-4">
              <CardHeader>
                <CardDescription>推荐候选 #{index + 1}</CardDescription>
                <CardTitle className="flex items-center gap-2 text-xl">
                  {item.symbol}
                  <Badge variant="secondary">评分 {item.score}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm text-muted-foreground">{item.reasonSummary}</div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <Badge variant="outline">帖子量 {item.mentionCount}</Badge>
                  <Badge variant="outline">热帖命中 {item.hotPostCount}</Badge>
                  {typeof item.volatilityPercent === "number" && (
                    <Badge variant="outline">波动 {item.volatilityPercent.toFixed(2)}%</Badge>
                  )}
                </div>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {item.reasons.map((reason) => (
                    <li key={reason}>- {reason}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

export default function MarketAnalysisPage() {
  const [data, setData] = useState<MarketAnalysisPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [pageError, setPageError] = useState<string | null>(null)

  const fetchAnalysis = useCallback(async (silent = false) => {
    if (silent) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }

    try {
      const response = await fetch(`/api/market-analysis?t=${Date.now()}`, { cache: "no-store" })
      if (!response.ok) {
        throw new Error("获取行情分析数据失败")
      }
      const payload = (await response.json()) as MarketAnalysisPayload
      setData(payload)
      setPageError(null)
    } catch (error) {
      const message = error instanceof Error ? error.message : "获取行情分析数据失败"
      setPageError(message)
      if (silent) {
        toast({
          title: "刷新失败",
          description: message,
          variant: "destructive",
        })
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void fetchAnalysis()
  }, [fetchAnalysis])

  const summaryStats = useMemo(() => {
    return {
      hotPosts: data?.hotPosts.items.length ?? 0,
      frequentCoins: data?.frequentCoins.items.length ?? 0,
      volatility: data?.volatilityRankings.items.length ?? 0,
      recommendations: data?.recommendations.length ?? 0,
    }
  }, [data])

  return (
    <div className="flex h-full flex-col bg-background">
      <header className="border-b bg-card">
        <div className="flex items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">行情分析</h1>
            <p className="text-sm text-muted-foreground">聚合币安广场热度、每日高频币种和合约涨幅波动，输出最终建议交易币种。</p>
          </div>
          <Button variant="outline" onClick={() => void fetchAnalysis(true)} disabled={refreshing}>
            {refreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
            刷新数据
          </Button>
        </div>
      </header>

      <div className="flex-1 space-y-6 overflow-auto p-6">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {pageError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>页面加载失败</AlertTitle>
                <AlertDescription>{pageError}</AlertDescription>
              </Alert>
            )}

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>高热度帖子</CardDescription>
                  <CardTitle className="flex items-center gap-2 text-2xl">
                    <Sparkles className="h-5 w-5 text-muted-foreground" />
                    {summaryStats.hotPosts}
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>每日高频币种</CardDescription>
                  <CardTitle className="flex items-center gap-2 text-2xl">
                    <TrendingUp className="h-5 w-5 text-muted-foreground" />
                    {summaryStats.frequentCoins}
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>涨幅波动榜</CardDescription>
                  <CardTitle className="flex items-center gap-2 text-2xl">
                    <Waves className="h-5 w-5 text-muted-foreground" />
                    {summaryStats.volatility}
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>建议交易币种</CardDescription>
                  <CardTitle className="flex items-center gap-2 text-2xl">
                    <Sparkles className="h-5 w-5 text-muted-foreground" />
                    {summaryStats.recommendations}
                  </CardTitle>
                </CardHeader>
              </Card>
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>高热度帖子 Top 5</CardTitle>
                  <CardDescription>按分区热度和发布时间加权后的帖子结果</CardDescription>
                </CardHeader>
                <CardContent>
                  <ModuleError message={data?.hotPosts.error} />
                  <HotPostsTable items={data?.hotPosts.items ?? []} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>每日高频币种 Top 5</CardTitle>
                  <CardDescription>基于高热度帖子中提及币种的聚合结果</CardDescription>
                </CardHeader>
                <CardContent>
                  <ModuleError message={data?.frequentCoins.error} />
                  <FrequentCoinsTable items={data?.frequentCoins.items ?? []} />
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>涨幅波动 Top 10</CardTitle>
                <CardDescription>从合约 24h 涨幅榜中筛出波动最大的币种</CardDescription>
              </CardHeader>
              <CardContent>
                <ModuleError message={data?.volatilityRankings.error} />
                <VolatilityTable items={data?.volatilityRankings.items ?? []} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>最终建议交易币种</CardTitle>
                <CardDescription>组合热度、提及频率和波动强度后给出推荐结果</CardDescription>
              </CardHeader>
              <CardContent>
                <RecommendationList
                  items={data?.recommendations ?? []}
                  strategySummary={data?.strategySummary ?? "当前暂无筛选策略说明"}
                />
              </CardContent>
            </Card>

            <div className="text-xs text-muted-foreground">数据生成时间：{formatDateTime(data?.generatedAt)}</div>
          </>
        )}
      </div>
    </div>
  )
}
