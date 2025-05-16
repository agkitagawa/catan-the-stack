/**
 * @author Anna Kitagawa
 * Catan: The Stack
 * Ditch Day 2025
 */
"use strict";

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import {
    getFirestore,
    doc,
    getDoc,
    collection,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    onSnapshot,
    writeBatch,
    setDoc
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyAf2p5Vcgq2Ui9h7n--y-dyWn8SIBQ-8Mk",
    authDomain: "catan-the-stack.firebaseapp.com",
    projectId: "catan-the-stack",
    storageBucket: "catan-the-stack.firebasestorage.app",
    messagingSenderId: "920727902137",
    appId: "1:920727902137:web:86981ce289406cca27c868",
    measurementId: "G-266KC9B2PC"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

let teamColor = "";
const seniorRole = "Senior";
let teamResources = {};
let isSenior = false;
let authCheckComplete = false;
const gameStateCol = collection(db, "game_state");
let isGameActive = false;

let initialHash = "";

function capitalize(word) {
    return word.charAt(0).toUpperCase() + word.slice(1);
}

window.addEventListener("DOMContentLoaded", function () {
    initialHash = location.hash.substring(1);

    if (initialHash && initialHash !== "login" && initialHash !== "loading") {
        sessionStorage.setItem("initialHash", initialHash);
    }
});

const auth = getAuth();

window.addEventListener("hashchange", function () {
    if (auth.currentUser || localStorage.getItem("loggedIn") === "true") {
        const currentPage = location.hash.substring(1);
        if (currentPage && currentPage !== "login" && currentPage !== "loading") {
            localStorage.setItem("currentPage", currentPage);
        }
    }
});

window.addEventListener("load", function () {
    const isLoggedIn = auth.currentUser || localStorage.getItem("loggedIn") === "true";
    const currentHash = location.hash.substring(1);
    const savedPage = localStorage.getItem("currentPage");

    if (isLoggedIn) {
        if ((!currentHash || currentHash === "home") && savedPage) {
            localStorage.setItem("pageToRestore", savedPage);
        }
    }
});

onAuthStateChanged(auth, (user) => {
    authCheckComplete = true;

    if (user) {
        console.log("User is logged in:", user.email);
        localStorage.setItem("loggedIn", "true");
        showPage("loading", false);

        loadTeamData(user.uid).then(() => {
            teamColor = localStorage.getItem("teamColor") || "";
            isSenior = localStorage.getItem("isSenior") === "true";

            if (isSenior) {
                addManageGameToSenior();
            }
            setupAfterLogin();
            getAllResources();

            const storedInitialHash = sessionStorage.getItem("initialHash");
            const currentHash = location.hash.substring(1);

            if (storedInitialHash && storedInitialHash !== "login" && storedInitialHash !== "loading") {

                showPage(storedInitialHash, false);
                history.replaceState({ pageId: storedInitialHash }, "", `#${storedInitialHash}`);
                sessionStorage.removeItem("initialHash");
            }
            else if (currentHash && currentHash !== "login" && currentHash !== "loading") {

                showPage(currentHash, false);
            }
            else {
                const savedPage = localStorage.getItem("currentPage");
                if (savedPage && savedPage !== "login" && savedPage !== "loading") {

                    showPage(savedPage, false);
                    history.replaceState({ pageId: savedPage }, "", `#${savedPage}`);
                } else {
                    console.log("No saved page, defaulting to home");
                    showPage("home", false);
                    history.replaceState({ pageId: "home" }, "", "#home");
                }
            }
        }).catch(err => {
            console.error("Error loading team data:", err);
            displayMessage("Error loading user data");
            showPage("login", false);
        });
    } else {
        console.log("No user is logged in");
        localStorage.removeItem("loggedIn");
        sessionStorage.removeItem("initialHash");
        teamColor = "";
        isSenior = false;
        teamResources = {};

        showPage("login", false);
        history.replaceState({ pageId: "login" }, "", "#login");
    }
});

function setupNavigationGuards() {
    window.addEventListener("hashchange", () => {
        const user = auth.currentUser;
        const isLoggedInFromStorage = localStorage.getItem("loggedIn") === "true";

        if (!user && !isLoggedInFromStorage && location.hash !== "#login") {
            history.replaceState({ pageId: "login" }, "", "#login");
            showPage("login", false);
        }
    });
}

function showPage(pageId, pushState = true) {
    if (pageId === "loading") {
        const pages = document.querySelectorAll(".page");
        pages.forEach(page => page.classList.add("hidden"));
        const loadingPage = document.querySelector("#loading");
        if (loadingPage) {
            loadingPage.classList.remove("hidden");
        }

        const nav = qs("nav");
        if (nav) nav.classList.add("hidden");

        return;
    }

    const user = auth.currentUser;
    const isLoggedInFromStorage = localStorage.getItem("loggedIn") === "true";

    if (!user && !isLoggedInFromStorage && pageId !== "login" && authCheckComplete) {
        pageId = "login";
        history.replaceState({ pageId }, "", `#${pageId}`);
    }

    const pages = document.querySelectorAll(".page");
    pages.forEach(page => page.classList.add("hidden"));

    const nav = qs("nav");
    if (pageId === "login") {
        if (nav) nav.classList.add("hidden");
    } else {
        if (nav) nav.classList.remove("hidden");
    }

    const page = document.querySelector(`#${pageId}`);
    if (page) {
        page.classList.remove("hidden");

        if (pushState && location.hash.substring(1) !== pageId) {
            history.pushState({ pageId }, "", `#${pageId}`);
        }

        if (pageId !== "login" && pageId !== "loading") {
            localStorage.setItem("currentPage", pageId);
        }

        populatePageContent(pageId);
    }
}

function populatePageContent(pageId) {
    switch (pageId) {
        case "home":
            getAllResources();
            const leaderboardTimestamp = qs("#leaderboard-last-updated");
            if (leaderboardTimestamp) {
                leaderboardTimestamp.textContent = `Last updated: ${new Date().toLocaleTimeString()}`;
            }
            break;

        case "personal-hand":
            showPersonalHand();
            break;

        case "notifications":
            const notificationPanel = qs("#notification-panel");
            if (notificationPanel) {
                notificationPanel.innerHTML = "<p>Loading notifications...</p>";
            }

            const notificationsTimestamp = qs("#notifications-last-updated");
            if (notificationsTimestamp) {
                notificationsTimestamp.textContent = `Last updated: ${new Date().toLocaleTimeString()}`;
            }

            addClearAllButton();

            (async () => {
                try {
                    const q = query(
                        notificationsCol,
                        where("team", "==", teamColor),
                        orderBy("timestamp", "desc")
                    );

                    const snapshot = await getDocs(q);

                    if (snapshot.empty) {
                        if (notificationPanel) {
                            notificationPanel.innerHTML = "<p>No notifications.</p>";
                        }
                        return;
                    }

                    const notifications = [];
                    snapshot.forEach((docSnap) => {
                        notifications.push({
                            id: docSnap.id,
                            ...docSnap.data()
                        });
                    });

                    renderNotifications(notificationPanel, notifications);

                } catch (error) {
                    console.error("Error fetching notifications:", error);
                    if (notificationPanel) {
                        notificationPanel.innerHTML = "<p>Error loading notifications. Please try again later.</p>";
                    }
                    displayMessage("Error loading notifications");
                }
            })();
            break;

        case "manage-trades":
            const tradeRequestsTimestamp = qs("#trade-requests-last-updated");
            if (tradeRequestsTimestamp) {
                tradeRequestsTimestamp.textContent = `Last updated: ${new Date().toLocaleTimeString()}`;
            }

            listenForIncomingTrades();
            break;

        case "senior-see-hands":
            getAllHands();
            break;

        case "use-robber":
            populateRobberTargetDropdown();
            break;

        case "senior-manage-game":
            checkGameActive();
            setTimeout(() => {
                setupSimplifiedEndGame();
            }, 100);

            (async () => {
                try {
                    const gameStateRef = doc(db, "game_state", "current");
                    const gameStateDoc = await getDoc(gameStateRef);

                    if (gameStateDoc.exists() && !gameStateDoc.data().active) {
                        const data = gameStateDoc.data();
                        if (data.winners && data.winners.length > 0) {
                            const statusMessage = qs("#game-status-message");
                            if (statusMessage) {
                                const isTie = data.isTie || data.winners.length > 1;
                                let winnerText = "";

                                if (isTie) {
                                    const winnerNames = data.winners.map(w => capitalize(w)).join(" and ");
                                    winnerText = `Game Over! It's a tie between ${winnerNames} teams!`;
                                } else {
                                    const winnerName = capitalize(data.winners[0]);
                                    winnerText = `Game Over! ${winnerName} Team Wins!`;
                                }

                                statusMessage.innerHTML = `<strong>${winnerText}</strong><br>Click "Start New Game" to begin a new game.`;
                                statusMessage.className = "inactive";
                            }
                        }
                    }
                } catch (err) {
                    console.error("Error checking game winners:", err);
                }
            })();
            break;

        default:
            break;
    }
}

showPage("loading", false);
setupNavigationGuards();

onAuthStateChanged(auth, (user) => {
    authCheckComplete = true;

    if (user) {
        console.log("User is logged in:", user.email);
        localStorage.setItem("loggedIn", "true");

        showPage("loading", false);

        loadTeamData(user.uid).then(() => {
            teamColor = localStorage.getItem("teamColor") || "";
            isSenior = localStorage.getItem("isSenior") === "true";

            if (isSenior) {
                setupAfterLogin();
                getAllResources();
            } else {
                setupAfterLogin();
                getAllResources();
            }

            const currentHash = location.hash.substring(1);
            if (currentHash && currentHash !== "login" && currentHash !== "loading") {
                showPage(currentHash, false);
            } else {
                const savedPage = localStorage.getItem("currentPage");
                if (savedPage && savedPage !== "login" && savedPage !== "loading") {
                    showPage(savedPage, false);
                    history.replaceState({ pageId: savedPage }, "", `#${savedPage}`);
                } else {
                    console.log("No saved page, defaulting to home");
                    showPage("home", false);
                    history.replaceState({ pageId: "home" }, "", "#home");
                }
            }
        }).catch(err => {
            console.error("Error loading team data:", err);
            displayMessage("Error loading user data");
            showPage("login", false);
        });
    } else {
        console.log("No user is logged in");
        localStorage.removeItem("loggedIn");
        teamColor = "";
        isSenior = false;
        teamResources = {};

        showPage("login", false);
        history.replaceState({ pageId: "login" }, "", "#login");
    }
});

const tradeRequestsCol = collection(db, "trade_requests");
const notificationsCol = collection(db, "notifications");
const recentNotifications = new Map();

async function addNotification(team, message) {
    if (typeof message !== "string" || !message.trim()) {
        console.error("Invalid notification message:", message);
        return;
    }

    const notificationKey = `${team}-${message}`;

    const now = Date.now();
    if (recentNotifications.has(notificationKey)) {
        const lastTime = recentNotifications.get(notificationKey);
        if (now - lastTime < 3000) {
            return;
        }
    }

    recentNotifications.set(notificationKey, now);

    for (const [key, timestamp] of recentNotifications.entries()) {
        if (now - timestamp > 10000) {
            recentNotifications.delete(key);
        }
    }

    try {
        await addDoc(notificationsCol, {
            team,
            message,
            timestamp: now,
        });
    } catch (err) {
        console.error("Failed to add notification:", err);
    }
}

function displayMessage(msg) {
    const el = qs("#message");
    if (!el) return;

    el.innerHTML = "";
    const text = gen("p");
    text.textContent = msg;
    const closeBtn = gen("button");
    closeBtn.classList.add("close-message-btn");
    closeBtn.textContent = "X";
    closeBtn.onclick = () => {
        el.classList.add("hidden");
        el.innerHTML = "";
    };

    el.appendChild(text);
    el.appendChild(closeBtn);
    el.classList.remove("hidden");
    setTimeout(() => {
        el.classList.add("hidden");
        el.innerHTML = "";
    }, 7000);
}

async function login() {
    const email = qs("#loginEmail").value.trim();
    const password = qs("#loginPassword").value.trim();

    if (!email || !password) {
        return displayMessage("Please enter an email and password.");
    }

    try {
        await signInWithEmailAndPassword(auth, email, password);
        localStorage.setItem("currentPage", "home");
        sessionStorage.removeItem("initialHash");
        displayMessage("Login successful!");
    } catch (err) {
        console.error("Login error:", err);
        displayMessage("Login failed: " + err.message);
    }
}

function logout() {
    const auth = getAuth();
    signOut(auth).then(() => {
        localStorage.removeItem("loggedIn");
        localStorage.removeItem("teamColor");
        localStorage.removeItem("isSenior");

        teamColor = "";
        isSenior = false;
        teamResources = {};

        const email = qs("#loginEmail");
        const password = qs("#loginPassword");
        if (email) email.value = "";
        if (password) password.value = "";

        history.replaceState(null, "", "#login");

        const historyLength = window.history.length;
        for (let i = 0; i < historyLength - 1; i++) {
            window.history.pushState(null, "", "#login");
        }

        showPage("login", false);
        displayMessage("You have been logged out.");
        window.addEventListener("popstate", enforceAuthCheck);

    }).catch((error) => {
        console.error("Logout failed:", error);
        displayMessage("Error logging out. Please try again.");
    });
}

function enforceAuthCheck(event) {
    const user = auth.currentUser;
    if (!user) {
        history.replaceState(null, "", "#login");
        showPage("login", false);
        if (event) event.preventDefault();
    }
}

async function deleteNotification(notificationId) {
    try {
        const notificationRef = doc(db, "notifications", notificationId);
        await deleteDoc(notificationRef);
        displayMessage("Notification deleted");
    } catch (error) {
        console.error("Error deleting notification:", error);
        displayMessage("Error deleting notification");
    }
}

async function clearAllNotifications() {
    try {
        if (!teamColor) {
            displayMessage("You must be logged in to clear notifications.");
            return;
        }

        const q = query(
            notificationsCol,
            where("team", "==", teamColor)
        );

        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            displayMessage("No notifications to clear.");
            return;
        }

        const batch = writeBatch(db);
        snapshot.forEach((doc) => {
            batch.delete(doc.ref);
        });

        await batch.commit();
        displayMessage("All notifications cleared");

        const notificationPanel = qs("#notification-panel");
        if (notificationPanel) {
            notificationPanel.innerHTML = "<p>No notifications.</p>";
        }

        const notificationsBtn = qs("#notifications-btn");
        if (notificationsBtn) {
            notificationsBtn.classList.remove("has-notification");
            notificationsBtn.textContent = "Notifications";
        }
    } catch (error) {
        console.error("Error clearing notifications:", error);
        displayMessage("Error clearing notifications");
    }
}

