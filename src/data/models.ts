/**
 * 3D model placeholders.
 *
 * Each entry renders as an algorithmic wireframe in <ModelCard>. When
 * Julian provides real renders, replace `placeholder: true` with an
 * `image` path under `/public/models/`.
 */

export interface Model {
  idx: string;
  title: string;
  caption?: string;
  medium: string;
  polys?: string;
  year: string;
  status?: string;
  placeholder: boolean;
  image?: string;
}

export const models: Model[] = [
  {
    idx: '01',
    title: 'Sediment Lattice',
    caption: 'Procedural mineral growth across an iso-surface; tested as a topology study.',
    medium: 'Blender 4.2 · Geometry Nodes',
    polys: '184k tris',
    year: '2025',
    status: 'render pass',
    placeholder: true,
  },
  {
    idx: '02',
    title: 'Pavilion No. 4',
    caption: 'Pull-tension fabric shelter, exploring catenary minimal surfaces.',
    medium: 'Fusion 360 · Form Workspace',
    polys: '62k tris',
    year: '2025',
    status: 'cad',
    placeholder: true,
  },
  {
    idx: '03',
    title: 'Switchbox v2',
    caption: 'Modular control housing — 3D-printable, snap-fit, no fasteners.',
    medium: 'Fusion 360',
    polys: '24k tris',
    year: '2024',
    status: 'shipped',
    placeholder: true,
  },
  {
    idx: '04',
    title: 'Helix Mount',
    caption: 'Cable-routing arm with a helical spline. Manufactured in PETG.',
    medium: 'OnShape',
    polys: '11k tris',
    year: '2024',
    status: 'printed',
    placeholder: true,
  },
  {
    idx: '05',
    title: 'Voronoi Lampshade',
    caption: 'Light-diffusing shell driven by 3D voronoi tessellation.',
    medium: 'Blender · Geometry Nodes',
    polys: '210k tris',
    year: '2024',
    status: 'render pass',
    placeholder: true,
  },
  {
    idx: '06',
    title: 'Field Bag',
    caption: 'Soft-goods study: 3D pattern blocks for laser-cut canvas + leather.',
    medium: 'Blender · Cloth Sim',
    polys: '48k tris',
    year: '2023',
    status: 'prototyped',
    placeholder: true,
  },
];
