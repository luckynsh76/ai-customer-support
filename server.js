import "dotenv/config"
import rateLimit from "express-rate-limit"
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
import { findMatchingProducts } from "./router.js";
import { PRODUCTS } from "./BOOKSLINKS.js"

const sessions = {}


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
    const plan = session.metadata.plan || "starter"
    const clientId = `rest_${uuidv4().slice(0, 8)}`

    await supabase.from("clients").insert([
      {
        client_id: clientId,
        email: email,
        plan: plan,
        created_at: new Date().toISOString()
      }
    ])

    const script = `<script src="${process.env.BASE_URL}/widget.js?client=${clientId}"></script>`

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
&lt;script src="${process.env.BASE_URL}/widget.js?client=${clientId}"&gt;&lt;/script&gt;
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
  // ===== GET PLAN + EMAIL =====
  const plan = req.query.plan || "starter"
  const email = req.query.email

  if (!email) {
    return res.status(400).send("Email is required")
  }

  // ===== PRICING LOGIC =====
  let price = 3000 // $30 default

  if (plan === "pro") price = 7000 // $70
  if (plan === "premium") price = 15000 // $150

  // ===== CREATE STRIPE SESSION =====
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    mode: "payment",

    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: `CyberITLeads AI Bot (${plan})`
          },
          unit_amount: price
        },
        quantity: 1
      }
    ],

    // 🔥 THIS IS CRITICAL (used in webhook)
    metadata: {
      plan: plan
    },

    customer_email: email,

    success_url: `${process.env.BASE_URL}/success`,
    cancel_url: `${process.env.BASE_URL}/cancel`
  })

  // ===== REDIRECT USER TO STRIPE =====
  res.redirect(session.url)

  } catch (error) {
    console.error("STRIPE ERROR:", error)
    res.status(500).send("Error creating checkout session")
  }
})


app.get("/success", (req, res) => {
  res.send("✅ Payment successful!")
})

app.get("/cancel", (req, res) => {
  res.send("❌ Payment cancelled")
})

function summarizeOrder(order) {
  const counts = {}

  order.forEach(item => {
    counts[item] = (counts[item] || 0) + 1
  })

  return Object.entries(counts)
    .map(([item, qty]) => {
      const cleanName = item.replace("_", " ")
      return `${qty} ${cleanName}`
    })
    .join(", ")
  }
