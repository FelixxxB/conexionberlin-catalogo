import { useState, useRef, useEffect } from 'react'
import styles from './AIAssistant.module.css'

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || ''
const GEMINI_MODEL = 'gemini-3.1-flash-lite'
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`

const SUGGESTIONS = [
  'Juegos para 4 personas, menos de 30 min',
  'Me gustó Catan, ¿qué más recomendás?',
  'Juegos cooperativos para 2 jugadores',
  'El mejor juego de estrategia para principiantes',
]

function buildCatalogContext(allGames) {
  const lines = []
  for (const g of allGames) {
    if (!g.available) continue
    let p = ''
    if (g.players_min && g.players_max) p = `${g.players_min}-${g.players_max}j`
    else if (g.players_min) p = `${g.players_min}j+`
    const t = g.playing_time ? `${g.playing_time}min` : ''
    const exp = g.expansion ? ' [exp]' : ''
    const weight = g.bgg_weight ? ` complejidad:${g.bgg_weight.toFixed(1)}` : ''
    const tags = g.tags?.length ? ` [${g.tags.join(', ')}]` : ''
    const author = g.authors?.length ? ` autor:${g.authors[0]}` : ''
    const year = g.year ? ` ${g.year}` : ''
    lines.push(`- ${g.title} (${p}, ${t}${exp}${weight}${author}${year}${tags})`)
    if (lines.length >= 600) break
  }
  return lines.join('\n')
}

function matchGamesByTitles(titles, allGames) {
  const byTitle = {}
  for (const g of allGames) byTitle[g.title.toLowerCase()] = g

  const results = []
  const seen = new Set()
  for (const title of titles) {
    const key = title.toLowerCase().trim()
    let game = byTitle[key]
    if (!game) {
      for (const [catalogKey, g] of Object.entries(byTitle)) {
        if (key.includes(catalogKey) || catalogKey.includes(key)) {
          game = g
          break
        }
      }
    }
    if (game && !seen.has(game.id)) {
      results.push(game)
      seen.add(game.id)
    }
  }
  return results
}

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

export default function AIAssistant({ onClose, allGames = [] }) {
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

    if (!GEMINI_API_KEY) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        text: 'Configurá la variable VITE_GEMINI_API_KEY para activar el asistente.',
        games: [],
      }])
      setLoading(false)
      return
    }

    try {
      const catalogText = buildCatalogContext(allGames)
      const systemPrompt = `Eres un experto en juegos de mesa del café Conexión Berlín en Buenos Aires.
Ayudás a los clientes a encontrar juegos de mesa según sus preferencias.

El catálogo de juegos disponibles:
Formato: nombre (jugadores, tiempo, [exp]=expansión, complejidad 1-5, autor, año, [tags])
${catalogText}

Tags comunes: cooperativo, estrategia, familia, cartas, dados, inicial, party, temático, abstracto, económico, deckbuilding, worker-placement, entre otros.
Complejidad: 1=muy fácil, 2=fácil, 3=medio, 4=difícil, 5=muy difícil.

INSTRUCCIONES DE RESPUESTA:
Respondé SIEMPRE con un objeto JSON válido con esta estructura exacta:
{
  "text": "Tu respuesta conversacional en español, amigable y concisa",
  "recommendations": ["Título exacto del juego 1", "Título exacto del juego 2", ...]
}

- "text": tu respuesta en lenguaje natural, sin listar los juegos de nuevo (las tarjetas se muestran aparte)
- "recommendations": lista de títulos EXACTOS del catálogo (copiados tal cual aparecen arriba). Solo incluir si estás recomendando juegos. Lista vacía [] si no aplica.

Reglas:
- Sugerí 3-6 juegos que mejor se ajusten al pedido
- Usá los tags, la complejidad y el autor para hacer mejores recomendaciones
- Solo recomendá juegos del catálogo
- Si el usuario hace pregunta general, respondé sin recomendaciones`

      const res = await fetch(GEMINI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: 'user', parts: [{ text }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            maxOutputTokens: 1024,
          },
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error?.message || `HTTP ${res.status}`)
      }

      const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
      let responseText = raw
      let games = []
      try {
        const parsed = JSON.parse(raw)
        responseText = parsed.text || raw
        games = matchGamesByTitles(parsed.recommendations || [], allGames)
      } catch {
        // raw text response, no recommendations
      }

      setMessages(prev => [...prev, { role: 'assistant', text: responseText, games }])
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        text: `Error al conectar con el asistente: ${err.message}`,
        games: [],
      }])
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
