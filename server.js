
import rateLimit from "express-rate-limit"
import 'dotenv/config'
import express from "express"
import cors from "cors"
import OpenAI from "openai"
import path from "path"
import { fileURLToPath } from "url"

const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // max requests per minute
  message: { error: "Too many requests. Please slow down." }
});


const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()

// 🔐 Allowed SaaS clients
const CLIENT_KEYS = [
  "stoiccode_main_key"
]

// 🌐 Allowed websites using the widget

const ALLOWED_DOMAINS = [
  "stoiccode.org",
  "localhost"
]

app.use(cors())
app.use(express.json())
app.use(express.static(path.join(__dirname, "public")))

app.use("/chat", limiter);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

app.post("/chat", async (req, res) => {
  const clientKey = req.headers["x-client-key"]

  if (!CLIENT_KEYS.includes(clientKey)) {
    return res.status(403).json({ error: "Invalid client key" })
  }

  const origin = req.headers.origin || req.headers.referer || ""
  const domainAllowed = ALLOWED_DOMAINS.some(domain =>
    origin.includes(domain)
  )

  if (!domainAllowed) {
    return res.status(403).json({ error: "Domain not allowed" })
  }

  try {

    const userMessage = req.body.message

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are StoicCode's AI assistant. Help users with Stoic philosophy, self-discipline, mindset, wallpapers, products, and general website support. Speak calmly, clearly, and with depth."
        },
        {
          role: "user",
          content: userMessage
        }
      ],
      max_tokens: 300
    })

    const reply = completion.choices[0].message.content

    res.json({ reply })

  } catch (error) {

    console.error(error)

    res.status(500).json({
      error: "AI request failed"
    })
  }

})

const PORT = process.env.PORT || 3000

app.listen(PORT, () => {
  console.log(`StoicCode AI Assistant running on http://localhost:${PORT}`)
})