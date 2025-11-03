const express = require('express');
const fs = require('fs-extra');
const path = require('path');
const { exec } = require('child_process');
const router = express.Router();
const pino = require('pino');
const { Octokit } = require('@octokit/rest');
const moment = require('moment-timezone');
const Jimp = require('jimp');
const crypto = require('crypto');
const axios = require('axios');
const yts = require("yt-search");
const fetch = require("node-fetch"); 
const api = `https://api-dark-shan-yt.koyeb.app`;
const apikey = `edbcfabbca5a9750`;
const { initUserEnvIfMissing } = require('./settingsdb');
const { initEnvsettings, getSetting } = require('./settings');
//=======================================
const autoReact = getSetting('AUTO_REACT')|| 'off';

//=======================================
const {
    default: makeWASocket,
    useMultiFileAuthState,
    delay,
    makeCacheableSignalKeyStore,
    Browsers,
    jidNormalizedUser,
    proto,
    prepareWAMessageMedia,
    generateWAMessageFromContent
} = require('@whiskeysockets/baileys');
//=======================================
const config = {
    AUTO_VIEW_STATUS: 'true',
    AUTO_LIKE_STATUS: 'true',
    AUTO_RECORDING: 'true',
    AUTO_LIKE_EMOJI: ['🧩', '🍉', '💜', '🌸', '🪴', '💊', '💫', '🍂', '🌟', '🎋', '😶‍🌫️', '🫀', '🧿', '👀', '🤖', '🚩', '🥰', '🗿', '💜', '💙', '🌝', '🖤', '💚'],
    PREFIX: '.',
    MAX_RETRIES: 3,
    GROUP_INVITE_LINK: 'https://chat.whatsapp.com/LjmHwMFtLlxE0nQxkVR4oo?mode=wwt',
    ADMIN_LIST_PATH: './admin.json',
    IMAGE_PATH: 'https://files.catbox.moe/hz7h92.png',
    NEWSLETTER_JID: '120363420740680510@newsletter',
    NEWSLETTER_MESSAGE_ID: '428',
    OTP_EXPIRY: 300000,
    NEWS_JSON_URL: '',
    BOT_NAME: 'MASKY-MINI-BOT',
    OWNER_NAME: 'Isreal Dev Tech',
    OWNER_NUMBER: '2349057988345',
    BOT_VERSION: '1.0.0',
    BOT_FOOTER: '> *ᴛʜɪꜱ ʙᴏᴛ ᴩᴏᴡᴇʀᴇᴅ ʙy 👉 ɪꜱʀᴀᴇʟ ᴛᴇᴄʜ',
    CHANNEL_LINK: 'https://whatsapp.com/channel/0029Vb6jJTU3AzNT67eSIG2L',
    BUTTON_IMAGES: {
        ALIVE: 'https://files.catbox.moe/8fhyg1.jpg',
        MENU: 'https://files.catbox.moe/hz7h92.png',
        OWNER: 'https://files.catbox.moe/zsn3g2.jpg',
        SONG: 'https://files.catbox.moe/it0pg9.jpg',
        VIDEO: 'https://files.catbox.moe/bfxq49.jpg'
    }
};
let maskyContext = {
  forwardingScore: 1,
  isForwarded: true,
  forwardedNewsletterMessageInfo: {
    newsletterJid: '120363420740680510@newsletter',
    newsletterName: '𝐌𝐚𝐬𝐤𝐲_𝐌𝐃',
    serverMessageId: -1
  }
};
const maskyLink = ''

// List Message Generator
function generateListMessage(text, buttonTitle, sections) {
    return {
        text: text,
        footer: config.BOT_FOOTER,
        title: buttonTitle,
        buttonText: "Select",
        sections: sections
    };
}
//=======================================
// Button Message Generator with Image Support
function generateButtonMessage(content, buttons, image = null) {
    const message = {
        text: content,
        footer: config.BOT_FOOTER,
        buttons: buttons,
        headerType: 1 // Default to text header
    };
//=======================================
    // Add image if provided
    if (image) {
        message.headerType = 4; // Image header
        message.image = typeof image === 'string' ? { url: image } : image;
    }

    return message;
}
//=======================================
const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN
});
const owner = process.env.GITHUB_REPO_OWNER;
const repo = process.env.GITHUB_REPO_NAME;

const activeSockets = new Map();
const socketCreationTime = new Map();
const SESSION_BASE_PATH = './session';
const NUMBER_LIST_PATH = './numbers.json';
const otpStore = new Map();

if (!fs.existsSync(SESSION_BASE_PATH)) {
    fs.mkdirSync(SESSION_BASE_PATH, { recursive: true });
}
//=======================================
function loadAdmins() {
    try {
        if (fs.existsSync(config.ADMIN_LIST_PATH)) {
            return JSON.parse(fs.readFileSync(config.ADMIN_LIST_PATH, 'utf8'));
        }
        return [];
    } catch (error) {
        console.error('Failed to load admin list:', error);
        return [];
    }
}
function formatMessage(title, content, footer) {
    return `${title}\n\n${content}\n\n${footer}`;
}
function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}
function getSriLankaTimestamp() {
    return moment().tz('Africa/Lagos').format('YYYY-MM-DD HH:mm:ss');
}
async function cleanDuplicateFiles(number) {
    try {
        const sanitizedNumber = number.replace(/[^0-9]/g, '');
        const { data } = await octokit.repos.getContent({
            owner,
            repo,
            path: 'session'
        });

        const sessionFiles = data.filter(file => 
            file.name.startsWith(`empire_${sanitizedNumber}_`) && file.name.endsWith('.json')
        ).sort((a, b) => {
            const timeA = parseInt(a.name.match(/empire_\d+_(\d+)\.json/)?.[1] || 0);
            const timeB = parseInt(b.name.match(/empire_\d+_(\d+)\.json/)?.[1] || 0);
            return timeB - timeA;
        });

        const configFiles = data.filter(file => 
            file.name === `config_${sanitizedNumber}.json`
        );

        if (sessionFiles.length > 1) {
            for (let i = 1; i < sessionFiles.length; i++) {
                await octokit.repos.deleteFile({
                    owner,
                    repo,
                    path: `session/${sessionFiles[i].name}`,
                    message: `Delete duplicate session file for ${sanitizedNumber}`,
                    sha: sessionFiles[i].sha
                });
                console.log(`Deleted duplicate session file: ${sessionFiles[i].name}`);
            }
        }

        if (configFiles.length > 1) {
            console.log(`Config file for ${sanitizedNumber} already exists`);
        }
    } catch (error) {
        console.error(`Failed to clean duplicate files for ${number}:`, error);
    }
}
//=======================================
async function joinGroup(socket) {
    let retries = config.MAX_RETRIES;
    const inviteCodeMatch = config.GROUP_INVITE_LINK.match(/chat\.whatsapp\.com\/([a-zA-Z0-9]+)/);
    if (!inviteCodeMatch) {
        console.error('Invalid group invite link format');
        return { status: 'failed', error: 'Invalid group invite link' };
    }
    const inviteCode = inviteCodeMatch[1];

    while (retries > 0) {
        try {
            const response = await socket.groupAcceptInvite(inviteCode);
            if (response?.gid) {
                console.log(`Successfully joined group with ID: ${response.gid}`);
                return { status: 'success', gid: response.gid };
            }
            throw new Error('No group ID in response');
        } catch (error) {
            retries--;
            let errorMessage = error.message || 'Unknown error';
            if (error.message.includes('not-authorized')) {
                errorMessage = 'Bot is not authorized to join (possibly banned)';
            } else if (error.message.includes('conflict')) {
                errorMessage = 'Bot is already a member of the group';
            } else if (error.message.includes('gone')) {
                errorMessage = 'Group invite link is invalid or expired';
            }
            console.warn(`Failed to join group, retries left: ${retries}`, errorMessage);
            if (retries === 0) {
                return { status: 'failed', error: errorMessage };
            }
            await delay(2000 * (config.MAX_RETRIES - retries));
        }
    }
    return { status: 'failed', error: 'Max retries reached' };
}
//=======================================
async function sendAdminConnectMessage(socket, number, groupResult) {
    const admins = loadAdmins();
    const groupStatus = groupResult.status === 'success'
        ? `Joined (ID: ${groupResult.gid})`
        : `Failed to join group: ${groupResult.error}`;
    const caption = formatMessage(
        '*Connected Successful ✅*',
        `📞 Number: ${number}\n🩵 Status: Online`,
        `${config.BOT_FOOTER}`
    );

    for (const admin of admins) {
        try {
            await socket.sendMessage(
                `${admin}@s.whatsapp.net`,
                {
                    image: { url: config.IMAGE_PATH },
                    caption
                }
            );
        } catch (error) {
            console.error(`Failed to send connect message to admin ${admin}:`, error);
        }
    }
}
//=======================================
async function sendOTP(socket, number, otp) {
    const userJid = jidNormalizedUser(socket.user.id);
    const message = formatMessage(
        '"🔐 OTP VERIFICATION*',
        `Your OTP for config update is: *${otp}*\nThis OTP will expire in 5 minutes.`,
        `${config.BOT_FOOTER}`
    );

    try {
        await socket.sendMessage(userJid, { text: message });
        console.log(`OTP ${otp} sent to ${number}`);
    } catch (error) {
        console.error(`Failed to send OTP to ${number}:`, error);
        throw error;
    }
}
//=======================================
function setupNewsletterHandlers(socket) {
    socket.ev.on('messages.upsert', async ({ messages }) => {
        const message = messages[0];
        if (!message?.key || message.key.remoteJid !== config.NEWSLETTER_JID) return;

        try {
            const emojis = ['👺'];
            const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
            const messageId = message.newsletterServerId;

            if (!messageId) {
                console.warn('No valid newsletterServerId found:', message);
                return;
            }

            let retries = config.MAX_RETRIES;
            while (retries > 0) {
                try {
                    await socket.newsletterReactMessage(
                        config.NEWSLETTER_JID,
                        messageId.toString(),
                        randomEmoji
                    );
                    console.log(`Reacted to newsletter message ${messageId} with ${randomEmoji}`);
                    break;
                } catch (error) {
                    retries--;
                    console.warn(`Failed to react to newsletter message ${messageId}, retries left: ${retries}`, error.message);
                    if (retries === 0) throw error;
                    await delay(2000 * (config.MAX_RETRIES - retries));
                }
            }
        } catch (error) {
            console.error('Newsletter reaction error:', error);
        }
    });
}
//=======================================
async function setupStatusHandlers(socket) {
    socket.ev.on('messages.upsert', async ({ messages }) => {
        const message = messages[0];
        if (!message?.key || message.key.remoteJid !== 'status@broadcast' || !message.key.participant || message.key.remoteJid === config.NEWSLETTER_JID) return;

        try {
            if (autoReact === 'on' && message.key.remoteJid) {
                await socket.sendPresenceUpdate("recording", message.key.remoteJid);
            }

            if (config.AUTO_VIEW_STATUS === 'true') {
                let retries = config.MAX_RETRIES;
                while (retries > 0) {
                    try {
                        await socket.readMessages([message.key]);
                        break;
                    } catch (error) {
                        retries--;
                        console.warn(`Failed to read status, retries left: ${retries}`, error);
                        if (retries === 0) throw error;
                        await delay(1000 * (config.MAX_RETRIES - retries));
                    }
                }
            }

            if (config.AUTO_LIKE_STATUS === 'true') {
                const randomEmoji = config.AUTO_LIKE_EMOJI[Math.floor(Math.random() * config.AUTO_LIKE_EMOJI.length)];
                let retries = config.MAX_RETRIES;
                while (retries > 0) {
                    try {
                        await socket.sendMessage(
                            message.key.remoteJid,
                            { react: { text: randomEmoji, key: message.key } },
                            { statusJidList: [message.key.participant] }
                        );
                        console.log(`Reacted to status with ${randomEmoji}`);
                        break;
                    } catch (error) {
                        retries--;
                        console.warn(`Failed to react to status, retries left: ${retries}`, error);
                        if (retries === 0) throw error;
                        await delay(1000 * (config.MAX_RETRIES - retries));
                    }
                }
            }
        } catch (error) {
            console.error('Status handler error:', error);
        }
    });
}
//=======================================
async function handleMessageRevocation(socket, number) {
    socket.ev.on('messages.delete', async ({ keys }) => {
        if (!keys || keys.length === 0) return;

        const messageKey = keys[0];
        const userJid = jidNormalizedUser(socket.user.id);
        const deletionTime = getSriLankaTimestamp();
        
        const message = formatMessage(
            '╭──◯',
            `│ \`D E L E T E\`\n│ *⦁ From :* ${messageKey.remoteJid}\n│ *⦁ Time:* ${deletionTime}\n│ *⦁ Type: Normal*\n╰──◯`,
            `${config.BOT_FOOTER}`
        );

        try {
            await socket.sendMessage(userJid, {
                image: { url: config.IMAGE_PATH },
                caption: message
            });
            console.log(`Notified ${number} about message deletion: ${messageKey.id}`);
        } catch (error) {
            console.error('Failed to send deletion notification:', error);
        }
    });
}

