// Simple test script to verify the extension is working
console.log("Test script loaded");

// Function to test the API
async function testChatGPTAPI() {
  try {
    // Get your API key from the extension popup
    const apiKey = prompt("Enter your API key from the extension popup:");
    if (!apiKey) return;
    
    // Set the server URL
    const serverUrl = "http://localhost:3000";
    
    // Make a test request
    const response = await fetch(`${serverUrl}/api/query`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        apiKey: apiKey,
        message: "Hello, what day is it today?",
        newConversation: true
      })
    });
    
    // Parse the response
    const data = await response.json();
    
    // Display the result
    if (data.error) {
      console.error("Error:", data.error);
      alert(`Error: ${data.error}`);
    } else {
      console.log("Response:", data.response);
      alert(`ChatGPT says: ${data.response}`);
    }
  } catch (error) {
    console.error("Test failed:", error);
    alert(`Test failed: ${error.message}`);
  }
}

// Add a button to the page to run the test
function addTestButton() {
  const button = document.createElement("button");
  button.textContent = "Test ChatGPT API";
  button.style.position = "fixed";
  button.style.top = "10px";
  button.style.right = "10px";
  button.style.zIndex = "9999";
  button.style.padding = "10px";
  button.style.backgroundColor = "#10a37f";
  button.style.color = "white";
  button.style.border = "none";
  button.style.borderRadius = "5px";
  button.style.cursor = "pointer";
  
  button.addEventListener("click", testChatGPTAPI);
  
  document.body.appendChild(button);
}

// Run when the page is loaded
if (document.readyState === "complete") {
  addTestButton();
} else {
  window.addEventListener("load", addTestButton);
} 