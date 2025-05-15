const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

/**
 * Simple login function:
 * Input: { username, password }
 * Checks Firestore 'users' collection for username/password match.
 * Returns: { teamId, role } if successful.
 */
exports.login = functions.https.onCall(async (data, context) => {
  const { username, password } = data;

  if (!username || !password) {
    throw new functions.https.HttpsError('invalid-argument', 'Username and password required');
  }

  const userRef = db.collection('users').doc(username);
  const userSnap = await userRef.get();

  if (!userSnap.exists) {
    throw new functions.https.HttpsError('not-found', 'User not found');
  }

  const user = userSnap.data();

  if (user.password !== password) {
    throw new functions.https.HttpsError('permission-denied', 'Invalid password');
  }

  return { teamId: user.teamId, role: user.role };
});

/**
 * Get all resources across teams.
 * Returns the 'team-resources' document (or collection).
 * (You might want to store team resources in Firestore in a collection or document)
 */
exports.getAllResources = functions.https.onCall(async () => {
  const resRef = db.collection('team-resources');
  const snapshot = await resRef.get();

  let allResources = {};
  snapshot.forEach(doc => {
    allResources[doc.id] = doc.data();
  });

  return allResources;
});

/**
 * Get full inventory for a team.
 * Input: { teamId }
 * Returns: Inventory document for that team.
 */
exports.getTeamInventory = functions.https.onCall(async (data) => {
  const { teamId } = data;
  if (!teamId) {
    throw new functions.https.HttpsError('invalid-argument', 'teamId is required');
  }

  const invRef = db.collection('inventories').doc(teamId);
  const invSnap = await invRef.get();

  if (!invSnap.exists) {
    throw new functions.https.HttpsError('not-found', 'Inventory not found');
  }

  return invSnap.data();
});

/**
 * Log an item for a team.
 * Input: { teamId, role, item }
 */
