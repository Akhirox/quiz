import { initializeApp } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js";
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

// Variables
let currentUser = null;
let allQuestions = []; 
let gameQuestions = []; 
let currentQIndex = 0;
let score = 0;
let timerInterval;
let timeLeft = 14;

// Menus
const mainMenu = document.getElementById('main-menu');
const playMenu = document.getElementById('play-menu');
const vsLobby = document.getElementById('vs-lobby');
const gameZone = document.getElementById('game-zone');

// --- PROFIL & DÉCONNEXION ---
function getLevelInfo(totalXp) {
    let level = 1, xpNeeded = 50, currentXp = totalXp;
    while (currentXp >= xpNeeded) {
        currentXp -= xpNeeded; level++; xpNeeded = Math.floor(xpNeeded * 1.5);
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
            const defaultData = { 
                displayName: user.displayName, photoURL: user.photoURL, xp: 0,
                stats: { gamesPlayed: 0, correctAnswers: 0, totalAnswers: 0, totalAnswerTime: 0, themes: {} }
            };
            await setDoc(userRef, defaultData);
            afficherProfil(user, 0);
        } else {
            afficherProfil(user, userSnap.data().xp);
        }
        
        chargerQuestions();
        mainMenu.style.display = 'block';
    } else {
        currentUser = null;
        document.getElementById('login-btn').style.display = 'block';
        document.getElementById('user-info-container').style.display = 'none';
        mainMenu.style.display = 'none';
        playMenu.style.display = 'none';
        vsLobby.style.display = 'none';
        gameZone.style.display = 'none';
    }
});

document.getElementById('login-btn').addEventListener('click', () => signInWithPopup(auth, provider));

// Clic sur l'avatar = Menu de déconnexion
document.getElementById('user-info').addEventListener('click', () => {
    const menu = document.getElementById('logout-menu');
    menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
});

document.getElementById('btn-logout').addEventListener('click', () => {
    signOut(auth).then(() => {
        document.getElementById('logout-menu').style.display = 'none';
    });
});

function afficherProfil(user, totalXp) {
    const lvlInfo = getLevelInfo(totalXp);
    const progressPercent = (lvlInfo.xpInCurrentLevel / lvlInfo.xpNeededForNext) * 100;
    
// Remplace par ton adresse mail Google
if (user.email === "ton-adresse@gmail.com") {
    const adminBtn = document.createElement('button');
    adminBtn.innerText = "🛠️ Admin";
    adminBtn.className = "orange-btn";
    adminBtn.style = "margin-top: 15px; background: #F44336; color: white;";
    adminBtn.onclick = () => window.location.href = "import.html";
    document.getElementById('user-info-container').appendChild(adminBtn);
}

    document.getElementById('user-info').innerHTML = `
        <div style="text-align: right; line-height: 1.2;">
            <div style="font-weight: bold; color: var(--text-orange);">${user.displayName}</div>
            <div style="font-size: 0.8rem; color: #ccc;">Niv ${lvlInfo.level} - ${lvlInfo.xpInCurrentLevel}/${lvlInfo.xpNeededForNext} XP</div>
            <div style="width: 100px; background: #333; height: 5px; border-radius: 3px; margin-top: 3px; margin-left: auto;">
                <div style="width: ${progressPercent}%; background: var(--text-orange); height: 5px; border-radius: 3px;"></div>
            </div>
        </div>
        <img src="${user.photoURL}" style="width: 40px; border-radius: 50%; border: 2px solid var(--text-orange);">
    `;
    document.getElementById('user-info-container').style.display = 'block';
}

// --- NAVIGATION BOUTONS ---
document.getElementById('btn-menu-jouer').addEventListener('click', () => {
    mainMenu.style.display = 'none';
    playMenu.style.display = 'block';
});

document.getElementById('btn-menu-stats').addEventListener('click', () => afficherModaleStats());

document.getElementById('btn-menu-leaderboard').addEventListener('click', () => {
    chargerLeaderboard();
    document.getElementById('leaderboard-modal').style.display = 'flex';
});

document.getElementById('btn-back-to-main').addEventListener('click', () => {
    playMenu.style.display = 'none';
    mainMenu.style.display = 'block';
});

document.getElementById('btn-vs-menu').addEventListener('click', () => {
    playMenu.style.display = 'none';
    vsLobby.style.display = 'block';
});

document.getElementById('btn-back-to-play').addEventListener('click', () => {
    vsLobby.style.display = 'none';
    playMenu.style.display = 'block';
});

document.getElementById('close-stats').addEventListener('click', () => document.getElementById('stats-modal').style.display = 'none');
document.getElementById('close-leaderboard').addEventListener('click', () => document.getElementById('leaderboard-modal').style.display = 'none');

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
        li.addEventListener('click', () => {
            document.getElementById('leaderboard-modal').style.display = 'none';
            afficherModaleStats(data);
        });
        list.appendChild(li);
        rank++;
    });
}

