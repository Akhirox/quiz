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

const audioCorrect = new Audio('https://assets.mixkit.co/active_storage/sfx/2000/2000-preview.mp3');
const audioWrong = new Audio('https://assets.mixkit.co/active_storage/sfx/2003/2003-preview.mp3');
audioCorrect.volume = 0.5; audioWrong.volume = 0.5;

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

// Variables Multi
let peer = null;
let peerConn = null; 
let peerConnections = []; 
let isHost = false;
let isMultiplayer = false;
let lobbyPlayers = []; 
let multiGameState = {}; // État de tous les joueurs pour la question en cours

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
            const defaultData = { displayName: user.displayName, photoURL: user.photoURL, xp: 0, stats: { gamesPlayed: 0, correctAnswers: 0, totalAnswers: 0, totalAnswerTime: 0, themes: {} }};
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
document.getElementById('user-info').addEventListener('click', () => { const menu = document.getElementById('logout-menu'); menu.style.display = menu.style.display === 'none' ? 'block' : 'none'; });
document.getElementById('btn-logout').addEventListener('click', () => { signOut(auth).then(() => { document.getElementById('logout-menu').style.display = 'none'; }); });

function afficherProfil(user, totalXp) {
    const lvlInfo = getLevelInfo(totalXp);
    const progressPercent = (lvlInfo.xpInCurrentLevel / lvlInfo.xpNeededForNext) * 100;
    document.getElementById('user-info').innerHTML = `
        <div style="text-align: right; line-height: 1.2;">
            <div style="font-weight: bold; color: var(--text-orange);">${user.displayName}</div>
            <div style="font-size: 0.8rem; color: #ccc;">Niv ${lvlInfo.level} - ${lvlInfo.xpInCurrentLevel}/${lvlInfo.xpNeededForNext} XP</div>
            <div style="width: 100px; background: #333; height: 5px; border-radius: 3px; margin-top: 3px; margin-left: auto;"><div style="width: ${progressPercent}%; background: var(--text-orange); height: 5px; border-radius: 3px;"></div></div>
        </div>
        <img src="${user.photoURL}" style="width: 40px; border-radius: 50%; border: 2px solid var(--text-orange);">
    `;
    document.getElementById('user-info-container').style.display = 'block';
}

// --- NAVIGATION & UI ---
document.getElementById('btn-menu-jouer').addEventListener('click', () => { mainMenu.style.display = 'none'; playMenu.style.display = 'block'; });
document.getElementById('btn-menu-stats').addEventListener('click', () => afficherModaleStats());
document.getElementById('btn-menu-leaderboard').addEventListener('click', () => { chargerLeaderboard(); document.getElementById('leaderboard-modal').style.display = 'flex'; });
document.getElementById('btn-back-to-main').addEventListener('click', () => { playMenu.style.display = 'none'; mainMenu.style.display = 'block'; });
document.getElementById('btn-vs-menu').addEventListener('click', () => { playMenu.style.display = 'none'; vsLobby.style.display = 'block'; });
document.getElementById('close-stats').addEventListener('click', () => document.getElementById('stats-modal').style.display = 'none');
document.getElementById('close-leaderboard').addEventListener('click', () => document.getElementById('leaderboard-modal').style.display = 'none');

document.getElementById('btn-back-to-play').addEventListener('click', () => { 
    if (peer) peer.destroy(); 
    peer = null; peerConn = null; peerConnections = []; lobbyPlayers = [];
    document.getElementById('room-buttons').style.display = 'flex';
    document.getElementById('waiting-room').style.display = 'none';
    vsLobby.style.display = 'none'; playMenu.style.display = 'block'; 
});

async function chargerLeaderboard() {
    const q = query(collection(db, "users"), orderBy("xp", "desc"), limit(10));
    const querySnapshot = await getDocs(q);
    const list = document.getElementById('leaderboard-list'); list.innerHTML = ''; let rank = 1;
    querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const li = document.createElement('li'); li.className = 'leaderboard-item';
        li.innerHTML = `<span class="leaderboard-rank">#${rank}</span><img src="${data.photoURL}" style="width: 30px; border-radius: 50%;"><span class="leaderboard-name">${data.displayName}</span><span class="leaderboard-xp">${data.xp} XP</span>`;
        li.addEventListener('click', () => { document.getElementById('leaderboard-modal').style.display = 'none'; afficherModaleStats(data); });
        list.appendChild(li); rank++;
    });
}