exports.logItem = functions.https.onCall(async (data) => {
  const { teamId, role, item } = data;

  if (!teamId || !role || !item) {
    throw new functions.https.HttpsError('invalid-argument', 'teamId, role, and item are required');
  }

  if (role !== 'team') {
    throw new functions.https.HttpsError('permission-denied', 'Only teams can log items');
  }

  await db.collection('items').add({
    teamId,
    item,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { success: true, message: 'Item logged successfully' };
});

/**
 * Request a trade.
 * Input: { requesting_team, team_to_request_from, resource_to_request }
 */
exports.requestTrade = functions.https.onCall(async (data) => {
  const { requesting_team, team_to_request_from, resource_to_request } = data;

  if (!requesting_team || !team_to_request_from || !resource_to_request) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing trade request info');
  }

  await db.collection('trade-requests').add({
    requesting_team,
    team_to_request_from,
    resource_to_request,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
    status: 'pending',
  });

  return { success: true, message: 'Trade request submitted' };
});

/**
 * Approve a trade.
 * Input: { tradeRequestId }
 */
exports.approveTrade = functions.https.onCall(async (data) => {
  const { tradeRequestId } = data;

  if (!tradeRequestId) {
    throw new functions.https.HttpsError('invalid-argument', 'tradeRequestId required');
  }

  const tradeRef = db.collection('trade-requests').doc(tradeRequestId);
  const tradeSnap = await tradeRef.get();

  if (!tradeSnap.exists) {
    throw new functions.https.HttpsError('not-found', 'Trade request not found');
  }

  const trade = tradeSnap.data();

  // Update status to approved
  await tradeRef.update({ status: 'approved' });

  // Implement inventory changes if needed here (omitted for brevity)
  // You can update the inventories collection documents accordingly

  return { success: true, message: 'Trade approved' };
});

/**
 * Reject a trade.
 * Input: { tradeRequestId }
 */
exports.rejectTrade = functions.https.onCall(async (data) => {
  const { tradeRequestId } = data;

  if (!tradeRequestId) {
    throw new functions.https.HttpsError('invalid-argument', 'tradeRequestId required');
  }

  const tradeRef = db.collection('trade-requests').doc(tradeRequestId);
  const tradeSnap = await tradeRef.get();

  if (!tradeSnap.exists) {
    throw new functions.https.HttpsError('not-found', 'Trade request not found');
  }

  // Update status to rejected
  await tradeRef.update({ status: 'rejected' });

  return { success: true, message: 'Trade rejected' };
});

/**
 * Draw a development card for a team.
 * Input: { teamId }
 */
exports.drawDevCard = functions.https.onCall(async (data) => {
  const { teamId } = data;
  if (!teamId) {
    throw new functions.https.HttpsError('invalid-argument', 'teamId required');
  }

  const invRef = db.collection('inventories').doc(teamId);
  const invSnap = await invRef.get();

  if (!invSnap.exists) {
    throw new functions.https.HttpsError('not-found', 'Inventory not found');
  }

  const inventory = invSnap.data();

  if (!inventory.development_card_credits || inventory.development_card_credits <= 0) {
    throw new functions.https.HttpsError('failed-precondition', 'No development card credits left');
  }

  // Draw card logic
  const randomNumber = Math.random();
  let card;
  if (randomNumber < 0.6) {
    card = "Robber";
  } else if (randomNumber < 0.75) {
    card = "Victory Point";
  } else {
    card = "Choose 2 Resources";
  }

  // Update inventory
  await invRef.update({
    development_card_credits: inventory.development_card_credits - 1,
    development_cards: admin.firestore.FieldValue.arrayUnion(card),
  });

  return { card };
});

/**
 * Remove resources from a team.
 * Input: { teamId, resource, amount }
 */
exports.removeResources = functions.https.onCall(async (data) => {
  const { teamId, resource, amount } = data;

  if (!teamId || !resource || !amount) {
    throw new functions.https.HttpsError('invalid-argument', 'teamId, resource, and amount are required');
  }

  const invRef = db.collection('inventories').doc(teamId);
  const invSnap = await invRef.get();

  if (!invSnap.exists) {
    throw new functions.https.HttpsError('not-found', 'Inventory not found');
  }

  const inventory = invSnap.data();

  if (!inventory[resource] || inventory[resource] < amount) {
    throw new functions.https.HttpsError('failed-precondition', `Not enough ${resource} to remove`);
  }

  const newAmount = inventory[resource] - amount;

  await invRef.update({ [resource]: newAmount });

  return { success: true, message: `${amount} ${resource} removed from ${teamId}` };
});

/**
 * Assign resources to a team.
 * Input: { teamId, resource, amount }
 */
exports.assignResources = functions.https.onCall(async (data) => {
  const { teamId, resource, amount } = data;

  if (!teamId || !resource || !amount) {
    throw new functions.https.HttpsError('invalid-argument', 'teamId, resource, and amount are required');
  }

  const invRef = db.collection('inventories').doc(teamId);
  const invSnap = await invRef.get();

  if (!invSnap.exists) {
    throw new functions.https.HttpsError('not-found', 'Inventory not found');
  }

  const inventory = invSnap.data();
  const currentAmount = inventory[resource] || 0;
  const newAmount = currentAmount + amount;

  await invRef.update({ [resource]: newAmount });

  return { success: true, message: `${amount} ${resource} assigned to ${teamId}` };
});

/**
 * Assign a development card to a team.
 * Input: { teamId, card }
 */
exports.assignDevCard = functions.https.onCall(async (data) => {
  const { teamId, card } = data;

  if (!teamId || !card) {
    throw new functions.https.HttpsError('invalid-argument', 'teamId and card are required');
  }

  const invRef = db.collection('inventories').doc(teamId);
  const invSnap = await invRef.get();

  if (!invSnap.exists) {
    throw new functions.https.HttpsError('not-found', 'Inventory not found');
  }

  await invRef.update({
    development_cards: admin.firestore.FieldValue.arrayUnion(card)
  });

  return { success: true, message: `Development card "${card}" assigned to ${teamId}` };
});
