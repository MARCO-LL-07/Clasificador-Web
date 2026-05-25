// Variables globales
let model;
let lastPredictions = null;      // Guardar últimas predicciones para "congelar" cuando no se supere umbral
let uncertainMode = false;       // Indicar si estamos en modo "incierto"

// Elementos DOM
const video = document.getElementById('webcam');
const predictionLabel = document.getElementById('prediction-label');
const confidenceSpan = document.getElementById('prediction-confidence');
const barsContainer = document.getElementById('bars-container');
const latencyDisplay = document.getElementById('latency-display');

// Umbral mínimo de confianza (85%)
const CONFIDENCE_THRESHOLD = 0.85;

// Cargar modelo
async function initModel() {
    try {
        model = await tmImage.load('./model/model.json', './model/metadata.json');
        console.log('Modelo cargado. Clases:', model.getTotalClasses());
    } catch (error) {
        console.error('Error al cargar modelo:', error);
        predictionLabel.innerText = 'Error al cargar el modelo';
        throw error;
    }
}

// Activar cámara
async function setupWebcam() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
        video.srcObject = stream;
        await new Promise((resolve) => {
            video.onloadedmetadata = () => { video.play(); resolve(); };
        });
        console.log('Cámara activada');
    } catch (error) {
        console.error('Error de cámara:', error);
        predictionLabel.innerText = error.name === 'NotAllowedError' 
            ? 'Permiso denegado' 
            : 'Cámara no disponible';
        throw error;
    }
}

// Bucle de predicción con medición de latencia
async function predictLoop() {
    if (!model) return;
    try {
        // Medir tiempo de inferencia
        const start = performance.now();
        const predictions = await model.predict(video);
        const end = performance.now();
        const latencyMs = (end - start).toFixed(2);
        if (latencyDisplay) latencyDisplay.innerText = `Inferencia: ${latencyMs} ms`;
        
        // Aplicar umbral de confianza
        const maxProbability = Math.max(...predictions.map(p => p.probability));
        if (maxProbability >= CONFIDENCE_THRESHOLD) {
            // Confianza suficiente: actualizar UI normalmente
            uncertainMode = false;
            lastPredictions = predictions;  // guardar copia
            updateUI(predictions);
        } else {
            // No supera el umbral: mostrar estado "Analizando..." y congelar barras
            uncertainMode = true;
            showUncertainState();
        }
    } catch (err) {
        console.error('Error en predicción:', err);
    }
    requestAnimationFrame(predictLoop);
}

// Mostrar estado de incertidumbre (no supera el 85%)
function showUncertainState() {
    predictionLabel.innerHTML = 'Analizando...';
    confidenceSpan.innerHTML = 'Confianza: < 85%';
    // Opcional: mostrar mensaje especial en lugar de barras
    barsContainer.innerHTML = '<div class="uncertain-message">Objeto no identificado<br>Confianza insuficiente</div>';
}

// Actualizar UI con semáforo de colores (cuando confianza >= umbral)
function updateUI(predictions) {
    // Clase con mayor confianza
    const top = predictions.reduce((a, b) => a.probability > b.probability ? a : b);
    predictionLabel.innerHTML = top.className;
    const confidencePercent = (top.probability * 100).toFixed(2);
    confidenceSpan.innerHTML = `Confianza: ${confidencePercent}% (≥85%)`;

    // Construir barras con colores según su propia confianza (no la máxima)
    barsContainer.innerHTML = '';
    predictions.forEach(pred => {
        const percent = (pred.probability * 100).toFixed(2);
        const numericPercent = parseFloat(percent);
        
        let color;
        if (numericPercent >= 90) color = '#2ecc71';   // Verde
        else if (numericPercent >= 50) color = '#f1c40f'; // Amarillo
        else color = '#e74c3c'; // Rojo
        
        const bar = document.createElement('div');
        bar.className = 'bar';
        const fill = document.createElement('div');
        fill.className = 'bar-fill';
        fill.style.width = `${percent}%`;
        fill.style.backgroundColor = color;
        fill.textContent = `${pred.className}: ${percent}%`;
        bar.appendChild(fill);
        barsContainer.appendChild(bar);
    });
}

// Alternar tema oscuro/claro
function toggleTheme() {
    document.body.classList.toggle('dark');
    const btn = document.getElementById('theme-toggle');
    if (document.body.classList.contains('dark')) {
        btn.textContent = 'Modo Oscuro';
    } else {
        btn.textContent = 'Modo Claro';
    }
}

// Inicialización
async function main() {
    await initModel();
    await setupWebcam();
    predictLoop();
}

// Configuración de eventos y creación de botón toggle si no existe
document.addEventListener('DOMContentLoaded', () => {
    main();
    
    // Crear botón toggle si no existe
    if (!document.getElementById('theme-toggle')) {
        const btn = document.createElement('button');
        btn.id = 'theme-toggle';
        btn.className = 'toggle-btn';
        btn.textContent = '☀️ Modo Claro';
        btn.addEventListener('click', toggleTheme);
        const h1 = document.querySelector('h1');
        h1.insertAdjacentElement('afterend', btn);
    } else {
        document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
    }
});