async function afficherModaleStats(userData = null) {
    if (!userData) { const docSnap = await getDoc(doc(db, "users", currentUser.uid)); userData = docSnap.data(); }
    const stats = userData.stats || {};
    const games = stats.gamesPlayed || 0; const correct = stats.correctAnswers || 0; const totalAns = stats.totalAnswers || 0; const time = stats.totalAnswerTime || 0;
    const winRate = totalAns > 0 ? Math.round((correct / totalAns) * 100) : 0;
    const avgSpeed = totalAns > 0 ? (time / totalAns).toFixed(1) : 0;
    let themesHTML = '<h4>Top Thèmes</h4><ul style="font-size: 0.9rem; color: #ccc; text-align: left;">';
    if (stats.themes) {
        const themesArray = Object.entries(stats.themes).filter(([theme, tData]) => tData.total > 0).map(([theme, tData]) => ({ theme, rate: Math.round((tData.correct / tData.total) * 100) })).sort((a, b) => b.rate - a.rate);
        for (const t of themesArray) { themesHTML += `<li><strong>${t.theme}</strong> : ${t.rate}% de réussite</li>`; }
    }
    themesHTML += '</ul>';
    document.getElementById('stats-content').innerHTML = `<div style="text-align: center;"><img src="${userData.photoURL}" style="width: 80px; border-radius: 50%; border: 3px solid var(--text-orange);"><h2 style="color: var(--text-orange); margin-bottom: 5px;">${userData.displayName}</h2><p><strong>Parties jouées :</strong> ${games}</p><p><strong>Bonnes réponses :</strong> ${winRate}%</p><p><strong>Vitesse moyenne :</strong> ${avgSpeed}s / réponse</p>${themesHTML}</div>`;
    document.getElementById('stats-modal').style.display = 'flex';
}

async function chargerQuestions() {
    const querySnapshot = await getDocs(collection(db, "questions"));
    allQuestions = []; querySnapshot.forEach((doc) => allQuestions.push(doc.data()));
}

// --- CORRECTEUR ---
function nettoyerTexte(str) { return str.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/^(le |la |les |l'|l |un |une |des )/, "").trim(); }
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

// --- LOGIQUE MULTIJOUEUR PEERJS ---
document.querySelectorAll('.room-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const roomID = `chbk-quiz-room-${e.target.getAttribute('data-room')}`;
        rejoindreOuCreerSalle(roomID);
    });
});

function rejoindreOuCreerSalle(roomID) {
    document.getElementById('room-buttons').style.display = 'none';
    document.getElementById('waiting-room').style.display = 'block';
    document.getElementById('waiting-msg').innerText = "Vérification de la salle...";
    document.getElementById('btn-start-vs').style.display = 'none';

    peer = new Peer(roomID);
    peer.on('open', () => {
        isHost = true; isMultiplayer = true; peerConnections = [];
        lobbyPlayers = [{ uid: currentUser.uid, name: currentUser.displayName }];
        majLobbyUI();
        document.getElementById('btn-start-vs').style.display = 'block';

        peer.on('connection', (conn) => {
            if (peerConnections.length >= 9) { conn.send({ type: 'LOBBY_FULL' }); setTimeout(() => conn.close(), 500); return; }
            peerConnections.push(conn);
            conn.on('data', (data) => {
                if (data.type === 'PLAYER_INFO') {
                    lobbyPlayers.push({ uid: data.uid, name: data.name, connId: conn.peer });
                    majLobbyUI(); diffuserLobby();
                } else if (data.type === 'PLAYER_UPDATE') {
                    // L'hôte reçoit une réponse d'un invité
                    gererMajJoueur(data);
                }
            });
            conn.on('close', () => {
                peerConnections = peerConnections.filter(c => c.peer !== conn.peer);
                lobbyPlayers = lobbyPlayers.filter(p => p.connId !== conn.peer);
                majLobbyUI(); diffuserLobby();
            });
        });
    });

    peer.on('error', (err) => {
        if (err.type === 'unavailable-id') {
            peer = new Peer(); 
            peer.on('open', () => {
                isHost = false; isMultiplayer = true;
                peerConn = peer.connect(roomID);
                peerConn.on('open', () => { peerConn.send({ type: 'PLAYER_INFO', uid: currentUser.uid, name: currentUser.displayName }); });
                peerConn.on('data', (data) => {
                    if (data.type === 'LOBBY_UPDATE') { lobbyPlayers = data.players; majLobbyUI(); } 
                    else if (data.type === 'LOBBY_FULL') { alert("Salle pleine !"); document.getElementById('btn-back-to-play').click(); } 
                    else if (data.type === 'START_GAME') { gameQuestions = data.questions; initMultiGameState(); lancerCompteARebours(); }
                    else if (data.type === 'SYNC_SCOREBOARD') { multiGameState = data.state; updateScoreboardUI(); }
                    else if (data.type === 'END_QUESTION') { multiGameState = data.state; afficherRecapMulti(data.correctAnswer); }
                    else if (data.type === 'NEXT_QUESTION') { currentQIndex++; afficherQuestion(); }
                });
            });
        }
    });
}

