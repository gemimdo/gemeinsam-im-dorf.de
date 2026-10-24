// @ts-check
import { defineConfig } from "astro/config";

// Drive photos are downloaded into .cache/drive by the content loaders and processed
// as local images, so no remote image hosts need to be allowed here.
export default defineConfig({
  site: "https://gemeinsam-im-dorf.de",
});