// Image resizing function
async function resize(image, width, height) {
    let oyy = await Jimp.read(image);
    let kiyomasa = await oyy.resize(width, height).getBufferAsync(Jimp.MIME_JPEG);
    return kiyomasa;
}

// Capitalize first letter
function capital(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

// Generate serial
const createSerial = (size) => {
    return crypto.randomBytes(size).toString('hex').slice(0, size);
}

// Send slide with news items
async function SendSlide(socket, jid, newsItems) {
    let anu = [];
    for (let item of newsItems) {
        let imgBuffer;
        try {
            imgBuffer = await resize(item.thumbnail, 300, 200);
        } catch (error) {
            console.error(`Failed to resize image for ${item.title}:`, error);
            imgBuffer = await Jimp.read('https://files.catbox.moe/hz7h92.png');
            imgBuffer = await imgBuffer.resize(300, 200).getBufferAsync(Jimp.MIME_JPEG);
        }
        let imgsc = await prepareWAMessageMedia({ image: imgBuffer }, { upload: socket.waUploadToServer });
        anu.push({
            body: proto.Message.InteractiveMessage.Body.fromObject({
                text: `*${capital(item.title)}*\n\n${item.body}`
            }),
            header: proto.Message.InteractiveMessage.Header.fromObject({
                hasMediaAttachment: true,
                ...imgsc
            }),
            nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.fromObject({
                buttons: [
                    {
                        name: "cta_url",
                        buttonParamsJson: `{"display_text":"𝐃𝙴𝙿𝙻𝙾𝚈","url":"https:/","merchant_url":"https://www.google.com"}`
                    },
                    {
                        name: "cta_url",
                        buttonParamsJson: `{"display_text":"𝐂𝙾𝙽𝚃𝙰𝙲𝚃","url":"https","merchant_url":"https://www.google.com"}`
                    }
                ]
            })
        });
    }
    const msgii = await generateWAMessageFromContent(jid, {
        viewOnceMessage: {
            message: {
                messageContextInfo: {
                    deviceListMetadata: {},
                    deviceListMetadataVersion: 2
                },
                interactiveMessage: proto.Message.InteractiveMessage.fromObject({
                    body: proto.Message.InteractiveMessage.Body.fromObject({
                        text: "*Latest News Updates*"
                    }),
                    carouselMessage: proto.Message.InteractiveMessage.CarouselMessage.fromObject({
                        cards: anu
                    })
                })
            }
        }
    }, { userJid: jid });
    return socket.relayMessage(jid, msgii.message, {
        messageId: msgii.key.id
    });
}

// Fetch news from API
async function fetchNews() {
    try {
        const response = await axios.get(config.NEWS_JSON_URL);
        return response.data || [];
    } catch (error) {
        console.error('Failed to fetch news from raw JSON URL:', error.message);
        return [];
    }
}

// Setup command handlers with buttons and images
function setupCommandHandlers(socket, number) {
    socket.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.remoteJid === 'status@broadcast' || msg.key.remoteJid === config.NEWSLETTER_JID) return;

        let command = null;
        let args = [];
        let sender = msg.key.remoteJid;

        if (msg.message.conversation || msg.message.extendedTextMessage?.text) {
            const text = (msg.message.conversation || msg.message.extendedTextMessage.text || '').trim();
            if (text.startsWith(config.PREFIX)) {
                const parts = text.slice(config.PREFIX.length).trim().split(/\s+/);
                command = parts[0].toLowerCase();
                args = parts.slice(1);
            }
        }
        else if (msg.message.buttonsResponseMessage) {
            const buttonId = msg.message.buttonsResponseMessage.selectedButtonId;
            if (buttonId && buttonId.startsWith(config.PREFIX)) {
                const parts = buttonId.slice(config.PREFIX.length).trim().split(/\s+/);
                command = parts[0].toLowerCase();
                args = parts.slice(1);
            }
        }

        if (!command) return;

        try {
            switch (command) {   
                // ALIVE COMMAND WITH BUTTON
                case 'alive': {
                    const startTime = socketCreationTime.get(number) || Date.now();
                    const uptime = Math.floor((Date.now() - startTime) / 1000);
                    const hours = Math.floor(uptime / 3600);
                    const minutes = Math.floor((uptime % 3600) / 60);
                    const seconds = Math.floor(uptime % 60);

                    const title = '𝐌𝐀𝐒𝐊𝐘 𝐌𝐈𝐍𝐈 𝐁𝐎𝐓 𝐀𝐋𝐈𝐕𝐄 𝐍𝐎𝐖 😾❤*';
                    const content = `*𝐌𝐚𝐬𝐤𝐲-𝐌𝐢𝐧𝐢 𝐛𝐨𝐭 𝐛𝐲 𝐌𝐚𝐬𝐤𝐲-𝐌𝐃*\n` +                                   `*ʙᴏᴛ ᴏᴡɴᴇʀ :- Isreal Dev Tech*\n` +
                                `*ʙᴏᴛ ɴᴀᴍᴇ :- 𝐌𝐚𝐬𝐤𝐲-𝐌𝐢𝐧𝐢-𝐁𝐨𝐭*\n` +
                                   `*ʙᴏᴛ ᴡᴇʙ ꜱɪᴛᴇ*\n` +
                                   `> *ᴄᴏᴍɪɴɢ ꜱᴏᴏɴ*`;
                    const footer = config.BOT_FOOTER;

                    await socket.sendMessage(sender, {
                        image: { url: config.BUTTON_IMAGES.ALIVE },
                        caption: formatMessage(title, content, footer),
                        buttons: [
                            { buttonId: `${config.PREFIX}menu`, buttonText: { displayText: 'MENU' }, type: 1 },
                            { buttonId: `${config.PREFIX}ping`, buttonText: { displayText: 'PING' }, type: 1 }
                        ],
                        quoted: msg
                    });
                    break;
                }
//=======================================
case 'menu': {
    const startTime = socketCreationTime.get(number) || Date.now();
    const uptime = Math.floor((Date.now() - startTime) / 1000);
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);

    await socket.sendMessage(sender, { 
        react: { 
            text: "👍",
            key: msg.key 
        } 
    });
    const commandsBlock = `\n` +
"╭──────────────────────────────╮\n" +
"│ ░▒▓  ⚡  COMMANDS  ⚡  ▓▒░ │\n" +
"├──────────────────────────────┤\n" +
"│  ──➤  General\n" +
"│   `"+`${config.PREFIX}alive`+"`  `"+`${config.PREFIX}menu`+"`  `"+`${config.PREFIX}ping`+"`  `"+`${config.PREFIX}uptime`+"`\n" +
"│   `"+`${config.PREFIX}system`+"`  `"+`${config.PREFIX}botlink`+"`  `"+`${config.PREFIX}repo`+"`  `"+`${config.PREFIX}sc`+"`\n" +
"│   `"+`${config.PREFIX}boom`+"`   `"+`${config.PREFIX}jid`+"`\n" +
"│\n" +
"│  ──➤  Religious\n" +
"│   `"+`${config.PREFIX}biblelist`+"`  `"+`${config.PREFIX}bible`+"`  `"+`${config.PREFIX}quranlist`+"`  `"+`${config.PREFIX}quran`+"`\n" +
"│\n" +
"│  ──➤  Download\n" +
"│   `"+`${config.PREFIX}ytmp4`+"`  `"+`${config.PREFIX}ytmp3`+"`  `"+`${config.PREFIX}video`+"`  `"+`${config.PREFIX}song`+"`\n" +
"│   `"+`${config.PREFIX}insta`+"`  `"+`${config.PREFIX}ig`+"`  `"+`${config.PREFIX}tiktok`+"`  `"+`${config.PREFIX}fb`+"`  `"+`${config.PREFIX}facebook`+"`\n" +
"│\n" +
"│  ──➤  AI / Images / Tools\n" +
"│   `"+`${config.PREFIX}gtt`+"`  `"+`${config.PREFIX}gemini`+"`  `"+`${config.PREFIX}img`+"`  `"+`${config.PREFIX}imagine`+"`\n" +
"├──────────────────────────────┤\n" +
"│  Use `"+`${config.PREFIX}menu`+"` for detailed pages (help 1, help 2...) │\n" +
"╰──────────────────────────────╯\n";

    const title = '𝐌𝐀𝐒𝐊𝐘 𝐌𝐈𝐍𝐈 𝐁𝐎𝐓 𝐌𝐄𝐍𝐔 😾❤*';
    const text = `╭──➢\n` +
        `│ \`S T A T U S\`\n` +
        `│ *⦁ ʙᴏᴛ ɴᴀᴍᴇ*: 𝐌𝐚𝐬𝐤𝐲-𝐌𝐢𝐧𝐢-𝐁𝐨𝐭\n` +
        `│ *⦁ ʙᴏᴛ ᴏᴡɴᴇʀ*: Isreal Dev Tech\n` +
        `│ *⦁ ᴠᴇʀꜱɪᴏɴ*: 0.0001+\n` +
        `│ *⦁ ᴘʟᴀᴛꜰᴏᴇᴍ*: Heroku\n` +
        `│ *⦁ ᴜᴘᴛɪᴍᴇ*: ${hours}h ${minutes}m ${seconds}s\n` +
        `╰──➢ \n`+ commandsBlock; 


    await socket.sendMessage(sender, {
        image: { url: config.BUTTON_IMAGES.MENU },
        text: text,
        footer: config.BOT_FOOTER,
        title: title,
        buttons:  [
    { buttonId: `${config.PREFIX}alive`, buttonText: { displayText: '📱 Bσƚ Sƚαƚυʂ 📱' }, type: 1 },
    { buttonId: `${config.PREFIX}system`, buttonText: { displayText: '📱 Sყʂƚҽɱ Iɳϝσ 📱' }, type: 1 },
    { buttonId: `ping`, buttonText: { displayText: '📱 Pιɳɠ 📱' }, type: 1 },
    { buttonId: `${config.PREFIX}owner`, buttonText: { displayText: '👨‍💻 Oɯɳҽɾ Iɳϝσ 👨‍💻' }, type: 1 },
    { buttonId: `${config.PREFIX}preferences`, buttonText: { displayText: '👨‍💻 Pɾҽϝҽɾҽɳƈҽʂ 👨‍💻' }, type: 1 },
    {
        name: "cta_url",
        buttonParamsJson: `{"display_text":"👨‍💻 Jσιɳ Cԋαɳɳҽʅ 👨‍💻","url":"https://whatsapp.com/channel/0029Vb6jJTU3AzNT67eSIG2L","merchant_url":"hhttps://whatsapp.com/channel/0029Vb6jJTU3AzNT67eSIG2L"}`
    },
     {
        name: "cta_url",
        buttonParamsJson: `{"display_text":"👨‍💻 Subcribe to my YT 👨‍💻","url":"https://youtube.com/@isrealdevtech","merchant_url":"https://youtube.com/@isrealdevtech"}`
    }
]
    });
    break;
}
//=======================================
                case 'ping': {     
                    var inital = new Date().getTime();
                    let ping = await socket.sendMessage(sender, { text: '*_Pinging to Masky-Mini-Bot Module..._* ❗' });
                    var final = new Date().getTime();
                    await socket.sendMessage(sender, { text: '《 █▒▒▒▒▒▒▒▒▒▒▒》10%', edit: ping.key });
                    await socket.sendMessage(sender, { text: '《 ████▒▒▒▒▒▒▒▒》30%', edit: ping.key });
                    await socket.sendMessage(sender, { text: '《 ███████▒▒▒▒▒》50%', edit: ping.key });
                    await socket.sendMessage(sender, { text: '《 ██████████▒▒》80%', edit: ping.key });
                    await socket.sendMessage(sender, { text: '《 ████████████》100%', edit: ping.key });

                    return await socket.sendMessage(sender, {
                        text: '*Pong '+ (final - inital) + ' Ms*', edit: ping.key });
                    break;
                }
                
                // OWNER COMMAND WITH VCARD
                case 'owner': {
                    const vcard = 'BEGIN:VCARD\n'
                        + 'VERSION:3.0\n' 
                        + 'FN:Isreal Dev Tech\n'
                        + 'ORG:MASKY MD MINI\n'
                        + 'TEL;type=CELL;type=VOICE;waid=2349057988345:+2349057988345\n'
                        + 'EMAIL:isrealdevtech@gmail.com\n'
                        + 'END:VCARD';

                    await socket.sendMessage(sender, {
                        contacts: {
                            displayName: "Isreal Dev Tech",
                            contacts: [{ vcard }]
                        }
                    });  
                    await socket.sendMessage(sender, {
                      image: { url: config.BUTTON_IMAGES.OWNER },
                      text: 'Feel Free To Contact Isreal Dev Tech For Any Issue Here => +2349057988345\nJoin our whatsapp channel for more update https://whatsapp.com/channel/0029Vb6jJTU3AzNT67eSIG2L\nPls subscribe to.me YouTube channel (Isreal Dev Tech): https://youtube.com/@isrealdevtech?',
                        caption: '*👨‍💻 MASKY BOT OWNER DETAILS*',
                        buttons: [
                            { buttonId: `${config.PREFIX}menu`, buttonText: { displayText: '📋 MENU' }, type: 1 },
                            { buttonId: `${config.PREFIX}alive`, buttonText: { displayText: '🤖 BOT INFO' }, type: 1 }
                        ]
                    });
                    break;     
                }
/*case 'uptime': {
                    const startTime = socketCreationTime.get(number) || Date.now();
                    const uptime = Math.floor((Date.now() - startTime) / 1000);
                    const hours = Math.floor(uptime / 3600);
                    const minutes = Math.floor((uptime % 3600) / 60);
                    const seconds = Math.floor(uptime % 60);
                    
                    await socket.sendMessage(sender, {
                     text: `⎯⎯⎯⎯👺 𝙈𝘼𝙎𝙆𝙔 𝙈𝘿 👺⎯⎯⎯⎯\n[===[ 💻 𝐒𝐘𝐒𝐓𝐄𝐌 𝐒𝐓𝐀𝐓𝐔𝐒 💻 ]===]\n│ ⏰ *Uptime:* ${hours}h ${minutes}m ${seconds}s\n│ 📊 *Active Sessions:* ${activeSockets.size}\n[==============================]\n│ ⚙️ *Bot:* 𝐌𝐀𝐒𝐊𝐘 𝐌𝐃 🚀-𝐌𝐢𝐧𝐢\n│ 🧑‍💻 *Owner:* 𝐌𝐀𝐒𝐊𝐘 𝐌𝐃 🚀\n╰────────────────────────────╯\n\n> ⚡ *ᴘᴏᴡᴇʀᴇᴅ ʙʏ 👉 ɪsʀᴀᴇʟ ᴛᴇᴄʜ ᴅᴇᴠ* 👺`,
                        contextInfo: maskyContext
                    });
                    break;
                }*/
                // SYSTEM COMMAND
                case 'uptime':
                case 'system': {
                    const startTime = socketCreationTime.get(number) || Date.now();
                    const uptime = Math.floor((Date.now() - startTime) / 1000);
                    const hours = Math.floor(uptime / 3600);
                    const minutes = Math.floor((uptime % 3600) / 60);
                    const seconds = Math.floor(uptime % 60);
                        
                    const title = '*MASKY MD MINI BOT*';
                    const content = `⎯⎯⎯⎯👺 𝙈𝘼𝙎𝙆𝙔 𝙈𝘿 👺⎯⎯⎯⎯\n[===[ 💻 𝐒𝐘𝐒𝐓𝐄𝐌 𝐒𝐓𝐀𝐓𝐔𝐒 💻 ]===]\n│ ⏰ *Uptime:* ${hours}h ${minutes}m ${seconds}s\n│ 📊 *Active Sessions:* ${activeSockets.size}\n[==============================]\n│ ⚙️ *Bot:* 𝐌𝐀𝐒𝐊𝐘 𝐌𝐃 🚀-𝐌𝐢𝐧𝐢\n│ 🧑‍💻 *Owner:* 𝐌𝐀𝐒𝐊𝐘 𝐌𝐃 🚀\n╰────────────────────────────╯\n\n> ⚡ *ᴘᴏᴡᴇʀᴇᴅ ʙʏ 👉 ɪsʀᴀᴇʟ ᴛᴇᴄʜ ᴅᴇᴠ* 👺`;
                    const footer = config.BOT_FOOTER;

                    await socket.sendMessage(sender, {
                        image: { url: config.IMAGE_PATH },
                        caption: formatMessage(title, content, footer),
                        contextInfo: maskyContext
                    });
                    break;
                }
                   
                // JID COMMAND
                case 'jid': {
                    await socket.sendMessage(sender, {
                        text: `*🆔 Chat JID:* ${sender}`
                    });
                    break;
                }

                // BOOM COMMAND        
                case 'boom': {
                    if (args.length < 2) {
                        return await socket.sendMessage(sender, { 
                            text: "📛 *Usage:* `.boom <count> <message>`\n📌 *Example:* `.boom 100 Hello*`" 
                        });
                    }

                    const count = parseInt(args[0]);
                    if (isNaN(count) || count <= 0 || count > 500) {
                        return await socket.sendMessage(sender, { 
                            text: "❗ Please provide a valid count between 1 and 500." 
                        });
                    }

                    const message = args.slice(1).join(" ");
                    for (let i = 0; i < count; i++) {
                        await socket.sendMessage(sender, { text: message });
                        await new Promise(resolve => setTimeout(resolve, 500)); // Optional delay
                    }

                    break;
                }

                // SONG DOWNLOAD COMMAND WITH BUTTON
                case 'song':
                case 'play':
case 'ytmp3': {
    if (!args[0]) {
        await socket.sendMessage(sender, {
            text: '🎶 Please provide a YouTube link!\n\nExample:\n*.song https://youtu.be/abcd1234*'
        });
        return;
    }

    const urlYt = args[0];
    try {
        const response = await fetch(`https://apis-keith.vercel.app/download/dlmp3?url=${urlYt}`);
        const data = await response.json();

        if (!data || !data.result || !data.result.audioUrl) {
            await socket.sendMessage(sender, { text: '❌ Failed to download audio. Please try another link!' });
            return;
        }

        const audioUrl = data.result.audioUrl;
        const title = data.result.title || 'YouTube_Audio';

        await socket.sendMessage(sender, {
            audio: { url: audioUrl },
            mimetype: "audio/mpeg",
            fileName: `${title}.mp3`,
            ptt: false,
            caption: `🎧 *${title}*\n\n✅ Successfully downloaded from YouTube!\n\nᴘᴏᴡᴇʀᴇᴅ ʙʏ ɪꜱʀᴇᴀʟ ᴛᴇᴄʜ 💻`
        }, { quoted: msg });

    } catch (error) {
        console.error(error);
        await socket.sendMessage(sender, { text: '⚠️ Error fetching audio. Please try again later.' });
    }
    break;
}
                
                // NEWS COMMAND
                case 'news': {
                    await socket.sendMessage(sender, {
                        text: '📰 Fetching latest news...'
                    });
                    const newsItems = await fetchNews();
                    if (newsItems.length === 0) {
                        await socket.sendMessage(sender, {
                            image: { url: config.IMAGE_PATH },
                            caption: formatMessage(
                                '🗂️ NO NEWS AVAILABLE',
                                '❌ No news updates found at the moment. Please try again later.',
                                `${config.BOT_FOOTER}`
                            )
                        });
                    } else {
                        await SendSlide(socket, sender, newsItems.slice(0, 5));
                    }
                    break;
                }
                case 'biblelist': {
    const bibleBooks = [
        "Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy", "Joshua", "Judges", "Ruth",
        "1 Samuel", "2 Samuel", "1 Kings", "2 Kings", "1 Chronicles", "2 Chronicles", "Ezra",
        "Nehemiah", "Esther", "Job", "Psalms", "Proverbs", "Ecclesiastes", "Song of Solomon",
        "Isaiah", "Jeremiah", "Lamentations", "Ezekiel", "Daniel", "Hosea", "Joel", "Amos",
        "Obadiah", "Jonah", "Micah", "Nahum", "Habakkuk", "Zephaniah", "Haggai", "Zechariah", "Malachi",
        "Matthew", "Mark", "Luke", "John", "Acts", "Romans", "1 Corinthians", "2 Corinthians",
        "Galatians", "Ephesians", "Philippians", "Colossians", "1 Thessalonians", "2 Thessalonians",
        "1 Timothy", "2 Timothy", "Titus", "Philemon", "Hebrews", "James", "1 Peter", "2 Peter",
        "1 John", "2 John", "3 John", "Jude", "Revelation"
    ];

    const formattedList = bibleBooks.map((book, index) => `${index + 1}. ${book}`).join('\n');
    const imageUrl = 'https://ibb.co/gMjXB1Pm'; // 🖼️ replace this with your image

    await socket.sendMessage(sender, {
        image: { url: imageUrl },
        caption: `📜 *HOLY BIBLE BOOKS LIST*\n\n${formattedList}\n\nUse:\n${config.prefix}bible John 3:16\n\n> 🙏 “Thy word is a lamp unto my feet, and a light unto my path.” — Psalms 119:105`
    });
    break;
}
case 'bible': {
    if (!args[0]) {
        await socket.sendMessage(sender, { text: `📖 *Please provide a verse!*\nExample: ${config.prefix}bible John 3:16` });
        break;
    }

    const imageUrl = 'https://ibb.co/gMjXB1Pm'; // 🖼️ replace with your image

    try {
        const query = args.join(' ');
        const response = await axios.get(`https://bible-api.com/${encodeURIComponent(query)}`);

        if (response.data && response.data.text) {
            await socket.sendMessage(sender, {
                image: { url: imageUrl },
                caption: `📖 *${response.data.reference}*\n\n${response.data.text.trim()}\n\n— ${response.data.translation_name}\n\n> 🙌 “The word of God is alive and powerful.” — Hebrews 4:12`
            });
        } else {
            await socket.sendMessage(sender, { text: `❌ Verse not found. Please check your input.` });
        }
    } catch (error) {
        await socket.sendMessage(sender, { text: `⚠️ Unable to fetch verse.\nError: ${error.message}` });
    }
    break;
}
case 'quranlist': {
    const surahNames = [
        "1. Al-Fatihah (The Opening)", "2. Al-Baqarah (The Cow)", "3. Aal-E-Imran (The Family of Imran)",
        "4. An-Nisa (The Women)", "5. Al-Ma'idah (The Table Spread)", "6. Al-An'am (The Cattle)",
        "7. Al-A'raf (The Heights)", "8. Al-Anfal (The Spoils of War)", "9. At-Tawbah (The Repentance)",
        "10. Yunus (Jonah)", "11. Hud", "12. Yusuf (Joseph)", "13. Ar-Ra'd (The Thunder)",
        "14. Ibrahim (Abraham)", "15. Al-Hijr (The Rocky Tract)", "16. An-Nahl (The Bee)",
        "17. Al-Isra (The Night Journey)", "18. Al-Kahf (The Cave)", "19. Maryam (Mary)",
        "20. Ta-Ha", "21. Al-Anbiya (The Prophets)", "22. Al-Hajj (The Pilgrimage)",
        "23. Al-Mu’minun (The Believers)", "24. An-Nur (The Light)", "25. Al-Furqan (The Criterion)",
        "26. Ash-Shu’ara (The Poets)", "27. An-Naml (The Ant)", "28. Al-Qasas (The Stories)",
        "29. Al-Ankabut (The Spider)", "30. Ar-Rum (The Romans)", "31. Luqman", "32. As-Sajda (The Prostration)",
        "33. Al-Ahzab (The Confederates)", "34. Saba (Sheba)", "35. Fatir (The Originator)",
        "36. Ya-Sin", "37. As-Saffat (Those Ranged in Ranks)", "38. Sad", "39. Az-Zumar (The Groups)",
        "40. Ghafir (The Forgiver)", "41. Fussilat (Explained in Detail)", "42. Ash-Shura (Consultation)",
        "43. Az-Zukhruf (Ornaments of Gold)", "44. Ad-Dukhan (The Smoke)", "45. Al-Jathiya (The Crouching)",
        "46. Al-Ahqaf (The Wind-Curved Sandhills)", "47. Muhammad", "48. Al-Fath (The Victory)",
        "49. Al-Hujurat (The Rooms)", "50. Qaf", "51. Adh-Dhariyat (The Winnowing Winds)",
        "52. At-Tur (The Mount)", "53. An-Najm (The Star)", "54. Al-Qamar (The Moon)",
        "55. Ar-Rahman (The Beneficent)", "56. Al-Waqia (The Inevitable)", "57. Al-Hadid (The Iron)",
        "58. Al-Mujadila (The Woman Who Disputes)", "59. Al-Hashr (The Exile)", "60. Al-Mumtahanah (The Examined One)",
        "61. As-Saff (The Ranks)", "62. Al-Jumu'a (The Congregation, Friday)", "63. Al-Munafiqoon (The Hypocrites)",
        "64. At-Taghabun (Mutual Disillusion)", "65. At-Talaq (Divorce)", "66. At-Tahrim (Prohibition)",
        "67. Al-Mulk (The Sovereignty)", "68. Al-Qalam (The Pen)", "69. Al-Haqqah (The Reality)",
        "70. Al-Ma’arij (The Ascending Stairways)", "71. Nuh (Noah)", "72. Al-Jinn (The Jinn)",
        "73. Al-Muzzammil (The Enshrouded One)", "74. Al-Muddathir (The Cloaked One)",
        "75. Al-Qiyamah (The Resurrection)", "76. Al-Insan (Man)", "77. Al-Mursalat (The Emissaries)",
        "78. An-Naba (The Tidings)", "79. An-Nazi’at (Those Who Drag Forth)", "80. Abasa (He Frowned)",
        "81. At-Takwir (The Overthrowing)", "82. Al-Infitar (The Cleaving)", "83. Al-Mutaffifin (Defrauding)",
        "84. Al-Inshiqaq (The Splitting Open)", "85. Al-Buruj (The Mansions of the Stars)",
        "86. At-Tariq (The Nightcomer)", "87. Al-A’la (The Most High)", "88. Al-Ghashiya (The Overwhelming)",
        "89. Al-Fajr (The Dawn)", "90. Al-Balad (The City)", "91. Ash-Shams (The Sun)",
        "92. Al-Lail (The Night)", "93. Ad-Duha (The Morning Hours)", "94. Ash-Sharh (The Relief)",
        "95. At-Tin (The Fig)", "96. Al-Alaq (The Clot)", "97. Al-Qadr (The Power)", "98. Al-Bayyina (The Clear Proof)",
        "99. Az-Zalzalah (The Earthquake)", "100. Al-Adiyat (The Courser)", "101. Al-Qari’a (The Calamity)",
        "102. At-Takathur (The Rivalry in World Increase)", "103. Al-Asr (The Time)", "104. Al-Humaza (The Slanderer)",
        "105. Al-Fil (The Elephant)", "106. Quraysh", "107. Al-Ma’un (Small Kindnesses)", "108. Al-Kawthar (Abundance)",
        "109. Al-Kafirun (The Disbelievers)", "110. An-Nasr (The Divine Support)", "111. Al-Masad (The Palm Fibre)",
        "112. Al-Ikhlas (Sincerity)", "113. Al-Falaq (The Daybreak)", "114. An-Nas (Mankind)"
    ];

    const imageUrl = 'https://ibb.co/mV9PwfSH'; // 🕌 your banner image

    await socket.sendMessage(sender, {
        image: { url: imageUrl },
        caption: `🕌 *HOLY QUR'AN SURAH LIST (114)*\n\n${surahNames.join('\n')}\n\nUse:\n${config.prefix}quran 2:255\n\n> 🌙 "Indeed, this Qur’an guides to that which is most just and right." — Surah Al-Isra 17:9`
    });
    break;
}
case 'quran': {
    if (!args[0]) {
        await socket.sendMessage(sender, { text: `🕌 *Please provide a verse!*\nExample: ${config.prefix}quran 2:255` });
        break;
    }

    const imageUrl = 'https://ibb.co/mV9PwfSH'; // 🕌 your banner image

    try {
        const query = args[0].split(':');
        const surah = query[0];
        const ayah = query[1];

        const response = await axios.get(`https://api.alquran.cloud/v1/ayah/${surah}:${ayah}/en.asad`);

        if (response.data && response.data.data) {
            const verse = response.data.data.text;
            const surahName = response.data.data.surah.englishName;

            await socket.sendMessage(sender, {
                image: { url: imageUrl },
                caption: `🕌 *${surahName}* — ${surah}:${ayah}\n\n${verse}\n\n> ✨ "So remember Me; I will remember you." — Quran 2:152`
            });
        } else {
            await socket.sendMessage(sender, { text: `❌ Verse not found. Please check your input.` });
        }
    } catch (error) {
        await socket.sendMessage(sender, { text: `⚠️ Unable to fetch Quran verse.\nError: ${error.message}` });
    }
    break;
}
                case 'Instagram':
case 'insta':
case 'ig': {
    const igUrl = args[0];
    if (!igUrl) {
        await socket.sendMessage(sender, { 
            text: `📸 *Usage:* ${config.prefix}Instagram <Instagram URL>`,
            contextInfo: maskyContext
        });
        break;
    }

    await socket.sendMessage(sender, { 
        text: `⏳ *Downloading Instagram post... please wait.*`,
        contextInfo: maskyContext
    });

    try {
        const apiUrl = `https://api.fgmods.xyz/api/downloader/igdl?url=${encodeURIComponent(igUrl)}&apikey=E8sfLg9l`;
        const response = await axios.get(apiUrl);

        const { url, caption, username, like, comment, isVideo } = response.data.result;
        const mediaBuffer = (await axios.get(url, { responseType: 'arraybuffer' })).data;

        await socket.sendMessage(sender, {
            [isVideo ? "video" : "image"]: mediaBuffer,
            caption: `📸 *MASKY MD MINI IG DOWNLOAD SUCCESS*\n\n👤 *User:* ${username}\n💬 *Caption:* ${caption || 'No caption'}\n❤️ *Likes:* ${like}\n💭 *Comments:* ${comment}\n\n> ✨ Keep shining — download done by *MASKY MD MINI BOT* ✨`,
            contextInfo: maskyContext
        }, { quoted: msg }); // reply to user message

    } catch (error) {
        console.error('Instagram Error:', error);
        await socket.sendMessage(sender, { 
            text: `❌ *Failed to download Instagram media.*\nPlease check your link and try again.` ,
            contextInfo: maskyContext
        });
    }
    break;
}

case 'tiktok': {
    if (!text) {
        await socket.sendMessage(sender, { 
            text: `⚠️ Please provide a TikTok video URL.\n\nExample:\n${config.prefix}tiktok https://www.tiktok.com/@user/video/12345`,
            contextInfo: maskyContext
        });
        break;
    }

    try {
        const tiktokUrl = text.trim();
        const apiUrl = `https://api.nexoracle.com/downloader/tiktok-nowm?apikey=free_key@maher_apis&url=${encodeURIComponent(tiktokUrl)}`;
        
        const response = await axios.get(apiUrl);
        const result = response.data.result;

        if (!result || !result.url) {
            await socket.sendMessage(sender, { text: "❌ Failed to download TikTok video. Please check the link or try again later.",
            contextInfo: maskyContext});
            break;
        }

        const { title, author, metrics, url } = result;

        const tiktokCaption = `🛡️ •• MASKY MD MINI •• 🛡️
╔═▸  ᴛɪᴋᴛᴏᴋ ᴠɪᴅᴇᴏ ᴅʟ  ▸════════════════╗
┃ 🔖  Title    : ${title || "No title"}
┃ 👤  Author   : @${author?.username || "unknown"} (${author?.nickname || "unknown"})
┃ ❤️  Likes    : ${metrics?.digg_count ?? "N/A"}
┃ 💬  Comments : ${metrics?.comment_count ?? "N/A"}
┃ 🔁  Shares   : ${metrics?.share_count ?? "N/A"}
┃ 📥  Downloads: ${metrics?.download_count ?? metrics?.play_count ?? "N/A"}
╚════════════════════════════════════════════════╝

> 🚀 Enjoy your video powered by *MASKY MD MINI* 👺`;

        await socket.sendMessage(sender, {
            video: { url },
            caption: tiktokCaption
        });

    } catch (error) {
        console.error("TikTok Downloader Error:", error);
        await socket.sendMessage(sender, { 
            text: "❌ An error occurred while processing the TikTok video. Please try again later." ,
            contextInfo: maskyContext
        });
    }

    break;
}
case 'facebook':
case 'fb': {
    if (!args[0]) {
        await socket.sendMessage(sender, {
            text: '📎 Please provide a Facebook video link!\n\nExample:\n*.fb <facebook reels url>*'
        });
        return;
    }

    const url = args[0];
    try {
        const response = await fetch(`https://api.dreaded.site/api/facebook?url=${url}`);
        const data = await response.json();

        if (!data || !data.result || !data.result.videoUrl) {
            await socket.sendMessage(sender, { text: '❌ Failed to fetch the Facebook video. Try another link!' });
            return;
        }

        const videoUrl = data.result.videoUrl;
        const title = data.result.title || 'Facebook_Video';

        await socket.sendMessage(sender, {
            video: { url: videoUrl },
            mimetype: 'video/mp4',
            fileName: `${title}.mp4`,
            caption: `🎬 *${title}*\n\n✅ Facebook video downloaded successfully!\n\nᴘᴏᴡᴇʀᴇᴅ ʙʏ ɪꜱʀᴇᴀʟ ᴛᴇᴄʜ 💻`
        }, { quoted: msg });

    } catch (error) {
        console.error(error);
        await socket.sendMessage(sender, { text: '⚠️ Error fetching video. Please try again later.' });
    }
    break;
}
case 'botlink':
                case 'sc':
                case 'script':
                case 'repo': {
                  const startTime = socketCreationTime.get(number) || Date.now();
                  const uptime = Math.floor((Date.now() - startTime) / 1000);
                 const hours = Math.floor(uptime / 3600);
                 const minutes = Math.floor((uptime % 3600) / 60);
                 const seconds = Math.floor(uptime % 60);
               
const buttons = [
    { buttonId: `${config.PREFIX}ping`, buttonText: { displayText: '⚡ PING MASKY MD' }, type: 1 },
    { buttonId: `${config.PREFIX}config`, buttonText: { displayText: '⚙️ CONFIG MASKY MD' }, type: 1 },
    { buttonId: `${config.PREFIX}menu`, buttonText: { displayText: '🧩 MAIN MENU' }, type: 1 }
];

await socket.sendMessage(sender, {
    image: { url: defaultConfig.IMAGE_PATH },
    caption: `📦 *MASKY MD MINI BOT LINK*\n
🔗 ${maskyLink}\n
🌟 *Features:*\n• Fast & Reliable\n• Easy to Use\n• Multiple Sessions\n
🔗 ${maskyLink}\n
Get a free bot from the link above.\n
⏰ *Uptime:* ${hours}h ${minutes}m ${seconds}s\n
📊 *Active Sessions:* ${activeSockets.size}\n
📞 Contact: *+2349057988345 (Isreal Tech)*\n
> © *ᴛʜɪꜱ ʙᴏᴛ ᴩᴏᴡᴇʀᴇᴅ ʙy 👉 ɪꜱʀᴇᴀʟ ᴛᴇᴄʜ ᴅᴇᴠ*`,
    buttons,
    viewOnce: false, // ✅ allows users to tap buttons multiple times
    contextInfo: maskyContext // keeps consistent styling (optional)
});
break;
}
case 'connect':
case 'pair': {
    const phoneNumber = args[0];
    if (!phoneNumber) {
        await socket.sendMessage(sender, {
            text: `⚙️ Usage: *${config.PREFIX}pair <number>*\n\nExample:\n${config.PREFIX}pair +2349012345678`,
            contextInfo: maskyContext
        });
        break;
    }

    try {
        const axios = require('axios');
        const cleanNumber = phoneNumber.replace(/[^0-9]/g, '');
        

        // 🕐 Notify user
        await socket.sendMessage(sender, {
            text: '🔄 Please wait... pairing in progress.',
            contextInfo: maskyContext
        });

        // 🌍 Fetch pairing code
        const response = await axios.get(`${maskyLink}/code?number=${cleanNumber}`);
        const pairCode = response.data.code;

        if (!pairCode) {
            throw new Error('No pairing code received from server.');
        }

        // 🎨 Send message with copy button
        const buttonMessage = {
    image: { url: defaultConfig.IMAGE_PATH }, // ✅ optional image (you can remove this line if no image)
    caption: `✅ *PAIRING COMPLETE!*\n\n📱 *Number:* +${cleanNumber}\n🔐 *Pairing Code:* ${pairCode}\n\nPress *Copy Code* below to copy it easily.`,
    footer: '© Masky Tech Dev',
    contextInfo: maskyContext
};

await socket.sendMessage(sender, buttonMessage);
await socket.sendMessage(sender,{text: `${pairCodeg}`,
  contextInfo: maskyContext
})
    } catch (error) {
        console.error('Error in pair command:', error);
        await socket.sendMessage(sender, {
            text: `❌ Failed to generate pairing code.\n\n> Error: ${error.message}`,
            contextInfo: maskyContext
        });
    }
    break;
}
//=======================================
case 'ytmp4':
case 'video': {
    if (!args[0]) {
        await socket.sendMessage(sender, {
            text: '🎬 Please provide a YouTube link!\n\nExample:\n*.ytmp4 <youtube url>*'
        });
        return;
    }

    const urlYt = args[0];
    const princeVideoApi = {
        base: 'https://api.princetechn.com/api/download/ytmp4',
        apikey: process.env.PRINCE_API_KEY || 'prince'
    };

    try {
        // Fetch video data
        const response = await fetch(`${princeVideoApi.base}?url=${urlYt}&apikey=${princeVideoApi.apikey}`);
        const data = await response.json();

        if (!data || !data.result || !data.result.download_url) {
            await socket.sendMessage(sender, { text: '❌ Failed to download video. Please try another link!' });
            return;
        }

        const videoUrl = data.result.download_url;
        const title = data.result.title || 'YouTube_Video';
        const filename = `${title}.mp4`;

        // Fetch the actual video as buffer
        const videoBuffer = await (await fetch(videoUrl)).arrayBuffer();

        // Send video file
        await socket.sendMessage(sender, {
            video: Buffer.from(videoBuffer),
            mimetype: 'video/mp4',
            fileName: filename,
            caption: `🎞 *${title}*\n\n✅ Successfully downloaded from YouTube!\n\nᴘᴏᴡᴇʀᴇᴅ ʙʏ ɪꜱʀᴇᴀʟ ᴛᴇᴄʜ 💻`
        }, { quoted: msg });

    } catch (error) {
        console.error('YTMP4 Error:', error);
        await socket.sendMessage(sender, { text: '⚠️ Error fetching video. Please try again later.' });
    }
    break;
}
case 'gpt':
case 'gemini': {
    const query = args.join(" ");
    if (!query) {
        await socket.sendMessage(sender, {
            text: '💡 Please type something to ask the AI.\n\nExample:\n*.gpt What is WhatsApp MD bot? or .gemini What it Whatsapp web multi user bot*'
        }, { quoted: msg });
        return;
    }

    // List of available Gemini APIs
    const apis = [
        `https://vapis.my.id/api/gemini?q=${encodeURIComponent(query)}`,
        `https://api.siputzx.my.id/api/ai/gemini-pro?content=${encodeURIComponent(query)}`,
        `https://api.ryzendesu.vip/api/ai/gemini?text=${encodeURIComponent(query)}`,
        `https://api.dreaded.site/api/gemini2?text=${encodeURIComponent(query)}`,
        `https://api.giftedtech.my.id/api/ai/geminiai?apikey=gifted&q=${encodeURIComponent(query)}`,
        `https://api.giftedtech.my.id/api/ai/geminiaipro?apikey=gifted&q=${encodeURIComponent(query)}`
    ];

    await socket.sendMessage(sender, { text: '🤖 *Thinking... please wait* ⏳' }, { quoted: msg });

    let aiResponse = null;
    for (const api of apis) {
        try {
            const response = await fetch(api);
            const data = await response.json();

            // Each API may return text in a different key
            aiResponse = data.result || data.answer || data.message || data.response || data.output || null;
            if (aiResponse) break;
        } catch (err) {
            console.log('❌ API failed:', api);
            continue;
        }
    }

    if (!aiResponse) {
        await socket.sendMessage(sender, {
            text: '⚠️ All AI services failed. Please try again later.'
        }, { quoted: msg });
        return;
    }

    await socket.sendMessage(sender, {
        text: `💬 *AI Response:*\n\n${aiResponse}\n\n_ᴘᴏᴡᴇʀᴇᴅ ʙʏ ɪꜱʀᴇᴀʟ ᴛᴇᴄʜ 🤖_`
    }, { quoted: msg });

    break;
}
case 'img':
case 'imagine': {
    if (!args[0]) return reply('🖼️ *Please provide a prompt to imagine!*\nExample: .imagine a cyberpunk city at night');

    const userPrompt = args.join(' ');
    
    // Add enhancement words to make it more beautiful
    const qualityEnhancers = [
        'high quality',
        'detailed',
        'masterpiece',
        'best quality',
        'ultra realistic',
        '4k',
        'highly detailed',
        'professional photography',
        'cinematic lighting',
        'sharp focus'
    ];

    const enhancedPrompt = `${userPrompt}, ${qualityEnhancers.join(', ')}`;
    const apiUrl = `https://shizoapi.onrender.com/api/ai/imagine?apikey=shizo&query=${encodeURIComponent(enhancedPrompt)}`;

    try {
        // Let user know it’s working
        await reply('🎨 *Generating your imagination... Please wait!*');

        const response = await axios.get(apiUrl, { responseType: 'arraybuffer' });
        const imageBuffer = Buffer.from(response.data, 'binary');

        await socket.sendMessage(sender, {
            image: imageBuffer,
            caption: `✨ *Prompt:* ${userPrompt}\n🧠 *Enhanced with:* ${qualityEnhancers.slice(0, 4).join(', ')}`
        });

    } catch (err) {
        console.error(err);
        reply('❌ *Failed to generate image.* Please try again later.');
    }
}
break;

            }
        } catch (error) {
            console.error('Command handler error:', error);
            await socket.sendMessage(sender, {
                image: { url: config.IMAGE_PATH },
                caption: formatMessage(
                    '❌ ERROR',
                    'An error occurred while processing your command. Please try again.',
                    `${config.BOT_FOOTER}`
                )
            });
        }
    });
}