function addClearAllButton() {
    const notificationsPage = qs("#notifications");
    if (!notificationsPage) return;
    if (qs("#clear-all-notifications-btn")) return;

    const clearAllBtn = gen("button");
    clearAllBtn.id = "clear-all-notifications-btn";
    clearAllBtn.textContent = "Clear All Notifications";
    clearAllBtn.classList.add("clear-all-btn");
    clearAllBtn.addEventListener("click", clearAllNotifications);

    const timestampEl = qs("#notifications-last-updated");
    if (timestampEl && timestampEl.parentNode) {
        timestampEl.parentNode.insertBefore(clearAllBtn, timestampEl.nextSibling);
    } else {
        notificationsPage.querySelector("h2").appendChild(clearAllBtn);
    }
}

async function populateTeamsDropdown() {
    const teamsCol = collection(db, "teams");
    const teamsSnapshot = await getDocs(teamsCol);
    const select = qs("#team-to-request-from");
    if (!select) return;

    select.innerHTML = '<option value="" disabled selected>Select a team</option>';

    teamsSnapshot.forEach(teamDoc => {
        const id = teamDoc.id;
        if (id === teamColor) return;

        const option = gen("option");
        option.value = id;
        option.textContent = capitalize(id);
        select.appendChild(option);
    });
}

window.addEventListener("popstate", (event) => {
    const user = auth.currentUser;
    if (!user) {
        history.replaceState(null, "", "#login");
        showPage("login", false);
        return;
    }

    const pageId = event.state?.pageId || location.hash.substring(1) || "login";
    showPage(pageId, false);
});

async function calculatePoints() {
    try {
        const teamsCol = collection(db, "teams");
        const teamsSnapshot = await getDocs(teamsCol);

        if (teamsSnapshot.empty) {
            displayMessage("No teams found.");
            return [];
        }

        const teamsWithPoints = [];

        teamsSnapshot.forEach(teamDoc => {
            const teamId = teamDoc.id.toLowerCase();
            const data = teamDoc.data();
            const resources = [
                data.grain || 0,
                data.wool || 0,
                data.brick || 0,
                data.lumber || 0
            ];

            const points = Math.min(...resources);

            teamsWithPoints.push({
                id: teamId,
                points: points,
                resources: {
                    grain: data.grain || 0,
                    wool: data.wool || 0,
                    brick: data.brick || 0,
                    lumber: data.lumber || 0
                },
                development_cards: data.development_cards || []
            });
        });

        teamsWithPoints.sort((a, b) => b.points - a.points);
        return teamsWithPoints;
    } catch (err) {
        console.error("Error calculating points:", err);
        displayMessage("Failed to calculate team points.");
        return [];
    }
}

async function getAllResources() {
    try {
        const teamsWithPoints = await calculatePoints();
        if (teamsWithPoints.length === 0) {
            displayMessage("No teams found.");
            return false;
        }

        const leaderboardContainer = qs("#team-resources");
        let winnerBanner = null;
        const existingBanner = leaderboardContainer.querySelector(".winner-banner");
        if (existingBanner) {

            winnerBanner = existingBanner.cloneNode(true);
        }

        leaderboardContainer.innerHTML = "";

        if (winnerBanner) {
            leaderboardContainer.appendChild(winnerBanner);
        }

        teamsWithPoints.forEach(team => {
            const teamSection = gen("section");
            teamSection.classList.add("team-hand");
            const teamHeader = gen("h3");
            const teamName = capitalize(team.id);
            teamHeader.textContent = `${teamName} (${team.points} Points)`;
            const resources = ["grain", "wool", "brick", "lumber"];
            teamSection.appendChild(teamHeader);
            resources.forEach(resource => {
                const p = gen("p");
                p.id = `${team.id}-${resource}`;
                p.textContent = `${capitalize(resource)}: ${team.resources[resource]}`;
                teamSection.appendChild(p);
            });

            leaderboardContainer.appendChild(teamSection);
        });

        return true;
    } catch (err) {
        console.error("Error loading teams resources:", err);
        displayMessage("Failed to load teams resources.");
        throw err;
    }
}

async function getAllHands() {
    try {
        const teamsWithPoints = await calculatePoints();

        if (teamsWithPoints.length === 0) {
            displayMessage("No teams found.");
            return;
        }

        const seniorHandsContainer = qs("#senior-team-hands");
        seniorHandsContainer.innerHTML = "";

        teamsWithPoints.forEach(team => {
            const teamId = team.id.toLowerCase();
            const teamSection = gen("section");
            teamSection.classList.add("senior-team-hand");

            const teamHeader = gen("h3");
            const teamName = capitalize(teamId);
            teamHeader.textContent = `${teamName} (${team.points} Points)`;
            teamSection.appendChild(teamHeader);

            const pointsDetails = gen("p");
            pointsDetails.classList.add("points-details");
            teamSection.appendChild(pointsDetails);

            const devCardsHeader = gen("h4");
            devCardsHeader.textContent = "Development Cards";
            teamSection.appendChild(devCardsHeader);

            const devCardsSection = gen("section");
            devCardsSection.id = `senior-${teamId}-dev-cards`;
            teamSection.appendChild(devCardsSection);

            const resourcesHeader = gen("h4");
            resourcesHeader.textContent = "Resources";
            teamSection.appendChild(resourcesHeader);

            const resources = ["grain", "wool", "brick", "lumber"];
            resources.forEach(resource => {
                const p = gen("p");
                p.id = `senior-${teamId}-${resource}`;
                p.textContent = `${capitalize(resource)}: ${team.resources[resource]}`;
                teamSection.appendChild(p);
            });

            const devCards = team.development_cards || [];
            const devCardsEl = devCardsSection;

            if (devCards && devCards.length > 0) {
                const victoryPoints = devCards.filter(card => card === "Victory Point").length;

                if (victoryPoints > 0) {
                    const totalPoints = gen("p");
                    totalPoints.classList.add("total-points");
                    totalPoints.innerHTML = `<strong>Total Points (including VP cards):</strong> ${team.points + victoryPoints}`;
                    teamSection.insertBefore(totalPoints, pointsDetails.nextSibling);
                }

                devCards.forEach(card => {
                    const p = gen("p");
                    p.textContent = card;
                    devCardsEl.appendChild(p);
                });
            } else {
                const p = gen("p");
                p.textContent = "No development cards";
                devCardsEl.appendChild(p);
            }

            seniorHandsContainer.appendChild(teamSection);
        });
    } catch (err) {
        console.error("Error loading teams resources:", err);
        displayMessage("Failed to load teams resources.");
    }
}

