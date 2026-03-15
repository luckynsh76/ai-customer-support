
import 'dotenv/config'
import express from "express"
import cors from "cors"
import OpenAI from "openai"
import path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()

app.use(cors())
app.use(express.json())
app.use(express.static(path.join(__dirname, "public")))

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

app.post("/chat", async (req, res) => {

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