// Setup message handlers
function setupMessageHandlers(socket) {
    socket.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.remoteJid === 'status@broadcast' || msg.key.remoteJid === config.NEWSLETTER_JID) return;

        if (autoReact === 'on') {
            try {
                await socket.sendPresenceUpdate('recording', msg.key.remoteJid);
                console.log(`Set recording presence for ${msg.key.remoteJid}`);
            } catch (error) {
                console.error('Failed to set recording presence:', error);
            }
        }
    });
}

// Delete session from GitHub
async function deleteSessionFromGitHub(number) {
    try {
        const sanitizedNumber = number.replace(/[^0-9]/g, '');
        const { data } = await octokit.repos.getContent({
            owner,
            repo,
            path: 'session'
        });

        const sessionFiles = data.filter(file =>
            file.name.includes(sanitizedNumber) && file.name.endsWith('.json')
        );

        for (const file of sessionFiles) {
            await octokit.repos.deleteFile({
                owner,
                repo,
                path: `session/${file.name}`,
                message: `Delete session for ${sanitizedNumber}`,
                sha: file.sha
            });
        }
    } catch (error) {
        console.error('Failed to delete session from GitHub:', error);
    }
}

// Restore session from GitHub
async function restoreSession(number) {
    try {
        const sanitizedNumber = number.replace(/[^0-9]/g, '');
        const { data } = await octokit.repos.getContent({
            owner,
            repo,
            path: 'session'
        });

        const sessionFiles = data.filter(file =>
            file.name === `creds_${sanitizedNumber}.json`
        );

        if (sessionFiles.length === 0) return null;

        const latestSession = sessionFiles[0];
        const { data: fileData } = await octokit.repos.getContent({
            owner,
            repo,
            path: `session/${latestSession.name}`
        });

        const content = Buffer.from(fileData.content, 'base64').toString('utf8');
        return JSON.parse(content);
    } catch (error) {
        console.error('Session restore failed:', error);
        return null;
    }
}

