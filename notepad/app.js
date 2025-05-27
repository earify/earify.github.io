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

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
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

/* 메모장 및 다크모드 관련 */
const memoTextarea = document.getElementById("memo");
const darkModeToggle = document.getElementById("dark-mode-toggle");
const charCount = document.getElementById("char-count");
const warningMessage = document.getElementById("warning-message");
const MAX_CHARS = 60000;

darkModeToggle.addEventListener("change", () => {
  document.body.classList.toggle("dark-mode");
  localStorage.setItem("darkMode", darkModeToggle.checked);
});
if (localStorage.getItem("dark-mode") === "true" || localStorage.getItem("darkMode") === "true") {
  document.body.classList.add("dark-mode");
  darkModeToggle.checked = true;
}

const memoRef = ref(database, "memo");
onValue(memoRef, (snapshot) => {
  const memo = snapshot.val() || "";
  memoTextarea.value = memo;
  memoTextarea.disabled = false;
  memoTextarea.placeholder = "여기에 메모를 입력하세요...";
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

/* 파일 업로드 및 리스트 관련 */
const dropZone = document.getElementById("drop-zone");
const fileInput = document.getElementById("file-input");
const fileList = document.getElementById("file-list");
// 청크 최대 크기를 6MB로 설정 (base64 인코딩 후 10MB 미만 보장)
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
    // 각 파일은 processFile에서 DB에 바로 등록하므로, onValue에서 리스트가 갱신됩니다.
    processFile(file);
  }
}

// progress 업데이트를 위해 DB의 progress 필드를 업데이트
function updateProgress(fileId, progress) {
  const fileRef = ref(database, `files/${fileId}`);
  update(fileRef, { progress: progress });
}

// 파일 처리: DB에 초기 항목을 생성하고, 진행률(progress)을 업데이트
async function processFile(file) {
  const filesRef = ref(database, "files");
  const newFileRef = push(filesRef);
  const fileId = newFileRef.key;
  
  // DB에 초기 항목 저장 (progress 0, uploadComplete false)
  await set(newFileRef, {
    name: file.name,
    type: file.type,
    size: file.size,
    chunked: file.size > MAX_CHUNK_SIZE,
    uploadComplete: false,
    progress: 0
  });
  
  if (file.size <= MAX_CHUNK_SIZE) {
    // 단일 파일: FileReader의 onprogress 이벤트 사용
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
    // 청크 처리: 파일을 순차적으로 읽고, 각 청크 완료 후 진행률 업데이트
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
}

// FileReader를 사용하여 파일 또는 청크를 base64 문자열로 읽음 (onProgress callback 지원)
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

// 파일을 청크 단위로 읽어 base64 문자열 배열 반환
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

// 파일 리스트 자동 갱신 (DB 데이터 변경 시)
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
    fileList.innerHTML = "파일이 없습니다.";
  }
});

// 파일 다운로드 (청크된 파일은 Promise.all로 병렬로 가져와 합침)
window.downloadFile = async function (fileId) {
  const fileRef = ref(database, `files/${fileId}`);
  const snapshot = await get(fileRef);
  if (!snapshot.exists()) {
    alert("파일이 존재하지 않습니다.");
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
      alert("청크 파일 다운로드 오류: " + error.message);
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

// 파일 삭제
window.deleteFile = async function (fileId) {
  await remove(ref(database, `files/${fileId}`));
};

console.log("왜 안되냐고")
