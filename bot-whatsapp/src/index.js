const { iniciarWhatsapp } = require("./whatsapp");

iniciarWhatsapp().catch((error) => {
    console.error("Erro ao iniciar o bot:", error);
    process.exit(1);
});
