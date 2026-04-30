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

// Sons (Libres de droits)
const audioCorrect = new Audio('https://assets.mixkit.co/active_storage/sfx/2000/2000-preview.mp3');
const audioWrong = new Audio('https://assets.mixkit.co/active_storage/sfx/2003/2003-preview.mp3');
audioCorrect.volume = 0.5;
audioWrong.volume = 0.5;

// Variables globales du jeu
let currentUser = null;
let allQuestions = []; 
let gameQuestions = []; 
let currentQIndex = 0;
let score = 0;
let timerInterval;
let timeLeft = 14;
let attemptsLeft = 3;
let isProcessingQuestion = false;

let gameStatsTracker = { correct: 0, totalTime: 0, themes: {} };

const mainMenu = document.getElementById('main-menu');
const playMenu = document.getElementById('play-menu');
const vsLobby = document.getElementById('vs-lobby');
const gameZone = document.getElementById('game-zone');

// --- PROFIL & DÉCONNEXION ---
function getLevelInfo(totalXp) {
    let level = 1, xpNeeded = 50, currentXp = totalXp;
    while (currentXp >= xpNeeded) { currentXp -= xpNeeded; level++; xpNeeded = Math.floor(xpNeeded * 1.5); }
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

        if (user.email === "arnaud.chbk@gmail.com") {
            if (!document.getElementById('btn-admin')) {
                const adminBtn = document.createElement('button');
                adminBtn.id = "btn-admin"; adminBtn.innerText = "🛠️ Admin"; adminBtn.className = "orange-btn";
                adminBtn.style = "margin-top: 15px; background: #F44336; color: white; width: 100%; font-size: 1rem; padding: 5px;";
                adminBtn.onclick = () => window.location.href = "import.html";
                document.getElementById('logout-menu').insertBefore(adminBtn, document.getElementById('btn-logout'));
            }
        }
        chargerQuestions(); mainMenu.style.display = 'block';
    } else {
        currentUser = null;
        document.getElementById('login-btn').style.display = 'block';
        document.getElementById('user-info-container').style.display = 'none';
        mainMenu.style.display = 'none'; playMenu.style.display = 'none';
        vsLobby.style.display = 'none'; gameZone.style.display = 'none';
    }
});

document.getElementById('login-btn').addEventListener('click', () => signInWithPopup(auth, provider));
document.getElementById('user-info').addEventListener('click', () => {
    const menu = document.getElementById('logout-menu');
    menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
});
document.getElementById('btn-logout').addEventListener('click', () => { signOut(auth).then(() => { document.getElementById('logout-menu').style.display = 'none'; }); });

