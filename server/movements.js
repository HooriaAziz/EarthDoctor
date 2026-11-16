// Real, widely recognised environmental observances and campaigns. The model
// may only pick from this list (by id) and explain relevance; names, dates
// and hashtags shown to users always come from here, never from the model.
export const MOVEMENTS = [
  { id: "earth-hour", name: "Earth Hour", when: "Last Saturday of March", hashtag: "#EarthHour", focus: "energy use, awareness" },
  { id: "earth-day", name: "Earth Day", when: "22 April", hashtag: "#EarthDay", focus: "general environmental action" },
  { id: "world-environment-day", name: "World Environment Day", when: "5 June", hashtag: "#WorldEnvironmentDay", focus: "UN day for environmental action" },
  { id: "world-oceans-day", name: "World Oceans Day", when: "8 June", hashtag: "#WorldOceansDay", focus: "oceans, coasts, marine pollution" },
  { id: "world-bicycle-day", name: "World Bicycle Day", when: "3 June", hashtag: "#WorldBicycleDay", focus: "transport, cycling" },
  { id: "plastic-free-july", name: "Plastic Free July", when: "July", hashtag: "#PlasticFreeJuly", focus: "plastic waste" },
  { id: "clean-air-day", name: "International Day of Clean Air for blue skies", when: "7 September", hashtag: "#WorldCleanAirDay", focus: "air pollution, power, industry, transport" },
  { id: "world-cleanup-day", name: "World Cleanup Day", when: "20 September", hashtag: "#WorldCleanupDay", focus: "litter, waste, community clean-ups" },
  { id: "car-free-day", name: "World Car Free Day", when: "22 September", hashtag: "#CarFreeDay", focus: "transport emissions" },
  { id: "zero-waste-day", name: "International Day of Zero Waste", when: "30 March", hashtag: "#ZeroWasteDay", focus: "waste, circular economy" },
  { id: "forests-day", name: "International Day of Forests", when: "21 March", hashtag: "#IntlForestDay", focus: "forests, land use, agriculture" },
  { id: "world-water-day", name: "World Water Day", when: "22 March", hashtag: "#WorldWaterDay", focus: "water, agriculture" },
  { id: "meat-free-monday", name: "Meat Free Monday", when: "Every Monday", hashtag: "#MeatFreeMonday", focus: "food, agriculture emissions" },
  { id: "fridays-for-future", name: "Fridays for Future", when: "Ongoing youth climate movement", hashtag: "#FridaysForFuture", focus: "youth, schools, climate policy" },
  { id: "generation-restoration", name: "UN Decade on Ecosystem Restoration", when: "2021–2030", hashtag: "#GenerationRestoration", focus: "restoring ecosystems, land" },
];

export const MOVEMENT_BY_ID = new Map(MOVEMENTS.map((m) => [m.id, m]));
