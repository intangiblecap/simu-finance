import type { BananaTree } from '../types'

export function createInitialTrees(): BananaTree[] {
  return [
    {
      id: 'baobanane',
      name: 'Le Grand Baobanane',
      archetype: 'centenaire',
      totalShares: 500,
      price: 10,
      history: [10],
      paysDividend: true,
      dividendYield: 0.05,
    },
    {
      id: 'kiwipousse',
      name: 'Kiwi & Pousse',
      archetype: 'startup',
      totalShares: 200,
      price: 4,
      history: [4],
      paysDividend: false,
      dividendYield: 0,
    },
    {
      id: 'bananalia',
      name: 'Bananalia Industries',
      archetype: 'industrielle',
      totalShares: 350,
      price: 6,
      history: [6],
      paysDividend: false,
      dividendYield: 0,
    },
    {
      id: 'grefftech',
      name: 'GreffTech Labs',
      archetype: 'labo',
      totalShares: 150,
      price: 5,
      history: [5],
      paysDividend: false,
      dividendYield: 0,
    },
    {
      id: 'troissinges',
      name: 'La Bananeraie des Trois Singes',
      archetype: 'familiale',
      totalShares: 100,
      price: 8,
      history: [8],
      paysDividend: false,
      dividendYield: 0,
    },
  ]
}
