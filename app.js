import { initializeApp } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, updateDoc, collection, getDocs, query, orderBy, limit } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";

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

let currentUser = null;
let allQuestions = []; 

// --- GESTION DU PROFIL ET STATISTIQUES ---
function getLevelInfo(totalXp) {
    let level = 1;
    let xpNeeded = 50; 
    let currentXp = totalXp;
    while (currentXp >= xpNeeded) {
        currentXp -= xpNeeded;
        level++;
        xpNeeded = Math.floor(xpNeeded * 1.5);
    }
    return { level, xpInCurrentLevel: currentXp, xpNeededForNext: xpNeeded };
}

onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        document.getElementById('login-btn').style.display = 'none';
        
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
            // Création du profil avec la structure de Stats vierge
            const defaultData = { 
                displayName: user.displayName, 
                photoURL: user.photoURL, 
                xp: 0,
                stats: {
                    gamesPlayed: 0,
                    correctAnswers: 0,
                    totalAnswers: 0,
                    totalAnswerTime: 0,
                    themes: {}
                }
            };
            await setDoc(userRef, defaultData);
            afficherProfil(user, 0);
        } else {
            afficherProfil(user, userSnap.data().xp);
        }
        
        document.getElementById('btn-my-stats').style.display = 'block';
        chargerQuestions();
        chargerLeaderboard();
        document.getElementById('main-menu').style.display = 'block';
    } else {
        document.getElementById('login-btn').style.display = 'block';
        document.getElementById('user-info').innerHTML = '';
        document.getElementById('btn-my-stats').style.display = 'none';
        document.getElementById('main-menu').style.display = 'none';
    }
});

document.getElementById('login-btn').addEventListener('click', () => signInWithPopup(auth, provider));

function afficherProfil(user, totalXp) {
    const lvlInfo = getLevelInfo(totalXp);
    const progressPercent = (lvlInfo.xpInCurrentLevel / lvlInfo.xpNeededForNext) * 100;
    document.getElementById('user-info').innerHTML = `
        <img src="${user.photoURL}" style="width: 60px; border-radius: 50%; border: 2px solid var(--text-orange); margin-bottom: 10px;">
        <div style="font-size: 1.2rem; font-weight: bold;">Niveau ${lvlInfo.level}</div>
        <div style="font-size: 0.9rem; color: #ccc;">${lvlInfo.xpInCurrentLevel} / ${lvlInfo.xpNeededForNext} XP</div>
        <div style="width: 200px; background: #333; height: 10px; border-radius: 5px; margin: 5px auto;">
            <div style="width: ${progressPercent}%; background: var(--text-orange); height: 10px; border-radius: 5px;"></div>
        </div>
    `;
}

// --- LEADERBOARD & MODALES ---
async function chargerLeaderboard() {
    const q = query(collection(db, "users"), orderBy("xp", "desc"), limit(10));
    const querySnapshot = await getDocs(q);
    const list = document.getElementById('leaderboard-list');
    list.innerHTML = '';
    
    let rank = 1;
    querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const li = document.createElement('li');
        li.className = 'leaderboard-item';
        li.innerHTML = `
            <span class="leaderboard-rank">#${rank}</span>
            <img src="${data.photoURL}" style="width: 30px; border-radius: 50%;">
            <span class="leaderboard-name">${data.displayName}</span>
            <span class="leaderboard-xp">${data.xp} XP</span>
        `;
        // Clic sur un joueur = Ouverture de ses stats
        li.addEventListener('click', () => afficherModaleStats(data));
        list.appendChild(li);
        rank++;
    });
}

// Fonction pour afficher la fenêtre de statistiques
async function afficherModaleStats(userData = null) {
    // Si aucun joueur n'est précisé, on affiche les stats du joueur connecté
    if (!userData) {
        const docSnap = await getDoc(doc(db, "users", currentUser.uid));
        userData = docSnap.data();
    }

    const stats = userData.stats || {};
    const games = stats.gamesPlayed || 0;
    const correct = stats.correctAnswers || 0;
    const totalAns = stats.totalAnswers || 0;
    const time = stats.totalAnswerTime || 0;
    
    const winRate = totalAns > 0 ? Math.round((correct / totalAns) * 100) : 0;
    const avgSpeed = correct > 0 ? (time / correct).toFixed(1) : 0;

    let themesHTML = '<h4>Top Thèmes</h4><ul style="font-size: 0.9rem; color: #ccc;">';
    if (stats.themes) {
        for (const [theme, tData] of Object.entries(stats.themes)) {
            const tWinRate = Math.round((tData.correct / tData.total) * 100);
            themesHTML += `<li>${theme} : ${tWinRate}% de réussite</li>`;
        }
    }
    themesHTML += '</ul>';

    document.getElementById('stats-content').innerHTML = `
        <div style="text-align: center;">
            <img src="${userData.photoURL}" style="width: 80px; border-radius: 50%; border: 3px solid var(--text-orange);">
            <h2 style="color: var(--text-orange);">${userData.displayName}</h2>
            <p><strong>Parties jouées :</strong> ${games}</p>
            <p><strong>Bonnes réponses :</strong> ${winRate}%</p>
            <p><strong>Vitesse moyenne :</strong> ${avgSpeed}s / réponse</p>
            ${themesHTML}
        </div>
    `;
    
    document.getElementById('stats-modal').style.display = 'flex';
}

document.getElementById('btn-my-stats').addEventListener('click', () => afficherModaleStats());
document.getElementById('close-stats').addEventListener('click', () => {
    document.getElementById('stats-modal').style.display = 'none';
});

// --- CHARGEMENT QUESTIONS ---
async function chargerQuestions() {
    const querySnapshot = await getDocs(collection(db, "questions"));
    allQuestions = [];
    querySnapshot.forEach((doc) => allQuestions.push(doc.data()));
}

// --- NAVIGATION BASIQUE DES MENUS ---
document.getElementById('btn-vs-menu').addEventListener('click', () => {
    document.getElementById('main-menu').style.display = 'none';
    document.getElementById('vs-lobby').style.display = 'block';
});
document.getElementById('btn-back-menu').addEventListener('click', () => {
    document.getElementById('vs-lobby').style.display = 'none';
    document.getElementById('main-menu').style.display = 'block';
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