Element.prototype.contains = function (text) {
    return this.textContent.includes(text);
};

const originalQs = window.qs;
window.qs = function (selector) {
    if (selector.includes(":contains(")) {
        const parts = selector.split(":contains(");
        const baseSelector = parts[0];
        const textToMatch = parts[1].slice(0, -1);

        const elements = document.querySelectorAll(baseSelector);
        for (let i = 0; i < elements.length; i++) {
            if (elements[i].textContent.includes(textToMatch)) {
                return elements[i];
            }
        }
        return null;
    }

    return originalQs(selector);
};

async function showPersonalHand() {
    if (!teamColor) {
        displayMessage("You must be logged in with a team to see your hand.");
        return;
    }

    try {
        const teamDocRef = doc(db, "teams", teamColor);
        const teamDoc = await getDoc(teamDocRef);

        if (!teamDoc.exists()) {
            displayMessage(`No data found for team ${teamColor}`);
            return;
        }

        const data = teamDoc.data();
        teamResources = {
            grain: data.grain || 0,
            wool: data.wool || 0,
            brick: data.brick || 0,
            lumber: data.lumber || 0
        };

        const resources = [
            data.grain || 0,
            data.wool || 0,
            data.brick || 0,
            data.lumber || 0
        ];
        const points = Math.min(...resources);

        const yourHandSection = qs("#your-hand");
        let pointsDisplay = qs("#personal-points");

        if (!pointsDisplay) {
            pointsDisplay = gen("h3");
            pointsDisplay.id = "personal-points";
            yourHandSection.insertBefore(pointsDisplay, yourHandSection.firstChild);
        }

        pointsDisplay.textContent = `Your Points: ${points}`;
        qs("#grain").textContent = `Grain: ${data.grain || 0}`;
        qs("#wool").textContent = `Wool: ${data.wool || 0}`;
        qs("#brick").textContent = `Brick: ${data.brick || 0}`;
        qs("#lumber").textContent = `Lumber: ${data.lumber || 0}`;

        const devCardsSection = qs("#dev-cards-in-hand");
        devCardsSection.innerHTML = "";
        if (data.development_cards && data.development_cards.length > 0) {
            const victoryPoints = data.development_cards.filter(card => card === "Victory Point").length;

            if (victoryPoints > 0) {
                const vpCounterDiv = gen("div");
                vpCounterDiv.classList.add("dev-card-counter");
                vpCounterDiv.innerHTML = `<p>You have <strong>${victoryPoints} Victory Point</strong> card${victoryPoints > 1 ? 's' : ''} (hidden from other teams)</p>`;
                devCardsSection.appendChild(vpCounterDiv);
            }

            data.development_cards.forEach(card => {
                const div = gen("div");
                div.classList.add("dev-card");

                const descP = gen("p");
                descP.classList.add("dev-card-description");
                descP.textContent = devCardDescriptions[card] || "No description available.";
                div.appendChild(descP);

                const p = gen("p");
                p.textContent = card;
                div.appendChild(p);

                const btn = gen("button");
                if (card === "Robber" || card === "Choose 2 Resources") {
                    btn.textContent = `Use ${card}`;
                    btn.onclick = () => {
                        if (card === "Robber") showPage("use-robber");
                        else if (card === "Choose 2 Resources") showPage("use-choose-2-resources");
                    };
                } else if (card === "Victory Point") {
                    btn.textContent = `Point will be added automatically at the end of the game`;
                    btn.classList.add("disabled");
                } else {
                    btn.textContent = `Point will be added automatically at the end of the game`;
                    btn.classList.add("disabled");
                }

                div.appendChild(btn);
                devCardsSection.appendChild(div);
            });
        } else {
            devCardsSection.textContent = "No development cards";
        }

        qs("#personal-hand-last-updated").textContent = `Last updated: ${new Date().toLocaleTimeString()}`;
    } catch (err) {
        console.error("Error loading personal hand:", err);
        displayMessage("Failed to load your hand.");
    }
}

const seeHandBtn = qs("#see-hand-btn");
if (seeHandBtn) {
    seeHandBtn.addEventListener("click", () => {
        showPage("personal-hand");
    });
}

const loginForm = qs("#login-form");
if (loginForm) {
    loginForm.addEventListener("submit", login);
}

async function submitTradeRequest() {
    const toTeam = qs("#team-to-request-from").value;
    const resources = ["grain", "wool", "brick", "lumber"];
    const resourceInputs = {
        offer: {},
        request: {}
    };
    const offer = {};
    const request = {};
    const resetTradeForm = () => {
        const toTeamSelect = qs("#team-to-request-from");
        toTeamSelect.value = "";
        resources.forEach(resource => {
            const offerInput = qs(`#offer-${resource}`);
            const requestInput = qs(`#request-${resource}`);
            if (offerInput) offerInput.value = "0";
            if (requestInput) requestInput.value = "0";
        });

        const requestTradeBtn = qs("#submit-trade-request");
        if (requestTradeBtn) requestTradeBtn.disabled = true;
    };

    if (!teamColor) {
        displayMessage("You must be logged in to request a trade.");
        resetTradeForm();
        return;
    }

    if (!toTeam) {
        displayMessage("Select a team to trade with.");
        resetTradeForm();
        return;
    }

    const fromTeamRef = doc(db, "teams", teamColor);
    const toTeamRef = doc(db, "teams", toTeam);

    const [fromTeamDoc, toTeamDoc] = await Promise.all([
        getDoc(fromTeamRef),
        getDoc(toTeamRef),
    ]);

    if (!fromTeamDoc.exists() || !toTeamDoc.exists()) {
        displayMessage("One of the teams no longer exists.");
        resetTradeForm();
        return;
    }

    const fromData = fromTeamDoc.data();
    const toData = toTeamDoc.data();
    let dupResources = [];

    for (const resource of resources) {
        const amt = parseInt(qs(`#offer-${resource}`).value, 10);
        offer[resource] = isNaN(amt) ? 0 : amt;
        if ((fromData[resource] || 0) < offer[resource]) {
            displayMessage(`You don't have enough ${resource}.`);
            resetTradeForm();
            return;
        }

        const requestAmt = parseInt(qs(`#request-${resource}`).value, 10);
        request[resource] = isNaN(requestAmt) ? 0 : requestAmt;

        if ((toData[resource] || 0) < request[resource]) {
            displayMessage(`Team ${toTeam} doesn't have enough ${resource}.`);
            resetTradeForm();
            return;
        }

        if (offer[resource] > 0 && request[resource] > 0) {
            dupResources.push(resource);
        }
    }

    if (dupResources.length > 0) {
        let message = "You cannot offer and request the same resource: ";
        for (const resource of dupResources) {
            message += `${resource}, `;
        }
        message = message.slice(0, -2);
        message += ".";
        displayMessage(message);
        resetTradeForm();
        return;
    }

    const hasOffer = Object.values(offer).some(amount => amount > 0);
    const hasRequest = Object.values(request).some(amount => amount > 0);

    if (!hasOffer || !hasRequest) {
        displayMessage("You must offer and request at least one resource.");
        resetTradeForm();
        return;
    }

    try {
        await addDoc(tradeRequestsCol, {
            fromTeam: teamColor,
            toTeam,
            offer,
            request,
            status: "pending",
            timestamp: Date.now(),
        });
        await notifyTradeRequest(toTeam, teamColor);
        displayMessage(`Trade request sent to ${toTeam}.`);
        resetTradeForm();
    } catch (err) {
        console.error("Error submitting trade request:", err);
        displayMessage("Failed to submit trade request.");
        resetTradeForm();
    }
}

let tradeRequestsUnsubscribe = null;
function listenForIncomingTrades() {

    if (tradeRequestsUnsubscribe) {
        tradeRequestsUnsubscribe();
        tradeRequestsUnsubscribe = null;
    }

    if (!teamColor) {
        console.warn("listenForIncomingTrades called but teamColor is empty");

        teamColor = localStorage.getItem("teamColor") || "";
        if (!teamColor) {
            console.error("Could not get team color from localStorage");
            return;
        }
    }

    const q = query(
        tradeRequestsCol,
        where("toTeam", "==", teamColor),
        where("status", "==", "pending")
    );

    const tradeRequestsSection = qs("#trade-requests");
    tradeRequestsSection.innerHTML = "";
    tradeRequestsUnsubscribe = onSnapshot(q, async (snapshot) => {
        tradeRequestsSection.innerHTML = "";
        if (snapshot.empty) {
            tradeRequestsSection.textContent = "No requests to respond to.";
            return;
        }

        const teamRef = doc(db, "teams", teamColor);
        const teamDoc = await getDoc(teamRef);
        if (!teamDoc.exists()) {
            console.error("Current team not found in database");
            return;
        }

        const currentTeamResources = teamDoc.data();
        snapshot.forEach((docSnap) => {
            const trade = docSnap.data();
            const tradeId = docSnap.id;
            const div = gen("div");
            div.classList.add("trade-request");
            div.innerHTML = `
                <p><strong>${trade.fromTeam}</strong> is offering:</p>
                <ul>
                ${["grain", "wool", "brick", "lumber"]
                    .map(res => `<li>${capitalize(res)}: ${trade.offer[res] || 0}</li>`)
                    .join("")}
                </ul>
                <p>In exchange for:</p>
                <ul>
                ${["grain", "wool", "brick", "lumber"]
                    .map(res => `<li>${capitalize(res)}: ${trade.offer[res] || 0}</li>`)
                    .join("")}
                </ul>
                <button class="accept-trade" data-id="${tradeId}">Accept</button>
                <button class="reject-trade" data-id="${tradeId}">Reject</button>
                <div class="insufficient-resources hidden">Insufficient resources to complete this trade.</div>
            `;

            let hasSufficientResources = true;
            for (const [resource, amount] of Object.entries(trade.request)) {
                if ((currentTeamResources[resource] || 0) < amount) {
                    hasSufficientResources = false;
                    break;
                }
            }

            tradeRequestsSection.appendChild(div);
            const acceptBtn = div.querySelector(".accept-trade");
            const insufficientMsg = div.querySelector(".insufficient-resources");

            if (!hasSufficientResources) {
                acceptBtn.disabled = true;
                acceptBtn.classList.add("disabled");
                insufficientMsg.classList.remove("hidden");
            }
        });

        qsa(".accept-trade").forEach(btn => {
            if (!btn.disabled) {
                btn.onclick = () => handleTradeResponse(btn.dataset.id, true);
            }
        });

        qsa(".reject-trade").forEach(btn => {
            btn.onclick = () => handleTradeResponse(btn.dataset.id, false);
        });
    });
}

