// Listes d'actions utilisées par l'onglet « Découvrir ».

export interface FeaturedStock {
  symbol: string;
  name: string;
  country: string;
  sector: string;
  why: string; // pourquoi la connaître, en une phrase
}

// 20 grandes actions européennes à connaître : leaders mondiaux de leur secteur,
// très suivies, couvrant les principaux secteurs de l'économie.
export const FEATURED: FeaturedStock[] = [
  { symbol: "ASML.AS", name: "ASML", country: "Pays-Bas", sector: "Semi-conducteurs", why: "Seul fabricant au monde des machines de lithographie EUV, indispensables pour graver les puces électroniques les plus avancées." },
  { symbol: "MC.PA", name: "LVMH", country: "France", sector: "Luxe", why: "Numéro un mondial du luxe (Louis Vuitton, Dior, Moët Hennessy, Sephora) : un baromètre de la consommation des ménages aisés dans le monde." },
  { symbol: "RMS.PA", name: "Hermès", country: "France", sector: "Luxe", why: "Maroquinerie et luxe très haut de gamme, contrôlé par la famille fondatrice, avec des marges parmi les plus élevées d'Europe." },
  { symbol: "OR.PA", name: "L'Oréal", country: "France", sector: "Cosmétiques", why: "Numéro un mondial de la beauté, réputé pour la régularité de sa croissance." },
  { symbol: "TTE.PA", name: "TotalEnergies", country: "France", sector: "Énergie", why: "Major pétrolière et gazière qui investit dans l'électricité ; son cours suit en partie celui du pétrole et elle verse un dividende élevé." },
  { symbol: "SHEL.L", name: "Shell", country: "Royaume-Uni", sector: "Énergie", why: "Plus grande compagnie pétrolière européenne, cotée à Londres en pence (convertie en euros dans l'app)." },
  { symbol: "SAP.DE", name: "SAP", country: "Allemagne", sector: "Logiciels", why: "Géant européen du logiciel : ses programmes de gestion (ERP) font tourner une grande partie des entreprises mondiales." },
  { symbol: "SIE.DE", name: "Siemens", country: "Allemagne", sector: "Industrie", why: "Conglomérat industriel : automatisation des usines, infrastructures, numérisation de l'industrie." },
  { symbol: "AIR.PA", name: "Airbus", country: "France", sector: "Aéronautique", why: "Un des deux constructeurs mondiaux d'avions de ligne avec Boeing, avec un carnet de commandes de plusieurs années." },
  { symbol: "SAF.PA", name: "Safran", country: "France", sector: "Aéronautique", why: "Motoriste d'avions (moteurs CFM avec General Electric) : profite du trafic aérien via la maintenance et les pièces." },
  { symbol: "SU.PA", name: "Schneider Electric", country: "France", sector: "Équipements électriques", why: "Spécialiste de la gestion de l'énergie, porté par l'électrification et la construction de data centers." },
  { symbol: "NOVO-B.CO", name: "Novo Nordisk", country: "Danemark", sector: "Santé", why: "Leader des traitements du diabète et de l'obésité (Ozempic, Wegovy), cotée à Copenhague en couronnes danoises." },
  { symbol: "NESN.SW", name: "Nestlé", country: "Suisse", sector: "Alimentation", why: "Numéro un mondial de l'agroalimentaire : une valeur dite « défensive », qui varie généralement moins que le marché." },
  { symbol: "SAN.PA", name: "Sanofi", country: "France", sector: "Pharmacie", why: "Grand laboratoire pharmaceutique français (médicaments, vaccins), autre valeur plutôt défensive." },
  { symbol: "BNP.PA", name: "BNP Paribas", country: "France", sector: "Banque", why: "Plus grande banque de la zone euro : sensible aux taux d'intérêt et à la santé de l'économie européenne." },
  { symbol: "ALV.DE", name: "Allianz", country: "Allemagne", sector: "Assurance", why: "Un des plus grands assureurs et gestionnaires d'actifs du monde." },
  { symbol: "AI.PA", name: "Air Liquide", country: "France", sector: "Chimie", why: "Gaz industriels et médicaux : croissance régulière et très présente chez les particuliers français." },
  { symbol: "RACE.MI", name: "Ferrari", country: "Italie", sector: "Automobile de luxe", why: "Constructeur automobile qui se valorise comme une marque de luxe, avec des volumes volontairement limités." },
  { symbol: "ITX.MC", name: "Inditex", country: "Espagne", sector: "Habillement", why: "Maison mère de Zara, numéro un mondial de l'habillement." },
  { symbol: "RHM.DE", name: "Rheinmetall", country: "Allemagne", sector: "Défense", why: "Premier groupe de défense allemand, emblématique de la hausse des budgets militaires européens." },
];

// Nombre d'actions affichées dans chaque liste de tendances.
export const TREND_TOP_N = 5;

// Univers pour les tendances du jour : grandes capitalisations européennes.
export const TREND_UNIVERSE: string[] = [
  ...FEATURED.map((f) => f.symbol),
  // France
  "BN.PA", "CS.PA", "DG.PA", "EL.PA", "KER.PA", "RI.PA", "CAP.PA", "ORA.PA", "GLE.PA", "ACA.PA",
  "ENGI.PA", "STLAP.PA", "RNO.PA", "HO.PA", "DSY.PA", "SGO.PA", "ML.PA", "VIE.PA", "PUB.PA", "STMPA.PA",
  // Allemagne
  "DTE.DE", "MBG.DE", "BMW.DE", "VOW3.DE", "BAS.DE", "BAYN.DE", "MUV2.DE", "DBK.DE", "IFX.DE", "ADS.DE",
  // Pays-Bas, Italie, Espagne, Suisse, Royaume-Uni
  "INGA.AS", "ADYEN.AS", "PRX.AS", "UCG.MI", "ISP.MI", "ENEL.MI", "SAN.MC", "IBE.MC",
  "NOVN.SW", "UBSG.SW", "AZN.L", "HSBA.L", "ULVR.L", "BP.L",
];