function majLobbyUI() {
    document.getElementById('players-count').innerText = `${lobbyPlayers.length}/10`;
    const list = document.getElementById('players-list'); list.innerHTML = '';
    lobbyPlayers.forEach(p => {
        const li = document.createElement('li'); li.innerText = (p.uid === currentUser.uid) ? `${p.name} (Toi)` : p.name;
        if (p.uid === lobbyPlayers[0].uid) li.innerText += " 👑";
        list.appendChild(li);
    });
    document.getElementById('waiting-msg').innerText = isHost ? "Tu es l'Hôte. Lance quand tu veux !" : "En attente de l'Hôte...";
}
function diffuserLobby() { if (isHost) peerConnections.forEach(conn => conn.send({ type: 'LOBBY_UPDATE', players: lobbyPlayers })); }

document.getElementById('btn-start-vs').addEventListener('click', () => {
    if (!isHost) return;
    if (lobbyPlayers.length < 2) return alert("Il faut au moins 2 joueurs !");
    gameQuestions = allQuestions.sort(() => 0.5 - Math.random()).slice(0, 10);
    peerConnections.forEach(conn => conn.send({ type: 'START_GAME', questions: gameQuestions }));
    initMultiGameState();
    lancerCompteARebours();
});

function initMultiGameState() {
    multiGameState = {};
    lobbyPlayers.forEach(p => {
        multiGameState[p.uid] = { name: p.name, score: 0, status: 'playing', lives: 3, lastAnswer: '', pointsGained: 0 };
    });
}

// --- MOTEUR DE JEU (SOLO & MULTI) ---
document.getElementById('btn-solo').addEventListener('click', () => {
    if (allQuestions.length < 10) return alert("Pas assez de questions !");
    gameQuestions = allQuestions.sort(() => 0.5 - Math.random()).slice(0, 10);
    isMultiplayer = false;
    score = 0; currentQIndex = 0;
    gameStatsTracker = { correct: 0, totalTime: 0, themes: {} }; 
    lancerCompteARebours();
});

function lancerCompteARebours(texte = "Préparez-vous...", duree = 3) {
    playMenu.style.display = 'none'; vsLobby.style.display = 'none'; gameZone.style.display = 'block';
    
    // Gère l'affichage du scoreboard Multi
    if (isMultiplayer) {
        document.getElementById('multiplayer-board').style.display = 'block';
        updateScoreboardUI();
    } else {
        document.getElementById('multiplayer-board').style.display = 'none';
    }

    const overlay = document.getElementById('countdown-overlay');
    const numberEl = document.getElementById('countdown-number');
    document.getElementById('countdown-text').innerText = texte;
    overlay.style.display = 'flex';
    
    let count = duree; numberEl.innerText = count;
    const cInt = setInterval(() => {
        count--;
        if (count > 0) { numberEl.innerText = count; } 
        else { clearInterval(cInt); overlay.style.display = 'none'; afficherQuestion(); }
    }, 1000);
}