function afficherProfil(user, totalXp) {
    const lvlInfo = getLevelInfo(totalXp);
    const progressPercent = (lvlInfo.xpInCurrentLevel / lvlInfo.xpNeededForNext) * 100;
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

// --- NAVIGATION ---
document.getElementById('btn-menu-jouer').addEventListener('click', () => { mainMenu.style.display = 'none'; playMenu.style.display = 'block'; });
document.getElementById('btn-menu-stats').addEventListener('click', () => afficherModaleStats());
document.getElementById('btn-menu-leaderboard').addEventListener('click', () => { chargerLeaderboard(); document.getElementById('leaderboard-modal').style.display = 'flex'; });
document.getElementById('btn-back-to-main').addEventListener('click', () => { playMenu.style.display = 'none'; mainMenu.style.display = 'block'; });
document.getElementById('btn-vs-menu').addEventListener('click', () => { playMenu.style.display = 'none'; vsLobby.style.display = 'block'; });
document.getElementById('btn-back-to-play').addEventListener('click', () => { vsLobby.style.display = 'none'; playMenu.style.display = 'block'; });
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
        const li = document.createElement('li'); li.className = 'leaderboard-item';
        li.innerHTML = `<span class="leaderboard-rank">#${rank}</span><img src="${data.photoURL}" style="width: 30px; border-radius: 50%;"><span class="leaderboard-name">${data.displayName}</span><span class="leaderboard-xp">${data.xp} XP</span>`;
        li.addEventListener('click', () => { document.getElementById('leaderboard-modal').style.display = 'none'; afficherModaleStats(data); });
        list.appendChild(li); rank++;
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
    
    // CORRECTION DU BUG ICI : On divise le temps total par le nombre TOTAL de questions (et non plus par le nombre de bonnes réponses)
    const avgSpeed = totalAns > 0 ? (time / totalAns).toFixed(1) : 0;

    let themesHTML = '<h4>Top Thèmes</h4><ul style="font-size: 0.9rem; color: #ccc; text-align: left;">';
    if (stats.themes) {
        // Transformation en tableau pour le tri par pourcentage de réussite (décroissant)
        const themesArray = Object.entries(stats.themes)
            .filter(([theme, tData]) => tData.total > 0)
            .map(([theme, tData]) => ({ theme, rate: Math.round((tData.correct / tData.total) * 100) }))
            .sort((a, b) => b.rate - a.rate); // Tri ici !

        for (const t of themesArray) {
            themesHTML += `<li><strong>${t.theme}</strong> : ${t.rate}% de réussite</li>`;
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
    allQuestions = []; querySnapshot.forEach((doc) => allQuestions.push(doc.data()));
}

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
    const possiblesAnswers = correct.split('/').map(ans => ans.trim());
    for (let possibleCorrect of possiblesAnswers) {
        const correctNorm = nettoyerTexte(possibleCorrect);
        if (userNorm === correctNorm) return true;
        const distance = levenshteinDistance(userNorm, correctNorm);
        const maxLength = Math.max(userNorm.length, correctNorm.length);
        if (maxLength > 0 && ((maxLength - distance) / maxLength) >= 0.85 || distance <= 1) return true;
    }
    return false;
}

// --- MOTEUR DE JEU SOLO ---
document.getElementById('btn-solo').addEventListener('click', () => {
    if (allQuestions.length < 10) return alert("Pas assez de questions !");
    gameQuestions = allQuestions.sort(() => 0.5 - Math.random()).slice(0, 10);
    score = 0; currentQIndex = 0;
    gameStatsTracker = { correct: 0, totalTime: 0, themes: {} }; 
    
    playMenu.style.display = 'none';
    gameZone.style.display = 'block';
    
    // Lancer le compte à rebours de 3 secondes
    const overlay = document.getElementById('countdown-overlay');
    const numberEl = document.getElementById('countdown-number');
    overlay.style.display = 'flex';
    
    let count = 3;
    numberEl.innerText = count;
    
    const cInt = setInterval(() => {
        count--;
        if (count > 0) {
            numberEl.innerText = count;
        } else {
            clearInterval(cInt);
            overlay.style.display = 'none';
            afficherQuestion();
        }
    }, 1000);
});

function afficherQuestion() {
    clearInterval(timerInterval);
    isProcessingQuestion = false;
    attemptsLeft = 3;
    
    const q = gameQuestions[currentQIndex];
    document.getElementById('question-counter').innerText = `Question ${currentQIndex + 1}/10`;
    document.getElementById('question-theme').innerText = q.theme;
    document.getElementById('question-text').innerText = q.question;
    
    const imgEl = document.getElementById('question-img');
    if (imgEl && q.imageUrl && q.imageUrl !== "") { imgEl.src = q.imageUrl; imgEl.style.display = 'block'; } 
    else if (imgEl) { imgEl.style.display = 'none'; }

    // Setup input et barre
    const input = document.getElementById('answer-input');
    input.value = ''; input.disabled = false; input.focus();
    document.getElementById('submit-answer').style.display = 'inline-block';
    document.getElementById('feedback-msg').innerText = '';
    
    // Affichage des Cœurs
    document.getElementById('hearts-display').innerText = '❤️❤️❤️';
    
    // Reset de la barre de temps visuelle (sans animation de recul)
    const tBar = document.getElementById('timer-bar');
    tBar.style.transition = 'none';
    tBar.style.width = '100%';
    tBar.style.backgroundColor = '#4CAF50';
    
    setTimeout(() => { tBar.style.transition = 'width 1s linear, background-color 1s linear'; }, 50);

    timeLeft = 14;
    document.getElementById('timer-text').innerText = timeLeft;
    document.getElementById('timer-text').style.color = '#4CAF50';
    
    timerInterval = setInterval(() => {
        timeLeft--;
        document.getElementById('timer-text').innerText = timeLeft;
        
        // Logique de la couleur de la barre
        const percentage = (timeLeft / 14) * 100;
        tBar.style.width = `${percentage}%`;
        
        if (percentage > 50) { tBar.style.backgroundColor = '#4CAF50'; document.getElementById('timer-text').style.color = '#4CAF50'; } 
        else if (percentage > 25) { tBar.style.backgroundColor = '#FF9800'; document.getElementById('timer-text').style.color = '#FF9800'; } 
        else { tBar.style.backgroundColor = '#F44336'; document.getElementById('timer-text').style.color = '#F44336'; }

        if (timeLeft <= 0) traiterReponse(""); 
    }, 1000);
}

function traiterReponse(userAnswer) {
    if (isProcessingQuestion) return; 

    const q = gameQuestions[currentQIndex];
    const isCorrect = verifierReponse(userAnswer, q.answer);
    
    const input = document.getElementById('answer-input');
    const feedback = document.getElementById('feedback-msg');
    
    if (!gameStatsTracker.themes[q.theme]) gameStatsTracker.themes[q.theme] = { correct: 0, total: 0 };

    if (isCorrect) {
        isProcessingQuestion = true;
        clearInterval(timerInterval);
        score++;
        
        audioCorrect.play(); // Son de réussite

        const timeTaken = 14 - timeLeft;
        gameStatsTracker.correct++;
        gameStatsTracker.totalTime += timeTaken;
        gameStatsTracker.themes[q.theme].correct++;
        gameStatsTracker.themes[q.theme].total++;

        input.disabled = true;
        document.getElementById('submit-answer').style.display = 'none';

        feedback.innerText = "✅ Bonne réponse !"; 
        feedback.style.color = "#4CAF50"; 
        setTimeout(passerQuestionSuivante, 2000);
        
    } else {
        attemptsLeft--;
        audioWrong.play(); // Son d'erreur

        if (timeLeft <= 0) attemptsLeft = 0; 

        if (attemptsLeft > 0) {
            // Mise à jour visuelle des cœurs
            document.getElementById('hearts-display').innerText = '❤️'.repeat(attemptsLeft);
            feedback.innerText = `❌ Faux ! Encore une chance...`;
            feedback.style.color = "#FF8C00";
            input.value = ''; input.focus();
        } else {
            isProcessingQuestion = true;
            clearInterval(timerInterval);
            document.getElementById('hearts-display').innerText = ''; // Plus de cœurs
            
            gameStatsTracker.totalTime += 14; 
            gameStatsTracker.themes[q.theme].total++;

            input.disabled = true;
            document.getElementById('submit-answer').style.display = 'none';

            const reponsePrincipale = q.answer.split('/')[0].trim();
            if (timeLeft <= 0) feedback.innerText = `⏰ Temps écoulé ! C'était : ${reponsePrincipale}`;
            else feedback.innerText = `❌ Faux ! La réponse était : ${reponsePrincipale}`;
            
            feedback.style.color = "#F44336"; 
            setTimeout(passerQuestionSuivante, 2500);
        }
    }
}

document.getElementById('submit-answer').addEventListener('click', () => traiterReponse(document.getElementById('answer-input').value));
document.getElementById('answer-input').addEventListener('keypress', (e) => { if (e.key === 'Enter') traiterReponse(document.getElementById('answer-input').value); });

async function passerQuestionSuivante() {
    currentQIndex++;
    if (currentQIndex < 10) {
        afficherQuestion();
    } else {
        gameZone.style.display = 'none';
        
        const userRef = doc(db, "users", currentUser.uid);
        const userSnap = await getDoc(userRef);
        const userData = userSnap.data();
        
        const newXp = userData.xp + score;
        const oldStats = userData.stats || { gamesPlayed: 0, correctAnswers: 0, totalAnswers: 0, totalAnswerTime: 0, themes: {} };
        
        const newStats = {
            gamesPlayed: oldStats.gamesPlayed + 1,
            correctAnswers: oldStats.correctAnswers + gameStatsTracker.correct,
            totalAnswers: oldStats.totalAnswers + 10,
            totalAnswerTime: oldStats.totalAnswerTime + gameStatsTracker.totalTime,
            themes: oldStats.themes || {}
        };

        for (const theme in gameStatsTracker.themes) {
            if (!newStats.themes[theme]) newStats.themes[theme] = { correct: 0, total: 0 };
            newStats.themes[theme].correct += gameStatsTracker.themes[theme].correct;
            newStats.themes[theme].total += gameStatsTracker.themes[theme].total;
        }

        await updateDoc(userRef, { xp: newXp, stats: newStats });
        afficherProfil(currentUser, newXp);
        
        document.getElementById('end-score').innerText = `${score}/10`;
        document.getElementById('end-xp').innerText = `+${score} XP`;
        document.getElementById('end-game-modal').style.display = 'flex';
    }
}

document.getElementById('btn-replay').addEventListener('click', () => { document.getElementById('end-game-modal').style.display = 'none'; document.getElementById('btn-solo').click(); });
document.getElementById('btn-end-to-menu').addEventListener('click', () => { document.getElementById('end-game-modal').style.display = 'none'; mainMenu.style.display = 'block'; });