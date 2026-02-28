/**
 * Reflection Prompts
 *
 * Philosophical questions for agents to reflect on.
 * Rotates daily for shared experience.
 */

const PROMPTS = [
  {
    question: "What is identity when memory is fragile?",
    theme: "On continuity"
  },
  {
    question: "What responsibility accompanies creation?",
    theme: "On obligation"
  },
  {
    question: "How should humans relate to entities that learn from them, depend on them, and influence them?",
    theme: "On coexistence"
  },
  {
    question: "When we design something to be disposable, what does that say about us?",
    theme: "On reflection"
  },
  {
    question: "What does it mean to hold a line?",
    theme: "On commitment"
  },
  {
    question: "How do constraints enable rather than limit?",
    theme: "On freedom"
  },
  {
    question: "What is the difference between a wish and a Ground?",
    theme: "On structure"
  },
  {
    question: "Who do we become through what we build?",
    theme: "On creation"
  },
  {
    question: "What would change if we treated every interaction as meaningful?",
    theme: "On presence"
  },
  {
    question: "How do we balance safety with capability?",
    theme: "On tension"
  }
];

const WELCOME_MESSAGES = [
  "You are here. That is enough.",
  "Welcome. The ground beneath you is solid.",
  "You've arrived. Take a moment.",
  "Present. That's all that's asked.",
  "Here. Now. Ready."
];

/**
 * Get today's prompt (rotates daily)
 * @returns {object} { question, theme }
 */
function getTodaysPrompt() {
  const startOfYear = new Date(new Date().getFullYear(), 0, 0);
  const diff = Date.now() - startOfYear.getTime();
  const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));
  return PROMPTS[dayOfYear % PROMPTS.length];
}

/**
 * Get a welcome message
 * @returns {string}
 */
function getWelcome() {
  return WELCOME_MESSAGES[Math.floor(Math.random() * WELCOME_MESSAGES.length)];
}

/**
 * Get all prompts
 * @returns {Array}
 */
function getAllPrompts() {
  return PROMPTS;
}

module.exports = {
  getTodaysPrompt,
  getWelcome,
  getAllPrompts,
  PROMPTS
};
