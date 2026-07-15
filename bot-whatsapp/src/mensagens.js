const { GATILHO_ATENDIMENTO } = require("./config");
const { CLASSIFICACOES, classificarMensagem, normalizarTexto } = require("./filtro");
const { responderPerguntaBasica } = require("./conhecimento");
const {
    adicionarMensagem,
    obterHistorico,
    obterHistoricoParaIa,
    definirEtapa,
    obterEtapa,
    atualizarUltimaInteracao
} = require("./contexto");
const { FALLBACK_IA, gerarRespostaIa, TAMANHO_MAXIMO_MENSAGEM } = require("./ia");

const ETAPAS = {
    AGUARDANDO_NECESSIDADE: "aguardando_necessidade",
    AGUARDANDO_DETALHES: "aguardando_detalhes"
};

const RESPOSTA_ENTRADA_SITE = "Olá! Sou o agente de atendimento da AbraMente. Você gostaria de automatizar alguma parte do seu negócio? Posso te ajudar com atendimento no WhatsApp, sites, tarefas repetitivas, agendamentos ou outras soluções com IA.";
const RESPOSTA_INTERESSE_CURTO = "Claro! Qual parte do seu negócio mais toma seu tempo hoje: atendimento, mensagens, orçamentos, agendamentos ou tarefas repetitivas?";
const RESPOSTA_WHATSAPP = "Entendi. Podemos criar um agente para responder clientes, filtrar dúvidas e encaminhar oportunidades. Hoje você recebe muitas mensagens por dia?";
const RESPOSTA_SITE = "Podemos criar ou melhorar seu site e integrar atendimento inteligente. Você já possui um site hoje?";
const RESPOSTA_AGENDAMENTO = "Podemos automatizar confirmações, disponibilidade e agendamentos. Hoje esse processo é feito manualmente?";
const RESPOSTA_ORCAMENTO = "Podemos automatizar a coleta de informações e preparar o atendimento para orçamento. Como você faz seus orçamentos hoje?";
const RESPOSTA_TAREFAS = "Podemos identificar tarefas repetitivas e automatizar parte desse fluxo. Qual tarefa mais se repete no seu dia a dia?";
const RESPOSTA_SAUDACAO = "Ola! Sou o agente de atendimento da AbraMente. Posso ajudar com informacoes sobre horarios, cidade, Instagram, telefone e servicos.";
const RESPOSTA_FORA_DE_CONTEXTO = "Posso ajudar apenas com assuntos relacionados as solucoes da AbraMente. Se quiser, me envie uma duvida sobre nossos servicos ou automacoes com IA.";
const RESPOSTA_HUMANO = "Certo. Um especialista da AbraMente vai continuar o atendimento com voce.";
const RESPOSTA_PERGUNTA_NAO_ENCONTRADA = "Ainda nao encontrei essa informacao na base de conhecimento. Um especialista da AbraMente pode continuar o atendimento.";
const RESPOSTAS_CURTAS_INTERESSE = new Set(["sim", "pode", "quero", "gostaria", "tenho interesse", "adoraria", "me ajuda"]);
const idsProcessados = new Set();
const chamadasIaEmAndamento = new Set();
let geradorRespostaIa = gerarRespostaIa;

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

function limitarMensagemParaIa(texto) {
    const textoLimpo = String(texto || "").trim();

    if (textoLimpo.length <= TAMANHO_MAXIMO_MENSAGEM) {
        return textoLimpo;
    }

    return textoLimpo.slice(0, TAMANHO_MAXIMO_MENSAGEM).trim();
}

function removerGatilho(texto) {
    return texto.replace(GATILHO_ATENDIMENTO, "").trim();
}

function obterIdMensagem(message) {
    return message.key?.id || null;
}

function obterMotivoIgnorar(message, texto) {
    const remoteJid = message.key?.remoteJid || "";
    const conteudo = obterConteudoMensagem(message);
    const idMensagem = obterIdMensagem(message);

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

    if (idMensagem && idsProcessados.has(idMensagem)) {
        return "evento duplicado";
    }

    return null;
}

