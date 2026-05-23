// Place any global data in this file.
// You can import this data from anywhere in your site by using the `import` keyword.

export const SITE_TITLE = "databased.business";
export const SITE_DESCRIPTION =
  "Field notes from a data analytics MSc. Transparent models, opaque models, and the things in between.";
export const SITE_URL = "https://databased.business";

export const AUTHOR = {
  name: "Julian Elliott",
  handle: "Julian-Elliott",
  email: "julian@databased.business",
  bluesky: "https://bsky.app/profile/databased.business",
  linkedin: "https://www.linkedin.com/in/julianelliott",
  github: "https://github.com/Julian-Elliott",
};

// Section taxonomy — every nav surface in the site references this.
// The root path `/` IS the field notes feed; there is no separate index.
export const SECTIONS = [
  { idx: "01", slug: "/",       label: "field notes",  title: "Field notes" },
  { idx: "02", slug: "/models", label: "renders",      title: "3D renders"  },
  { idx: "03", slug: "/code",   label: "shipped code", title: "Shipped code" },
  { idx: "04", slug: "/shop",   label: "shop",         title: "Shop"        },
] as const;
