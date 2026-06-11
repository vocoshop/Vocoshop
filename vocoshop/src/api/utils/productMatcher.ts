/* =====================================================
SMART PRODUCT MATCHER — VOCOSHOP
Tolérant fautes + accents + espaces
===================================================== */

function normalize(str: string): string {
return str
.toLowerCase()
.normalize("NFD")
.replace(/[\u0300-\u036f]/g, "") // enlève accents
.replace(/[^a-z0-9]/g, ""); // enlève espaces et symboles
}

/* =====================================================
LEVENSHTEIN DISTANCE
Tolérance fautes type "coka" -> "coca"
===================================================== */

function levenshtein(a: string, b: string): number {
const matrix = [];

for (let i = 0; i <= b.length; i++) {
matrix[i] = [i];
}

for (let j = 0; j <= a.length; j++) {
matrix[0][j] = j;
}

for (let i = 1; i <= b.length; i++) {
for (let j = 1; j <= a.length; j++) {
if (b.charAt(i - 1) === a.charAt(j - 1)) {
matrix[i][j] = matrix[i - 1][j - 1];
} else {
matrix[i][j] = Math.min(
matrix[i - 1][j - 1] + 1,
matrix[i][j - 1] + 1,
matrix[i - 1][j] + 1
);
}
}
}

return matrix[b.length][a.length];
}

/* =====================================================
FIND BEST PRODUCT MATCH
===================================================== */

export function findBestProductMatch(
voiceProduct: string,
products: { _id: string; name: string }[]
) {
if (!voiceProduct || !products?.length) return null;

const normalizedVoice = normalize(voiceProduct);

let bestScore = Infinity;
let bestProduct = null;

for (const product of products) {
const normalizedProduct = normalize(product.name);

// score distance
const distance = levenshtein(normalizedVoice, normalizedProduct);

if (distance < bestScore) {
bestScore = distance;
bestProduct = product;
}
}

// seuil tolérance
if (bestScore <= 3) {
return bestProduct;
}

return null;
}
