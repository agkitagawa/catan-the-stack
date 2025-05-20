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

const auth = getAuth();
const tradeRequestsCol = collection(db, "trade_requests");
const notificationsCol = collection(db, "notifications");
const recentNotifications = new Map();
let teamColor = "";
const seniorRole = "Senior";
let isSenior = false;
let authCheckComplete = false;
let isGameActive = false;
let initialHash = "";

if ('scrollRestoration' in history) {
    history.scrollRestoration = 'auto';
}

/* event listeners */
function wholePageEvenListeners() {
    window.addEventListener("DOMContentLoaded", function () {
        initialHash = location.hash.substring(1);

        if (initialHash && initialHash !== "login" && initialHash !== "loading") {
            sessionStorage.setItem("initialHash", initialHash);
        }

        setupHamburgerMenu();
    });

    window.addEventListener("hashchange", () => {
        const user = auth.currentUser;
        const isLoggedInFromStorage = localStorage.getItem("loggedIn") === "true";
        const currentHash = location.hash.substring(1);

        if (accessDeniedMessageShown) {
            accessDeniedMessageShown = false;
            return;
        }

        if (!user && !isLoggedInFromStorage && currentHash !== "login") {
            history.replaceState({ pageId: "login" }, "", "#login");
            showPage("login", false);
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

    window.addEventListener("hashchange", () => {
        const user = auth.currentUser;
        const isLoggedInFromStorage = localStorage.getItem("loggedIn") === "true";

        if (!user && !isLoggedInFromStorage && location.hash !== "#login") {
            history.replaceState({ pageId: "login" }, "", "#login");
            showPage("login", false);
        }
    });

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

    window.addEventListener("DOMContentLoaded", function () {
        setupGameManagement();

        if (auth.currentUser || localStorage.getItem("loggedIn") === "true") {
            checkGameStateOnLoad();
        }
    });
}

function initCardPageEventListeners() {

    window.addEventListener("DOMContentLoaded", function () {
        const hash = location.hash.substring(1);

        if (hash === "use-robber") {
            setTimeout(fixRobberButtonListener, 100);
        } else if (hash === "use-choose-2-resources") {
            setTimeout(() => {
                fixChoose2ButtonListener();
                removeChoose2ButtonSetup();
            }, 100);
        }
    });

    window.addEventListener("hashchange", function () {
        const hash = location.hash.substring(1);

        if (hash === "use-robber") {
            setTimeout(fixRobberButtonListener, 100);
        } else if (hash === "use-choose-2-resources") {
            setTimeout(() => {
                fixChoose2ButtonListener();
                removeChoose2ButtonSetup();
            }, 100);
        }
    });
}

initCardPageEventListeners();

/* login/logout */
async function login() {
    const email = qs("#loginEmail").value.trim();
    const password = qs("#loginPassword").value.trim();

    if (!email || !password) {
        return displayMessage("Please enter an email and password.");
    }

    try {
        showPage("loading", false);
        await signInWithEmailAndPassword(auth, email, password);
        localStorage.setItem("currentPage", "home");
        sessionStorage.removeItem("initialHash");
        displayMessage("Login successful!");
    } catch (err) {
        console.error("Login error:", err);
        displayMessage("Login failed: invalid credentials");
        showPage("login", false);
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

        const email = qs("#loginEmail");
        const password = qs("#loginPassword");
        if (email) email.value = "";
        if (password) password.value = "";

        document.querySelectorAll("form").forEach(f => f.reset());
        setDropdownDefaults();
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

/* user handling */
onAuthStateChanged(auth, (user) => {
    authCheckComplete = true;

    if (user) {
        localStorage.setItem("loggedIn", "true");

        showPage("loading", false);

        loadTeamData(user.uid).then(() => {
            if (localStorage.getItem("isSenior") === "true") {
                isSenior = true;
                teamColor = "";
                addManageGameToSenior();
            } else {
                isSenior = false;
                teamColor = localStorage.getItem("teamColor") || "";
            }

            return setupAfterLogin();
        }).then(() => {
            return checkGameActive();
        }).then((isActiveGame) => {
            let pageToShow = isActiveGame ? "home" : "game-over";

            const storedPage = localStorage.getItem("pageToRestore");
            const initialHash = sessionStorage.getItem("initialHash");

            if (storedPage && isActiveGame) {
                pageToShow = storedPage;
                localStorage.removeItem("pageToRestore");
            } else if (initialHash && isActiveGame) {
                pageToShow = initialHash;
                sessionStorage.removeItem("initialHash");
            }

            showPage(pageToShow, false);

            history.replaceState({ pageId: pageToShow }, "", `#${pageToShow}`);
        }).catch(err => {
            console.error("Error during authentication flow:", err);
            showPage("home", false);
        });

        forceVerifyUserRole();
    } else {
        localStorage.removeItem("loggedIn");
        localStorage.removeItem("teamColor");
        localStorage.removeItem("isSenior");

        teamColor = "";
        isSenior = false;

        const email = qs("#loginEmail");
        const password = qs("#loginPassword");
        if (email) email.value = "";
        if (password) password.value = "";

        history.replaceState(null, "", "#login");
        showPage("login", false);
    }
});

function enforceAuthCheck(event) {
    const user = auth.currentUser;
    if (!user) {
        history.replaceState(null, "", "#login");
        showPage("login", false);
        if (event) event.preventDefault();
    }
}

/* get information from firebase */
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

async function getAllResources() {
    try {
        const teamsWithPoints = await calculatePoints();
        if (teamsWithPoints.length === 0) {
            displayMessage("No teams found.");
            return false;
        }

        teamsWithPoints.forEach(team => {
            const teamContainer = qs(`#${team.id.toLowerCase()}-resources`);
            if (!teamContainer) {
                console.warn(`Team container not found for ${team.id}`);
                return;
            }

            teamContainer.innerHTML = '';

            const resources = ["grain", "wool", "brick", "lumber"];
            resources.forEach(resource => {
                const amount = team.resources[resource] || 0;
                const cardContainer = createResourceCard(resource, amount);
                teamContainer.appendChild(cardContainer);
            });
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
        const teamOrder = ["green", "red", "blue", "white"];

        const teamsMap = {};
        teamsWithPoints.forEach(team => {
            teamsMap[team.id.toLowerCase()] = team;
        });

        teamOrder.forEach(teamId => {
            const team = teamsMap[teamId];

            if (!team) return;

            const teamSection = gen("section");
            teamSection.classList.add("senior-team-hand");

            const teamHeader = gen("h3");
            const teamName = capitalize(teamId);
            teamHeader.textContent = `${teamName} (${team.points} Points)`;
            teamSection.appendChild(teamHeader);

            const pointsDetails = gen("p");
            pointsDetails.classList.add("points-details");
            pointsDetails.classList.add("hidden");
            teamSection.appendChild(pointsDetails);

            const devCardsHeader = gen("h4");
            devCardsHeader.textContent = "Development Cards";
            teamSection.appendChild(devCardsHeader);

            const devCardsContainer = gen("section");
            devCardsContainer.classList.add("cards-container", "dev-cards-container");
            teamSection.appendChild(devCardsContainer);

            const resourcesHeader = gen("h4");
            resourcesHeader.textContent = "Resources";
            teamSection.appendChild(resourcesHeader);

            const resourcesContainer = gen("section");
            resourcesContainer.classList.add("cards-container", "resources-container");
            teamSection.appendChild(resourcesContainer);

            const resources = ["grain", "wool", "brick", "lumber"];
            resources.forEach(resource => {
                const amount = team.resources[resource] || 0;
                const cardContainer = createResourceCard(resource, amount);
                resourcesContainer.appendChild(cardContainer);
            });

            const devCards = team.development_cards || [];

            if (devCards && devCards.length > 0) {
                const victoryPoints = devCards.filter(card => card === "Victory Point").length;

                if (victoryPoints > 0) {
                    const totalPoints = gen("p");
                    totalPoints.classList.add("total-points");
                    totalPoints.innerHTML = `<strong>Total Points w/ VP cards:</strong> ${team.points + victoryPoints}`;
                    teamSection.insertBefore(totalPoints, pointsDetails.nextSibling);
                }

                const cardCounts = {};
                devCards.forEach(card => {
                    cardCounts[card] = (cardCounts[card] || 0) + 1;
                });

                Object.keys(cardCounts).forEach(cardType => {
                    const cardContainer = createDevCard(cardType, cardCounts[cardType]);
                    devCardsContainer.appendChild(cardContainer);
                });
            } else {
                const noCardsMsg = gen("p");
                noCardsMsg.textContent = "No development cards";
                devCardsContainer.appendChild(noCardsMsg);
            }

            seniorHandsContainer.appendChild(teamSection);
        });
    } catch (err) {
        console.error("Error loading teams resources:", err);
        displayMessage("Failed to load teams resources.");
    }
}

async function loadTeamData(userId) {
    try {
        const q = query(collection(db, "users"), where("uid", "==", userId));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            console.error("User data not found for userId:", userId);
            throw new Error("User data not found");
        }

        const userDoc = querySnapshot.docs[0];
        const userData = userDoc.data();
        const userTeamColor = userData.teamId || "";

        teamColor = "";
        isSenior = false;

        if (userTeamColor === seniorRole) {
            isSenior = true;
            localStorage.setItem("isSenior", "true");
            localStorage.removeItem("teamColor");
        } else {
            teamColor = userTeamColor;
            localStorage.setItem("teamColor", userTeamColor);
            localStorage.setItem("isSenior", "false");
        }

        ensureSeniorStatusIsSynchronized();

        return true;
    } catch (err) {
        console.error("Failed to load team data:", err);
        return false;
    }
}

async function loadDevCardDescriptions() {
    try {
        const snapshot = await getDocs(devCardInfoRef);
        devCardDescriptions = {};
        snapshot.forEach(doc => {
            devCardDescriptions[doc.id] = doc.data().description;
        });
        return devCardDescriptions;
    } catch (error) {
        console.error("Error loading dev card descriptions:", error);
        displayMessage("Failed to load card descriptions");
        return {};
    }
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

function resetForms() {
    document.querySelectorAll("form").forEach(form => form.reset());
    setDropdownDefaults();
}

/* button listeners */
function setUpButtons() {
    ensureSeniorStatusIsSynchronized();

    const oldLoginForm = qs("#login-form");
    const oldLogoutBtn = qs("#logout-btn");
    const oldSeniorSeeHandsBtn = qs("#senior-see-hands-btn");
    const oldSeniorSubmitAssignResourcesBtn = qs("#submit-assign-resources");
    const oldSeniorSubmitAssignRandomDevCardBtn = qs("#submit-assign-random-dev-card");
    const oldSeniorSubmitAssignSpecificDevCardBtn = qs("#submit-assign-specific-dev-card");
    const oldSeniorSubmitRemoveResourcesBtn = qs("#submit-remove-resources");
    const oldSeniorSubmitRemoveDevCardBtn = qs("#submit-remove-dev-card");
    const oldSeeHandBtn = qs("#see-hand-btn");
    const oldSubmitTradeBtn = qs("#submit-trade-request");
    const oldManageTradesBtn = qs("#manage-trades-btn");
    const oldSubmitRobberRequestBtn = qs("#submit-robber-request");
    const oldSubmitChoose2RequestBtn = qs("#submit-choose-2-request");
    const oldNotificationsBtn = qs("#notifications-btn");

    let newLoginForm;
    let newLogoutBtn;
    let newSeniorSeeHandsBtn;
    let newSeniorSubmitAssignResourcesBtn;
    let newSeniorSubmitAssignRandomDevCardBtn;
    let newSeniorSubmitAssignSpecificDevCardBtn;
    let newSeniorSubmitRemoveResourcesBtn;
    let newSeniorSubmitRemoveDevCardBtn;
    let newSeeHandBtn;
    let newSubmitTradeBtn;
    let newManageTradesBtn;
    let newSubmitRobberRequestBtn;
    let newSubmitChoose2RequestBtn;
    let newNotificationsBtn;

    if (oldLoginForm) {
        newLoginForm = oldLoginForm.cloneNode(true);
        oldLoginForm.parentNode.replaceChild(newLoginForm, oldLoginForm);
        oldLoginForm.addEventListener("submit", login);
    }

    qs("#submit-login").addEventListener("click", function (e) {
        e.preventDefault();
        const email = document.getElementById("loginEmail").value;
        const password = document.getElementById("loginPassword").value;
        login(email, password);
    });

    if (oldLogoutBtn) {
        newLogoutBtn = oldLogoutBtn.cloneNode(true);
        oldLogoutBtn.parentNode.replaceChild(newLogoutBtn, oldLogoutBtn);
        oldLogoutBtn.addEventListener("submit", logout);
    }

    if (oldSeniorSeeHandsBtn) {
        newSeniorSeeHandsBtn = oldSeniorSeeHandsBtn.cloneNode(true);
        oldSeniorSeeHandsBtn.parentNode.replaceChild(newSeniorSeeHandsBtn, oldSeniorSeeHandsBtn);

        if (isSenior || localStorage.getItem("isSenior") === "true") {
            newSeniorSeeHandsBtn.addEventListener("click", () => {
                ensureSeniorStatusIsSynchronized();
                showPage("senior-see-hands");
            });
        } else {
            newSeniorSeeHandsBtn.addEventListener("click", () => {
                displayMessage("Bro, you're not a senior.");
            });
        }
    }

    if (oldSeniorSubmitAssignResourcesBtn) {
        newSeniorSubmitAssignResourcesBtn = oldSeniorSubmitAssignResourcesBtn.cloneNode(true);
        oldSeniorSubmitAssignResourcesBtn.parentNode.replaceChild(newSeniorSubmitAssignResourcesBtn, oldSeniorSubmitAssignResourcesBtn);

        if (isSenior || localStorage.getItem("isSenior") === "true") {
            newSeniorSubmitAssignResourcesBtn.addEventListener("click", () => {
                ensureSeniorStatusIsSynchronized();
                const team = qs("#team-to-assign-resources").value;
                const resource = qs("#resource-to-assign").value;
                const amount = Number(qs("#amount-to-assign").value);
                if (amount < 1) {
                    displayMessage("Amount must be at least 1.");
                    return;
                }
                assignResourceCard(team, resource, amount);
                resetForms();
            });
        } else {
            newSeniorSubmitAssignResourcesBtn.addEventListener("click", () => {
                displayMessage("Bro, you're not a senior.");
            });
        }
    }

    if (oldSeniorSubmitAssignRandomDevCardBtn) {
        newSeniorSubmitAssignRandomDevCardBtn = oldSeniorSubmitAssignRandomDevCardBtn.cloneNode(true);
        oldSeniorSubmitAssignRandomDevCardBtn.parentNode.replaceChild(newSeniorSubmitAssignRandomDevCardBtn, oldSeniorSubmitAssignRandomDevCardBtn);

        if (isSenior || localStorage.getItem("isSenior") === "true") {
            newSeniorSubmitAssignRandomDevCardBtn.addEventListener("click", () => {
                ensureSeniorStatusIsSynchronized();
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
                resetForms();
            });
        } else {
            newSeniorSubmitAssignRandomDevCardBtn.addEventListener("click", () => {
                displayMessage("Bro, you're not a senior.");
            });
        }
    }

    if (oldSeniorSubmitAssignSpecificDevCardBtn) {
        newSeniorSubmitAssignSpecificDevCardBtn = oldSeniorSubmitAssignSpecificDevCardBtn.cloneNode(true);
        oldSeniorSubmitAssignSpecificDevCardBtn.parentNode.replaceChild(newSeniorSubmitAssignSpecificDevCardBtn, oldSeniorSubmitAssignSpecificDevCardBtn);

        if (isSenior || localStorage.getItem("isSenior") === "true") {
            newSeniorSubmitAssignSpecificDevCardBtn.addEventListener("click", () => {
                ensureSeniorStatusIsSynchronized();
                const team = qs("#team-to-assign-specific-dev-card").value;
                const card = qs("#dev-card-to-assign").value;
                assignDevCard(team, card);
                resetForms();
            });
        } else {
            newSeniorSubmitAssignSpecificDevCardBtn.addEventListener("click", () => {
                displayMessage("Bro, you're not a senior.");
            });
        }
    }

    if (oldSeniorSubmitRemoveResourcesBtn) {
        newSeniorSubmitRemoveResourcesBtn = oldSeniorSubmitRemoveResourcesBtn.cloneNode(true);
        oldSeniorSubmitRemoveResourcesBtn.parentNode.replaceChild(newSeniorSubmitRemoveResourcesBtn, oldSeniorSubmitRemoveResourcesBtn);

        if (isSenior || localStorage.getItem("isSenior") === "true") {
            newSeniorSubmitRemoveResourcesBtn.addEventListener("click", () => {
                ensureSeniorStatusIsSynchronized();
                const team = qs("#team-to-remove-resources").value;
                const resource = qs("#resource-to-remove").value;
                const amount = Number(qs("#amount-to-remove").value);
                if (amount < 1) {
                    displayMessage("Amount must be at least 1.");
                    return;
                }
                removeResourceCard(team, resource, amount);
                resetForms();
            });
        } else {
            newSeniorSubmitRemoveResourcesBtn.addEventListener("click", () => {
                displayMessage("Bro, you're not a senior.");
            });
        }
    }

    if (oldSeniorSubmitRemoveDevCardBtn) {
        newSeniorSubmitRemoveDevCardBtn = oldSeniorSubmitRemoveDevCardBtn.cloneNode(true);
        oldSeniorSubmitRemoveDevCardBtn.parentNode.replaceChild(newSeniorSubmitRemoveDevCardBtn, oldSeniorSubmitRemoveDevCardBtn);

        if (isSenior || localStorage.getItem("isSenior") === "true") {
            newSeniorSubmitRemoveDevCardBtn.addEventListener("click", () => {
                ensureSeniorStatusIsSynchronized();
                const team = qs("#team-to-remove-dev-card").value;
                const card = qs("#dev-card-to-remove").value;
                removeDevCard(team, card);
                resetForms();
            });
        } else {
            newSeniorSubmitRemoveDevCardBtn.addEventListener("click", () => {
                displayMessage("Bro, you're not a senior.");
            });
        }
    }

    if (oldSeeHandBtn) {
        newSeeHandBtn = oldSeeHandBtn.cloneNode(true);
        oldSeeHandBtn.parentNode.replaceChild(newSeeHandBtn, oldSeeHandBtn);

        if (!isSenior || localStorage.getItem("isSenior") !== "true") {
            newSeeHandBtn.addEventListener("click", () => {
                showPage("personal-hand");
            });
        } else {
            newSeeHandBtn.addEventListener("click", () => {
                displayMessage("What are you doing? Aren't you a senior?");
            });
        }
    }

    if (oldSubmitTradeBtn) {
        newSubmitTradeBtn = oldSubmitTradeBtn.cloneNode(true);
        oldSubmitTradeBtn.parentNode.replaceChild(newSubmitTradeBtn, oldSubmitTradeBtn);

        if (!isSenior || localStorage.getItem("isSenior") !== "true") {
            newSubmitTradeBtn.addEventListener("click", () => {
                submitTradeRequest();
            });
        } else {
            newSubmitTradeBtn.addEventListener("click", () => {
                displayMessage("What are you doing? Aren't you a senior?");
            });
        }
    }

    if (oldManageTradesBtn) {
        newManageTradesBtn = oldManageTradesBtn.cloneNode(true);
        oldManageTradesBtn.parentNode.replaceChild(newManageTradesBtn, oldManageTradesBtn);

        if (!isSenior || localStorage.getItem("isSenior") !== "true") {
            newManageTradesBtn.addEventListener("click", () => {
                const tradeRequestsTimestamp = qs("#trade-requests-last-updated");
                if (tradeRequestsTimestamp) {
                    tradeRequestsTimestamp.textContent = `Last updated: ${new Date().toLocaleTimeString()}`;
                }
                showPage("manage-trades");
            });
        } else {
            newManageTradesBtn.addEventListener("click", () => {
                displayMessage("What are you doing? Aren't you a senior?");
            });
        }
    }

    if (oldSubmitRobberRequestBtn) {
        newSubmitRobberRequestBtn = oldSubmitRobberRequestBtn.cloneNode(true);
        oldSubmitRobberRequestBtn.parentNode.replaceChild(newSubmitRobberRequestBtn, oldSubmitRobberRequestBtn);

        if (!isSenior || localStorage.getItem("isSenior") !== "true") {
            newSubmitRobberRequestBtn.addEventListener("click", () => {
                useRobber();
            });
        } else {
            newSubmitRobberRequestBtn.addEventListener("click", () => {
                displayMessage("What are you doing? Aren't you a senior?");
            });
        }
    }

    if (oldSubmitChoose2RequestBtn) {
        newSubmitChoose2RequestBtn = oldSubmitChoose2RequestBtn.cloneNode(true);
        oldSubmitChoose2RequestBtn.parentNode.replaceChild(newSubmitChoose2RequestBtn, oldSubmitChoose2RequestBtn);

        if (!isSenior || localStorage.getItem("isSenior") !== "true") {
            newSubmitChoose2RequestBtn.addEventListener("click", () => {
                useChoose2Resources();
            });
        } else {
            newSubmitChoose2RequestBtn.addEventListener("click", () => {
                displayMessage("What are you doing? Aren't you a senior?");
            });
        }
    }

    if (oldNotificationsBtn) {
        newNotificationsBtn = oldNotificationsBtn.cloneNode(true);
        oldNotificationsBtn.parentNode.replaceChild(newNotificationsBtn, oldNotificationsBtn);

        newNotificationsBtn.addEventListener("click", () => {
            const notificationsTimestamp = qs("#notifications-last-updated");
            if (notificationsTimestamp) {
                notificationsTimestamp.textContent = `Last updated: ${new Date().toLocaleTimeString()}`;
            }
            showPage("notifications");
        });
    }
}

function fixHomeButtonListener() {
    const homeBtn = qs("#home-btn");
    if (!homeBtn) {
        console.error("Home button not found");
        return;
    }

    const newBtn = homeBtn.cloneNode(true);
    homeBtn.parentNode.replaceChild(newBtn, homeBtn);

    newBtn.addEventListener("click", async () => {
        try {
            const gameStateRef = doc(db, "game_state", "current");
            const gameStateDoc = await getDoc(gameStateRef);

            if (gameStateDoc.exists()) {
                const data = gameStateDoc.data();
                isGameActive = data.active || false;
            } else {
                isGameActive = false;
            }

            if (isGameActive) {
                if (auth.currentUser || localStorage.getItem("teamColor")) {
                    getAllResources();
                    const leaderboardTimestamp = qs("#leaderboard-last-updated");
                    if (leaderboardTimestamp) {
                        leaderboardTimestamp.textContent = `Last updated: ${new Date().toLocaleTimeString()}`;
                    }
                    showPage("home");
                } else {
                }
            } else {
                showPage("game-over");
            }
        } catch (err) {
            console.error("Error in home button handler:", err);
            showPage("home");
        }
    });
}

fixHomeButtonListener();

function fixTradeButtonEventHandlers() {

    const submitTradeBtn = qs("#submit-trade-request");
    if (submitTradeBtn) {
        const newBtn = submitTradeBtn.cloneNode(true);
        submitTradeBtn.parentNode.replaceChild(newBtn, submitTradeBtn);

        newBtn.addEventListener("click", function () {
            const userIsSenior = isSenior || localStorage.getItem("isSenior") === "true";
            if (userIsSenior) {
                displayMessage("What are you doing? Aren't you a senior?");
            } else {
                submitTradeRequest();
            }
        });
    }
}

function fixTradeRequestButton() {
    const requestFrom = qs("#team-to-request-from");
    const requestTradeBtn = qs("#submit-trade-request");

    if (!requestFrom || !requestTradeBtn) return;

    function updateButtonState() {
        const teamSelected = requestFrom.value;

        const resources = ["grain", "wool", "brick", "lumber"];
        let hasOffer = false;
        let hasRequest = false;

        for (const resource of resources) {
            const offerValue = parseInt(qs(`#offer-${resource}`).value, 10) || 0;
            const requestValue = parseInt(qs(`#request-${resource}`).value, 10) || 0;

            if (offerValue > 0) hasOffer = true;
            if (requestValue > 0) hasRequest = true;
        }

        requestTradeBtn.disabled = !(teamSelected && (hasOffer && hasRequest));
    }

    requestFrom.addEventListener("change", updateButtonState);

    const resources = ["grain", "wool", "brick", "lumber"];
    resources.forEach(resource => {
        const offerInput = qs(`#offer-${resource}`);
        const requestInput = qs(`#request-${resource}`);

        if (offerInput) offerInput.addEventListener("input", updateButtonState);
        if (requestInput) requestInput.addEventListener("input", updateButtonState);
    });

    updateButtonState();
}

fixTradeRequestButton();

/* force selections */
function forceSelections() {
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
}

function setDropdownDefaults() {
    const resource1Dropdown = qs("#choose-2-resource1");
    const resource2Dropdown = qs("#choose-2-resource2");

    if (resource1Dropdown) {
        let hasEmptyOption = false;
        for (let i = 0; i < resource1Dropdown.options.length; i++) {
            if (resource1Dropdown.options[i].value === "") {
                hasEmptyOption = true;
                break;
            }
        }

        if (!hasEmptyOption) {
            const emptyOption = document.createElement("option");
            emptyOption.value = "";
            emptyOption.text = "Select resource";
            emptyOption.selected = true;
            emptyOption.disabled = true;

            resource1Dropdown.insertBefore(emptyOption, resource1Dropdown.firstChild);
        }

        resource1Dropdown.value = "";
    }

    if (resource2Dropdown) {
        let hasEmptyOption = false;
        for (let i = 0; i < resource2Dropdown.options.length; i++) {
            if (resource2Dropdown.options[i].value === "") {
                hasEmptyOption = true;
                break;
            }
        }

        if (!hasEmptyOption) {
            const emptyOption = document.createElement("option");
            emptyOption.value = "";
            emptyOption.text = "Select resource";
            emptyOption.selected = true;
            emptyOption.disabled = true;

            resource2Dropdown.insertBefore(emptyOption, resource2Dropdown.firstChild);
        }

        resource2Dropdown.value = "";
    }

    const robberDropdown = qs("#robber-target-team");
    if (robberDropdown) {
        robberDropdown.value = "";
    }
}

/* display stuff */
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

function showPage(pageId, pushState = true) {
    if (!document.getElementById(pageId)) {
      displayMessage("Invalid URL — redirecting to Home");
      pageId = "home";
      history.replaceState({ pageId }, "", "#home");
    }

    forceSeniorRoleCheck();

    if (pageId === "loading") {
        const pages = document.querySelectorAll(".page");
        pages.forEach(page => page.classList.add("hidden"));
        const loadingPage = document.querySelector("#loading");
        if (loadingPage) {
            loadingPage.classList.remove("hidden");
            const menuToggle = qs("#menu-toggle");
            if (menuToggle) menuToggle.classList.add("hidden");
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

    ensureSeniorStatusIsSynchronized();

    if (pageId !== "login" && pageId !== "loading" && pageId !== "home" && pageId !== "game-over" && !checkPageAccess(pageId)) {
        setTimeout(() => {
            const safePage = isGameActive ? "home" : "game-over";
            history.replaceState({ pageId: safePage }, "", `#${safePage}`);

            const pages = document.querySelectorAll(".page");
            pages.forEach(page => page.classList.add("hidden"));

            const page = document.querySelector(`#${safePage}`);
            if (page) {
                page.classList.remove("hidden");
                localStorage.setItem("currentPage", safePage);
                populatePageContent(safePage);
            }
        }, 100);
        return;
    }

    const nav = qs("nav");
    const menuToggle = qs("#menu-toggle");
    const openMenuBtn = qs(".menu-is-closed");
    const closeMenuBtn = qs(".menu-is-open");

    if (nav) nav.classList.add("hidden");

    if (pageId === "login") {
        if (menuToggle) menuToggle.classList.add("hidden");
    } else {
        if (menuToggle) menuToggle.classList.remove("hidden");
        if (openMenuBtn) openMenuBtn.classList.remove("hidden");
        if (closeMenuBtn) closeMenuBtn.classList.add("hidden");
    }

    const pages = document.querySelectorAll(".page");
    pages.forEach(page => page.classList.add("hidden"));

    const page = document.querySelector(`#${pageId}`);
    if (page) {
        page.classList.remove("hidden");

        if (pushState && location.hash.substring(1) !== pageId) {
            history.pushState({ pageId }, "", `#${pageId}`);
            window.scrollTo(0, 0);
        }

        if (pageId !== "login" && pageId !== "loading") {
            localStorage.setItem("currentPage", pageId);
        }

        populatePageContent(pageId);
    }
}

async function populatePageContent(pageId) {
    if (pageId === "use-choose-2-resources") {
        const submitButton = qs("#submit-choose-2-request");
        if (submitButton) {
            submitButton.disabled = true;
        }

        const hasChoose2 = await hasDevCard("Choose 2 Resources");

        if (hasChoose2) {
            await loadDevCardDescriptions();
            updateChoose2ResourcesPage();
            resetChoose2ButtonOnPageLoad();

            setTimeout(() => {
                fixChoose2ButtonListener();
                const btn = qs("#submit-choose-2-request");
                if (btn) {
                    const res1 = qs("#choose-2-resource1");
                    const res2 = qs("#choose-2-resource2");
                    btn.disabled = !(res1 && res1.value && res2 && res2.value);
                }
            }, 100);

            setTimeout(() => {
                removeChoose2ButtonSetup();
            }, 300);

            return;
        } else {
            displayMessage("You don't have a Choose 2 Resources card to use!");
            showPage("home", false);
            return;
        }
    }

    if (pageId === "use-robber") {
        const hasRobber = await hasDevCard("Robber");

        if (hasRobber) {
            await populateRobberTargetDropdown();
            updateRobberPage();

            setTimeout(() => {
                fixRobberButtonListener();
            }, 300);

            return;
        } else {
            displayMessage("You don't have a Robber card to use!");
            showPage("home", false);
            return;
        }
    }

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
            break;

        case "manage-trades":
            listenForIncomingTrades();
            fixTradeRequestButton();
            break;

        case "senior-see-hands":
            getAllHands();
            break;

        case "senior-manage-game":
            break;

        default:
            break;
    }
}
async function showPersonalHand() {
    if (!teamColor) {
        displayMessage("You must be logged in with a team to see your hand.");
        return;
    }

    try {
        await loadDevCardDescriptions();

        const teamDocRef = doc(db, "teams", teamColor);
        const teamDoc = await getDoc(teamDocRef);

        if (!teamDoc.exists()) {
            displayMessage(`No data found for team ${teamColor}`);
            return;
        }

        const data = teamDoc.data();
        const resources = [
            data.grain || 0,
            data.wool || 0,
            data.brick || 0,
            data.lumber || 0
        ];
        const points = Math.min(...resources);

        const yourHandSection = qs("#your-hand");
        yourHandSection.classList.add(teamColor.toLowerCase());

        let pointsDisplay = qs("#personal-points");
        if (!pointsDisplay) {
            pointsDisplay = gen("h3");
            pointsDisplay.id = "personal-points";
            yourHandSection.insertBefore(pointsDisplay, yourHandSection.firstChild);
        }
        pointsDisplay.textContent = `Your Points: ${points}`;

        const resourceSection = qs("#resource-cards");
        if (!resourceSection) {
            const newResourceSection = gen("section");
            newResourceSection.id = "resource-cards";
            newResourceSection.classList.add("resource-cards-container");

            const resourceHeader = qs("#resource-header");
            if (resourceHeader) {
                resourceHeader.after(newResourceSection);
            } else {
                const header = gen("h3");
                header.id = "resource-header";
                header.textContent = "Resources";
                yourHandSection.appendChild(header);
                yourHandSection.appendChild(newResourceSection);
            }

            resourceSection = newResourceSection;
        } else {
            resourceSection.innerHTML = "";
        }

        const resourceTypes = ["grain", "wool", "brick", "lumber"];
        resourceTypes.forEach(resourceType => {
            const amount = data[resourceType] || 0;
            const cardContainer = createResourceCard(resourceType, amount);
            resourceSection.appendChild(cardContainer);
        });

        const devCardsSection = qs("#dev-cards-in-hand");
        devCardsSection.innerHTML = "";

        if (data.development_cards && data.development_cards.length > 0) {
            const cardCounts = {};
            data.development_cards.forEach(card => {
                cardCounts[card] = (cardCounts[card] || 0) + 1;
            });

            Object.keys(cardCounts).forEach(cardType => {
                const cardContainer = createDevCard(cardType, cardCounts[cardType], true);
                devCardsSection.appendChild(cardContainer);
            });
        } else {
            const emptyMessage = gen("p");
            emptyMessage.textContent = "No development cards";
            devCardsSection.appendChild(emptyMessage);
        }

        qs("#personal-hand-last-updated").textContent = `Last updated: ${new Date().toLocaleTimeString()}`;
    } catch (err) {
        console.error("Error loading personal hand:", err);
        displayMessage("Failed to load your hand.");
    }
}

function createResourceCard(resourceType, count) {
    const cardContainer = gen("div");
    cardContainer.classList.add("card-container", "resource-card");

    if (count === 0) {
        cardContainer.classList.add("inactive-card");
    }

    const cardImg = gen("img");
    cardImg.src = `img/${resourceType}.png`;
    cardImg.alt = capitalize(resourceType);
    cardImg.classList.add("card-image");

    if (count > 0) {
        const cardCount = gen("div");
        cardCount.classList.add("card-count");
        cardCount.textContent = `x${count}`;
        cardContainer.appendChild(cardCount);
    }

    cardContainer.appendChild(cardImg);

    return cardContainer;
}

function createDevCard(cardType, count, includeActions = false) {
    const cardContainer = gen("div");
    cardContainer.classList.add("card-container", "dev-card");

    const cardImg = gen("img");
    cardImg.src = `img/${cardType.toLowerCase().replace(/\s+/g, '-')}.png`;
    cardImg.alt = cardType;
    cardImg.classList.add("card-image");

    const cardCount = gen("div");
    cardCount.classList.add("card-count");
    cardCount.textContent = `x${count}`;

    cardContainer.appendChild(cardImg);
    cardContainer.appendChild(cardCount);

    if (includeActions) {
        const cardDetails = gen("div");
        cardDetails.classList.add("card-details");

        const description = gen("p");
        description.classList.add("card-description");
        description.textContent = devCardDescriptions[cardType] || "No description available.";
        cardDetails.appendChild(description);

        if (cardType === "Robber") {
            const actionBtn = gen("button");
            actionBtn.classList.add("card-action-btn");
            actionBtn.textContent = "Use Robber";
            actionBtn.onclick = () => showPage("use-robber");
            cardDetails.appendChild(actionBtn);
        }
        else if (cardType === "Choose 2 Resources") {
            const actionBtn = gen("button");
            actionBtn.classList.add("card-action-btn");
            actionBtn.textContent = "Use Choose 2 Resources";
            actionBtn.onclick = () => showPage("use-choose-2-resources");
            cardDetails.appendChild(actionBtn);
        }

        cardContainer.appendChild(cardDetails);
    }

    return cardContainer;
}

const originalPopulatePageContent = populatePageContent;
populatePageContent = function (pageId) {
    originalPopulatePageContent(pageId);

    if (pageId === "use-robber") {
        updateRobberPage();
    }
    else if (pageId === "use-choose-2-resources") {
        updateChoose2ResourcesPage();
    } else if (pageId === "notifications") {
        updateNotificationsDisplay();

        const timestampEl = qs("#notifications-last-updated");
        if (timestampEl) {
            timestampEl.textContent = `Last updated: ${new Date().toLocaleTimeString()}`;
        }
    }
};

function updateNotificationsDisplay() {
    let targetTeam = teamColor;
    if (isSenior) {
        targetTeam = seniorRole;
    }

    const q = query(
        notificationsCol,
        where("team", "==", targetTeam),
        orderBy("timestamp", "desc")
    );

    getDocs(q).then(snapshot => {
        const notificationsBtn = qs("#notifications-btn");
        const notificationPanel = qs("#notification-panel");

        if (snapshot.empty) {
            if (notificationsBtn) {
                notificationsBtn.classList.remove("has-notification");
                notificationsBtn.textContent = "Notifications";
            }

            if (notificationPanel) {
                notificationPanel.innerHTML = "<p>No notifications.</p>";
            }
            return;
        }

        if (notificationsBtn) {
            notificationsBtn.classList.add("has-notification");
            notificationsBtn.textContent = `Notifications (${snapshot.size})`;
        }

        if (notificationPanel) {
            const notifications = [];
            snapshot.forEach(doc => {
                notifications.push({
                    id: doc.id,
                    ...doc.data()
                });
            });

            notifications.sort((a, b) => {
                const timeA = a.timestamp || 0;
                const timeB = b.timestamp || 0;
                return timeB - timeA;
            });

            renderNotifications(notificationPanel, notifications);
        }
    }).catch(error => {
        console.error("Error updating notifications:", error);
    });
}

/* scorekeeping */
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

/* card management */
async function assignResourceCard(teamId, resourceType, amount) {
    console.log("assignResourceCard got teamId =", teamId);
    if (!teamId) throw new Error("teamId is missing!");
    const isAssigningToSelf = teamId === teamColor;

    if (!isAssigningToSelf && !forceSeniorRoleCheck()) {
        displayMessage("Bro, you're not a senior.");
        return;
    }

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
        if (isSenior && !isAssigningToSelf) {
            displayMessage("Success");
        }
        await addNotification(teamId, message);

        if (!isAssigningToSelf) {
            await addNotification(seniorRole, `${amount} ${resourceType} card(s) given to Team ${teamId}`);
        }
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

/* game management */
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

        if (!forceSeniorRoleCheck()) {
            displayMessage("Only seniors can end the game");
            return;
        }

        if (!isGameActive) {
            displayMessage("No active game to end");
            return;
        }

        const modal = gen("div");
        modal.id = "end-game-modal";
        modal.classList.add("modal");

        modal.innerHTML = `
            <div class="modal-content">
                <h3>Confirm End Game</h3>
                <p>Are you sure you want to end the current game? This action cannot be undone.</p>
                <p>Type "end game" below to confirm:</p>
                <input type="text" id="end-game-confirmation" placeholder="end game">
                <div class="modal-buttons">
                    <button id="confirm-end-game-btn">Confirm</button>
                    <button id="cancel-end-game-btn">Cancel</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        const confirmBtn = qs("#confirm-end-game-btn");
        const cancelBtn = qs("#cancel-end-game-btn");
        const confirmInput = qs("#end-game-confirmation");

        confirmBtn.disabled = true;

        confirmInput.addEventListener("input", () => {
            confirmBtn.disabled = confirmInput.value.toLowerCase() !== "end game";
        });

        cancelBtn.addEventListener("click", () => {
            document.body.removeChild(modal);
        });

        confirmBtn.addEventListener("click", () => {
            if (confirmInput.value.toLowerCase() === "end game") {
                document.body.removeChild(modal);
                confirmEndGameExecution();
            }
        });

    } catch (err) {
        console.error("Error in endGame function:", err);
        displayMessage("Error preparing to end game");
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

        displayMessage("Game ended successfully!");

    } catch (err) {
        console.error("Error ending game:", err);
        displayMessage("Error ending game");
    }
}

function addGameManagementEventListeners() {

    const startNewGameBtn = qs("#start-new-game-btn");
    if (startNewGameBtn) {
        startNewGameBtn.addEventListener("click", startNewGame);
    } else {
    }

    const endGameBtn = qs("#end-game-btn");
    if (endGameBtn) {
        const newEndGameBtn = endGameBtn.cloneNode(true);
        endGameBtn.parentNode.replaceChild(newEndGameBtn, endGameBtn);

        newEndGameBtn.addEventListener("click", function () {
            endGame();
        });
    } else {
    }
}

/* notifications */
function renderNotifications(notificationPanel, notifications) {

    if (!notificationPanel) {
        console.error("Notification panel element not found");
        return;
    }

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

            if (date instanceof Date && !isNaN(date)) {
                if (typeof window.formatRelativeTime === "function") {
                    timeString = window.formatRelativeTime(date);
                    if (timeString.includes("about")) {
                        timeString = timeString.replace("about ", "");
                    }
                    timeString += " ago";
                } else {
                    timeString = date.toLocaleString();
                }
            } else {
                timeString = "Unknown time";
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

    addClearAllNotificationsButton();
}

async function listenForNotifications() {
    if (!teamColor && !isSenior) {
        console.warn("listenForNotifications called but teamColor is empty and user is not senior");
        return;
    }

    const targetTeam = isSenior ? seniorRole : teamColor;

    let q;
    try {
        q = query(
            notificationsCol,
            where("team", "==", targetTeam),
            orderBy("timestamp", "desc")
        );

        await getDocs(q);
    } catch (error) {
        console.error("Error setting up notifications query:", error);

        q = query(notificationsCol, where("team", "==", targetTeam));
        displayMessage("Loading notifications in default order - newest may not show first");
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

            notifications.sort((a, b) => {
                const timeA = a.timestamp || 0;
                const timeB = b.timestamp || 0;
                return timeB - timeA;
            });

            renderNotifications(notificationPanel, notifications);
        }
    });
}

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

function addClearAllNotificationsButton() {
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

/* trades */
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
            div.classList.add("pending-trade-request");
            const offerResources = ["grain", "wool", "brick", "lumber"]
                .filter(res => trade.offer[res] && trade.offer[res] > 0);

            const requestResources = ["grain", "wool", "brick", "lumber"]
                .filter(res => trade.request[res] && trade.request[res] > 0);

            div.innerHTML = `
                <p><strong>Team ${trade.fromTeam}</strong> is offering:</p>
                ${offerResources.length > 0 ?
                    `<ul>
                        ${offerResources
                        .map(res => `<li>${capitalize(res)}: ${trade.offer[res]}</li>`)
                        .join("")}
                    </ul>` :
                    `<p class="empty-list">Nothing</p>`
                }
                <p>In exchange for:</p>
                ${requestResources.length > 0 ?
                    `<ul>
                        ${requestResources
                        .map(res => `<li>${capitalize(res)}: ${trade.request[res]}</li>`)
                        .join("")}
                    </ul>` :
                    `<p class="empty-list">Nothing</p>`
                }
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

async function notifyTradeRequest(toTeam, fromTeam) {
    await addNotification(toTeam, `Team ${fromTeam} has requested a trade.`);
    await addNotification(seniorRole, `Team ${fromTeam} requested a trade with Team ${toTeam}`);
}

async function notifyTradeAccepted(fromTeam, toTeam) {
    await addNotification(fromTeam, `Team ${toTeam} accepted your trade request.`);
    await addNotification(toTeam, `You accepted the trade request from Team ${fromTeam}.`);
    await addNotification(seniorRole, `Team ${toTeam} accepted Team ${fromTeam}'s trade request`);
}

async function notifyTradeRejected(fromTeam, toTeam) {
    await addNotification(fromTeam, `Your trade request to Team ${toTeam} was rejected.`);
    await addNotification(toTeam, `You rejected the trade request from Team ${fromTeam}.`);
    await addNotification(seniorRole, `Team ${toTeam} rejected Team ${fromTeam}'s trade request`);
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
        displayMessage(`Trade request sent to Team ${toTeam}.`);
        resetTradeForm();
    } catch (err) {
        console.error("Error submitting trade request:", err);
        displayMessage("Failed to submit trade request.");
        resetTradeForm();
    }
}

/* dev cards */
const devCardInfoRef = collection(db, "development_cards");
let devCardDescriptions = {};

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
        await addNotification(seniorRole, `Team ${teamColor} used a ${usedCard} development card.`);

        showPersonalHand();

    } catch (err) {
        console.error("Error using dev card:", err);
        displayMessage("Failed to use card.");
    }
}

async function useRobber() {
    const hasRobberCard = await hasDevCard("Robber");

    if (!hasRobberCard) {
        displayMessage("You don't have a Robber card to use!");
        showPage("personal-hand", false);
        return;
    }

    const select = qs("#robber-target-team");
    const selectedTeam = select.value;

    if (!selectedTeam) {
        displayMessage("Please select a team to rob.");
        return;
    }

    try {

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
            displayMessage(`Team ${selectedTeam} has no resources to steal.`);
            return;
        }

        const stolen = availableResources[Math.floor(Math.random() * availableResources.length)];

        const robberTeamRef = doc(db, "teams", teamColor);
        const robberDoc = await getDoc(robberTeamRef);

        if (!robberDoc.exists()) {
            displayMessage("Your team data could not be found.");
            return;
        }

        const robberData = robberDoc.data();

        const updates = {};
        updates[stolen] = (robberData[stolen] || 0) + 1;

        const victimUpdate = {};
        victimUpdate[stolen] = data[stolen] - 1;

        await updateDoc(robberTeamRef, updates);

        await updateDoc(teamDocRef, victimUpdate);

        await addNotification(teamColor, `You stole 1 ${stolen} from Team ${selectedTeam}.`);
        await addNotification(selectedTeam, `Team ${teamColor} stole 1 ${stolen} from you.`);
        await addNotification(seniorRole, `Team ${teamColor} stole 1 ${stolen} from Team ${selectedTeam}`);

        await deleteDevCard("Robber");

        displayMessage(`Successfully stole 1 ${stolen} from Team ${selectedTeam}!`);

        setTimeout(() => {
            showPage("personal-hand");
        }, 1500);

    } catch (err) {
        console.error("Error using Robber card:", err);
        displayMessage("Error processing Robber card. Please try again.");
    }
}

async function useChoose2Resources() {
    if (isSenior) {
        displayMessage("What are you doing? Aren't you a senior?");
        return;
    }

    const hasChoose2Card = await hasDevCard("Choose 2 Resources");

    if (!hasChoose2Card) {
        displayMessage("You don't have a Choose 2 Resources card to use!");
        showPage("personal-hand", false);
        return;
    }

    const resource1Select = qs("#choose-2-resource1");
    const resource2Select = qs("#choose-2-resource2");
    const resource1 = resource1Select ? resource1Select.value : "";
    const resource2 = resource2Select ? resource2Select.value : "";

    if (!resource1 || !resource2) {
        displayMessage("Please select both resources.");
        return;
    }

    try {
        await assignResourceCard(teamColor, resource1, 1);
        await assignResourceCard(teamColor, resource2, 1);
        await deleteDevCard("Choose 2 Resources");

        if (resource1 === resource2) {
            displayMessage(`Successfully received 2 ${resource1}!`);
        } else {
            displayMessage(`Successfully received 1 ${resource1} and 1 ${resource2}!`);
        }

        setTimeout(() => {
            showPage("personal-hand");
        }, 1500);

    } catch (err) {
        console.error("Error using Choose 2 Resources card:", err);
        displayMessage("Error processing Choose 2 Resources card. Please try again.");
    }
}

function updateRobberPage() {
    const robberCardContainer = qs("#robber-card-container");
    if (!robberCardContainer) {
        console.error("Robber card container not found!");
        return;
    }

    robberCardContainer.innerHTML = "";

    const robberCard = gen("div");
    robberCard.classList.add("card-container", "dev-card", "large-card");

    const cardImg = gen("img");
    cardImg.src = "img/robber.png";
    cardImg.alt = "Robber";
    cardImg.classList.add("card-image");

    const cardDescription = gen("p");
    cardDescription.classList.add("card-description");
    cardDescription.textContent = "Steal one random resource from a team of your choice.";

    robberCard.appendChild(cardImg);
    robberCard.appendChild(cardDescription);
    robberCardContainer.appendChild(robberCard);

    setTimeout(() => {
        fixRobberButtonListener();

        const targetDropdown = qs("#robber-target-team");
        if (targetDropdown) {
            targetDropdown.addEventListener("change", () => {
                const btn = qs("#submit-robber-request");
                if (btn) {
                    btn.disabled = !targetDropdown.value;
                }
            });
        }
    }, 100);
}

function updateChoose2ResourcesPage() {
    const choose2CardContainer = qs("#choose-2-card-container");
    if (!choose2CardContainer) {
        console.error("Choose 2 Resources card container not found!");
        return;
    }

    choose2CardContainer.innerHTML = "";

    const choose2Card = gen("div");
    choose2Card.classList.add("card-container", "dev-card", "large-card");

    const cardImg = gen("img");
    cardImg.src = "img/choose-2-resources.png";
    cardImg.alt = "Choose 2 Resources";
    cardImg.classList.add("card-image");

    const cardDescription = gen("p");
    cardDescription.classList.add("card-description");
    cardDescription.textContent = "Receive two resource cards of your choosing. They can be the same or different.";

    choose2Card.appendChild(cardImg);
    choose2Card.appendChild(cardDescription);
    choose2CardContainer.appendChild(choose2Card);

    const submitButton = qs("#submit-choose-2-request");
    if (submitButton) {
        submitButton.disabled = true;
    }

    setTimeout(() => {
        fixChoose2ButtonListener();

        const resource1Dropdown = qs("#choose-2-resource1");
        const resource2Dropdown = qs("#choose-2-resource2");

        function updateButtonState() {
            const res1 = resource1Dropdown ? resource1Dropdown.value : "";
            const res2 = resource2Dropdown ? resource2Dropdown.value : "";

            const btn = qs("#submit-choose-2-request");
            if (btn) {
                btn.disabled = !(res1 && res2);
            }
        }

        if (resource1Dropdown) {
            resource1Dropdown.addEventListener("change", updateButtonState);
        }

        if (resource2Dropdown) {
            resource2Dropdown.addEventListener("change", updateButtonState);
        }

        updateButtonState();
    }, 100);
}

function fixRobberButtonListener() {
    const submitRobberRequestBtn = qs("#submit-robber-request");

    if (!submitRobberRequestBtn) {
        console.error("Robber button not found!");
        return;
    }

    const newBtn = submitRobberRequestBtn.cloneNode(true);
    submitRobberRequestBtn.parentNode.replaceChild(newBtn, submitRobberRequestBtn);

    const robberSelect = qs("#robber-target-team");
    if (robberSelect && robberSelect.value) {
        newBtn.disabled = false;
    }

    newBtn.addEventListener("click", (e) => {
        e.preventDefault();
        useRobber();
    });

    const targetDropdown = qs("#robber-target-team");
    if (targetDropdown) {
        targetDropdown.addEventListener("change", () => {
            const btn = qs("#submit-robber-request");
            if (btn) {
                btn.disabled = !targetDropdown.value;
            }
        });
    }
}

function fixChoose2ButtonListener() {
    const submitChoose2RequestBtn = qs("#submit-choose-2-request");
    if (submitChoose2RequestBtn) {
        const newBtn = submitChoose2RequestBtn.cloneNode(true);
        submitChoose2RequestBtn.parentNode.replaceChild(newBtn, submitChoose2RequestBtn);

        newBtn.addEventListener("click", function () {
            useChoose2Resources();
        });
    }
}

function removeChoose2ButtonSetup() {
    const res1 = qs("#choose-2-resource1");
    const res2 = qs("#choose-2-resource2");
    const choose2Btn = qs("#submit-choose-2-request");

    if (res1) {
        const newRes1 = res1.cloneNode(true);
        res1.parentNode.replaceChild(newRes1, res1);
    }

    if (res2) {
        const newRes2 = res2.cloneNode(true);
        res2.parentNode.replaceChild(newRes2, res2);
    }

    if (choose2Btn) {
        const newBtn = choose2Btn.cloneNode(true);
        newBtn.disabled = true;
        choose2Btn.parentNode.replaceChild(newBtn, choose2Btn);

        newBtn.addEventListener("click", (e) => {
            e.preventDefault();
            useChoose2Resources();
        });
    }

    function updateButtonState() {
        const currentRes1 = qs("#choose-2-resource1");
        const currentRes2 = qs("#choose-2-resource2");
        const currentBtn = qs("#submit-choose-2-request");

        if (currentRes1 && currentRes2 && currentBtn) {
            const val1 = currentRes1.value;
            const val2 = currentRes2.value;
            currentBtn.disabled = !(val1 && val2);
        }
    }

    const currentRes1 = qs("#choose-2-resource1");
    const currentRes2 = qs("#choose-2-resource2");

    if (currentRes1) {
        currentRes1.addEventListener("change", updateButtonState);
    }

    if (currentRes2) {
        currentRes2.addEventListener("change", updateButtonState);
    }

    updateButtonState();
}

function resetChoose2ButtonOnPageLoad() {
    const btn = qs("#submit-choose-2-request");
    if (btn) {
        btn.disabled = true;
    } else {
    }

    const res1 = qs("#choose-2-resource1");
    const res2 = qs("#choose-2-resource2");

    if (res1 && res2 && res1.value && res2.value) {
        if (btn) {
            btn.disabled = false;
        }
    }
}

/* game over */
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

        modifyNavigationForGameOver(isSenior);
        showGameOverMenu();

        const winnerAnnouncement = qs("#winner-announcement");
        if (winnerAnnouncement) {
            if (isTie) {
                const winnerNames = winners.map(w => capitalize(w.id)).join(" and ");
                winnerAnnouncement.textContent = `Tie Game! ${winnerNames} Win!`;
            } else {
                const winnerName = capitalize(winners[0].id);
                winnerAnnouncement.textContent = `${winnerName} Team Wins!`;
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

                let victoryPointsText = "";
                if (team.victoryPoints > 0) {
                    victoryPointsText += `${team.victoryPoints} Victory Point`;
                }

                if (team.victoryPoints > 1) {
                    victoryPointsText += "s";
                }

                teamSection.innerHTML = `
            <span class="team-name">${teamName} Team</span>
            <div class="team-points">
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
          <li id="logout-btn">Log Out</li>
        </ul>
      `;
    } else {
        nav.innerHTML = `<ul><li id="logout-btn">Log Out</li></ul>`;
    }

    setupHamburgerMenu();
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

function showGameOverMenu() {
    const menuToggle = qs("#menu-toggle");
    if (!menuToggle) return;

    menuToggle.classList.remove("hidden");

    if (menuToggle.innerHTML.trim() === '') {
        menuToggle.innerHTML = `
            <span class="menu-is-closed">☰</span>
            <span class="menu-is-open hidden">✕</span>
        `;
    }

    const openMenuBtn = menuToggle.querySelector(".menu-is-closed");
    const closeMenuBtn = menuToggle.querySelector(".menu-is-open");

    if (openMenuBtn) openMenuBtn.classList.remove("hidden");
    if (closeMenuBtn) closeMenuBtn.classList.add("hidden");

    const nav = qs("nav");
    if (nav) nav.classList.add("hidden");
}

function integrateCardFixes() {
    initCardPageEventListeners();

    window.addEventListener("hashchange", function () {
        const hash = location.hash.substring(1);

        if (hash === "use-robber" || hash === "use-choose-2-resources") {
            setTimeout(() => {
                setDropdownDefaults();

                if (hash === "use-robber") {
                    const robberBtn = qs("#submit-robber-request");
                    if (robberBtn) robberBtn.disabled = true;
                } else if (hash === "use-choose-2-resources") {
                    const choose2Btn = qs("#submit-choose-2-request");
                    if (choose2Btn) choose2Btn.disabled = true;
                }
            }, 50);
        }
    });

    document.addEventListener("DOMContentLoaded", function () {
        const hash = location.hash.substring(1);

        if (hash === "use-robber" || hash === "use-choose-2-resources") {
            setTimeout(() => {
                setDropdownDefaults();

                if (hash === "use-robber") {
                    const robberBtn = qs("#submit-robber-request");
                    if (robberBtn) robberBtn.disabled = true;
                } else if (hash === "use-choose-2-resources") {
                    const choose2Btn = qs("#submit-choose-2-request");
                    if (choose2Btn) choose2Btn.disabled = true;
                }
            }, 50);
        }
    });
}

integrateCardFixes();

/* don't let people do stuff they're not supposed to */
async function hasDevCard(cardType) {
    try {
        if (!teamColor) {
            console.warn("Cannot check for cards - no team color found");
            return false;
        }

        const teamRef = doc(db, "teams", teamColor);
        const teamSnap = await getDoc(teamRef);

        if (!teamSnap.exists()) {
            console.error("Team not found in database");
            return false;
        }

        const data = teamSnap.data();
        const cards = data.development_cards || [];

        return cards.includes(cardType);
    } catch (err) {
        console.error("Error checking for dev card:", err);
        return false;
    }
}

function forceVerifyUserRole() {
    const userIsSenior = isSenior || localStorage.getItem("isSenior") === "true";
    ensureSeniorStatusIsSynchronized();
    return userIsSenior;
}

function ensureSeniorStatusIsSynchronized() {
    const isSeniorFromStorage = localStorage.getItem("isSenior") === "true";

    if (isSeniorFromStorage !== isSenior) {
        if (isSeniorFromStorage) {
            isSenior = true;
        }
        else if (isSenior) {
            localStorage.setItem("isSenior", "true");
        }
    }

    if (isSeniorFromStorage || isSenior) {
        if (teamColor) {
            teamColor = "";
        }
        if (localStorage.getItem("teamColor")) {
            localStorage.removeItem("teamColor");
        }
    }
}

const originalAssignResourceCard = assignResourceCard;
assignResourceCard = function (teamId, resourceType, amount) {
    const userIsSenior = isSenior || localStorage.getItem("isSenior") === "true";

    if (teamId === teamColor && !userIsSenior) {
        return originalAssignResourceCard(teamId, resourceType, amount);
    }

    if (userIsSenior) {
        console.log("assignResourceCard called by senior, teamId =", teamId);
        return originalAssignResourceCard(teamId, resourceType, amount);
    }

    displayMessage("Bro, you're not a senior.");
    return;
};

const originalAssignDevCard = assignDevCard;
assignDevCard = function (teamId, cardType) {
    const userIsSenior = isSenior || localStorage.getItem("isSenior") === "true";

    if (!userIsSenior) {
        displayMessage("Bro, you're not a senior.");
        return;
    }
    return originalAssignDevCard(teamId, cardType);
};

const originalRemoveResourceCard = removeResourceCard;
removeResourceCard = function (teamId, resourceType, amount) {
    const userIsSenior = isSenior || localStorage.getItem("isSenior") === "true";

    if (!userIsSenior) {
        displayMessage("Bro, you're not a senior.");
        return;
    }
    return originalRemoveResourceCard(teamId, resourceType, amount);
};

const originalRemoveDevCard = removeDevCard;
removeDevCard = function (teamId, cardType) {
    const userIsSenior = isSenior || localStorage.getItem("isSenior") === "true";

    if (!userIsSenior) {
        displayMessage("Bro, you're not a senior.");
        return;
    }
    return originalRemoveDevCard(teamId, cardType);
};

const originalStartNewGame = startNewGame;
startNewGame = function () {
    const userIsSenior = isSenior || localStorage.getItem("isSenior") === "true";

    if (!userIsSenior) {
        displayMessage("Bro, you're not a senior.");
        return;
    }
    return originalStartNewGame();
};

const originalEndGame = endGame;
endGame = function () {
    const userIsSenior = isSenior || localStorage.getItem("isSenior") === "true";

    if (!userIsSenior) {
        displayMessage("Bro, you're not a senior.");
        return;
    }
    return originalEndGame();
};

const originalSubmitTradeRequest = submitTradeRequest;
submitTradeRequest = function () {
    const userIsSenior = isSenior || localStorage.getItem("isSenior") === "true";

    if (userIsSenior) {
        displayMessage("What are you doing? Aren't you a senior?");
        return;
    }

    return originalSubmitTradeRequest();
};

const originalUseRobber = useRobber;
useRobber = function () {
    if (isSenior) {
        displayMessage("What are you doing? Aren't you a senior?");
        return;
    }
    return originalUseRobber();
};

const originalUseChoose2Resources = useChoose2Resources;
useChoose2Resources = function () {
    if (isSenior) {
        displayMessage("What are you doing? Aren't you a senior?");
        return;
    }
    return originalUseChoose2Resources();
};

/* setup */
wholePageEvenListeners();
forceSelections();
showPage("loading", false);

async function checkGameStateOnLoad() {
    const isActive = await checkGameActive();

    if (!isActive) {
        await displayGameOver();
    }
}

function setupGameManagement() {
    checkGameActive();
    addGameManagementEventListeners();
}

function setupHamburgerMenu() {
    forceSeniorRoleCheck();

    const menuToggle = document.querySelector("#menu-toggle");
    const nav = document.querySelector("nav");

    if (!menuToggle || !nav) {
        console.error("Menu toggle or nav elements not found");
        return;
    }

    if (menuToggle.innerHTML.trim() === '') {
        menuToggle.innerHTML = `
            <span class="menu-is-closed">☰</span>
            <span class="menu-is-open hidden">✕</span>
        `;
    }

    const newMenuToggle = menuToggle.cloneNode(true);
    menuToggle.parentNode.replaceChild(newMenuToggle, menuToggle);
    const updatedOpenMenuBtn = newMenuToggle.querySelector(".menu-is-closed");
    const updatedCloseMenuBtn = newMenuToggle.querySelector(".menu-is-open");

    newMenuToggle.addEventListener("click", function () {
        const isNavHidden = nav.classList.contains("hidden");

        if (isNavHidden) {
            nav.classList.remove("hidden");
            updatedOpenMenuBtn.classList.add("hidden");
            updatedCloseMenuBtn.classList.remove("hidden");
        } else {
            nav.classList.add("hidden");
            updatedOpenMenuBtn.classList.remove("hidden");
            updatedCloseMenuBtn.classList.add("hidden");
        }
    });

    const navItems = document.querySelectorAll("nav li");
    navItems.forEach(item => {
        const newItem = item.cloneNode(true);
        item.parentNode.replaceChild(newItem, item);

        if (newItem.id === "logout-btn") {
            newItem.addEventListener("click", function () {
                nav.classList.add("hidden");
                updatedOpenMenuBtn.classList.remove("hidden");
                updatedCloseMenuBtn.classList.add("hidden");
                logout();
            });
        }
        else if (newItem.id === "senior-manage-game-btn") {
            newItem.addEventListener("click", function () {
                nav.classList.add("hidden");
                updatedOpenMenuBtn.classList.remove("hidden");
                updatedCloseMenuBtn.classList.add("hidden");
                showPage("senior-manage-game");
            });
        }
        else if (newItem.id === "senior-see-hands-btn") {
            newItem.addEventListener("click", function () {
                nav.classList.add("hidden");
                updatedOpenMenuBtn.classList.remove("hidden");
                updatedCloseMenuBtn.classList.add("hidden");
                showPage("senior-see-hands");
            });
        }
        else if (newItem.id === "see-hand-btn") {
            newItem.addEventListener("click", function () {
                nav.classList.add("hidden");
                updatedOpenMenuBtn.classList.remove("hidden");
                updatedCloseMenuBtn.classList.add("hidden");
                showPage("personal-hand");
            });
        }
        else if (newItem.id === "manage-trades-btn") {
            newItem.addEventListener("click", function () {
                nav.classList.add("hidden");
                updatedOpenMenuBtn.classList.remove("hidden");
                updatedCloseMenuBtn.classList.add("hidden");
                showPage("manage-trades");
            });
        }
        else if (newItem.id === "notifications-btn") {
            newItem.addEventListener("click", function () {
                nav.classList.add("hidden");
                updatedOpenMenuBtn.classList.remove("hidden");
                updatedCloseMenuBtn.classList.add("hidden");
                showPage("notifications");
            });
        }
        else if (newItem.id === "how-to-play-btn") {
            newItem.addEventListener("click", function () {
                nav.classList.add("hidden");
                updatedOpenMenuBtn.classList.remove("hidden");
                updatedCloseMenuBtn.classList.add("hidden");
                showPage("how-to-play");
            });
        }
        else {
            newItem.addEventListener("click", function () {
                nav.classList.add("hidden");
                updatedOpenMenuBtn.classList.remove("hidden");
                updatedCloseMenuBtn.classList.add("hidden");
            });
        }
    });
}

function navSetup() {
    const seeHandBtn = qs("#see-hand-btn");
    const manageTradesBtn = qs("#manage-trades-btn");
    const notificationsBtn = qs("#notifications-btn");
    const seniorSeeHandsBtn = qs("#senior-see-hands-btn");
    const seniorManageGameBtn = qs("#senior-manage-game-btn");
    const howToPlayBtn = qs("#how-to-play-btn");
    const logoutBtn = qs("#logout-btn");

    if (seeHandBtn) seeHandBtn.classList.add("hidden");
    if (manageTradesBtn) manageTradesBtn.classList.add("hidden");
    if (notificationsBtn) notificationsBtn.classList.add("hidden");
    if (seniorSeeHandsBtn) seniorSeeHandsBtn.classList.add("hidden");
    if (seniorManageGameBtn) seniorManageGameBtn.classList.add("hidden");
    if (howToPlayBtn) howToPlayBtn.classList.add("hidden");
    if (logoutBtn) logoutBtn.classList.add("hidden");

    if (isGameActive) {
        if (notificationsBtn) notificationsBtn.classList.remove("hidden");
        if (howToPlayBtn) howToPlayBtn.classList.remove("hidden");

        if (isSenior) {
            if (seniorSeeHandsBtn) seniorSeeHandsBtn.classList.remove("hidden");
            if (seniorManageGameBtn) seniorManageGameBtn.classList.remove("hidden");
        } else {
            if (seeHandBtn) seeHandBtn.classList.remove("hidden");
            if (manageTradesBtn) manageTradesBtn.classList.remove("hidden");
        }
    } else {
        if (isSenior) {
            if (seniorManageGameBtn) seniorManageGameBtn.classList.remove("hidden");
        }
    }

    if (logoutBtn) logoutBtn.classList.remove("hidden");

    if (isSenior) {
        getAllHands();
    } else {
        populateTeamsDropdown();
        listenForIncomingTrades();
        populateRobberTargetDropdown();
    }

    setupHamburgerMenu();
}

let accessDeniedMessageShown = false;
function checkPageAccess(pageId) {
    if (accessDeniedMessageShown) {
        accessDeniedMessageShown = false;
        return false;
    }

    const userIsSenior = isSenior || localStorage.getItem("isSenior") === "true";
    const seniorOnlyPages = [
        "senior-see-hands",
        "senior-manage-game"
    ];
    const teamOnlyPages = [
        "personal-hand",
        "manage-trades"
    ];

    if (pageId === "use-robber" || pageId === "use-choose-2-resources") {
        if (userIsSenior) {
            displayMessage("What are you doing? Aren't you a senior?");
            accessDeniedMessageShown = true;
            return false;
        }
        return true;
    }

    if (seniorOnlyPages.includes(pageId) && !userIsSenior) {
        displayMessage("Bro, you're not a senior.");
        accessDeniedMessageShown = true;
        return false;
    }

    if (teamOnlyPages.includes(pageId) && userIsSenior) {
        displayMessage("What are you doing? Aren't you a senior?");
        accessDeniedMessageShown = true;
        return false;
    }

    return true;
}

function enhanceHashChangeListener() {
    let lastValidHash = location.hash.substring(1) || "home";

    window.addEventListener("hashchange", function (e) {
        const newPageId = location.hash.substring(1);
        const commonPages = ["login", "loading", "home", "game-over"];

        if (!commonPages.includes(newPageId) && !checkPageAccess(newPageId)) {
            e.preventDefault();
            const safePage = isGameActive ? "home" : "game-over";
            history.replaceState({ pageId: safePage }, "", `#${safePage}`);

            return;
        }

        lastValidHash = newPageId;
    }, true);
}

function setupNavigationSecurely() {
    document.querySelectorAll("nav li").forEach(item => {
        const pageId = item.id.replace("-btn", "");

        if (pageId && pageId !== "logout") {
            item.addEventListener("click", function (e) {
                const seniorOnlyPages = ["senior-see-hands", "senior-manage-game"];
                const teamOnlyPages = ["personal-hand", "manage-trades", "#use-robber", "use-choose-2-resources"];

                if ((seniorOnlyPages.includes(pageId) && !isSenior) ||
                    (teamOnlyPages.includes(pageId) && isSenior)) {
                    e.preventDefault();
                    e.stopPropagation();

                    if (seniorOnlyPages.includes(pageId)) {
                        displayMessage("Unsuccessful. If you actually are a senior, refresh the page. If you're not, kindly leave.");
                    } else {
                        displayMessage("What are you doing? Aren't you a senior?");
                    }

                    const nav = qs("nav");
                    if (nav) nav.classList.add("hidden");

                    const openMenuBtn = qs(".menu-is-closed");
                    const closeMenuBtn = qs(".menu-is-open");
                    if (openMenuBtn) openMenuBtn.classList.remove("hidden");
                    if (closeMenuBtn) closeMenuBtn.classList.add("hidden");

                    return false;
                }
            });
        }
    });
}

function forceSeniorRoleCheck() {
    ensureSeniorStatusIsSynchronized();
    const seniorFromStorage = localStorage.getItem("isSenior") === "true";

    if (seniorFromStorage !== isSenior) {
        isSenior = seniorFromStorage;
    }

    return isSenior;
}

async function setupAfterLogin() {
    if (localStorage.getItem("isSenior") === "true" && !isSenior) {
        isSenior = true;
    }

    await checkGameActive().then(isGameActive => {
        if (!isGameActive) {
            const gameStateRef = doc(db, "game_state", "current");
            getDoc(gameStateRef).then(gameStateDoc => {
                if (gameStateDoc.exists() && gameStateDoc.data().winners) {
                    modifyNavigationForGameOver(isSenior);
                    showGameOverMenu();
                    displayGameOver();
                    return;
                } else {
                    navSetup();
                }
            });
        } else {
            navSetup();
        }
    });

    ensureSeniorStatusIsSynchronized()
    setUpButtons();
    forceSelections();
    setupHamburgerMenu();
    setupNavigationSecurely();
    listenForNotifications();
    enhanceHashChangeListener();
    await loadDevCardDescriptions();

    if (isSenior) {
        const seniorElements = document.querySelectorAll(".senior-only");
        seniorElements.forEach(el => el.classList.remove("hidden"));
    }

    fixTradeButtonEventHandlers();
    forceSeniorRoleCheck();
    return Promise.resolve();
}

wholePageEvenListeners();
setUpButtons();
forceSelections();
showPage("loading", false);