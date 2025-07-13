// Global variable to hold Pyodide instance
let pyodide;
// Global variable to hold the streaming interval
let streamingInterval = null;
// Global variable to store the last user message
let lastUserMessage = "";
// Flag to track if the user is actively scrolling
let isUserScrolling = false;
// Variable to store the last scroll position
let lastScrollPosition = 0;
// Flag to track if we're currently updating scroll
let isUpdatingScroll = false;

// Initialize Pyodide with error handling
async function loadPyodideAndInitialize() {
    try {
        pyodide = await loadPyodide({
            indexURL: "https://cdn.jsdelivr.net/pyodide/v0.23.4/full/"
        });
        console.log("Pyodide loaded successfully");
    } catch (error) {
        console.error("Failed to load Pyodide:", error);
        showError("Unable to initialize Python execution environment.");
    }
}

loadPyodideAndInitialize();

// Throttle function to limit the frequency of scroll event handling
function throttle(func, wait) {
    let lastCall = 0;
    return function executedFunction(...args) {
        const now = Date.now();
        if (now - lastCall >= wait) {
            lastCall = now;
            return func(...args);
        }
    };
}

// Helper function to toggle sidebar
function toggleSidebar() {
    const sidebar = document.getElementById("sidebar");
    const mainContent = document.getElementById("main-content");
    const sidebarToggle = document.getElementById("sidebar-toggle");
    const sidebarLogoToggle = document.getElementById("sidebar-logo-toggle");
    
    if (!sidebar || !mainContent || !sidebarToggle || !sidebarLogoToggle) {
        console.error("One or more sidebar elements not found.");
        return;
    }
    
    sidebar.classList.toggle("active");
    mainContent.classList.toggle("sidebar-active");
    
    if (sidebar.classList.contains("active")) {
        sidebarToggle.innerHTML = '<i class="fas fa-times"></i>';
        sidebarLogoToggle.classList.remove("fa-chevron-right");
        sidebarLogoToggle.classList.add("fa-chevron-left");
    } else {
        sidebarToggle.innerHTML = '<i class="fas fa-bars"></i>';
        sidebarLogoToggle.classList.remove("fa-chevron-left");
        sidebarLogoToggle.classList.add("fa-chevron-right");
    }
}

// Initialization
document.addEventListener("DOMContentLoaded", function() {
    const userInput = document.getElementById("user-input");
    const sendBtn = document.getElementById("send-btn");
    const stopBtn = document.getElementById("stop-btn");
    const newChatBtn = document.getElementById("new-chat-btn");
    const chatBox = document.getElementById("chat-box");
    const sidebar = document.getElementById("sidebar");
    const mainContent = document.getElementById("main-content");
    const sidebarToggle = document.getElementById("sidebar-toggle");
    const chatTitle = document.querySelector(".logo");
    const sidebarLogoToggle = document.getElementById("sidebar-logo-toggle");
    
    // Check if elements are found
    if (!sidebarLogoToggle) {
        console.error("Sidebar logo toggle element not found!");
    }

    // Event Listeners
    userInput.addEventListener("keypress", function(event) {
        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            sendMessage();
        }
    });
    
    sendBtn.addEventListener("click", sendMessage);
    
    userInput.addEventListener("input", function() {
        this.style.height = "auto";
        this.style.height = (this.scrollHeight) + "px";
    });

    // Stop Button Functionality
    stopBtn.addEventListener("click", stopStreaming);

    // Sidebar Toggle Functionality
    sidebarToggle.addEventListener("click", toggleSidebar);

    // Chat Title Toggle Functionality
    chatTitle.addEventListener("click", toggleSidebar);

    // Sidebar Logo Toggle Functionality
    if (sidebarLogoToggle) {
        sidebarLogoToggle.addEventListener("click", function(e) {
            e.stopPropagation(); // Prevent the parent .logo click event
            console.log("Sidebar logo toggle clicked");
            toggleSidebar();
        });
    }

    // New Chat Button Functionality
    newChatBtn.addEventListener("click", function() {
        // Clear the chat box
        chatBox.innerHTML = "";

        // Clear the last user message
        lastUserMessage = "";

        // Reset scrolling flag and position
        isUserScrolling = false;
        lastScrollPosition = 0;

        // Request server to clear chat history
        fetch("/history", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" }
        })
        .then(response => {
            if (!response.ok) throw new Error(`Server error: ${response.status}`);
            console.log("New Chat request sent, response status:", response.status);
            return response.json();
        })
        .then(data => {
            console.log("Chat history cleared:", data);
            loadChatHistory(); // Reload history after clearing
            // Toggle sidebar
            toggleSidebar();
        })
        .catch(error => {
            console.error("⚠️ Error clearing chat history:", error);
            showError("Failed to start a new chat: " + error.message);
        });
    });

    // Load chat history on page load
    loadChatHistory();
});

