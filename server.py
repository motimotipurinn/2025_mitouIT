# server.py
from flask import Flask, request, jsonify
import openai
import os
# OpenAI APIキーを設定（環境変数や他の安全な方法で管理することを推奨）
openai.api_key = os.getenv("OPENAI_API_KEY")
app = Flask(__name__)


@app.route("/classify", methods=["POST"])
def classify():
    data = request.get_json()
    tweet_text = data.get("text", "")
    # GPT-4に与えるプロンプトの準備
    messages = [
        {
            "role": "system",
            "content": (
                "あなたはツイート内容を評価するアシスタントです。"
                "与えられたツイートの言葉遣いの乱暴さ、誹謗中傷の有無、スパムの可能性、"
                "論理の破綻や不当な主張が含まれていないかを総合的に判断し、"
                "そのツイートの「カス度」を0から100の数値で評価してください。"
                "0は全く問題のない内容、100は非常に悪質な内容を表します。"
                "回答は評価数値のみを出力してください。"
            ),
        },
        {"role": "user", "content": tweet_text},
    ]
    # OpenAIのChatGPT API (GPT-4) を呼び出し
    response = openai.ChatCompletion.create(
        model="gpt-4",
        messages=messages,
        temperature=0,  # 再現性を高めるため温度は0（決定的な応答）
    )
    # 応答から数値を抽出
    result_text = response["choices"][0]["message"]["content"].strip()
    try:
        score = int(result_text)
    except ValueError:
        # 数値以外が返った場合の簡単な対処（必要に応じて調整）
        score = None
    # JSON形式で結果を返す
    return jsonify({"rating": score})


if __name__ == "__main__":
    # ローカルホストの5000番ポートでサーバーを起動
    app.run(host="0.0.0.0", port=5000, debug=True)
