import type {Career} from '../src/career';
/** Tests written for the pre-0.15 week (match on Saturday) pin every match day of the season to Saturday. */
export function saturdays<T extends Career>(c:T):T{c.world.season?.matchDays.fill(5);return c;}