// Load and display chat history
function loadChatHistory() {
    fetch("/history", {
        method: "GET",
        headers: { "Content-Type": "application/json" }
    })
    .then(response => {
        if (!response.ok) throw new Error(`Server error: ${response.status}`);
        return response.json();
    })
    .then(history => {
        const chatHistoryDiv = document.getElementById("chat-history");
        chatHistoryDiv.innerHTML = ""; // Clear existing history

        if (history.length === 0) {
            console.log("No chat history available.");
            const emptyMessage = document.createElement("div");
            emptyMessage.classList.add("chat-history-item");
            emptyMessage.textContent = "No chats yet.";
            emptyMessage.style.color = "var(--text-light)";
            chatHistoryDiv.appendChild(emptyMessage);
            return;
        }

        history.forEach((chat, index) => {
            const historyItem = document.createElement("div");
            historyItem.classList.add("chat-history-item");
            historyItem.dataset.index = index;

            const historyText = document.createElement("span");
            historyText.classList.add("chat-history-text");
            historyText.textContent = chat.user.length > 30 ? chat.user.substring(0, 27) + "..." : chat.user;
            historyItem.appendChild(historyText);

            const deleteIcon = document.createElement("i");
            deleteIcon.classList.add("fas", "fa-trash", "delete-chat-icon");
            deleteIcon.title = "Delete chat";
            deleteIcon.addEventListener("click", (e) => {
                e.stopPropagation(); // Prevent triggering the history item click
                deleteChat(index);
            });
            historyItem.appendChild(deleteIcon);

            historyItem.addEventListener("click", () => displayChat(index, history));
            chatHistoryDiv.appendChild(historyItem);
        });
    })
    .catch(error => {
        console.error("⚠️ Error loading chat history:", error);
        showError("Failed to load chat history: " + error.message);
    });
}

// Display a specific chat from history
function displayChat(index, history) {
    const chatBox = document.getElementById("chat-box");
    chatBox.innerHTML = ""; // Clear current chat

    const chat = history[index];
    if (chat) {
        // Display user message
        chatBox.innerHTML += `<div class="message user-message">${chat.user}</div>`;
        // Display bot response
        lastUserMessage = chat.user; // Update last user message for regeneration
        streamResponse(chat.bot);
    }

    // Highlight the selected history item
    const historyItems = document.querySelectorAll(".chat-history-item");
    historyItems.forEach(item => item.classList.remove("active"));
    if (historyItems[index]) {
        historyItems[index].classList.add("active");
    }

    // Toggle sidebar on chat selection
    toggleSidebar();
}

