const CLASSIFICACOES = {
    SAUDACAO: "saudacao",
    FORA_DE_CONTEXTO: "fora_de_contexto",
    PERGUNTA_BASICA: "pergunta_basica",
    INTERESSE_COMERCIAL: "interesse_comercial",
    HUMANO: "humano",
    DESCONHECIDO: "desconhecido"
};

function normalizarTexto(texto) {
    return (texto || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
}

function contemAlgum(texto, termos) {
    return termos.some((termo) => texto.includes(termo));
}

function classificarMensagem(texto) {
    const textoNormalizado = normalizarTexto(texto);

    if (!textoNormalizado) {
        return CLASSIFICACOES.DESCONHECIDO;
    }

    if (contemAlgum(textoNormalizado, ["humano", "atendente", "pessoa", "responsavel", "falar com alguem", "consultor"])) {
        return CLASSIFICACOES.HUMANO;
    }

    if (contemAlgum(textoNormalizado, ["futebol", "politica", "receita", "novela", "previsao do tempo", "clima", "jogo do", "filme"])) {
        return CLASSIFICACOES.FORA_DE_CONTEXTO;
    }

    if (/^(oi|ola|olá|bom dia|boa tarde|boa noite|e ai|eae|hello|hey)\b/.test(textoNormalizado)) {
        return CLASSIFICACOES.SAUDACAO;
    }

    if (contemAlgum(textoNormalizado, ["horario", "horarios", "abre", "fecha", "funcionamento", "cidade", "endereco", "onde fica", "instagram", "telefone", "whatsapp", "contato", "servico", "servicos", "fazem", "voces fazem"])) {
        return CLASSIFICACOES.PERGUNTA_BASICA;
    }

    if (contemAlgum(textoNormalizado, ["preco", "valor", "orcamento", "proposta", "contratar", "contrato", "comprar", "quero automatizar", "tenho interesse", "comercial", "vendas"])) {
        return CLASSIFICACOES.INTERESSE_COMERCIAL;
    }

    return CLASSIFICACOES.DESCONHECIDO;
}

module.exports = {
    CLASSIFICACOES,
    classificarMensagem,
    normalizarTexto
};
