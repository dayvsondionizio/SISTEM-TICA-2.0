// Ranking do ICMS antecipado por grupo de produto (NCM de 4 dígitos), calculado direto da planilha.
// Sem IA e sem banco de dados: é só somar e ordenar. Os nomes vêm das listas fixas abaixo;
// NCM que não estiver na lista aparece como "NCM 0000".

export interface SubgrupoRanking { codigo: string; nome: string; compras: number; icms: number }
export interface GrupoRanking { codigo: string; nome: string; compras: number; icms: number; subgrupos: SubgrupoRanking[] }
export interface RankingIcms {
  grupos: GrupoRanking[];
  demaisQtd: number;
  demaisCompras: number;
  demaisIcms: number;
  totalCompras: number;
  totalIcms: number;
  totalGrupos: number;
}

const NOMES_NCM4: Record<string, string> = {
  '0406': 'Queijos', '2204': 'Vinhos e espumantes', '0207': 'Aves (frango, peru)', '1602': 'Presunto, tender e peito de peru',
  '1806': 'Chocolates e bombons', '0401': 'Leite e creme de leite', '1509': 'Azeite de oliva', '0405': 'Manteiga',
  '2008': 'Frutas em calda e preparadas', '1517': 'Margarinas', '2007': 'Geleias e doces de fruta', '0306': 'Camarões',
  '0402': 'Leite condensado e concentrado', '2103': 'Molhos, ketchup e mostarda', '0801': 'Castanhas de caju e coco',
  '2106': 'Preparações alimentícias diversas', '1601': 'Embutidos (linguiça, mortadela, salsicha)',
  '2005': 'Azeitonas e hortaliças em conserva', '1901': 'Misturas, panetone e preparações de farinha', '2009': 'Sucos e água de coco',
  '1905': 'Biscoitos e salgadinhos', '0901': 'Café', '0210': 'Carnes curadas (presunto cru)', '1704': 'Confeitos e açúcar de confeitaria',
  '1701': 'Açúcar', '0802': 'Amêndoas e pistache', '0403': 'Iogurtes e fermentados lácteos', '2202': 'Achocolatados e bebidas não alcoólicas',
  '2102': 'Fermentos', '1511': 'Óleo de palma', '1105': 'Batata desidratada', '0806': 'Uvas passas', '2001': 'Alcaparras e conservas em vinagre',
  '1512': 'Óleo de girassol', '1903': 'Tapioca', '1507': 'Óleo de soja', '2006': 'Frutas cristalizadas', '1604': 'Atum e conservas de peixe',
  '1006': 'Arroz', '1207': 'Gergelim e sementes', '0813': 'Frutas secas', '1515': 'Óleo de milho', '1904': 'Granola, pipoca e cereais prontos',
  '0803': 'Banana passa e chips', '2101': 'Café solúvel', '0409': 'Mel', '2922': 'Aminoácidos', '2209': 'Vinagres',
  '1104': 'Aveia e cereais trabalhados', '2002': 'Tomate seco e pimentas em conserva', '2104': 'Caldos e cremes prontos',
  '1702': 'Outros açúcares', '2915': 'Antimofo (ácidos)', '1108': 'Amidos', '2004': 'Hortaliças congeladas preparadas',
  '2206': 'Bebidas fermentadas', '2003': 'Cogumelos em conserva', '1005': 'Milho de pipoca', '0804': 'Tâmaras', '1902': 'Massas e cuscuz',
  '0710': 'Hortaliças congeladas', '0811': 'Frutas congeladas', '3302': 'Essências aromatizantes', '1211': 'Plantas para chá', '0902': 'Chá',
};

const NOMES_NCM6: Record<string, string> = {
  '040610': 'Queijos frescos (mussarela, requeijão)', '040620': 'Queijos ralados', '040630': 'Queijos processados',
  '040640': 'Queijos azuis', '040690': 'Outros queijos (coalho, reino, prato)',
  '220410': 'Espumantes e champagne', '220421': 'Vinhos tintos, brancos e rosés',
  '020712': 'Aves inteiras congeladas (chester, frango)', '020714': 'Cortes de frango congelados',
  '020725': 'Peru inteiro congelado', '020727': 'Cortes de peru congelados',
};

