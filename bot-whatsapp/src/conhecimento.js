const fs = require("fs");
const path = require("path");

const CAMINHO_CONHECIMENTO = path.join(__dirname, "..", "conhecimento");
const ARQUIVOS_CONHECIMENTO = [
    ["empresa", "empresa.json"],
    ["faq", "faq.json"],
    ["servicos", "servicos.json"],
    ["vendas", "vendas.json"]
];

function carregarJson(nomeArquivo) {
    const caminho = path.join(CAMINHO_CONHECIMENTO, nomeArquivo);

    if (!fs.existsSync(caminho)) {
        throw new Error(`Arquivo de conhecimento nao encontrado: ${nomeArquivo}`);
    }

    const conteudo = fs.readFileSync(caminho, "utf8");
    return JSON.parse(conteudo);
}

function carregarConhecimento() {
    return ARQUIVOS_CONHECIMENTO.reduce((base, [chave, arquivo]) => {
        base[chave] = carregarJson(arquivo);
        return base;
    }, {});
}

function normalizarTexto(texto) {
    return (texto || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
}

function encontrarRespostaFaq(perguntaNormalizada, perguntasFrequentes) {
    const termosIgnorados = new Set(["atendimento", "empresa", "qual", "quais", "sobre", "para", "como", "voce", "voces"]);
    const faqEncontrado = perguntasFrequentes.find((item) => {
        const perguntaFaq = normalizarTexto(item.pergunta);
        const palavras = perguntaFaq
            .split(/\s+/)
            .filter((palavra) => palavra.length > 3 && !termosIgnorados.has(palavra));

        return palavras.length > 0 && palavras.some((palavra) => perguntaNormalizada.includes(palavra));
    });

    return faqEncontrado?.resposta || null;
}

function responderPerguntaBasica(texto) {
    const { empresa, faq, servicos } = carregarConhecimento();
    const pergunta = normalizarTexto(texto);

    if (pergunta.includes("horario") || pergunta.includes("funcionamento") || pergunta.includes("abre") || pergunta.includes("fecha")) {
        return `Nosso horario de atendimento e ${empresa.horario}.`;
    }

    if (pergunta.includes("cidade") || pergunta.includes("endereco") || pergunta.includes("onde fica")) {
        return `Atendemos a partir de ${empresa.cidade}.`;
    }

    if (pergunta.includes("instagram")) {
        return `Nosso Instagram e ${empresa.instagram}.`;
    }

    if (pergunta.includes("telefone") || pergunta.includes("whatsapp") || pergunta.includes("contato")) {
        return `Nosso telefone/WhatsApp e ${empresa.telefone}.`;
    }

    if (pergunta.includes("servico") || pergunta.includes("servicos") || pergunta.includes("fazem")) {
        const nomesServicos = (servicos?.servicos || empresa.servicos || []).map((servico) => servico.nome || servico);
        return `Nossos principais servicos sao: ${nomesServicos.join(", ")}.`;
    }

    return encontrarRespostaFaq(pergunta, faq?.faq || []);
}

module.exports = {
    carregarConhecimento,
    responderPerguntaBasica,
    ARQUIVOS_CONHECIMENTO
};
