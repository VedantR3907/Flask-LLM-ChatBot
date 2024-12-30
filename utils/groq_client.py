import os
from dotenv import load_dotenv
from groq import Groq

# Load environment variables from the .env file
load_dotenv()

# Get the API key from the environment
API_KEY = os.getenv("GROQ_API_KEY")

if not API_KEY:
    raise ValueError("GROQ_API_KEY is missing in .env file")

def call_groq_model(messages, model="llama3-8b-8192", temperature=0.5, max_tokens=1024, top_p=1, stop=None):
    client = Groq(api_key=API_KEY)

    try:
        # Call the Groq API with the entire chat memory
        stream = client.chat.completions.create(
            messages=messages,
            model=model,
            temperature=temperature,
            max_tokens=max_tokens,
            top_p=top_p,
            stop=stop,
            stream=True,
        )

        for chunk in stream:
            yield chunk.choices[0].delta.content

    except Exception as e:
        yield f"Error: {str(e)}"