function updateScoreboardUI() {
    const list = document.getElementById('multiplayer-list');
    list.innerHTML = '';
    // Trie par score décroissant
    const players = Object.values(multiGameState).sort((a, b) => b.score - a.score);
    
    players.forEach(p => {
        let statusIcon = '';
        if (p.status === 'correct') statusIcon = '✅';
        else if (p.status === 'out') statusIcon = '❌';
        
        let livesStr = '❤️'.repeat(p.lives);
        
        const div = document.createElement('div');
        div.className = 'player-live-card';
        div.innerHTML = `<span>${p.name} : ${p.score} pts</span> <span style="font-size: 0.8rem;">${livesStr}</span> <span>${statusIcon}</span>`;
        list.appendChild(div);
    });
}

function afficherQuestion() {
    clearInterval(timerInterval);
    isProcessingQuestion = false;
    attemptsLeft = 3;
    
    // Reset status Multi
    if (isMultiplayer) {
        for (let uid in multiGameState) {
            multiGameState[uid].status = 'playing';
            multiGameState[uid].lives = 3;
            multiGameState[uid].lastAnswer = '';
            multiGameState[uid].pointsGained = 0;
        }
        updateScoreboardUI();
    }
    
    const q = gameQuestions[currentQIndex];
    document.getElementById('question-counter').innerText = `Question ${currentQIndex + 1}/10`;
    document.getElementById('question-theme').innerText = q.theme;
    document.getElementById('question-text').innerText = q.question;
    
    const imgEl = document.getElementById('question-img');
    if (imgEl && q.imageUrl && q.imageUrl !== "") { imgEl.src = q.imageUrl; imgEl.style.display = 'block'; } 
    else if (imgEl) { imgEl.style.display = 'none'; }

    const input = document.getElementById('answer-input');
    input.value = ''; input.disabled = false; input.focus();
    document.getElementById('submit-answer').style.display = 'inline-block';
    document.getElementById('feedback-msg').innerText = '';
    document.getElementById('hearts-display').innerText = '❤️❤️❤️';
    
    const tBar = document.getElementById('timer-bar');
    tBar.style.transition = 'none'; tBar.style.width = '100%'; tBar.style.backgroundColor = '#4CAF50';
    setTimeout(() => { tBar.style.transition = 'width 1s linear, background-color 1s linear'; }, 50);

    timeLeft = 14;
    document.getElementById('timer-text').innerText = timeLeft;
    document.getElementById('timer-text').style.color = '#4CAF50';
    
    // Seul l'hôte gère la vraie fin de chrono en multi pour éviter les désync
    timerInterval = setInterval(() => {
        timeLeft--;
        document.getElementById('timer-text').innerText = timeLeft;
        const percentage = (timeLeft / 14) * 100;
        tBar.style.width = `${percentage}%`;
        
        if (percentage > 50) { tBar.style.backgroundColor = '#4CAF50'; document.getElementById('timer-text').style.color = '#4CAF50'; } 
        else if (percentage > 25) { tBar.style.backgroundColor = '#FF9800'; document.getElementById('timer-text').style.color = '#FF9800'; } 
        else { tBar.style.backgroundColor = '#F44336'; document.getElementById('timer-text').style.color = '#F44336'; }

        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            if (!isMultiplayer) traiterReponse(""); // Solo: force fin
            else if (isHost) checkFinDeQuestionMulti(); // Multi: Hôte force fin
        }
    }, 1000);
}