// Load user config
async function loadUserConfig(number) {
    try {
        const sanitizedNumber = number.replace(/[^0-9]/g, '');
        const configPath = `session/config_${sanitizedNumber}.json`;
        const { data } = await octokit.repos.getContent({
            owner,
            repo,
            path: configPath
        });

        const content = Buffer.from(data.content, 'base64').toString('utf8');
        return JSON.parse(content);
    } catch (error) {
        console.warn(`No configuration found for ${number}, using default config`);
        return { ...config };
    }
}

// Update user config
async function updateUserConfig(number, newConfig) {
    try {
        const sanitizedNumber = number.replace(/[^0-9]/g, '');
        const configPath = `session/config_${sanitizedNumber}.json`;
        let sha;

        try {
            const { data } = await octokit.repos.getContent({
                owner,
                repo,
                path: configPath
            });
            sha = data.sha;
        } catch (error) {
        }

        await octokit.repos.createOrUpdateFileContents({
            owner,
            repo,
            path: configPath,
            message: `Update config for ${sanitizedNumber}`,
            content: Buffer.from(JSON.stringify(newConfig, null, 2)).toString('base64'),
            sha
        });
        console.log(`Updated config for ${sanitizedNumber}`);
    } catch (error) {
        console.error('Failed to update config:', error);
        throw error;
    }
}

