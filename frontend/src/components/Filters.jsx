import styles from './Filters.module.css'

const PLAYER_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8]
const TIME_OPTIONS = [
  { label: 'Cualquier tiempo', value: '' },
  { label: 'Hasta 15 min', value: '15' },
  { label: 'Hasta 30 min', value: '30' },
  { label: 'Hasta 60 min', value: '60' },
  { label: 'Hasta 90 min', value: '90' },
  { label: 'Hasta 120 min', value: '120' },
]

const SORT_OPTIONS = [
  { label: 'A–Z', value: 'title' },
  { label: 'Jugadores', value: 'players_min' },
  { label: 'Duración', value: 'playing_time' },
]

export default function Filters({ filters, onChange }) {
  return (
    <div className={styles.sidebar}>
      <div className={styles.section}>
        <label className={styles.label}>Buscar</label>
        <input
          type="search"
          className={styles.input}
          placeholder="Nombre del juego..."
          value={filters.search}
          onChange={e => onChange('search', e.target.value)}
        />
      </div>

      <div className={styles.section}>
        <label className={styles.label}>Jugadores</label>
        <div className={styles.playerGrid}>
          <button
            className={`${styles.playerBtn} ${filters.players === '' ? styles.playerBtnActive : ''}`}
            onClick={() => onChange('players', '')}
          >
            Todos
          </button>
          {PLAYER_OPTIONS.map(n => (
            <button
              key={n}
              className={`${styles.playerBtn} ${filters.players === String(n) ? styles.playerBtnActive : ''}`}
              onClick={() => onChange('players', filters.players === String(n) ? '' : String(n))}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.section}>
        <label className={styles.label}>Tiempo de juego</label>
        <select
          className={styles.select}
          value={filters.timeMax}
          onChange={e => onChange('timeMax', e.target.value)}
        >
          {TIME_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      <div className={styles.section}>
        <label className={styles.label}>Ordenar por</label>
        <div className={styles.sortGroup}>
          {SORT_OPTIONS.map(o => (
            <button
              key={o.value}
              className={`${styles.sortBtn} ${filters.sort === o.value ? styles.sortBtnActive : ''}`}
              onClick={() => onChange('sort', o.value)}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.section}>
        <label className={styles.label}>Opciones</label>
        <div className={styles.checkGroup}>
          <label className={styles.checkLabel}>
            <input
              type="checkbox"
              className={styles.check}
              checked={filters.availableOnly}
              onChange={e => onChange('availableOnly', e.target.checked)}
            />
            Solo disponibles
          </label>
          <label className={styles.checkLabel}>
            <input
              type="checkbox"
              className={styles.check}
              checked={filters.baseOnly}
              onChange={e => onChange('baseOnly', e.target.checked)}
            />
            Solo juegos base
          </label>
        </div>
      </div>
    </div>
  )
}
