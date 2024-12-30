document.getElementById("button").addEventListener("click", async (e) => {
    e.preventDefault();

    const prompt = document.getElementById("prompt").value.trim();
    const chatContainer = document.getElementById("chat-container");

    if (!prompt || !selectedChatFile) {
        alert("Please select a chat and enter a message.");
        return;
    }

    // Add user message to the chat
    const userMessage = document.createElement("div");
    userMessage.className = "message user-message";
    userMessage.textContent = prompt;
    chatContainer.appendChild(userMessage);

    // Clear input
    document.getElementById("prompt").value = "";

    try {
        const response = await fetch("/generate", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                prompt: prompt,
                file_name: selectedChatFile,
            }),
        });

        if (!response.ok) {
            throw new Error("Failed to fetch response from server");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let markdownContent = "";
        let assistantMessage = document.createElement("div");
        assistantMessage.className = "message assistant-message";
        chatContainer.appendChild(assistantMessage);

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            // Decode the chunk and append Markdown content
            markdownContent += decoder.decode(value, { stream: true });

            // Convert Markdown to HTML and update the assistant's message
            assistantMessage.innerHTML = marked.parse(markdownContent);
            chatContainer.scrollTop = chatContainer.scrollHeight; // Auto-scroll to the bottom
        }
        currentChatHistory.push({ role: "assistant", content: markdownContent.trim() });

    } catch (error) {
        const errorMessage = document.createElement("div");
        errorMessage.className = "message assistant-message";
        errorMessage.textContent = `Error: ${error.message}`;
        chatContainer.appendChild(errorMessage);
        chatContainer.scrollTop = chatContainer.scrollHeight; // Auto-scroll to the bottom
    }
});

document.getElementById("theme-toggle").addEventListener("click", () => {
    const body = document.body;

    // Toggle the "dark-theme" class on the body
    body.classList.toggle("dark-theme");

    // Update the button icon/text
    const themeToggle = document.getElementById("theme-toggle");
    if (body.classList.contains("dark-theme")) {
        themeToggle.textContent = "☀️"; // Light mode icon
    } else {
        themeToggle.textContent = "🌙"; // Dark mode icon
    }
});

const textarea = document.querySelector('textarea');
const baseHeight = 40; // Initial height
const lineHeight = 24; // Height to increase per line
const maxLines = 5; // Maximum number of lines before scrolling
let currentLines = 1; // Track current number of lines

textarea.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
        if (!e.shiftKey) {
            e.preventDefault();
            // Trigger send function here
            return;
        }
        
        // Count current number of newlines
        const newlines = (this.value.match(/\n/g) || []).length;
        
        if (newlines < maxLines - 1) {
            // Increase height by one line
            currentLines = newlines + 2; // +2 because we're about to add a line
            this.style.height = `${baseHeight + (lineHeight * (currentLines - 1))}px`;
        } else {
            // Enable scrolling after max lines
            this.style.height = `${baseHeight + (lineHeight * (maxLines - 1))}px`;
            this.style.overflowY = 'auto';
        }
    } else if (e.key === 'Backspace') {
        // Check if we're at a newline
        const cursorPosition = this.selectionStart;
        const textBeforeCursor = this.value.substring(0, cursorPosition);
        
        if (textBeforeCursor.endsWith('\n')) {
            const newlines = (this.value.match(/\n/g) || []).length;
            if (newlines < maxLines - 1) {
                // Decrease height by one line
                currentLines = newlines;
                this.style.height = `${baseHeight + (lineHeight * (currentLines - 1))}px`;
            }
        }
    }
});

// Handle paste events
textarea.addEventListener('paste', (e) => {
    setTimeout(() => {
        const newlines = (textarea.value.match(/\n/g) || []).length;
        if (newlines < maxLines) {
            currentLines = newlines + 1;
            textarea.style.height = `${baseHeight + (lineHeight * (currentLines - 1))}px`;
        } else {
            textarea.style.height = `${baseHeight + (lineHeight * (maxLines - 1))}px`;
            textarea.style.overflowY = 'auto';
        }
    }, 0);
});

// ####################################################### LOADING CHATS ######################################################

let selectedChatFile = null; // To track the selected chat file
let currentChatHistory = []; // In-memory chat history for the selected chat

// Utility to set a cookie
function setCookie(name, value, days) {
    const date = new Date();
    date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
    document.cookie = `${name}=${value}; expires=${date.toUTCString()}; path=/`;
}

// Utility to get a cookie
function getCookie(name) {
    const cookies = document.cookie.split("; ");
    for (const cookie of cookies) {
        const [key, value] = cookie.split("=");
        if (key === name) {
            return value;
        }
    }
    return null;
}


