const imageInput = document.getElementById('imageUpload');
const analyzeButton = document.getElementById('analyzeButton');
const previewImage = document.getElementById('previewImage');
const canvas = document.getElementById('canvas');
const resultsDiv = document.getElementById('results');

const loadModels = async () => {
    await Promise.all([
        faceapi.nets.ssdMobilenetv1.loadFromUri('./models'),
        faceapi.nets.faceLandmark68Net.loadFromUri('./models'),
        faceapi.nets.faceRecognitionNet.loadFromUri('./models'),
        faceapi.nets.ageGenderNet.loadFromUri('./models'),
    ]);
    console.log('Models loaded');
};

const analyzeImage = async () => {
    resultsDiv.innerHTML = '<p class="alert">Analyzing image...</p>';
    const faceAIData = await faceapi
        .detectAllFaces(previewImage)
        .withFaceLandmarks()
        .withFaceDescriptors()
        .withAgeAndGender();

    resultsDiv.innerHTML = '';
    if (faceAIData.length === 0) {
        resultsDiv.innerHTML = '<p>No faces detected. Please try a different image.</p>';
        return;
    }

    faceAIData.forEach((data, index) => {
        const { age, gender, genderProbability } = data;
        const faceHTML = `
            <div>
                <h3>Face ${index + 1}</h3>
                <p><strong>Age:</strong> ${age.toFixed(1)}</p>
                <p><strong>Gender:</strong> ${gender} (Confidence: ${(genderProbability * 100).toFixed(2)}%)</p>
            </div>
        `;
        resultsDiv.innerHTML += faceHTML;
    });

    canvas.width = previewImage.width;
    canvas.height = previewImage.height;
    const displaySize = { width: previewImage.width, height: previewImage.height };
    const resizedResults = faceapi.resizeResults(faceAIData, displaySize);

    faceapi.draw.drawDetections(canvas, resizedResults);
    faceapi.draw.drawFaceLandmarks(canvas, resizedResults);
};

imageInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = () => {
            previewImage.src = reader.result;
            previewImage.style.display = 'block';
            analyzeButton.disabled = false;
        };
        reader.readAsDataURL(file);
    }
});

analyzeButton.addEventListener('click', analyzeImage);
loadModels();
