# Gemini_chat
Chat Interface with Gemini and Pyodide:
This project is a web-based chat interface that leverages Google's Gemini API for generating responses and uses Pyodide to execute Python code directly in the browser. The backend is built with Python using the Quart framework, while the frontend is a mix of HTML, CSS, and JavaScript.

Features:
Real-time Chat: Send messages and receive streamed responses from the Gemini model.

Persistent Chat History: The application maintains a session-based chat history, allowing you to view and manage past conversations.

New Chat Functionality: Easily start a new conversation and clear the history.

Code Block Execution: The bot can generate code blocks, which can be executed directly in the browser using Pyodide (currently supports Python).

Dynamic UI: The interface includes a responsive sidebar for navigation and a dynamic input area that resizes automatically.

Copy & Regenerate: Copy bot messages to the clipboard or regenerate the last response with a single click.

Error Handling: Displays user-friendly error messages for API failures or other issues.

Caching: Caches recent responses to avoid redundant API calls.

Technologies Used
Backend:

Python: The core language for the backend server.

Quart: An asynchronous web microframework.

Flask-Caching: A caching extension for Flask and Quart applications.

python-dotenv: Manages environment variables from a .env file.

google-generativeai: The official Python SDK for Google's Gemini API.

Hypercorn: An ASGI web server for running the Quart application.

Frontend:

HTML5: Structures the web page.

CSS3: Styles the user interface, including responsive design for mobile devices.

JavaScript: Handles client-side logic, including DOM manipulation, event listeners, and communication with the backend.

Pyodide: A port of Python to WebAssembly, enabling Python code execution in the browser.

Font Awesome: Provides icons for the user interface.

How to Run
Clone the repository:

Bash

git clone <repository_url>
cd <project_directory>
Set up the environment:

Create a virtual environment (recommended):

Bash

python -m venv venv
source venv/bin/activate   # On Windows: venv\Scripts\activate
Install the required Python packages:

Bash

pip install -r requirements.txt
Configure the API Key:

Obtain a Gemini API key from Google AI Studio.

Create a file named .env in the project's root directory.

Add your API key to the file in the following format:

api_key="YOUR_API_KEY_HERE"
Run the application:

Start the server from the command line:

Bash

python app.py
The server will be running at http://127.0.0.1:5000. Open this URL in your web browser to access the chat interface.
