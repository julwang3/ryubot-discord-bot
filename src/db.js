const path = require('node:path');
const Database = require('better-sqlite3');

const db = new Database(path.join(__dirname, '..', 'daylily.db'));
db.pragma('journal_mode = WAL');

// Each currency is scoped to the Discord user who created it, so one bot
// instance can be shared by a whole server without mixing up data.
db.exec(`
  CREATE TABLE IF NOT EXISTS dailies (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    userId            TEXT    NOT NULL,
    gameName          TEXT    NOT NULL,
    currencyAmt       INTEGER NOT NULL,
    maxCurrencyAmt    INTEGER NOT NULL,
    elapsedRefillAmt  REAL    NOT NULL DEFAULT 0,
    refillRate        REAL    NOT NULL,
    updatedAt         TEXT    NOT NULL,
    UNIQUE(userId, gameName COLLATE NOCASE)
  );
`);

const statements = {
  insert: db.prepare(`
    INSERT INTO dailies (userId, gameName, currencyAmt, maxCurrencyAmt, elapsedRefillAmt, refillRate, updatedAt)
    VALUES (@userId, @gameName, @currencyAmt, @maxCurrencyAmt, @elapsedRefillAmt, @refillRate, @updatedAt)
  `),
  findOne: db.prepare(`
    SELECT * FROM dailies WHERE userId = ? AND gameName = ? COLLATE NOCASE
  `),
  listByUser: db.prepare(`
    SELECT * FROM dailies WHERE userId = ? ORDER BY gameName COLLATE NOCASE
  `),
  saveCheckpoint: db.prepare(`
    UPDATE dailies
    SET currencyAmt = ?, maxCurrencyAmt = ?, elapsedRefillAmt = ?, refillRate = ?, updatedAt = ?
    WHERE id = ?
  `),
  deleteOne: db.prepare(`
    DELETE FROM dailies WHERE id = ?
  `),
};

function rowToObj(row) {
  if (!row) return null;
  return { ...row, updatedAt: new Date(row.updatedAt) };
}

function addDaily(userId, gameName, currencyAmt, maxCurrencyAmt, elapsedRefillAmt, refillRate) {
  statements.insert.run({
    userId,
    gameName,
    currencyAmt,
    maxCurrencyAmt,
    elapsedRefillAmt,
    refillRate,
    updatedAt: new Date().toISOString(),
  });
}

function findDaily(userId, gameName) {
  return rowToObj(statements.findOne.get(userId, gameName));
}

function listDailies(userId) {
  return statements.listByUser.all(userId).map(rowToObj);
}

function saveCheckpoint(id, currencyAmt, maxCurrencyAmt, elapsedRefillAmt, refillRate) {
  statements.saveCheckpoint.run(currencyAmt, maxCurrencyAmt, elapsedRefillAmt, refillRate, new Date().toISOString(), id);
}

function deleteDaily(id) {
  statements.deleteOne.run(id);
}

module.exports = { db, addDaily, findDaily, listDailies, saveCheckpoint, deleteDaily };
