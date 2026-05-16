import { useState, useEffect, useMemo, useRef } from 'react'
import GameCard from './components/GameCard'
import Filters from './components/Filters'
import AIAssistant from './components/AIAssistant'
import styles from './App.module.css'

const DEFAULT_FILTERS = {
  search: '',
  players: '',
  timeMax: '',
  complexity: '',
  location: '',
  tags: [],
  availableOnly: false,
  baseOnly: false,
  sort: 'title',
}

const LIMIT = 48

function applyFilters(allGames, f) {
  let results = allGames
  if (f.search) {
    const q = f.search.toLowerCase()
    results = results.filter(g => (g.title || '').toLowerCase().includes(q))
  }
  if (f.players) {
    const p = parseInt(f.players, 10)
    results = results.filter(g =>
      g.players_min != null && g.players_max != null &&
      g.players_min <= p && p <= g.players_max
    )
  }
  if (f.timeMax) {
    const t = parseInt(f.timeMax, 10)
    results = results.filter(g => g.playing_time != null && g.playing_time <= t)
  }
  if (f.location) results = results.filter(g => g.locations?.includes(f.location))

  if (f.complexity === 'easy') results = results.filter(g => g.bgg_weight != null && g.bgg_weight <= 2)
  else if (f.complexity === 'medium') results = results.filter(g => g.bgg_weight != null && g.bgg_weight > 2 && g.bgg_weight <= 3.5)
  else if (f.complexity === 'hard') results = results.filter(g => g.bgg_weight != null && g.bgg_weight > 3.5)

  if (f.tags?.length) results = results.filter(g => f.tags.some(t => g.tags?.includes(t)))

  if (f.availableOnly) results = results.filter(g => g.available)
  if (f.baseOnly) results = results.filter(g => !g.expansion)

  if (f.sort === 'players_min') {
    results = [...results].sort((a, b) => (a.players_min ?? 999) - (b.players_min ?? 999))
  } else if (f.sort === 'playing_time') {
    results = [...results].sort((a, b) => (a.playing_time ?? 999) - (b.playing_time ?? 999))
  } else if (f.sort === 'bgg_weight') {
    results = [...results].sort((a, b) => (a.bgg_weight ?? 999) - (b.bgg_weight ?? 999))
  } else {
    results = [...results].sort((a, b) => (a.title || '').toLowerCase().localeCompare((b.title || '').toLowerCase()))
  }
  return results
}

