import ollama

def gerar_post(tema):

    prompt = f"""
Você é um especialista em marketing digital e criação de conteúdo para Instagram na área de psicologia.

Crie um post para Instagram sobre:

{tema}

CONTEXTO DA MARCA:

A AbraMente é uma marca de roupas que inspira reflexão, autoconhecimento, liberdade emocional e uma vida mais consciente.

A marca não vende terapia.
A marca não vende consultas.
A marca vende roupas que carregam mensagens e valores.

Os conteúdos devem transmitir os valores da marca através de situações do cotidiano.

O objetivo não é ensinar psicologia.
O objetivo é gerar identificação emocional e conexão com a filosofia da marca.

Sempre escreva como uma marca que inspira reflexão através do estilo de vida.

REGRAS:

* Retorne apenas o post final.
* Não escreva explicações.
* Não escreva observações.
* Não escreva títulos de seção.
* Não escreva "TÍTULO", "TEXTO", "CTA" ou "HASHTAGS".
* Não utilize markdown.
* Não utilize negrito.
* Escreva como uma conversa humana.
* Linguagem simples, emocional e natural.
* Evite tom de professor.
* Evite tom de coach.
* Evite frases motivacionais vazias.
* Evite clichês.
* Utilize exemplos do cotidiano.
* Faça a pessoa pensar: "isso aconteceu comigo".
* Gere identificação emocional antes de ensinar.
* Mostre emoções através de situações reais.
* Comece com uma situação concreta do dia a dia.
* Evite explicações psicológicas longas.

CTA:

* Faça a pessoa refletir.
* Faça a pessoa compartilhar uma experiência.
* Não tente vender.
* Não peça para comprar.
* Não use frases de marketing.

ESTRUTURA:

Linha 1:
Título curto com no máximo 8 palavras e 1 emoji.

Linhas 2 a 5:
Texto principal com 20 a 60 palavras no total.

Penúltima linha:
Uma pergunta que incentive a pessoa a compartilhar uma experiência real.

Última linha:
4 hashtags relacionadas ao tema.

IMPORTANTE:

* Nunca escreva nomes de seções.
* Entregue apenas o conteúdo pronto para publicar.
  """

    resposta = ollama.chat(
        model="qwen3:8b",
        messages=[
            {
                "role": "user",
                "content": prompt
            }
        ]
    )

    return resposta["message"]["content"]