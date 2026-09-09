/** Emergency containment disables new starts while keeping earned awards visible. */
export const challengeEnabled = () => import.meta.env.VITE_HOME_CHALLENGE_ENABLED !== 'false';
export const CHALLENGE_CANDIDATE = 'home-challenge-v1';