const semAcento = (s: unknown) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toUpperCase();
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const fmtNcm6 = (c: string) => (c.length >= 6 ? `${c.slice(0, 4)}.${c.slice(4, 6)}` : c);

// Sem arredondar célula a célula: o ICMS da planilha tem várias casas e arredondar cada linha desvia o total em centavos.
const num = (v: any): number => {
  if (v === undefined || v === null || v === '') return 0;
  if (typeof v === 'number') return v;
  let s = String(v).trim();
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  s = s.replace(/[^\d.-]/g, '');
  return parseFloat(s) || 0;
};

/** rows[0] = cabeçalho. Devolve null se a planilha não tiver as colunas de NCM, valor ou ICMS antecipado. */
export function calcularRankingIcms(rows: any[][]): RankingIcms | null {
  if (!rows || rows.length < 2) return null;
  const headers = rows[0].map(semAcento);
  const achar = (...nomes: string[]) => {
    for (const n of nomes) { const i = headers.indexOf(n); if (i !== -1) return i; }
    return -1;
  };
  const iNcm = achar('CLASSIFICACAO FISCAL', 'NCM');
  const iValor = achar('VALOR TOTAL');
  const iIcms = achar('VALOR DO ICMS ANTECIPADO');
  const iDesc = achar('DESCRICAO', 'DESCRICAO DO PRODUTO');
  if (iNcm === -1 || iValor === -1 || iIcms === -1) return null;

  const g4 = new Map<string, { compras: number; icms: number; sub: Map<string, { compras: number; icms: number }> }>();
  let totalCompras = 0, totalIcms = 0;
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    if (iDesc !== -1 && !String(row[iDesc] ?? '').trim()) continue;
    const valor = num(row[iValor]);
    const icms = num(row[iIcms]);
    if (valor === 0 && icms === 0) continue;
    const ncm = String(row[iNcm] ?? '').replace(/\D/g, '');
    const c4 = ncm.length >= 4 ? ncm.slice(0, 4) : 'SEM';
    const c6 = ncm.length >= 6 ? ncm.slice(0, 6) : c4;
    const g = g4.get(c4) ?? { compras: 0, icms: 0, sub: new Map() };
    g.compras += valor; g.icms += icms;
    const s = g.sub.get(c6) ?? { compras: 0, icms: 0 };
    s.compras += valor; s.icms += icms;
    g.sub.set(c6, s); g4.set(c4, g);
    totalCompras += valor; totalIcms += icms;
  }
  if (g4.size === 0 || totalIcms <= 0) return null;

  const ordenados = [...g4.entries()].sort((a, b) => b[1].icms - a[1].icms);
  const grupos: GrupoRanking[] = ordenados.slice(0, 10).map(([codigo, g], idx) => {
    let subgrupos: SubgrupoRanking[] = [];
    if (idx < 3 && g.sub.size > 1) {
      const subs = [...g.sub.entries()].sort((a, b) => b[1].icms - a[1].icms)
        .map(([c, s]) => ({ codigo: c, nome: NOMES_NCM6[c] ?? `NCM ${fmtNcm6(c)}`, compras: round2(s.compras), icms: round2(s.icms) }));
      if (subs.length > 4) {
        const resto = subs.slice(3);
        subgrupos = [...subs.slice(0, 3), {
          codigo: 'DEMAIS', nome: 'Demais subgrupos',
          compras: round2(resto.reduce((a, s) => a + s.compras, 0)), icms: round2(resto.reduce((a, s) => a + s.icms, 0)),
        }];
      } else subgrupos = subs;
    }
    return { codigo, nome: codigo === 'SEM' ? 'Sem NCM informado' : (NOMES_NCM4[codigo] ?? `NCM ${codigo}`), compras: round2(g.compras), icms: round2(g.icms), subgrupos };
  });
  const resto = ordenados.slice(10);
  return {
    grupos,
    demaisQtd: resto.length,
    demaisCompras: round2(resto.reduce((a, [, g]) => a + g.compras, 0)),
    demaisIcms: round2(resto.reduce((a, [, g]) => a + g.icms, 0)),
    totalCompras: round2(totalCompras),
    totalIcms: round2(totalIcms),
    totalGrupos: ordenados.length,
  };
}
