import { prefersReducedMotion } from 'svelte/motion';

/** The only unprompted motion: scoreboard rows sliding to their new rank after a poll. */
export const REORDER_MS = 300;
export const COUNT_UP_MS = 600;

/** 0 when the viewer asked for reduced motion, so the change is instant. Read it in a reactive context. */
export function motionMs(ms: number): number {
	return prefersReducedMotion.current ? 0 : ms;
}
