import os
import threading
from flask import Flask
from telegram import ReplyKeyboardMarkup, Update
from telegram.ext import Application, CommandHandler, MessageHandler, filters, ContextTypes, ConversationHandler

# Flask setup for Render uptime
app = Flask(__name__)

@app.route('/')
def home():
    return "Bot is Live!"

def run_flask():
    port = int(os.environ.get('PORT', 3000))
    app.run(host='0.0.0.0', port=port)

# Get Token and Admin ID from Render Environment Variables
TOKEN = os.environ.get('BOT_TOKEN')
ADMIN_ID = os.environ.get('ADMIN_ID')

# States for conversation
FREE_ORDER, PAID_ORDER, PAYMENT_PROOF = range(3)

# Service List
SERVICES = {
    'Logo Design': 100,
    'Facebook Post': 50,
    'Website Page': 300,
    'Thumbnail Design': 80,
    'Content Writing': 150
}

# Keyboards
MAIN_KBD = [['🎁 Free Order', '💰 Paid Order'], ['👥 Referral System', '📦 My Orders'], ['📞 Contact Admin']]
BACK_KBD = [['🔙 Back']]

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    reply_markup = ReplyKeyboardMarkup(MAIN_KBD, resize_keyboard=True)
    await update.message.reply_text(
        "✨ *Welcome to Service Hub BD* ✨\n\nনিচের মেনু থেকে একটি অপশন সিলেক্ট করুন:",
        reply_markup=reply_markup, parse_mode='Markdown'
    )
    return ConversationHandler.END

async def handle_buttons(update: Update, context: ContextTypes.DEFAULT_TYPE):
    text = update.message.text
    
    if 'Free Order' in text:
        await update.message.reply_text("📝 আপনার ফ্রি সার্ভিসের বিস্তারিত লিখে পাঠান:", reply_markup=ReplyKeyboardMarkup(BACK_KBD, resize_keyboard=True))
        return FREE_ORDER

    elif 'Paid Order' in text:
        msg = "💎 *আমাদের সার্ভিসসমূহ ও মূল্যতালিকা:*\n\n"
        for s, p in SERVICES.items():
            msg += f"✅ {s} — {p}৳\n"
        msg += "\n*সার্ভিসটি সিলেক্ট করুন:*"
        service_buttons = [[s] for s in SERVICES.keys()] + [['🔙 Back']]
        await update.message.reply_text(msg, reply_markup=ReplyKeyboardMarkup(service_buttons, resize_keyboard=True), parse_mode='Markdown')
        return PAID_ORDER

    elif 'Contact Admin' in text:
        await update.message.reply_text("📞 সরাসরি কথা বলতে অ্যাডমিনকে মেসেজ দিন: @YourAdminUsername")
    
    elif 'Referral' in text:
        me = await context.bot.get_me()
        link = f"https://t.me/{me.username}?start={update.effective_user.id}"
        await update.message.reply_text(f"👥 *আপনার রেফারেল লিংক:* `{link}`", parse_mode='Markdown')

    return ConversationHandler.END

async def process_free(update: Update, context: ContextTypes.DEFAULT_TYPE):
    text = update.message.text
    if 'Back' in text: return await start(update, context)
    
    await update.message.reply_text("✅ আপনার ফ্রি অর্ডার জমা হয়েছে!", reply_markup=ReplyKeyboardMarkup(MAIN_KBD, resize_keyboard=True))
    if ADMIN_ID:
        await context.bot.send_message(chat_id=ADMIN_ID, text=f"🔔 *FREE ORDER*\nUser: {update.effective_user.id}\nDetail: {text}")
    return ConversationHandler.END

async def process_paid_select(update: Update, context: ContextTypes.DEFAULT_TYPE):
    service = update.message.text
    if 'Back' in service: return await start(update, context)
    
    if service in SERVICES:
        context.user_data['selected'] = service
        await update.message.reply_text(
            f"💳 *{service}* এর জন্য {SERVICES[service]}৳ নিচের নাম্বারে পাঠান:\n\n🔸 bKash/Nagad: 017XXXXXXXX\n\nটাকা পাঠিয়ে Transaction ID দিন:",
            reply_markup=ReplyKeyboardMarkup(BACK_KBD, resize_keyboard=True), parse_mode='Markdown'
        )
        return PAYMENT_PROOF
    return PAID_ORDER

async def process_payment(update: Update, context: ContextTypes.DEFAULT_TYPE):
    text = update.message.text
    if 'Back' in text: return await start(update, context)
    
    service = context.user_data.get('selected')
    await update.message.reply_text("✅ পেমেন্ট তথ্য জমা হয়েছে!", reply_markup=ReplyKeyboardMarkup(MAIN_KBD, resize_keyboard=True))
    if ADMIN_ID:
        await context.bot.send_message(chat_id=ADMIN_ID, text=f"💰 *PAID ORDER*\nService: {service}\nProof: {text}\nUser: {update.effective_user.id}")
    return ConversationHandler.END

def main():
    # Start Flask thread
    threading.Thread(target=run_flask, daemon=True).start()

    # Start Bot
    if not TOKEN:
        print("Error: No BOT_TOKEN found!")
        return

    application = Application.builder().token(TOKEN).build()

    conv_handler = ConversationHandler(
        entry_points=[MessageHandler(filters.TEXT & ~filters.COMMAND, handle_buttons)],
        states={
            FREE_ORDER: [MessageHandler(filters.TEXT & ~filters.COMMAND, process_free)],
            PAID_ORDER: [MessageHandler(filters.TEXT & ~filters.COMMAND, process_paid_select)],
            PAYMENT_PROOF: [MessageHandler(filters.TEXT & ~filters.COMMAND, process_payment)],
        },
        fallbacks=[CommandHandler('start', start)],
    )

    application.add_handler(CommandHandler('start', start))
    application.add_handler(conv_handler)

    print("Bot is starting...")
    application.run_polling()

if __name__ == '__main__':
    main()
