require('dotenv').config()
const express = require('express')
const line = require('@line/bot-sdk')

const app = express()
const PORT = process.env.PORT || 3000

const config = {
  channelSecret: process.env.CHANNEL_SECRET,
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN
}

const client = new line.Client(config)

// ===== WEBHOOK =====
app.post('/webhook', line.middleware(config), async (req, res) => {
  for (const event of req.body.events) {
    if (event.type !== 'message' || event.message.type !== 'text') continue

    // ✅ ตอบทุกข้อความ (ทดสอบ)
    await client.replyMessage(event.replyToken, {
      type: 'text',
      text: '🤖 บอทออนไลน์แล้ว'
    })
  }
  res.end()
})

// ===== ROOT =====
app.get('/', (req, res) => {
  res.send('BOT RUNNING')
})

app.listen(PORT, () => {
  console.log('Server started on', PORT)
})
