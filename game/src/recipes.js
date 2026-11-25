// The menu: seven shared ingredients, four dishes, and the little rules that
// connect them (which station each ingredient needs, what a dish costs).
export const INGREDIENTS = {
  tomato: { name: 'Tomato', key: '1', process: 'chop', color: '#e14b3a', accent: '#7fbf58', sliced: 'Chopped Tomato' },
  onion:  { name: 'Onion',  key: '2', process: 'chop', color: '#c2688d', accent: '#f4dbe6', sliced: 'Diced Onion' },
  herb:   { name: 'Herb',   key: '3', process: 'chop', color: '#5f9e4a', accent: '#b6dd8c', sliced: 'Chopped Herb' },
  bun:    { name: 'Bun',    key: '4', process: null,   color: '#d99a52', accent: '#f6d9a8', sliced: 'Bun' },
  patty:  { name: 'Patty',  key: '5', process: 'grill', color: '#8a5638', accent: '#5c3520', sliced: 'Grilled Patty' },
  cheese: { name: 'Cheese', key: '6', process: null,   color: '#f3c04b', accent: '#ffe6a1', sliced: 'Cheese' },
  pasta:  { name: 'Pasta',  key: '7', process: 'boil', color: '#efd79b', accent: '#fff0c4', sliced: 'Boiled Pasta' },
};

export const PROCESS_LABEL = { chop: 'Chop', grill: 'Grill', boil: 'Boil' };

export const DISHES = [
  {
    id: 'sunset',
    name: 'Sunset Burger',
    short: 'Burger',
    price: 120,
    parts: ['bun', 'patty', 'tomato', 'cheese'],
    steps: ['grill', 'chop', 'stack'],
    tags: ['grill', 'chop'],
    blurb: 'Griddled patty, sweet tomato, melted cheese.',
    tier: 1,
  },
  {
    id: 'pasta',
    name: 'Herb Pasta',
    short: 'Pasta',
    price: 100,
    parts: ['pasta', 'herb', 'tomato'],
    steps: ['boil', 'chop', 'toss'],
    tags: ['boil', 'chop'],
    blurb: 'Boiled nest, chopped herb, tomato bits.',
    tier: 0,
  },
  {
    id: 'melt',
    name: 'Onion Melt',
    short: 'Melt',
    price: 130,
    parts: ['bun', 'patty', 'onion', 'cheese'],
    steps: ['grill', 'chop', 'stack'],
    tags: ['grill', 'chop'],
    blurb: 'Patty, sweet onion, cheese, toasted bun.',
    tier: 1,
  },
  {
    id: 'toast',
    name: 'Garden Toast',
    short: 'Toast',
    price: 110,
    parts: ['bun', 'tomato', 'onion', 'herb'],
    steps: ['chop', 'chop', 'pile'],
    tags: ['chop'],
    blurb: 'Everything green on a toasted bun.',
    tier: 0,
  },
];

export const DISH_BY_ID = Object.fromEntries(DISHES.map((d) => [d.id, d]));

export function dishById(id) {
  return DISH_BY_ID[id] || DISHES[0];
}

export function partsLabel(dish) {
  return dish.parts.map((id) => (INGREDIENTS[id].process ? INGREDIENTS[id].sliced : INGREDIENTS[id].name)).join(' + ');
}
