require("dotenv").config()

const express = require("express")
const cors = require("cors")
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY)
const nodemailer = require("nodemailer")
const { v4: uuidv4 } = require("uuid")
const users = []

const app = express()

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
                            name: "Your Product"
                        },
                        unit_amount: 3000,
                    },
                    quantity: 1,
                },
            ],
            customer_email: req.query.email, // 👈 here
            success_url: `${process.env.BASE_URL}/success`,
            cancel_url: `${process.env.BASE_URL}/cancel`,
        })

        res.redirect(session.url)
    } catch (error) {
       console.error(error)
       res.status(500).send("Error creating checkout session")
    }
})

app.get("/success", (req, res) => {
  res.send("✅ Payment successful!");
})

app.get("/cancel", (req, res) => {
  res.send("❌ Payment cancelled");
})

// ✅ IMPORTANT: Stripe webhook must use RAW body
app.post("/webhook", express.raw({ type: "application/json" }), async (req, res) => {
    console.log("🔥 WEBHOOK HIT")

    const sig = req.headers["stripe-signature"]

    let event

    try {
        event = stripe.webhooks.constructEvent(
            req.body,
            sig,
            process.env.STRIPE_WEBHOOK_SECRET
        )
    } catch (err) {
      console.error("❌ Webhook signature failed:", err.message)
      return res.sendStatus(400)
    }

    if (event.type === "checkout.session.completed") {
        console.log("✅ PAYMENT SUCCESS")

        const session = event.data.object
        const email = session.customer_email
        const userId = uuidv4()

        users.push({
          id: userId,
          email: email,
          createdAt: new Date()
        })

        console.log("User created:", {
          id: userId,
          email: email
        })

        console.log("Current users:", users)

        console.log("Customer email:", session.customer_email)
        console.log("Amount:", session.amount_total)
        // 📧 SEND EMAIL
       const transporter = nodemailer.createTransport({
         service: "gmail",
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

         text: `
      Your AI Assistant is Ready

      Copy this:

      <script src="${process.env.BASE_URL}/widget.js" data-user="${userId}"></script>
      `,

        html: `
      <h2>Your AI Assistant is Ready</h2>
      <p>Copy this and paste into your website:</p>

      <pre style="background:#111;color:#0f0;padding:10px;border-radius:6px;">
      &lt;script src="${process.env.BASE_URL}/widget.js" data-user="${userId}"&gt;&lt;/script&gt;
      </pre>
      `
      })
       console.log("📧 Email sent!")
    }

    res.sendStatus(200)
})


// ✅ AFTER webhook (important)
app.use(express.json())
app.use(cors())

// ✅ TEST ROUTE
app.get("/test", (req, res) => {
  console.log("🔥 TEST WORKED")
  res.send("OK")
})

// ✅ START SERVER
const PORT = process.env.PORT || 3000

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})