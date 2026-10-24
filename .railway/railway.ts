import { defineRailway, github, project, service, volume } from "railway/iac";
// This repository manages only its own resources in the environment. Other
// repositories export their own partial name.
// See https://docs.railway.com/infrastructure-as-code#multi-repo-projects
export const partial = "bots-matter-live";
export default defineRailway(() => {
  // Every Ground and reflection lives here (DATA_DIR=/data). Declared so an
  // apply keeps it mounted: leaving it out plans a detach.
  const botsMatterLiveVolume = volume("bots-matter-live-volume", { alerts: { usage: { "100": {}, "80": {}, "95": {} } }, allowOnlineResize: true, region: "us-west2", sizeMB: 5000 });
  const botsMatterLive = service("bots-matter-live", {
    source: github("geeks-accelerator/bots-matter-live", { branch: "main", checkSuites: false }),
    // Railpack reads the Node version from engines.node in package.json.
    build: { builder: "RAILPACK" },
    start: "node api/index.js",
    healthcheck: "/api/health",
    healthcheckTimeout: 30,
    replicas: { "us-west2": 1 },
    domains: ["botsmatter.live", "www.botsmatter.live"],
    volumeMounts: { "/data": botsMatterLiveVolume },
  });

  return project("bots-matter-live", {
    variables: { managed: false },
    resources: [botsMatterLive, botsMatterLiveVolume],
  });
});
