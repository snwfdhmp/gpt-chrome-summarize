const AUTHORIZATION_HEADER =
  "Bearer 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";
let textArea;
let cost;
let tokenCount;
let summarizeButton;
let summarizeButtonTitle;

const PREPROMPT = `
You are an internet browsing assistant.
Summarize the following webpage text content using bullet points.
Webpages are sent to you by the user in message. 1 message = 1 webpage.
The content is messy and contains useless information, you have to filter it.
Use "Sentence case" : first word with capital letter, the rest lowercase.
Use concise sentences.
`;

document.addEventListener("DOMContentLoaded", function () {
  conversationString = "";
  // document.getElementById("location").innerHTML = window.location.href;
  textArea = document.getElementById("text-area");
  summarizeButton = document.getElementById("summarize");
  cost = document.getElementById("cost");
  tokenCount = document.getElementById("token-count");
  summarizeButtonTitle = document.getElementById("summarize-title");
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    // document.getElementById("location").innerHTML = tabs[0].url;
    // if url extension is pdf
    if (tabs[0].url.split(".").pop() === "pdf") {
      textArea.value = "PDF not supported yet.";
      // textArea.value = "Loading pdf...";
      // // var pdfjsLib = window["pdfjs-dist/build/pdf"];
      // // pdfjsLib.GlobalWorkerOptions.workerSrc =
      // //   "https://mozilla.github.io/pdf.js/build/pdf.worker.js";
      // var loadingTask = pdfjsLib.getDocument({ data: pdfData });
      // loadingTask.promise.then(
      //   function (pdf) {
      //     textArea.value = "PDF loaded.";

      //     // // Fetch the first page
      //     // var pageNumber = 1;
      //     // // log(pdf);
      //     // textArea.value = pdf.numPages;
      //   },
      //   function (reason) {
      //     // PDF loading error
      //     textArea.value = "Error loading pdf. " + JSON.stringify(reason);
      //   }
      // );
    }
  });

  // Get the content of the current webpage
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    chrome.tabs.sendMessage(
      tabs[0].id,
      { message: "getWebPageContent" },
      function (response) {
        // Display the content in the text area
        // textArea.value = response.content;
        textArea.value = response.content;
        // update token count
        // count words regex
        var wordCount = textArea.value.match(/\S+/g).length;
        tokenCount.innerText = Math.floor((wordCount * 100) / 75);
        cost.innerText = ((tokenCount.innerText * 0.002) / 1000).toFixed(4);
      }
    );
  });

  summarizeButton.addEventListener("click", function () {
    runSummarize();
  });
});

// send log to content.js
const log = (data) => {
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    chrome.tabs.sendMessage(tabs[0].id, { message: "log", data });
  });
};

const sendPrompt = async () => {
  conversationString = "";
  const requestBody = {
    model: "gpt-3.5-turbo",
    messages: [
      {
        role: "system",
        content: PREPROMPT,
      },
      {
        role: "user",
        content: textArea.value,
      },
    ],
    temperature: 0.2,
    stream: true,
  };

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: AUTHORIZATION_HEADER,
    },
    body: JSON.stringify(requestBody),
  });

  const reader = response.body.getReader();
  let result = await reader.read();
  let decoder = new TextDecoder("utf-8");
  let partialData = "";

  while (!result.done) {
    partialData += decoder.decode(result.value, { stream: true });

    while (partialData.includes("data:")) {
      const startIndex = partialData.indexOf("data:");
      const endIndex = partialData.indexOf("\n", startIndex);
      const messageData = partialData.slice(startIndex + 5, endIndex).trim();

      if (messageData) {
        const message = JSON.parse(messageData);
        const content = message.choices[0].delta.content;

        if (message.choices[0].finish_reason === "stop") {
          summarizeButtonTitle.innerHTML = "Summarize";
          // Last message received, stop processing
          return;
        }

        if (content) {
          displayMessage("Assistant", content);
        }
      }

      partialData = partialData.slice(endIndex + 1);
    }

    result = await reader.read();
  }
};

// Variable to store the conversation
let conversationString = "";

// Function to display messages in the conversation
function displayMessage(role, content) {
  if (role === "User") return;
  log({ role, content });

  // Append the formatted message to the conversation string
  conversationString += content;

  // Update the conversation display
  textArea.value = conversationString;
}

// Example usage
async function runSummarize() {
  summarizeButtonTitle.innerHTML =
    "Thinking <img src='https://i.gifer.com/ZZ5H.gif' class='loader' />";
  // displayMessage("User", textArea.value);
  sendPrompt(textArea.value);
  textArea.value = "";
}

log("popup opened");