async function handleTradeResponse(tradeId, accepted) {
    try {
        const tradeDocRef = doc(db, "trade_requests", tradeId);
        const tradeDoc = await getDoc(tradeDocRef);

        if (!tradeDoc.exists()) {
            displayMessage("Trade request not found.");
            return;
        }

        const trade = tradeDoc.data();

        if (!accepted) {
            await deleteDoc(tradeDocRef);
            await notifyTradeRejected(trade.fromTeam, trade.toTeam);
            return;
        }

        const toTeamRef = doc(db, "teams", trade.toTeam);
        const toTeamDoc = await getDoc(toTeamRef);

        if (!toTeamDoc.exists()) {
            displayMessage("Your team no longer exists.");
            return;
        }

        const toData = toTeamDoc.data();
        let hasSufficientResources = true;
        let insufficientResource = "";

        for (const [resource, amount] of Object.entries(trade.request)) {
            if ((toData[resource] || 0) < amount) {
                hasSufficientResources = false;
                insufficientResource = resource;
                break;
            }
        }

        if (!hasSufficientResources) {
            displayMessage(`Trade cancelled: You don't have enough ${insufficientResource}.`);
            return;
        }

        await notifyTradeAccepted(trade.fromTeam, trade.toTeam);

        const fromTeamRef = doc(db, "teams", trade.fromTeam);
        const fromTeamDoc = await getDoc(fromTeamRef);

        if (!fromTeamDoc.exists()) {
            displayMessage("The requesting team no longer exists.");
            return;
        }

        const fromData = fromTeamDoc.data();

        for (const [resource, amount] of Object.entries(trade.offer)) {
            if ((fromData[resource] || 0) < amount) {
                displayMessage(`Trade cancelled: ${trade.fromTeam} no longer has enough ${resource}.`);
                return;
            }
        }

        const newFrom = { ...fromData };
        const newTo = { ...toData };

        for (const [res, amt] of Object.entries(trade.offer)) {
            newFrom[res] = (newFrom[res] || 0) - amt;
            newTo[res] = (newTo[res] || 0) + amt;
        }

        for (const [res, amt] of Object.entries(trade.request)) {
            newTo[res] = (newTo[res] || 0) - amt;
            newFrom[res] = (newFrom[res] || 0) + amt;
        }

        await Promise.all([
            updateDoc(fromTeamRef, newFrom),
            updateDoc(toTeamRef, newTo),
            deleteDoc(tradeDocRef),
        ]);

    } catch (err) {
        console.error("Error in handleTradeResponse:", err);
        displayMessage("Something went wrong processing the trade.");
    }
}

async function createCompositeIndex() {
    try {
        const q = query(
            notificationsCol,
            where("team", "==", teamColor),
            orderBy("timestamp", "desc")
        );

        await getDocs(q);
        return q;

    } catch (error) {
        if (error.code === 'failed-precondition' && error.message.includes('index')) {
            console.error("Missing composite index. Please create it in the Firebase console.");

            const urlMatch = error.message.match(/https:\/\/console\.firebase\.google\.com\/[^\s]+/);
            if (urlMatch) {
                displayMessage("Notifications are being configured. Please try again in a few minutes.");

                return query(
                    notificationsCol,
                    where("team", "==", teamColor)
                );
            }
        }
        throw error;
    }
}

function renderNotifications(notificationPanel, notifications) {
    if (!notificationPanel) return;

    notificationPanel.innerHTML = "";

    if (!notifications || notifications.length === 0) {
        notificationPanel.innerHTML = "<p>No notifications.</p>";
        return;
    }

    const notificationsContainer = gen("div");
    notificationsContainer.classList.add("notifications-container");

    const headerRow = gen("div");
    headerRow.classList.add("notification-header");
    headerRow.innerHTML = "<span>Message</span><span>Time</span><span></span>";
    notificationsContainer.appendChild(headerRow);

    notifications.forEach((note) => {
        let timeString = "";
        if (note.timestamp) {
            let date;
            if (typeof note.timestamp.toDate === "function") {
                date = note.timestamp.toDate();
            } else if (typeof note.timestamp === "string") {
                date = new Date(note.timestamp);
            } else if (typeof note.timestamp === "number") {
                date = new Date(note.timestamp);
            }

            if (date instanceof Date && !isNaN(date) && window.formatRelativeTime) {
                timeString = window.formatRelativeTime(date);
            } else {
                timeString = new Date(note.timestamp).toLocaleString();
            }
        }

        const notificationRow = gen("div");
        notificationRow.classList.add("notification-row");
        notificationRow.dataset.id = note.id;

        const messageSpan = gen("span");
        messageSpan.classList.add("notification-message");
        messageSpan.textContent = note.message || "New notification";

        const timeSpan = gen("span");
        timeSpan.classList.add("notification-time");
        timeSpan.textContent = timeString;

        const deleteBtn = gen("button");
        deleteBtn.classList.add("notification-delete");
        deleteBtn.innerHTML = "×";
        deleteBtn.title = "Delete notification";
        deleteBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            deleteNotification(note.id);
        });

        notificationRow.appendChild(messageSpan);
        notificationRow.appendChild(timeSpan);
        notificationRow.appendChild(deleteBtn);
        notificationsContainer.appendChild(notificationRow);
    });

    notificationPanel.appendChild(notificationsContainer);
}

const notificationsBtn = qs("#notifications-btn");
if (notificationsBtn) {
    notificationsBtn.addEventListener("click", () => {
        showPage("notifications");
    });
}

async function listenForNotifications() {
    if (!teamColor && !isSenior) {
        console.warn("listenForNotifications called but teamColor is empty and user is not senior");
        return;
    }

    if (isSenior) {
        teamColor = seniorRole;
    }

    let q;
    try {
        q = await createCompositeIndex();
    } catch (error) {
        console.error("Error setting up notifications query:", error);
        q = query(notificationsCol, where("team", "==", teamColor));


        displayMessage("There was an issue loading notifications in order. Loading in default order instead.");
    }

    const notificationsBtn = qs("#notifications-btn");
    if (!notificationsBtn) return;

    onSnapshot(q, (snapshot) => {
        if (snapshot.empty) {
            notificationsBtn.classList.remove("has-notification");
            notificationsBtn.textContent = "Notifications";
            const notificationPanel = qs("#notification-panel");
            if (notificationPanel && notificationPanel.closest('.page:not(.hidden)')) {
                notificationPanel.innerHTML = "<p>No notifications.</p>";
            }
            return;
        }

        notificationsBtn.classList.add("has-notification");
        notificationsBtn.textContent = `Notifications (${snapshot.size})`;

        const notificationPanel = qs("#notification-panel");
        if (notificationPanel && notificationPanel.closest('.page:not(.hidden)')) {
            const notifications = [];
            snapshot.forEach((docSnap) => {
                notifications.push({
                    id: docSnap.id,
                    ...docSnap.data()
                });
            });

            renderNotifications(notificationPanel, notifications);
        }
    });
}

async function deleteDevCard(cardType) {
    try {
        const teamRef = doc(db, "teams", teamColor);
        const teamSnap = await getDoc(teamRef);
        if (!teamSnap.exists()) return displayMessage("Team not found.");

        const data = teamSnap.data();
        const cards = data.development_cards || [];

        const index = cards.indexOf(cardType);
        if (index < 0) {
            return displayMessage("Card not found.");
        }

        const usedCard = cards.splice(index, 1);

        await updateDoc(teamRef, { development_cards: cards });
        displayMessage(`Success!`);
        await addNotification(teamColor, `You used a ${usedCard} development card.`);
        await addNotification(seniorRole, `Team ${teamColor} used a ${usedCard} development card.`);

        showPersonalHand();

    } catch (err) {
        console.error("Error using dev card:", err);
        displayMessage("Failed to use card.");
    }
}

async function assignResourceCard(teamId, resourceType, amount) {
    try {
        const teamRef = doc(db, "teams", teamId);
        const teamSnap = await getDoc(teamRef);

        if (!teamSnap.exists()) {
            console.error(`Team ${teamId} not found.`);
            return;
        }

        const data = teamSnap.data();
        const currentAmount = data[resourceType] || 0;

        const newAmount = currentAmount + amount;

        await updateDoc(teamRef, {
            [resourceType]: newAmount
        });

        let message = ""
        if (amount > 1) {
            message = `You received ${amount} ${resourceType} cards!`;
        } else {
            message = `You received ${amount} ${resourceType} card!`;
        }
        if (isSenior) {
            displayMessage("Success");
        }
        await addNotification(teamId, message);
        await addNotification(seniorRole, `${amount} ${resourceType} card(s) given to Team ${teamId}`);
    } catch (err) {
        console.error("Error assigning resource card:", err);
    }
}

async function assignDevCard(teamId, cardType) {
    try {
        const teamRef = doc(db, "teams", teamId);
        const teamSnap = await getDoc(teamRef);

        if (!teamSnap.exists()) {
            displayMessage(`Team ${teamId} not found.`);
            return;
        }

        const data = teamSnap.data();
        const currentCards = data["development_cards"];

        currentCards.push(cardType);

        await updateDoc(teamRef, {
            ["development_cards"]: currentCards
        });

        if (isSenior) {
            displayMessage("Success");
        }

        await addNotification(teamId, `You received a "${cardType}" development card`);
        await addNotification(seniorRole, `"${cardType}" development card given to Team ${teamId}`);
    } catch (err) {
        console.error("Error assigning development card:", err);
    }
}

