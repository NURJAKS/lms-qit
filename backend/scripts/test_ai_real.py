import os
import sys
from pathlib import Path

# Setup path to find app
_backend_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_backend_root))

from app.core.config import settings
from app.services.ai_service import chat_with_openai, get_challenge_recommendations

def test_ai_functions():
    print(f"--- Testing AI Functions ---")
    print(f"OpenAI Key set: {bool(settings.OPENAI_API_KEY)}")
    print(f"Gemini Key set: {bool(settings.GEMINI_API_KEY)}")
    
    if not settings.OPENAI_API_KEY and not settings.GEMINI_API_KEY:
        print("ERROR: No API keys found in .env. AI functions will use fallback/demo mode.")
        return

    # 1. Test AI Chat (chat_with_openai)
    print("\n1. Testing AI Chat (chat_with_openai)...")
    test_message = "Привет! Расскажи в двух словах, что такое переменная в Python?"
    response, is_suspicious = chat_with_openai(test_message)
    print(f"Request: {test_message}")
    print(f"Is Suspicious: {is_suspicious}")
    print(f"Response: {response[:100]}...")
    
    if "AI қызметі қосылмаған" in response or "Демо режим" in response:
        print("RESULT: ❌ AI Chat is using FALLBACK/DEMO mode.")
    else:
        print("RESULT: ✅ AI Chat seems to be WORKING with real API.")

    # 2. Test Recommendations (get_challenge_recommendations)
    print("\n2. Testing Recommendations (get_challenge_recommendations)...")
    wrong_topics = ["Циклдар", "Айнымалылар"]
    course = "Python программалау негіздері"
    rec_response = get_challenge_recommendations(wrong_topics, course, lang="ru")
    print(f"Wrong topics: {wrong_topics}")
    print(f"Response: {rec_response[:100]}...")
    
    # Check if it's the fallback from translations.ts
    # recommendations_fallback: 'Рекомендуем повторить темы: {topics}.'
    if rec_response.startswith("Рекомендуем повторить темы") or "AI қызметі қосылмаған" in rec_response:
         print("RESULT: ❌ Recommendations are using FALLBACK mode.")
    else:
         print("RESULT: ✅ Recommendations seem to be WORKING with real API.")

if __name__ == "__main__":
    test_ai_functions()