// ===== CHAT =====
app.post("/chat", async (req, res) => {
  const message = req.body.message || ""
  const lowerMsg = message.toLowerCase()
  const userId = req.ip
  const client = req.body.clientId || "default"

  if (!sessions[userId]) {
    sessions[userId] = { order: [] }
  }

  const session = sessions[userId]

  const menu = {
    pizza: ["pizza"],
    burger: ["burger"],
    cola: ["cola", "drink", "soda"],
    fries: ["fries", "chips"],
    garlic_bread: ["garlic bread", "garlic"]
  }

  // ===== ADD ITEMS =====
  Object.entries(menu).forEach(([key, aliases]) => {
    aliases.forEach(alias => {
      if (lowerMsg.includes(alias)) {
        const match = lowerMsg.match(new RegExp(`(\\d+)\\s*${alias}`))
        const qty = match ? parseInt(match[1]) : 1

        for (let i = 0; i < qty; i++) {
          session.order.push(key)
        }
      }
    })
  })

  // ===== REMOVE ITEM =====
  if (lowerMsg.includes("remove")) {
    const item = menu.find(i => lowerMsg.includes(i))

    if (!item) {
      return res.json({ reply: "What do you want to remove?" })
    }

    const index = session.order.indexOf(item)

    if (index === -1) {
      return res.json({ reply: `No ${item} in your order.` })
    }

    session.order.splice(index, 1)

    return res.json({
      reply: `Removed 1 ${item}. Now: ${summarizeOrder(session.order)}`
    })
  }

  // ===== CLEAR ORDER =====
  if (lowerMsg.includes("cancel") || lowerMsg.includes("clear")) {
    session.order = []
    return res.json({ reply: "Order cleared." })
  }

  // ===== EDIT QUANTITY =====
  const editMatch = lowerMsg.match(/(\d+)\s*(pizza|burger|cola|fries)/)

  if (lowerMsg.includes("make") && editMatch) {
    const qty = parseInt(editMatch[1])
    const item = editMatch[2]

    session.order = session.order.filter(i => i !== item)

    for (let i = 0; i < qty; i++) {
      session.order.push(item)
    }

    return res.json({
      reply: `Updated: ${summarizeOrder(session.order)}`
    })
  }

  // ===== CONFIRM ORDER =====
  if (lowerMsg.includes("yes") || lowerMsg.includes("confirm")) {
    if (session.order.length === 0) {
      return res.json({ reply: "You haven't added anything yet." })
    }

    const finalOrder = summarizeOrder(session.order)

    try {
      await supabase.from("orders").insert([
        {
          client_id: client,
          items: finalOrder
        }
      ])
    } catch (err) {
      console.log("DB ERROR:", err)
    }

    session.order = []

    return res.json({
      reply: `Perfect. Your order is ${finalOrder}.`
    })
  }

  // ===== SMART UPSELL =====
  // ===== SMART RESPONSE =====
  let botReply = null

  // ===== RULE LOGIC =====
  if (session.order.length > 0) {

    const lastItem = session.order[session.order.length - 1]
    let upsell = ""

    if (lastItem === "pizza") {
      upsell = "🔥 Add a drink or garlic bread?"
    } else if (lastItem === "burger") {
      upsell = "🍟 Want fries or a drink?"
    } else if (lastItem === "cola") {
      upsell = "👌 Want food with your drink?"
    }

    const variations = ["Got it 👍", "Nice choice 👌", "Added 🔥", "Perfect ✅"]
    let replyText = variations[Math.floor(Math.random() * variations.length)]

    replyText += ` You now have ${summarizeOrder(session.order)}.`

    if (upsell) replyText += ` ${upsell}`

    botReply = replyText
  }


  // ===== OPENAI FALLBACK =====
  try {
    const ai = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content: `
You are a restaurant AI assistant.

Menu: pizza, burger, cola, fries, garlic bread.

Extract user

You help users:
- understand menu
- answer questions
- guide ordering

Keep responses short and natural.
`
        },
        {
          role: "user",
          content: message
        }
      ]
    })

    return res.json({
      reply: ai.choices[0].message.content
    })
  } catch (err) {
    console.log("AI ERROR:", err)
  }

  return res.json({
    reply: "Try: pizza, 2 pizza, burger, cola..."
  })
})



