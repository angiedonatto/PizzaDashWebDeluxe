export const LEVELS = [{
  name: "Barrio Soleado",
  duration: 95,
  required: 3,
  traffic: 105,
  theme: "neighborhood",
  mode: "solo",
  sky: "#8ed8ff",
  grass: "#86c968",
  road: "#6c7480",
  accent: "#ef5a43",
  start: { x: 632, y: 360 }
}, {
  name: "Parque Central",
  duration: 105,
  required: 4,
  traffic: 125,
  theme: "park",
  mode: "race",
  sky: "#a6e4ff",
  grass: "#75bd65",
  road: "#7c786f",
  accent: "#3e9b5f",
  start: { x: 600, y: 580 }
}, {
  name: "Ciudad Nocturna",
  duration: 150,
  required: 4,
  traffic: 125,
  theme: "night",
  mode: "stormRace",
  sky: "#202757",
  grass: "#334b52",
  road: "#3f4659",
  accent: "#8d5fd3",
  start: { x: 632, y: 360 }
}];

export const LEVEL_URLS = ["../level-1/", "../level-2/", "../level-3/"];

export const MAX_PIZZAS = 2;

export const PIZZERIA = {
  x: 34,
  y: 556,
  w: 136,
  h: 82,
  refillX: 102,
  refillY: 648,
  radius: 58
};

export const RIVAL_PIZZERIA = {
  x: 1102,
  y: 552,
  w: 144,
  h: 86,
  refillX: 1174,
  refillY: 660,
  radius: 54
};