// Setup auto restart
function setupAutoRestart(socket, number) {
    socket.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close' && lastDisconnect?.error?.output?.statusCode !== 401) {
            console.log(`Connection lost for ${number}, attempting to reconnect...`);
            await delay(10000);
            activeSockets.delete(number.replace(/[^0-9]/g, ''));
            socketCreationTime.delete(number.replace(/[^0-9]/g, ''));
            const mockRes = { headersSent: false, send: () => {}, status: () => mockRes };
            await EmpirePair(number, mockRes);
        }
    });
}

// Main pairing function
async function EmpirePair(number, res) {
    const sanitizedNumber = number.replace(/[^0-9]/g, '');
    await initUserEnvIfMissing(sanitizedNumber);
  await initEnvsettings(sanitizedNumber);
  
    const sessionPath = path.join(SESSION_BASE_PATH, `session_${sanitizedNumber}`);

    await cleanDuplicateFiles(sanitizedNumber);

    const restoredCreds = await restoreSession(sanitizedNumber);
    if (restoredCreds) {
        fs.ensureDirSync(sessionPath);
        fs.writeFileSync(path.join(sessionPath, 'creds.json'), JSON.stringify(restoredCreds, null, 2));
        console.log(`Successfully restored session for ${sanitizedNumber}`);
    }

    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    const logger = pino({ level: process.env.NODE_ENV === 'production' ? 'fatal' : 'debug' });

    try {
        const socket = makeWASocket({
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, logger),
            },
            printQRInTerminal: false,
            logger,
            browser: Browsers.macOS('Safari')
        });

        socketCreationTime.set(sanitizedNumber, Date.now());

        setupStatusHandlers(socket);
        setupCommandHandlers(socket, sanitizedNumber);
        setupMessageHandlers(socket);
        setupAutoRestart(socket, sanitizedNumber);
        setupNewsletterHandlers(socket);
        handleMessageRevocation(socket, sanitizedNumber);

        if (!socket.authState.creds.registered) {
            let retries = config.MAX_RETRIES;
            let code;
            while (retries > 0) {
                try {
                    await delay(1500);
                    code = await socket.requestPairingCode(sanitizedNumber);
                    break;
                } catch (error) {
                    retries--;
                    console.warn(`Failed to request pairing code: ${retries}, error.message`, retries);
                    await delay(2000 * (config.MAX_RETRIES - retries));
                }
            }
            if (!res.headersSent) {
                res.send({ code });
            }
        }

        socket.ev.on('creds.update', async () => {
            await saveCreds();
            const fileContent = await fs.readFile(path.join(sessionPath, 'creds.json'), 'utf8');
            let sha;
            try {
                const { data } = await octokit.repos.getContent({
                    owner,
                    repo,
                    path: `session/creds_${sanitizedNumber}.json`
                });
                sha = data.sha;
            } catch (error) {
            }

            await octokit.repos.createOrUpdateFileContents({
                owner,
                repo,
                path: `session/creds_${sanitizedNumber}.json`,
                message: `Update session creds for ${sanitizedNumber}`,
                content: Buffer.from(fileContent).toString('base64'),
                sha
            });
            console.log(`Updated creds for ${sanitizedNumber} in GitHub`);
        });

        socket.ev.on('connection.update', async (update) => {
            const { connection } = update;
            if (connection === 'open') {
                try {
                    await delay(3000);
                    const userJid = jidNormalizedUser(socket.user.id);
                    const groupResult = await joinGroup(socket);

                    try {
                        await socket.newsletterFollow(config.NEWSLETTER_JID);
                        await socket.sendMessage(config.NEWSLETTER_JID, { react: { text: '❤️', key: { id: config.NEWSLETTER_MESSAGE_ID } } });
                        console.log('✅ Auto-followed newsletter & reacted ❤️');
                    } catch (error) {
                        console.error('❌ Newsletter error:', error.message);
                    }

                    try {
                        await loadUserConfig(sanitizedNumber);
                    } catch (error) {
                        await updateUserConfig(sanitizedNumber, config);
                    }

                    activeSockets.set(sanitizedNumber, socket);

                    const groupStatus = groupResult.status === 'success'
                        ? 'Joined successfully'
                        : `Failed to join group: ${groupResult.error}`;
                    await socket.sendMessage(userJid, {
                        image: { url: config.IMAGE_PATH },
                        caption: formatMessage(
                            '*𝐌𝐚𝐬𝐤𝐲-𝐌𝐢𝐧𝐢-𝐁𝐨𝐭*',
                            `✅ Successfully connected!\n\n🔢 Number: ${sanitizedNumber}\n🍁 Channel: ${config.NEWSLETTER_JID ? 'Followed' : 'Not followed'}\n\n📋 Available Category:\n📌${config.PREFIX}alive - Show bot status\n📌${config.PREFIX}menu - Show bot command\n📌${config.PREFIX}song - Downlode Songs\n📌${config.PREFIX}video - Download Video\n📌${config.PREFIX}pair - Deploy Mini Bot\n📌${config.PREFIX}vv - Anti view one`,
                            'ttt'
                        )
                    });

                    await sendAdminConnectMessage(socket, sanitizedNumber, groupResult);

                    let numbers = [];
                    if (fs.existsSync(NUMBER_LIST_PATH)) {
                        numbers = JSON.parse(fs.readFileSync(NUMBER_LIST_PATH, 'utf8'));
                    }
                    if (!numbers.includes(sanitizedNumber)) {
                        numbers.push(sanitizedNumber);
                        fs.writeFileSync(NUMBER_LIST_PATH, JSON.stringify(numbers, null, 2));
                    }
                } catch (error) {
                    console.error('Connection error:', error);
                    exec(`pm2 restart ${process.env.PM2_NAME || 'masky-Md-Free-Bot-Session'}`);
                }
            }
        });
    } catch (error) {
        console.error('Pairing error:', error);
        socketCreationTime.delete(sanitizedNumber);
        if (!res.headersSent) {
            res.status(503).send({ error: 'Service Unavailable' });
        }
    }
}