async function removeResourceCard(teamId, resourceType, amount) {
    try {
        const teamRef = doc(db, "teams", teamId);
        const teamSnap = await getDoc(teamRef);

        if (!teamSnap.exists()) {
            displayMessage(`Team ${teamId} not found.`);
            return;
        }

        const data = teamSnap.data();
        const currentAmount = data[resourceType] || 0;

        if (currentAmount < amount) {
            displayMessage(`Team ${teamId} does not have enough ${resourceType}.`);
            return;
        }

        const newAmount = currentAmount - amount;

        await updateDoc(teamRef, {
            [resourceType]: newAmount
        });

        if (isSenior) {
            displayMessage("Success");
        }
        await addNotification(teamId, `You lost ${amount} ${resourceType} cards.`);
        await addNotification(seniorRole, `${amount} ${resourceType} card(s) removed from Team ${teamId}`);
    } catch (err) {
        console.error("Error removing resource card:", err);
    }
}

async function removeDevCard(teamId, cardType) {
    try {
        const teamRef = doc(db, "teams", teamId);
        const teamSnap = await getDoc(teamRef);

        if (!teamSnap.exists()) {
            displayMessage(`Team ${teamId} not found.`);
            return;
        }

        const data = teamSnap.data();
        const currentCards = data["development_cards"] || [];

        const index = currentCards.indexOf(cardType);
        if (index < 0) {
            displayMessage(`Team ${teamId} does not have a ${cardType} card.`);
            return;
        }

        const removedCard = currentCards.splice(index, 1);

        await updateDoc(teamRef, {
            ["development_cards"]: currentCards
        });

        if (isSenior) {
            displayMessage("Success");
        }
        await addNotification(teamId, `You lost a ${removedCard} development card.`);
        await addNotification(seniorRole, `Removed a ${removedCard} development card from Team ${teamId}`);
    } catch (err) {
        console.error("Error removing development card:", err);
    }
}

async function notifyTradeRequest(toTeam, fromTeam) {
    await addNotification(toTeam, `Team ${fromTeam} has requested a trade.`);
    await addNotification(seniorRole, `Team ${fromTeam} requested a trade with ${toTeam}`);
}

async function notifyTradeAccepted(fromTeam, toTeam) {
    await addNotification(fromTeam, `Team ${toTeam} accepted your trade request.`);
    await addNotification(toTeam, `You accepted the trade request from ${fromTeam}.`);
    await addNotification(seniorRole, `Team ${toTeam} accepted Team ${fromTeam}'s trade request`);
}

async function notifyTradeRejected(fromTeam, toTeam) {
    await addNotification(fromTeam, `Your trade request to ${toTeam} was rejected.`);
    await addNotification(toTeam, `You rejected the trade request from ${fromTeam}.`);
    await addNotification(seniorRole, `Team ${toTeam} rejected Team ${fromTeam}'s trade request`);
}

async function useRobber() {
    const select = qs("#robber-target-team");
    const selectedTeam = select.value;

    if (!selectedTeam) {
        displayMessage("Please select a team to rob.");
        return;
    }

    const teamDocRef = doc(db, "teams", selectedTeam);
    const teamDoc = await getDoc(teamDocRef);

    if (!teamDoc.exists()) {
        displayMessage("Selected team does not exist.");
        return;
    }

    const data = teamDoc.data();
    const availableResources = [];

    ["grain", "wool", "brick", "lumber"].forEach(resource => {
        if ((data[resource] || 0) > 0) {
            availableResources.push(resource);
        }
    });

    if (availableResources.length === 0) {
        displayMessage(`${selectedTeam} has no resources to steal.`);
        return;
    }

    const stolen = availableResources[Math.floor(Math.random() * availableResources.length)];

    const robberTeamRef = doc(db, "teams", teamColor);
    const [robberDoc] = await Promise.all([getDoc(robberTeamRef)]);
    const robberData = robberDoc.data();

    const updates = {};
    updates[stolen] = (robberData[stolen] || 0) + 1;

    const victimUpdate = {};
    victimUpdate[stolen] = data[stolen] - 1;

    await updateDoc(robberTeamRef, updates);
    await updateDoc(teamDocRef, victimUpdate);
    await addNotification(teamColor, `You stole 1 ${stolen} from ${selectedTeam}.`);
    await addNotification(selectedTeam, `${teamColor} stole 1 ${stolen} from you.`);
    await addNotification(seniorRole, `${teamColor} stole 1 ${stolen} from ${selectedTeam}`);
    await deleteDevCard("Robber");
}

async function useChoose2Resources() {
    const resource1 = qs("#choose-2-resource1").value;
    const resource2 = qs("#choose-2-resource2").value;

    await assignResourceCard(teamColor, resource1, 1);
    await assignResourceCard(teamColor, resource2, 1);
    await deleteDevCard("Choose 2 Resources");
}

const devCardInfoRef = collection(db, "development_cards");
let devCardDescriptions = {};

async function loadDevCardDescriptions() {
    const snapshot = await getDocs(devCardInfoRef);
    devCardDescriptions = {};
    snapshot.forEach(doc => {
        devCardDescriptions[doc.id] = doc.data().description;
    });
}

const homeBtn = qs("#home-btn");
if (homeBtn) {
    homeBtn.addEventListener("click", () => {
        if (auth.currentUser || localStorage.getItem("teamColor")) {
            getAllResources();
            const leaderboardTimestamp = qs("#leaderboard-last-updated");
            if (leaderboardTimestamp) {
                leaderboardTimestamp.textContent = `Last updated: ${new Date().toLocaleTimeString()}`;
            }
            showPage("home");
        } else {
            console.log("User not logged in, can't go to home");
        }
    });
}

const logoutBtn = qs("#logout-btn");
if (logoutBtn) {
    logoutBtn.addEventListener("click", logout);
}

const seniorNotificationsBtn = qs("#senior-notifications-btn");
if (seniorNotificationsBtn) {
    seniorNotificationsBtn.addEventListener("click", () => {
        showPage("senior-notifications");
    });
}

const seniorSeeHandsBtn = qs("#senior-see-hands-btn");
if (seniorSeeHandsBtn) {
    seniorSeeHandsBtn.addEventListener("click", () => {
        showPage("senior-see-hands");
    });
}

const seniorSubmitAssignResourcesBtn = qs("#submit-assign-resources");
if (seniorSubmitAssignResourcesBtn) {
    seniorSubmitAssignResourcesBtn.addEventListener("click", () => {
        const team = qs("#team-to-assign-resources").value;
        const resource = qs("#resource-to-assign").value;
        const amount = Number(qs("#amount-to-assign").value);
        if (amount < 1) {
            displayMessage("Amount must be at least 1.");
            return;
        }
        assignResourceCard(team, resource, amount);
        resetSeniorFormButtons();
    });
}

const seniorSubmitAssignRandomDevCardBtn = qs("#submit-assign-random-dev-card");
if (seniorSubmitAssignRandomDevCardBtn) {
    seniorSubmitAssignRandomDevCardBtn.addEventListener("click", () => {
        const team = qs("#team-to-assign-random-dev-card").value;

        const randomNumber = Math.random();
        let card;
        if (randomNumber < 0.6) {
            card = "Robber";
        } else if (randomNumber < 0.75) {
            card = "Victory Point";
        } else {
            card = "Choose 2 Resources";
        }

        assignDevCard(team, card);
        resetSeniorFormButtons();
    });
}

const seniorSubmitAssignSpecificDevCardBtn = qs("#submit-assign-specific-dev-card");
if (seniorSubmitAssignSpecificDevCardBtn) {
    seniorSubmitAssignSpecificDevCardBtn.addEventListener("click", () => {
        const team = qs("#team-to-assign-specific-dev-card").value;
        const card = qs("#dev-card-to-assign").value;
        assignDevCard(team, card);
        resetSeniorFormButtons();
    });
}

const seniorSubmitRemoveResourcesBtn = qs("#submit-remove-resources");
if (seniorSubmitRemoveResourcesBtn) {
    seniorSubmitRemoveResourcesBtn.addEventListener("click", () => {
        const team = qs("#team-to-remove-resources").value;
        const resource = qs("#resource-to-remove").value;
        const amount = Number(qs("#amount-to-remove").value);
        removeResourceCard(team, resource, amount);
        resetSeniorFormButtons();
    });
}

const seniorSubmitRemoveDevCardBtn = qs("#submit-remove-dev-card");
if (seniorSubmitRemoveDevCardBtn) {
    seniorSubmitRemoveDevCardBtn.addEventListener("click", () => {
        const team = qs("#team-to-remove-dev-card").value;
        const card = qs("#dev-card-to-remove").value;
        removeDevCard(team, card);
        resetSeniorFormButtons();
    });
}

const submitTradeBtn = qs("#submit-trade-request");
if (submitTradeBtn) {
    submitTradeBtn.addEventListener("click", () => {
        submitTradeRequest()
    });
}

if (notificationsBtn) {
    notificationsBtn.addEventListener("click", () => {
        const notificationsTimestamp = qs("#notifications-last-updated");
        if (notificationsTimestamp) {
            notificationsTimestamp.textContent = `Last updated: ${new Date().toLocaleTimeString()}`;
        }
        showPage("notifications");
    });
}

const manageTradesBtn = qs("#manage-trades-btn");
if (manageTradesBtn) {
    manageTradesBtn.addEventListener("click", () => {
        const tradeRequestsTimestamp = qs("#trade-requests-last-updated");
        if (tradeRequestsTimestamp) {
            tradeRequestsTimestamp.textContent = `Last updated: ${new Date().toLocaleTimeString()}`;
        }
        showPage("manage-trades");
    });
}

const submitRobberRequestBtn = qs("#submit-robber-request");
if (submitRobberRequestBtn) {
    submitRobberRequestBtn.addEventListener("click", () => {
        useRobber();
        const robberSelect = qs("#robber-target-team");
        robberSelect.value = "";
        submitRobberRequestBtn.disabled = true;
    });
}

const submitChoose2RequestBtn = qs("#submit-choose-2-request");
if (submitChoose2RequestBtn) {
    submitChoose2RequestBtn.addEventListener("click", () => {
        useChoose2Resources();
        const res1 = qs("#choose-2-resource1");
        const res2 = qs("#choose-2-resource2");
        res1.value = "";
        res2.value = "";
        submitChoose2RequestBtn.disabled = true;
    });
}

