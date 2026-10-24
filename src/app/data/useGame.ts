import { DEFAULT_GAME, isLiveGame } from '../../core/games';
import type { GameId } from '../../core/games';
import { usePreference } from './usePreference';

// The game the player has chosen, kept on this device (and later on the account). A saved game that is not live (or not known)
// reads as the default, so a game can be switched off again without stranding anyone.
export function useGame(): [GameId, (game: GameId) => void] {
  const [saved, set] = usePreference<string>('game', DEFAULT_GAME);
  return [isLiveGame(saved) ? saved : DEFAULT_GAME, set];
}
