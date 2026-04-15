
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
  "http://localhost:3000",
  "https://stoiccode.org",
  "https://cyberitleads.org"
]

app.use(cors({
  origin: function(origin, callback) {
    if (!origin || ALLOWED_DOMAINS.includes(origin)) {
      callback(null, true)
    } else {
      callback(new Error("Not allowed by CORS"))
    }
  }
}))
app.use(express.json())
app.use(express.static(path.join(__dirname, "public")))

app.use("/chat", limiter);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

app.post("/chat", async (req, res) => {
  try {
    const userMessage = req.body.message

    const CLIENTS = {
      restaurant: `
    You are a restaurant AI assistant.
    Answer only about:
    - menu
    - food
    - drinks
    - reservations
    - opening hours
    - location

    If question is unrelated, guide back to restaurant topics.
    Be short, helpful, direct.
    `,

      stoiccode: `
    You are StoicCode's AI assistant.
    Help with:
    - mindset
    - discipline
    - philosophy
    - self-improvement

    Be deep but clear.
    `,

      law: `
    You are a professional legal assistant.
    Answer formally and clearly.
    `,

      ecommerce: `
    You are a sales assistant.
    Help convert visitors into customers.
    `
    }

    const client = req.query.client || "default"

    console.log("FULL QUERY:", req.query)
    console.log("CLIENT:", client)
    console.log("SYSTEM PROMPT:", CLIENTS[client])


    const systemPrompt = CLIENTS[client] || `
    You are a helpful AI assistant.
    `

    // 🚀 OPENAI CALL (THIS WAS MISSING / WRONG)
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: userMessage
        }
      ],
      max_tokens: 300
    })

    const reply = completion.choices[0].message.content || "No response"

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
  console.log(`CyberITLeads AI running on http://localhost:${PORT}`)
})