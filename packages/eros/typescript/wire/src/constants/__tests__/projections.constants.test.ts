import { describe, expect, test } from 'bun:test';

import kindsFile from '../../../../../common/spec/kinds.yaml';
import { PROJECTIONS } from '../projections.constants';

const kinds: unknown = kindsFile;

const projectionsOf = (file: unknown): unknown =>
  typeof file === 'object' && file !== null && 'projections' in file ? file.projections : undefined;

describe('PROJECTIONS', () => {
  test('should hold the projections of every kind of the spec when kinds.yaml is read', () => {
    // Arrange
    const projections = projectionsOf(kinds);

    // Act
    const constants = PROJECTIONS;

    // Assert
    expect<unknown>(constants).toStrictEqual(projections);
  });
});
