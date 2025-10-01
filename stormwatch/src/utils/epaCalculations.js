
/**
 * Calculate win probability for a team based on EPA difference
 * Uses a logistic function similar to what's used in FRC analytics
 * @param {number} teamEPA - The team's EPA value
 * @param {number} opponentEPA - The opponent's EPA value
 * @returns {number} Win probability as a percentage (0-100)
 */
export function calculateWinProbability(teamEPA, opponentEPA) {
  if (teamEPA === 0 && opponentEPA === 0) {
    return 50; // equal probability if no EPA data
  }
  
  const epaDifference = teamEPA - opponentEPA;
  
  // logistic function: P = 1 / (1 + e^(-k * x))
  // k is a scaling factor and x is the EPA difference
  const k = 0.08;
  const probability = 1 / (1 + Math.exp(-k * epaDifference));
  
  return Math.round(probability * 1000) / 10;
}

/**
 * Calculate win probabilities for all teams in a match
 * @param {Array} teams - Array of team objects with EPA values
 * @returns {Object} Object mapping team keys to win probabilities
 */
export function calculateMatchWinProbabilities(teams) {
  if (!teams || teams.length === 0) {
    return {};
  }
  
  const probabilities = {};
  
  if (teams.length > 2) {
    teams.forEach(team => {
      const otherTeams = teams.filter(t => t.key !== team.key);
      const averageOpponentEPA = otherTeams.reduce((sum, t) => sum + (t.epa || 0), 0) / otherTeams.length;
      probabilities[team.key] = calculateWinProbability(team.epa || 0, averageOpponentEPA);
    });
  } else if (teams.length === 2) {
    const team1 = teams[0];
    const team2 = teams[1];
    const prob1 = calculateWinProbability(team1.epa || 0, team2.epa || 0);
    probabilities[team1.key] = prob1;
    probabilities[team2.key] = 100 - prob1;
  }
  
  return probabilities;
}

/**
 * Format EPA value for display
 * @param {number} epa - EPA value
 * @returns {string} Formatted EPA string
 */
export function formatEPA(epa) {
  const numericEPA = typeof epa === 'string' ? parseFloat(epa) : epa;
  
  if (numericEPA === 0 || numericEPA === null || numericEPA === undefined || isNaN(numericEPA)) {
    return 'N/A';
  }
  
  return numericEPA > 0 ? `+${numericEPA.toFixed(1)}` : numericEPA.toFixed(1);
}

/**
 * Format win probability for display
 * @param {number} probability - Win probability percentage
 * @returns {string} Formatted probability string
 */
export function formatWinProbability(probability) {
  const numericProb = typeof probability === 'string' ? parseFloat(probability) : probability;
  
  if (numericProb === null || numericProb === undefined || isNaN(numericProb)) {
    return 'N/A';
  }
  
  return `${numericProb.toFixed(1)}%`;
}