function traiterReponse(userAnswer) {
    if (isProcessingQuestion) return; 
    const q = gameQuestions[currentQIndex];
    const isCorrect = verifierReponse(userAnswer, q.answer);
    const input = document.getElementById('answer-input');
    
    // --- MODE SOLO ---
    if (!isMultiplayer) {
        if (!gameStatsTracker.themes[q.theme]) gameStatsTracker.themes[q.theme] = { correct: 0, total: 0 };

        if (isCorrect) {
            isProcessingQuestion = true; clearInterval(timerInterval);
            score += timeLeft; // Gain basique en solo
            audioCorrect.play(); 
            gameStatsTracker.correct++; gameStatsTracker.totalTime += (14 - timeLeft); gameStatsTracker.themes[q.theme].correct++; gameStatsTracker.themes[q.theme].total++;
            input.disabled = true; document.getElementById('submit-answer').style.display = 'none';
            document.getElementById('feedback-msg').innerText = "✅ Bonne réponse !"; document.getElementById('feedback-msg').style.color = "#4CAF50"; 
            setTimeout(passerQuestionSuivante, 2000);
        } else {
            attemptsLeft--; audioWrong.play(); 
            if (timeLeft <= 0) attemptsLeft = 0; 
            if (attemptsLeft > 0) {
                document.getElementById('hearts-display').innerText = '❤️'.repeat(attemptsLeft);
                document.getElementById('feedback-msg').innerText = `❌ Faux ! Encore une chance...`; document.getElementById('feedback-msg').style.color = "#FF8C00";
                input.value = ''; input.focus();
            } else {
                isProcessingQuestion = true; clearInterval(timerInterval);
                document.getElementById('hearts-display').innerText = '💔';
                gameStatsTracker.totalTime += 14; gameStatsTracker.themes[q.theme].total++;
                input.disabled = true; document.getElementById('submit-answer').style.display = 'none';
                const rep = q.answer.split('/')[0].trim();
                document.getElementById('feedback-msg').innerText = timeLeft <= 0 ? `⏰ Temps écoulé ! C'était : ${rep}` : `❌ Faux ! La réponse était : ${rep}`;
                document.getElementById('feedback-msg').style.color = "#F44336"; 
                setTimeout(passerQuestionSuivante, 2500);
            }
        }
    } 
    // --- MODE MULTIJOUEUR ---
    else {
        if (isCorrect) {
            isProcessingQuestion = true;
            input.disabled = true; document.getElementById('submit-answer').style.display = 'none';
            document.getElementById('feedback-msg').innerText = "✅ En attente des autres..."; document.getElementById('feedback-msg').style.color = "#4CAF50";
            audioCorrect.play();
            envoyerStatutHost('correct', attemptsLeft, userAnswer, timeLeft);
        } else {
            attemptsLeft--; audioWrong.play();
            if (attemptsLeft > 0) {
                document.getElementById('hearts-display').innerText = '❤️'.repeat(attemptsLeft);
                document.getElementById('feedback-msg').innerText = `❌ Faux ! Encore une chance...`; document.getElementById('feedback-msg').style.color = "#FF8C00";
                input.value = ''; input.focus();
                envoyerStatutHost('playing', attemptsLeft, userAnswer, timeLeft);
            } else {
                isProcessingQuestion = true;
                document.getElementById('hearts-display').innerText = '💔';
                input.disabled = true; document.getElementById('submit-answer').style.display = 'none';
                document.getElementById('feedback-msg').innerText = "❌ Dommage ! En attente des autres..."; document.getElementById('feedback-msg').style.color = "#F44336";
                envoyerStatutHost('out', 0, userAnswer, timeLeft);
            }
        }
    }
}

document.getElementById('submit-answer').addEventListener('click', () => traiterReponse(document.getElementById('answer-input').value));
document.getElementById('answer-input').addEventListener('keypress', (e) => { if (e.key === 'Enter') traiterReponse(document.getElementById('answer-input').value); });

// --- L'HÔTE GÈRE LA SYNCHRONISATION MULTI ---
function envoyerStatutHost(status, lives, answer, tLeft) {
    const data = { type: 'PLAYER_UPDATE', uid: currentUser.uid, status, lives, answer, timeLeft: tLeft };
    if (isHost) gererMajJoueur(data); // L'hôte se gère lui-même
    else peerConn.send(data); // L'invité envoie à l'hôte
}

function gererMajJoueur(data) {
    if (!isHost) return;
    const p = multiGameState[data.uid];
    p.status = data.status; p.lives = data.lives; p.lastAnswer = data.answer;
    if (data.status === 'correct') p.timeLeftWhenCorrect = data.timeLeft;
    
    // Broadcast le scoreboard mis à jour
    updateScoreboardUI();
    peerConnections.forEach(conn => conn.send({ type: 'SYNC_SCOREBOARD', state: multiGameState }));
    
    checkFinDeQuestionMulti();
}

