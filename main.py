import ollama

def gerar_conteudo(tema):

    prompt = f"""
Crie um post para Instagram sobre: {tema}

Retorne exatamente neste formato:

TITULO:
...

TEXTO:
...

CTA:
...

HASHTAGS:
...

IMAGEM:
(descrição visual da cena)
"""

    resposta = ollama.chat(
        model='qwen3:8b',
        messages=[
            {
                'role': 'user',
                'content': prompt
            }
        ]
    )

    return resposta['message']['content']


def salvar_post(conteudo):

    with open("post_gerado.txt", "w", encoding="utf-8") as arquivo:
        arquivo.write(conteudo)


def main():

    tema = input("\nDigite o tema do post: ")

    conteudo = gerar_conteudo(tema)

    print("\n=== RESULTADO ===\n")
    print(conteudo)

    salvar_post(conteudo)

    print("\nArquivo salvo com sucesso!")


if __name__ == "__main__":
    main()