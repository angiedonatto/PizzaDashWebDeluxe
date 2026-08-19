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
  intro: "Entrega primero. Vence a la empresa rival.",
  start: { x: 632, y: 360 }
}, {
  name: "Zona Industrial",
  duration: 55,
  required: 6,
  traffic: 180,
  theme: "industrial",
  mode: "solo",
  sky: "#f39a62",
  grass: "#b97858",
  road: "#62545a",
  accent: "#e56b43",
  intro: "Nivel 4: cruza la hora pico bajo un cielo de atardecer.",
  start: { x: 632, y: 360 }
}];

export const LEVEL_URLS = ["../level-1/", "../level-2/", "../level-3/", "../level-4/"];

export const MAX_PIZZAS = 2;

export const PIZZERIA = {
  x: 12,
  y: 527,
  w: 205,
  h: 122,
  refillX: 114,
  refillY: 585,
  radius: 88
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
