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
  onSnapshot
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

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
let loggedIn = false;
let isSenior = false;

const tradeRequestsCol = collection(db, "trade_requests");
const notificationsCol = collection(db, "notifications");

async function addNotification(team, message) {
    if (typeof message !== "string" || !message.trim()) {
      console.error("Invalid notification message:", message);
      return;
    }
    try {
      await addDoc(notificationsCol, {
        team,
        message,
        timestamp: Date.now(),
      });
      if (!isSenior) {
        displayMessage("New Notification");
      }
    } catch (err) {
      console.error("Failed to add notification:", err);
    }
  }
  

function displayMessage(msg) {
  const el = qs("#message");
  if (!el) return;
  el.textContent = msg;
  el.classList.remove("hidden");
  setTimeout(() => el.classList.add("hidden"), 5000);
}

async function login(event) {
  event.preventDefault();

  const username = qs("#username").value.trim();
  const password = qs("#password").value.trim();

  if (!username || !password) {
    return displayMessage("Please enter a username and password.");
  }

  try {
    const userDocRef = doc(db, "users", username);
    const userDoc = await getDoc(userDocRef);

    if (!userDoc.exists()) {
      displayMessage("User not found.");
      return;
    }

    const userData = userDoc.data();

    if (userData.password !== password) {
      displayMessage("Incorrect password.");
      return;
    }

    if (userData.role === seniorRole) {
      isSenior = true;
      seniorSetup();
      await getAllResources();
      setupAfterLogin();
    } else if (userData.teamId) {
      teamColor = userData.teamId;
      isSenior = false;
      teamSetup(teamColor);
      setupAfterLogin();
      await getAllResources();
      listenForDevCardUpdates();
    } else {
      displayMessage("No team assigned to this user.");
    }
  } catch (err) {
    console.error("Login error:", err);
    displayMessage("Problem logging in. Please refresh and try again.");
  }
}

function seniorSetup() {
  const nav = qs("nav");
  if (nav) nav.classList.remove("hidden");
  for (const li of qsa("nav li")) {
    li.classList.toggle("hidden");
  }

  const notificationsBtn = qs("#notifications-btn");
  if (notificationsBtn) notificationsBtn.classList.remove("hidden");

  getAllHands();
  showPage("home");
}

function teamSetup(team) {
  const nav = qs("nav");
  if (nav) nav.classList.remove("hidden");

  populateTeamsDropdown();
  listenForIncomingTrades();
  listenForTeamChanges();
  populateRobberTargetDropdown();
  loadDevCardDescriptions();

  showPage("home");
}

async function populateTeamsDropdown() {
    const teamsCol = collection(db, "teams");
    const teamsSnapshot = await getDocs(teamsCol);
  
    const select = qs("#team-to-request-from");
    if (!select) return;
  
    select.innerHTML = '<option value="" disabled selected>Select a team</option>';
  
    teamsSnapshot.forEach(teamDoc => {
      const id = teamDoc.id;
      if (id === teamColor) return; // Skip your own team
  
      const option = gen("option");
      option.value = id;
      option.textContent = id.charAt(0).toUpperCase() + id.slice(1);
      select.appendChild(option);
    });
  }  

function showPage(pageId) {
  const pages = qsa(".page");
  pages.forEach(page => page.classList.add("hidden"));
  const page = qs(`#${pageId}`);
  if (page) page.classList.remove("hidden");
}

// Populate all teams resources in the home page
async function getAllResources() {
  try {
    const teamsCol = collection(db, "teams");
    const teamsSnapshot = await getDocs(teamsCol);

    if (teamsSnapshot.empty) {
      displayMessage("No teams found.");
      return;
    }

    teamsSnapshot.forEach(teamDoc => {
      const teamId = teamDoc.id.toLowerCase();
      const data = teamDoc.data();

      const resources = ["grain", "wool", "brick", "lumber"];

      resources.forEach(resource => {
        const elId = `${teamId}-${resource}`;
        const el = qs(`#${elId}`);
        if (el) {
          el.textContent = `${resource.charAt(0).toUpperCase() + resource.slice(1)}: ${data[resource] || 0}`;
        }
      });
    });
  } catch (err) {
    console.error("Error loading teams resources:", err);
    displayMessage("Failed to load teams resources.");
  }
}

