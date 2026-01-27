import asyncio
import os
import httpx
from dotenv import load_dotenv

# Load .env file
load_dotenv()

async def test_groq():
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        print("Error: GROQ_API_KEY not found in environment variables.")
        return

    print(f"GROQ_API_KEY found: {api_key[:5]}...{api_key[-4:]}")

    url = "https://api.groq.com/openai/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    
    # Simple prompt
    payload = {
        "model": os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile"),
        "messages": [
            {"role": "user", "content": "Hello! Are you working? Please reply with 'Yes, I am working!'"}
        ],
        "max_tokens": 50
    }

    print(f"Testing connection to {url}...")
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(url, json=payload, headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                content = data["choices"][0]["message"]["content"]
                print("\nSUCCESS! Groq API responded:")
                print("-" * 50)
                print(content)
                print("-" * 50)
            else:
                print(f"\nFAILED with status code: {response.status_code}")
                print(response.text)
                
    except httpx.ConnectError as e:
        print(f"\nConnection Error: {e}")
        print("This might be due to a firewall or network issue in the corporate network.")
    except Exception as e:
        print(f"\nAn error occurred: {e}")

if __name__ == "__main__":
    asyncio.run(test_groq())
