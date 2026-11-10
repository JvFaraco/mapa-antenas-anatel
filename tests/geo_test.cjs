// Testes do app/js/geo.js (indice em grade e leitura do lote), sem rede e
// sem navegador. Rodado pelo tests/test_antenas.py quando o Node existe na
// maquina; sem Node, aquele teste e pulado (o projeto nao depende do Node).
//
//     node tests/geo_test.cjs
'use strict';
const assert = require('assert');
const path = require('path');
const Geo = require(path.join(__dirname, '..', 'app', 'js', 'geo.js'));

let falhas = 0;
function caso(nome, fn) {
  try { fn(); console.log('ok   ' + nome); }
  catch (e) { falhas++; console.log('FALHA ' + nome + '\n      ' + e.message); }
}

// Gerador fixo: o mesmo conjunto toda vez.
let semente = 20261110;
function aleatorio() {
  semente = (Math.imul(semente, 1664525) + 1013904223) >>> 0;
  return semente / 4294967296;
}

caso('grade entrega exatamente o mesmo que a varredura linear', () => {
  const n = 20000;
  const lats = new Float64Array(n), lons = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    // Aglomerado perto de Florianopolis + espalhado pelo Brasil, com pontos
    // colados nas bordas de celula (multiplos de 0,1 grau).
    if (i % 3 === 0) { lats[i] = -27.6 + (aleatorio() - 0.5) * 0.6; lons[i] = -48.5 + (aleatorio() - 0.5) * 0.6; }
    else if (i % 7 === 0) { lats[i] = -27.5 + Math.round(aleatorio() * 10) / 10; lons[i] = -48.5 - Math.round(aleatorio() * 10) / 10; }
    else { lats[i] = -33.5 + aleatorio() * 38.5; lons[i] = -73.5 + aleatorio() * 45; }
  }
  const idx = Geo.criarIndice(lats, lons);
  const consultas = [[-27.5954, -48.548, 5], [-27.5, -48.5, 0.05], [-3.1, -60.0, 50], [-33.7, -53.4, 30], [5.2, -60.7, 50], [-27.6, -48.5, 12.3]];
  for (let q = 0; q < 300; q++) consultas.push([-33 + aleatorio() * 37, -73 + aleatorio() * 44, 0.5 + aleatorio() * 49.5]);
  for (const [la, lo, raio] of consultas) {
    const linear = [];
    for (let i = 0; i < n; i++) if (Geo.distanciaKm(la, lo, lats[i], lons[i]) <= raio) linear.push(i);
    const grade = [];
    Geo.paraCadaCandidato(idx, la, lo, raio, (i) => { if (Geo.distanciaKm(la, lo, lats[i], lons[i]) <= raio) grade.push(i); });
    grade.sort((a, b) => a - b);
    assert.deepStrictEqual(grade, linear, 'divergiu em ' + la + ', ' + lo + ' raio ' + raio);
  }
});

caso('grade guarda cada antena uma vez so', () => {
  const lats = [-27.5, -27.5, -3.0, 5.27, -33.75], lons = [-48.5, -48.5, -60.0, -60.2, -53.4];
  const idx = Geo.criarIndice(lats, lons);
  assert.strictEqual(idx.itens.length, 5);
  assert.deepStrictEqual(Array.from(idx.itens).sort(), [0, 1, 2, 3, 4]);
});

caso('lote: formatos de planilha, Google Maps e tabulacao', () => {
  const r = Geo.lerLote([
    'id;lat;lon',
    'ponto 1;-27,5954;-48,5480',
    '-26.30, -48.84',
    '123\t-27.59\t-48.55',
    '"Loja Centro",-23.5505,-46.6333',
    '',
    'sem nada aqui',
    '40.71, -74.00'
  ].join('\n'));
  assert.deepStrictEqual(r.pontos.map(p => [p.id, p.lat, p.lon]), [
    ['ponto 1', -27.5954, -48.548],
    ['linha 3', -26.3, -48.84],
    ['123', -27.59, -48.55],
    ['Loja Centro', -23.5505, -46.6333]
  ]);
  assert.deepStrictEqual(r.ignoradas, [
    { linha: 1, motivo: 'sem coordenada' },
    { linha: 7, motivo: 'sem coordenada' },
    { linha: 8, motivo: 'fora do Brasil' }
  ]);
});

caso('lote: limite de pontos nao some com o excedente', () => {
  const r = Geo.lerLote('-27.1,-48.1\n-27.2,-48.2\n-27.3,-48.3', 2);
  assert.strictEqual(r.pontos.length, 2);
  assert.deepStrictEqual(r.ignoradas, [{ linha: 3, motivo: 'acima do limite' }]);
});

caso('lote: Noronha entra (leste ate -28, como no consolidar.py)', () => {
  const r = Geo.lerLote('-3.85, -32.42');
  assert.strictEqual(r.pontos.length, 1);
});

if (falhas) { console.log(falhas + ' falha(s)'); process.exit(1); }
console.log('todos ok');
