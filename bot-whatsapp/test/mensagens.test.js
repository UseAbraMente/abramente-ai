const assert = require("node:assert/strict");
const {
    ETAPAS,
    processarMensagens,
    configurarGeradorRespostaIaParaTeste,
    limparEstadoMensagensParaTeste
} = require("../src/mensagens");
const { GATILHO_ATENDIMENTO } = require("../src/config");
const { FALLBACK_IA } = require("../src/ia");
const {
    LIMITE_HISTORICO,
    TEMPO_EXPIRACAO_ETAPA_MS,
    adicionarMensagem,
    obterHistorico,
    limparHistorico,
    obterHistoricoParaIa,
    definirEtapa,
    obterEtapa,
    verificarExpiracao,
    limparEtapa
} = require("../src/contexto");

function criarMensagem(texto, jid = "5511999999999@s.whatsapp.net", id = `id-${Date.now()}-${Math.random()}`) {
    return {
        key: {
            id,
            remoteJid: jid,
            fromMe: false
        },
        message: {
            conversation: texto
        }
    };
}

function resetarEstado() {
    limparHistorico();
    limparEtapa();
    limparEstadoMensagensParaTeste();
}

async function executarEvento(messages, geradorIa) {
    const enviados = [];
    const logs = [];
    const logOriginal = console.log;
    let chamadasIa = 0;

    if (geradorIa) {
        configurarGeradorRespostaIaParaTeste(async (params) => {
            chamadasIa += 1;
            return geradorIa(params);
        });
    } else {
        configurarGeradorRespostaIaParaTeste(async () => {
            chamadasIa += 1;
            return "Resposta da IA para o cliente.";
        });
    }

    console.log = (mensagem) => logs.push(String(mensagem));

    try {
        await processarMensagens({
            sendMessage: async (destino, msg) => enviados.push({ jid: destino, msg })
        }, {
            type: "notify",
            messages
        });
    } finally {
        console.log = logOriginal;
    }

    return { enviados, logs, chamadasIa };
}

async function executarCaso(texto, jid = "5511999999999@s.whatsapp.net", geradorIa) {
    return executarEvento([criarMensagem(texto, jid)], geradorIa);
}

async function iniciarFluxo(jid = "5511999999999@s.whatsapp.net") {
    return executarCaso(`${GATILHO_ATENDIMENTO} Olá, vim pelo site da AbraMente`, jid);
}

function testarHistoricoVazio() {
    resetarEstado();

    assert.deepEqual(obterHistorico("5511000000000@s.whatsapp.net"), []);
    assert.deepEqual(obterHistoricoParaIa("5511000000000@s.whatsapp.net"), []);
}

function testarAdicionarMensagemCliente() {
    const jid = "5511000000001@s.whatsapp.net";
    resetarEstado();

    adicionarMensagem(jid, "cliente", "oi", new Date("2026-07-14T12:00:00.000Z"));

    assert.deepEqual(obterHistorico(jid), [{
        papel: "cliente",
        texto: "oi",
        dataHora: "2026-07-14T12:00:00.000Z"
    }]);
}

function testarAdicionarRespostaAgente() {
    const jid = "5511000000002@s.whatsapp.net";
    resetarEstado();

    adicionarMensagem(jid, "cliente", "oi", new Date("2026-07-14T12:00:00.000Z"));
    adicionarMensagem(jid, "agente", "Ola!", new Date("2026-07-14T12:01:00.000Z"));

    assert.equal(obterHistorico(jid).length, 2);
    assert.equal(obterHistorico(jid)[1].papel, "agente");
    assert.equal(obterHistorico(jid)[1].texto, "Ola!");
}

function testarRecuperarHistoricoParaIa() {
    const jid = "5511000000003@s.whatsapp.net";
    resetarEstado();

    adicionarMensagem(jid, "cliente", "mensagem do cliente");
    adicionarMensagem(jid, "agente", "resposta do agente");

    assert.deepEqual(obterHistoricoParaIa(jid), [
        { role: "user", content: "mensagem do cliente" },
        { role: "assistant", content: "resposta do agente" }
    ]);
}

function testarLimiteDezMensagens() {
    const jid = "5511000000004@s.whatsapp.net";
    resetarEstado();

    for (let i = 1; i <= 12; i += 1) {
        adicionarMensagem(jid, "cliente", `mensagem ${i}`);
    }

    const historico = obterHistorico(jid);
    assert.equal(historico.length, LIMITE_HISTORICO);
    assert.equal(historico[0].texto, "mensagem 3");
    assert.equal(historico[9].texto, "mensagem 12");
}

function testarLimparHistorico() {
    const jid = "5511000000005@s.whatsapp.net";
    resetarEstado();

    adicionarMensagem(jid, "cliente", "oi");
    limparHistorico(jid);

    assert.deepEqual(obterHistorico(jid), []);
}

