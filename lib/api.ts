// https://github.com/FalconChristmas/fpp/blob/88a9c40d98f873a6e3399df03f8e5c6a20f510c2/www/api/controllers/help.php
// https://github.com/FalconChristmas/fpp/blob/88a9c40d98f873a6e3399df03f8e5c6a20f510c2/www/api/endpoints.json

// the hostname of the fcc controller we are connected to
const HOSTNAME = "192.168.8.1/api";

/** route must have a `/` */
async function sendRequest(
  method: "GET" | "DELETE" | "POST",
  route: string,
  body: BodyInit,
) {
  await fetch(HOSTNAME + route, {
    method,
    body,
  });
}