async function populateRobberTargetDropdown() {
    const teamsCol = collection(db, "teams");
    const teamsSnapshot = await getDocs(teamsCol);
    const select = qs("#robber-target-team");
    if (!select) return;

    select.innerHTML = '<option value="" disabled selected>Select a team to rob</option>';

    teamsSnapshot.forEach(teamDoc => {
        const id = teamDoc.id;
        if (id === teamColor) return;

        const option = gen("option");
        option.value = id;
        option.textContent = capitalize(id);
        select.appendChild(option);
    });
}

const robberSelect = qs("#robber-target-team");
const robberBtn = qs("#submit-robber-request");
if (robberSelect && robberBtn) {
    robberSelect.addEventListener("change", () => {
        robberBtn.disabled = !robberSelect.value;
    });
}

const assignResourcesTeamSelect = qs("#team-to-assign-resources");
const assignResourcesResourceSelect = qs("#resource-to-assign");
const assignResourcesBtn = qs("#submit-assign-resources");

function updateAssignResourcesButtonState() {
    const val1 = assignResourcesTeamSelect.value;
    const val2 = assignResourcesResourceSelect.value;
    assignResourcesBtn.disabled = !(val1 && val2);
}

if (assignResourcesTeamSelect && assignResourcesResourceSelect && assignResourcesBtn) {
    assignResourcesTeamSelect.addEventListener("change", updateAssignResourcesButtonState);
    assignResourcesResourceSelect.addEventListener("change", updateAssignResourcesButtonState);
}

const assignRandomDevCardTeamSelect = qs("#team-to-assign-random-dev-card");
const assignRandomDevCardBtn = qs("#submit-assign-random-dev-card");

function updateAssignRandomDevCardButtonState() {
    const val1 = assignRandomDevCardTeamSelect.value;
    assignRandomDevCardBtn.disabled = !val1;
}

if (assignRandomDevCardTeamSelect && assignRandomDevCardBtn) {
    assignRandomDevCardTeamSelect.addEventListener("change", updateAssignRandomDevCardButtonState);
}

const assignSpecificDevCardTeamSelect = qs("#team-to-assign-specific-dev-card");
const assignSpecificDevCardSelect = qs("#dev-card-to-assign");
const assignSpecificDevCardBtn = qs("#submit-assign-specific-dev-card");

function updateAssignSpecificDevCardButtonState() {
    const val1 = assignSpecificDevCardTeamSelect.value;
    const val2 = assignSpecificDevCardSelect.value;
    assignSpecificDevCardBtn.disabled = !(val1 && val2);
}

if (assignSpecificDevCardTeamSelect && assignSpecificDevCardSelect && assignSpecificDevCardBtn) {
    assignSpecificDevCardTeamSelect.addEventListener("change", updateAssignSpecificDevCardButtonState);
    assignSpecificDevCardSelect.addEventListener("change", updateAssignSpecificDevCardButtonState);
}

const removeResourcesTeamSelect = qs("#team-to-remove-resources");
const removeResourcesResourceSelect = qs("#resource-to-remove");
const removeResourcesBtn = qs("#submit-remove-resources");

function updateRemoveResourcesButtonState() {
    const val1 = removeResourcesTeamSelect.value;
    const val2 = removeResourcesResourceSelect.value;
    removeResourcesBtn.disabled = !(val1 && val2);
}

if (removeResourcesTeamSelect && removeResourcesResourceSelect && removeResourcesBtn) {
    removeResourcesTeamSelect.addEventListener("change", updateRemoveResourcesButtonState);
    removeResourcesResourceSelect.addEventListener("change", updateRemoveResourcesButtonState);
}

const removeDevCardTeamSelect = qs("#team-to-remove-dev-card");
const removeDevCardSelect = qs("#dev-card-to-remove");
const removeDevCardBtn = qs("#submit-remove-dev-card");

function updateRemoveDevCardButtonState() {
    const val1 = removeDevCardTeamSelect.value;
    const val2 = removeDevCardSelect.value;
    removeDevCardBtn.disabled = !(val1 && val2);
}

if (removeDevCardTeamSelect && removeDevCardSelect && removeDevCardBtn) {
    removeDevCardTeamSelect.addEventListener("change", updateRemoveDevCardButtonState);
    removeDevCardSelect.addEventListener("change", updateRemoveDevCardButtonState);
}

const res1 = qs("#choose-2-resource1");
const res2 = qs("#choose-2-resource2");
const choose2Btn = qs("#submit-choose-2-request");

function updateChoose2ButtonState() {
    const val1 = res1.value;
    const val2 = res2.value;
    choose2Btn.disabled = !(val1 && val2);
}

if (res1 && res2 && choose2Btn) {
    res1.addEventListener("change", updateChoose2ButtonState);
    res2.addEventListener("change", updateChoose2ButtonState);
}

const requestFrom = qs("#team-to-request-from");
const requestTradeBtn = qs("#submit-trade-request");

function updateRequestTradeButtonState() {
    const val1 = requestFrom.value;
    requestTradeBtn.disabled = !val1;
}

if (requestFrom && requestTradeBtn) {
    requestFrom.addEventListener("change", updateRequestTradeButtonState);
}

function resetSeniorFormButtons() {

    const managementSection = qs("#senior-manage-game");
    if (!managementSection) return;

    const buttons = managementSection.querySelectorAll("section button:not(#start-new-game-btn):not(#end-game-btn):not(#confirm-end-game-btn):not(#cancel-end-game-btn)");
    buttons.forEach(btn => {
        btn.disabled = true;
    });

    const selects = managementSection.querySelectorAll("section select");
    selects.forEach(select => {
        select.value = "";
    });

    const inputs = managementSection.querySelectorAll("section input");
    inputs.forEach(input => {
        input.value = 1;
    });
}

async function checkGameActive() {
    try {
        const gameStateRef = doc(db, "game_state", "current");
        const gameStateDoc = await getDoc(gameStateRef);

        if (gameStateDoc.exists()) {
            const data = gameStateDoc.data();
            isGameActive = data.active || false;
            
            const startGameBtn = qs("#start-new-game-btn");
            const endGameBtn = qs("#end-game-btn");
            const statusMessage = qs("#game-status-message");

            if (startGameBtn && endGameBtn && statusMessage) {
                if (isGameActive) {
                    startGameBtn.disabled = true;
                    endGameBtn.disabled = false;
                    statusMessage.textContent = "Game currently active";
                    statusMessage.className = "active";
                } else {
                    startGameBtn.disabled = false;
                    endGameBtn.disabled = true;
                    statusMessage.textContent = "No active game";
                    statusMessage.className = "inactive";
                }
            }
        } else {
            await setDoc(doc(db, "game_state", "current"), {
                active: false,
                startedAt: null,
                endedAt: null
            });
            isGameActive = false;
        }

        return isGameActive;
    } catch (err) {
        console.error("Error checking game state:", err);
        displayMessage("Error checking game state");
        return false;
    }
}

async function startNewGame() {
    try {
        if (!isSenior) {
            displayMessage("Only seniors can start a new game");
            return;
        }

        displayMessage("Starting new game...");

        const gameStateRef = doc(db, "game_state", "current");
        await updateDoc(gameStateRef, {
            active: true,
            startedAt: Date.now(),
            endedAt: null
        });

        const teamsCol = collection(db, "teams");
        const teamsSnapshot = await getDocs(teamsCol);
        const batch = writeBatch(db);
        teamsSnapshot.forEach((teamDoc) => {
            batch.update(teamDoc.ref, {
                grain: 0,
                wool: 0,
                brick: 0,
                lumber: 0,
                development_cards: []
            });
        });

        const notificationsSnapshot = await getDocs(notificationsCol);
        notificationsSnapshot.forEach((doc) => {
            batch.delete(doc.ref);
        });

        const tradeRequestsSnapshot = await getDocs(query(
            tradeRequestsCol,
            where("status", "==", "pending")
        ));
        tradeRequestsSnapshot.forEach((doc) => {
            batch.delete(doc.ref);
        });

        await batch.commit();
        isGameActive = true;
        checkGameActive();

        getAllResources();
        if (isSenior) {
            getAllHands();
        }

        displayMessage("New game started successfully!");

        const teamsCol2 = collection(db, "teams");
        const teamsSnapshot2 = await getDocs(teamsCol2);

        teamsSnapshot2.forEach(async (teamDoc) => {
            await addNotification(teamDoc.id, "A new game has been started!");
        });

        window.location.hash = "#home";
        setTimeout(() => {
            window.location.reload();
        }, 300);

    } catch (err) {
        console.error("Error starting new game:", err);
        displayMessage("Error starting new game");
    }
}

async function endGame() {
    try {
        if (!isSenior) {
            displayMessage("Only seniors can end the game");
            return;
        }

        if (!isGameActive) {
            displayMessage("No active game to end");
            return;
        }

        const confirmationContainer = qs("#end-game-confirmation-container");
        if (confirmationContainer) {
            confirmationContainer.classList.remove("hidden");
            return;
        } else {
            displayMessage("Error: Could not find confirmation dialog");
            return;
        }
    } catch (err) {
        console.error("Error preparing to end game:", err);
        displayMessage("Error preparing to end game");
    }
}

async function confirmEndGame(confirmationText) {
    try {
        if (confirmationText !== "end game") {
            displayMessage("Game end cancelled. You must type 'end game' exactly to confirm.");
            return;
        }

        displayMessage("Ending game...");

        const gameStateRef = doc(db, "game_state", "current");
        await updateDoc(gameStateRef, {
            active: false,
            endedAt: Date.now()
        });

        const teamsWithPoints = await calculateFinalScores();
        const highestScore = teamsWithPoints[0].totalPoints;
        const winners = teamsWithPoints.filter(team => team.totalPoints === highestScore);

        await updateDoc(gameStateRef, {
            winners: winners.map(w => w.id),
            isTie: winners.length > 1,
            finalScores: teamsWithPoints.map(team => {
                return {
                    teamId: team.id,
                    resourcePoints: team.points,
                    victoryPoints: team.victoryPoints,
                    totalPoints: team.totalPoints
                };
            })
        });

        for (const team of teamsWithPoints) {
            if (winners.length > 1) {
                const winnerNames = winners.map(w => capitalize(w.id)).join(" and ");
                await addNotification(team.id, `The game has ended! It's a tie between ${winnerNames} teams!`);
            } else {
                const winnerName = capitalize(winners[0].id);
                await addNotification(team.id, `The game has ended! ${winnerName} team wins!`);
            }
        }

        isGameActive = false;
        checkGameActive();

        const confirmationContainer = qs("#end-game-confirmation-container");
        if (confirmationContainer) {
            confirmationContainer.classList.add("hidden");
        }

        const confirmationInput = qs("#end-game-confirmation-input");
        if (confirmationInput) {
            confirmationInput.value = "";
        }

        await displayGameOver(teamsWithPoints);
        displayMessage("Game ended successfully!");

    } catch (err) {
        console.error("Error ending game:", err);
        displayMessage("Error ending game");
    }
}