function testarConversasSeparadasPorRemoteJid() {
    const contatoA = "5511000000006@s.whatsapp.net";
    const contatoB = "5511000000007@s.whatsapp.net";
    resetarEstado();

    adicionarMensagem(contatoA, "cliente", "mensagem A");
    adicionarMensagem(contatoB, "cliente", "mensagem B");

    assert.equal(obterHistorico(contatoA)[0].texto, "mensagem A");
    assert.equal(obterHistorico(contatoB)[0].texto, "mensagem B");
}

function testarEtapaExpiraAposTrintaMinutos() {
    const jid = "5511000000010@s.whatsapp.net";
    const inicio = new Date("2026-07-14T12:00:00.000Z");
    resetarEstado();

    definirEtapa(jid, ETAPAS.AGUARDANDO_NECESSIDADE, inicio);

    assert.equal(obterEtapa(jid, new Date(inicio.getTime() + TEMPO_EXPIRACAO_ETAPA_MS)), ETAPAS.AGUARDANDO_NECESSIDADE);
    assert.equal(verificarExpiracao(jid, new Date(inicio.getTime() + TEMPO_EXPIRACAO_ETAPA_MS + 1)), true);
    assert.equal(obterEtapa(jid), null);
}

async function testarMensagemSemGatilho() {
    resetarEstado();
    const jid = "5511999999999@s.whatsapp.net";
    const { enviados, logs, chamadasIa } = await executarCaso("oi", jid);

    assert.equal(enviados.length, 0);
    assert.equal(chamadasIa, 0);
    assert.deepEqual(obterHistorico(jid), []);
    assert.ok(logs.some((linha) => linha.includes("motivo=sem gatilho")));
}

async function testarGatilhoGeraBoasVindasFixa() {
    resetarEstado();
    const jid = "5511999999999@s.whatsapp.net";
    const { enviados, logs, chamadasIa } = await iniciarFluxo(jid);

    assert.equal(chamadasIa, 0);
    assert.equal(enviados.length, 1);
    assert.match(enviados[0].msg.text, /Você gostaria de automatizar alguma parte do seu negócio/i);
    assert.equal(obterEtapa(jid), ETAPAS.AGUARDANDO_NECESSIDADE);
    assert.ok(logs.some((linha) => linha.includes(`[fluxo] etapa=${ETAPAS.AGUARDANDO_NECESSIDADE}`)));
    assert.ok(logs.some((linha) => linha.includes("[fluxo] resposta_fixa")));
}

async function testarPodeNaoChamaIa() {
    resetarEstado();
    const jid = "5511999999999@s.whatsapp.net";
    await iniciarFluxo(jid);
    const { enviados, chamadasIa } = await executarCaso("pode", jid);

    assert.equal(chamadasIa, 0);
    assert.equal(enviados.length, 1);
    assert.match(enviados[0].msg.text, /Qual parte do seu negócio mais toma seu tempo hoje/i);
    assert.equal(obterEtapa(jid), ETAPAS.AGUARDANDO_DETALHES);
}

async function testarQueroNaoChamaIa() {
    resetarEstado();
    const jid = "5511999999998@s.whatsapp.net";
    await iniciarFluxo(jid);
    const { enviados, chamadasIa } = await executarCaso("quero", jid);

    assert.equal(chamadasIa, 0);
    assert.equal(enviados.length, 1);
    assert.match(enviados[0].msg.text, /orçamentos, agendamentos ou tarefas repetitivas/i);
}

async function testarWhatsAppRespondeFixo() {
    resetarEstado();
    const jid = "5511999999997@s.whatsapp.net";
    await iniciarFluxo(jid);
    const { enviados, chamadasIa } = await executarCaso("WhatsApp", jid);

    assert.equal(chamadasIa, 0);
    assert.match(enviados[0].msg.text, /agente para responder clientes/i);
}

async function testarSiteRespondeFixo() {
    resetarEstado();
    const jid = "5511999999996@s.whatsapp.net";
    await iniciarFluxo(jid);
    const { enviados, chamadasIa } = await executarCaso("site", jid);

    assert.equal(chamadasIa, 0);
    assert.match(enviados[0].msg.text, /criar ou melhorar seu site/i);
}

async function testarAgendamentoRespondeFixo() {
    resetarEstado();
    const jid = "5511999999995@s.whatsapp.net";
    await iniciarFluxo(jid);
    const { enviados, chamadasIa } = await executarCaso("agendamento", jid);

    assert.equal(chamadasIa, 0);
    assert.match(enviados[0].msg.text, /automatizar confirmações/i);
}

async function testarOrcamentoRespondeFixo() {
    resetarEstado();
    const jid = "5511999999994@s.whatsapp.net";
    await iniciarFluxo(jid);
    const { enviados, chamadasIa } = await executarCaso("orçamento", jid);

    assert.equal(chamadasIa, 0);
    assert.match(enviados[0].msg.text, /preparar o atendimento para orçamento/i);
}