async function getAllHands() {
    try {
      const teamsCol = collection(db, "teams");
      const teamsSnapshot = await getDocs(teamsCol);
  
      if (teamsSnapshot.empty) {
        displayMessage("No teams found.");
        return;
      }
  
      teamsSnapshot.forEach(teamDoc => {
        const teamId = teamDoc.id.toLowerCase();
        const data = teamDoc.data();
  
        const resources = ["grain", "wool", "brick", "lumber"];
  
        resources.forEach(resource => {
          const elId = `senior-${teamId}-${resource}`;
          const el = qs(`#${elId}`);
          if (el) {
            el.textContent = `${resource.charAt(0).toUpperCase() + resource.slice(1)}: ${data[resource] || 0}`;
          }
        });

        const devCards = data["development_cards"];
        const devCardsElId = `senior-${teamId}-dev-cards`;
        const devCardsEl = qs(`#${devCardsElId}`);
        if (devCardsEl) {
            const devCard = gen("section");
            devCards.forEach(card => {
                const p = gen("p");
                p.textContent = card;
                devCard.appendChild(p);
            });
            devCardsEl.appendChild(devCard);
        }
      });
    } catch (err) {
      console.error("Error loading teams resources:", err);
      displayMessage("Failed to load teams resources.");
    }
  }

// Populate personal hand page with team data
async function showPersonalHand() {
    if (!teamColor) {
      displayMessage("You must be logged in with a team to see your hand.");
      return;
    }

    showPage("personal-hand");
  
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
  
      // Update personal hand resource counts
      qs("#grain").textContent = `Grain: ${data.grain || 0}`;
      qs("#wool").textContent = `Wool: ${data.wool || 0}`;
      qs("#brick").textContent = `Brick: ${data.brick || 0}`;
      qs("#lumber").textContent = `Lumber: ${data.lumber || 0}`;
  
      // Display development cards
      const devCardsSection = qs("#dev-cards-in-hand");
        devCardsSection.innerHTML = ""; // Clear old cards
        if (data.development_cards && data.development_cards.length > 0) {
            data.development_cards.forEach(card => {
              const div = gen("div");
              div.classList.add("dev-card");
          
              // Add description paragraph above button:
              const descP = gen("p");
              descP.classList.add("dev-card-description");
              console.log("devCardDescriptions", devCardDescriptions);
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
              } else {
                btn.textContent = `Point will be added automatically at the end of the game`;
                btn.classList.add("disabled");
              }
              div.appendChild(btn);
          
              devCardsSection.appendChild(div);
            });
          }           else {
            devCardsSection.textContent = "No development cards";
        }

  
      showPage("personal-hand");
    } catch (err) {
      console.error("Error loading personal hand:", err);
      displayMessage("Failed to load your hand.");
    }
  }
  

// Nav button handlers
const seeHandBtn = qs("#see-hand-btn");
if (seeHandBtn) {
  seeHandBtn.addEventListener("click", () => {
    showPersonalHand();
  });
}

const loginForm = qs("#login-form");
if (loginForm) {
  loginForm.addEventListener("submit", login);
}

