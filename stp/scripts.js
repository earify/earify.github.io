let scale = 20;  // 확대/축소 비율
let offsetX = 250;  // 좌표평면의 중심 X 좌표 (초기값)
let offsetY = 250;  // 좌표평면의 중심 Y 좌표 (초기값)
let effectRange = [];
let centerX = 0, centerY = 0;  // 기본값 (0, 0)
const defaultRange = 4;  // 기본 범위 값

// 페이지 로드 시 기본값으로 캔버스 그리기
window.onload = function() {
    // 입력 필드에 기본값 설정
    document.getElementById('x-coordinate').value = centerX;
    document.getElementById('y-coordinate').value = centerY;
    document.getElementById('range').value = defaultRange;

    // 기본값으로 캔버스 그리기
    generateEffectRange(centerX, centerY, defaultRange); // 기본값으로 좌표 범위 계산
    drawOnCanvas(); // 캔버스에 점 그리기
};

// 좌표와 범위 입력 처리
document.getElementById('x-coordinate').addEventListener('input', updateCanvas);
document.getElementById('y-coordinate').addEventListener('input', updateCanvas);
document.getElementById('range').addEventListener('input', updateCanvas);

function updateCanvas() {
    const x = parseInt(document.getElementById('x-coordinate').value, 10);
    const y = parseInt(document.getElementById('y-coordinate').value, 10);
    const n = parseInt(document.getElementById('range').value, 10);

    // 유효한 값이 있는 경우에만 처리
    if (!isNaN(x) && !isNaN(y) && !isNaN(n) && n > 0) {
        centerX = x;
        centerY = y;
        generateEffectRange(x, y, n);
        drawOnCanvas();
    }
}

function generateEffectRange(x, y, n) {
    // 범위 계산
    effectRange = [];
    for (let i = x - n; i <= x + n; i++) {
        effectRange.push([i, y]);
    }
    for (let j = y - n; j <= y + n; j++) {
        effectRange.push([x, j]);
    }

    // 결과 출력
    const outputDiv = document.getElementById('output');
    outputDiv.innerHTML = `시작점: (${x}, ${y}), 범위: ${n}`;
    
    // 좌표 목록 업데이트
    updateCoordinateList();
}

function drawOnCanvas() {
    const canvas = document.getElementById('coordinateCanvas');
    const ctx = canvas.getContext('2d');

    // 캔버스 초기화 (배경 지우기)
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 축 그리기
    ctx.beginPath();
    ctx.moveTo(0, offsetY);
    ctx.lineTo(canvas.width, offsetY);
    ctx.moveTo(offsetX, 0);
    ctx.lineTo(offsetX, canvas.height);
    ctx.strokeStyle = 'black';
    ctx.stroke();

    // 점 그리기
    effectRange.forEach((point) => {
        // 좌표를 확대/축소
        const x = point[0] * scale + offsetX; // 확대된 x 좌표
        const y = -point[1] * scale + offsetY; // 확대된 y 좌표 (위로 증가)

        // 중심점은 빨간색, 나머지는 검은색
        if (point[0] === centerX && point[1] === centerY) {
            ctx.fillStyle = 'red';  // 중심점은 빨간색
        } else {
            ctx.fillStyle = 'black';  // 나머지 점은 검은색
        }

        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fill();

        // 좌표 텍스트 그리기
        ctx.fillStyle = 'black';
        ctx.fillText(`(${point[0]}, ${point[1]})`, x + 8, y - 8);
    });
}

// 좌표 목록 업데이트
function updateCoordinateList() {
    const ul = document.getElementById('coordinates-ul');
    ul.innerHTML = '';  // 기존 목록 비우기

    effectRange.forEach((point) => {
        const li = document.createElement('li');
        li.textContent = `(${point[0]}, ${point[1]})`;
        ul.appendChild(li);
    });
}

// 캔버스 이동 (드래그)
const canvas = document.getElementById('coordinateCanvas');
let isDragging = false;
let startX, startY;  // 드래그 시작 좌표

canvas.addEventListener('mousedown', (e) => {
    isDragging = true;
    startX = e.offsetX;
    startY = e.offsetY;
});

canvas.addEventListener('mousemove', (e) => {
    if (isDragging) {
        const dx = e.offsetX - startX;
        const dy = e.offsetY - startY;
        offsetX += dx;
        offsetY += dy;
        startX = e.offsetX;
        startY = e.offsetY;
        drawOnCanvas();
    }
});

canvas.addEventListener('mouseup', () => {
    isDragging = false;
});

canvas.addEventListener('mouseout', () => {
    isDragging = false;
});

// 확대/축소 (마우스 휠)
canvas.addEventListener('wheel', (e) => {
    e.preventDefault();

    const canvasRect = canvas.getBoundingClientRect();  // 캔버스의 화면 내 위치 계산
    const mouseX = e.clientX - canvasRect.left;  // 마우스 X 위치 (캔버스 내 좌표)
    const mouseY = e.clientY - canvasRect.top;   // 마우스 Y 위치 (캔버스 내 좌표)

    // 마우스 휠 방향에 따라 확대/축소
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;  // 확대: 1.1배, 축소: 0.9배
    const zoom = scale * zoomFactor;

    // 확대/축소 시 마우스 포인터 위치를 기준으로 캔버스의 좌표 이동
    const newOffsetX = offsetX + (mouseX - offsetX) * (1 - zoomFactor);
    const newOffsetY = offsetY + (mouseY - offsetY) * (1 - zoomFactor);

    scale = zoom;  // 새로운 scale 값 설정
    offsetX = newOffsetX;  // 새로운 중심 좌표 설정
    offsetY = newOffsetY;  // 새로운 중심 좌표 설정

    drawOnCanvas();  // 캔버스를 다시 그리기
});

console.log('민우쌤 최고!');