import { initializeApp } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, updateDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyA3Kphg2UvYRLMWY2qQ86J6RsIkG639Dew",
    authDomain: "quiz-chbk.firebaseapp.com",
    projectId: "quiz-chbk",
    storageBucket: "quiz-chbk.firebasestorage.app",
    messagingSenderId: "66746389127",
    appId: "1:66746389127:web:b2ccefa1f6cb223de65e22"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// Éléments HTML
const loginBtn = document.getElementById('login-btn');
const userInfo = document.getElementById('user-info');
const mainMenu = document.getElementById('main-menu');
const btnSolo = document.getElementById('btn-solo');
const gameZone = document.getElementById('game-zone');

let currentUser = null;
let allQuestions = []; // Stockera toutes les questions
let gameQuestions = []; // Les 10 questions de la partie
let currentQIndex = 0;
let score = 0;
let timerInterval;
let timeLeft = 14;

// --- AUTHENTIFICATION ---
loginBtn.addEventListener('click', () => signInWithPopup(auth, provider));

onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        loginBtn.style.display = 'none';
        
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
            await setDoc(userRef, { displayName: user.displayName, photoURL: user.photoURL, xp: 0 });
            userInfo.innerHTML = `<img src="${user.photoURL}" style="width: 60px; border-radius: 50%; border: 2px solid var(--text-orange);"><p id="xp-display">XP: 0</p>`;
        } else {
            userInfo.innerHTML = `<img src="${user.photoURL}" style="width: 60px; border-radius: 50%; border: 2px solid var(--text-orange);"><p id="xp-display">XP: ${userSnap.data().xp}</p>`;
        }
        
        // On charge les questions en arrière-plan et on affiche le menu
        chargerQuestions();
        mainMenu.style.display = 'block';
    } else {
        loginBtn.style.display = 'block';
        userInfo.innerHTML = '';
        mainMenu.style.display = 'none';
    }
});

// --- CHARGEMENT DES QUESTIONS ---
async function chargerQuestions() {
    const querySnapshot = await getDocs(collection(db, "questions"));
    allQuestions = [];
    querySnapshot.forEach((doc) => {
        allQuestions.push(doc.data());
    });
    console.log(`${allQuestions.length} questions chargées en mémoire.`);
}

// --- CORRECTEUR ORTHOGRAPHIQUE (Levenshtein) ---
function levenshteinDistance(a, b) {
    const matrix = [];
    for (let i = 0; i <= b.length; i++) { matrix[i] = [i]; }
    for (let j = 0; j <= a.length; j++) { matrix[0][j] = j; }
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
            }
        }
    }
    return matrix[b.length][a.length];
}

function verifierReponse(input, correct) {
    const userStr = input.trim().toLowerCase();
    const correctStr = correct.trim().toLowerCase();
    const maxTypos = correctStr.length > 5 ? 2 : 1; 
    return levenshteinDistance(userStr, correctStr) <= maxTypos;
}

// --- MOTEUR DE JEU SOLO ---
btnSolo.addEventListener('click', () => {
    if (allQuestions.length < 10) return alert("Pas assez de questions dans la base !");
    
    // Mélange et sélectionne 10 questions
    const shuffled = allQuestions.sort(() => 0.5 - Math.random());
    gameQuestions = shuffled.slice(0, 10);
    
    score = 0;
    currentQIndex = 0;
    mainMenu.style.display = 'none';
    gameZone.style.display = 'block';
    
    afficherQuestion();
});

function afficherQuestion() {
    clearInterval(timerInterval);
    const q = gameQuestions[currentQIndex];
    
    document.getElementById('question-counter').innerText = `Question ${currentQIndex + 1}/10`;
    document.getElementById('question-theme').innerText = q.theme;
    document.getElementById('question-text').innerText = q.question;
    
    const imgEl = document.getElementById('question-img');
    if (q.imageUrl && q.imageUrl !== "") {
        imgEl.src = q.imageUrl;
        imgEl.style.display = 'block';
    } else {
        imgEl.style.display = 'none';
    }

    const input = document.getElementById('answer-input');
    input.value = '';
    input.disabled = false;
    input.focus();
    
    document.getElementById('feedback-msg').innerText = '';
    document.getElementById('submit-answer').style.display = 'inline-block';
    
    timeLeft = 14;
    document.getElementById('timer').innerText = timeLeft;
    document.getElementById('timer').style.color = '#ff3333';
    
    timerInterval = setInterval(() => {
        timeLeft--;
        document.getElementById('timer').innerText = timeLeft;
        if (timeLeft <= 0) traiterReponse(""); // Temps écoulé
    }, 1000);
}

function traiterReponse(userAnswer) {
    clearInterval(timerInterval);
    const q = gameQuestions[currentQIndex];
    const isCorrect = verifierReponse(userAnswer, q.answer);
    
    const input = document.getElementById('answer-input');
    const feedback = document.getElementById('feedback-msg');
    
    input.disabled = true;
    document.getElementById('submit-answer').style.display = 'none';

    if (isCorrect) {
        score++;
        feedback.innerText = "✅ Bonne réponse !";
        feedback.style.color = "#4CAF50";
    } else {
        feedback.innerText = `❌ Faux ! La réponse était : ${q.answer}`;
        feedback.style.color = "#F44336";
    }

    setTimeout(passerQuestionSuivante, 2500); // Attend 2.5s avant la suite
}

// Validation au clic ou avec la touche Entrée
document.getElementById('submit-answer').addEventListener('click', () => {
    traiterReponse(document.getElementById('answer-input').value);
});
document.getElementById('answer-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') traiterReponse(document.getElementById('answer-input').value);
});

async function passerQuestionSuivante() {
    currentQIndex++;
    if (currentQIndex < 10) {
        afficherQuestion();
    } else {
        // FIN DE PARTIE
        gameZone.style.display = 'none';
        mainMenu.style.display = 'block';
        
        // Mise à jour de l'XP dans la base de données
        if (score > 0) {
            const userRef = doc(db, "users", currentUser.uid);
            const userSnap = await getDoc(userRef);
            const newXp = userSnap.data().xp + score;
            await updateDoc(userRef, { xp: newXp });
            document.getElementById('xp-display').innerText = `XP: ${newXp}`;
        }
        
        alert(`Partie terminée ! Score : ${score}/10. Tu as gagné ${score} XP.`);
    }
}