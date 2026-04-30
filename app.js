import { initializeApp } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js";
// NOUVEAU : On importe writeBatch et collection pour envoyer les questions en masse
import { getFirestore, doc, setDoc, getDoc, collection, writeBatch } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";

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

const loginBtn = document.getElementById('login-btn');
const userInfo = document.getElementById('user-info');

// Authentification
if (loginBtn) {
    loginBtn.addEventListener('click', () => {
        signInWithPopup(auth, provider).catch(error => console.error("Erreur :", error));
    });
}

onAuthStateChanged(auth, async (user) => {
    if (user) {
        if (loginBtn) loginBtn.style.display = 'none';
        
        userInfo.innerHTML = `
            <img src="${user.photoURL}" alt="Photo de profil" style="width: 80px; border-radius: 50%; border: 3px solid var(--text-orange);">
            <h2>Bienvenue, ${user.displayName}</h2>
            <p id="xp-display">Chargement de l'XP...</p>
        `;

        const userRef = doc(db, "users", user.uid);
        try {
            const userSnap = await getDoc(userRef);
            if (!userSnap.exists()) {
                await setDoc(userRef, { displayName: user.displayName, photoURL: user.photoURL, xp: 0 });
                document.getElementById('xp-display').innerText = "XP: 0";
            } else {
                document.getElementById('xp-display').innerText = `XP: ${userSnap.data().xp}`;
            }
        } catch (error) {
            console.error("Erreur Firestore :", error);
        }
    } else {
        if (loginBtn) loginBtn.style.display = 'inline-block';
        userInfo.innerHTML = '';
    }
});

// --------------------------------------------------------
// SCRIPT TEMPORAIRE D'IMPORTATION DES QUESTIONS
// --------------------------------------------------------
const importBtn = document.getElementById('import-btn');
if (importBtn) {
    importBtn.addEventListener('click', async () => {
        const jsonText = document.getElementById('json-input').value;
        const statusText = document.getElementById('import-status');
        
        if (!jsonText) {
            statusText.innerText = "❌ Le champ est vide !";
            statusText.style.color = "red";
            return;
        }

        try {
            const questions = JSON.parse(jsonText);
            statusText.innerText = "⏳ Importation en cours... Ne ferme pas la page !";
            statusText.style.color = "var(--text-orange)";
            
            let batch = writeBatch(db);
            let count = 0;

            for (const q of questions) {
                const newDocRef = doc(collection(db, "questions"));
                batch.set(newDocRef, q);
                count++;

                // Firebase limite les envois groupés à 500. On envoie par paquets de 400.
                if (count % 400 === 0) {
                    await batch.commit();
                    batch = writeBatch(db); 
                    statusText.innerText = `⏳ Importation : ${count} / ${questions.length}...`;
                }
            }
            
            // On envoie ce qu'il reste
            if (count % 400 !== 0) {
                await batch.commit();
            }
            
            statusText.innerText = `✅ SUCCÈS ! ${count} questions ont été ajoutées à la base de données.`;
            statusText.style.color = "#4CAF50";

        } catch (error) {
            console.error(error);
            statusText.innerText = "❌ Erreur : Le texte copié n'est pas un JSON valide ou un problème de connexion est survenu.";
            statusText.style.color = "red";
        }
    });
}