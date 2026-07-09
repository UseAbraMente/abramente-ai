const { GATILHO_ATENDIMENTO, RESPOSTA_ATENDIMENTO_SITE } = require("./config");

function obterConteudoMensagem(message) {
    let conteudo = message.message;

    if (conteudo?.ephemeralMessage?.message) {
        conteudo = conteudo.ephemeralMessage.message;
    }

    if (conteudo?.viewOnceMessage?.message) {
        conteudo = conteudo.viewOnceMessage.message;
    }

    return conteudo;
}

function obterTipoMensagem(message) {
    const conteudo = obterConteudoMensagem(message);
    return conteudo ? Object.keys(conteudo)[0] || "desconhecido" : "sem_conteudo";
}

function extrairTexto(message) {
    const conteudo = obterConteudoMensagem(message);

    if (!conteudo) {
        return "";
    }

    return (
        conteudo.conversation ||
        conteudo.extendedTextMessage?.text ||
        conteudo.imageMessage?.caption ||
        conteudo.videoMessage?.caption ||
        ""
    ).trim();
}

function obterMotivoIgnorar(message, texto) {
    const remoteJid = message.key?.remoteJid || "";
    const conteudo = obterConteudoMensagem(message);

    if (message.key?.fromMe) {
        return "mensagem propria";
    }

    if (remoteJid === "status@broadcast") {
        return "status";
    }

    if (remoteJid.endsWith("@g.us")) {
        return "grupo";
    }

    if (!remoteJid) {
        return "remetente ausente";
    }

    if (conteudo?.protocolMessage) {
        return "protocolMessage";
    }

    if (!texto) {
        return "sem texto";
    }

    if (!texto.includes(GATILHO_ATENDIMENTO)) {
        return "sem gatilho";
    }

    return null;
}

async function processarMensagens(sock, evento) {
    const mensagens = evento.messages || [];

    console.log(`[messages.upsert] notify total=${mensagens.length}`);

    for (const message of mensagens) {
        const remoteJid = message.key?.remoteJid || "desconhecido";
        const tipo = obterTipoMensagem(message);
        const texto = extrairTexto(message);
        const motivoIgnorar = obterMotivoIgnorar(message, texto);

        if (motivoIgnorar) {
            console.log(`[msg] ignorada de=${remoteJid} tipo=${tipo} motivo=${motivoIgnorar}`);
            continue;
        }

        await sock.sendMessage(remoteJid, {
            text: RESPOSTA_ATENDIMENTO_SITE
        });

        console.log(`[msg] respondida para=${remoteJid} tipo=${tipo}`);
    }
}

module.exports = {
    processarMensagens
};