async function submitTradeRequest() {
    const toTeam = qs("#team-to-request-from").value;
  
    const resources = ["grain", "wool", "brick", "lumber"];
  
    const offer = {};
    const request = {};

    const fromTeamRef = doc(db, "teams", teamColor);
    const toTeamRef = doc(db, "teams", toTeam);

    const [fromTeamDoc, toTeamDoc] = await Promise.all([
      getDoc(fromTeamRef),
      getDoc(toTeamRef),
    ]);

    if (!fromTeamDoc.exists() || !toTeamDoc.exists()) {
      displayMessage("One of the teams no longer exists.");
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
          return;  // This will exit submitTradeRequest now!
        }
      
        const requestAmt = parseInt(qs(`#request-${resource}`).value, 10);
        request[resource] = isNaN(requestAmt) ? 0 : requestAmt;
      
        if ((toData[resource] || 0) < request[resource]) {
          displayMessage(`Team ${toTeam} doesn't have enough ${resource}.`);
          return;  // Exit the function on failure
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
            message = message.slice(0, -2); // Remove trailing comma and space
            message += ".";
        displayMessage(message);
        return;
      }
      
  
    // Validation: at least one offered and one requested resource > 0
    const hasOffer = Object.values(offer).some(amount => amount > 0);
    const hasRequest = Object.values(request).some(amount => amount > 0);
  
    if (!teamColor) {
      displayMessage("You must be logged in to request a trade.");
      return;
    }
  
    if (!toTeam) {
      displayMessage("Select a team to trade with.");
      return;
    }
  
    if (!hasOffer || !hasRequest) {
      displayMessage("You must offer and request at least one resource.");
      const toTeamSelect = qs("#team-to-request-from");
      toTeamSelect.value = "";
      const requestTradeBtn = qs("#submit-trade-request");
      requestTradeBtn.disabled = true;
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
    } catch (err) {
      console.error("Error submitting trade request:", err);
      displayMessage("Failed to submit trade request.");
    }
  }
  
  
  function listenForIncomingTrades() {
    if (!teamColor) {
      console.warn("listenForIncomingTrades called but teamColor is empty");
      return;
    }
  
    // Listen for trade requests where toTeam = current team & status = pending
    const q = query(
      tradeRequestsCol,
      where("toTeam", "==", teamColor),
      where("status", "==", "pending")
    );
  
    const tradeRequestsSection = qs("#trade-requests");
    tradeRequestsSection.innerHTML = ""; // Clear initially
  
    onSnapshot(q, (snapshot) => {
      tradeRequestsSection.innerHTML = "";
      if (snapshot.empty) {
        tradeRequestsSection.textContent = "No requests to respond to.";
        return;
      }
  
      snapshot.forEach((docSnap) => {
        const trade = docSnap.data();
        const tradeId = docSnap.id;
  
        const div = gen("div");
        div.classList.add("trade-request");
  
        div.innerHTML = `
            <p><strong>${trade.fromTeam}</strong> is offering:</p>
            <ul>
                ${Object.entries(trade.offer).map(([res, amt]) => `<li>${res}: ${amt}</li>`).join("")}
            </ul>
            <p>In exchange for:</p>
            <ul>
                ${Object.entries(trade.request).map(([res, amt]) => `<li>${res}: ${amt}</li>`).join("")}
            </ul>
            <button class="accept-trade" data-id="${tradeId}">Accept</button>
            <button class="reject-trade" data-id="${tradeId}">Reject</button>
        `;

  
        tradeRequestsSection.appendChild(div);
      }, (error) => {
        console.error("Error with onSnapshot listener:", error);
      });
  
      // Add event listeners for accept/reject buttons
      qsa(".accept-trade").forEach(btn => {
        btn.onclick = () => handleTradeResponse(btn.dataset.id, true);
      });
      qsa(".reject-trade").forEach(btn => {
        btn.onclick = () => handleTradeResponse(btn.dataset.id, false);
      });
    });
  }
  
  async function handleTradeResponse(tradeId, accepted) {
    try {
      const tradeDocRef = doc(tradeRequestsCol, tradeId);
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

      await notifyTradeAccepted(trade.fromTeam, trade.toTeam);
  
      // Select inputs from the correct trade request container
      const fromTeamRef = doc(db, "teams", trade.fromTeam);
      const toTeamRef = doc(db, "teams", trade.toTeam);
  
      const [fromTeamDoc, toTeamDoc] = await Promise.all([
        getDoc(fromTeamRef),
        getDoc(toTeamRef),
      ]);
  
      if (!fromTeamDoc.exists() || !toTeamDoc.exists()) {
        displayMessage("One of the teams no longer exists.");
        return;
      }
  
      const fromData = fromTeamDoc.data();
      const toData = toTeamDoc.data();
  
      // Perform trade
      const newFrom = { ...fromData };
      const newTo = { ...toData };
  
      // From team sends
      for (const [res, amt] of Object.entries(trade.offer)) {
        newFrom[res] = (newFrom[res] || 0) - amt;
        newTo[res] = (newTo[res] || 0) + amt;
      }
  
      // To team sends (response offer)
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
  
  
  
  // Notifications
  
  function listenForNotifications() {
    if (!teamColor && !isSenior) {
      console.warn("listenForNotifications called but teamColor is empty and user is not senior");
      return;
    }

    if (isSenior) {
      teamColor = seniorRole;
    }
  
    // Query with orderBy descending on 'createdAt' timestamp
    const q = query(
      notificationsCol,
      where("team", "==", teamColor),
    //   orderBy("createdAt", "desc")
    );
  
    const notificationsBtn = qs("#notifications-btn");
    if (!notificationsBtn) return;
  
    onSnapshot(q, (snapshot) => {
      if (snapshot.empty) {
        notificationsBtn.classList.remove("has-notification");
        notificationsBtn.textContent = "Notifications";
        const notificationPanel = qs("#notification-panel");
        if (notificationPanel) {
          notificationPanel.innerHTML = "<p>No notifications.</p>";
        }
        return;
      }
  
      notificationsBtn.classList.add("has-notification");
      notificationsBtn.textContent = `Notifications (${snapshot.size})`;
  
      // Display notifications in descending order by createdAt
      const notificationPanel = qs("#notification-panel");
      if (notificationPanel) {
        notificationPanel.innerHTML = "";
        snapshot.forEach((docSnap) => {
          const note = docSnap.data();
  
          // Format timestamp to readable string
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
              timeString = window.formatRelativeTime(date, { addSuffix: true });
            }
          }
          
          console.log(timeString);
          
  
          const p = gen("p");
          p.innerHTML = `${note.message || "New notification"}<br>${timeString}`;
          notificationPanel.appendChild(p);
        });
      }
    });
  }
  

  function listenForDevCardUpdates() {
    if (!teamColor) return;
  
    const teamRef = doc(db, "teams", teamColor);
    onSnapshot(teamRef, (docSnap) => {
      if (!docSnap.exists()) return;
      const data = docSnap.data();
  
      const devCardsSection = qs("#dev-cards-in-hand");
      devCardsSection.innerHTML = "";
  
      if (data.development_cards && data.development_cards.length > 0) {
        data.development_cards.forEach(card => {
          const p = gen("p");
          p.textContent = card;
          devCardsSection.appendChild(p);
        });
      } else {
        devCardsSection.textContent = "No development cards";
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
      console.log(cards);
  
      const index = cards.indexOf(cardType);
      if (index < 0) {
        return displayMessage("Card not found.");
      }
  
      const usedCard = cards.splice(index, 1); // Remove card
  
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
  
      // Add amount to current amount
      const newAmount = currentAmount + amount;
  
      // Update Firestore
      await updateDoc(teamRef, {
        [resourceType]: newAmount
      });
  
      let message = ""
      if (amount > 1) {
        message = `You have received ${amount} ${resourceType} cards!`;
      } else {
        message = `You have received ${amount} ${resourceType} card!`;
      }
      if (isSenior) {
        displayMessage("Success");
      }
      await addNotification(teamId, message);
      await addNotification(seniorRole, `${amount} ${resourceType} card(s) awarded to ${teamId}`);
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
  
      // Add new card to array
      currentCards.push(cardType);
  
      // Update Firestore
      await updateDoc(teamRef, {
        ["development_cards"]: currentCards
      });
      if (isSenior) {
        displayMessage("Success");
      }
      await addNotification(teamId, `You were awarded a "${cardType}" development card`);
      await addNotification(seniorRole, `"${cardType}" development card awarded to Team ${teamId}`);
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
  
      // Subtract amount from current amount
      const newAmount = currentAmount - amount;
  
      // Update Firestore
      await updateDoc(teamRef, {
        [resourceType]: newAmount
      });
  
      if (isSenior) {
        displayMessage("Success");
      }
      await addNotification(teamId, `You lost ${amount} ${resourceType} cards.`);
      await addNotification(seniorRole, `${amount} ${resourceType} cards removed from Team ${teamId}`);
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
  
      const removedCard = currentCards.splice(index, 1); // Remove card
  
      // Update Firestore
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
  
    // Update teams
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
    // Get selected resource values from the selects
    const resource1 = qs("#choose-2-resource1").value;
    const resource2 = qs("#choose-2-resource2").value;
  
    // Add the two resources to the player's inventory
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
  
  // Initialization
  
  // Hook buttons
  const homeBtn = qs("#home-btn");
  if (homeBtn) {
    homeBtn.addEventListener("click", () => {
        if (loggedIn) {
            showPage("home");
        }
    });
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

  const seniorManageCardsBtn = qs("#senior-manage-cards-btn");
  if (seniorManageCardsBtn) {
    seniorManageCardsBtn.addEventListener("click", () => {
      showPage("senior-manage-cards");
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
        card = "Point";
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
      const toTeamSelect = qs("#team-to-request-from");
      toTeamSelect.value = "";
    });
  }
  
  const notificationsBtn = qs("#notifications-btn");
  if (notificationsBtn) {
    notificationsBtn.addEventListener("click", () => {
      showPage("notifications");
    });
  }

  const manageTradesBtn = qs("#manage-trades-btn");
if (manageTradesBtn) {
  manageTradesBtn.addEventListener("click", () => {
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
          if (id === teamColor) return; // exclude own team
      
          const option = gen("option");
          option.value = id;
          option.textContent = id.charAt(0).toUpperCase() + id.slice(1);
          select.appendChild(option);
        });
      }
      
      let previousTeamData = null;

function listenForTeamChanges() {
  if (!teamColor) {
    console.warn("listenForTeamChanges called but teamColor is empty");
    return;
  }

  const teamRef = doc(db, "teams", teamColor);
  
  onSnapshot(teamRef, async (docSnap) => {
    if (!docSnap.exists()) return;
    const newData = docSnap.data();

    if (previousTeamData) {
      // Check resource changes
      const resources = ["grain", "wool", "brick", "lumber"];
      for (const res of resources) {
        const oldAmt = previousTeamData[res] || 0;
        const newAmt = newData[res] || 0;

        console.log(oldAmt, newAmt);
        console.log(res);
        console.log(`${res.charAt(0).toUpperCase() + res.slice(1)} awarded: +${newAmt - oldAmt}`);

        if (newAmt > oldAmt) {
          // Resource awarded
          await addNotification(teamColor, `You were awarded ${newAmt - oldAmt} ${res}`);
          await addNotification(seniorRole, `${newAmt - oldAmt} ${res} awarded to Team ${teamColor}`);
        }
      }

      // Check development cards changes
      const oldCards = previousTeamData.development_cards || [];
      const newCards = newData.development_cards || [];

      // Cards added
      if (newCards.length > oldCards.length) {
      }
    }

    previousTeamData = newData;  // Update cache
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

  // Choose 2 Resources card button enablement
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
    const buttons = qsa("#senior-manage-cards section button");
    buttons.forEach(btn => {
      btn.disabled = true;
    });
    const selects = qsa("#senior-manage-cards section select");
    selects.forEach(select => {
      select.value = "";
    });
  }

  // On login or setup:
  function setupAfterLogin() {
    listenForNotifications();
    loggedIn = true;
  }
  