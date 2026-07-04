const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const USERS_FILE = path.join(__dirname, 'users.json');
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_this';

function loadUsers() {
  try {
    const raw = fs.readFileSync(USERS_FILE, 'utf8');
    return JSON.parse(raw || '{"users":{}}').users || {};
  } catch (e) {
    return {};
  }
}

function saveUsers(users) {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify({ users }, null, 2));
  } catch (e) {}
}

function createApiKey() {
  return [...Array(40)].map(() => Math.floor(Math.random() * 36).toString(36)).join('');
}

function register(username, password, opts = {}) {
  const users = loadUsers();
  if (users[username]) throw new Error('User exists');
  const hash = bcrypt.hashSync(password, 10);
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2,8);
  const apiKey = createApiKey();
  const user = { id, username, passwordHash: hash, apiKey, createdAt: Date.now(), verified: false };
  if (opts.email) user.email = opts.email;
  if (opts.tosAccepted) user.tosAccepted = true;
  users[username] = user;
  saveUsers(users);
  return { id, username, apiKey };
}

function login(username, password) {
  const users = loadUsers();
  const u = users[username];
  if (!u) throw new Error('No such user');
  if (!bcrypt.compareSync(password, u.passwordHash)) throw new Error('Invalid');
  const token = jwt.sign({ id: u.id, username: u.username }, JWT_SECRET, { expiresIn: '7d' });
  return { token, user: { id: u.id, username: u.username, apiKey: u.apiKey } };
}

function verify(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (e) {
    return null;
  }
}

module.exports = { register, login, verify, loadUsers };
