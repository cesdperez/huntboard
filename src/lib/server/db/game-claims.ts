/**
 * FROM clause for the claims of one game, filtered by `team.game_id`. CROSS JOIN fixes the join
 * order in SQLite, so the query reads only this game's teams and claims instead of every game's.
 */
export const GAME_CLAIMS = 'team CROSS JOIN claim ON claim.team_id = team.id';