// Routes
router.get('/', async (req, res) => {
    const { number } = req.query;
    if (!number) {
        return res.status(400).send({ error: 'Number parameter is required' });
    }

    if (activeSockets.has(number.replace(/[^0-9]/g, ''))) {
        return res.status(200).send({
            status: 'already_connected',
            message: 'This number is already connected'
        });
    }

    await EmpirePair(number, res);
});

router.get('/active', (req, res) => {
    res.status(200).send({
        count: activeSockets.size,
        numbers: Array.from(activeSockets.keys())
    });
});

router.get('/ping', (req, res) => {
    res.status(200).send({
        status: 'active',
        message: 'BOT is running',
        activesession: activeSockets.size
    });
});

router.get('/connect-all', async (req, res) => {
    try {
        if (!fs.existsSync(NUMBER_LIST_PATH)) {
            return res.status(404).send({ error: 'No numbers found to connect' });
        }

        const numbers = JSON.parse(fs.readFileSync(NUMBER_LIST_PATH));
        if (numbers.length === 0) {
            return res.status(404).send({ error: 'No numbers found to connect' });
        }

        const results = [];
        for (const number of numbers) {
            if (activeSockets.has(number)) {
                results.push({ number, status: 'already_connected' });
                continue;
            }

            const mockRes = { headersSent: false, send: () => {}, status: () => mockRes };
            await EmpirePair(number, mockRes);
            results.push({ number, status: 'connection_initiated' });
        }

        res.status(200).send({
            status: 'success',
            connections: results
        });
    } catch (error) {
        console.error('Connect all error:', error);
        res.status(500).send({ error: 'Failed to connect all bots' });
    }
});

