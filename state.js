let state = {
  running: false,
  startTime: null
};

function setRunning(value) {
  state.running = value;
  if (value) state.startTime = Date.now();
  if (!value) state.startTime = null;
}

function getState() {
  return state;
}

module.exports = {
  setRunning,
  getState
};