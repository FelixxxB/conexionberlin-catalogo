import { useState, useEffect, useCallback, useRef } from 'react'

const API = import.meta.env.VITE_API_URL || ''
import GameCard from './components/GameCard'
import Filters from './components/Filters'
import AIAssistant from './components/AIAssistant'
import styles from './App.module.css'

const DEFAULT_FILTERS = {
  search: '',
  players: '',
  timeMax: '',
  availableOnly: false,
  baseOnly: false,
  sort: 'title',
}

const LIMIT = 48

export default function App() {
  const [filters, setFilters] = useState(DEFAULT_FILTERS)
  const [games, setGames] = useState([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState(null)
  const [showAI, setShowAI] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const debounceRef = useRef(null)

  const activeFilterCount = [
    filters.search,
    filters.players,
    filters.timeMax,
    filters.availableOnly,
    filters.baseOnly,
  ].filter(Boolean).length

  const fetchGames = useCallback(async (f, off) => {
    setLoading(true)
    const params = new URLSearchParams()
    if (f.search) params.set('search', f.search)
    if (f.players) params.set('players', f.players)
    if (f.timeMax) params.set('time_max', f.timeMax)
    if (f.availableOnly) params.set('available_only', 'true')
    if (f.baseOnly) params.set('base_only', 'true')
    if (f.sort) params.set('sort', f.sort)
    params.set('limit', LIMIT)
    params.set('offset', off)

    try {
      const res = await fetch(`${API}/api/games?${params}`)
      const data = await res.json()
      setGames(data.games)
      setTotal(data.total)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetch(`${API}/api/stats`).then(r => r.json()).then(setStats).catch(() => {})
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setOffset(0)
      fetchGames(filters, 0)
    }, 250)
    return () => clearTimeout(debounceRef.current)
  }, [filters, fetchGames])

  useEffect(() => {
    fetchGames(filters, offset)
  }, [offset]) // eslint-disable-line

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  const totalPages = Math.ceil(total / LIMIT)
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
              {loading ? 'Cargando...' : `${total.toLocaleString()} juegos`}
            </span>
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
              <p>No se encontraron juegos con esos filtros.</p>
            </div>
          )}

          <div className={styles.grid}>
            {games.map(game => (
              <GameCard key={game.id} game={game} />
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
        <AIAssistant onClose={() => setShowAI(false)} />
      )}
    </div>
  )
}
