// src/utils/chart.ts
export function buildCompactLabels(
labels: string[],
maxLabels = 7
): string[] {
if (!labels.length) return ["—"];
const step = Math.max(1, Math.ceil(labels.length / maxLabels));
return labels.map((l, i) => (i % step === 0 ? l : ""));
}

export function computeChartWidth(
pointsCount: number,
screenWidth: number,
minPadding = 40,
pxPerPoint = 22
) {
const minWidth = screenWidth - minPadding;
return Math.max(minWidth, pointsCount * pxPerPoint);
}
