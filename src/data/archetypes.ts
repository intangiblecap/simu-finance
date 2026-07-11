import type { Archetype, ArchetypeInfo } from '../types'

export const ARCHETYPES: Record<Archetype, ArchetypeInfo> = {
  centenaire: {
    label: 'Bananeraie centenaire',
    tagline: 'Stable et généreuse',
    description:
      "Plantée depuis des générations de singes. Son prix bouge peu et elle reverse chaque saison un petit bonus de bananes à qui possède des branches : c'est ce qu'on appelle un dividende.",
    risk: 1,
    riskLabel: 'Faible',
    liquidity: 3,
    liquidityLabel: 'Élevée',
  },
  startup: {
    label: 'Jeune pousse ambitieuse',
    tagline: 'Risquée, promesses de gloire',
    description:
      "Un tout jeune bananier plein d'ambition. Son prix peut grimper très vite... ou s'effondrer tout aussi vite. Aucun dividende : tout se joue sur le prix de la branche.",
    risk: 3,
    riskLabel: 'Élevé',
    liquidity: 2,
    liquidityLabel: 'Moyenne',
  },
  industrielle: {
    label: 'Bananeraie industrielle',
    tagline: 'Des hauts et des bas réguliers',
    description:
      "Une grande exploitation qui suit les saisons de production : des cycles de hausse puis de baisse, assez prévisibles mais jamais figés.",
    risk: 2,
    riskLabel: 'Moyen',
    liquidity: 3,
    liquidityLabel: 'Élevée',
  },
  labo: {
    label: 'Labo de greffage',
    tagline: "Coups de génie ou échecs",
    description:
      "Des chercheurs y inventent de nouvelles variétés de bananes. Ça peut déboucher sur une découverte spectaculaire... ou ne mener nulle part. Prix très imprévisible.",
    risk: 3,
    riskLabel: 'Élevé',
    liquidity: 2,
    liquidityLabel: 'Moyenne',
  },
  familiale: {
    label: 'Petite bananeraie familiale',
    tagline: 'Calme et discrète',
    description:
      "Une petite exploitation isolée où peu de singes viennent échanger des branches. Son prix bouge à peine, saison après saison.",
    risk: 1,
    riskLabel: 'Faible',
    liquidity: 1,
    liquidityLabel: 'Faible',
  },
}
