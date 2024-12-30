import os
import json
import time
from flask import Blueprint, request, jsonify

# Blueprint for the chats API
chats_blueprint = Blueprint("chats", __name__)

current_dir = os.path.dirname(__file__)
CHAT_FOLDER = os.path.join(current_dir, "..", "db")
CHAT_FOLDER = os.path.abspath(CHAT_FOLDER)


# Ensure the folder for storing chat histories exists
if not os.path.exists(CHAT_FOLDER):
    os.makedirs(CHAT_FOLDER)


# Save a new chat history
@chats_blueprint.route("/create_chat", methods=["POST"])
def save_chat():
    data = request.get_json()
    name = data.get("name", "Untitled Chat")
    history = data.get("history", [])

    # Create a unique file name
    file_name = f"chat_{int(time.time())}.json"
    file_path = os.path.join(CHAT_FOLDER, file_name)

    # Save chat to a JSON file
    chat_data = {
        "name": name,
        "history": history,
        "created_at": time.strftime("%Y-%m-%d %H:%M:%S")
    }
    with open(file_path, "w") as f:
        json.dump(chat_data, f, indent=4)

    return jsonify({"message": "Chat saved successfully", "file": file_name}), 201


# List all saved chats
@chats_blueprint.route("/chats", methods=["GET"])
def get_chats():
    chat_files = [f for f in os.listdir(CHAT_FOLDER) if f.endswith(".json")]
    chats = []

    for file in chat_files:
        file_path = os.path.join(CHAT_FOLDER, file)
        with open(file_path, "r") as f:
            chat_data = json.load(f)
            chats.append({
                "file": file,
                "name": chat_data.get("name", "Untitled Chat"),
                "created_at": chat_data.get("created_at", "")
            })

    # Sort by creation time (newest first)
    chats.sort(key=lambda x: x["created_at"], reverse=True)

    return jsonify(chats)


# Retrieve a specific chat
@chats_blueprint.route("/chats/<string:file_name>", methods=["GET"])
def get_chat(file_name):
    file_path = os.path.join(CHAT_FOLDER, file_name)

    if not os.path.exists(file_path):
        return jsonify({"error": "Chat not found"}), 404

    with open(file_path, "r") as f:
        chat_data = json.load(f)

    return jsonify(chat_data)


# Delete a specific chat
@chats_blueprint.route("/chats/<string:file_name>", methods=["DELETE"])
def delete_chat(file_name):
    file_path = os.path.join(CHAT_FOLDER, file_name)

    if not os.path.exists(file_path):
        return jsonify({"error": "Chat not found"}), 404

    os.remove(file_path)
    return jsonify({"message": "Chat deleted successfully"}), 200
