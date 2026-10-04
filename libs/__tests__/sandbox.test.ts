import { describe, expect, test } from 'bun:test';

const REFUSAL = 'A spec reached the network: give it the fake of its transport';

describe('sandbox', () => {
  test.each([
    [
      'fetch',
      (): unknown => fetch('https://example.com'),
    ],
    [
      'a WebSocket',
      (): unknown => new WebSocket('wss://example.com'),
    ],
    [
      'a socket',
      (): unknown =>
        Bun.connect({
          hostname: 'example.com',
          port: 443,
          socket: {
            data: (): void => undefined,
          },
        }),
    ],
  ])('should refuse %s when a spec reaches the network', (_name, reach) => {
    // Arrange
    // Act
    const act = reach;

    // Assert
    expect(act).toThrow(new Error(REFUSAL));
  });
});
