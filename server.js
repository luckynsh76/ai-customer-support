
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
  "restaurant_tonys_pizza_key",
  "restaurant_burger_house_key"
]

// 🌐 Allowed websites using the widget

const ALLOWED_DOMAINS = [
  "tonyspizza.com",
  "burgerhouse.se",
  "localhost"
]

app.use(cors())
app.use(express.json())
app.use(express.static(path.join(__dirname, "public")))

app.use("/chat", limiter);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

app.post("/chat", verifyClient, async (req, res) => {
  const clientKey = req.headers["x-client-key"]

  if (!CLIENT_KEYS.includes(clientKey)) {
    return res.status(403).json({ error: "Invalid client key" })
  }

  try {

    const userMessage = req.body.message

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a helpful AI assistant for a restaurant. Answer questions about menu, hours, location, reservations and food."
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
  console.log(`AI Restaurant Assistant running on http://localhost:${PORT}`)
})