// Delete a specific chat from history
function deleteChat(index) {
    fetch(`/history/${index}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" }
    })
    .then(response => {
        if (!response.ok) throw new Error(`Server error: ${response.status}`);
        return response.json();
    })
    .then(data => {
        console.log("Chat deleted:", data);
        loadChatHistory(); // Reload history after deletion
        // Clear the chat box if the deleted chat was being displayed
        const chatBox = document.getElementById("chat-box");
        chatBox.innerHTML = "";
        // Clear the last user message
        lastUserMessage = "";
        // Reset scrolling flag and position
        isUserScrolling = false;
        lastScrollPosition = 0;
    })
    .catch(error => {
        console.error("⚠️ Error deleting chat:", error);
        showError("Failed to delete chat: " + error.message);
    });
}

// Message Handling
function sendMessage() {
    let userInput = document.getElementById("user-input");
    let chatBox = document.getElementById("chat-box");
    let message = userInput.value.trim();

    if (message === "") return;

    // Add user message
    chatBox.innerHTML += `<div class="message user-message">${message}</div>`;
    userInput.value = "";
    userInput.style.height = "auto";
    
    // Store the last user message for regeneration
    lastUserMessage = message;

    // Show typing indicator
    const typingIndicator = document.createElement("div");
    typingIndicator.classList.add("message", "bot-message");
    typingIndicator.innerHTML = `
        <div class="typing-indicator">
            <span></span>
            <span></span>
            <span></span>
        </div>
    `;
    chatBox.appendChild(typingIndicator);
    chatBox.scrollTop = chatBox.scrollHeight;

    // Reset scrolling flag when sending a new message
    isUserScrolling = false;
    lastScrollPosition = chatBox.scrollHeight;

    // Close sidebar on mobile after sending a message
    if (window.innerWidth <= 768) {
        const sidebar = document.getElementById("sidebar");
        const mainContent = document.getElementById("main-content");
        const sidebarToggle = document.getElementById("sidebar-toggle");
        sidebar.classList.remove("active");
        mainContent.classList.remove("sidebar-active");
        sidebarToggle.innerHTML = '<i class="fas fa-bars"></i>';
    }

    sendToServer(message);
}

// Server Communication
function sendToServer(text) {
    fetch("/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: text })
    })
    .then(response => {
        if (!response.ok) throw new Error(`Server error: ${response.status}`);
        return response.json();
    })
    .then(data => {
        removeTypingIndicator();
        if (data.response) streamResponse(data.response);
        else if (data.error) showError(data.error);
        else showError("Unexpected server response");
        loadChatHistory(); // Reload history after new message
    })
    .catch(error => {
        console.error("⚠️ Fetch Error:", error);
        showError(error.message);
    });
}

// Response Handling
function streamResponse(responseText) {
    let chatBox = document.getElementById("chat-box");
    let botMessageContainer = createBotMessageContainer(chatBox);
    let botMessage = botMessageContainer.querySelector(".bot-message");
    
    const segments = parseResponseSegments(responseText);
    
    // Show the stop button when streaming starts
    const stopBtn = document.getElementById("stop-btn");
    const sendBtn = document.getElementById("send-btn");
    stopBtn.style.display = "flex";
    sendBtn.style.display = "none";

    // Restore the last scroll position if the user was scrolled up
    if (isUserScrolling) {
        chatBox.scrollTop = lastScrollPosition;
        console.log("Restoring scroll position on stream start:", lastScrollPosition);
    }

    streamSegments(segments, botMessage, botMessageContainer, chatBox);
}

// Stop streaming functionality
function stopStreaming() {
    if (streamingInterval) {
        clearInterval(streamingInterval);
        streamingInterval = null;
    }
    // Hide the stop button and show the send button
    const stopBtn = document.getElementById("stop-btn");
    const sendBtn = document.getElementById("send-btn");
    stopBtn.style.display = "none";
    sendBtn.style.display = "flex";
    // Remove typing indicator if present
    removeTypingIndicator();
    // Reset scrolling flag
    isUserScrolling = false;
    // Update last scroll position
    const chatBox = document.getElementById("chat-box");
    lastScrollPosition = chatBox.scrollTop;
    console.log("Stopped streaming, scroll position:", lastScrollPosition);
}

// Regenerate response functionality
function regenerateResponse() {
    if (!lastUserMessage) {
        showError("No previous message to regenerate.");
        return;
    }

    // Remove the last bot message (and any code blocks or typing indicators)
    const chatBox = document.getElementById("chat-box");
    const lastBotMessage = chatBox.querySelector(".bot-message-container:last-of-type");
    const lastCodeBlock = chatBox.querySelector(".code-block-container:last-of-type");
    if (lastBotMessage) lastBotMessage.remove();
    if (lastCodeBlock) lastCodeBlock.remove();

    // Show typing indicator
    const typingIndicator = document.createElement("div");
    typingIndicator.classList.add("message", "bot-message");
    typingIndicator.innerHTML = `
        <div class="typing-indicator">
            <span></span>
            <span></span>
            <span></span>
        </div>
    `;
    chatBox.appendChild(typingIndicator);

    // Restore the last scroll position if the user was scrolled up
    if (isUserScrolling) {
        chatBox.scrollTop = lastScrollPosition;
        console.log("Restoring scroll position on regenerate:", lastScrollPosition);
    } else {
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    // Reset scrolling flag when regenerating
    isUserScrolling = false;

    // Resend the last user message
    sendToServer(lastUserMessage);
}

// Helper Functions
function removeTypingIndicator() {
    const typingIndicators = document.querySelectorAll(".typing-indicator");
    typingIndicators.forEach(indicator => indicator.parentElement.remove());
}

function createBotMessageContainer(chatBox) {
    let botMessage = document.createElement("div");
    botMessage.classList.add("message", "bot-message");

    let container = document.createElement("div");
    container.classList.add("bot-message-container");
    container.appendChild(botMessage);

    // Add copy icon
    let copyIcon = document.createElement("i");
    copyIcon.classList.add("fas", "fa-copy", "copy-icon");
    copyIcon.title = "Copy to clipboard";
    copyIcon.addEventListener("click", handleCopyClick);
    container.appendChild(copyIcon);

    // Add regenerate icon
    let regenerateIcon = document.createElement("i");
    regenerateIcon.classList.add("fas", "fa-redo", "regenerate-icon");
    regenerateIcon.title = "Regenerate response";
    regenerateIcon.addEventListener("click", regenerateResponse);
    container.appendChild(regenerateIcon);

    chatBox.appendChild(container);
    return container;
}

function parseResponseSegments(responseText) {
    const segments = [];
    let currentIndex = 0;
    const tagRegex = /<(br|strong|\/strong|code-block[^>]*>.*?<\/code-block)>/g;
    let match;

    while ((match = tagRegex.exec(responseText)) !== null) {
        if (match.index > currentIndex) {
            segments.push({ type: "text", content: responseText.slice(currentIndex, match.index) });
        }
        if (match[0].startsWith("<code-block")) {
            const codeBlockMatch = responseText.slice(match.index).match(/<code-block[^>]*>(.*?)<\/code-block>/);
            if (codeBlockMatch) {
                const languageMatch = match[0].match(/data-code-language="([^"]*)"/);
                const language = languageMatch ? languageMatch[1] : "text";
                segments.push({ type: "code-block", content: codeBlockMatch[1], language: language });
                currentIndex = match.index + codeBlockMatch[0].length;
            } else {
                segments.push({ type: "html", content: match[0] });
                currentIndex = match.index + match[0].length;
            }
        } else {
            segments.push({ type: "html", content: match[0] });
            currentIndex = match.index + match[0].length;
        }
    }

    if (currentIndex < responseText.length) {
        segments.push({ type: "text", content: responseText.slice(currentIndex) });
    }

    return segments;
}

function streamSegments(segments, botMessage, botMessageContainer, chatBox) {
    let segmentIndex = 0;
    let charIndex = 0;
    let currentHtml = "";
    let currentContainer = botMessageContainer;
    let accumulatedText = ""; // Batch text updates
    const charsPerTick = 3; // Increase to 3 characters per update

    function updateDOM() {
        if (accumulatedText) {
            currentHtml += accumulatedText;
            botMessage.innerHTML = currentHtml;
            accumulatedText = "";
        }

        lastScrollPosition = chatBox.scrollTop;

        const isNearBottom = (chatBox.scrollHeight - chatBox.scrollTop - chatBox.clientHeight) < 50;
        if (isNearBottom && !isUserScrolling) {
            isUpdatingScroll = true;
            requestAnimationFrame(() => {
                chatBox.scrollTop = chatBox.scrollHeight;
                lastScrollPosition = chatBox.scrollTop;
                isUpdatingScroll = false;
                console.log("Auto-scrolling, scroll position:", lastScrollPosition);
            });
        } else {
            console.log("Not auto-scrolling, isUserScrolling:", isUserScrolling, "isNearBottom:", isNearBottom, "scroll position:", lastScrollPosition);
        }
    }

    streamingInterval = setInterval(() => {
        if (segmentIndex >= segments.length) {
            clearInterval(streamingInterval);
            streamingInterval = null;
            updateDOM(); // Final update
            // Hide the stop button and show the send button when streaming completes
            const stopBtn = document.getElementById("stop-btn");
            const sendBtn = document.getElementById("send-btn");
            stopBtn.style.display = "none";
            sendBtn.style.display = "flex";
            // Reset scrolling flag when streaming completes
            isUserScrolling = false;
            lastScrollPosition = chatBox.scrollTop;
            console.log("Streaming complete, scroll position:", lastScrollPosition);
            return;
        }

        const currentSegment = segments[segmentIndex];

        if (currentSegment.type === "code-block") {
            updateDOM(); // Flush any pending text updates
            // Create a new container for the code block
            const codeContainer = document.createElement("div");
            codeContainer.classList.add("code-block-container");

            const codeBlock = document.createElement("code-block");
            codeBlock.innerHTML = currentSegment.content;

            const header = document.createElement("div");
            header.classList.add("code-block-header");

            const languageLabel = document.createElement("span");
            languageLabel.classList.add("code-language");
            languageLabel.textContent = currentSegment.language;

            const actions = document.createElement("div");
            actions.classList.add("code-actions");

            const copyIcon = document.createElement("i");
            copyIcon.classList.add("fas", "fa-copy", "code-copy-icon");
            copyIcon.title = "Copy code";
            copyIcon.addEventListener("click", () => handleCodeCopyClick(currentSegment.content));

            const executeIcon = document.createElement("i");
            executeIcon.classList.add("fas", "fa-play", "code-execute-icon");
            executeIcon.title = "Execute code";
            executeIcon.addEventListener("click", () => handleCodeExecuteClick(currentSegment.content, currentSegment.language, codeContainer));

            actions.appendChild(copyIcon);
            actions.appendChild(executeIcon);

            header.appendChild(languageLabel);
            header.appendChild(actions);

            codeContainer.appendChild(header);
            codeContainer.appendChild(codeBlock);

            chatBox.appendChild(codeContainer);
            currentContainer = createBotMessageContainer(chatBox);
            botMessage = currentContainer.querySelector(".bot-message");
            currentHtml = "";
            segmentIndex++;
            updateDOM();
        } else if (currentSegment.type === "html") {
            accumulatedText += currentSegment.content;
            segmentIndex++;
        } else {
            if (charIndex < currentSegment.content.length) {
                const remainingChars = currentSegment.content.length - charIndex;
                const charsToAdd = Math.min(charsPerTick, remainingChars);
                accumulatedText += currentSegment.content.slice(charIndex, charIndex + charsToAdd);
                charIndex += charsToAdd;
            } else {
                segmentIndex++;
                charIndex = 0;
            }
        }

        // Update DOM every 15 characters or at segment boundaries
        if (accumulatedText.length >= 15 || segmentIndex >= segments.length || currentSegment.type === "html") {
            updateDOM();
        }
    }, 20); // Reduced to 20ms for faster streaming
}

function handleCopyClick() {
    const responseText = this.parentElement.querySelector(".bot-message").innerHTML;
    const textToCopy = responseText.replace(/<br>/g, '\n').replace(/<\/?strong>/g, '');
    
    navigator.clipboard.writeText(textToCopy).then(() => {
        showCopyNotification();
    }).catch(err => {
        console.error("Failed to copy text: ", err);
    });
}

function handleCodeCopyClick(codeContent) {
    // Remove <br> tags for copying
    const textToCopy = codeContent.replace(/<br>/g, '\n');
    navigator.clipboard.writeText(textToCopy).then(() => {
        showCopyNotification();
    }).catch(err => {
        console.error("Failed to copy code: ", err);
    });
}

async function handleCodeExecuteClick(codeContent, language, container) {
    // Remove <br> tags and replace with newlines for execution
    const executableCode = codeContent.replace(/<br>/g, '\n');

    if (language === "java") {
        const output = "Java execution is not supported in this browser environment.";
        displayCodeOutput(output, container);
        return;
    }

    if (language !== "python") {
        const output = `Execution not supported for language: ${language}`;
        displayCodeOutput(output, container);
        return;
    }

    if (!pyodide) {
        const output = "Pyodide is not loaded. Please try again later.";
        displayCodeOutput(output, container);
        return;
    }

    try {
        // Redirect print output to a variable
        let output = "";
        pyodide.globals.set("print_output", "");
        await pyodide.runPythonAsync(`
import sys
from io import StringIO

# Redirect stdout to capture print statements
sys.stdout = StringIO()

${executableCode}

# Get the captured output
print_output = sys.stdout.getvalue()
sys.stdout = sys.__stdout__  # Reset stdout
        `);
        output = pyodide.globals.get("print_output") || "No output";
        displayCodeOutput(output, container);
    } catch (err) {
        const output = `Error: ${err.message}`;
        displayCodeOutput(output, container);
    }
}

function displayCodeOutput(output, container) {
    let outputDiv = container.querySelector(".code-output");
    if (!outputDiv) {
        outputDiv = document.createElement("div");
        outputDiv.classList.add("code-output");
        container.appendChild(outputDiv);
    }
    outputDiv.textContent = output;
}

function showCopyNotification() {
    const notification = document.createElement("div");
    notification.textContent = "Copied!";
    notification.style.position = "fixed";
    notification.style.bottom = "20px";
    notification.style.right = "20px";
    notification.style.backgroundColor = "#2d6df6";
    notification.style.color = "white";
    notification.style.padding = "8px 16px";
    notification.style.borderRadius = "4px";
    notification.style.zIndex = "1000";
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 2000);
}

function showError(errorMessage) {
    const chatBox = document.getElementById("chat-box");
    const errorElement = document.createElement("div");
    errorElement.classList.add("message", "bot-message", "error-message");
    errorElement.textContent = `⚠️ Error: ${errorMessage}`;
    chatBox.appendChild(errorElement);
    chatBox.scrollTop = chatBox.scrollHeight;
}