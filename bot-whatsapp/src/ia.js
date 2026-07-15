const { OLLAMA_URL, OLLAMA_MODEL, OLLAMA_TIMEOUT_MS } = require("./config");
const { construirSystemPrompt } = require("./promptBuilder");

const TAMANHO_MAXIMO_MENSAGEM = 2000;
const TAMANHO_MAXIMO_RESPOSTA = 500;
const FALLBACK_IA = "Estou com uma instabilidade no atendimento autom\u00e1tico. Vou encaminhar sua mensagem para um respons\u00e1vel da AbraMente.";

function limitarTexto(texto, limite) {
    const textoLimpo = String(texto || "").trim();

    if (textoLimpo.length <= limite) {
        return textoLimpo;
    }

    return textoLimpo.slice(0, limite).trim();
}

function normalizarParaComparacao(texto) {
    return String(texto || "").replace(/\s+/g, " ").trim();
}

function limparRespostaIa(conteudo) {
    let resposta = String(conteudo || "");

    resposta = resposta.replace(/<think>[\s\S]*?<\/think>/gi, "");
    resposta = resposta.replace(/<thinking>[\s\S]*?<\/thinking>/gi, "");
    resposta = resposta.replace(/```[\s\S]*?```/g, "");
    resposta = resposta.replace(/\b(system|assistant|user)\s*:/gi, "");
    resposta = resposta.replace(/\s+/g, " ").trim();

    return limitarTexto(resposta, TAMANHO_MAXIMO_RESPOSTA);
}

function prepararHistorico(historico, mensagemAtualLimitada) {
    const historicoLimitado = historico.slice(-10).map((item) => ({
        role: item.role,
        content: limitarTexto(item.content, TAMANHO_MAXIMO_MENSAGEM)
    })).filter((item) => ["user", "assistant"].includes(item.role) && item.content);

    const ultimaMensagem = historicoLimitado[historicoLimitado.length - 1];

    if (
        ultimaMensagem?.role === "user" &&
        normalizarParaComparacao(ultimaMensagem.content) === normalizarParaComparacao(mensagemAtualLimitada)
    ) {
        return historicoLimitado.slice(0, -1);
    }

    return historicoLimitado;
}

function montarMensagens({ mensagemAtual, historico = [] }) {
    const mensagemLimitada = limitarTexto(mensagemAtual, TAMANHO_MAXIMO_MENSAGEM);
    const historicoPreparado = prepararHistorico(historico, mensagemLimitada);

    return [
        {
            role: "system",
            content: construirSystemPrompt()
        },
        ...historicoPreparado,
        {
            role: "user",
            content: mensagemLimitada
        }
    ];
}

async function chamarOllama({ mensagemAtual, historico }) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT_MS);

    try {
        const resposta = await fetch(`${OLLAMA_URL.replace(/\/$/, "")}/api/chat`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: OLLAMA_MODEL,
                stream: false,
                think: false,
                messages: montarMensagens({ mensagemAtual, historico }),
                options: {
                    num_predict: 180,
                    temperature: 0.4
                }
            }),
            signal: controller.signal
        });

        if (!resposta.ok) {
            throw new Error(`Ollama retornou HTTP ${resposta.status}`);
        }

        const dados = await resposta.json();
        const conteudo = limparRespostaIa(dados?.message?.content);

        if (!conteudo) {
            throw new Error("Ollama retornou resposta vazia");
        }

        return conteudo;
    } finally {
        clearTimeout(timeout);
    }
}

async function gerarRespostaIa(params) {
    return chamarOllama(params);
}

module.exports = {
    FALLBACK_IA,
    TAMANHO_MAXIMO_MENSAGEM,
    TAMANHO_MAXIMO_RESPOSTA,
    gerarRespostaIa,
    montarMensagens,
    limparRespostaIa
};
