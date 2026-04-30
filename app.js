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

// --- SYSTÈME DE NIVEAUX ---
function getLevelInfo(totalXp) {
    let level = 1;
    let xpNeeded = 50; // XP requis pour passer du niv 1 au niv 2
    let currentXp = totalXp;

    while (currentXp >= xpNeeded) {
        currentXp -= xpNeeded;
        level++;
        xpNeeded = Math.floor(xpNeeded * 1.5); // La difficulté augmente de 50% à chaque niveau
    }
    return { level, xpInCurrentLevel: currentXp, xpNeededForNext: xpNeeded };
}

function afficherProfil(user, totalXp) {
    const lvlInfo = getLevelInfo(totalXp);
    const progressPercent = (lvlInfo.xpInCurrentLevel / lvlInfo.xpNeededForNext) * 100;

    userInfo.innerHTML = `
        <img src="${user.photoURL}" style="width: 60px; border-radius: 50%; border: 2px solid var(--text-orange); margin-bottom: 10px;">
        <div style="font-size: 1.2rem; font-weight: bold;">Niveau ${lvlInfo.level}</div>
        <div style="font-size: 0.9rem; color: #ccc;">${lvlInfo.xpInCurrentLevel} / ${lvlInfo.xpNeededForNext} XP</div>
        
        <!-- Barre de progression -->
        <div style="width: 200px; background: #333; height: 10px; border-radius: 5px; margin: 5px auto;">
            <div style="width: ${progressPercent}%; background: var(--text-orange); height: 10px; border-radius: 5px; transition: width 0.5s ease-in-out;"></div>
        </div>
    `;
}


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
            afficherProfil(user, 0);
        } else {
            afficherProfil(user, userSnap.data().xp);
        }
        
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
    const userNorm = nettoyerTexte(input);
    const correctNorm = nettoyerTexte(correct);
    
    // Si après nettoyage c'est exactement pareil, c'est gagné direct !
    if (userNorm === correctNorm) return true;

    // Calcul du nombre de fautes
    const distance = levenshteinDistance(userNorm, correctNorm);
    
    // On prend la longueur du mot le plus long pour notre base de calcul
    const maxLength = Math.max(userNorm.length, correctNorm.length);
    
    // Sécurité si les champs sont vides
    if (maxLength === 0) return false;

    // Calcul du pourcentage de ressemblance (1 = 100%, 0.85 = 85%)
    const pourcentageRessemblance = (maxLength - distance) / maxLength;

    // C'est valide SI on a au moins 85% de ressemblance OU si c'est un mot court avec juste 1 faute
    return pourcentageRessemblance >= 0.85 || distance <= 1;
}

// --- NAVIGATION MENU ---
const btnVsMenu = document.getElementById('btn-vs-menu');
const vsLobby = document.getElementById('vs-lobby');
const btnBackMenu = document.getElementById('btn-back-menu');

btnVsMenu.addEventListener('click', () => {
    mainMenu.style.display = 'none';
    vsLobby.style.display = 'block';
});

btnBackMenu.addEventListener('click', () => {
    vsLobby.style.display = 'none';
    mainMenu.style.display = 'block';
});

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
        
        if (score > 0) {
            const userRef = doc(db, "users", currentUser.uid);
            const userSnap = await getDoc(userRef);
            const newXp = userSnap.data().xp + score;
            await updateDoc(userRef, { xp: newXp });
            
            // On met à jour l'affichage du profil avec la nouvelle barre de progression !
            afficherProfil(currentUser, newXp);
        }
        
        alert(`Partie terminée ! Score : ${score}/10. Tu as gagné ${score} XP.`);
    }
}