// ===== LEADS =====
app.post("/lead", async (req, res) => {
  try {
    let { email, message, client } = req.body

    // ===============================
    // 🔐 FORCE CYBERITLEADS ONLY
    // ===============================
    if (client !== "cyberitleads") {
      return res.status(403).json({ error: "Unauthorized lead source" })
    }

    // ===============================
    // 🧹 CLEAN INPUT
    // ===============================
    email = email?.trim().toLowerCase()
    message = message?.trim()

    if (!email || !message) {
      return res.status(400).json({ error: "Missing lead data" })
    }

    // Simple email validation
    if (!email.includes("@") || email.length < 5) {
      return res.status(400).json({ error: "Invalid email" })
    }

    // ===============================
    // 💾 SAVE TO SUPABASE
    // ===============================
    const { error } = await supabase
      .from("leads")
      .insert([
        {
          email,
          message,
          source: "cyberitleads",
          created_at: new Date().toISOString()
        }
      ])

    if (error) {
      console.error(error)
      return res.status(500).json({ error: "Failed to save lead" })
    }

    // ===============================
    // 📧 EMAIL TO YOU (BUSINESS ALERT)
    // ===============================
    try {
      await transporter.sendMail({
        from: `"CyberITLeads" <${process.env.EMAIL_USER}>`,
        to: process.env.EMAIL_USER,
        subject: "🔥 New Restaurant Lead",
        html: `
          <h2>🚀 New Lead Captured</h2>

          <p><b>Email:</b> ${email}</p>
          <p><b>Message:</b></p>
          <p style="background:#f5f5f5;padding:10px;border-radius:6px;">
            ${message}
          </p>

          <hr/>
          <p>Source: CyberITLeads</p>
        `
      })

      console.log("BUSINESS EMAIL SENT ✅")
    } catch (err) {
      console.error("BUSINESS EMAIL FAILED ❌", err)
    }

    // ===============================
    // 📧 EMAIL TO CLIENT (LEAD CONFIRMATION)
    // ===============================
    try {
      await transporter.sendMail({
        from: `"CyberITLeads" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: "🚀 You're in — AI Setup Started",
        html: `
          <h2>You're in.</h2>

          <p>Thanks for reaching out.</p>

          <p>
          We're preparing your AI assistant setup right now.
          </p>

          <p>
          You’ll be contacted shortly with next steps.
          </p>

          <br/>

          <p><b>Your message:</b></p>
          <p style="background:#f5f5f5;padding:10px;border-radius:6px;">
            ${message}
          </p>

          <br/>

          <p>— CyberITLeads Team</p>
        `
      })

      console.log("CLIENT EMAIL SENT ✅")
    } catch (err) {
      console.error("CLIENT EMAIL FAILED ❌", err)
    }

    // ===============================
    // ✅ RESPONSE
    // ===============================
    res.json({ ok: true })

  } catch (err) {
    console.error(err)
    res.status(500).json({ error: "Server error" })
  }
})

app.post("/stoic-chat", async (req, res) => {
  try {
    const message = req.body.message || "";
    const cleaned = message.trim().toLowerCase();

    // 🔥 GREETING HANDLER (PUT THIS HERE)
    if (/^(hi|hello|hey)$/i.test(cleaned)) {
      return res.json({
        message: "Hey. What's on your mind?",
        products: []
      });
    }

    const matchedProducts = findMatchingProducts(message);

    // 2. PREPARE PRODUCT CONTEXT
    const productContext = matchedProducts.map(p => ({
      name: p.name,
      pitch: p.pitch,
      category: p.category,
      problems: p.problems,
      link: p.link || p.amazon || ""
    }));

    // 3. CALL OPENAI
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `
You are a sharp, emotionally intelligent advisor who understands people deeply.

Your goal:
1. Understand what the user REALLY feels (not just what they say)
2. Respond in a natural, human way (not robotic)
3. Make the user feel understood
4. Recommend ONE book naturally (not forced)

Style:
- Conversational, calm, confident
- No robotic phrasing like "you struggle with"
- No repeating the same sentence structure
- Speak like a real human, not a system

Structure:
1. One short relatable insight (1–2 lines max)
2. Then recommend the book naturally like:
"You should read [book name] — [short reason]"

Rules:
- No lists
- No generic advice
- No repetition
- Make each response feel different

Output ONLY valid JSON:
{
  "message": "your response",
  "products": [
    {
      "name": "exact book name",
      "reason": "short natural reason"
    }
  ]
}
`
        },
        {
          role: "user",
          content: `
User message:
${message}

Available products:
${JSON.stringify(productContext)}
`
        }
      ]
    });

    // 4. PARSE RESPONSE SAFELY
    let aiResponse;

    try {
      const raw = completion.choices[0].message.content;

      // remove possible markdown ```json
      const cleaned = raw.replace(/```json|```/g, "").trim();

      aiResponse = JSON.parse(cleaned);

    } catch (err) {
      console.log("RAW AI OUTPUT:", completion.choices[0].message.content);

      return res.json({
        message: completion.choices[0].message.content || "Try again.",
        products: []
      });
    }

    // 5. ATTACH REAL LINKS
    aiResponse.products = aiResponse.products.map(aiProduct => {
      const real = matchedProducts.find(
        p =>
          p.name.toLowerCase().trim() ===
          aiProduct.name.toLowerCase().trim()
      );

      return {
        name: aiProduct.name,
        reason: aiProduct.reason,
        link: real?.link || real?.amazon || ""
      };
    });

    // 6. RETURN CLEAN RESPONSE
    res.json(aiResponse);

  } catch (err) {
    console.error("Stoic chat error:", err);

    res.status(500).json({
      message: "Something went wrong.",
      products: []
    });
  }
});



// ===== START SERVER =====
const PORT = process.env.PORT || 3000

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`)
})
