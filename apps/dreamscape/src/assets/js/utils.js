export function makeId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

export function generatePracticeLogId() {
  return `pl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}
