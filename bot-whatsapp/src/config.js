require("dotenv").config({ quiet: true });

const GATILHO_ATENDIMENTO = "ABRAMENTE_SITE_ATENDIMENTO";
const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "qwen3:8b";
const OLLAMA_TIMEOUT_MS = Number(process.env.OLLAMA_TIMEOUT_MS || 60000);

const RESPOSTA_ATENDIMENTO_SITE =
    "Ol\u00e1! Seja bem-vindo \u00e0 AbraMente. Vi que voc\u00ea veio pelo nosso site. Sou o agente de atendimento e vou te ajudar a entender como a IA pode automatizar o atendimento da sua empresa.";

module.exports = {
    GATILHO_ATENDIMENTO,
    RESPOSTA_ATENDIMENTO_SITE,
    OLLAMA_URL,
    OLLAMA_MODEL,
    OLLAMA_TIMEOUT_MS
};
