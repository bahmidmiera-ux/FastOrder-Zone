const { Telegraf, session, Markup } = require('telegraf');
const express = require('express');
require('dotenv').config();

const app = express();
const bot = new Telegraf(process.env.BOT_TOKEN);
const ADMIN_ID = process.env.ADMIN_ID;

// ইন-মেমোরি ডাটাবেস
let db = { users: {}, stats: { free: 0, paid: 0 } };

bot.use(session());

// কিবোর্ড মেনু (ইমোজি সহ একদম সহজ ম্যাচিং এর জন্য)
const mainMenu = Markup.keyboard([
    ['🎁 Free Order', '💰 Paid Order'],
    ['👥 Referral System', '📦 My Orders'],
    ['📞 Contact Admin']
]).resize();

const backMenu = Markup.keyboard([['🔙 Back']]).resize();

const services = {
    'Logo Design': 100,
    'Facebook Post': 50,
    'Website Page': 300,
    'Thumbnail Design': 80,
    'Content Writing': 150
};

// ইউজার ইনিশিয়েলাইজেশন
const initUser = (id, username) => {
    if (!db.users[id]) {
        db.users[id] = { username: username || 'User', referrals: 0, lastFreeOrder: null, orders: [] };
    }
};

bot.start((ctx) => {
    initUser(ctx.from.id, ctx.from.username);
    ctx.replyWithMarkdown(`✨ *Welcome to Service Nest BD* ✨\n\nনিচের বাটন ব্যবহার করে অর্ডার করুন।`, mainMenu);
});

// সব টেক্সট মেসেজ হ্যান্ডলার (বাটন চেনার জন্য সবথেকে ফাস্ট লজিক)
bot.on('text', async (ctx) => {
    const text = ctx.message.text;
    const userId = ctx.from.id;
    initUser(userId, ctx.from.username);

    // ১. ব্যাক বাটন
    if (text.includes('Back')) {
        ctx.session.state = null;
        return ctx.reply('প্রধান মেনু:', mainMenu);
    }

    // ২. ফ্রি অর্ডার লজিক
    if (text.includes('Free Order')) {
        const today = new Date().toLocaleDateString();
        if (db.users[userId].lastFreeOrder === today) {
            return ctx.reply('❌ আজ অলরেডি একটি ফ্রি অর্ডার করেছেন। আগামীকাল আবার পারবেন।');
        }
        ctx.session.state = 'AWAITING_FREE';
        return ctx.reply('📝 আপনার ফ্রি সার্ভিসের বিস্তারিত লিখুন:', backMenu);
    }

    // ৩. পেইড অর্ডার লজিক
    if (text.includes('Paid Order')) {
        const serviceButtons = Object.keys(services).map(s => [s]);
        return ctx.reply('নিচের যেকোনো একটি সার্ভিসে ক্লিক করুন:', Markup.keyboard([...serviceButtons, ['🔙 Back']]).resize());
    }

    // ৪. মাই অর্ডারস
    if (text.includes('My Orders')) {
        const orders = db.users[userId].orders;
        if (orders.length === 0) return ctx.reply('আপনার কোনো অর্ডার নেই।');
        let msg = "📦 আপনার অর্ডারসমূহ:\n";
        orders.forEach((o, i) => msg += `${i+1}. ${o.service} (${o.status})\n`);
        return ctx.reply(msg);
    }

    // ৫. কন্টাক্ট অ্যাডমিন
    if (text.includes('Contact Admin')) {
        return ctx.reply('অ্যাডমিন আইডি: @YourAdminUsername');
    }

    // ৬. সার্ভিস সিলেক্ট করলে পেমেন্ট চাওয়া
    if (services[text]) {
        ctx.session.orderType = text;
        ctx.session.state = 'AWAITING_PAID';
        return ctx.replyWithMarkdown(`💳 *${text}* এর জন্য পেমেন্ট করুন।\n\nবিকাশ/নগদ: 017XXXXXXXX\n\nটাকা পাঠিয়ে Transaction ID দিন:`, backMenu);
    }

    // ৭. ডাটা সেভ করা (স্টেট অনুযায়ী)
    if (ctx.session.state === 'AWAITING_FREE') {
        db.users[userId].orders.push({ service: 'Free', detail: text, status: 'Pending' });
        db.users[userId].lastFreeOrder = new Date().toLocaleDateString();
        db.stats.free++;
        ctx.session.state = null;
        ctx.reply('✅ আপনার ফ্রি অর্ডার জমা হয়েছে!', mainMenu);
        return bot.telegram.sendMessage(ADMIN_ID, `🔔 *FREE ORDER*\nUser: ${userId}\nDetail: ${text}`);
    }

    if (ctx.session.state === 'AWAITING_PAID') {
        db.users[userId].orders.push({ service: ctx.session.orderType, detail: text, status: 'Verifying' });
        db.stats.paid++;
        ctx.session.state = null;
        ctx.reply('✅ পেমেন্ট তথ্য জমা হয়েছে! অ্যাডমিন চেক করে কাজ শুরু করবেন।', mainMenu);
        return bot.telegram.sendMessage(ADMIN_ID, `💰 *PAID ORDER*\nService: ${ctx.session.orderType}\nPayment: ${text}\nUser: ${userId}`);
    }
});

// সার্ভার রান করা
app.get('/', (req, res) => res.send('Running...'));
app.listen(process.env.PORT || 3000, () => {
    bot.launch();
});
