// Top 10 Demon Slayer characters by combat strength (fan-oriented ranking; not an official ranking).
// Character artwork is resolved with exact-name image searches so the site does not use generic animal/random images.
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

const CHARACTER_ALIASES = {
  'Demon King Tanjiro Kamado': ['Demon King Tanjiro', 'Demon Tanjiro Kamado', 'Tanjiro Kamado demon'],
  'Yoriichi Tsugikuni': ['Yoriichi Tsugikuni'],
  'Muzan Kibutsuji': ['Muzan Kibutsuji'],
  'Kokushibo': ['Kokushibo'],
  'Doma': ['Doma Demon Slayer', 'Douma Demon Slayer'],
  'Akaza': ['Akaza Demon Slayer'],
  'Gyomei Himejima': ['Gyomei Himejima'],
  'Sanemi Shinazugawa': ['Sanemi Shinazugawa'],
  'Tanjiro Kamado': ['Tanjiro Kamado'],
  'Giyu Tomioka': ['Giyu Tomioka', 'Giyu Tomioka Demon Slayer'],
};

function aliasesFor(name) { return CHARACTER_ALIASES[name] || [name]; }

async function fetchCommonsImage(name) {
  for (const query of aliasesFor(name)) {
    const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(`"${query}"`)}&gsrnamespace=6&gsrlimit=20&prop=imageinfo&iiprop=url|mime|size&iiurlwidth=1600&format=json&origin=*`;
    const response = await fetch(url);
    if (!response.ok) continue;
    const data = await response.json();
    const pages = Object.values(data?.query?.pages || {});
    const terms = query.toLowerCase().replace(/[^a-z0-9 ]/g, '').split(/\s+/).filter(Boolean);
    const ranked = pages
      .filter((page) => page?.imageinfo?.[0]?.mime?.startsWith('image/'))
      .map((page) => {
        const title = (page.title || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ');
        const score = terms.reduce((sum, term) => sum + (title.includes(term) ? 1 : 0), 0);
        return { page, score };
      })
      .sort((a, b) => b.score - a.score);
    const best = ranked.find((item) => item.score >= Math.max(1, Math.min(terms.length, 2)));
    if (best) return best.page.imageinfo[0].thumburl || best.page.imageinfo[0].url;
  }
  return null;
}

async function fetchWikipediaImage(name) {
  for (const query of aliasesFor(name)) {
    const exact = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(wikipediaSlug(query))}`);
    if (exact.ok) {
      const data = await exact.json();
      if (data?.originalimage?.source || data?.thumbnail?.source) return data.originalimage?.source || data.thumbnail.source;
    }
    const search = await fetch(`https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(`"${query}" Demon Slayer`)}&gsrnamespace=0&gsrlimit=10&prop=pageimages&piprop=original|thumbnail&pithumbsize=1600&format=json&origin=*`);
    if (!search.ok) continue;
    const data = await search.json();
    const pages = Object.values(data?.query?.pages || {});
    const match = pages.find((page) => {
      const title = (page.title || '').toLowerCase();
      return title.includes(query.toLowerCase().split(' ')[0]) && (page.original?.source || page.thumbnail?.source);
    });
    if (match) return match.original?.source || match.thumbnail?.source;
  }
  return null;
}

export async function loadAnimalImage(animal) {
  try {
    let source = null;
    try { source = await fetchCommonsImage(animal.name); } catch { source = null; }
    if (!source) source = await fetchWikipediaImage(animal.name);
    if (!source) throw new Error(`No dedicated character image found for ${animal.name}`);
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.src = source;
    await image.decode();
    animal.image = {
      id: crypto.randomUUID(),
      name: `${animal.name}.jpg`,
      url: source,
      width: image.naturalWidth,
      height: image.naturalHeight,
      imageElement: image,
      remote: true,
    };
    return animal;
  } catch {
    animal.image = null;
    return animal;
  }
}