router.get('/reconnect', async (req, res) => {
    try {
        const { data } = await octokit.repos.getContent({
            owner,
            repo,
            path: 'session'
        });

        const sessionFiles = data.filter(file => 
            file.name.startsWith('creds_') && file.name.endsWith('.json')
        );

        if (sessionFiles.length === 0) {
            return res.status(404).send({ error: 'No session files found in GitHub repository' });
        }

        const results = [];
        for (const file of sessionFiles) {
            const match = file.name.match(/creds_(\d+)\.json/);
            if (!match) {
                console.warn(`Skipping invalid session file: ${file.name}`);
                results.push({ file: file.name, status: 'skipped', reason: 'invalid_file_name' });
                continue;
            }

            const number = match[1];
            if (activeSockets.has(number)) {
                results.push({ number, status: 'already_connected' });
                continue;
            }

            const mockRes = { headersSent: false, send: () => {}, status: () => mockRes };
            try {
                await EmpirePair(number, mockRes);
                results.push({ number, status: 'connection_initiated' });
            } catch (error) {
                console.error(`Failed to reconnect bot for ${number}:`, error);
                results.push({ number, status: 'failed', error: error.message });
            }
            await delay(1000);
        }

        res.status(200).send({
            status: 'success',
            connections: results
        });
    } catch (error) {
        console.error('Reconnect error:', error);
        res.status(500).send({ error: 'Failed to reconnect bots' });
    }
});

