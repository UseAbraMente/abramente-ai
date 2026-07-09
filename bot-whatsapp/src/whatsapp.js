const qrcode = require("qrcode-terminal");
const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason
} = require("@whiskeysockets/baileys");
const P = require("pino");

const { processarMensagens } = require("./mensagens");

async function iniciarWhatsapp() {
    const { state, saveCreds } = await useMultiFileAuthState("./auth");

    const sock = makeWASocket({
        auth: state,
        logger: P({ level: "silent" }),
        printQRInTerminal: false
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("messages.upsert", async (evento) => {
        try {
            if (evento.type !== "notify") {
                console.log(`[messages.upsert] ignorado tipo=${evento.type || "desconhecido"}`);
                return;
            }

            await processarMensagens(sock, evento);
        } catch (error) {
            console.error("Erro ao processar mensagem:", error);
        }
    });

    sock.ev.on("connection.update", async ({ connection, lastDisconnect, qr }) => {
        const statusCode = lastDisconnect?.error?.output?.statusCode || "nenhum";
        const erro = lastDisconnect?.error?.message || "nenhum";

        console.log(`[baileys.connection.update] connection=${connection || "indefinida"} qr=${qr ? "recebido" : "nao"} statusCode=${statusCode} erro="${erro}"`);

        if (qr) {
            console.log("Escaneie o QR Code abaixo:\n");

            qrcode.generate(qr, {
                small: true
            });
        }

        if (connection === "open") {
            console.log("[baileys.connection.open] WhatsApp conectado com sucesso.");
        }

        if (connection === "close") {
            const shouldReconnect =
                lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;

            console.log(`[baileys.connection.close] shouldReconnect=${shouldReconnect}`);

            if (shouldReconnect) {
                console.log("[baileys.connection.reconnect] Reconectando...");
                iniciarWhatsapp();
            } else {
                console.log("[baileys.connection.logged_out] Sessao encerrada. Sera necessario escanear novamente.");
            }
        }
    });
}

module.exports = {
    iniciarWhatsapp
};