async function afficherModaleStats(userData = null) {
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
            <h2 style="color: var(--text-orange); margin-bottom: 5px;">${userData.displayName}</h2>
            <p><strong>Parties jouées :</strong> ${games}</p>
            <p><strong>Bonnes réponses :</strong> ${winRate}%</p>
            <p><strong>Vitesse moyenne :</strong> ${avgSpeed}s / réponse</p>
            ${themesHTML}
        </div>
    `;
    document.getElementById('stats-modal').style.display = 'flex';
}

async function chargerQuestions() {
    const querySnapshot = await getDocs(collection(db, "questions"));
    allQuestions = [];
    querySnapshot.forEach((doc) => allQuestions.push(doc.data()));
}

// --- CORRECTEUR ORTHOGRAPHIQUE ---
function nettoyerTexte(str) {
    let s = str.trim().toLowerCase();
    s = s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    s = s.replace(/^(le |la |les |l'|l |un |une |des )/, "");
    return s.trim();
}
function levenshteinDistance(a, b) {
    const matrix = [];
    for (let i = 0; i <= b.length; i++) { matrix[i] = [i]; }
    for (let j = 0; j <= a.length; j++) { matrix[0][j] = j; }
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) matrix[i][j] = matrix[i - 1][j - 1];
            else matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
        }
    }
    return matrix[b.length][a.length];
}
function verifierReponse(input, correct) {
    const userNorm = nettoyerTexte(input);
    
    // On coupe la réponse de la BDD à chaque "/" pour créer une liste d'options
    const possiblesAnswers = correct.split('/').map(ans => ans.trim());

    // On boucle pour tester la réponse du joueur contre CHAQUE option
    for (let possibleCorrect of possiblesAnswers) {
        const correctNorm = nettoyerTexte(possibleCorrect);
        
        if (userNorm === correctNorm) return true; // Match parfait
        
        const distance = levenshteinDistance(userNorm, correctNorm);
        const maxLength = Math.max(userNorm.length, correctNorm.length);
        
        if (maxLength > 0) {
            const pourcentageRessemblance = (maxLength - distance) / maxLength;
            // Si une des options valide les 85% de ressemblance, c'est gagné !
            if (pourcentageRessemblance >= 0.85 || distance <= 1) {
                return true;
            }
        }
    }
    
    // Si la boucle se termine, aucune option n'était la bonne
    return false;
}

// --- MOTEUR DE JEU SOLO ---
document.getElementById('btn-solo').addEventListener('click', () => {
    if (allQuestions.length < 10) return alert("Pas assez de questions !");
    gameQuestions = allQuestions.sort(() => 0.5 - Math.random()).slice(0, 10);
    score = 0; currentQIndex = 0;
    playMenu.style.display = 'none';
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
    if (imgEl && q.imageUrl && q.imageUrl !== "") { imgEl.src = q.imageUrl; imgEl.style.display = 'block'; } 
    else if (imgEl) { imgEl.style.display = 'none'; }

    const input = document.getElementById('answer-input');
    input.value = ''; input.disabled = false; input.focus();
    document.getElementById('feedback-msg').innerText = '';
    document.getElementById('submit-answer').style.display = 'inline-block';
    
    timeLeft = 14;
    document.getElementById('timer').innerText = timeLeft;
    document.getElementById('timer').style.color = '#ff3333';
    
    timerInterval = setInterval(() => {
        timeLeft--;
        document.getElementById('timer').innerText = timeLeft;
        if (timeLeft <= 0) traiterReponse(""); 
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
        // On récupère uniquement le premier élément avant le "/"
        const reponsePrincipale = q.answer.split('/')[0].trim();
        feedback.innerText = `❌ Faux ! La réponse était : ${reponsePrincipale}`; 
        feedback.style.color = "#F44336"; 
    }

    setTimeout(passerQuestionSuivante, 2500);
}

document.getElementById('submit-answer').addEventListener('click', () => traiterReponse(document.getElementById('answer-input').value));
document.getElementById('answer-input').addEventListener('keypress', (e) => { if (e.key === 'Enter') traiterReponse(document.getElementById('answer-input').value); });

async function passerQuestionSuivante() {
    currentQIndex++;
    if (currentQIndex < 10) {
        afficherQuestion();
    } else {
        gameZone.style.display = 'none';
        
        // Maj de l'XP
        if (score > 0) {
            const userRef = doc(db, "users", currentUser.uid);
            const userSnap = await getDoc(userRef);
            const newXp = userSnap.data().xp + score;
            await updateDoc(userRef, { xp: newXp });
            afficherProfil(currentUser, newXp);
        }
        
        // Affichage Ecran de fin
        document.getElementById('end-score').innerText = `${score}/10`;
        document.getElementById('end-xp').innerText = `+${score} XP`;
        document.getElementById('end-game-modal').style.display = 'flex';
    }
}

// Boutons écran de fin
document.getElementById('btn-replay').addEventListener('click', () => {
    document.getElementById('end-game-modal').style.display = 'none';
    document.getElementById('btn-solo').click(); // Relance une partie
});
document.getElementById('btn-end-to-menu').addEventListener('click', () => {
    document.getElementById('end-game-modal').style.display = 'none';
    mainMenu.style.display = 'block';
});