import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import {
    getDatabase,
    ref,
    onValue,
    set,
    push,
    remove,
    get,
    update
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-database.js";

// Firebase configuration (replace with your actual config if different)
const firebaseConfig = {
  apiKey: "AIzaSyDgoWPHwKnm0TNtZVAvd9W3Vgzk4T5MRVY",
  authDomain: "temp-notepad.firebaseapp.com",
  databaseURL: "https://temp-notepad-default-rtdb.firebaseio.com",
  projectId: "temp-notepad",
  storageBucket: "temp-notepad.firebasestorage.app",
  messagingSenderId: "597209729146",
  appId: "1:597209729146:web:a9d13f6eb5f093148d93c3",
  measurementId: "G-TKVFRGNWZ4"
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

/* Notepad and Dark Mode related */
const memoTextarea = document.getElementById("memo");
const darkModeToggle = document.getElementById("dark-mode-toggle");
const charCount = document.getElementById("char-count");
const warningMessage = document.getElementById("warning-message");
const MAX_CHARS = 60000;

// Custom Modal Elements
const customModalOverlay = document.getElementById("custom-modal-overlay");
const modalMessage = document.getElementById("modal-message");
const modalCloseButton = document.getElementById("modal-close-button");

// Global flag to track if an upload is in progress
let isUploading = false;

// Function to show the custom modal
function showModal(message) {
    modalMessage.textContent = message;
    customModalOverlay.classList.add("visible");
}

// Function to hide the custom modal
function hideModal() {
    customModalOverlay.classList.remove("visible");
}

// Event listener for modal close button
modalCloseButton.addEventListener("click", hideModal);
customModalOverlay.addEventListener("click", (e) => {
    if (e.target === customModalOverlay) {
        hideModal(); // Close modal if clicked outside content
    }
});


darkModeToggle.addEventListener("change", () => {
    document.body.classList.toggle("dark-mode");
    localStorage.setItem("darkMode", darkModeToggle.checked);
});
// Apply dark mode on load if previously enabled
if (localStorage.getItem("dark-mode") === "true" || localStorage.getItem("darkMode") === "true") {
    document.body.classList.add("dark-mode");
    darkModeToggle.checked = true;
}

const memoRef = ref(database, "memo");
onValue(memoRef, (snapshot) => {
    const memo = snapshot.val() || "";
    memoTextarea.value = memo;
    memoTextarea.disabled = false;
    memoTextarea.placeholder = "메모를 로드 중입니다...";
    updateCharCount(memo.length);
    memoTextarea.focus();
    memoTextarea.setSelectionRange(memo.length, memo.length);
});

const updateCharCount = (length) => {
    charCount.textContent = `${length} / ${MAX_CHARS}자`;
    if (length > MAX_CHARS) {
        warningMessage.classList.add("visible");
        warningMessage.classList.remove("hidden");
    } else {
        warningMessage.classList.add("hidden");
        warningMessage.classList.remove("visible");
    }
};

memoTextarea.addEventListener("input", () => {
    let memo = memoTextarea.value;
    if (memo.length > MAX_CHARS) {
        memo = memo.substring(0, MAX_CHARS);
        memoTextarea.value = memo;
    }
    updateCharCount(memo.length);
    set(memoRef, memo);
});

/* File Upload and List related */
const dropZone = document.getElementById("drop-zone");
const fileInput = document.getElementById("file-input");
const fileList = document.getElementById("file-list");
// Set maximum chunk size to 6MB (ensures less than 10MB after base64 encoding)
const MAX_CHUNK_SIZE = 6 * 1024 * 1024;

dropZone.addEventListener("click", () => fileInput.click());
dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("highlight");
});
dropZone.addEventListener("dragleave", (e) => {
    e.preventDefault();
    dropZone.classList.remove("highlight");
});
dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("highlight");
    handleFiles(e.dataTransfer.files);
});
fileInput.addEventListener("change", () => handleFiles(fileInput.files));

function handleFiles(files) {
    for (const file of files) {
        // Each file is registered directly in DB by processFile, so the list updates via onValue.
        processFile(file);
    }
}

// Update the 'progress' field in the DB for progress updates
function updateProgress(fileId, progress) {
    const fileRef = ref(database, `files/${fileId}`);
    update(fileRef, { progress: progress });
}

