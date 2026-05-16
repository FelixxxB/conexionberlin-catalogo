import { useState } from 'react'
import styles from './GameCard.module.css'

export default function GameCard({ game }) {
  const [imgError, setImgError] = useState(false)

  const players =
    game.players_min && game.players_max
      ? game.players_min === game.players_max
        ? `${game.players_min}`
        : `${game.players_min}–${game.players_max}`
      : game.players_min
      ? `${game.players_min}+`
      : null

  const time = game.playing_time ? `${game.playing_time} min` : null

  return (
    <a
      href={game.detail_url}
      target="_blank"
      rel="noopener noreferrer"
      className={`${styles.card} ${!game.available ? styles.unavailable : ''}`}
    >
      <div className={styles.imageWrap}>
        {!imgError && game.image_url ? (
          <img
            src={game.image_url}
            alt={game.title}
            className={styles.image}
            onError={() => setImgError(true)}
            loading="lazy"
          />
        ) : (
          <div className={styles.imagePlaceholder}>
            <span>🎲</span>
          </div>
        )}
        {game.expansion && <span className={styles.badge}>Expansión</span>}
        {!game.available && <span className={styles.unavailableBadge}>No disponible</span>}
      </div>

      <div className={styles.info}>
        <p className={styles.name}>{game.title}</p>
        <div className={styles.meta}>
          {players && (
            <span className={styles.metaItem} title="Jugadores">
              👥 {players}
            </span>
          )}
          {time && (
            <span className={styles.metaItem} title="Tiempo">
              ⏱ {time}
            </span>
          )}
        </div>
      </div>
    </a>
  )
}
