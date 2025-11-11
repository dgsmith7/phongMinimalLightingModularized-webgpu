function addEventListeners() {
  //cam
  document.querySelector("#camX").textContent = camX;
  document.querySelector("#cam-x-axis").value = camX;
  document
    .querySelector("#cam-x-axis")
    .addEventListener("pointermove", (event) => {
      camX = parseInt(event.target.value);
      document.querySelector("#camX").textContent = event.target.value;
    });
  document.querySelector("#camY").textContent = camY;
  document.querySelector("#cam-y-axis").value = camY;
  document
    .querySelector("#cam-y-axis")
    .addEventListener("pointermove", (event) => {
      camY = parseInt(event.target.value);
      document.querySelector("#camY").textContent = event.target.value;
    });
  document.querySelector("#camZ").textContent = camZ;
  document.querySelector("#cam-z-axis").value = camZ;
  document
    .querySelector("#cam-z-axis")
    .addEventListener("pointermove", (event) => {
      camZ = parseInt(event.target.value);
      document.querySelector("#camZ").textContent = event.target.value;
    });

  // light
  document.querySelector("#lightX").textContent = lightX;
  document.querySelector("#light-x-axis").value = lightX;
  document
    .querySelector("#light-x-axis")
    .addEventListener("pointermove", (event) => {
      lightX = parseInt(event.target.value);
      document.querySelector("#lightX").textContent = event.target.value;
    });
  document.querySelector("#lightY").textContent = lightY;
  document.querySelector("#light-y-axis").value = lightY;
  document
    .querySelector("#light-y-axis")
    .addEventListener("pointermove", (event) => {
      lightY = parseInt(event.target.value);
      document.querySelector("#lightY").textContent = event.target.value;
    });
  document.querySelector("#lightZ").textContent = lightZ;
  document.querySelector("#light-z-axis").value = lightZ;
  document
    .querySelector("#light-z-axis")
    .addEventListener("pointermove", (event) => {
      lightZ = parseInt(event.target.value);
      document.querySelector("#lightZ").textContent = event.target.value;
    });
}
