const { Telegraf, session, Markup } = require('telegraf');
const express = require('express');
require('dotenv').config();

const app = express();
const bot = new Telegraf(process.env.BOT_TOKEN);
const ADMIN_ID = process.env.ADMIN_ID; // রেন্ডার থেকে আসবে

// সাময়িকভাবে ডেটা রাখার জন্য
let db = {
    users: {},
    stats: { free: 0, paid: 0 }
};

bot.use(session());

// --- কিবোর্ড সেটআপ ---
const mainMenu = Markup.keyboard([
    ['🎁 Free Order', '💰 Paid Order'],
    ['👥 Referral System', '📦 My Orders'],
    ['📞 Contact Admin']
]).resize();

const backMenu = Markup.keyboard([['🔙 Back']]).resize();

// --- সার্ভিস লিস্ট ও প্রাইস ---
const services = {
    'Logo Design': 100,
    'Facebook Post': 50,
    'Website Page': 300,
    'Thumbnail Design': 80,
    'Content Writing': 150
};

// --- হেল্পার ফাংশন ---
const initUser = (id, username, refBy = null) => {
    if (!db.users[id]) {
        db.users[id] = {
            username: username || 'User',
            referrals: 0,
            lastFreeOrder: null,
            orders: [],
            referredBy: refBy
        };
        if (refBy && db.users[refBy]) {
            db.users[refBy].referrals += 1;
        }
    }
};

// --- কমান্ডসমূহ ---
bot.start((ctx) => {
    const refBy = ctx.startPayload;
    initUser(ctx.from.id, ctx.from.username, refBy);
    
    ctx.replyWithMarkdown(
        `✨ *Welcome to Service Nest BD* ✨\n\nবাংলাদেশের বিশ্বস্ত ডিজিটাল সার্ভিস প্ল্যাটফর্মে আপনাকে স্বাগতম।\n\n🚀 *নিচের মেনু থেকে অপশন সিলেক্ট করুন:*`,
        mainMenu
    );
});

// --- মেইন লজিক ---
bot.on('text', async (ctx) => {
    const text = ctx.message.text;
    const userId = ctx.from.id;
    initUser(userId, ctx.from.username);

    // ১. ব্যাক বাটন
    if (text.includes('🔙 Back')) {
        ctx.session.state = null;
        return ctx.reply('প্রধান মেনুতে ফিরে যাওয়া হচ্ছে...', mainMenu);
    }

    // ২. ফ্রি অর্ডার বাটন
    if (text.includes('🎁 Free Order')) {
        const user = db.users[userId];
        const today = new Date().toLocaleDateString();
        if (user.lastFreeOrder === today) {
            return ctx.reply('❌ আপনি দিনে মাত্র ১টি ফ্রি অর্ডার করতে পারবেন।');
        }
        ctx.session.state = 'AWAITING_FREE_ORDER';
        return ctx.reply('📝 আপনার সার্ভিসের বিস্তারিত লিখুন (যেমন: লোগো ডিজাইন):', backMenu);
    }

    // ৩. পেইড অর্ডার বাটন
    if (text.includes('💰 Paid Order')) {
        let msg = "💎 *আমাদের সার্ভিসসমূহ ও মূল্যতালিকা:*\n\n";
        Object.keys(services).forEach(s => {
            msg += `✅ ${s} — ${services[s]}৳\n`;
        });
        msg += "\n*যে সার্ভিসটি নিতে চান তার ওপর ক্লিক করুন:*";
        
        const serviceButtons = Object.keys(services).map(s => [s]);
        return ctx.replyWithMarkdown(msg, Markup.keyboard([...serviceButtons, ['🔙 Back']]).resize());
    }

    // ৪. রেফারেল সিস্টেম
    if (text.includes('👥 Referral System')) {
        const user = db.users[userId];
        const refLink = `https://t.me/${ctx.botInfo.username}?start=${userId}`;
        return ctx.replyWithMarkdown(
            `👥 *আপনার রেফারেল ড্যাশবোর্ড*\n\n` +
            `🔗 *আপনার লিংক:* \`${refLink}\`\n\n` +
            `📈 *মোট রেফারেল:* ${user.referrals || 0} জন`
        );
    }

    // ৫. মাই অর্ডারস
    if (text.includes('📦 My Orders')) {
        const userOrders = db.users[userId]?.orders || [];
        if (userOrders.length === 0) return ctx.reply("আপনি এখনো কোনো অর্ডার করেননি।");
        let history = "📦 *আপনার অর্ডারসমূহ:*\n\n";
        userOrders.forEach((o, i) => {
            history += `${i+1}. ${o.service} - [${o.status}]\n`;
        });
        return ctx.replyWithMarkdown(history);
    }

    // ৬. কন্টাক্ট অ্যাডমিন
    if (text.includes('📞 Contact Admin')) {
        return ctx.reply("সরাসরি কথা বলতে অ্যাডমিনকে মেসেজ দিন: @YourAdminUsername");
    }

    // ৭. পেইড সার্ভিস সিলেকশন হ্যান্ডলিং
    if (services[text]) {
        ctx.session.orderType = text;
        ctx.session.state = 'AWAITING_PAYMENT';
        return ctx.replyWithMarkdown(
            `💳 *পেমেন্ট নির্দেশিকা*\n\n` +
            `অনুগ্রহ করে ${services[text]}৳ পাঠান:\n` +
            `🔸 bKash/Nagad: 017XXXXXXXX\n\n` +
            `টাকা পাঠানোর পর আপনার *Transaction ID* বা নাম্বারটি এখানে লিখুন:`, 
            backMenu
        );
    }

    // ৮. ডেটা সেভ করা (স্টেট অনুযায়ী)
    if (ctx.session.state === 'AWAITING_FREE_ORDER') {
        const orderData = { service: 'Free Order', detail: text, status: 'Pending' };
        db.users[userId].orders.push(orderData);
        db.users[userId].lastFreeOrder = new Date().toLocaleDateString();
        db.stats.free++;
        ctx.session.state = null;
        ctx.reply("✅ অর্ডার জমা হয়েছে!", mainMenu);
        return bot.telegram.sendMessage(ADMIN_ID, `🔔 *FREE ORDER*\nUser: ${userId}\nDetail: ${text}`);
    }

    if (ctx.session.state === 'AWAITING_PAYMENT') {
        const orderData = { service: ctx.session.orderType, detail: text, status: 'Verifying' };
        db.users[userId].orders.push(orderData);
        db.stats.paid++;
        ctx.session.state = null;
        ctx.reply("✅ পেমেন্ট তথ্য জমা হয়েছে!", mainMenu);
        return bot.telegram.sendMessage(ADMIN_ID, `💰 *PAID ORDER*\nUser: @${ctx.from.username}\nService: ${ctx.session.orderType}\nPayment: ${text}`);
    }
});

// অ্যাডমিন প্যানেল কমান্ড
bot.command('admin', (ctx) => {
    if (ctx.from.id.toString() === ADMIN_ID) {
        ctx.replyWithMarkdown(`📊 *Stats*\nUsers: ${Object.keys(db.users).length}\nFree: ${db.stats.free}\nPaid: ${db.stats.paid}`);
    }
});

app.get('/', (req, res) => res.send('Bot Live!'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server Live on ${PORT}`);
    bot.launch();
});
