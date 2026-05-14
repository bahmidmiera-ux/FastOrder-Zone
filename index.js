const { Telegraf, session, Markup } = require('telegraf');
const express = require('express');
require('dotenv').config();

const app = express();
const bot = new Telegraf(process.env.8980866806:AAE7zZZ-0J2HdHDx-jEuPbHl6sIiPtLVfb8);
const ADMIN_ID = process.env.6988762768; // আপনার টেলিগ্রাম আইডি

// সাময়িকভাবে ডেটা রাখার জন্য (প্রোডাকশনে ডাটাবেস ব্যবহার করা ভালো)
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
        `✨ *Welcome to Service Hub BD* ✨\n\nবাংলাদেশের বিশ্বস্ত ডিজিটাল সার্ভিস প্ল্যাটফর্মে আপনাকে স্বাগতম।\n\n🚀 *নিচের মেনু থেকে আপনার পছন্দমতো অপশন সিলেক্ট করুন:*`,
        mainMenu
    );
});

bot.hears('🔙 Back', (ctx) => {
    ctx.reply('প্রধান মেনুতে ফিরে যাওয়া হচ্ছে...', mainMenu);
});

// --- ফ্রি অর্ডার সিস্টেম ---
bot.hears('🎁 Free Order', (ctx) => {
    const user = db.users[ctx.from.id];
    const today = new Date().toLocaleDateString();

    if (user.lastFreeOrder === today) {
        return ctx.reply('❌ দুঃখিত! আপনি দিনে মাত্র ১টি ফ্রি অর্ডার করতে পারবেন। আগামীকাল আবার চেষ্টা করুন।');
    }

    ctx.session.state = 'AWAITING_FREE_ORDER';
    ctx.reply('📝 আপনার সার্ভিসের বিস্তারিত লিখুন (যেমন: আমার একটি লোগো লাগবে):', backMenu);
});

// --- পেইড অর্ডার সিস্টেম ---
bot.hears('💰 Paid Order', (ctx) => {
    let msg = "💎 *আমাদের সার্ভিসসমূহ ও মূল্যতালিকা:*\n\n";
    Object.keys(services).forEach(s => {
        msg += `✅ ${s} — ${services[s]}৳\n`;
    });
    msg += "\n*যে সার্ভিসটি নিতে চান তার ওপর ক্লিক করুন:*";
    
    const serviceButtons = Object.keys(services).map(s => [s]);
    ctx.replyWithMarkdown(msg, Markup.keyboard([...serviceButtons, ['🔙 Back']]).resize());
});

// --- রেফারেল সিস্টেম ---
bot.hears('👥 Referral System', (ctx) => {
    const user = db.users[ctx.from.id];
    const refLink = `https://t.me/${ctx.botInfo.username}?start=${ctx.from.id}`;
    
    ctx.replyWithMarkdown(
        `👥 *আপনার রেফারেল ড্যাশবোর্ড*\n\n` +
        `🔗 *আপনার লিংক:* \`${refLink}\`\n\n` +
        `📈 *মোট রেফারেল:* ${user.referrals || 0} জন\n` +
        `🎁 ১০ জন বন্ধুকে ইনভাইট করলে পাবেন বোনাস ফ্রি অর্ডার!`
    );
});

// --- মাই অর্ডারস ---
bot.hears('📦 My Orders', (ctx) => {
    const userOrders = db.users[ctx.from.id]?.orders || [];
    if (userOrders.length === 0) return ctx.reply("আপনি এখনো কোনো অর্ডার করেননি।");
    
    let history = "📦 *আপনার অর্ডারসমূহ:*\n\n";
    userOrders.forEach((o, i) => {
        history += `${i+1}. ${o.service} - [${o.status}]\n`;
    });
    ctx.replyWithMarkdown(history);
});

// --- মেসেজ হ্যান্ডলিং ও অ্যাডমিন নোটিফিকেশন ---
bot.on('text', async (ctx) => {
    const text = ctx.message.text;
    const userId = ctx.from.id;

    if (text === '🔙 Back' || text === '📞 Contact Admin') {
        if (text === '📞 Contact Admin') ctx.reply("সরাসরি কথা বলতে অ্যাডমিনকে মেসেজ দিন: @YourAdminUsername");
        return;
    }

    // পেইড অর্ডার সিলেকশন হ্যান্ডলিং
    if (services[text]) {
        ctx.session.orderType = text;
        ctx.session.state = 'AWAITING_PAYMENT';
        return ctx.replyWithMarkdown(
            `💳 *পেমেন্ট নির্দেশিকা*\n\n` +
            `অনুগ্রহ করে ${services[text]}৳ নিচের নাম্বারে পাঠান:\n` +
            `🔸 bKash: 01788927306\n` +
            `🔸 Nagad: 01986859798\n\n` +
            `টাকা পাঠানোর পর আপনার *Transaction ID* অথবা যে নাম্বার থেকে পাঠিয়েছেন তা এখানে লিখুন:`, 
            backMenu
        );
    }

    // ফ্রি অর্ডার সেভ করা
    if (ctx.session.state === 'AWAITING_FREE_ORDER') {
        const orderData = { service: 'Free Order', detail: text, status: 'Pending' };
        db.users[userId].orders.push(orderData);
        db.users[userId].lastFreeOrder = new Date().toLocaleDateString();
        db.stats.free++;

        ctx.reply("✅ আপনার ফ্রি অর্ডারটি গ্রহণ করা হয়েছে! অ্যাডমিন শীঘ্রই আপনার সাথে যোগাযোগ করবে।", mainMenu);
        bot.telegram.sendMessage(ADMIN_ID, `🔔 *নতুন ফ্রি অর্ডার!*\nইউজার: ${userId}\nবিস্তারিত: ${text}`);
        ctx.session.state = null;
    }

    // পেমেন্ট ভেরিফিকেশন সেভ করা
    if (ctx.session.state === 'AWAITING_PAYMENT') {
        const orderData = { service: ctx.session.orderType, detail: text, status: 'Verifying' };
        db.users[userId].orders.push(orderData);
        db.stats.paid++;

        ctx.reply("✅ পেমেন্ট তথ্য জমা হয়েছে! ভেরিফিকেশন শেষে আপনার কাজ শুরু হবে।", mainMenu);
        bot.telegram.sendMessage(ADMIN_ID, `💰 *পেইড অর্ডার!*\nইউজার: @${ctx.from.username}\nID: ${userId}\nসার্ভিস: ${ctx.session.orderType}\nপেমেন্ট তথ্য: ${text}`);
        ctx.session.state = null;
    }

    // অ্যাডমিন প্যানেল কমান্ড
    if (text === '/admin' && userId.toString() === ADMIN_ID) {
        ctx.replyWithMarkdown(
            `📊 *অ্যাডমিন ড্যাশবোর্ড*\n\n` +
            `👥 মোট ইউজার: ${Object.keys(db.users).length}\n` +
            `🎁 ফ্রি অর্ডার: ${db.stats.free}\n` +
            `💰 পেইড অর্ডার: ${db.stats.paid}`
        );
    }
});

// Render-এ ২৪/৭ চালু রাখার জন্য সার্ভার
app.get('/', (req, res) => res.send('Service Hub BD Bot is Live!'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server started on port ${PORT}`);
    bot.launch();
});