export default function App() {
  const [filters, setFilters] = useState(DEFAULT_FILTERS)
  const [allGames, setAllGames] = useState([])
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [showAI, setShowAI] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const debounceRef = useRef(null)

  useEffect(() => {
    fetch('/games.json')
      .then(r => r.json())
      .then(data => { setAllGames(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => applyFilters(allGames, filters), [allGames, filters])

  const stats = useMemo(() => {
    if (!allGames.length) return null
    const expansions = allGames.filter(g => g.expansion).length
    return {
      total: allGames.length,
      available: allGames.filter(g => g.available).length,
      base_games: allGames.length - expansions,
    }
  }, [allGames])

  const games = useMemo(() => filtered.slice(offset, offset + LIMIT), [filtered, offset])
  const total = filtered.length

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setOffset(0), 0)
    return () => clearTimeout(debounceRef.current)
  }, [filters])

  const activeFilterCount = [
    filters.search,
    filters.players,
    filters.timeMax,
    filters.complexity,
    filters.location,
    filters.availableOnly,
    filters.baseOnly,
    ...(filters.tags || []),
  ].filter(Boolean).length

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  const totalPages = Math.ceil(filtered.length / LIMIT)
  const currentPage = Math.floor(offset / LIMIT) + 1

  return (
    <div className={styles.layout}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.brand}>
            <span className={styles.brandDot} />
            <div>
              <h1 className={styles.title}>Conexión Berlín</h1>
              <p className={styles.subtitle}>Catálogo de juegos de mesa</p>
            </div>
          </div>

          {stats && (
            <div className={styles.stats}>
              <div className={styles.stat}>
                <span className={styles.statNum}>{stats.total.toLocaleString()}</span>
                <span className={styles.statLabel}>juegos</span>
              </div>
              <div className={styles.stat}>
                <span className={styles.statNum}>{stats.available.toLocaleString()}</span>
                <span className={styles.statLabel}>disponibles</span>
              </div>
              <div className={styles.stat}>
                <span className={styles.statNum}>{stats.base_games.toLocaleString()}</span>
                <span className={styles.statLabel}>base</span>
              </div>
            </div>
          )}

          <button
            className={`${styles.aiToggle} ${showAI ? styles.aiToggleActive : ''}`}
            onClick={() => setShowAI(s => !s)}
          >
            <span>✦</span> <span className={styles.aiLabel}>Asistente IA</span>
          </button>
        </div>
      </header>

      <div className={styles.body}>
        {/* Desktop sidebar */}
        <aside className={styles.sidebar}>
          <Filters filters={filters} onChange={handleFilterChange} />
        </aside>

        <main className={styles.main}>
          <div className={styles.resultsBar}>
            <span className={styles.resultCount}>
              {loading ? 'Buscando juegos…' : `${total.toLocaleString()} juegos`}
            </span>
            {activeFilterCount > 0 && !loading && (
              <button className={styles.clearBtn} onClick={() => setFilters(DEFAULT_FILTERS)}>
                Limpiar ×
              </button>
            )}
            {/* Mobile filter toggle */}
            <button
              className={styles.filterToggle}
              onClick={() => setShowFilters(s => !s)}
            >
              Filtros {activeFilterCount > 0 && <span className={styles.filterBadge}>{activeFilterCount}</span>}
              <span>{showFilters ? '▲' : '▼'}</span>
            </button>
          </div>

          {/* Mobile filters drawer */}
          {showFilters && (
            <div className={styles.mobileFilters}>
              <Filters filters={filters} onChange={handleFilterChange} />
            </div>
          )}

          {!loading && games.length === 0 && (
            <div className={styles.empty}>
              <div className={styles.emptyDice}>🎲</div>
              <p className={styles.emptyTitle}>Ningún juego coincide</p>
              <p className={styles.emptyHint}>Probá con menos filtros o jugá a la suerte</p>
              {activeFilterCount > 0 && (
                <button className={styles.emptyClear} onClick={() => setFilters(DEFAULT_FILTERS)}>
                  Limpiar todos los filtros
                </button>
              )}
            </div>
          )}

          <div className={styles.grid}>
            {games.map((game, i) => (
              <GameCard key={game.id} game={game} index={i} />
            ))}
          </div>

          {totalPages > 1 && (
            <div className={styles.pagination}>
              <button
                className={styles.pageBtn}
                onClick={() => setOffset(Math.max(0, offset - LIMIT))}
                disabled={offset === 0}
              >
                ← Anterior
              </button>
              <span className={styles.pageInfo}>{currentPage} / {totalPages}</span>
              <button
                className={styles.pageBtn}
                onClick={() => setOffset(offset + LIMIT)}
                disabled={currentPage >= totalPages}
              >
                Siguiente →
              </button>
            </div>
          )}

          {/* Bottom safe-area padding on mobile */}
          <div className={styles.bottomSpacer} />
        </main>
      </div>

      {/* Mobile bottom bar */}
      <nav className={styles.mobileBar}>
        <button
          className={`${styles.mobileBarBtn} ${showFilters ? styles.mobileBarBtnActive : ''}`}
          onClick={() => { setShowFilters(s => !s); setShowAI(false) }}
        >
          <span>⚙</span>
          Filtros
          {activeFilterCount > 0 && <span className={styles.filterBadge}>{activeFilterCount}</span>}
        </button>
        <button
          className={`${styles.mobileBarBtn} ${showAI ? styles.mobileBarBtnActive : ''}`}
          onClick={() => { setShowAI(s => !s); setShowFilters(false) }}
        >
          <span>✦</span>
          Asistente IA
        </button>
      </nav>

      {showAI && (
        <AIAssistant onClose={() => setShowAI(false)} allGames={allGames} />
      )}
    </div>
  )
}
