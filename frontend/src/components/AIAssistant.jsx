import { useState, useRef, useEffect } from 'react'
import styles from './AIAssistant.module.css'

const SUGGESTIONS = [
  'Juegos para 4 personas, menos de 30 min',
  'Me gustó Catan, ¿qué más recomendás?',
  'Juegos cooperativos para 2 jugadores',
  'El mejor juego de estrategia para principiantes',
]

function GameCarousel({ games }) {
  if (!games || games.length === 0) return null
  return (
    <div className={styles.carousel}>
      {games.map(game => {
        const players =
          game.players_min && game.players_max
            ? game.players_min === game.players_max
              ? `${game.players_min}`
              : `${game.players_min}–${game.players_max}`
            : game.players_min ? `${game.players_min}+` : null
        const time = game.playing_time ? `${game.playing_time}m` : null

        return (
          <a
            key={game.id}
            href={game.detail_url}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.card}
          >
            {game.image_url ? (
              <img
                src={game.image_url}
                alt={game.title}
                className={styles.cardImg}
                onError={e => { e.target.style.display = 'none' }}
              />
            ) : (
              <div className={styles.cardImgPlaceholder}>🎲</div>
            )}
            <div className={styles.cardInfo}>
              <p className={styles.cardName}>{game.title}</p>
              <div className={styles.cardMeta}>
                {players && <span>👥 {players}</span>}
                {time && <span>⏱ {time}</span>}
              </div>
            </div>
          </a>
        )
      })}
    </div>
  )
}

export default function AIAssistant({ onClose }) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text: '¡Hola! Soy el asistente de Conexión Berlín. Puedo ayudarte a encontrar el juego perfecto o recomendarte algo según tus gustos. ¿En qué te ayudo?',
      games: [],
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = async (text) => {
    if (!text.trim() || loading) return
    setMessages(prev => [...prev, { role: 'user', text, games: [] }])
    setInput('')
    setLoading(true)

    try {
      const API = import.meta.env.VITE_API_URL || ''
      const res = await fetch(`${API}/api/ai/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      })
      const data = await res.json()
      if (data.detail) {
        const msg = data.detail.includes('GEMINI_API_KEY')
          ? 'Configurá la variable GEMINI_API_KEY en el servidor para activar el asistente.\n\nexport GEMINI_API_KEY=AIzaSy...'
          : `Error: ${data.detail}`
        setMessages(prev => [...prev, { role: 'assistant', text: msg, games: [] }])
      } else {
        setMessages(prev => [...prev, {
          role: 'assistant',
          text: data.response,
          games: data.games || [],
        }])
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', text: 'Error al conectar con el asistente.', games: [] }])
    } finally {
      setLoading(false)
    }
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send(input)
    }
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <div className={styles.panelTitle}>
            <span className={styles.titleIcon}>✦</span>
            Asistente IA
          </div>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div className={styles.messages}>
          {messages.map((msg, i) => (
            <div key={i} className={styles.msgGroup}>
              <div className={`${styles.msg} ${msg.role === 'user' ? styles.msgUser : styles.msgAI}`}>
                {msg.role === 'assistant' && (
                  <span className={styles.msgAvatar}>✦</span>
                )}
                <div className={styles.msgBubble}>
                  {msg.text.split('\n').filter(Boolean).map((line, j) => (
                    <p key={j}>{line}</p>
                  ))}
                </div>
              </div>
              {msg.role === 'assistant' && msg.games?.length > 0 && (
                <GameCarousel games={msg.games} />
              )}
            </div>
          ))}
          {loading && (
            <div className={`${styles.msg} ${styles.msgAI}`}>
              <span className={styles.msgAvatar}>✦</span>
              <div className={styles.msgBubble}>
                <span className={styles.typing}>
                  <span /><span /><span />
                </span>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {messages.length === 1 && (
          <div className={styles.suggestions}>
            {SUGGESTIONS.map(s => (
              <button key={s} className={styles.suggestion} onClick={() => send(s)}>
                {s}
              </button>
            ))}
          </div>
        )}

        <div className={styles.inputRow}>
          <textarea
            className={styles.input}
            rows={2}
            placeholder="Preguntame sobre juegos..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
          />
          <button
            className={styles.sendBtn}
            onClick={() => send(input)}
            disabled={loading || !input.trim()}
          >
            →
          </button>
        </div>
      </div>
    </div>
  )
}