function checkFinDeQuestionMulti() {
    if (!isHost) return;
    let toutLeMondeFini = true;
    for (let uid in multiGameState) {
        if (multiGameState[uid].status === 'playing') toutLeMondeFini = false;
    }
    
    // Si tout le monde a répondu ou temps écoulé
    if (toutLeMondeFini || timeLeft <= 0) {
        clearInterval(timerInterval);
        
        // Calcul des points (Temps restant + Bonus Rapidité)
        let correctPlayers = [];
        for (let uid in multiGameState) {
            if (multiGameState[uid].status === 'correct') correctPlayers.push(multiGameState[uid]);
        }
        // Tri par temps restant (le plus grand en premier)
        correctPlayers.sort((a, b) => b.timeLeftWhenCorrect - a.timeLeftWhenCorrect);
        
        const totalP = Object.keys(multiGameState).length;
        correctPlayers.forEach((p, index) => {
            const speedBonus = totalP - (index + 1);
            p.pointsGained = p.timeLeftWhenCorrect + speedBonus;
            p.score += p.pointsGained;
        });

        const correctAns = gameQuestions[currentQIndex].answer.split('/')[0].trim();
        
        // Affiche pour l'Hôte et diffuse aux Invités
        afficherRecapMulti(correctAns);
        peerConnections.forEach(conn => conn.send({ type: 'END_QUESTION', state: multiGameState, correctAnswer: correctAns }));
    }
}

// Affiche l'écran de récapitulatif pour tous (5 secondes)
function afficherRecapMulti(correctAnswer) {
    clearInterval(timerInterval); // Sécurité
    updateScoreboardUI(); // Maj finale des scores
    
    const overlay = document.getElementById('recap-overlay');
    document.getElementById('recap-correct-answer').innerText = `Réponse : ${correctAnswer}`;
    
    const list = document.getElementById('recap-list');
    list.innerHTML = '';
    
    for (let uid in multiGameState) {
        const p = multiGameState[uid];
        const li = document.createElement('li');
        li.className = 'recap-item';
        let ptsText = p.status === 'correct' ? `<span style="color:#4CAF50;">+${p.pointsGained} pts</span>` : `<span style="color:#F44336;">0 pts</span>`;
        let ansText = p.lastAnswer ? `"${p.lastAnswer}"` : `<em>Temps écoulé</em>`;
        li.innerHTML = `<span><strong>${p.name}</strong> : ${ansText}</span> ${ptsText}`;
        list.appendChild(li);
    }
    
    overlay.style.display = 'flex';
    
    // L'hôte déclenche la suite après 5s
    if (isHost) {
        setTimeout(() => {
            overlay.style.display = 'none';
            currentQIndex++;
            if (currentQIndex < 10) {
                peerConnections.forEach(conn => conn.send({ type: 'NEXT_QUESTION' }));
                lancerCompteARebours("Question suivante...", 2);
            } else {
                finDePartieLogic(); // Score final
            }
        }, 5000);
    } else {
        // L'invité cache juste la modale après 5s et attend l'ordre de l'Hôte
        setTimeout(() => { overlay.style.display = 'none'; }, 5000);
    }
}

// --- FIN DE PARTIE ---
async function passerQuestionSuivante() {
    currentQIndex++;
    if (currentQIndex < 10) {
        afficherQuestion();
    } else {
        finDePartieLogic();
    }
}

async function finDePartieLogic() {
    gameZone.style.display = 'none';
    const userRef = doc(db, "users", currentUser.uid);
    const userSnap = await getDoc(userRef);
    const userData = userSnap.data();
    
    // En Multi, on prend le score du tableau, en solo le score local
    let finalScore = isMultiplayer ? multiGameState[currentUser.uid].score : score;
    
    const newXp = userData.xp + finalScore;
    
    // Mise à jour de l'XP sans toucher aux stats avancées pour éviter un bug temporaire
    await updateDoc(userRef, { xp: newXp });
    afficherProfil(currentUser, newXp);
    
    document.getElementById('end-score').innerText = isMultiplayer ? `${finalScore} pts` : `${finalScore}/10`;
    document.getElementById('end-xp').innerText = `+${finalScore} XP`;
    document.getElementById('end-game-modal').style.display = 'flex';
    
    if (peer) peer.destroy(); 
    peer = null; peerConn = null; peerConnections = []; lobbyPlayers = [];
}

document.getElementById('btn-replay').addEventListener('click', () => { document.getElementById('end-game-modal').style.display = 'none'; document.getElementById('btn-solo').click(); });
document.getElementById('btn-end-to-menu').addEventListener('click', () => { document.getElementById('end-game-modal').style.display = 'none'; mainMenu.style.display = 'block'; });