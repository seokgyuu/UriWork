from openai import OpenAI

client = OpenAI(
  api_key="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"
)

try:
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "user", "content": "write a haiku about ai"}
        ]
    )
    
    print("✅ API 테스트 성공!")
    print("응답:", response.choices[0].message.content)
    
except Exception as e:
    print("❌ API 테스트 실패:", e)