// Fetch and display all chats in the left panel
async function loadChatList() {
    try {
        const response = await fetch("/chats");
        if (!response.ok) throw new Error("Failed to fetch chat list");

        const chats = await response.json();
        const chatListElement = document.getElementById("chat-list");
        chatListElement.innerHTML = ""; // Clear existing chats

        // Populate the chat list
        chats.forEach(chat => {
            const chatItem = document.createElement("li");
            chatItem.classList.add("chat-item"); // Add a class for styling

            // Chat name
            const chatName = document.createElement("span");
            chatName.textContent = chat.name;
            chatName.classList.add("chat-name");
            chatName.addEventListener("click", () => loadChat(chat.file)); // Load chat on click
            chatItem.appendChild(chatName);

            // Delete button
            const deleteButton = document.createElement("button");
            deleteButton.className = "delete-button";
            deleteButton.textContent = "🗑️"; // Dustbin icon
            deleteButton.addEventListener("click", (e) => {
                e.stopPropagation(); // Prevent triggering chat load
                deleteChat(chat.file);
            });
            chatItem.appendChild(deleteButton);

            chatListElement.appendChild(chatItem);
        });
    } catch (error) {
        console.error("Error loading chat list:", error);
    }
}

// Load a specific chat and display its history
async function loadChat(fileName) {
    try {
        selectedChatFile = fileName; // Update the selected chat file
        setCookie("selectedChatFile", fileName, 7); // Save the chat file name in a cookie for 7 days
        const response = await fetch(`/chats/${fileName}`);
        if (!response.ok) throw new Error("Failed to load chat");

        const chatData = await response.json();
        currentChatHistory = chatData.history; // Load chat history into memory
        displayChatHistory(); // Update the UI with the chat history
    } catch (error) {
        console.error("Error loading chat:", error);
    }
}
// Display the current chat history in the chat container
function displayChatHistory() {
    const chatContainer = document.getElementById("chat-container");
    chatContainer.innerHTML = ""; // Clear existing messages

    currentChatHistory.forEach(message => {
        const messageDiv = document.createElement("div");
        messageDiv.className = `message ${message.role === "user" ? "user-message" : "assistant-message"}`;
        messageDiv.textContent = message.content;
        chatContainer.appendChild(messageDiv);
    });

    chatContainer.scrollTop = chatContainer.scrollHeight; // Scroll to the latest message
}

document.addEventListener('DOMContentLoaded', () => {
    const leftPanel = document.querySelector('.left-panel');
    
    // Create and append the drag handle
    const handle = document.createElement('div');
    handle.className = 'panel-handle';
    leftPanel.appendChild(handle);

    let isDragging = false;
    let startX;
    let startWidth;

    handle.addEventListener('mousedown', (e) => {
        isDragging = true;
        startX = e.clientX;
        startWidth = leftPanel.offsetWidth;
        
        // Add dragging class
        leftPanel.classList.add('dragging');
        document.body.style.cursor = 'col-resize';
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;

        // Calculate new width
        const difference = e.clientX - startX;
        const newWidth = startWidth + difference;
        
        // Convert to percentage of parent container
        const parentWidth = leftPanel.parentElement.offsetWidth;
        const widthPercentage = (newWidth / parentWidth) * 100;

        // Apply constraints (between 10% and 50% of parent width)
        if (widthPercentage >= 10 && widthPercentage <= 50) {
            leftPanel.style.width = `${widthPercentage}%`;
        }
    });

    document.addEventListener('mouseup', () => {
        if (!isDragging) return;
        
        isDragging = false;
        leftPanel.classList.remove('dragging');
        document.body.style.cursor = '';
    });

    // Prevent drag handle from interfering with text selection
    handle.addEventListener('selectstart', (e) => {
        e.preventDefault();
    });
});

document.getElementById("add-chat-button").addEventListener("click", async () => {
    const chatName = prompt("Enter the name for the new chat:");
    if (!chatName) {
        alert("Chat name cannot be empty!");
        return;
    }

    try {
        const response = await fetch("/create_chat", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ name: chatName }),
        });

        if (!response.ok) {
            throw new Error("Failed to create a new chat");
        }
        loadChatList(); // Refresh the chat list
    } catch (error) {
        console.error("Error creating new chat:", error);
        alert("Failed to create a new chat");
    }
});

async function deleteChat(fileName) {
    if (!confirm("Are you sure you want to delete this chat?")) return;

    try {
        const response = await fetch(`/chats/${fileName}`, { method: "DELETE" });
        if (!response.ok) throw new Error("Failed to delete chat");
        loadChatList(); // Reload the chat list
    } catch (error) {
        console.error("Error deleting chat:", error);
        alert("Failed to delete chat");
    }
}

// Load the chat list when the page loads
document.addEventListener("DOMContentLoaded", loadChatList);
