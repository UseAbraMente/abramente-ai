import requests
import base64

def gerar_imagem(prompt):

    url = "http://127.0.0.1:7860/sdapi/v1/txt2img"

    payload = {
        "prompt": prompt,
        "steps": 25,
        "width": 768,
        "height": 768
    }

    response = requests.post(url, json=payload)
    return response.json()["images"][0]