async function calculateFinalScores() {
    const teamsCol = collection(db, "teams");
    const teamsSnapshot = await getDocs(teamsCol);

    if (teamsSnapshot.empty) {
        displayMessage("No teams found.");
        return [];
    }

    const teamsWithPoints = [];

    teamsSnapshot.forEach(teamDoc => {
        const teamId = teamDoc.id.toLowerCase();
        const data = teamDoc.data();
        const resources = [
            data.grain || 0,
            data.wool || 0,
            data.brick || 0,
            data.lumber || 0
        ];

        const resourcePoints = Math.min(...resources);
        const victoryPoints = (data.development_cards || [])
            .filter(card => card === "Victory Point").length;

        const totalPoints = resourcePoints + victoryPoints;

        teamsWithPoints.push({
            id: teamId,
            points: resourcePoints,
            victoryPoints: victoryPoints,
            totalPoints: totalPoints,
            resources: {
                grain: data.grain || 0,
                wool: data.wool || 0,
                brick: data.brick || 0,
                lumber: data.lumber || 0
            },
            development_cards: data.development_cards || []
        });
    });

    teamsWithPoints.sort((a, b) => b.totalPoints - a.totalPoints);

    return teamsWithPoints;
}

async function displayGameOver(teamsWithPoints) {
    try {
        if (!teamsWithPoints) {
            const gameStateRef = doc(db, "game_state", "current");
            const gameStateDoc = await getDoc(gameStateRef);

            if (gameStateDoc.exists() && gameStateDoc.data().finalScores) {
                const data = gameStateDoc.data();
                const finalScores = data.finalScores;

                teamsWithPoints = finalScores.map(score => ({
                    id: score.teamId,
                    points: score.resourcePoints,
                    victoryPoints: score.victoryPoints,
                    totalPoints: score.totalPoints
                }));

                teamsWithPoints.sort((a, b) => b.totalPoints - a.totalPoints);
            } else {
                teamsWithPoints = await calculateFinalScores();
            }
        }

        if (teamsWithPoints.length === 0) {
            displayMessage("No teams found.");
            return;
        }

        const highestScore = teamsWithPoints[0].totalPoints;
        const winners = teamsWithPoints.filter(team => team.totalPoints === highestScore);
        const isTie = winners.length > 1;
        const winningTeamColor = isTie ? 'gold' : winners[0].id.toLowerCase();

        const gameStateRef = doc(db, "game_state", "current");
        const gameStateDoc = await getDoc(gameStateRef);

        if (!gameStateDoc.exists() || gameStateDoc.data().active) {
            return;
        }

        const gameOver = qs("#game-over");
        if (isTie) {
            gameOver.classList.add("tie");
        } else {
            gameOver.classList.add(winningTeamColor);
        }

        const teamResourcesSection = qs("#team-resources");
        if (teamResourcesSection) {
            const existingBanner = teamResourcesSection.querySelector(".winner-banner");
            if (existingBanner) {
                existingBanner.remove();
            }

            const winnerBanner = document.createElement("div");
            winnerBanner.classList.add("winner-banner");

            if (isTie) {
                const winnerNames = winners.map(w => capitalize(w.id)).join(" and ");
                winnerBanner.innerHTML = `<h3>Game Over! It's a tie between ${winnerNames} teams with ${highestScore} points each!</h3>`;
            } else {
                const winnerName = capitalize(winners[0].id);
                winnerBanner.innerHTML = `<h3>${winnerName} Team Wins with ${highestScore} points!</h3>`;
            }

            if (teamResourcesSection.firstChild) {
                teamResourcesSection.insertBefore(winnerBanner, teamResourcesSection.firstChild);
            } else {
                teamResourcesSection.appendChild(winnerBanner);
            }
        }

        modifyNavigationForGameOver(isSenior);

        const winnerAnnouncement = qs("#winner-announcement");
        if (winnerAnnouncement) {
            if (isTie) {
                const winnerNames = winners.map(w => capitalize(w.id)).join(" and ");
                winnerAnnouncement.textContent = `Tie Game! ${winnerNames} Win!`;
                winnerAnnouncement.style.backgroundColor = "#FFD700";
                winnerAnnouncement.style.color = "black";
            } else {
                const winnerName = capitalize(winners[0].id);
                winnerAnnouncement.textContent = `${winnerName} Team Wins!`;
                winnerAnnouncement.style.backgroundColor = winners[0].id.toLowerCase();

                if (winners[0].id.toLowerCase() === "blue" || winners[0].id.toLowerCase() === "green") {
                    winnerAnnouncement.style.color = "white";
                } else {
                    winnerAnnouncement.style.color = "black";
                }
            }
        }

        const finalScoresSection = qs("#final-scores");
        if (finalScoresSection) {
            finalScoresSection.innerHTML = "";

            teamsWithPoints.forEach((team, index) => {
                const teamSection = gen("div");
                teamSection.classList.add("final-team-score");
                teamSection.classList.add(team.id.toLowerCase());

                if (team.totalPoints === highestScore) {
                    teamSection.classList.add("winner");
                }

                const teamName = capitalize(team.id);
                const victoryPointsText = team.victoryPoints > 0
                    ? `(${team.points} resources + ${team.victoryPoints} victory points)`
                    : "";

                teamSection.innerHTML = `
            <span class="team-name">${teamName} Team</span>
            <div>
              <span class="team-final-points">${team.totalPoints} Points</span>
              <div class="points-breakdown">${victoryPointsText}</div>
            </div>
          `;
                finalScoresSection.appendChild(teamSection);
            });
        }

        const pages = document.querySelectorAll(".page");
        pages.forEach(page => page.classList.add("hidden"));

        const gameOverPage = qs("#game-over");
        if (gameOverPage) {
            gameOverPage.classList.remove("hidden");
        }

        const manageHands = qs("#senior-manage-hands");
        if (manageHands) manageHands.classList.add("hidden");
    } catch (err) {
        console.error("Error displaying game over:", err);
        displayMessage("Error displaying game over screen");
    }
}

function modifyNavigationForGameOver(isSeniorUser) {
    const nav = qs("nav");
    if (!nav) return;

    if (isSeniorUser) {
        nav.innerHTML = `
        <ul>
          <li id="senior-manage-game-btn">Manage Game</li>
        </ul>
        <button id="logout-btn">Logout</button>
      `;

        const seniorManageGameBtn = qs("#senior-manage-game-btn");
        if (seniorManageGameBtn) {
            seniorManageGameBtn.addEventListener("click", () => {
                showPage("senior-manage-game");
            });
        }
    } else {
        nav.innerHTML = `<button id="logout-btn">Logout</button>`;
    }

    const logoutBtn = qs("#logout-btn");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", logout);
    }
}

async function checkGameStateOnLoad() {
    const isActive = await checkGameActive();

    if (!isActive) {
        const gameStateRef = doc(db, "game_state", "current");
        const gameStateDoc = await getDoc(gameStateRef);

        if (gameStateDoc.exists() && (gameStateDoc.data().winners || gameStateDoc.data().finalScores)) {
            if (location.hash.substring(1) === "home" || !location.hash) {
                const teamResourcesSection = qs("#team-resources");

                if (teamResourcesSection) {
                    const existingBanner = teamResourcesSection.querySelector(".winner-banner");

                    if (existingBanner) {
                        teamResourcesSection.removeChild(existingBanner);
                    }

                    const data = gameStateDoc.data();
                    const winners = data.winners || [];
                    const isTie = data.isTie;

                    if (winners && winners.length > 0) {
                        let highestScore = 0;
                        if (data.finalScores && data.finalScores.length > 0) {

                            for (const score of data.finalScores) {
                                if (score.totalPoints > highestScore) {
                                    highestScore = score.totalPoints;
                                }
                            }
                        }

                        const winnerBanner = document.createElement("div");
                        winnerBanner.classList.add("winner-banner");

                        if (isTie) {
                            const winnerNames = winners.map(w => capitalize(w)).join(" and ");
                            winnerBanner.innerHTML = `<h3>Game Over! It's a tie between ${winnerNames} teams with ${highestScore} points each!</h3>`;
                        } else {
                            const winnerName = capitalize(winners[0]);
                            winnerBanner.innerHTML = `<h3>${winnerName} Team Wins with ${highestScore} points!</h3>`;
                        }

                        if (teamResourcesSection.firstChild) {
                            teamResourcesSection.insertBefore(winnerBanner, teamResourcesSection.firstChild);
                        } else {
                            teamResourcesSection.appendChild(winnerBanner);
                        }
                    }
                }
            } else {
                await displayGameOver();
            }
        }
    }
}

function addManageGameToSenior() {
    const seniorManageGameBtn = qs("#senior-manage-game-btn");
    if (seniorManageGameBtn) {
        seniorManageGameBtn.classList.remove("hidden");
        seniorManageGameBtn.addEventListener("click", () => {
            showPage("senior-manage-game");
        });
    }
}