function registrarIdProcessado(message) {
    const idMensagem = obterIdMensagem(message);

    if (!idMensagem) {
        return;
    }

    idsProcessados.add(idMensagem);

    if (idsProcessados.size > 500) {
        const primeiroId = idsProcessados.values().next().value;
        idsProcessados.delete(primeiroId);
    }
}

function criarRespostaPorClassificacao(classificacao, textoSemGatilho) {
    if (classificacao === CLASSIFICACOES.SAUDACAO) {
        return RESPOSTA_SAUDACAO;
    }

    if (classificacao === CLASSIFICACOES.PERGUNTA_BASICA) {
        return responderPerguntaBasica(textoSemGatilho) || RESPOSTA_PERGUNTA_NAO_ENCONTRADA;
    }

    if (classificacao === CLASSIFICACOES.FORA_DE_CONTEXTO) {
        return RESPOSTA_FORA_DE_CONTEXTO;
    }

    if (classificacao === CLASSIFICACOES.HUMANO) {
        return RESPOSTA_HUMANO;
    }

    return null;
}

function deveChamarIaFuturamente(classificacao) {
    return classificacao === CLASSIFICACOES.INTERESSE_COMERCIAL || classificacao === CLASSIFICACOES.DESCONHECIDO;
}

function quantidadeContexto(remoteJid) {
    return obterHistorico(remoteJid).length;
}

function contemAlgum(textoNormalizado, termos) {
    return termos.some((termo) => textoNormalizado.includes(termo));
}

function criarRespostaFluxoFixo(etapaAtual, texto) {
    const textoNormalizado = normalizarTexto(texto);

    if (etapaAtual === ETAPAS.AGUARDANDO_NECESSIDADE && RESPOSTAS_CURTAS_INTERESSE.has(textoNormalizado)) {
        return {
            resposta: RESPOSTA_INTERESSE_CURTO,
            proximaEtapa: ETAPAS.AGUARDANDO_DETALHES
        };
    }

    if (contemAlgum(textoNormalizado, ["whatsapp", "atendimento", "mensagens", "mensagem"])) {
        return {
            resposta: RESPOSTA_WHATSAPP,
            proximaEtapa: ETAPAS.AGUARDANDO_DETALHES
        };
    }

    if (contemAlgum(textoNormalizado, ["site", "pagina", "landing page"])) {
        return {
            resposta: RESPOSTA_SITE,
            proximaEtapa: ETAPAS.AGUARDANDO_DETALHES
        };
    }

    if (contemAlgum(textoNormalizado, ["agendamento", "agenda", "horario", "consulta", "reserva"])) {
        return {
            resposta: RESPOSTA_AGENDAMENTO,
            proximaEtapa: ETAPAS.AGUARDANDO_DETALHES
        };
    }

    if (contemAlgum(textoNormalizado, ["orcamento", "proposta", "preco"])) {
        return {
            resposta: RESPOSTA_ORCAMENTO,
            proximaEtapa: ETAPAS.AGUARDANDO_DETALHES
        };
    }

    if (contemAlgum(textoNormalizado, ["tarefas repetitivas", "tarefa repetitiva", "planilha", "cadastro", "processos", "processo"])) {
        return {
            resposta: RESPOSTA_TAREFAS,
            proximaEtapa: ETAPAS.AGUARDANDO_DETALHES
        };
    }

    return null;
}

async function enviarResposta(sock, remoteJid, resposta, classificacao = "fluxo") {
    await sock.sendMessage(remoteJid, {
        text: resposta
    });

    adicionarMensagem(remoteJid, "agente", resposta);
    console.log(`[resposta] resposta enviada para=${remoteJid} categoria=${classificacao} contexto=${quantidadeContexto(remoteJid)}`);
}

