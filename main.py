import os
import asyncio
from datetime import datetime
from flask import Flask
from telegram import ReplyKeyboardMarkup, Update
from telegram.ext import Application, CommandHandler, MessageHandler, filters, ContextTypes, ConversationHandler
import threading

# Flask server to keep Render alive
app = Flask(__name__)

@app.route('/')
def home():
    return "Service Hub BD Bot is Running!"

def run_flask():
    port = int(os.environ.get('PORT', 3000))
    app.run(host='0.0.0.0', port=port)

# Bot Settings from Environment Variables
TOKEN = os.environ.get('BOT_TOKEN')
ADMIN_ID = os.environ.get('ADMIN_ID')

# Conversation States
FREE_ORDER_INPUT, PAID_ORDER_SELECT, PAYMENT_PROOF_INPUT = range(3)

# Service List
SERVICES = {
    'Logo Design': 100,
    'Facebook Post': 50,
    'Website Page': 300,
    'Thumbnail Design': 80,
    'Content Writing': 150
}

# Keyboards
MAIN_MENU = [['🎁 Free Order', '💰 Paid Order'], ['👥 Referral System', '📦 My Orders'], ['📞 Contact Admin']]
BACK_MENU = [['🔙 Back']]

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    reply_markup = ReplyKeyboardMarkup(MAIN_MENU, resize_keyboard=True)
    await update.message.reply_text(
        "✨ *Welcome to Service Hub BD* ✨\n\nবাংলাদেশের বিশ্বস্ত ডিজিটাল সার্ভিস প্ল্যাটফর্মে আপনাকে স্বাগতম।\n\n🚀 *নিচের মেনু থেকে অপশন সিলেক্ট করুন:*",
        reply_markup=reply_markup, parse_mode='Markdown'
    )
    return ConversationHandler.END

async def handle_menu(update: Update, context: ContextTypes.DEFAULT_TYPE):
    text = update.message.text
    user_id = update.effective_user.id

    if 'Free Order' in text:
        await update.message.reply_text("📝 আপনার ফ্রি সার্ভিসের বিস্তারিত লিখে পাঠান:", reply_markup=ReplyKeyboardMarkup(BACK_MENU, resize_keyboard=True))
        return FREE_ORDER_INPUT

    elif 'Paid Order' in text:
        msg = "💎 *আমাদের সার্ভিসসমূহ ও মূল্যতালিকা:*\n\n"
        for s, p in SERVICES.items():
            msg += f"✅ {s} — {p}৳\n"
        msg += "\n*যে সার্ভিসটি নিতে চান তার ওপর ক্লিক করুন:*"
        
        service_buttons = [[s] for s in SERVICES.keys()] + [['🔙 Back']]
        await update.message.reply_text(msg, reply_markup=ReplyKeyboardMarkup(service_buttons, resize_keyboard=True), parse_mode='Markdown')
        return PAID_ORDER_SELECT

    elif 'Referral System' in text:
        me = await context.bot.get_me()
        link = f"https://t.me/{me.username}?start={user_id}"
        await update.message.reply_text(f"👥 *আপনার রেফারেল ড্যাশবোর্ড*\n\n🔗 *আপনার লিংক:* `{link}`", parse_mode='Markdown')
        return ConversationHandler.END

    elif 'Contact Admin' in text:
        await update.message.reply_text("📞 সরাসরি কথা বলতে অ্যাডমিনকে মেসেজ দিন: @YourAdminUsername")
        return ConversationHandler.END
    
    return ConversationHandler.END

async def free_order_process(update: Update, context: ContextTypes.DEFAULT_TYPE):
    text = update.message.text
    if 'Back' in text: return await start(update, context)
    
    await update.message.reply_text("✅ আপনার ফ্রি অর্ডার জমা হয়েছে! অ্যাডমিন যোগাযোগ করবে।", reply_markup=ReplyKeyboardMarkup(MAIN_MENU, resize_keyboard=True))
    await context.bot.send_message(chat_id=ADMIN_ID, text=f"🔔 *NEW FREE ORDER*\nUser: {update.effective_user.id}\nDetail: {text}")
    return ConversationHandler.END

async def paid_order_select(update: Update, context: ContextTypes.DEFAULT_TYPE):
    service = update.message.text
    if 'Back' in service: return await start(update, context)
    
    if service in SERVICES:
        context.user_data['selected_service'] = service
        await update.message.reply_text(
            f"💳 *{service}* এর জন্য {SERVICES[service]}৳ নিচের নাম্বারে পাঠান:\n\n🔸 bKash/Nagad: 017XXXXXXXX\n\nটাকা পাঠানোর পর ট্রানজেকশন আইডি দিন:",
            reply_markup=ReplyKeyboardMarkup(BACK_MENU, resize_keyboard=True), parse_mode='Markdown'
        )
        return PAYMENT_PROOF_INPUT
    return PAID_ORDER_SELECT

async def payment_proof_process(update: Update, context: ContextTypes.DEFAULT_TYPE):
    text = update.message.text
    if 'Back' in text: return await start(update, context)
    
    service = context.user_data.get('selected_service')
    await update.message.reply_text("✅ পেমেন্ট তথ্য জমা হয়েছে! ভেরিফিকেশন শেষে কাজ শুরু হবে।", reply_markup=ReplyKeyboardMarkup(MAIN_MENU, resize_keyboard=True))
    await context.bot.send_message(chat_id=ADMIN_ID, text=f"💰 *PAID ORDER*\nService: {service}\nPayment: {text}\nUser: {update.effective_user.id}")
    return ConversationHandler.END

def main():
    threading.Thread(target=run_flask, daemon=True).start()

    application = Application.builder().token(TOKEN).build()

    conv_handler = ConversationHandler(
        entry_points=[MessageHandler(filters.TEXT & ~filters.COMMAND, handle_menu)],
        states={
            FREE_ORDER_INPUT: [MessageHandler(filters.TEXT & ~filters.COMMAND, free_order_process)],
            PAID_ORDER_SELECT: [MessageHandler(filters.TEXT & ~filters.COMMAND, paid_order_select)],
            PAYMENT_PROOF_INPUT: [MessageHandler(filters.TEXT & ~filters.COMMAND, payment_proof_process)],
        },
        fallbacks=[CommandHandler('start', start)],
    )

    application.add_handler(CommandHandler('start', start))
    application.add_handler(conv_handler)

    application.run_polling()

if __name__ == '__main__':
    main()