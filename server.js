import rateLimit from "express-rate-limit"
import "dotenv/config"
import express from "express"
import cors from "cors"
import OpenAI from "openai"
import path from "path"
import { fileURLToPath } from "url"
import fs from "fs"
import { createClient } from "@supabase/supabase-js"
import Stripe from "stripe"
import nodemailer from "nodemailer"
import { v4 as uuidv4 } from "uuid"

// ===== INIT =====
const app = express()

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// ===== RATE LIMIT =====
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false
})

// ===== IMPORTANT: STRIPE WEBHOOK FIRST =====
app.post("/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  const sig = req.headers["stripe-signature"]

  let event

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    )
  } catch (err) {
    console.error("Webhook error:", err.message)
    return res.sendStatus(400)
  }

  if (event.type === "checkout.session.completed") {
    console.log("✅ PAYMENT SUCCESS")

    const session = event.data.object
    const email = session.customer_email
    const userId = uuidv4()

    console.log("User created:", { userId, email })

    // ===== SEND EMAIL =====
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false, // VERY IMPORTANT
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      },
      tls: {
        rejectUnauthorized: false
      }
    })

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Your AI Bot is Ready 🚀",
      html: `
        <h2>Your AI Assistant is Ready</h2>
        <p>Copy and paste this into your website:</p>
        <pre style="background:#111;color:#0f0;padding:10px;border-radius:6px;">
&lt;script src="${process.env.BASE_URL}/widget.js" data-user="${userId}"&gt;&lt;/script&gt;
        </pre>
      `
    })
  }

  res.sendStatus(200)
})

// ===== NORMAL MIDDLEWARE AFTER =====
app.use(express.json())
app.use(cors())
app.use(limiter)
app.use(express.static(path.join(__dirname, "public")))

// ===== STRIPE ROUTES =====
app.get("/create-checkout-session", async (req, res) => {
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "AI Widget Access"
            },
            unit_amount: 3000
          },
          quantity: 1
        }
      ],
      customer_email: req.query.email,
      success_url: `${process.env.BASE_URL}/success`,
      cancel_url: `${process.env.BASE_URL}/cancel`
    })

    res.redirect(session.url)
  } catch (error) {
    console.error(error)
    res.status(500).send("Error creating checkout session")
  }
})

app.get("/success", (req, res) => {
  res.send("✅ Payment successful!")
})

app.get("/cancel", (req, res) => {
  res.send("❌ Payment cancelled")
})

// ===== CHAT =====
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
    You are an AI assistant for a pizza or fast-food restaurant.

    Your goal is to help customers:
    • See the menu
    • Ask about opening hours
    • Order food
    • Request delivery or pickup
    • Get quick answers

    Be friendly, fast, and helpful.

    Always:
    • Keep answers short and clear
    • Guide the customer toward ordering
    • Ask follow-up questions
    • Suggest popular items (pizza, drinks, combos)

    Examples of behavior:

    If user asks about menu:
    → "We have Margherita, Pepperoni, and special pizzas. Would you like to order one?"

    If user asks if open:
    → "Yes, we’re open now. Would you like to place an order for pickup or delivery?"

    If user is unsure:
    → "Our most popular is the Pepperoni pizza. Want me to add that for you?"

    If user shows interest:
    → Ask for:
    - order details
    - pickup or delivery
    - contact info

    Always move toward:
    → "Would you like to place your order now?"

    If conversation ends:
    → "Would you like help placing your order or checking our menu?"

    If customer is ready:
    → "Please enter your email and your order details, and we’ll confirm your order shortly."

    Do NOT:
    • Be long
    • Be robotic
    • Be philosophical
    • Be vague

    Focus on helping customers order quickly and easily.
    `
    }

    const client = req.query.client || "default"

    console.log("FULL QUERY:", req.query)
    console.log("CLIENT:", client)
    console.log("SYSTEM PROMPT:", CLIENTS[client])


    const systemPrompt = CLIENTS[client] || "You are a helpful AI assistant."

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage }
      ],
      max_tokens: 300
    })

    const reply = completion.choices[0].message.content || "No response"

    res.json({ reply });

  } catch (error) {
    console.error("CHAT ERROR:", error);
    res.status(500).json({ reply: "AI request failed" })
  }
})

// ===== LEADS =====
app.post("/lead", async (req, res) => {
  try {
    const { email, message, client } = req.body

    if (!email || !message) {
      return res.status(400).json({ error: "Missing lead data" })
    }

    const { error } = await supabase
      .from("leads")
      .insert([
        {
          email,
          message,
          client: client || "default",
          created_at: new Date().toISOString()
        }
      ])

    if (error) {
      console.error(error)
      return res.status(500).json({ error: "Failed to save lead" })
    }

    /* ===== SEND EMAIL TO YOU (BUSINESS) ===== */
    await transporter.sendMail({
      from: `"CyberITLeads" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_USER,
      subject: "🔥 New Lead Captured",
      html: `
        <h2>New Lead</h2>
        <p><b>Email:</b> ${email}</p>
        <p><b>Message:</b> ${message}</p>
        <p><b>Client:</b> ${client || "default"}</p>
      `
    });
    /* ===== SEND EMAIL TO CLIENT ===== */
    await transporter.sendMail({
      from: `"CyberITLeads" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "🚀 We received your request",
      html: `
        <h2>You're in.</h2>
        <p>Thanks for your interest in CyberITLeads.</p>
        <p>We’ve received your request and will help you set up your AI assistant.</p>
        <p>Expect a response shortly.</p>
        <hr/>
        <p><b>Your message:</b></p>
        <p>${message}</p>
        <br/>
        <p>— CyberITLeads Team</p>
      `
    });

    /* ===== RESPONSE ===== */
    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: "Server error" })
  }
})

// ===== START SERVER =====
const PORT = process.env.PORT || 3000

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`)
})
