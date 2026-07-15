const assert = require("node:assert/strict");
const { construirSystemPrompt } = require("../src/promptBuilder");
const { montarMensagens } = require("../src/ia");

function testarPromptContemIdentidade() {
    const prompt = construirSystemPrompt();

    assert.match(prompt, /agência de publicidade/i);
    assert.match(prompt, /marketing/i);
    assert.match(prompt, /Inteligência Artificial/i);
    assert.match(prompt, /não é uma clínica psicológica/i);
    assert.match(prompt, /Nunca apresentar a AbraMente como clínica/i);
}

function testarPromptContemBaseDeConhecimento() {
    const prompt = construirSystemPrompt();

    assert.match(prompt, /# IDENTIDADE DA EMPRESA/);
    assert.match(prompt, /# REGRAS DO AGENTE/);
    assert.match(prompt, /# DADOS DA EMPRESA/);
    assert.match(prompt, /# SERVIÇOS/);
    assert.match(prompt, /# PERGUNTAS FREQUENTES/);
    assert.match(prompt, /# REGRAS COMERCIAIS/);
    assert.match(prompt, /# LIMITAÇÕES E SEGURANÇA/);
    assert.match(prompt, /Agente para WhatsApp/);
    assert.match(prompt, /Chat para Sites/);
    assert.match(prompt, /O que .*AbraMente/i);
    assert.match(prompt, /WhatsApp/i);
}

function testarIaUsaPromptBuilder() {
    const prompt = construirSystemPrompt();
    const messages = montarMensagens({
        mensagemAtual: "quero automatizar meu atendimento",
        historico: []
    });

    assert.equal(messages[0].role, "system");
    assert.equal(messages[0].content, prompt);
}

function testarOrdemDasMensagens() {
    const messages = montarMensagens({
        mensagemAtual: "quero um orcamento",
        historico: [
            { role: "user", content: "ola" },
            { role: "assistant", content: "Ola, posso ajudar." }
        ]
    });

    assert.equal(messages[0].role, "system");
    assert.deepEqual(messages.slice(1), [
        { role: "user", content: "ola" },
        { role: "assistant", content: "Ola, posso ajudar." },
        { role: "user", content: "quero um orcamento" }
    ]);
}

function testarMensagemAtualNaoDuplica() {
    const messages = montarMensagens({
        mensagemAtual: "quero um orcamento",
        historico: [
            { role: "user", content: "ola" },
            { role: "assistant", content: "Ola, posso ajudar." },
            { role: "user", content: "quero um orcamento" }
        ]
    });

    const mensagensClienteOrcamento = messages.filter((item) => item.role === "user" && item.content === "quero um orcamento");

    assert.equal(mensagensClienteOrcamento.length, 1);
    assert.equal(messages[messages.length - 1].role, "user");
    assert.equal(messages[messages.length - 1].content, "quero um orcamento");
}

function executarTestes() {
    testarPromptContemIdentidade();
    testarPromptContemBaseDeConhecimento();
    testarIaUsaPromptBuilder();
    testarOrdemDasMensagens();
    testarMensagemAtualNaoDuplica();

    console.log("Testes do promptBuilder passaram.");
}

executarTestes();
