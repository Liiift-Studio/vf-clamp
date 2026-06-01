// src/__tests__/utils.test.ts — unit tests for compactName utility
import { describe, it, expect } from 'vitest'
import { compactName } from '../core/utils.js'

describe('compactName', () => {
	it('returns first when both strings are identical', () => {
		expect(compactName('Regular', 'Regular')).toBe('Regular')
	})

	it('strips shared prefix and joins differing parts with hyphen', () => {
		expect(compactName('Inter Light', 'Inter Bold')).toBe('Inter Light-Bold')
	})

	it('strips shared multi-word prefix', () => {
		expect(compactName('Condensed Thin', 'Condensed Black')).toBe('Condensed Thin-Black')
	})

	it('strips shared suffix tokens', () => {
		expect(compactName('Light Italic', 'Bold Italic')).toBe('Light-Bold Italic')
	})

	it('handles single-word names with no shared tokens', () => {
		expect(compactName('Thin', 'Black')).toBe('Thin-Black')
	})

	it('handles names where only last word differs', () => {
		expect(compactName('Encode Sans Light', 'Encode Sans Bold')).toBe('Encode Sans Light-Bold')
	})

	it('handles names where only first word differs', () => {
		expect(compactName('Light Condensed', 'Bold Condensed')).toBe('Light-Bold Condensed')
	})

	it('returns first when strings are completely unrelated', () => {
		// No shared prefix or suffix — both parts remain, joined by hyphen
		expect(compactName('Alpha', 'Beta')).toBe('Alpha-Beta')
	})

	it('handles multi-word names with shared prefix and suffix', () => {
		expect(compactName('Encode Sans Light Italic', 'Encode Sans Bold Italic')).toBe('Encode Sans Light-Bold Italic')
	})

	it('returns first argument when last argument is empty', () => {
		expect(compactName('Light', '')).toBe('Light')
	})

	it('returns last argument when first argument is empty', () => {
		expect(compactName('', 'Bold')).toBe('Bold')
	})

	it('handles names with hyphens already present', () => {
		// Hyphenated tokens are treated as single words
		expect(compactName('Inter-Display Light', 'Inter-Display Bold')).toBe('Inter-Display Light-Bold')
	})
})
