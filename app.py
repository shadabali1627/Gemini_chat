from quart import Quart, render_template, request, jsonify
from flask_caching import Cache
from dotenv import load_dotenv
import os
import asyncio
import google.generativeai as genai
from hypercorn.config import Config
import hypercorn.asyncio
import base64
import re

# Load environment variables from .env file
load_dotenv()

# App Initialization
app = Quart(__name__)
cache = Cache(config={"CACHE_TYPE": "SimpleCache", "CACHE_DEFAULT_TIMEOUT": 3600})
cache.init_app(app)

# Global Variables
chat_history = []
GEMINI_API_KEY = os.getenv("api_key")

# Configuration Check
if not GEMINI_API_KEY:
    print("⚠️ ERROR: API key not set in environment!")
    exit(1)

# Initialize Gemini Model
genai.configure(api_key=GEMINI_API_KEY)
try:
    model = genai.GenerativeModel("gemini-2.0-flash")
except Exception as e:
    print(f"⚠️ ERROR: Failed to initialize model - {str(e)}")
    exit(1)

# Routes
@app.route("/")
async def index():
    return await render_template("index.html")

@app.route("/generate", methods=["POST"])
async def generate_text():
    try:
        data = await request.json
        prompt = data.get("prompt", "").strip()
        image_data = data.get("image", None)

        if not prompt and not image_data:
            return jsonify({"error": "Prompt or image is required"}), 400

        cache_key = f"{prompt}{image_data if image_data else ''}"
        cached_response = cache.get(cache_key)
        if cached_response is not None:
            print("✅ Serving cached response")
            return jsonify({"response": cached_response})

        print("➡️ Prompt received:", prompt)

        if image_data:
            try:
                if not image_data.startswith("data:image"):
                    return jsonify({"error": "Invalid image format"}), 400
                image_bytes = base64.b64decode(image_data.split(",")[1])
                response = await asyncio.to_thread(get_gemini_response_with_image, prompt, image_bytes)
            except Exception as e:
                return jsonify({"error": f"Image processing error: {str(e)}"}), 400
        else:
            response = await asyncio.to_thread(get_gemini_response, prompt)

        if "error" in response:
            return jsonify(response), 500

        chat_entry = {"user": prompt, "bot": response["response"]}
        chat_history.append(chat_entry)
        cache.set(cache_key, response["response"])
        print("✅ Gemini Response:", response["response"])
        return jsonify(response)

    except Exception as e:
        print(f"⚠️ ERROR in /generate: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500

@app.route("/history", methods=["GET"])
async def get_history():
    return jsonify(chat_history)

@app.route("/history", methods=["DELETE"])
async def clear_history():
    try:
        global chat_history
        chat_history = []
        return jsonify({"message": "Chat history cleared successfully"}), 200
    except Exception as e:
        print(f"⚠️ ERROR: {str(e)}")
        return jsonify({"error": "Failed to clear chat history"}), 500

@app.route("/history/<int:index>", methods=["DELETE"])
async def delete_chat(index):
    try:
        global chat_history
        if 0 <= index < len(chat_history):
            chat_history.pop(index)
            return jsonify({"message": f"Chat at index {index} deleted successfully"}), 200
        else:
            return jsonify({"error": "Invalid chat index"}), 400
    except Exception as e:
        print(f"⚠️ ERROR: {str(e)}")
        return jsonify({"error": "Failed to delete chat"}), 500

# Helper Functions
def get_gemini_response(prompt):
    try:
        response = model.generate_content(prompt)
        if hasattr(response, "text"):
            clean_text = format_response(response.text.strip())
            return {"response": clean_text}
        return {"error": "Unexpected API response format"}
    except Exception as e:
        return {"error": str(e)}

def get_gemini_response_with_image(prompt, image_bytes):
    try:
        response = model.generate_content([prompt, image_bytes])
        if hasattr(response, "text"):
            clean_text = format_response(response.text.strip())
            return {"response": clean_text}
        return {"error": "Unexpected API response format"}
    except Exception as e:
        return {"error": str(e)}

def format_response(text):
    text = process_code_blocks(text)
    text = text.replace("\n", "<br>")
    text = re.sub(r'\*\*(.*?)\*\*', r'<strong>\1</strong>', text)
    return text

def process_code_blocks(text):
    # Convert markdown code blocks to <code-block>
    code_block_regex = r'```(\w*)\n(.*?)```'
    def replace_code_block(match):
        language = match.group(1) or "text"
        code = match.group(2).replace('\n', '<br>')
        return f'<code-block data-code-language="{language}">{code}</code-block>'
    return re.sub(code_block_regex, replace_code_block, text, flags=re.DOTALL)

# Run Server
if __name__ == "__main__":
    config = Config()
    config.bind = ["127.0.0.1:5000"]
    print("🚀 Running on http://127.0.0.1:5000")
    asyncio.run(hypercorn.asyncio.serve(app, config))
