// @ts-check
import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://gemeinsam-im-dorf.de",
  image: {
    // Drive photos are fetched at build time and re-encoded locally.
    // Google may redirect downloads to googleusercontent.com, so both hosts are allowed.
    remotePatterns: [
      { protocol: "https", hostname: "www.googleapis.com", pathname: "/drive/v3/files/*" },
      { protocol: "https", hostname: "**.googleusercontent.com" },
    ],
  },
});