function updateWinnerBannerOnHome() {
    (async () => {
        try {
            const gameStateRef = doc(db, "game_state", "current");
            const gameStateDoc = await getDoc(gameStateRef);

            if (!gameStateDoc.exists() || gameStateDoc.data().active) {

                return;
            }

            const data = gameStateDoc.data();
            const winners = data.winners || [];
            const isTie = data.isTie;

            if (winners && winners.length > 0) {
                let highestScore = 0;
                if (data.finalScores && data.finalScores.length > 0) {

                    for (const score of data.finalScores) {
                        if (score.totalPoints > highestScore) {
                            highestScore = score.totalPoints;
                        }
                    }
                }

                const teamResourcesSection = qs("#team-resources");
                if (!teamResourcesSection) {
                    console.error("Could not find team resources section");
                    return;
                }

                const existingBanner = teamResourcesSection.querySelector(".winner-banner");
                if (existingBanner) {
                    teamResourcesSection.removeChild(existingBanner);
                }

                const winnerBanner = document.createElement("div");
                winnerBanner.classList.add("winner-banner");
                winnerBanner.style.backgroundColor = "#ffd700";
                winnerBanner.style.padding = "1rem";
                winnerBanner.style.marginBottom = "1.5rem";
                winnerBanner.style.borderRadius = "6px";
                winnerBanner.style.textAlign = "center";
                winnerBanner.style.boxShadow = "0 2px 5px rgba(0, 0, 0, 0.2)";

                if (isTie) {
                    const winnerNames = winners.map(w => capitalize(w)).join(" and ");
                    winnerBanner.innerHTML = `<h3 style="margin:0;font-size:1.3rem;">Game Over! It's a tie between ${winnerNames} teams with ${highestScore} points each!</h3>`;
                } else {
                    const winnerName = capitalize(winners[0]);
                    winnerBanner.innerHTML = `<h3 style="margin:0;font-size:1.3rem;">${winnerName} Team Wins with ${highestScore} points!</h3>`;
                }

                if (teamResourcesSection.firstChild) {
                    teamResourcesSection.insertBefore(winnerBanner, teamResourcesSection.firstChild);
                } else {
                    teamResourcesSection.appendChild(winnerBanner);
                }
            }
        } catch (err) {
            console.error("Error updating winner banner:", err);
        }
    })();
}

function updatePopulatePageContent() {
    const originalPopulatePageContent = populatePageContent;

    return function (pageId) {
        originalPopulatePageContent(pageId);

        if (pageId === "home") {
            setTimeout(() => {
                updateWinnerBannerOnHome();
            }, 500);
        } else if (pageId === "senior-manage-game") {
            setTimeout(() => {
                setupSimplifiedEndGame();
            }, 100);
        }

        updateGameManagementPageContent(pageId);
    };
}

function addGameManagementEventListeners() {
    const startNewGameBtn = qs("#start-new-game-btn");
    if (startNewGameBtn) {
        startNewGameBtn.addEventListener("click", startNewGame);
    }

    const endGameBtn = qs("#end-game-btn");
    if (endGameBtn) {
        endGameBtn.addEventListener("click", endGame);
    }

    const confirmEndGameBtn = qs("#confirm-end-game-btn");
    if (confirmEndGameBtn) {
        confirmEndGameBtn.addEventListener("click", () => {
            const confirmationInput = qs("#end-game-confirmation-input");
            if (confirmationInput) {
                confirmEndGame(confirmationInput.value.trim().toLowerCase());
            }
        });
    } else {
        console.error("Could not find confirmation button");
    }

    const cancelEndGameBtn = qs("#cancel-end-game-btn");
    if (cancelEndGameBtn) {
        cancelEndGameBtn.addEventListener("click", () => {
            const confirmationContainer = qs("#end-game-confirmation-container");
            if (confirmationContainer) {
                confirmationContainer.classList.add("hidden");
            }

            const confirmationInput = qs("#end-game-confirmation-input");
            if (confirmationInput) {
                confirmationInput.value = "";
            }
        });
    } else {
        console.error("Could not find cancel button");
    }

    const confirmationInput = qs("#end-game-confirmation-input");
    if (confirmationInput) {
        confirmationInput.addEventListener("keypress", (e) => {
            if (e.key === "Enter") {
                confirmEndGame(confirmationInput.value.trim().toLowerCase());
            }
        });
    }
}

populatePageContent = updatePopulatePageContent();

window.addEventListener("DOMContentLoaded", function () {
    setupGameManagement();

    if (auth.currentUser || localStorage.getItem("loggedIn") === "true") {
        checkGameStateOnLoad();
    }
});

function setupGameManagement() {
    checkGameActive();
    addGameManagementEventListeners();
}

function updateGameManagementPageContent(pageId) {
    if (pageId === "senior-manage-game") {
        checkGameActive();
        addGameManagementEventListeners();
    }
}

async function confirmEndGameExecution() {
    try {
        displayMessage("Ending game...");

        const gameStateRef = doc(db, "game_state", "current");
        await updateDoc(gameStateRef, {
            active: false,
            endedAt: Date.now()
        });

        const teamsWithPoints = await calculateFinalScores();
        console.log("Final scores:", teamsWithPoints.map(t => ({
            team: t.id,
            points: t.points,
            victoryPoints: t.victoryPoints,
            totalPoints: t.totalPoints
        })));

        const highestScore = teamsWithPoints[0].totalPoints;
        const winners = teamsWithPoints.filter(team => team.totalPoints === highestScore);

        await updateDoc(gameStateRef, {
            winners: winners.map(w => w.id),
            isTie: winners.length > 1,
            finalScores: teamsWithPoints.map(team => {
                return {
                    teamId: team.id,
                    resourcePoints: team.points,
                    victoryPoints: team.victoryPoints,
                    totalPoints: team.totalPoints
                };
            })
        });

        for (const team of teamsWithPoints) {
            if (winners.length > 1) {
                const winnerNames = winners.map(w => capitalize(w.id)).join(" and ");
                await addNotification(team.id, `The game has ended! It's a tie between ${winnerNames} teams!`);
            } else {
                const winnerName = capitalize(winners[0].id);
                await addNotification(team.id, `The game has ended! ${winnerName} team wins!`);
            }
        }

        isGameActive = false;
        await checkGameActive();
        await displayGameOver(teamsWithPoints);

        if (location.hash.substring(1) === "home" || !location.hash) {
            updateWinnerBannerOnHome();
        }

        displayMessage("Game ended successfully!");

    } catch (err) {
        console.error("Error ending game:", err);
        displayMessage("Error ending game");
    }
}

function setupSimplifiedEndGame() {
    const endGameBtn = qs("#end-game-btn");
    if (!endGameBtn) {
        console.error("Could not find end game button");
        return;
    }

    const newBtn = endGameBtn.cloneNode(true);
    endGameBtn.parentNode.replaceChild(newBtn, endGameBtn);

    newBtn.addEventListener("click", function () {
        if (!isSenior) {
            displayMessage("Only seniors can end the game");
            return;
        }

        if (!isGameActive) {
            displayMessage("No active game to end");
            return;
        }

        const confirmText = window.prompt(
            "WARNING: This will end the current game and display final scores. This action cannot be undone.\n\n" +
            "Type 'end game' to confirm:"
        );

        if (confirmText === null) {
            displayMessage("Game end cancelled");
            return;
        }

        if (confirmText.toLowerCase() !== "end game") {
            displayMessage("Game end cancelled. You must type 'end game' exactly to confirm.");
            return;
        }

        confirmEndGameExecution()
            .then(() => {
                const homeBtn = qs("#home-btn");
                if (homeBtn) {
                    const originalClick = homeBtn.onclick;
                    homeBtn.onclick = function (e) {
                        if (originalClick) originalClick.call(this, e);
                        setTimeout(updateWinnerBannerOnHome, 500);
                    };
                }
            })
            .catch(err => {
                console.error("Error ending game:", err);
                displayMessage("Error ending game. Please try again.");
            });
    });
}

async function loadTeamData(userId) {
    try {
        const q = query(collection(db, "users"), where("uid", "==", userId));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            throw new Error("User data not found");
        }

        const userDoc = querySnapshot.docs[0];

        const userData = userDoc.data();
        const userTeamColor = userData.teamId || "";
        if (userTeamColor === seniorRole) {
            isSenior = true;
            localStorage.setItem("isSenior", "true");
        } else {
            teamColor = userTeamColor;
            localStorage.setItem("teamColor", userTeamColor);
        }
    } catch (err) {
        console.error("Failed to load team data:", err);
    }
}

function setupNavigationBasedOnRole() {
    const nav = qs("nav");
    if (nav) nav.classList.remove("hidden");

    if (isSenior) {
        if (isGameActive) {
            const seniorSeeHandsBtn = qs("#senior-see-hands-btn");
            if (seniorSeeHandsBtn) seniorSeeHandsBtn.classList.remove("hidden");

            const notificationsBtn = qs("#notifications-btn");
            if (notificationsBtn) notificationsBtn.classList.remove("hidden");
        }

        const seeHandBtn = qs("#see-hand-btn");
        if (seeHandBtn) seeHandBtn.classList.add("hidden");

        const manageTradesBtn = qs("#manage-trades-btn");
        if (manageTradesBtn) manageTradesBtn.classList.add("hidden");

        const seniorManageGameBtn = qs("#senior-manage-game-btn");
        if (seniorManageGameBtn) seniorManageGameBtn.classList.remove("hidden");

        getAllHands();
    } else {
        if (isGameActive) {
            const seeHandBtn = qs("#see-hand-btn");
            if (seeHandBtn) seeHandBtn.classList.remove("hidden");

            const manageTradesBtn = qs("#manage-trades-btn");
            if (manageTradesBtn) manageTradesBtn.classList.remove("hidden");

            const notificationsBtn = qs("#notifications-btn");
            if (notificationsBtn) notificationsBtn.classList.remove("hidden");
            populateTeamsDropdown();
            listenForIncomingTrades();
            populateRobberTargetDropdown();
            loadDevCardDescriptions();
        } else {
            nav.innerHTML = `<button id="logout-btn">Logout</button>`;
        }
    }

    const logoutBtn = qs("#logout-btn");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", logout);
    }
}

qs("#submit-login").addEventListener("click", function (e) {
    e.preventDefault();
    const email = document.getElementById("loginEmail").value;
    const password = document.getElementById("loginPassword").value;
    login(email, password);
});

function setupAfterLogin() {
    checkGameActive().then(isGameActive => {
        if (!isGameActive) {
            const gameStateRef = doc(db, "game_state", "current");
            getDoc(gameStateRef).then(gameStateDoc => {
                if (gameStateDoc.exists() && gameStateDoc.data().winners) {
                    modifyNavigationForGameOver(isSenior);
                    displayGameOver();
                    return;
                } else {
                    setupNavigationBasedOnRole();
                }
            });
        } else {
            setupNavigationBasedOnRole();
        }
    });

    listenForNotifications();
}
