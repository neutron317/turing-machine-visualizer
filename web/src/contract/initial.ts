import type { DFAConfig, DFASpec, DTMConfig, DTMSpec } from "./schemas.ts";

// 入力文字列から初期コンフィグを構成する(contract.md §3)。記号は 1 文字前提。

export function initialDfaConfig(spec: DFASpec, input: string): DFAConfig {
	return { state: spec.start, rest: [...input] };
}

export function initialDtmConfig(spec: DTMSpec, input: string): DTMConfig {
	const cells = [...input];
	if (cells.length === 0) {
		return { state: spec.start, left: [], head: null, right: [] };
	}
	return {
		state: spec.start,
		left: [],
		head: cells[0],
		right: cells.slice(1),
	};
}
