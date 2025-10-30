const light = document.getElementById("light");
const temp = document.getElementById("temp");
const humidity = document.getElementById("humidity");
const water = document.getElementById("water");
const plantType = document.getElementById("plantType");
const simulateBtn = document.getElementById("simulate");

const growthEl = document.getElementById("growth");
const healthEl = document.getElementById("health");
const colorEl = document.getElementById("color");
const stem = document.getElementById("stem");

simulateBtn.addEventListener("click", simulateGrowth);

function simulateGrowth() {
  const L = +light.value;
  const T = +temp.value;
  const H = +humidity.value;
  const W = +water.value;
  const type = plantType.value;

  // простая формула роста
  let growthRate = (L * 0.3 + H * 0.2 + W * 0.4) / 100;
  let tempFactor = 1 - Math.abs(T - 25) / 50; // оптимум ~25°C
  let growth = (growthRate * tempFactor * 50).toFixed(1);
  let health = Math.min(100, (tempFactor * 100)).toFixed(0);

  // цвет в зависимости от здоровья
  let color = "зеленый";
  if (health < 60) color = "желтый";
  if (health < 30) color = "коричневый";

  // тип растения влияет на рост
  if (type === "algae") growth *= 1.5;
  if (type === "succulent") growth *= 0.7;

  // обновление интерфейса
  growthEl.textContent = growth;
  healthEl.textContent = health;
  colorEl.textContent = color;
  stem.style.height = `${growth * 3}px`;
  stem.style.background = color === "зеленый" ? "green" : color === "желтый" ? "goldenrod" : "brown";
}
