import { openapi as elysiaOpenapi } from "@elysia/openapi";
import packageJson from "@/package.json";
import path from "node:path";
import { scalarCss } from "@/server/scalarCss";

const licenseUrl = new URL(packageJson.repository.url);

licenseUrl.pathname = path.posix.join(
  licenseUrl.pathname,
  "/blob/main/LICENSE",
);

export const openapi = elysiaOpenapi({
  documentation: {
    info: {
      title: packageJson.displayName,
      version: packageJson.version,
      contact: {
        email: packageJson.author.email,
        name: packageJson.author.name,
        url: packageJson.author.url,
      },
      description: packageJson.description,
      license: {
        name: packageJson.license,
        url: licenseUrl.toString(),
      },
    },
    tags: [
      {
        name: "Device",
        description: "Endpoints to manipulate devices.",
      },
    ],
  },
  scalar: {
    customCss: scalarCss,
    withDefaultFonts: false,
    showDeveloperTools: "localhost",
    hideDarkModeToggle: true,
    forceDarkModeState: "dark",
  },
});
