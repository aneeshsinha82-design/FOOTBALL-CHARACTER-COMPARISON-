// Top 100 living animals for the size-comparison mode.
// sizeMeters is the maximum/representative total length used for the visual scale.
export const ANIMALS = [
  ['Blue whale', 33.5], ['Fin whale', 27.3], ['Sei whale', 20.5], ['Sperm whale', 20.5],
  ['Northern right whale', 18.3], ['Humpback whale', 18], ['Whale shark', 18], ['Bowhead whale', 18],
  ['Bryde\'s whale', 15.5], ['Southern right whale', 15.5], ['Gray whale', 15], ['Giant squid', 13],
  ['Basking shark', 12], ['Giant oarfish', 11], ['Orca', 9.8], ['Giant manta ray', 9],
  ['Giant oceanic manta ray', 9], ['Reticulated python', 7.6], ['African bush elephant', 7.5],
  ['Tiger shark', 7.4], ['Greenland shark', 7.3], ['Great white shark', 6.1], ['Common thresher shark', 6.1],
  ['Gharial', 6.1], ['Saltwater crocodile', 6.3], ['Green anaconda', 6.4], ['Asian elephant', 6.4],
  ['King cobra', 5.8], ['American alligator', 5.5], ['Nile crocodile', 5.5], ['Giraffe', 5.5],
  ['Megamouth shark', 5.5], ['Hippopotamus', 5.1], ['Giant Pacific octopus', 5], ['Giant freshwater stingray', 5],
  ['Atlantic bluefin tuna', 4.6], ['White rhinoceros', 4.2], ['Black rhinoceros', 3.8], ['American bison', 3.8],
  ['Siberian tiger', 3.7], ['Lion', 3.3], ['Gaur', 3.3], ['Wild yak', 3.25], ['Moose', 3.1],
  ['Komodo dragon', 3.1], ['Domestic cattle', 3], ['Kodiak bear', 3], ['Brown bear', 2.8], ['Ostrich', 2.8],
  ['Red kangaroo', 2.8], ['Plains zebra', 2.7], ['Jaguar', 2.7], ['Polar bear', 2.6], ['Leatherback sea turtle', 2.4],
  ['Nile monitor', 2.4], ['Giant anteater', 2.2], ['Leopard', 2.1], ['Emu', 2], ['Green iguana', 2],
  ['Wild boar', 1.9], ['Gorilla', 1.8], ['Giant river otter', 1.8], ['Giant pangolin', 1.8], ['Cassowary', 1.8],
  ['Chinese giant salamander', 1.8], ['Chimpanzee', 1.7], ['Wandering albatross', 1.4], ['Andean condor', 1.3],
  ['Capybara', 1.3], ['Beaver', 1.3], ['Coyote', 1.3], ['Emperor penguin', 1.3], ['Dhole', 1.1],
  ['Mandrill', 1], ['Goliath frog', 0.9], ['Red fox', 0.9], ['Arctic fox', 0.8], ['Raccoon', 0.7],
  ['Horseshoe crab', 0.6], ['Giant African land snail', 0.3], ['Atlas moth', 0.3], ['Queen Alexandra\'s birdwing', 0.28],
  ['Goliath beetle', 0.12], ['Secretarybird', 1.5], ['Shoebill', 1.5], ['Marabou stork', 1.5], ['Greater rhea', 1.5],
  ['Galapagos tortoise', 1.5], ['Aldabra giant tortoise', 1.5], ['Orangutan', 1.5], ['African wild dog', 1.5],
  ['Giant armadillo', 1.5], ['Giant clam', 1.4], ['Giant golden-crowned flying fox', 1.7], ['Gray wolf', 1.6],
  ['Japanese giant salamander', 1.5], ['Wolverine', 1.1], ['Siberian ibex', 1.5], ['Common moorhen', 0.35]
].sort((a, b) => b[1] - a[1]).slice(0, 100);

export function wikipediaSlug(name) {
  return name.replace(/ /g, '_');
}

export async function loadAnimalImage(animal) {
  try {
    const response = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(wikipediaSlug(animal.name))}`);
    if (!response.ok) throw new Error('Wikipedia image request failed');
    const data = await response.json();
    const source = data?.originalimage?.source || data?.thumbnail?.source;
    if (!source) throw new Error('No image found');
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
