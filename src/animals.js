// Top 10 Demon Slayer characters by combat strength (fan-oriented ranking; not an official ranking).
// Images are resolved dynamically from Wikimedia Commons, with Wikipedia fallback.
export const ANIMALS = [
  ['Yoriichi Tsugikuni', 10],
  ['Muzan Kibutsuji', 9],
  ['Kokushibo', 8],
  ['Demon King Tanjiro Kamado', 7],
  ['Doma', 6],
  ['Akaza', 5],
  ['Gyomei Himejima', 4],
  ['Sanemi Shinazugawa', 3],
  ['Tanjiro Kamado', 2],
  ['Giyu Tomioka', 1]
].sort((a, b) => b[1] - a[1]);

export function wikipediaSlug(name) { return name.replace(/ /g, '_'); }

async function fetchCommonsImage(name) {
  const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(name + ' Demon Slayer')}&gsrnamespace=6&gsrlimit=10&prop=imageinfo&iiprop=url|mime|size&iiurlwidth=1600&format=json&origin=*`;
  const response = await fetch(url);
  if (!response.ok) throw new Error('Wikimedia Commons search failed');
  const data = await response.json();
  const pages = Object.values(data?.query?.pages || {});
  const preferred = pages.find((page) => page?.imageinfo?.[0]?.mime?.startsWith('image/'));
  return preferred?.imageinfo?.[0]?.thumburl || preferred?.imageinfo?.[0]?.url || null;
}

async function fetchWikipediaImage(name) {
  const summary = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(wikipediaSlug(name))}`);
  if (summary.ok) {
    const data = await summary.json();
    if (data?.originalimage?.source || data?.thumbnail?.source) return data.originalimage?.source || data.thumbnail.source;
  }
  const search = await fetch(`https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(name + ' Demon Slayer')}&gsrnamespace=0&prop=pageimages&piprop=original|thumbnail&pithumbsize=1600&format=json&origin=*`);
  if (!search.ok) throw new Error('Wikipedia image search failed');
  const data = await search.json();
  const page = Object.values(data?.query?.pages || {})[0];
  return page?.original?.source || page?.thumbnail?.source || null;
}

export async function loadAnimalImage(animal) {
  try {
    let source = null;
    try { source = await fetchCommonsImage(animal.name); } catch { source = null; }
    if (!source) source = await fetchWikipediaImage(animal.name);
    if (!source) throw new Error('No image found');
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.src = source;
    await image.decode();
    animal.image = { id: crypto.randomUUID(), name: `${animal.name}.jpg`, url: source, width: image.naturalWidth, height: image.naturalHeight, imageElement: image, remote: true };
    return animal;
  } catch {
    animal.image = null;
    return animal;
  }
}
