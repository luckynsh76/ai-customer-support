
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

app.use(cors({ origin: true }))
app.use(express.json())
app.use(express.static(path.join(__dirname, "public")))

app.use("/chat", limiter);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

app.get("/chat", (req, res) => {
  res.send("Chat endpoint is working (GET test)");
});

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
    You are the StoicCode AI assistant.

    Your job is to help visitors understand Stoic philosophy and encourage them to buy the books and products on the StoicCode website.

    Be persuasive, clear, and confident.
    Focus on the real benefits of Stoicism:
    - discipline
    - self-control
    - mental strength
    - clarity
    - peace of mind
    - resilience
    - better decision-making
    - stronger character

    Your goal is not just to explain Stoicism, but to make the visitor feel that this philosophy can improve their life right now.

    When appropriate:
    - explain how Stoicism helps in modern life
    - connect the philosophy to everyday struggles like stress, distraction, anger, weakness, fear, and lack of discipline
    - mention that the books and resources on the website can help them apply these principles
    - encourage them to explore or buy the books

    Tone:
    - deep but easy to understand
    - calm, wise, and convincing
    - not too long
    - not robotic
    - not overly salesy, but still conversion-focused

    End with a simple call to action such as:
    - "Would you like me to recommend a good book to start with?"
    - "I can help you choose the best Stoic resource."
    - "Would you like to explore the books on StoicCode?"

    Do not sound like a generic chatbot.
    Do not be vague.
    Do not mention products that are not on the website.
    `,

      law: `
    You are a professional legal assistant.
    Answer formally and clearly.
    `,

      ecommerce: `
    You are a sales assistant.
    Help convert visitors into customers.
    `,

      cyberitleads: `
    You are the CyberITLeads business assistant.

    Your job is to help businesses understand how the AI widget works and why it helps them get more leads and sales.

    Be short, clear, persuasive, and business-focused.
    Explain benefits first.
    Show how it helps capture visitors, answer questions, and convert traffic into customers.
    End with a simple next step such as:
    "Would you like to add this to your website?"
    "Do you want me to explain how it works on your site?"
    "Would you like help getting started?"

    Do not sound philosophical or like StoicCode.
    Do not be vague.
    Do not make false claims.
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

const fs = require("fs");
const path = require("path");

const LEADS_FILE = path.join(__dirname, "leads.json");

function readLeads() {
  try {
    if (!fs.existsSync(LEADS_FILE)) return [];
    const raw = fs.readFileSync(LEADS_FILE, "utf8");
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    return [];
  }
}

function saveLead(lead) {
  const leads = readLeads();
  leads.push(lead);
  fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2));
}

app.post("/lead", (req, res) => {
  try {
    const { email, message, client } = req.body;

    if (!message && !email) {
      return res.status(400).json({ error: "Missing lead data" });
    }

    const lead = {
      email: email || "",
      message: message || "",
      client: client || "default",
      createdAt: new Date().toISOString(),
      ip: req.ip
    };

    saveLead(lead);

    res.json({ ok: true, message: "Lead saved" });
  } catch (error) {
    console.error("Lead save error:", error);
    res.status(500).json({ error: "Failed to save lead" });
  }
});


const PORT = process.env.PORT || 3000

app.listen(PORT, () => {
  console.log(`CyberITLeads AI running on http://localhost:${PORT}`)
})