async function responderComIa(sock, remoteJid, textoParaClassificar) {
    if (chamadasIaEmAndamento.has(remoteJid)) {
        console.log(`[ia] chamada ignorada contato=${remoteJid} motivo=em_andamento contexto=${quantidadeContexto(remoteJid)}`);
        return;
    }

    chamadasIaEmAndamento.add(remoteJid);
    console.log(`[ia] chamada contato=${remoteJid} contexto=${quantidadeContexto(remoteJid)}`);

    try {
        const historicoCompleto = obterHistoricoParaIa(remoteJid);
        const historicoParaIa = historicoCompleto.slice(0, -1).slice(-10);
        const resposta = await geradorRespostaIa({
            mensagemAtual: limitarMensagemParaIa(textoParaClassificar),
            historico: historicoParaIa
        });

        await sock.sendMessage(remoteJid, {
            text: resposta
        });

        adicionarMensagem(remoteJid, "agente", resposta);
        console.log(`[ia] respondida contato=${remoteJid} contexto=${quantidadeContexto(remoteJid)}`);
    } catch (erro) {
        await sock.sendMessage(remoteJid, {
            text: FALLBACK_IA
        });

        adicionarMensagem(remoteJid, "agente", FALLBACK_IA);
        console.log(`[ia] fallback contato=${remoteJid} erro=${erro.message} contexto=${quantidadeContexto(remoteJid)}`);
    } finally {
        chamadasIaEmAndamento.delete(remoteJid);
    }
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
            console.log(`[entrada] ignorada de=${remoteJid} tipo=${tipo} motivo=${motivoIgnorar}`);
            continue;
        }

        const temGatilho = texto.includes(GATILHO_ATENDIMENTO);
        const etapaAtual = obterEtapa(remoteJid);

        if (!temGatilho && !etapaAtual) {
            console.log(`[entrada] ignorada de=${remoteJid} tipo=${tipo} motivo=sem gatilho`);
            continue;
        }

        registrarIdProcessado(message);

        if (temGatilho) {
            console.log(`[entrada] gatilho detectado de=${remoteJid} tipo=${tipo}`);
        }

        const textoSemGatilho = temGatilho ? removerGatilho(texto) : texto;
        const textoParaClassificar = textoSemGatilho || "oi";

        adicionarMensagem(remoteJid, "cliente", textoParaClassificar);
        console.log(`[contexto] contato=${remoteJid} mensagens=${quantidadeContexto(remoteJid)}`);

        if (temGatilho) {
            definirEtapa(remoteJid, ETAPAS.AGUARDANDO_NECESSIDADE);
            console.log(`[fluxo] etapa=${ETAPAS.AGUARDANDO_NECESSIDADE}`);
            console.log("[fluxo] resposta_fixa");
            await enviarResposta(sock, remoteJid, RESPOSTA_ENTRADA_SITE, "entrada_site");
            continue;
        }

        atualizarUltimaInteracao(remoteJid);

        const respostaFluxo = criarRespostaFluxoFixo(etapaAtual, textoParaClassificar);

        if (respostaFluxo) {
            definirEtapa(remoteJid, respostaFluxo.proximaEtapa);
            console.log("[fluxo] resposta_fixa");
            console.log(`[fluxo] etapa=${respostaFluxo.proximaEtapa}`);
            await enviarResposta(sock, remoteJid, respostaFluxo.resposta, "fluxo_fixo");
            continue;
        }

        const classificacao = classificarMensagem(textoParaClassificar);

        console.log(`[filtro] categoria identificada=${classificacao}`);

        if (deveChamarIaFuturamente(classificacao)) {
            await responderComIa(sock, remoteJid, textoParaClassificar);
            continue;
        }

        const resposta = criarRespostaPorClassificacao(classificacao, textoParaClassificar);

        if (!resposta) {
            await responderComIa(sock, remoteJid, textoParaClassificar);
            continue;
        }

        await enviarResposta(sock, remoteJid, resposta, classificacao);
    }
}

function configurarGeradorRespostaIaParaTeste(fn) {
    geradorRespostaIa = fn || gerarRespostaIa;
}

function limparEstadoMensagensParaTeste() {
    idsProcessados.clear();
    chamadasIaEmAndamento.clear();
    geradorRespostaIa = gerarRespostaIa;
}

module.exports = {
    ETAPAS,
    processarMensagens,
    extrairTexto,
    removerGatilho,
    criarRespostaPorClassificacao,
    deveChamarIaFuturamente,
    configurarGeradorRespostaIaParaTeste,
    limparEstadoMensagensParaTeste
};
