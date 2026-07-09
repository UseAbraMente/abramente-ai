const qrcode = require("qrcode-terminal");

const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason
} = require("@whiskeysockets/baileys");

const P = require("pino");

async function iniciarBot() {

    const { state, saveCreds } = await useMultiFileAuthState("./auth");

    const sock = makeWASocket({
        auth: state,
        logger: P({ level: "silent" }),
        printQRInTerminal: false
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", async ({ connection, lastDisconnect, qr }) => {

        if (qr) {
            console.clear();
            console.log("📱 Escaneie o QR Code abaixo:\n");

            qrcode.generate(qr, {
                small: true
            });
        }

        if (connection === "open") {
            console.clear();
            console.log("✅ WhatsApp conectado com sucesso!");
        }

        if (connection === "close") {

            const shouldReconnect =
                lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;

            console.log("❌ Conexão encerrada.");

            if (shouldReconnect) {
                console.log("🔄 Reconectando...");
                iniciarBot();
            } else {
                console.log("🚪 Sessão encerrada. Será necessário escanear novamente.");
            }
        }

    });

}

iniciarBot();