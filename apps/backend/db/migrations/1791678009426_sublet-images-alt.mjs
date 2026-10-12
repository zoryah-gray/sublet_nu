// Expand-only: adds a nullable column. Nothing writes to sublet_images yet, so
// there is nothing to backfill. width/height are deliberately NOT added — image
// dimensions are an upload-pipeline/compression concern, revisit when photo
// upload ships.
//
// RULE: migrations use pgm.sql(...) only — never the pgm.createTable()-style DSL.

export const shorthands = undefined;

export const up = (pgm) => {
  pgm.sql(`
    SET LOCAL lock_timeout = '5s';
    ALTER TABLE sublet_images ADD COLUMN alt text;
  `);
};

export const down = (pgm) => {
  pgm.sql(`
    SET LOCAL lock_timeout = '5s';
    ALTER TABLE sublet_images DROP COLUMN alt;
  `);
};