// File processing: Create initial entry in DB and update progress
async function processFile(file) {
    // Set uploading flag
    isUploading = true;

    const filesRef = ref(database, "files");
    const newFileRef = push(filesRef);
    const fileId = newFileRef.key;
    
    // Save initial entry to DB (progress 0, uploadComplete false)
    await set(newFileRef, {
        name: file.name,
        type: file.type,
        size: file.size,
        chunked: file.size > MAX_CHUNK_SIZE,
        uploadComplete: false,
        progress: 0
    });
    
    try {
        if (file.size <= MAX_CHUNK_SIZE) {
            // Single file: Use FileReader's onprogress event
            const base64String = await readFileAsBase64(file, (loaded, total) => {
                const pct = Math.floor((loaded / total) * 100);
                updateProgress(fileId, pct);
            });
            await update(newFileRef, {
                content: base64String,
                progress: 100,
                uploadComplete: true
            });
        } else {
            // Chunk processing: Read file sequentially, update progress after each chunk
            const totalChunks = Math.ceil(file.size / MAX_CHUNK_SIZE);
            const chunks = [];
            let start = 0;
            let chunkIndex = 0;
            while (start < file.size) {
                const end = Math.min(start + MAX_CHUNK_SIZE, file.size);
                const blobSlice = file.slice(start, end);
                const base64Chunk = await readFileAsBase64(blobSlice);
                chunks.push(base64Chunk);
                chunkIndex++;
                const pct = Math.floor((chunkIndex / totalChunks) * 100);
                updateProgress(fileId, pct);
                start = end;
            }
            await update(newFileRef, {
                chunked: true,
                chunksCount: chunks.length,
                progress: 100,
                uploadComplete: true
            });
            for (let i = 0; i < chunks.length; i++) {
                await set(ref(database, `files/${fileId}/chunks/${i}`), chunks[i]);
            }
        }
        showModal("파일 업로드가 완료되었습니다!");
    } catch (error) {
        console.error("파일 업로드 중 오류 발생:", error);
        showModal("파일 업로드 중 오류가 발생했습니다: " + error.message);
        // Clean up the partially uploaded file entry if an error occurs
        await remove(ref(database, `files/${fileId}`));
    } finally {
        // Reset uploading flag
        isUploading = false;
    }
}

// Read file or chunk as base64 string using FileReader (supports onProgress callback)
function readFileAsBase64(fileBlob, onProgress) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        if (onProgress) {
            reader.onprogress = (e) => {
                if (e.lengthComputable) {
                    onProgress(e.loaded, e.total);
                }
            };
        }
        reader.onload = (e) => {
            const result = e.target.result;
            const base64 = result.split(",")[1];
            resolve(base64);
        };
        reader.onerror = (err) => reject(err);
        reader.readAsDataURL(fileBlob);
    });
}

// Read file in chunks and return an array of base64 strings
async function readFileInChunks(file, chunkSize) {
    const chunks = [];
    let start = 0;
    while (start < file.size) {
        const end = Math.min(start + chunkSize, file.size);
        const blobSlice = file.slice(start, end);
        const base64Chunk = await readFileAsBase64(blobSlice);
        chunks.push(base64Chunk);
        start = end;
    }
    return chunks;
}

// Auto-update file list (when DB data changes)
const filesRef = ref(database, "files");
onValue(filesRef, (snapshot) => {
    fileList.innerHTML = "";
    const filesData = snapshot.val();
    if (filesData) {
        Object.keys(filesData).forEach((fileId) => {
            const file = filesData[fileId];
            const li = document.createElement("li");
            li.className = "file-item" + (file.uploadComplete ? "" : " uploading");
            let displayName = file.name;
            if (!file.uploadComplete) {
                displayName += ` (${file.progress || 0}%)`;
            }
            li.innerHTML = `
                <span onclick="downloadFile('${fileId}')">${displayName}</span>
                <button onclick="deleteFile('${fileId}')">×</button>
            `;
            fileList.appendChild(li);
        });
    } else {
        const li = document.createElement("li");
        li.textContent = "파일이 없습니다.";
        fileList.appendChild(li);
    }
});

// File download (fetch chunked files in parallel with Promise.all)
window.downloadFile = async function (fileId) {
    const fileRef = ref(database, `files/${fileId}`);
    const snapshot = await get(fileRef);
    if (!snapshot.exists()) {
        showModal("파일이 존재하지 않습니다.");
        return;
    }
    const fileData = snapshot.val();
    let base64Content = "";
    if (fileData.chunked) {
        const promises = [];
        for (let i = 0; i < fileData.chunksCount; i++) {
            const chunkRef = ref(database, `files/${fileId}/chunks/${i}`);
            promises.push(get(chunkRef).then(snap => {
                const val = snap.val();
                if (val === null) throw new Error(`청크 ${i} 없음`);
                return val;
            }));
        }
        try {
            const chunks = await Promise.all(promises);
            base64Content = chunks.join("");
        } catch (error) {
            showModal("청크 파일 다운로드 오류: " + error.message);
            return;
        }
    } else {
        base64Content = fileData.content;
    }
    const dataUrl = `data:${fileData.type};base64,${base64Content}`;
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = fileData.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
};

// File deletion
window.deleteFile = async function (fileId) {
    await remove(ref(database, `files/${fileId}`));
};

// Prevent page refresh during upload
window.addEventListener('beforeunload', (event) => {
    if (isUploading) {
        event.preventDefault(); // Standard for browser to show confirmation
        event.returnValue = ''; // For older browsers
        return '업로드 중인 파일이 있습니다. 페이지를 떠나면 업로드가 중단될 수 있습니다.'; // Message for some browsers
    }
});
