import os
import json
from flask import Flask, Response, request, render_template, jsonify
from utils.groq_client import call_groq_model
from utils.chat_api import chats_blueprint

app = Flask(__name__)

app.register_blueprint(chats_blueprint)

CHAT_MEMORY_FILE = "./chat_memory.json"
CHAT_FOLDER = "db"

# Ensure the folder for storing chat histories exists
if not os.path.exists(CHAT_FOLDER):
    os.makedirs(CHAT_FOLDER)


def load_chat_memory():
    try:
        with open(CHAT_MEMORY_FILE, "r") as file:
            content = file.read().strip()
            if not content:  # If the file is empty, return an empty list
                return []
            return json.loads(content)  # Load the JSON content
    except FileNotFoundError:
        return []  # Return an empty list if the file doesn't exist
    except json.JSONDecodeError:
        # If the file is corrupted, reset it and return an empty list
        save_chat_memory([])  # Reset the file
        return []

def save_chat_memory(memory):
    with open(CHAT_MEMORY_FILE, "w") as file:
        json.dump(memory, file, indent=4)

@app.route("/")
def index():
    """
    Render the HTML page.
    """
    return render_template("index.html")

@app.route("/generate", methods=["POST"])
def generate():
    data = request.get_json()  # Parse JSON body from the request
    prompt = data.get("prompt", "")
    file_name = data.get("file_name", None)  # Name of the selected chat file

    if not prompt:
        return Response("Error: No prompt provided", content_type="text/plain"), 400

    if not file_name:
        return Response("Error: No chat selected", content_type="text/plain"), 400

    # Load existing chat memory for the selected file
    file_path = os.path.join(CHAT_FOLDER, file_name)
    if not os.path.exists(file_path):
        return jsonify({"error": "Chat file not found"}), 404

    with open(file_path, "r") as f:
        chat_data = json.load(f)
        chat_memory = chat_data.get("history", [])

    # Add user input to chat memory
    chat_memory.append({"role": "user", "content": prompt})

    # Function to stream the response and save it in memory
    def stream_response_and_save():
        assistant_response = ""
        try:
            for chunk in call_groq_model(chat_memory):
                if chunk is not None:
                    yield chunk
                    assistant_response += chunk  # Collect the assistant's response
            # Save the assistant's response to chat memory
            chat_memory.append({"role": "assistant", "content": assistant_response})

            # Update the file with the new chat history
            chat_data["history"] = chat_memory
            with open(file_path, "w") as f:
                json.dump(chat_data, f, indent=4)

            yield "[END]\n"  # Signal the end of the stream
        except Exception as e:
            yield f"Error: {str(e)}\n"

    # Return the response as a streaming response
    return Response(stream_response_and_save(), content_type="text/plain", status=200)

if __name__ == "__main__":
    app.run(debug=True)


if __name__ == "__main__":
    app.run(debug=True)