async function testarProblemaDetalhadoChamaIa() {
    resetarEstado();
    const jid = "5511999999993@s.whatsapp.net";
    await iniciarFluxo(jid);
    const { enviados, logs, chamadasIa } = await executarCaso(
        "Minha equipe perde muito tempo organizando pedidos e repassando tudo manualmente para os vendedores",
        jid,
        async () => "Entendi. Podemos mapear esse fluxo e sugerir uma automação simples."
    );

    assert.equal(chamadasIa, 1);
    assert.equal(enviados.length, 1);
    assert.match(enviados[0].msg.text, /mapear esse fluxo/i);
    assert.ok(logs.some((linha) => linha.includes("[ia] chamada")));
}

async function testarContatosMantemEtapasSeparadas() {
    resetarEstado();
    const contatoA = "5511888888801@s.whatsapp.net";
    const contatoB = "5511888888802@s.whatsapp.net";

    await iniciarFluxo(contatoA);
    await iniciarFluxo(contatoB);
    await executarCaso("pode", contatoA);

    assert.equal(obterEtapa(contatoA), ETAPAS.AGUARDANDO_DETALHES);
    assert.equal(obterEtapa(contatoB), ETAPAS.AGUARDANDO_NECESSIDADE);
}

async function testarRespostaIaSalvaNoContexto() {
    resetarEstado();
    const jid = "5511888888888@s.whatsapp.net";
    await iniciarFluxo(jid);

    await executarCaso("Minha operação trava quando preciso priorizar pedidos urgentes", jid, async () => "Podemos entender esse processo e indicar uma automação inicial.");

    const historico = obterHistorico(jid);
    assert.equal(historico[historico.length - 1].papel, "agente");
    assert.match(historico[historico.length - 1].texto, /automação inicial/i);
}

async function testarFalhaIaUsaFallback() {
    resetarEstado();
    const jid = "5511777777777@s.whatsapp.net";
    await iniciarFluxo(jid);

    const { enviados, logs, chamadasIa } = await executarCaso("Minha operação trava quando a demanda aumenta", jid, async () => {
        throw new Error("Ollama indisponivel");
    });

    assert.equal(chamadasIa, 1);
    assert.equal(enviados.length, 1);
    assert.equal(enviados[0].msg.text, FALLBACK_IA);
    assert.equal(obterHistorico(jid)[obterHistorico(jid).length - 1].texto, FALLBACK_IA);
    assert.ok(logs.some((linha) => linha.includes("[ia] fallback")));
}

async function testarMensagensSimultaneasMesmoContatoNaoDuplicamIa() {
    resetarEstado();

    const jid = "5511666666666@s.whatsapp.net";
    await iniciarFluxo(jid);

    const enviados = [];
    let liberarIa;
    let chamadasIa = 0;

    configurarGeradorRespostaIaParaTeste(async () => {
        chamadasIa += 1;
        await new Promise((resolve) => {
            liberarIa = resolve;
        });
        return "Resposta unica da IA.";
    });

    const sock = {
        sendMessage: async (destino, msg) => enviados.push({ jid: destino, msg })
    };

    const eventoA = { messages: [criarMensagem("Minha equipe perde tempo organizando pedidos manualmente", jid, "dup-a")] };
    const eventoB = { messages: [criarMensagem("Minha equipe se perde quando a demanda aumenta e precisa priorizar pedidos", jid, "dup-b")] };

    const p1 = processarMensagens(sock, eventoA);
    const p2 = processarMensagens(sock, eventoB);

    await new Promise((resolve) => setTimeout(resolve, 10));
    assert.equal(chamadasIa, 1);

    liberarIa();
    await Promise.all([p1, p2]);

    assert.equal(chamadasIa, 1);
    assert.equal(enviados.length, 1);
    assert.equal(enviados[0].msg.text, "Resposta unica da IA.");
}

async function executarTestes() {
    testarHistoricoVazio();
    testarAdicionarMensagemCliente();
    testarAdicionarRespostaAgente();
    testarRecuperarHistoricoParaIa();
    testarLimiteDezMensagens();
    testarLimparHistorico();
    testarConversasSeparadasPorRemoteJid();
    testarEtapaExpiraAposTrintaMinutos();

    await testarMensagemSemGatilho();
    await testarGatilhoGeraBoasVindasFixa();
    await testarPodeNaoChamaIa();
    await testarQueroNaoChamaIa();
    await testarWhatsAppRespondeFixo();
    await testarSiteRespondeFixo();
    await testarAgendamentoRespondeFixo();
    await testarOrcamentoRespondeFixo();
    await testarProblemaDetalhadoChamaIa();
    await testarContatosMantemEtapasSeparadas();
    await testarRespostaIaSalvaNoContexto();
    await testarFalhaIaUsaFallback();
    await testarMensagensSimultaneasMesmoContatoNaoDuplicamIa();

    resetarEstado();
    console.log("Testes do agente WhatsApp passaram.");
}

executarTestes().catch((erro) => {
    console.error(erro);
    process.exit(1);
});

