const LIMITE_HISTORICO = 10;
const TEMPO_EXPIRACAO_ETAPA_MS = 30 * 60 * 1000;
const PAPEIS = new Set(["cliente", "agente"]);
const historicosPorContato = new Map();
const etapasPorContato = new Map();

function normalizarDataHora(dataHora = new Date()) {
    const data = dataHora instanceof Date ? dataHora : new Date(dataHora);

    if (Number.isNaN(data.getTime())) {
        return new Date().toISOString();
    }

    return data.toISOString();
}

function obterTimestamp(dataHora = new Date()) {
    const data = dataHora instanceof Date ? dataHora : new Date(dataHora);

    if (Number.isNaN(data.getTime())) {
        return Date.now();
    }

    return data.getTime();
}

function adicionarMensagem(remoteJid, papel, texto, dataHora = new Date()) {
    if (!remoteJid) {
        throw new Error("remoteJid e obrigatorio para registrar contexto");
    }

    if (!PAPEIS.has(papel)) {
        throw new Error(`Papel invalido no contexto: ${papel}`);
    }

    const historico = historicosPorContato.get(remoteJid) || [];

    historico.push({
        papel,
        texto: String(texto || ""),
        dataHora: normalizarDataHora(dataHora)
    });

    historicosPorContato.set(remoteJid, historico.slice(-LIMITE_HISTORICO));
}

function obterHistorico(remoteJid) {
    const historico = historicosPorContato.get(remoteJid) || [];
    return historico.map((item) => ({ ...item }));
}

function limparHistorico(remoteJid) {
    if (remoteJid) {
        historicosPorContato.delete(remoteJid);
        return;
    }

    historicosPorContato.clear();
}

function obterHistoricoParaIa(remoteJid) {
    return obterHistorico(remoteJid).map((item) => ({
        role: item.papel === "cliente" ? "user" : "assistant",
        content: item.texto
    }));
}

function definirEtapa(remoteJid, etapa, dataHora = new Date()) {
    if (!remoteJid) {
        throw new Error("remoteJid e obrigatorio para definir etapa");
    }

    etapasPorContato.set(remoteJid, {
        etapa,
        ultimaInteracao: obterTimestamp(dataHora)
    });
}

function verificarExpiracao(remoteJid, dataHora = new Date()) {
    const estado = etapasPorContato.get(remoteJid);

    if (!estado) {
        return false;
    }

    const expirou = obterTimestamp(dataHora) - estado.ultimaInteracao > TEMPO_EXPIRACAO_ETAPA_MS;

    if (expirou) {
        etapasPorContato.delete(remoteJid);
    }

    return expirou;
}

function obterEtapa(remoteJid, dataHora = new Date()) {
    if (verificarExpiracao(remoteJid, dataHora)) {
        return null;
    }

    return etapasPorContato.get(remoteJid)?.etapa || null;
}

function atualizarUltimaInteracao(remoteJid, dataHora = new Date()) {
    const estado = etapasPorContato.get(remoteJid);

    if (!estado) {
        return;
    }

    etapasPorContato.set(remoteJid, {
        ...estado,
        ultimaInteracao: obterTimestamp(dataHora)
    });
}

function limparEtapa(remoteJid) {
    if (remoteJid) {
        etapasPorContato.delete(remoteJid);
        return;
    }

    etapasPorContato.clear();
}

module.exports = {
    LIMITE_HISTORICO,
    TEMPO_EXPIRACAO_ETAPA_MS,
    adicionarMensagem,
    obterHistorico,
    limparHistorico,
    obterHistoricoParaIa,
    definirEtapa,
    obterEtapa,
    atualizarUltimaInteracao,
    verificarExpiracao,
    limparEtapa
};