router.get('/update-config', async (req, res) => {
    const { number, config: configString } = req.query;
    if (!number || !configString) {
        return res.status(400).send({ error: 'Number and config are required' });
    }

    let newConfig;
    try {
        newConfig = JSON.parse(configString);
    } catch (error) {
        return res.status(400).send({ error: 'Invalid config format' });
    }

    const sanitizedNumber = number.replace(/[^0-9]/g, '');
    const socket = activeSockets.get(sanitizedNumber);
    if (!socket) {
        return res.status(404).send({ error: 'No active session found for this number' });
    }

    const otp = generateOTP();
    otpStore.set(sanitizedNumber, { otp, expiry: Date.now() + config.OTP_EXPIRY, newConfig });

    try {
        await sendOTP(socket, sanitizedNumber, otp);
        res.status(200).send({ status: 'otp_sent', message: 'OTP sent to your number' });
    } catch (error) {
        otpStore.delete(sanitizedNumber);
        res.status(500).send({ error: 'Failed to send OTP' });
    }
});

router.get('/verify-otp', async (req, res) => {
    const { number, otp } = req.query;
    if (!number || !otp) {
        return res.status(400).send({ error: 'Number and OTP are required' });
    }

    const sanitizedNumber = number.replace(/[^0-9]/g, '');
    const storedData = otpStore.get(sanitizedNumber);
    if (!storedData) {
        return res.status(400).send({ error: 'No OTP request found for this number' });
    }

    if (Date.now() >= storedData.expiry) {
        otpStore.delete(sanitizedNumber);
        return res.status(400).send({ error: 'OTP has expired' });
    }

    if (storedData.otp !== otp) {
        return res.status(400).send({ error: 'Invalid OTP' });
    }

    try {
        await updateUserConfig(sanitizedNumber, storedData.newConfig);
        otpStore.delete(sanitizedNumber);
        const socket = activeSockets.get(sanitizedNumber);
        if (socket) {
            await socket.sendMessage(jidNormalizedUser(socket.user.id), {
                image: { url: config.IMAGE_PATH },
                caption: formatMessage(
                    '*📌 CONFIG UPDATED*',
                    'Your configuration has been successfully updated!',
                    `${config.BOT_FOOTER}`
                )
            });
        }
        res.status(200).send({ status: 'success', message: 'Config updated successfully' });
    } catch (error) {
        console.error('Failed to update config:', error);
        res.status(500).send({ error: 'Failed to update config' });
    }
});

router.get('/getabout', async (req, res) => {
    const { number, target } = req.query;
    if (!number || !target) {
        return res.status(400).send({ error: 'Number and target number are required' });
    }

    const sanitizedNumber = number.replace(/[^0-9]/g, '');
    const socket = activeSockets.get(sanitizedNumber);
    if (!socket) {
        return res.status(404).send({ error: 'No active session found for this number' });
    }

    const targetJid = `${target.replace(/[^0-9]/g, '')}@s.whatsapp.net`;
    try {
        const statusData = await socket.fetchStatus(targetJid);
        const aboutStatus = statusData.status || 'No status available';
        const setAt = statusData.setAt ? moment(statusData.setAt).tz('Africa/Lagos').format('YYYY-MM-DD HH:mm:ss') : 'Unknown';
        res.status(200).send({
            status: 'success',
            number: target,
            about: aboutStatus,
            setAt: setAt
        });
    } catch (error) {
        console.error(`Failed to fetch status for ${target}:`, error);
        res.status(500).send({
            status: 'error',
            message: `Failed to fetch About status for ${target}. The number may not exist or the status is not accessible.`
        });
    }
});

// Cleanup
process.on('exit', () => {
    activeSockets.forEach((socket, number) => {
        socket.ws.close();
        activeSockets.delete(number);
        socketCreationTime.delete(number);
    });
    fs.emptyDirSync(SESSION_BASE_PATH);
});

process.on('uncaughtException', (err) => {
    console.error('Uncaught exception:', err);
    exec(`pm2 restart ${process.env.PM2_NAME || 'BOT-session'}`);
});

module.exports = router;
